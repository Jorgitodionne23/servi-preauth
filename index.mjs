/* eslint-env node */
// index.mjs (ES Module version of your server)
import 'dotenv/config';
import express from 'express';
import StripePackage from 'stripe';
import path from 'path';
import { pool, initDb } from './db.pg.mjs';
import {
  computePricing,
  computeVisitPreauthPricing,
  VISIT_PREAUTH_PROVIDER_PESOS,
  VISIT_PREAUTH_TOTAL_PESOS
} from './pricing.mjs';
import { fileURLToPath, URLSearchParams } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'crypto';

// --- helpers (add) ---
const MS_PER_DAY = 86_400_000;
function daysAheadFromYMD(ymd) {
  if (!ymd) return 0;
  const [y,m,d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return 0;
  const serviceUTC = Date.UTC(y, m - 1, d);
  return Math.ceil((serviceUTC - Date.now()) / MS_PER_DAY);
}
async function hasSavedCard(customerId, stripe) {
  if (!customerId) return false;
  const pm = await stripe.paymentMethods.list({ customer: customerId, type: 'card', limit: 1 });
  return pm.data.length > 0;
}

function hoursUntilService(row) {
  // Prefer exact timestamp if you store it
  if (row.service_datetime) {
    const t = new Date(row.service_datetime).getTime();
    return (t - Date.now()) / 3_600_000;
  }
  // Fallback: date-only anchored at midnight local time to avoid DST edges
  if (row.service_date) {
    const [y,m,d] = String(row.service_date).split('-').map(Number);
    const t = new Date(y, (m||1)-1, d||1, 0, 0, 0, 0).getTime();
    return (t - Date.now()) / 3_600_000;
  }
  return Infinity;
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function normalizeNameKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const BOOKING_TYPE_LABELS = {
  RANGO: 'Rango de Precio',
  VISITA: 'Visita para cotizar'
};

function normalizeBookingType(value) {
  const raw = String(value || '').trim();
  if (!raw) return BOOKING_TYPE_LABELS.RANGO;
  const norm = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('visita')) return BOOKING_TYPE_LABELS.VISITA;
  if (norm.includes('anticipo')) return BOOKING_TYPE_LABELS.VISITA; // map legacy anticipo to visita
  if (norm.includes('rango')) return BOOKING_TYPE_LABELS.RANGO;
  return BOOKING_TYPE_LABELS.RANGO;
}

function bookingTypeKey(value) {
  const normalized = normalizeBookingType(value);
  if (normalized === BOOKING_TYPE_LABELS.VISITA) return 'visita';
  return 'rango';
}

async function findSavedClientByPhoneDigits(digits) {
  if (!digits) return null;
  const { rows } = await pool.query(
    `
      SELECT customer_id,
             customer_name,
             customer_email,
             customer_phone,
             latest_payment_method_id,
             last_order_id
        FROM saved_servi_users
       WHERE regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g') = $1
       ORDER BY last_checked_at DESC
       LIMIT 1
    `,
    [digits]
  );
  return rows[0] || null;
}

async function findSavedClientByEmailNormalized(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const { rows } = await pool.query(
    `
      SELECT customer_id,
             customer_name,
             customer_email,
             customer_phone,
             latest_payment_method_id,
             last_order_id
        FROM saved_servi_users
       WHERE LOWER(customer_email) = LOWER($1)
       ORDER BY last_checked_at DESC
       LIMIT 1
    `,
    [normalized]
  );
  return rows[0] || null;
}

async function findLatestEmailByPhoneDigits(digits) {
  if (!digits) return null;
  const saved = await findSavedClientByPhoneDigits(digits);
  if (saved && normalizeEmail(saved.customer_email)) {
    return { ...saved, source: 'saved' };
  }
  const { rows } = await pool.query(
    `
      SELECT id,
             client_email,
             client_phone,
             client_name,
             customer_id,
             created_at
        FROM all_bookings
       WHERE regexp_replace(COALESCE(client_phone, ''), '[^0-9]', '', 'g') = $1
         AND client_email IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1
    `,
    [digits]
  );
  const row = rows[0] || null;
  if (row && normalizeEmail(row.client_email)) {
    return { ...row, source: 'order' };
  }
  return null;
}

async function findExistingEmailOwner(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const saved = await findSavedClientByEmailNormalized(normalized);
  if (saved) {
    return {
      email: saved.customer_email,
      phone: saved.customer_phone,
      customerId: saved.customer_id,
      customerName: saved.customer_name,
      source: 'saved',
      orderId: saved.last_order_id || null
    };
  }

  const { rows } = await pool.query(
    `
      SELECT id,
             client_email,
             client_phone,
             client_name,
             customer_id
        FROM all_bookings
       WHERE LOWER(client_email) = LOWER($1)
       ORDER BY created_at DESC
       LIMIT 1
    `,
    [normalized]
  );
  const row = rows[0] || null;
  if (!row) return null;
  return {
    email: row.client_email,
    phone: row.client_phone,
    customerId: row.customer_id,
    customerName: row.client_name,
    orderId: row.id,
    source: 'order'
  };
}

async function lookupContactByPhoneDigits(digits) {
  if (!digits) return null;
  const found = await findLatestEmailByPhoneDigits(digits);
  if (!found) return null;
  return {
    email: found.customer_email || found.client_email || null,
    phone: found.customer_phone || found.client_phone || null,
    customerId: found.customer_id || null,
    customerName: found.customer_name || found.client_name || null,
    orderId: found.last_order_id || found.id || null,
    source: found.source || null
  };
}

async function upsertSavedServiUserContact({
  customerId,
  name,
  email,
  phone,
  lastOrderId = null
}) {
  if (!customerId) return;
  await pool.query(
    `
      INSERT INTO saved_servi_users (
        customer_id,
        customer_name,
        customer_email,
        customer_phone,
        last_order_id,
        first_checked_at,
        last_checked_at
      )
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      ON CONFLICT (customer_id) DO UPDATE SET
        customer_name  = COALESCE(EXCLUDED.customer_name, saved_servi_users.customer_name),
        customer_email = COALESCE(EXCLUDED.customer_email, saved_servi_users.customer_email),
        customer_phone = COALESCE(EXCLUDED.customer_phone, saved_servi_users.customer_phone),
        last_order_id  = COALESCE(EXCLUDED.last_order_id, saved_servi_users.last_order_id),
        last_checked_at = NOW(),
        first_checked_at = COALESCE(saved_servi_users.first_checked_at, EXCLUDED.first_checked_at)
    `,
    [customerId, name || null, normalizeEmail(email), phone || null, lastOrderId || null]
  );
}

const BOOK_SUCCESS_STATUSES = new Set(['Scheduled', 'Confirmed', 'Captured']);
const PAY_SUCCESS_STATUSES = new Set(['Scheduled', 'Confirmed', 'Captured']);
const LINK_EXPIRATION_HOURS = 2;
const LINK_EXPIRATION_MS = LINK_EXPIRATION_HOURS * 60 * 60 * 1000;
const PREAUTH_WINDOW_HOURS = 24;
const PREAUTH_WINDOW_MS = PREAUTH_WINDOW_HOURS * 60 * 60 * 1000;
const EARLY_PREAUTH_THRESHOLD_HOURS = 72;

function getLinkExpirationInfo(createdAt) {
  const createdMs = createdAt ? new Date(createdAt).getTime() : null;
  if (!createdMs || Number.isNaN(createdMs)) {
    return { expired: false, expiresAtMs: null, expiresAtIso: null };
  }
  const expiresAtMs = createdMs + LINK_EXPIRATION_MS;
  return {
    expired: Date.now() >= expiresAtMs,
    expiresAtMs,
    expiresAtIso: new Date(expiresAtMs).toISOString()
  };
}

function assertOrderLinkActive(row, { allowExpired = false, createdAtOverride = null } = {}) {
  const createdRef = createdAtOverride ?? row?.created_at ?? row?.createdAt ?? null;
  const info = getLinkExpirationInfo(createdRef);
  if (info.expired && !allowExpired) {
    const err = makeError('link_expired', 'This payment or booking link has expired', 410);
    err.linkExpiresAt = info.expiresAtIso || null;
    throw err;
  }
  return info;
}

function normalizeRetryToken(value) {
  const token = String(value || '').trim();
  return token || null;
}

function resolveRetryTokenContext(row, retryToken) {
  const normalized = normalizeRetryToken(retryToken);
  if (!normalized) {
    return { usingRetryToken: false, createdAtOverride: null };
  }
  const stored = row?.retry_token || row?.retryToken || null;
  const created = row?.retry_token_created_at || row?.retryTokenCreatedAt || null;
  if (!stored || !created) {
    return { usingRetryToken: false, createdAtOverride: null };
  }
  if (!constantTimeEquals(stored, normalized)) {
    return { usingRetryToken: false, createdAtOverride: null };
  }
  return { usingRetryToken: true, createdAtOverride: created };
}

function getRetryTokenFromQuery(query) {
  if (!query) return '';
  return String(query.retryToken || query.rt || '');
}

// ── generate a unique public_code for /o/:code ────────────────────────────
async function generateUniqueCode(len = 10) {
  for (let i = 0; i < 6; i++) {
    const code = randomBytes(8)
      .toString('base64url')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, len);

  const { rows } = await pool.query('SELECT 1 FROM all_bookings WHERE public_code = $1', [code]);
    if (rows.length === 0) return code;
  }
  throw new Error('Could not generate unique public code');
}

// ── ensure the order has a Stripe customer; return its id ─────────────────
async function ensureCustomerForOrder(stripe, orderRow) {
  if (orderRow.customer_id) {
    const updates = {};
    if (orderRow.client_name) updates.name = orderRow.client_name;
    if (orderRow.client_email) updates.email = normalizeEmail(orderRow.client_email);
    if (orderRow.client_phone) updates.phone = orderRow.client_phone;
    if (Object.keys(updates).length) {
      await stripe.customers.update(orderRow.customer_id, updates);
    }  
    await upsertSavedServiUserContact({
      customerId: orderRow.customer_id,
      name: orderRow.client_name || null,
      email: orderRow.client_email || null,
      phone: orderRow.client_phone || null,
      lastOrderId: orderRow.id || null
    });
    return orderRow.customer_id;
  }

  const customer = await stripe.customers.create({
    name: orderRow.client_name || undefined,
    email: normalizeEmail(orderRow.client_email) || undefined,
    phone: orderRow.client_phone || undefined,
  });

  await pool.query('UPDATE all_bookings SET customer_id=$1 WHERE id=$2', [customer.id, orderRow.id]);
  await upsertSavedServiUserContact({
    customerId: customer.id,
    name: orderRow.client_name || null,
    email: orderRow.client_email || null,
    phone: orderRow.client_phone || null,
    lastOrderId: orderRow.id || null
  });
  return customer.id;
}

function normalizeEmail(value) {
  const email = String(value || '').trim();
  if (!email) return null;
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  if (!pattern.test(email)) return null;
  return email.toLowerCase();
}

async function syncOrderEmail(orderId, rawEmail, { existingRow } = {}) {
  const email = normalizeEmail(rawEmail);
  if (!email) return null;

  let row = existingRow;
  if (!row) {
    const { rows } = await pool.query(
      'SELECT client_email, customer_id FROM all_bookings WHERE id = $1',
      [orderId]
    );
    row = rows[0] || null;
  }

  if (!row) return null;

  const current = normalizeEmail(row.client_email);
  const changed = current !== email;

  if (changed) {
    await pool.query('UPDATE all_bookings SET client_email = $1 WHERE id = $2', [email, orderId]);
  }

  if (existingRow) {
    existingRow.client_email = email;
  }

  if (changed && row.customer_id) {
    try {
      await stripe.customers.update(row.customer_id, { email });
    } catch (err) {
      console.warn(
        'syncOrderEmail: failed to update Stripe customer email',
        row.customer_id,
        err?.message || err
      );
    }
  }

  if (row.customer_id) {
    try {
      await upsertSavedServiUserContact({
        customerId: row.customer_id,
        name: existingRow?.client_name || row.client_name || null,
        email,
        phone: existingRow?.client_phone || row.client_phone || null,
        lastOrderId: existingRow?.id || null
      });
    } catch (contactErr) {
      console.warn('syncOrderEmail: failed to upsert saved_servi_users', row.customer_id, contactErr?.message || contactErr);
    }
  }

  return email;
}


// Pretty Spanish display for service date/time
function displayEsMX(serviceDateTime, serviceDate, tz = 'America/Mexico_City') {
  try {
    let d;
    if (serviceDateTime) {
      d = new Date(serviceDateTime);
    } else if (serviceDate) {
      // if only a date exists, set noon to avoid DST edges
      d = new Date(`${serviceDate}T12:00:00`);
    } else {
      return null;
    }
    const parts = new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: tz
    }).formatToParts(d);

    const get = t => parts.find(p => p.type === t)?.value || '';
    let weekday = get('weekday');
    let day     = get('day');
    let month   = get('month');
    let hour    = get('hour');
    let minute  = get('minute');
    let period  = get('dayPeriod'); // "a. m." / "p. m."

    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    weekday = cap(weekday);
    month   = cap(month);

    const ampm = (period || '').toLowerCase().includes('a') ? 'A.M.' : 'P.M.';
    return `${weekday}, ${day} de ${month}, a las ${hour}:${minute} ${ampm}`;
  } catch {
    return null;
  }
}


// For __dirname in ES modules
await initDb(); // run before defining routes

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const stripe = new StripePackage(process.env.STRIPE_SECRET_KEY);
const GOOGLE_SCRIPT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbweLYI8-4Z-kW_wahnkHw-Kgmc1GfjI9-YR6z9enOCO98oTXsd9DgTzN_Cm87Drcycb/exec'
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

if (!endpointSecret) {
  console.error('Missing STRIPE_WEBHOOK_SECRET environment variable; webhook verification will fail.');
  throw new Error('STRIPE_WEBHOOK_SECRET must be configured before starting the server');
}

function constantTimeEquals(a, b) {
  if (!a || !b) return false;
  const aBuf = Buffer.from(String(a), 'utf8');
  const bBuf = Buffer.from(String(b), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function getAdminTokenFromReq(req) {
  if (!req) return '';
  const authHeader = req.get('authorization') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim();
  }
  if (!token) {
    token = req.get('x-servi-admin-token') || '';
  }
  return token;
}

function isAdminRequest(req) {
  if (!ADMIN_API_TOKEN) return false;
  const token = getAdminTokenFromReq(req);
  if (!token) return false;
  return constantTimeEquals(token, ADMIN_API_TOKEN);
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_API_TOKEN) {
    console.error('ADMIN_API_TOKEN is not configured; rejecting admin route access');
    return res.status(500).json({ error: 'admin_auth_not_configured' });
  }

  const token = getAdminTokenFromReq(req);
  if (!token) {
    console.warn('Rejected admin request due to missing token');
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!constantTimeEquals(token, ADMIN_API_TOKEN)) {
    console.warn('Rejected admin request due to invalid token');
    return res.status(401).json({ error: 'unauthorized' });
  }

  return next();
}

function postToGoogleWebhook(payload) {
  if (!GOOGLE_SCRIPT_WEBHOOK_URL) return;
  fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

function notifyConsentChange({
  customerId,
  parentOrderId,
  sourceOrderId,
  consent,
  paymentMethodId,
  paymentIntentId
}) {
  if (!customerId) return;
  const payload = {
    type: 'customer.consent',
    customerId,
    consent: Boolean(consent),
    orderId: parentOrderId || sourceOrderId || ''
  };
  if (parentOrderId) payload.parentOrderId = parentOrderId;
  if (sourceOrderId) payload.sourceOrderId = sourceOrderId;
  if (paymentMethodId) payload.paymentMethodId = paymentMethodId;
  if (paymentIntentId) payload.paymentIntentId = paymentIntentId;
  postToGoogleWebhook(payload);
}

async function createBillingPortalPrompt(orderRow, { failureReason } = {}) {
  try {
    if (!orderRow.customer_id) {
      const ensured = await ensureCustomerForOrder(stripe, orderRow);
      orderRow.customer_id = ensured;
    }
    if (!orderRow.customer_id) return null;
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://servi-preauth.onrender.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: orderRow.customer_id,
      return_url: `${baseUrl}/book?orderId=${encodeURIComponent(orderRow.id)}`
    });
    const firstName = String(orderRow.client_name || '')
      .trim()
      .split(/\s+/)[0] || 'SERVI cliente';
    const serviceText = displayEsMX(
      orderRow.service_datetime,
      orderRow.service_date,
      'America/Mexico_City'
    );
    const intro =
      `Hola ${firstName}, tu método de pago no se pudo confirmar` +
      (serviceText ? ` para ${serviceText}` : '') +
      '.';
    const reasonLine = failureReason ? ` Motivo: ${failureReason}.` : '';
    const message = `${intro}${reasonLine} Actualiza tu método aquí: ${session.url}`;
    return { url: session.url, message };
  } catch (err) {
    console.warn('createBillingPortalPrompt failed', orderRow?.id, err?.message || err);
    return null;
  }
}

async function createBookRetryPrompt(orderRow, { failureReason } = {}) {
  try {
    if (!orderRow?.id) return null;
    const token = randomBytes(12).toString('base64url');
    const update = await pool.query(
      `
        UPDATE all_bookings
           SET retry_token = $1,
               retry_token_created_at = NOW()
         WHERE id = $2
         RETURNING retry_token_created_at, public_code
      `,
      [token, orderRow.id]
    );
    const issuedAt = update.rows[0]?.retry_token_created_at || new Date().toISOString();
    const publicCode =
      update.rows[0]?.public_code ||
      orderRow.public_code ||
      '';
    const normalizedCode = String(publicCode || '')
      .trim()
      .toUpperCase();
    const baseUrl = process.env.PUBLIC_BASE_URL || 'https://servi-preauth.onrender.com';
    const bookParams = new URLSearchParams();
    bookParams.set('orderId', orderRow.id);
    bookParams.set('rt', token);
    let url = `${baseUrl}/book?${bookParams.toString()}`;
    if (normalizedCode) {
      const params = new URLSearchParams();
      params.set('rt', token);
      url = `${baseUrl}/o/${normalizedCode}?${params.toString()}`;
    }

    const firstName = String(orderRow.client_name || '')
      .trim()
      .split(/\s+/)[0] || 'SERVI cliente';
    const serviceText = displayEsMX(
      orderRow.service_datetime,
      orderRow.service_date,
      'America/Mexico_City'
    );
    const intro =
      `Hola ${firstName}, tu método de pago no se pudo confirmar` +
      (serviceText ? ` para ${serviceText}` : '') +
      '.';
    const reasonLine = failureReason ? ` Motivo: ${failureReason}.` : '';
    const message = `${intro}${reasonLine} Actualiza tu método y confirma aquí: ${url}`;

    return { url, message, token, issued_at: issuedAt };
  } catch (err) {
    console.warn('createBookRetryPrompt failed', orderRow?.id, err?.message || err);
    return null;
  }
}

async function handlePreauthFailure(orderRow, { error, failure } = {}) {
  if (!orderRow || !orderRow.id) return null;
  const statusLabel = 'Declined';
  const failureInfo = failure || (error ? describeStripeFailure(error) : null);
  const failureMessage = failureInfo?.friendly || failureInfo?.message || null;
  try {
    await pool.query('UPDATE all_bookings SET status=$1 WHERE id=$2', [statusLabel, orderRow.id]);
  } catch (statusErr) {
    console.warn('handlePreauthFailure status update failed', orderRow.id, statusErr?.message || statusErr);
  }

  let retryPrompt = null;
  try {
    retryPrompt = await createBookRetryPrompt(orderRow, { failureReason: failureMessage });
  } catch (portalErr) {
    console.warn('handlePreauthFailure retry prompt failed', orderRow.id, portalErr?.message || portalErr);
  }

  if (GOOGLE_SCRIPT_WEBHOOK_URL) {
    const payload = {
      type: 'order.status',
      orderId: orderRow.id,
      status: statusLabel,
      customerId: orderRow.customer_id || '',
      parentOrderId: orderRow.parent_id_of_adjustment || ''
    };
    if (failureMessage) payload.failureReason = failureMessage;
    if (failureInfo?.decline_code) payload.failureCode = failureInfo.decline_code;
    if (failureInfo?.payment_intent_id && !payload.paymentIntentId) {
      payload.paymentIntentId = failureInfo.payment_intent_id;
    }
    if (retryPrompt?.message) payload.billingPortalMessage = retryPrompt.message;
    if (retryPrompt?.url) payload.billingPortalUrl = retryPrompt.url;
    fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  if (error) {
    const info = failureInfo || describeStripeFailure(error) || {};
    const code = info?.decline_code || info?.failure_code || error?.code || '';
    const msg = info?.friendly || info?.message || error?.message || error;
    console.warn('handlePreauthFailure triggered by error', orderRow.id, code, msg);
  }
  return retryPrompt;
}

function firstChargeFromPaymentIntent(pi) {
  if (!pi) return null;
  if (pi.latest_charge && typeof pi.latest_charge === 'object') {
    return pi.latest_charge;
  }
  const list = pi.charges?.data;
  return Array.isArray(list) && list.length ? list[0] : null;
}

function describeStripeFailure(error) {
  if (!error) return null;
  const raw = error?.raw || error;
  const piValue = raw?.payment_intent || error?.payment_intent || null;
  const paymentIntent =
    piValue && typeof piValue === 'object' ? piValue : null;
  const paymentIntentId =
    typeof piValue === 'string' ? piValue : paymentIntent?.id || null;
  const lastError =
    raw?.last_payment_error ||
    paymentIntent?.last_payment_error ||
    raw?.error ||
    null;
  const charge = firstChargeFromPaymentIntent(paymentIntent) || null;
  const declineCode =
    raw?.decline_code ||
    lastError?.decline_code ||
    charge?.outcome?.reason ||
    null;
  const failureCode = lastError?.code || raw?.code || null;
  const sellerMessage =
    charge?.outcome?.seller_message || charge?.failure_message || null;
  const baseMessage =
    lastError?.message ||
    sellerMessage ||
    raw?.message ||
    error?.message ||
    null;
  const friendlyParts = [];
  if (baseMessage) friendlyParts.push(baseMessage);
  if (
    declineCode &&
    !String(baseMessage || '')
      .toLowerCase()
      .includes(String(declineCode).toLowerCase())
  ) {
    friendlyParts.push(`(${declineCode})`);
  }
  return {
    payment_intent_id: paymentIntentId,
    decline_code: declineCode || null,
    failure_code: failureCode || null,
    message: baseMessage || null,
    friendly: friendlyParts.join(' ').trim() || null
  };
}

function computeProcessingFeeCents({ totalCents, percent, fixedFeePesos, feeVatRate }) {
  const amountPesos = totalCents / 100;
  const feeBeforeVat = percent * amountPesos + fixedFeePesos;
  const feeWithVat = feeBeforeVat * (1 + feeVatRate);
  return Math.max(0, Math.ceil(feeWithVat * 100));
}

function rebalanceBookingAndVat({ totalCents, providerCents, processingCents, vatRate }) {
  // VAT applies only to booking + processing; iterate to satisfy total = provider + booking + processing + VAT
  let bookingCents = Math.max(
    0,
    totalCents - providerCents - processingCents - Math.ceil(vatRate * processingCents)
  );

  for (let i = 0; i < 6; i++) {
    const vatBaseCents = bookingCents + processingCents;
    const vatCents = Math.ceil(vatRate * vatBaseCents);
    const totalCheck = providerCents + bookingCents + processingCents + vatCents;
    const diff = totalCents - totalCheck;
    if (diff === 0) {
      return { bookingCents, vatCents };
    }
    bookingCents = Math.max(0, bookingCents + diff);
  }

  const vatCents = Math.ceil(vatRate * (bookingCents + processingCents));
  return { bookingCents, vatCents };
}

function makeError(code, message, status) {
  const err = new Error(message || code);
  err.code = code;
  if (status) err.status = status;
  return err;
}

async function requireSavedClientNameMatch(clientName, clientPhone, { savedRecord = null } = {}) {
  const digits = normalizePhoneDigits(clientPhone);
  if (!digits) return;
  let saved = savedRecord;
  if (!saved || !saved.latest_payment_method_id) {
    const found = await findSavedClientByPhoneDigits(digits);
    saved = found && found.latest_payment_method_id ? found : saved;
  }
  if (!saved || !saved.latest_payment_method_id) return;
  const storedKey = normalizeNameKey(saved.customer_name);
  if (!storedKey) return;
  const providedKey = normalizeNameKey(clientName);
  if (!providedKey) {
    const err = makeError(
      'name_required_for_saved_client',
      'Ingresa el nombre registrado del cliente para este teléfono.',
      409
    );
    err.expectedName = saved.customer_name || null;
    throw err;
  }
  if (storedKey !== providedKey) {
    const err = makeError(
      'name_phone_mismatch',
      'El nombre no coincide con el teléfono guardado para este SERVI Client.',
      409
    );
    err.expectedName = saved.customer_name || null;
    throw err;
  }
}

async function refreshOrderFees(orderId, { paymentIntentId, paymentMethodId, retryToken } = {}) {
  if (!orderId) throw makeError('order_required', 'order id required', 400);
  if (!paymentIntentId && !paymentMethodId) {
    throw makeError('payment_source_required', 'payment intent or payment method required', 400);
  }

  const { rows } = await pool.query(
    `SELECT id,
            amount,
            provider_amount,
            booking_fee_amount,
            processing_fee_amount,
            vat_amount,
            vat_rate,
            stripe_percent_fee,
            stripe_fixed_fee,
            stripe_fee_tax_rate,
            payment_intent_id,
            created_at,
            retry_token,
            retry_token_created_at
       FROM all_bookings
      WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) {
    throw makeError('order_not_found', 'order not found', 404);
  }
  const { createdAtOverride } = resolveRetryTokenContext(order, retryToken);
  const linkRow = createdAtOverride ? { ...order, created_at: createdAtOverride } : order;
  assertOrderLinkActive(linkRow);

  if (paymentIntentId && order.payment_intent_id && order.payment_intent_id !== paymentIntentId) {
    throw makeError('mismatched_payment_intent', 'payment intent does not match order', 409);
  }

  let cardCountry = null;
  let currency = 'mxn';
  let pmId = paymentMethodId || null;

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge', 'charges.data.payment_method_details']
    });

    const charge = firstChargeFromPaymentIntent(pi);
    cardCountry = (charge?.payment_method_details?.card?.country || '').toUpperCase();
    currency = (charge?.currency || pi.currency || currency).toLowerCase();
    pmId = pmId || charge?.payment_method || pi.payment_method || null;
  }

  if (!cardCountry && pmId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(pmId);
      cardCountry = (pm?.card?.country || '').toUpperCase() || cardCountry;
    } catch (err) {
      console.warn('refreshOrderFees: could not retrieve payment method', pmId, err?.message || err);
    }
  }

  const storedPercentRaw = Number(order.stripe_percent_fee);
  const percent = Number.isFinite(storedPercentRaw) ? storedPercentRaw : 0.061; // stick to stored/worst-case rate

  const isInternational = !!cardCountry && cardCountry !== 'MX';
  const isConversion = currency && currency !== 'mxn';
  let feeType = 'domestic';
  if (isInternational && isConversion) {
    feeType = 'international_conversion';
  } else if (isInternational) {
    feeType = 'international';
  } else if (isConversion) {
    feeType = 'conversion';
  } else if (!cardCountry) {
    feeType = 'domestic';
  }

  const feeVatRateRaw = Number(order.stripe_fee_tax_rate);
  const feeVatRate = Number.isFinite(feeVatRateRaw) ? feeVatRateRaw : 0.16;
  const fixedFeeRaw = Number(order.stripe_fixed_fee);
  // Handle both historical pesos storage (e.g., 3) and cent storage (e.g., 300)
  let fixedFeePesos = 3;
  if (Number.isFinite(fixedFeeRaw)) {
    fixedFeePesos = fixedFeeRaw >= 50 ? fixedFeeRaw / 100 : fixedFeeRaw;
  }

  const totalCents = Number(order.amount ?? order.pricing_total_amount ?? 0);
  const providerCents = Number(order.provider_amount ?? 0);
  const vatRateRaw = Number(order.vat_rate);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw : 0.16;

  if (!(totalCents > 0)) {
    throw makeError('total_missing', 'order total is missing', 400);
  }

  const processingCents = computeProcessingFeeCents({
    totalCents,
    percent,
    fixedFeePesos,
    feeVatRate
  });

  const { bookingCents, vatCents } = rebalanceBookingAndVat({
    totalCents,
    providerCents,
    processingCents,
    vatRate
  });

  const baseCheck = providerCents + bookingCents;
  const totalCheck = baseCheck + processingCents + vatCents;
  if (totalCheck !== totalCents) {
    console.warn('Fee refresh rounding mismatch', { orderId, totalCents, totalCheck });
  }

  await pool.query(
    `UPDATE all_bookings
        SET processing_fee_amount = $1,
            booking_fee_amount    = $2,
            vat_amount            = $3,
            stripe_percent_fee    = $4,
            stripe_fixed_fee      = $5,
            stripe_fee_tax_rate   = $6,
            processing_fee_type   = $7
      WHERE id = $8`,
    [
      processingCents,
      bookingCents,
      vatCents,
      percent,
      Math.round(fixedFeePesos * 100),
      feeVatRate,
      feeType,
      orderId
    ]
  );

  return {
    processing_fee_amount: processingCents,
    booking_fee_amount: bookingCents,
    vat_amount: vatCents,
    stripe_percent_fee: percent,
    stripe_fixed_fee: Math.round(fixedFeePesos * 100),
    stripe_fee_tax_rate: feeVatRate,
    payment_method_id: pmId || null,
    processing_fee_type: feeType,
    card_country: cardCountry || null,
    currency
  };
}

// 📦 General middleware
// Parse JSON for everything EXCEPT /webhook (Stripe needs raw body there)
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') return next();
  return express.json()(req, res, next);
});

// 🚫 Block direct access to the static success.html; force gated route instead
app.get('/success.html', (req, res) => {
  const orderId = req.query.orderId;
  if (orderId) {
    return res.redirect(302, `/success?orderId=${encodeURIComponent(orderId)}`);
  }
  return res.redirect(302, '/');
});

app.use(express.static('public'));

// 🎯 Create PaymentIntent (save card for later off-session charges)
app.post('/create-payment-intent', requireAdminAuth, async (req, res) => {
  const {
    amount,
    clientName,
    serviceDescription,
    serviceDate,
    serviceDateTime,
    clientEmail,
    clientPhone,
    consent,
    serviceAddress,
    bookingType: bookingTypeRaw,
    hasTimeComponent,
    capture
  } = req.body;
  const bookingType = normalizeBookingType(bookingTypeRaw);
  const bookingKey = bookingTypeKey(bookingType);
  let providerPricePesos = Number(amount);
  if (bookingKey === 'visita') {
    providerPricePesos =
      Number.isFinite(providerPricePesos) && providerPricePesos > 0
        ? providerPricePesos
        : VISIT_PREAUTH_PROVIDER_PESOS;
  } else if (!Number.isFinite(providerPricePesos) || providerPricePesos <= 0) {
    return res.status(400).send({ error: 'invalid_provider_amount', message: 'amount must be a positive number (MXN pesos)' });
  }
  const clientEmailNormalized = normalizeEmail(clientEmail);
  if (!clientEmailNormalized) {
    return res.status(400).send({
      error: 'email_required',
      message: 'Ingresa un email válido antes de generar el enlace.'
    });
  }
  const phoneDigits = normalizePhoneDigits(clientPhone);
  if (!phoneDigits) {
    return res.status(400).send({
      error: 'phone_required_for_email',
      message: 'Agrega el WhatsApp del cliente antes de generar el enlace.'
    });
  }
  try {
    const captureMethod = String(capture).toLowerCase() === 'automatic' ? 'automatic' : 'manual';
    const savedPhoneRecord = phoneDigits ? await findSavedClientByPhoneDigits(phoneDigits) : null;
    const storedPhoneNameKey = savedPhoneRecord ? normalizeNameKey(savedPhoneRecord.customer_name) : '';
    const providedPhoneNameKey = normalizeNameKey(clientName);
    if (
      savedPhoneRecord &&
      !savedPhoneRecord.latest_payment_method_id &&
      storedPhoneNameKey &&
      providedPhoneNameKey &&
      storedPhoneNameKey !== providedPhoneNameKey
    ) {
      return res.status(409).send({
        error: 'phone_name_conflict',
        message: `Este número ya está asociado a ${savedPhoneRecord.customer_name || 'otro cliente'}. Verifica el nombre antes de continuar.`,
        existingName: savedPhoneRecord.customer_name || null
      });
    }
    await requireSavedClientNameMatch(clientName, clientPhone, { savedRecord: savedPhoneRecord });
    const emailOwner = await findExistingEmailOwner(clientEmailNormalized);
    if (emailOwner) {
      const ownerDigits = normalizePhoneDigits(emailOwner.phone);
      if (ownerDigits && phoneDigits && ownerDigits !== phoneDigits) {
        return res.status(409).send({
          error: 'email_phone_conflict',
          message: 'Este email ya está asociado a otro número. Revisa el email y el WhatsApp.',
          existingPhone: emailOwner.phone || ownerDigits || null,
          existingCustomerId: emailOwner.customerId || null
        });
      }
    }
    // 1) Find or create Stripe Customer by email/phone (your existing logic)
    // 1) Only SEARCH for an existing customer now; don't create yet
    let existingCustomer = null;
    const esc = (s) => String(s || '').replace(/'/g, "\\'");
    if (clientEmailNormalized) {
      const found = await stripe.customers.search({ query: `email:'${esc(clientEmailNormalized)}'` });
      if (found.data?.length) existingCustomer = found.data[0];
    }
    if (!existingCustomer && clientPhone) {
      const found = await stripe.customers.search({ query: `phone:'${esc(clientPhone)}'` });
      if (found.data?.length) existingCustomer = found.data[0];
    }

    // Compute policy early
    const daysAhead = daysAheadFromYMD(serviceDate);
    const longLead = daysAhead >= 5;

    // Precise fractional hours ahead for consistent comparisons everywhere
    const hoursAhead = hoursUntilService({
      service_datetime: serviceDateTime || null,
      service_date: serviceDate || null
    });
    const hasExplicitTime = typeof hasTimeComponent === 'boolean' ? hasTimeComponent : Boolean(serviceDateTime);
    const serviceInPast = hasExplicitTime
      ? Number.isFinite(hoursAhead) && hoursAhead < -0.01
      : daysAhead < 0;
    if (serviceInPast) {
      return res.status(400).send({
        error: 'past_service_date',
        message: 'La fecha y hora del servicio ya pasó. Ajusta "Service Date and Time".',
        hoursAhead
      });
    }
    const {
      providerAmountCents,
      bookingFeeAmountCents,
      processingFeeAmountCents,
      vatAmountCents,
      totalAmountCents,
      components: {
        alphaValue,
        urgencyMultiplier,
        vatRate,
        stripePercent,
        stripeFixed: stripeFixedPesos,
        stripeFeeVatRate
      }
    } =
      bookingKey === 'visita'
        ? computeVisitPreauthPricing({
            totalPesos: VISIT_PREAUTH_TOTAL_PESOS,
            providerPesos: VISIT_PREAUTH_PROVIDER_PESOS
          })
        : computePricing({
            providerPricePesos,
            leadTimeHours: hoursAhead
          });
    // If long lead and NO consent, do not create a new customer yet
    // We can still check for saved card if an existing customer was found
    let saved = false;
    if (existingCustomer) {
      saved = await hasSavedCard(existingCustomer.id, stripe);
    }

    if (existingCustomer && (clientPhone || clientEmailNormalized || clientName)) {
      const updates = {};
      if (clientName && !existingCustomer.name) updates.name = clientName;
      if (clientEmailNormalized && !existingCustomer.email) updates.email = clientEmailNormalized;
      if (clientPhone && !existingCustomer.phone) updates.phone = clientPhone;
      if (Object.keys(updates).length) {
        await stripe.customers.update(existingCustomer.id, updates);
      }
      await upsertSavedServiUserContact({
        customerId: existingCustomer.id,
        name: clientName || existingCustomer.name || null,
        email: clientEmailNormalized || existingCustomer.email || null,
        phone: clientPhone || existingCustomer.phone || null,
        lastOrderId: null
      });
    }

    // Create the order row (allow NULL customer_id for now)
    const orderId = randomUUID();
    const publicCode = await generateUniqueCode();
    const stripeFixedFeeCents = Math.round(Number(stripeFixedPesos || 0) * 100);
    await pool.query(
      `INSERT INTO all_bookings (
        id,
        amount,
        provider_amount,
        booking_fee_amount,
        processing_fee_amount,
        vat_amount,
        pricing_total_amount,
        client_name,
        service_description,
        client_phone,
        client_email,
        service_date,
        service_address,
        booking_type,
        capture_method,
        status,
        public_code,
        kind,
        customer_id,
        vat_rate,
        stripe_percent_fee,
        stripe_fixed_fee,
        stripe_fee_tax_rate,
        processing_fee_type,
        urgency_multiplier,
        alpha_value
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,$14,
        $15,'pending',$16,'primary',$17,
        $18,$19,$20,$21,$22,$23,$24
      )
      ON CONFLICT (id) DO NOTHING`,
      [
        orderId,
        totalAmountCents,
        providerAmountCents,
        bookingFeeAmountCents,
        processingFeeAmountCents,
        vatAmountCents,
        totalAmountCents,
        clientName || null,
        serviceDescription || null,
        clientPhone || null,
        clientEmailNormalized || null,
        serviceDate || null,
        serviceAddress || null,
        bookingType || null,
        captureMethod,
        publicCode,
        existingCustomer?.id || null,
        vatRate,
        stripePercent,
        stripeFixedFeeCents,
        stripeFeeVatRate,
        'standard',
        urgencyMultiplier,
        alphaValue
      ]
    );

    // also persist service_date/service_datetime (you already do)
    await pool.query(
      'UPDATE all_bookings SET service_date=$1, service_datetime=$2, client_phone=$3, client_email=$4, service_address=$5, booking_type=$6 WHERE id=$7',
      [
        serviceDate || null,
        serviceDateTime || null,
        clientPhone || null,
        clientEmailNormalized || null,
        serviceAddress || null,
        bookingType || null,
        orderId
      ]
    );
    // --- NEW: determine if we already have consent (customer-level or order-level) ---
    let hasConsent = false;
    if (existingCustomer?.id) {
      const cc = await pool.query('SELECT 1 FROM saved_servi_users WHERE customer_id = $1', [existingCustomer.id]);
      hasConsent = !!cc.rows.length;
    }
    if (!hasConsent) {
      const oc = await pool.query('SELECT 1 FROM consented_offsession_bookings WHERE order_id = $1', [orderId]);
      hasConsent = !!oc.rows.length;
    }

    // --- NEW POLICY: visits must be associated with an account/saved card ---
    if (bookingKey === 'visita' && !saved) {
      await pool.query('UPDATE all_bookings SET status=$1, kind=$2 WHERE id=$3', ['Blocked', 'setup_required', orderId]);
      return res.status(403).send({
        error: 'account_required',
        message: 'Las visitas para cotizar requieren una cuenta con método guardado.',
        orderId,
        publicCode,
        amount: totalAmountCents,
        clientEmail: clientEmailNormalized
      });
    }

    // Long-lead policy handling
    if (longLead) {
      if (!saved && !consent) {
        // no saved card and no consent → gate; DON'T create a Stripe customer yet
        await pool.query('UPDATE all_bookings SET status=$1, kind=$2 WHERE id=$3', ['Blocked', 'setup_required', orderId]);

          return res.status(403).send({
            error: 'account_required',
            message: 'Solo usuarios con cuenta pueden reservar con 5 días o mas de anticipación.',
            orderId,
            publicCode,
            amount: totalAmountCents,
            clientEmail: clientEmailNormalized
          });
        }

        if (!saved) {
          // we have consent but no saved card: we'll create a Customer later when we start SetupIntent
          await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['setup', orderId]);
          return res.send({ orderId, publicCode, requiresSetup: true, hasSavedCard: false, amount: totalAmountCents, clientEmail: clientEmailNormalized });
        }

        // already saved (because existingCustomer had PMs) → book flow, no PI yet
        await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['book', orderId]);
        return res.send({ orderId, publicCode, hasSavedCard: true, amount: totalAmountCents, clientEmail: clientEmailNormalized });
      }

    // Short-lead (≤5d)
    if (!longLead) {
      // If the customer ALREADY has a saved card and we're still outside the preauth window (>24h),
        if (saved && hoursAhead > PREAUTH_WINDOW_HOURS) {
          if (hasConsent) {
            await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['book', orderId]);
            return res.send({
              orderId,
              publicCode,
              hasSavedCard: true,
              paymentIntentId: null,   // no PI yet
              amount: totalAmountCents,
              clientEmail: clientEmailNormalized
            });
          } else {
            // Saved card found but no consent recorded → collect consent with Setup flow
            await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['setup', orderId]);
            return res.send({
              orderId,
              publicCode,
              requiresSetup: true,    // Sheet should NOT set "Scheduled"
              hasSavedCard: true,
              amount: totalAmountCents,
              clientEmail: clientEmailNormalized
            });
          }
        }


      // Otherwise proceed (create or reuse customer, then create a PI now)
      const customer = existingCustomer || await stripe.customers.create({
        name: clientName || undefined,
        email: clientEmailNormalized || undefined,
        phone: clientPhone || undefined,
      });

      await pool.query('UPDATE all_bookings SET customer_id=$1 WHERE id=$2', [customer.id, orderId]);
      await upsertSavedServiUserContact({
        customerId: customer.id,
        name: clientName || null,
        email: clientEmailNormalized || null,
        phone: clientPhone || null,
        lastOrderId: orderId
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmountCents,
        currency: 'mxn',
        capture_method: captureMethod,
        payment_method_types: ['card'],
        customer: customer.id,
        ...(consent ? { setup_future_usage: 'off_session' } : {}),
        metadata: { order_id: orderId, kind: 'primary' }
      });

      await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [paymentIntent.id, orderId]);

      return res.send({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId,
        publicCode,
        hasSavedCard: saved,
        amount: totalAmountCents,
        clientEmail: clientEmailNormalized
      });
    }


  } catch (err) {
    console.error('Error creating payment intent:', err);
    const status = err.status || 400;
    const payload = {
      error: err.code || 'create_payment_intent_failed',
      message: err.message || 'No se pudo crear la orden'
    };
    if (err.expectedName) {
      payload.expectedName = err.expectedName;
    }
    res.status(status).send(payload);
  }
});

// 📄 Serve pay page
app.get('/pay', async (req, res) => {
  try {
    const orderId = String(req.query.orderId || '').trim();
    if (orderId) {
      const r = await pool.query('SELECT status FROM all_bookings WHERE id = $1', [orderId]);
      const status = r.rows[0]?.status || '';
      if (PAY_SUCCESS_STATUSES.has(status)) {
        return res.redirect(302, `/success?orderId=${encodeURIComponent(orderId)}`);
      }
    }
  } catch (e) {
    console.error('pay route guard error:', e?.message || e);
  }
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

app.get('/save', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'save.html'));
});


// Serve publishable key to the client (same origin, no CORS needed)
app.get('/config/stripe', (_req, res) => {
  res.send({ pk: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});

app.get('/admin/contact-lookup', requireAdminAuth, async (req, res) => {
  try {
    const phoneDigits = normalizePhoneDigits(req.query.phone);
    const emailNormalized = normalizeEmail(req.query.email);

    if (!phoneDigits && !emailNormalized) {
      return res.status(400).json({
        error: 'phone_or_email_required',
        message: 'Phone or email is required for lookup'
      });
    }

    let contact = null;
    if (phoneDigits) {
      contact = await lookupContactByPhoneDigits(phoneDigits);
    }
    if (!contact && emailNormalized) {
      contact = await findExistingEmailOwner(emailNormalized);
    }
    if (!contact) {
      return res.status(404).json({ error: 'not_found' });
    }
    return res.json(contact);
  } catch (err) {
    const status = err.status || 500;
    console.error('contact-lookup error:', err?.message || err);
    return res.status(status).json({
      error: 'contact_lookup_failed',
      message: err.message || 'Lookup failed'
    });
  }
});


app.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const tokenParamRaw = getRetryTokenFromQuery(req.query);
    const wantsOverride = String(req.query.allowExpired || '') === '1' || !!tokenParamRaw;
    const retryTokenParam = wantsOverride ? tokenParamRaw : '';

    const { rows } = await pool.query(`
      SELECT id, payment_intent_id, amount, provider_amount, booking_fee_amount, processing_fee_amount,
        vat_amount, pricing_total_amount, vat_rate, stripe_percent_fee, stripe_fixed_fee,
        stripe_fee_tax_rate, processing_fee_type, urgency_multiplier, alpha_value,
        client_name, client_phone, client_email,
        service_description, service_date, service_datetime, service_address, booking_type, status, created_at,
        public_code, kind, parent_id_of_adjustment, customer_id, saved_payment_method_id, capture_method, adjustment_reason,
        retry_token, retry_token_created_at
      FROM all_bookings
      WHERE id = $1
    `, [orderId]);

    const row = rows[0];
    if (!row) return res.status(404).send({ error: 'Order not found' });
    const { usingRetryToken, createdAtOverride } = resolveRetryTokenContext(row, retryTokenParam);
    const allowExpired = wantsOverride && !usingRetryToken;
    const linkSource = createdAtOverride ? { ...row, created_at: createdAtOverride } : row;
    const linkInfo = assertOrderLinkActive(linkSource, { allowExpired });
    const linkExpired = linkInfo.expired;

    let pi = null;
    let intentType = null;       // 'payment' | 'setup' | null
    let consentRequired = false; // true when kind='setup_required' and no consent recorded

    // helper: check if we already recorded consent for this order
    async function hasConsent(orderId) {
      const c = await pool.query('SELECT 1 FROM consented_offsession_bookings WHERE order_id=$1', [orderId]);
      return !!c.rows.length;
    }

    if (!linkExpired && !row.payment_intent_id) {
      let kind = String(row.kind || '').toLowerCase();

      if (kind === 'setup_required') {
        // OPTIONAL: if this customer already has global consent, skip re-consent for this order
        if (row.customer_id) {
          const cc = await pool.query('SELECT 1 FROM saved_servi_users WHERE customer_id = $1', [row.customer_id]);
          if (cc.rows.length) {
            // If they already have a saved card, move straight to 'book'; otherwise create a SetupIntent
            const alreadySaved = await hasSavedCard(row.customer_id, stripe);
            if (alreadySaved) {
              await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['book', row.id]);
              pi = null;           // book flow has no client_secret
              intentType = null;
            } else {
              const customerId = await ensureCustomerForOrder(stripe, row);
              await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['setup', row.id]);
              const si = await stripe.setupIntents.create({
                customer: customerId,
                automatic_payment_methods: { enabled: true },
                usage: 'off_session',
                metadata: { kind: 'setup', order_id: row.id }
              });
              await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
              pi = si;
              intentType = 'setup';
            }
          } else {
            // No global consent → fall back to per-order consent requirement
            const c = await pool.query('SELECT 1 FROM consented_offsession_bookings WHERE order_id=$1', [row.id]);
            if (!c.rows.length) {
              consentRequired = true;
              pi = null;
              intentType = null; // no client_secret returned
            } else {
              const customerId = await ensureCustomerForOrder(stripe, row);
              await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['setup', row.id]);
              const si = await stripe.setupIntents.create({
                customer: customerId,
                automatic_payment_methods: { enabled: true },
                usage: 'off_session',
                metadata: { kind: 'setup', order_id: row.id }
              });
              await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
              pi = si;
              intentType = 'setup';
            }
          }
        } else {
          // No customer yet → original per-order logic
          const c = await pool.query('SELECT 1 FROM consented_offsession_bookings WHERE order_id=$1', [row.id]);
          if (!c.rows.length) {
            consentRequired = true;
            pi = null;
            intentType = null; // no client_secret returned
          } else {
            const customerId = await ensureCustomerForOrder(stripe, row);
            await pool.query('UPDATE all_bookings SET kind=$1 WHERE id=$2', ['setup', row.id]);
            const si = await stripe.setupIntents.create({
              customer: customerId,
              automatic_payment_methods: { enabled: true },
              usage: 'off_session',
              metadata: { kind: 'setup', order_id: row.id }
            });
            await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
            pi = si;
            intentType = 'setup';
          }
        }
      }

      
      else if (kind === 'setup') {
        // Lazily create the Customer if this order doesn't have one yet
        const customerId = await ensureCustomerForOrder(stripe, row);

        const si = await stripe.setupIntents.create({
          customer: customerId,
          automatic_payment_methods: { enabled: true },
          usage: 'off_session',
          metadata: { kind: 'setup', order_id: row.id }
        });

        await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
        pi = si;
        intentType = 'setup';


      } else if (kind === 'book') {
        let hasSavedCardForBook = Boolean(row.saved_payment_method_id);
        if (!hasSavedCardForBook && row.customer_id) {
          hasSavedCardForBook = await hasSavedCard(row.customer_id, stripe);
        }

        if (hasSavedCardForBook) {
          // Saved-card booking: never create a PI here.
          // The /confirm-with-saved route decides when to create/confirm (≤72h window).
          pi = null;
          intentType = null;
        } else {
          const hoursAhead = hoursUntilService(row);
          const LONG_LEAD_HOURS = 5 * 24;

          if (hoursAhead > LONG_LEAD_HOURS) {
            consentRequired = true;
            await pool.query(
              `UPDATE all_bookings
                  SET kind = 'setup_required',
                      payment_intent_id = NULL
                WHERE id = $1`,
              [row.id]
            );
            row.kind = 'setup_required';
            row.payment_intent_id = null;
            kind = 'setup_required';
            pi = null;
            intentType = null;
          } else {
            const capturePref = String(row.capture_method || '').toLowerCase();
            const captureMethod = capturePref === 'automatic' ? 'automatic' : 'manual';
            const adjustmentDescription = String(row.adjustment_reason || '').trim()
              ? `SERVI ajuste: ${row.adjustment_reason || 'SERVI adjustment'}`
              : null;

            const created = await stripe.paymentIntents.create({
              amount: row.amount,
              currency: 'mxn',
              payment_method_types: ['card'],
              capture_method: captureMethod,
              customer: row.customer_id || undefined,
              ...(adjustmentDescription ? { description: adjustmentDescription } : {}),
              metadata: {
                order_id: row.id,
                kind: 'primary',
                parent_order_id: row.parent_id_of_adjustment || ''
              }
            });

            await pool.query(
              `UPDATE all_bookings
                  SET payment_intent_id = $1,
                      kind = 'primary'
                WHERE id = $2`,
              [created.id, row.id]
            );
            row.kind = 'primary';
            row.payment_intent_id = created.id;
            kind = 'primary';
            pi = created;
            intentType = 'payment';
          }
        }

      } else {
        // Default (legacy primary/adjustments) — but DON'T create a PI early for saved + >24h
        const hours_ahead = hoursUntilService(row);

        let alreadySaved = false;
        if (row.customer_id) {
          alreadySaved = await hasSavedCard(row.customer_id, stripe);
        }

        if (alreadySaved && hours_ahead > EARLY_PREAUTH_THRESHOLD_HOURS) {
          // Convert legacy "primary" into "book" lazily, with no PI on read; clear PI so it re-creates inside 24h
          await pool.query(
            `
              UPDATE all_bookings
                 SET kind = 'book',
                     payment_intent_id = NULL,
                     status = CASE
                       WHEN status IN ('Confirmed','Captured') THEN status
                       ELSE 'Scheduled'
                     END
               WHERE id = $1
            `,
            [row.id]
          );
          row.kind = 'book';
          row.payment_intent_id = null;
          row.status = row.status === 'Confirmed' || row.status === 'Captured' ? row.status : 'Scheduled';
          pi = null;
          intentType = null;
        } else {
          const capturePref = String(row.capture_method || '').toLowerCase();
          const captureMethod = capturePref === 'automatic' ? 'automatic' : 'manual';
          const adjustmentDescription = String(row.kind || '').toLowerCase() === 'adjustment'
            ? `SERVI ajuste: ${row.adjustment_reason || 'SERVI adjustment'}`
            : null;

          const created = await stripe.paymentIntents.create({
            amount: row.amount,
            currency: 'mxn',
            payment_method_types: ['card'],
            capture_method: captureMethod,
            customer: row.customer_id || undefined,
            ...(adjustmentDescription ? { description: adjustmentDescription } : {}),
            metadata: {
              order_id: row.id,
              kind: row.kind || 'primary',
              parent_order_id: row.parent_id_of_adjustment || ''
            }
          });
          await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [created.id, row.id]);
          pi = created;
          intentType = 'payment';
        }
      }


    } else if (!linkExpired) {
      // Retrieve existing Intent
      const id = row.payment_intent_id;
      if (id) {
        const isSetup = id.startsWith('seti_');
        try {
          pi = isSetup
            ? await stripe.setupIntents.retrieve(id)
            : await stripe.paymentIntents.retrieve(id);
        } catch (retrieveErr) {
          console.warn('retrieve intent failed', id, retrieveErr?.message || retrieveErr);
          pi = null;
        }
        intentType = isSetup ? 'setup' : 'payment';
      } else {
        pi = null;
        intentType = null;
      }
    }


    // saved-card summary (unchanged)
    let saved_card = null;
    if (!linkExpired && row.customer_id) {
      try {
        const pmList = await stripe.paymentMethods.list({
          customer: row.customer_id,
          type: 'card',
          limit: 1
        });
        if (pmList.data.length) {
          const pm = pmList.data[0];
          saved_card = {
            id: pm.id,
            brand: pm.card?.brand || '',
            last4: pm.card?.last4 || '',
            exp_month: pm.card?.exp_month || null,
            exp_year: pm.card?.exp_year || null
          };
        }
      } catch (pmErr) {
        console.warn('saved-card lookup failed', pmErr?.message || pmErr);
      }
    }

    const service_display = displayEsMX(row.service_datetime, row.service_date, 'America/Mexico_City');
    const hours_ahead = hoursUntilService(row);
    const preauth_window_open = hours_ahead <= PREAUTH_WINDOW_HOURS && hours_ahead >= 0;
    const days_ahead = Math.ceil(Math.max(0, hours_ahead) / 24);

    res.set('Cache-Control', 'no-store');
    const pricing = {
      provider_amount: row.provider_amount ?? null,
      booking_fee_amount: row.booking_fee_amount ?? null,
      processing_fee_amount: row.processing_fee_amount ?? null,
      vat_amount: row.vat_amount ?? null,
      total_amount: row.amount ?? null,
      vat_rate: row.vat_rate ?? null,
      stripe_percent_fee: row.stripe_percent_fee ?? null,
      stripe_fixed_fee: row.stripe_fixed_fee ?? null,
      stripe_fee_tax_rate: row.stripe_fee_tax_rate ?? null,
      processing_fee_type: row.processing_fee_type ?? null,
      urgency_multiplier: row.urgency_multiplier ?? null,
      alpha_value: row.alpha_value ?? null
    };
    const { retry_token, retry_token_created_at, ...rowForResponse } = row;

    return res.json({
      ...rowForResponse,
      pricing,
      client_secret: pi?.client_secret || null,
      intentType,
      consent_required: consentRequired,
      saved_card: saved_card || null,
      service_display,
      days_ahead,
      hours_ahead,
      preauth_window_open,
      link_expired: linkExpired,
      link_expires_at: linkInfo.expiresAtIso || null
    });


  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('Error retrieving order:', err);
    }
    res.status(status).send({
      error: err.code || 'order_fetch_failed',
      message: err.message || 'Internal server error',
      linkExpired: err.code === 'link_expired',
      linkExpiresAt: err.linkExpiresAt || null
    });
  }
});

app.post('/orders/:orderId/refresh-fees', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentIntentId, paymentMethodId, billingEmail, retryToken } = req.body || {};
    if (billingEmail) {
      try {
        await syncOrderEmail(orderId, billingEmail);
      } catch (emailErr) {
        console.warn('refresh-fees: failed to persist billing email', orderId, emailErr?.message || emailErr);
      }
    }
    const result = await refreshOrderFees(orderId, { paymentIntentId, paymentMethodId, retryToken });
    return res.json({ ok: true, ...result });
  } catch (err) {
    const status =
      err.status ||
      (err.code === 'order_not_found'
        ? 404
        : err.code === 'mismatched_payment_intent'
          ? 409
          : err.code === 'payment_intent_required' || err.code === 'payment_source_required' || err.code === 'order_required' || err.code === 'total_missing'
            ? 400
            : 500);
    if (status >= 500) {
      console.error('refresh-fees error:', err);
    }
    return res.status(status).json({ error: err.code || 'fee_refresh_failed', message: err.message });
  }
});

app.post('/orders/:orderId/verify-phone-last4', async (req, res) => {
  try {
    const { orderId } = req.params;
    const submitted = normalizePhoneDigits(req.body?.last4).slice(0, 4);
    if (!orderId) {
      return res.status(400).json({ error: 'order_id_required', message: 'orderId requerido' });
    }
    if (submitted.length !== 4) {
      return res.status(400).json({ error: 'invalid_last4', message: 'Ingresa los últimos 4 dígitos del teléfono.' });
    }
    const { rows } = await pool.query('SELECT client_phone FROM all_bookings WHERE id = $1', [orderId]);
    const stored = rows[0];
    if (!stored) {
      return res.status(404).json({ error: 'order_not_found', message: 'Orden no encontrada.' });
    }
    const phoneDigits = normalizePhoneDigits(stored.client_phone);
    if (phoneDigits.length < 4) {
      return res.status(400).json({ error: 'phone_missing', message: 'No hay un teléfono guardado para esta reserva.' });
    }
    const last4 = phoneDigits.slice(-4);
    if (last4 !== submitted) {
      return res.status(401).json({ error: 'last4_mismatch', message: 'Los dígitos no coinciden.' });
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error('verify-phone-last4 error:', err);
    return res.status(500).json({ error: 'verify_failed', message: 'No se pudo verificar el teléfono.' });
  }
});

app.get('/o/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase();
    const retryTokenRaw = getRetryTokenFromQuery(req.query);
    const shouldOverride =
      String(req.query.allowExpired || '') === '1' || Boolean(retryTokenRaw);
    const retryTokenParam = shouldOverride ? retryTokenRaw : '';

    // 1) Find the order by code
    const { rows } = await pool.query(
      `SELECT id,
              kind,
              customer_id,
              saved_payment_method_id,
              status,
              created_at,
              retry_token,
              retry_token_created_at
         FROM all_bookings
        WHERE public_code = $1`,
      [code]
    );
    if (!rows[0]) return res.status(404).send('Not found');
    const row = rows[0];
    try {
      const { usingRetryToken, createdAtOverride } = resolveRetryTokenContext(row, retryTokenParam);
      const allowExpired = shouldOverride && !usingRetryToken;
      const linkSource = createdAtOverride ? { ...row, created_at: createdAtOverride } : row;
      assertOrderLinkActive(linkSource, { allowExpired });
    } catch (err) {
      if (err?.code === 'link_expired') {
        return res
          .status(410)
          .sendFile(path.join(__dirname, 'public', 'link-expired.html'));
      }
      throw err;
    }
    const rowStatus = String(row.status || '').trim();
    const buildOrderUrl = (basePath) => {
      const params = new URLSearchParams();
      params.set('orderId', row.id);
      if (shouldOverride) {
        if (retryTokenRaw) {
          params.set('rt', retryTokenRaw);
        } else {
          params.set('allowExpired', '1');
        }
      }
      return `${basePath}?${params.toString()}`;
    };
    if (BOOK_SUCCESS_STATUSES.has(rowStatus) || PAY_SUCCESS_STATUSES.has(rowStatus)) {
      return res.redirect(302, buildOrderUrl('/success'));
    }

    // 2) Explicit routing by kind
    if (row.kind === 'adjustment') {
      let hasSaved = Boolean(row.saved_payment_method_id);
      let firstPmId = row.saved_payment_method_id || null;

      if (!hasSaved && row.customer_id) {
        const pmList = await stripe.paymentMethods.list({
          customer: row.customer_id,
          type: 'card',
          limit: 1
        });
        hasSaved = pmList.data.length > 0;
        firstPmId = hasSaved ? pmList.data[0].id : null;
      }

      if (hasSaved && firstPmId && firstPmId !== row.saved_payment_method_id) {
        await pool.query(
          `UPDATE all_bookings
             SET saved_payment_method_id = $1
           WHERE id = $2`,
          [firstPmId, row.id]
        );
      }

      const target = hasSaved ? '/book' : '/pay';
      return res.redirect(302, buildOrderUrl(target));
    }
    if (row.kind === 'setup_required') return res.redirect(302, buildOrderUrl('/pay'));
    if (row.kind === 'setup')          return res.redirect(302, buildOrderUrl('/pay'));
    if (row.kind === 'book') {
      if (!row.saved_payment_method_id) {
        return res.redirect(302, buildOrderUrl('/pay'));
      }
      return res.redirect(302, buildOrderUrl('/book'));
    }

    // 3) Legacy 'primary' → check Stripe for saved PMs
    let hasSaved = false;
    let firstPmId = null;
    if (row.customer_id) {
      const pmList = await stripe.paymentMethods.list({
        customer: row.customer_id,
        type: 'card',
        limit: 1
      });
      hasSaved = pmList.data.length > 0;
      firstPmId = hasSaved ? pmList.data[0].id : null;
    }

    // 4) 🩹 Self-heal: persist what we learned so next time it routes directly
    if (hasSaved) {
      await pool.query(
        `UPDATE all_bookings
           SET kind='book',
               saved_payment_method_id = COALESCE($1, saved_payment_method_id)
         WHERE id=$2`,
        [firstPmId, row.id]
      );
      return res.redirect(302, buildOrderUrl('/book'));
    }

    // 5) No saved PM → pay flow
    return res.redirect(302, buildOrderUrl('/pay'));
  } catch (e) {
    console.error('/o/:code error:', e);
    return res.status(500).send('Internal error');
  }
});

// Customer lookup by phone (for save.html portal access)
app.get('/customer-lookup', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ error: 'phone required' });

    const esc = (s) => String(s || '').replace(/'/g, "\\'");
    const found = await stripe.customers.search({ query: `phone:'${esc(phone)}'` });
    
    if (!found.data?.length) {
      return res.status(404).json({ error: 'customer not found' });
    }

    return res.json({ customerId: found.data[0].id });
  } catch (err) {
    console.error('customer-lookup error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

// Standalone billing portal (no order required)
app.post('/billing-portal-standalone', async (req, res) => {
  try {
    const { customerId, returnUrl } = req.body || {};
    if (!customerId) return res.status(400).json({ error: 'customerId required' });

    const base = process.env.PUBLIC_BASE_URL || 'https://servi-preauth.onrender.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${base}/save`
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('billing-portal-standalone error:', err);
    return res.status(500).json({ error: err.message || 'Portal error' });
  }
});

// Create standalone SetupIntent (no order)
app.post('/create-standalone-setup', async (req, res) => {
  try {
    const si = await stripe.setupIntents.create({
      automatic_payment_methods: { enabled: true },
      usage: 'off_session',
      metadata: { kind: 'standalone_account_creation' }
    });

    return res.json({ client_secret: si.client_secret });
  } catch (err) {
    console.error('create-standalone-setup error:', err);
    return res.status(500).json({ error: err.message || 'Setup error' });
  }
});

// 📡 Stripe Webhook handler ex

app.post('/tasks/preauth-due', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      /* Pick saved-card "book" orders that are entering the 24h preauth window */
      WITH service_ts AS (
        SELECT
          id,
          amount,
          customer_id,
          saved_payment_method_id,
          parent_id_of_adjustment,
          kind,
          client_name,
          client_email,
          service_date,
          service_datetime,
          /* Use full timestamp if present; otherwise assume 08:00 local on service_date */
          COALESCE(
            service_datetime,
            (service_date::timestamp AT TIME ZONE 'America/Mexico_City') + INTERVAL '0 hours'
          ) AS svc_at
        FROM all_bookings
        WHERE kind = 'book'
          AND customer_id IS NOT NULL
          AND saved_payment_method_id IS NOT NULL
          AND payment_intent_id IS NULL
      )
      SELECT id, amount, customer_id, saved_payment_method_id, parent_id_of_adjustment, kind, client_name, client_email, service_date, service_datetime
      FROM service_ts
      WHERE svc_at >= NOW()
        AND svc_at <  NOW() + INTERVAL '24 hours'
      ORDER BY svc_at ASC
      LIMIT 50
    `);


    const results = [];
    for (const row of rows) {
      try {
        // Create MANUAL-CAPTURE PI and CONFRIM it off-session with the saved PM.
        // This places the authorization hold; webhook will set status=Confirmed.
        const pi = await stripe.paymentIntents.create({
          amount: row.amount,
          currency: 'mxn',
          capture_method: 'manual',
          customer: row.customer_id,
          payment_method: row.saved_payment_method_id,
          confirm: true,              // off-session auth
          off_session: true,
          metadata: { kind: row.kind || 'primary', parent_order_id: row.parent_id_of_adjustment || '' }
        });

        await pool.query(
          'UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2',
          [pi.id, row.id]
        );
        try {
          await refreshOrderFees(row.id, { paymentIntentId: pi.id });
        } catch (feeErr) {
          console.warn('[preauth-due] fee refresh failed', feeErr?.message || feeErr);
        }

        results.push({ orderId: row.id, pi: pi.id, status: pi.status });
      } catch (e) {
        const failure = describeStripeFailure(e);
        const logMsg = failure?.friendly || failure?.message || e?.message;
        console.error('[preauth-due] failed for', row.id, logMsg);
        try {
          await handlePreauthFailure(row, { error: e, failure });
        } catch (handleErr) {
          console.warn('[preauth-due] handlePreauthFailure error', row.id, handleErr?.message || handleErr);
        }
        results.push({
          orderId: row.id,
          error: e?.message || 'stripe_error',
          decline_code: failure?.decline_code || null,
          failure_reason: failure?.friendly || failure?.message || null
        });
      }
    }

    res.json({ ok: true, processed: results.length, results });
  } catch (e) {
    console.error('preauth-due error:', e);
    res.status(500).json({ ok: false, error: e.message || 'internal' });
  }
});

// Record consent (called from pay.html before confirming)
app.post('/orders/:id/consent', async (req, res) => {
  try {
    const { id } = req.params;
    const { version, text, hash, locale, tz, billingEmail, retryToken } = req.body || {};
    const ua = req.headers['user-agent'] || '';
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

    const serverHash = createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
    if (hash && hash !== serverHash) return res.status(400).send({ error: 'bad hash' });

    // Pull order info
    const or = await pool.query(`
      SELECT id,
             parent_id_of_adjustment,
             customer_id,
             saved_payment_method_id,
             client_name,
             client_email,
             client_phone,
             payment_intent_id,
             created_at,
             retry_token,
             retry_token_created_at
        FROM all_bookings
       WHERE id = $1
    `, [id]);
    const row = or.rows[0];
    if (!row) return res.status(404).send({ error: 'order not found' });
    const { createdAtOverride } = resolveRetryTokenContext(row, retryToken);
    const linkRow = createdAtOverride ? { ...row, created_at: createdAtOverride } : row;
    assertOrderLinkActive(linkRow);
    const parentOrderId = row.parent_id_of_adjustment || row.id;

    if (billingEmail) {
      try {
        await syncOrderEmail(row.id, billingEmail, { existingRow: row });
      } catch (emailErr) {
        console.warn('consent: failed to persist billing email', row.id, emailErr?.message || emailErr);
      }
    }

    let customerId = row.customer_id || null;
    if (!customerId) {
      customerId = await ensureCustomerForOrder(stripe, row);
      row.customer_id = customerId;
    } else {
      try {
        await ensureCustomerForOrder(stripe, row);
      } catch (errEnsure) {
        console.warn('ensureCustomerForOrder update failed', errEnsure?.message || errEnsure);
      }
    }

    if (customerId && row.payment_intent_id) {
      try {
        await stripe.paymentIntents.update(row.payment_intent_id, {
          customer: customerId
        });
      } catch (errPi) {
        console.warn('PI update for consent failed', errPi?.message || errPi);
      }
    }

    // 1) Per-order audit (kept as is)
    await pool.query(`
      INSERT INTO consented_offsession_bookings (order_id, customer_id, customer_name, payment_method_id, version, consent_text, text_hash, checked_at, ip, user_agent, locale, tz)
      VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11)
      ON CONFLICT (order_id) DO UPDATE SET
        customer_name = COALESCE(EXCLUDED.customer_name, consented_offsession_bookings.customer_name),
        version = EXCLUDED.version,
        consent_text = EXCLUDED.consent_text,
        text_hash = EXCLUDED.text_hash,
        checked_at = NOW(),
        ip = EXCLUDED.ip,
        user_agent = EXCLUDED.user_agent,
        locale = EXCLUDED.locale,
        tz = EXCLUDED.tz
    `, [id, row.customer_id, row.client_name || null, row.saved_payment_method_id, version || '1.0', text || '', serverHash, ip, ua, locale || null, tz || null]);

    // 2) One-row-per-customer registry (NEW) — only if we already have a customer_id
    if (row.customer_id) {
      await pool.query(`
        INSERT INTO saved_servi_users (
          customer_id, customer_name, customer_email, customer_phone,
          latest_payment_method_id, latest_text_hash, latest_version,
          first_checked_at, last_checked_at,
          first_order_id, last_order_id,
          ip, user_agent, locale, tz
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW(), $8, $9, $10,$11,$12,$13)
        ON CONFLICT (customer_id) DO UPDATE SET
          customer_name            = COALESCE(EXCLUDED.customer_name, saved_servi_users.customer_name),
          customer_email           = COALESCE(EXCLUDED.customer_email, saved_servi_users.customer_email),
          customer_phone           = COALESCE(EXCLUDED.customer_phone, saved_servi_users.customer_phone),
          latest_payment_method_id = COALESCE(EXCLUDED.latest_payment_method_id, saved_servi_users.latest_payment_method_id),
          latest_text_hash         = COALESCE(EXCLUDED.latest_text_hash, saved_servi_users.latest_text_hash),
          latest_version           = COALESCE(EXCLUDED.latest_version, saved_servi_users.latest_version),
          first_checked_at         = COALESCE(saved_servi_users.first_checked_at, EXCLUDED.first_checked_at),
          first_order_id           = COALESCE(saved_servi_users.first_order_id,   EXCLUDED.first_order_id),
          last_checked_at          = EXCLUDED.last_checked_at,
          last_order_id            = EXCLUDED.last_order_id,
          ip                       = EXCLUDED.ip,
          user_agent               = EXCLUDED.user_agent,
          locale                   = EXCLUDED.locale,
          tz                       = EXCLUDED.tz
      `, [
        row.customer_id,
        row.client_name || null,
        row.client_email || null,
        row.client_phone || null,
        row.saved_payment_method_id || null,
        serverHash,
        version || '1.0',
        parentOrderId, // first_order_id
        row.id, // last_order_id
        ip,
        ua,
        locale || null,
        tz || null
      ]);
    }

    notifyConsentChange({
      customerId: row.customer_id,
      parentOrderId,
      sourceOrderId: row.id,
      consent: true,
      paymentMethodId: row.saved_payment_method_id || null,
      paymentIntentId: row.payment_intent_id || null
    });


    // Promote order if it was gated
    await pool.query("UPDATE all_bookings SET kind='setup' WHERE id=$1 AND kind='setup_required'", [id]);

    res.send({ ok: true, hash: serverHash, version: version || '1.0' });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('consent error:', err);
    }
    res.status(status).send({
      error: err.code || 'consent_failed',
      message: err.message || 'Internal error',
      linkExpiresAt: err.linkExpiresAt || null
    });
  }
});


// Read consent (used by the Sheet for the Adjustments tab)
app.get('/orders/:id/consent', async (req, res) => {
  const { id } = req.params;

  const orderResult = await pool.query(
    'SELECT customer_id, saved_payment_method_id, parent_id_of_adjustment FROM all_bookings WHERE id=$1',
    [id]
  );
  const orderRow = orderResult.rows[0] || null;
  const customerId = orderRow?.customer_id || null;
  const orderSavedPmId = orderRow?.saved_payment_method_id || null;
  const parentOrderId = orderRow?.parent_id_of_adjustment || id;

  let paymentMethodId = orderSavedPmId || null;
  let version = null;
  let hash = null;
  let firstOrderId = null;
  let firstCheckedAt = null;
  let lastCheckedAt = null;
  let stripeHasMethod = Boolean(orderSavedPmId);
  let consentRowDeleted = false;

  if (customerId) {
    const consentRows = await pool.query(
      `
        SELECT latest_version AS version,
               latest_text_hash AS hash,
               first_order_id,
               first_checked_at,
               last_checked_at,
               latest_payment_method_id
          FROM saved_servi_users
         WHERE customer_id = $1
      `,
      [customerId]
    );

    const consentMeta = consentRows.rows[0] || null;
    if (consentMeta) {
      version = consentMeta.version || version;
      hash = consentMeta.hash || hash;
      firstOrderId = consentMeta.first_order_id || firstOrderId;
      firstCheckedAt = consentMeta.first_checked_at || firstCheckedAt;
      lastCheckedAt = consentMeta.last_checked_at || lastCheckedAt;
      if (consentMeta.latest_payment_method_id) {
        paymentMethodId = paymentMethodId || consentMeta.latest_payment_method_id;
        stripeHasMethod = true;
      }
    }

    try {
      const pmList = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
        limit: 1
      });
      const livePm = pmList.data[0] || null;
      stripeHasMethod = Boolean(livePm);
      paymentMethodId = livePm?.id || null;

      if (!stripeHasMethod) {
        try {
          const deleteResult = await pool.query(
            'DELETE FROM saved_servi_users WHERE customer_id = $1',
            [customerId]
          );
          consentRowDeleted = consentRowDeleted || deleteResult.rowCount > 0;
        } catch (clearConsentErr) {
          console.warn(
            'consent lookup: failed to delete saved_servi_users row',
            customerId,
            clearConsentErr?.message || clearConsentErr
          );
        }
        if (orderSavedPmId) {
          try {
            await pool.query(
              'UPDATE all_bookings SET saved_payment_method_id = NULL WHERE customer_id = $1',
              [customerId]
            );
          } catch (clearOrderErr) {
            console.warn(
              'consent lookup: failed to clear all_bookings.saved_payment_method_id',
              customerId,
              clearOrderErr?.message || clearOrderErr
            );
          }
        }
      }
    } catch (pmErr) {
      console.warn(
        'consent lookup card check failed',
        customerId,
        pmErr?.message || pmErr
      );
      stripeHasMethod = Boolean(paymentMethodId);
    }

    if (!version || !hash) {
      const legacyMeta = await pool.query(
        'SELECT version, text_hash FROM consented_offsession_bookings WHERE order_id=$1',
        [id]
      );
      if (legacyMeta.rows[0]) {
        version = version || legacyMeta.rows[0].version || null;
        hash = hash || legacyMeta.rows[0].text_hash || null;
      }
    }

    if (!stripeHasMethod) {
      if (!consentRowDeleted) {
        try {
          const deleteAgain = await pool.query(
            'DELETE FROM saved_servi_users WHERE customer_id = $1',
            [customerId]
          );
          consentRowDeleted = deleteAgain.rowCount > 0 || consentRowDeleted;
        } catch (deleteErr) {
          console.warn(
            'consent lookup: failed to delete saved_servi_users row (post-check)',
            customerId,
            deleteErr?.message || deleteErr
          );
        }
      }
      try {
        await pool.query(
          'UPDATE all_bookings SET saved_payment_method_id = NULL WHERE customer_id = $1',
          [customerId]
        );
      } catch (clearErr) {
        console.warn(
          'consent lookup: second-order saved_payment_method_id clear failed',
          customerId,
          clearErr?.message || clearErr
        );
      }
      if (customerId) {
        notifyConsentChange({
          customerId,
          parentOrderId,
          sourceOrderId: id,
          consent: false,
          paymentMethodId: null
        });
      }
    }

    return res.send({
      ok: stripeHasMethod,
      version: version || '1.0',
      hash: hash || null,
      first_order_id: firstOrderId || null,
      first_checked_at: firstCheckedAt || null,
      last_checked_at: lastCheckedAt || null,
      payment_method_id: stripeHasMethod ? paymentMethodId : null
    });
  }

  const legacyFallback = await pool.query(
    'SELECT version, text_hash FROM consented_offsession_bookings WHERE order_id=$1',
    [id]
  );
  if (!legacyFallback.rows[0]) {
    return res.send({
      ok: stripeHasMethod,
      version: '1.0',
      hash: null,
      payment_method_id: stripeHasMethod ? paymentMethodId : null
    });
  }

  return res.send({
    ok: stripeHasMethod,
    version: legacyFallback.rows[0].version || '1.0',
    hash: legacyFallback.rows[0].text_hash || null,
    payment_method_id: stripeHasMethod ? paymentMethodId : null
  });
});


app.get('/book', async (req, res) => {
  try {
    const orderId = String(req.query.orderId || '').trim();
    if (orderId) {
      const r = await pool.query('SELECT status FROM all_bookings WHERE id = $1', [orderId]);
      const status = r.rows[0]?.status || '';
      if (BOOK_SUCCESS_STATUSES.has(status)) {
        return res.redirect(302, `/success?orderId=${encodeURIComponent(orderId)}`);
      }
    }
  } catch (e) {
    console.error('book route guard error:', e?.message || e);
  }
  res.sendFile(path.join(__dirname, 'public', 'book.html'));
});

// Create an adjustment child order; saved clients now confirm via book.html and guests via pay.html.
// HONORS Sheets "Capture Type" via req.body.capture = 'automatic' | 'manual'
app.post('/create-adjustment', requireAdminAuth, async (req, res) => {
  try {
    const { parentOrderId, amount, note, capture } = req.body || {};
    if (!parentOrderId) return res.status(400).send({ error: 'missing_parent', message: 'parentOrderId required' });

    const baseAmountCents = Number(amount);
    if (!Number.isInteger(baseAmountCents) || baseAmountCents <= 0) {
      return res.status(400).send({ error: 'invalid_amount', message: 'amount must be a positive integer (cents)' });
    }

    const parentResult = await pool.query(
      `SELECT customer_id,
              saved_payment_method_id,
              payment_intent_id,
              client_name,
              client_phone,
              client_email,
              service_description,
              service_date,
              service_datetime,
              service_address,
              provider_amount,
              booking_type
         FROM all_bookings
        WHERE id = $1`,
      [parentOrderId]
    );
    const parentOrder = parentResult.rows[0];
    if (!parentOrder) return res.status(404).send({ error: 'parent_not_found', message: 'Parent order not found' });

    const consent = await pool.query('SELECT 1 FROM consented_offsession_bookings WHERE order_id=$1', [parentOrderId]);
    const hasConsent = consent.rows.length > 0;
    const hasSavedCard = Boolean(parentOrder.saved_payment_method_id);
    const canRouteToBook = Boolean(hasConsent && parentOrder.customer_id && hasSavedCard);

    const captureMethod = String(capture).toLowerCase() === 'manual' ? 'manual' : 'automatic';
    const providerPricePesos = baseAmountCents / 100;
    const parentBookingType = normalizeBookingType(parentOrder.booking_type);
    const parentBookingKey = bookingTypeKey(parentBookingType);
    const parentProviderCents = Number(parentOrder.provider_amount || 0);

    let pricing;
    try {
      pricing = computePricing({ providerPricePesos });
    } catch (err) {
      return res.status(400).send({ error: 'pricing_failed', message: err?.message || 'Unable to compute pricing for adjustment' });
    }

    const {
      providerAmountCents,
      bookingFeeAmountCents,
      processingFeeAmountCents,
      vatAmountCents,
      totalAmountCents,
      components: {
        alphaValue,
        vatRate,
        stripePercent,
        stripeFixed,
        stripeFeeVatRate
      }
    } = pricing;

    let providerAfterCreditCents = providerAmountCents;
    let totalAfterCreditCents = totalAmountCents;
    let creditAppliedCents = 0;
    if (parentBookingKey === 'visita') {
      const visitCreditCents = Math.round(Number(VISIT_PREAUTH_TOTAL_PESOS || 0) * 100);
      const credit = Math.max(0, Math.min(visitCreditCents, providerAmountCents));
      creditAppliedCents = credit;
      providerAfterCreditCents = providerAmountCents - credit;
      totalAfterCreditCents =
        providerAfterCreditCents + bookingFeeAmountCents + processingFeeAmountCents + vatAmountCents;
    }

    const stripeFixedFeeCents = Math.round(Number(stripeFixed || 0) * 100);
    const reason = (note ? String(note) : '').trim() || 'SERVI adjustment';
    const childId = randomUUID();
    const publicCode = await generateUniqueCode();
    const flow = canRouteToBook ? 'book' : 'pay';

    await pool.query(
      `
        INSERT INTO all_bookings (
          id,
          payment_intent_id,
          amount,
          provider_amount,
          booking_fee_amount,
          processing_fee_amount,
          vat_amount,
          pricing_total_amount,
          client_name,
          client_phone,
          client_email,
          service_description,
          service_date,
          service_datetime,
          service_address,
          booking_type,
          status,
          public_code,
          kind,
          parent_id_of_adjustment,
          customer_id,
          saved_payment_method_id,
          adjustment_reason,
          capture_method,
          vat_rate,
          stripe_percent_fee,
          stripe_fixed_fee,
          stripe_fee_tax_rate,
          processing_fee_type,
          alpha_value
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12,$13,$14,$15,$16,
          'Pending',$17,'adjustment',$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28
        )
      `,
      [
        childId,
        null,
        totalAfterCreditCents,
        providerAfterCreditCents,
        bookingFeeAmountCents,
        processingFeeAmountCents,
        vatAmountCents,
        totalAfterCreditCents,
        parentOrder.client_name || null,
        parentOrder.client_phone || null,
        parentOrder.client_email || null,
        parentOrder.service_description || null,
        parentOrder.service_date || null,
        parentOrder.service_datetime || null,
        parentOrder.service_address || null,
        parentBookingType || null,
        publicCode,
        parentOrderId,
        parentOrder.customer_id || null,
        parentOrder.saved_payment_method_id || null,
        reason,
        captureMethod,
        vatRate,
        stripePercent,
        stripeFixedFeeCents,
        stripeFeeVatRate,
        'standard',
        alphaValue ?? null
      ]
    );

    console.log('[create-adjustment]', {
      parentOrderId,
      childId,
      flow,
      captureMethod,
      bookingType: parentBookingType,
      totalAmountCents: totalAfterCreditCents,
      visitCreditCents: creditAppliedCents
    });

    return res.send({
      childOrderId: childId,
      publicCode,
      mode: flow,
      flow,
      captureMethod,
      customerId: parentOrder.customer_id || null,
      savedPaymentMethodId: parentOrder.saved_payment_method_id || null,
      bookingType: parentBookingType,
      visitCreditCents: creditAppliedCents,
      totalAmountCents: totalAfterCreditCents,
      totalAmountMXN: totalAfterCreditCents / 100,
      providerAmountCents: providerAfterCreditCents,
      bookingFeeAmountCents,
      processingFeeAmountCents,
      vatAmountCents,
      adjustmentReason: reason
    });
  } catch (err) {
    console.error('[create-adjustment] error:', err);
    return res.status(500).send({ error: 'internal_error' });
  }
});

// 🚫 Cancel order (no refund; captured orders not cancelable)
app.post('/cancel-order', requireAdminAuth, async (req, res) => {
  try {
    const { orderId, reason } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: 'order_required', message: 'orderId is required' });
    }
    const trimmedReason = String(reason || '').trim().slice(0, 200) || null;

    const { rows } = await pool.query(
      'SELECT id, payment_intent_id, amount, status, kind FROM all_bookings WHERE id = $1 LIMIT 1',
      [orderId]
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ error: 'not_found', message: 'Order not found' });
    }

    let newStatus = 'Canceled';
    let piStatus = null;
    let message = trimmedReason ? `Cancelado: ${trimmedReason}` : 'Cancelado';

    if (row.payment_intent_id) {
      let pi = null;
      try {
        pi = await stripe.paymentIntents.retrieve(row.payment_intent_id, { expand: ['latest_charge'] });
      } catch (err) {
        console.warn('cancel-order: could not retrieve PI', row.payment_intent_id, err?.message || err);
      }

      if (pi) {
        piStatus = pi.status;
        const amountReceived = typeof pi.amount_received === 'number' ? pi.amount_received : null;

        const cancelableStatuses = new Set([
          'requires_payment_method',
          'requires_confirmation',
          'requires_action',
          'processing',
          'requires_capture'
        ]);

        if (cancelableStatuses.has(pi.status)) {
          await stripe.paymentIntents.cancel(pi.id, { cancellation_reason: 'requested_by_customer' });
          newStatus = 'Canceled';
        } else if (pi.status === 'succeeded') {
          return res.status(409).json({
            error: 'already_captured',
            message: 'No se puede cancelar una orden capturada. Usa reembolso.',
            amount_received: amountReceived || null
          });
        } else if (pi.status === 'canceled') {
          newStatus = 'Canceled';
        } else {
          newStatus = 'Canceled';
        }
      }
    }

    await pool.query('UPDATE all_bookings SET status=$1 WHERE id=$2', [newStatus, orderId]);

    return res.json({
      status: newStatus,
      paymentIntentStatus: piStatus,
      message
    });
  } catch (err) {
    console.error('cancel-order error:', err);
    const status = err.status || 400;
    return res.status(status).json({
      error: err.code || 'cancel_failed',
      message: err.message || 'No se pudo cancelar la orden'
    });
  }
});

// 💸 Refund a captured order (full or partial)
app.post('/refund-order', requireAdminAuth, async (req, res) => {
  try {
    const { orderId, amountCents, reason } = req.body || {};
    if (!orderId) {
      return res.status(400).json({ error: 'order_required', message: 'orderId is required' });
    }
    const { rows } = await pool.query(
      'SELECT id, payment_intent_id, amount, processing_fee_amount, final_captured_amount FROM all_bookings WHERE id = $1 LIMIT 1',
      [orderId]
    );
    const row = rows[0];
    if (!row || !row.payment_intent_id) {
      return res.status(404).json({ error: 'not_found', message: 'Order or payment intent not found' });
    }
    const pi = await stripe.paymentIntents.retrieve(row.payment_intent_id, { expand: ['charges'] });
    if (!pi || pi.status !== 'succeeded') {
      return res
        .status(409)
        .json({ error: 'not_captured', message: 'Solo se puede reembolsar una orden capturada.' });
    }
    let chargeId = null;
    if (typeof pi.latest_charge === 'string') {
      chargeId = pi.latest_charge;
    } else if (pi.latest_charge && typeof pi.latest_charge.id === 'string') {
      chargeId = pi.latest_charge.id;
    } else if (pi.charges && pi.charges.data && pi.charges.data.length) {
      chargeId = pi.charges.data[0].id || null;
    }
    if (!chargeId) {
      return res.status(409).json({ error: 'no_charge', message: 'No charge available to refund.' });
    }

    const received = typeof pi.amount_received === 'number' ? pi.amount_received : row.amount || 0;
    const nonRefundableFee = Math.max(0, Number(row.processing_fee_amount || 0));
    const maxRefundable = Math.max(0, received - nonRefundableFee);

    // Always subtract the non-refundable processing fee from the requested refund
    // so the business doesn’t eat the fee. If no amount provided, treat as “full”
    // refund (gross) and subtract the fee once.
    const requested = Number(amountCents);
    const baseRequested = Number.isInteger(requested) && requested > 0 ? Math.min(requested, received) : received;
    const userRequestedFullRefund = baseRequested >= received;
    let amountToRefund = Math.max(0, baseRequested - nonRefundableFee);
    if (amountToRefund > maxRefundable) amountToRefund = maxRefundable;

    if (!amountToRefund || amountToRefund <= 0) {
      return res.status(409).json({
        error: 'nothing_refundable',
        message: 'No hay monto reembolsable después de las comisiones de procesamiento.'
      });
    }

    const refundObj = await stripe.refunds.create({
      charge: chargeId,
      amount: amountToRefund,
      reason: 'requested_by_customer',
      metadata: { order_id: orderId, note: String(reason || '').slice(0, 200) }
    });

    const refundedAmountCents = refundObj.amount || amountToRefund;
    const remainingAmountCents = Math.max(0, received - refundedAmountCents);
    const newStatus =
      userRequestedFullRefund || refundedAmountCents >= received
        ? 'Refunded'
        : 'Captured (partial refund)';

    await pool.query('UPDATE all_bookings SET status=$1, final_captured_amount=$2 WHERE id=$3', [
      newStatus,
      remainingAmountCents,
      orderId
    ]);

    return res.json({
      status: newStatus,
      refundedAmountCents,
      remainingAmountCents,
      finalCapturedAmount: remainingAmountCents,
      refundId: refundObj.id,
      message:
        userRequestedFullRefund || refundedAmountCents >= received
          ? 'Reembolso total solicitado; la comisión de procesamiento no es reembolsable.'
          : 'Reembolso parcial realizado.'
    });
  } catch (err) {
    console.error('refund-order error:', err);
    const status = err.status || 400;
    return res.status(status).json({
      error: err.code || 'refund_failed',
      message: err.message || 'No se pudo reembolsar la orden'
    });
  }
});

// Capture an authorized manual-capture PaymentIntent (optionally partial).
// Body: { orderId?: string, paymentIntentId?: string, amount?: number }  // amount in CENTS
app.post('/capture-order', requireAdminAuth, async (req, res) => {
  try {
    const { orderId, paymentIntentId, amount } = req.body || {};
    let piId = paymentIntentId;
    let orderRow = null;

    if (!piId && orderId) {
    const r = await pool.query('SELECT id, payment_intent_id, amount FROM all_bookings WHERE id=$1', [orderId]);
      if (!r.rows[0] || !r.rows[0].payment_intent_id) return res.status(404).send({ error: 'order not found' });
      orderRow = r.rows[0];
      piId = orderRow.payment_intent_id;
    }
    if (!piId) return res.status(400).send({ error: 'missing paymentIntentId or orderId' });

    if (!orderRow) {
      const r = await pool.query('SELECT id, amount FROM all_bookings WHERE payment_intent_id=$1 LIMIT 1', [piId]);
      orderRow = r.rows[0] || null;
    }
    if (!orderRow) return res.status(404).send({ error: 'order not found' });

    const current = await stripe.paymentIntents.retrieve(piId);
    if (current.capture_method !== 'manual') {
      return res.status(400).send({ error: 'not a manual-capture intent' });
    }
    if (current.status !== 'requires_capture') {
      return res.status(400).send({ error: `PI not capturable (status=${current.status})` });
    }

    const params = {};
    if (Number.isInteger(amount)) {
      if (amount <= 0) {
        return res.status(400).send({ error: 'amount must be a positive integer (cents)' });
      }
      if (Number.isInteger(orderRow.amount) && amount > orderRow.amount) {
        return res.status(400).send({ error: 'capture amount exceeds authorized amount' });
      }
      // Stripe expects amount_to_capture in the smallest currency unit
      params.amount_to_capture = amount;
    }

    if (!params.amount_to_capture && Number.isInteger(orderRow.amount)) {
      params.amount_to_capture = orderRow.amount;
    }

    const updated = await stripe.paymentIntents.capture(piId, params);
    // Webhook will mark as Captured and notify Sheets; we just echo back
    const captured = (params.amount_to_capture !== undefined)
      ? params.amount_to_capture
      : (Number.isInteger(orderRow.amount) ? orderRow.amount : 'full');
    if (Number.isInteger(captured)) {
      await pool.query('UPDATE all_bookings SET final_captured_amount = $1 WHERE id=$2', [captured, orderRow.id]);
    }
    return res.send({ ok: true, paymentIntentId: updated.id, status: updated.status, captured });
  } catch (e) {
    console.error('capture-order error:', e);
    return res.status(500).send({ error: e.message || 'capture failed' });
  }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let paymentIntentId;
  if (event.type.startsWith('charge.')) {
    paymentIntentId = event.data.object.payment_intent;
  } else {
    paymentIntentId = event.data.object.id;
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      console.log('💰 Captured (payment_intent.succeeded):', paymentIntentId);

      const r = await pool.query('SELECT id, customer_id FROM all_bookings WHERE payment_intent_id = $1 LIMIT 1', [paymentIntentId]);
      const row = r.rows[0] || {};

      await pool.query('UPDATE all_bookings SET status = $1 WHERE payment_intent_id = $2', ['Captured', paymentIntentId]);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentIntentId,
          status: 'Captured',
          orderId: row.id || '',
          customerId: row.customer_id || ''
        })
      }).then(async r => console.log('Sheets captured:', r.status, await r.text()))
        .catch(e => console.error('Sheets captured failed:', e));
      break;
    }

    case 'setup_intent.succeeded': {
      const si   = event.data.object;
      const pmId = si.payment_method || null;
      const cust = si.customer || null;
      const orderId = String(si.metadata?.order_id || '').trim();

      if (orderId) {
        const statusLabel = 'Scheduled';

        await pool.query(
          `UPDATE all_bookings
              SET status                  = $1,
                  saved_payment_method_id = COALESCE($2, saved_payment_method_id),
                  customer_id             = COALESCE($3, customer_id),
                  kind                    = 'book'
            WHERE id = $4`,
          [statusLabel, pmId, cust, orderId]
        );

        if (pmId) {
          try {
            await refreshOrderFees(orderId, { paymentMethodId: pmId });
          } catch (feeErr) {
            console.warn('setup_intent fee refresh failed', feeErr?.message || feeErr);
          }
        }

        const consentRow = await pool.query(`
          SELECT order_id,
                 version,
                 text_hash,
                 checked_at,
                 ip,
                 user_agent,
                 locale,
                 tz
            FROM consented_offsession_bookings
           WHERE order_id = $1
        `, [orderId]);
        const consentMeta = consentRow.rows[0] || {};

        if (cust) {
          const orderInfo = await pool.query(
            'SELECT client_name, client_email, client_phone, parent_id_of_adjustment, payment_intent_id FROM all_bookings WHERE id = $1',
            [orderId]
          );
          const customerName  = orderInfo.rows[0]?.client_name  || null;
          const customerEmail = orderInfo.rows[0]?.client_email || null;
          const customerPhone = orderInfo.rows[0]?.client_phone || null;
          const parentForCustomer = orderInfo.rows[0]?.parent_id_of_adjustment || orderId;
          const paymentIntentId = orderInfo.rows[0]?.payment_intent_id || null;

          await pool.query(`
            INSERT INTO saved_servi_users (
              customer_id,
              customer_name,
              customer_email,
              customer_phone,
              latest_payment_method_id,
              latest_text_hash,
              latest_version,
              first_checked_at,
              last_checked_at,
              first_order_id,
              last_order_id,
              ip,
              user_agent,
              locale,
              tz
            )
            VALUES (
              $1,$2,$3,$4,$5,
              $6,$7,$8,NOW(),
              $9,$9,$10,$11,$12,$13
            )
            ON CONFLICT (customer_id) DO UPDATE SET
              customer_name            = COALESCE($2, saved_servi_users.customer_name),
              customer_email           = COALESCE($3, saved_servi_users.customer_email),
              customer_phone           = COALESCE($4, saved_servi_users.customer_phone),
              latest_payment_method_id = COALESCE($5, saved_servi_users.latest_payment_method_id),
              latest_text_hash         = COALESCE($6, saved_servi_users.latest_text_hash),
              latest_version           = COALESCE($7, saved_servi_users.latest_version),
              first_checked_at         = COALESCE(saved_servi_users.first_checked_at, $8),
              last_checked_at          = NOW(),
              first_order_id           = COALESCE(saved_servi_users.first_order_id, $9),
              last_order_id            = $9,
              ip                       = COALESCE($10, saved_servi_users.ip),
              user_agent               = COALESCE($11, saved_servi_users.user_agent),
              locale                   = COALESCE($12, saved_servi_users.locale),
              tz                       = COALESCE($13, saved_servi_users.tz)
          `, [
            cust,
            customerName,
            customerEmail,
            customerPhone,
            pmId || null,
            consentMeta.text_hash || null,
            consentMeta.version || null,
            consentMeta.checked_at || null,
            consentMeta.order_id || parentForCustomer,
            consentMeta.ip || null,
            consentMeta.user_agent || null,
            consentMeta.locale || null,
            consentMeta.tz || null
          ]);

          notifyConsentChange({
            customerId: cust,
            parentOrderId: parentForCustomer,
            sourceOrderId: orderId,
            consent: true,
            paymentMethodId: pmId || null,
            paymentIntentId
          });
        }

        if (GOOGLE_SCRIPT_WEBHOOK_URL) {
          fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'order.status',
              orderId,
              status: statusLabel,
              customerId: cust || '',
              parentOrderId: parentForCustomer || orderId
            })
          }).catch(()=>{});
        }
      }

      // Optional: keep a Clients sheet in sync
      if (cust) {
        try {
          const c = await stripe.customers.retrieve(cust);
          if (GOOGLE_SCRIPT_WEBHOOK_URL) {
            fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'customer.updated',
                id: c.id, name: c.name || '', email: c.email || '', phone: c.phone || ''
              })
            }).catch(()=>{});
          }
        } catch {}
      }
      break;
    }



    case 'charge.failed': {
      console.log('❌ Failed (charge.failed):', paymentIntentId);
      await pool.query('UPDATE all_bookings SET status = $1 WHERE payment_intent_id = $2',
                      ['Failed', paymentIntentId]);
      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ paymentIntentId, status: 'Failed' })
      }).catch(()=>{});
      break;
    }

    // === PI-level failure (keep distinct label so it never looks like 'expired') ===
    case 'payment_intent.payment_failed': {
      console.log('⛔ Declined (payment_intent.payment_failed):', paymentIntentId);
      await pool.query('UPDATE all_bookings SET status = $1 WHERE payment_intent_id = $2',
                      ['Declined', paymentIntentId]); // <-- not "Failed"
      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ paymentIntentId, status: 'Declined' })
      }).catch(()=>{});
      break;
    }

    // === legacy/processor-side authorization expiry signal ===
    case 'charge.expired': {
      console.log('🕒 Canceled (expired) via charge.expired:', paymentIntentId);
      await pool.query('UPDATE all_bookings SET status = $1 WHERE payment_intent_id = $2',
                      ['Canceled (expired)', paymentIntentId]);
      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ paymentIntentId, status: 'Canceled (expired)' })
      }).catch(()=>{});
      break;
    }


    case 'payment_intent.canceled': {
      const pi = event.data.object;
      const reason = pi.cancellation_reason || 'canceled';
      const label = (reason === 'expired') ? 'Canceled (expired)' : `Canceled (${reason})`;

      console.log(`🚫 ${label}:`, paymentIntentId);

      await pool.query('UPDATE all_bookings SET status = $1 WHERE payment_intent_id = $2',
                      [label, paymentIntentId]);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ paymentIntentId, status: label })
      }).catch(()=>{});
      break;
    }

    // 3) payment_intent.amount_capturable_updated (when a manual PI becomes capturable)
    case 'payment_intent.amount_capturable_updated': {
      const obj = event.data.object;
      const pmId = obj.payment_method || null;
      const cust = obj.customer || null;

      if (pmId || cust) {
        await pool.query(
          'UPDATE all_bookings SET saved_payment_method_id = COALESCE($1, saved_payment_method_id), customer_id = COALESCE($2, customer_id) WHERE payment_intent_id = $3',
          [pmId, cust, obj.id]
        );
      }

      if (obj.capture_method === 'manual' && obj.status === 'requires_capture') {
        const r = await pool.query('SELECT id, customer_id, parent_id_of_adjustment FROM all_bookings WHERE payment_intent_id = $1 LIMIT 1', [obj.id]);
        const row = r.rows[0] || {};

        await pool.query('UPDATE all_bookings SET status = $1 WHERE payment_intent_id = $2', ['Confirmed', obj.id]);

        console.log('[PI capturable] order:', row.id, 'pi:', obj.id, 'status → Confirmed'); // <— add

        if (GOOGLE_SCRIPT_WEBHOOK_URL) {
          fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: obj.id,
              status: 'Confirmed',
              orderId: row.id || '',
              customerId: row.customer_id || '',
              parentOrderId: row.parent_id_of_adjustment || ''
            })
          }).catch(() => {});
        }
      }
      break;
    }

    case 'customer.updated': {
      const c = event.data.object; // Stripe Customer
      let hasCard = false;
      let primaryPaymentMethodId = null;
      try {
        const pmList = await stripe.paymentMethods.list({
          customer: c.id,
          type: 'card',
          limit: 1
        });
        if (pmList.data.length) {
          hasCard = true;
          primaryPaymentMethodId = pmList.data[0].id;
        }
      } catch (pmErr) {
        console.warn('customer.updated list failed', pmErr?.message || pmErr);
      }

      if (!hasCard) {
        try {
          await pool.query('DELETE FROM saved_servi_users WHERE customer_id = $1', [c.id]);
        } catch (deleteErr) {
          console.warn('customer.updated consent delete failed', deleteErr?.message || deleteErr);
        }
        try {
          await pool.query(
            'UPDATE all_bookings SET saved_payment_method_id = NULL WHERE customer_id = $1',
            [c.id]
          );
        } catch (clearErr) {
          console.warn('customer.updated all_bookings cleanup failed', clearErr?.message || clearErr);
        }
        let parentOrderId = '';
        let lastOrderId = '';
        try {
          const recentOrder = await pool.query(
            `SELECT id, parent_id_of_adjustment
               FROM all_bookings
              WHERE customer_id = $1
              ORDER BY created_at DESC
              LIMIT 1`,
            [c.id]
          );
          if (recentOrder.rows[0]) {
            lastOrderId = recentOrder.rows[0].id || '';
            parentOrderId =
              recentOrder.rows[0].parent_id_of_adjustment || recentOrder.rows[0].id || '';
          }
        } catch (orderLookupErr) {
          console.warn('customer.updated recent order lookup failed', orderLookupErr?.message || orderLookupErr);
        }
        notifyConsentChange({
          customerId: c.id,
          parentOrderId,
          sourceOrderId: lastOrderId || parentOrderId,
          consent: false,
          paymentMethodId: null
        });
        break;
      }

      await pool.query(
        `
          INSERT INTO saved_servi_users (
            customer_id,
            customer_name,
            customer_email,
            customer_phone,
            latest_payment_method_id,
            last_checked_at
          )
          VALUES ($1,$2,$3,$4,$5,NOW())
          ON CONFLICT (customer_id) DO UPDATE SET
            customer_name            = COALESCE($2, saved_servi_users.customer_name),
            customer_email           = COALESCE($3, saved_servi_users.customer_email),
            customer_phone           = COALESCE($4, saved_servi_users.customer_phone),
            latest_payment_method_id = COALESCE($5, saved_servi_users.latest_payment_method_id),
            last_checked_at          = NOW()
        `,
        [c.id, c.name || null, c.email || null, c.phone || null, primaryPaymentMethodId]
      );

      if (GOOGLE_SCRIPT_WEBHOOK_URL) {
        await fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'customer.updated',
            id: c.id,
            name: c.name || '',
            email: c.email || '',
            phone: c.phone || ''
          })
        }).catch(()=>{});
      }

      break;
    }

    case 'customer.created': {
      // We don't need to do anything here; customer.updated will sync the sheet if needed.
      break;
    }

    case 'charge.succeeded': {
      // Paid-in-full charge when capture_method=automatic — we rely on PI events instead.
      break;
    }
    
    case 'payment_method.attached': {
      const pm = event.data.object;
      const customerId = pm.customer;
      if (customerId) {
        await pool.query(`
          INSERT INTO saved_servi_users (customer_id, latest_payment_method_id, last_checked_at)
          VALUES ($1,$2,NOW())
          ON CONFLICT (customer_id) DO UPDATE SET
            latest_payment_method_id = $2,
            last_checked_at = NOW()
        `, [customerId, pm.id]);
        let parentOrderId = null;
        let lastOrderId = null;
        try {
          const { rows } = await pool.query(
            'SELECT first_order_id, last_order_id FROM saved_servi_users WHERE customer_id = $1',
            [customerId]
          );
          if (rows[0]) {
            parentOrderId = rows[0].first_order_id || null;
            lastOrderId = rows[0].last_order_id || null;
          }
          if (!parentOrderId || !lastOrderId) {
            const latestOrder = await pool.query(
              `SELECT id, parent_id_of_adjustment FROM all_bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
              [customerId]
            );
            const orderRow = latestOrder.rows[0];
            if (orderRow) {
              if (!lastOrderId) lastOrderId = orderRow.id;
              if (!parentOrderId) parentOrderId = orderRow.parent_id_of_adjustment || orderRow.id;
            }
          }
        } catch (err) {
          console.warn('payment_method.attached lookup failed', err?.message || err);
        }
        if (parentOrderId || lastOrderId) {
          notifyConsentChange({
            customerId,
            parentOrderId,
            sourceOrderId: lastOrderId || parentOrderId,
            consent: true,
            paymentMethodId: pm.id
          });
        }
      }
      break;
    }
    case 'payment_method.detached': {
      const pm = event.data.object;
      let customerId =
        pm.customer ||
        event.data.previous_attributes?.customer ||
        null;
      if (!customerId) {
        try {
          const lookup = await pool.query(
            'SELECT customer_id FROM saved_servi_users WHERE latest_payment_method_id = $1 LIMIT 1',
            [pm.id]
          );
          customerId = lookup.rows[0]?.customer_id || null;
        } catch (err) {
          console.warn('payment_method.detached customer lookup failed', err?.message || err);
        }
      }
      if (!customerId) {
        console.warn('payment_method.detached missing customer for payment method', pm.id);
        break;
      }

      let hasRemainingCard = false;
      let remainingCardId = null;
      try {
        const pmList = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
          limit: 1
        });
        if (pmList.data.length) {
          hasRemainingCard = true;
          remainingCardId = pmList.data[0].id;
        }
      } catch (listErr) {
        console.warn('payment_method.detached list failed', listErr?.message || listErr);
      }

      try {
        if (hasRemainingCard) {
          await pool.query(
            `
              UPDATE saved_servi_users
                 SET latest_payment_method_id = $2,
                     last_checked_at = NOW()
               WHERE customer_id = $1
            `,
            [customerId, remainingCardId]
          );
          await pool.query(
            'UPDATE all_bookings SET saved_payment_method_id = NULL WHERE customer_id = $1 AND saved_payment_method_id = $2',
            [customerId, pm.id]
          );
        } else {
          await pool.query('DELETE FROM saved_servi_users WHERE customer_id = $1', [customerId]);
          await pool.query(
            'UPDATE all_bookings SET saved_payment_method_id = NULL WHERE customer_id = $1',
            [customerId]
          );
        }
      } catch (err) {
        console.warn('payment_method.detached cleanup failed', err?.message || err);
      }

      let parentOrderId = null;
      let lastOrderId = null;
      try {
        const { rows } = await pool.query(
          'SELECT first_order_id, last_order_id FROM saved_servi_users WHERE customer_id = $1',
          [customerId]
        );
        if (rows[0]) {
          parentOrderId = rows[0].first_order_id || null;
          lastOrderId = rows[0].last_order_id || null;
        }
        if (!parentOrderId || !lastOrderId) {
          const latestOrder = await pool.query(
            `SELECT id, parent_id_of_adjustment FROM all_bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [customerId]
          );
          const orderRow = latestOrder.rows[0];
          if (orderRow) {
            if (!lastOrderId) lastOrderId = orderRow.id;
            if (!parentOrderId)
              parentOrderId = orderRow.parent_id_of_adjustment || orderRow.id;
          }
        }
      } catch (err) {
        console.warn('payment_method.detached lookup failed', err?.message || err);
      }

      notifyConsentChange({
        customerId,
        parentOrderId,
        sourceOrderId: lastOrderId || parentOrderId,
        consent: hasRemainingCard,
        paymentMethodId: hasRemainingCard ? remainingCardId : null
      });

      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }


  res.status(200).send('Webhook received');
});

app.post('/confirm-with-saved', async (req, res) => {
  try {
    const { orderId, force, retryToken, allowExpired, createOnly } = req.body || {};
    if (!orderId) return res.status(400).send({ error: 'orderId required' });

    const { rows } = await pool.query(
      `SELECT id,
              payment_intent_id,
              customer_id,
              amount,
              kind,
              parent_id_of_adjustment,
              service_date,
              service_datetime,
              status,
              saved_payment_method_id,
              capture_method,
              adjustment_reason,
              created_at,
              retry_token,
              retry_token_created_at
         FROM all_bookings
        WHERE id = $1`,
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.status(404).send({ error: 'order not found' });
    const { createdAtOverride } = resolveRetryTokenContext(row, retryToken);
    const linkRow = createdAtOverride ? { ...row, created_at: createdAtOverride } : row;
    const adminRequest = isAdminRequest(req);
    const allowExpiredFlag = adminRequest && (allowExpired || force);
    assertOrderLinkActive(linkRow, { allowExpired: allowExpiredFlag });

    let savedPmId = row.saved_payment_method_id || null;
    const capturePref = String(row.capture_method || '').toLowerCase();
    const captureMethod = capturePref === 'automatic' ? 'automatic' : 'manual';
    const adjustmentDescription = String(row.kind || '').toLowerCase() === 'adjustment'
      ? `SERVI ajuste: ${row.adjustment_reason || 'SERVI adjustment'}`
      : null;
    const hoursAhead = hoursUntilService(row);
    let piId = row.payment_intent_id || null;
    const isSetup = piId && String(piId).startsWith('seti_');

    // >72h: keep scheduled flow; no PI until 24h window
    if (hoursAhead > EARLY_PREAUTH_THRESHOLD_HOURS && !force) {
      if (!savedPmId && row.customer_id) {
        const list = await stripe.paymentMethods.list({
          customer: row.customer_id,
          type: 'card',
          limit: 1
        });
        savedPmId = list.data[0]?.id || null;
      }

      if (!savedPmId) {
        await pool.query(
          `UPDATE all_bookings
              SET saved_payment_method_id = NULL
            WHERE id = $1`,
          [row.id]
        );

        return res.status(409).json({
          error: 'no_saved_card',
          redirect: `/pay?orderId=${encodeURIComponent(row.id)}`
        });
      }

      const statusLabel = 'Scheduled';
      await pool.query(
        `
          UPDATE all_bookings
             SET status = $1,
                 saved_payment_method_id = COALESCE($2, saved_payment_method_id)
           WHERE id = $3
             AND (status IS NULL OR status NOT IN ('Confirmed','Captured'))
        `,
        [statusLabel, savedPmId, row.id]
      );

      if (savedPmId) {
        try {
          await refreshOrderFees(row.id, { paymentMethodId: savedPmId });
        } catch (feeErr) {
          console.warn('confirm-with-saved (scheduled) fee refresh failed', feeErr?.message || feeErr);
        }
      }

      if (GOOGLE_SCRIPT_WEBHOOK_URL) {
        fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order.status',
            orderId: row.id,
            status: statusLabel,
            customerId: row.customer_id || '',
            parentOrderId: row.parent_id_of_adjustment || ''
          })
        }).catch(() => {});
      }

      const serviceMs = row.service_datetime
        ? new Date(row.service_datetime).getTime()
        : new Date(String(row.service_date) + 'T08:00:00-05:00').getTime();
      const opensAtMs = serviceMs - PREAUTH_WINDOW_MS;

      if (createOnly && hoursAhead <= EARLY_PREAUTH_THRESHOLD_HOURS) {
        if (!piId || isSetup) {
          const pi = await stripe.paymentIntents.create({
            amount: row.amount,
            currency: 'mxn',
            payment_method_types: ['card'],
            capture_method: captureMethod,
            customer: row.customer_id || undefined,
            ...(adjustmentDescription ? { description: adjustmentDescription } : {}),
            metadata: {
              order_id: row.id,
              kind: row.kind || 'primary',
              parent_order_id: row.parent_id_of_adjustment || ''
            }
          });
          await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [pi.id, row.id]);
          piId = pi.id;
        }

        return res.status(200).json({
          ok: true,
          createdOnly: true,
          status: statusLabel,
          paymentIntentId: piId,
          paymentMethodId: savedPmId || null,
          hoursAhead
        });
      }

      return res.status(409).json({
        error: 'preauth_window_closed',
        remaining_hours: Math.ceil(hoursAhead),
        preauth_window_opens_at: new Date(opensAtMs).toISOString(),
        status: statusLabel,
        paymentMethodId: savedPmId || null
      });
    }

    // ≤72h: allow PI creation (no auto-confirm) if requested
    if (createOnly && hoursAhead <= EARLY_PREAUTH_THRESHOLD_HOURS) {
      if (!savedPmId && row.customer_id) {
        const list = await stripe.paymentMethods.list({
          customer: row.customer_id,
          type: 'card',
          limit: 1
        });
        savedPmId = list.data[0]?.id || null;
      }

      if (!savedPmId) {
        return res.status(409).json({
          error: 'no_saved_card',
          redirect: `/pay?orderId=${encodeURIComponent(row.id)}`
        });
      }

      if (!piId || isSetup) {
        const pi = await stripe.paymentIntents.create({
          amount: row.amount,
          currency: 'mxn',
          payment_method_types: ['card'],
          capture_method: captureMethod,
          customer: row.customer_id || undefined,
          ...(adjustmentDescription ? { description: adjustmentDescription } : {}),
          metadata: {
            order_id: row.id,
            kind: row.kind || 'primary',
            parent_order_id: row.parent_id_of_adjustment || ''
          }
        });
        await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [pi.id, row.id]);
        piId = pi.id;
      }

      try {
        await refreshOrderFees(row.id, { paymentIntentId: piId });
      } catch (feeErr) {
        console.warn('confirm-with-saved (createOnly) fee refresh failed', feeErr?.message || feeErr);
      }

      const label = row.status || 'Pending';

      return res.status(200).json({
        ok: true,
        createdOnly: true,
        status: label,
        paymentIntentId: piId,
        paymentMethodId: savedPmId || null,
        hoursAhead
      });
    }




    // ≤72h → create/confirm a manual-capture PI now (triggered by client)

    // Ensure we have a real PI (not a SetupIntent)
    if (!piId || isSetup) {
      const pi = await stripe.paymentIntents.create({
        amount: row.amount,
        currency: 'mxn',
        payment_method_types: ['card'],
        capture_method: captureMethod,
        customer: row.customer_id || undefined,
        ...(adjustmentDescription ? { description: adjustmentDescription } : {}),
        metadata: {
          order_id: row.id,
          kind: row.kind || 'primary',
          parent_order_id: row.parent_id_of_adjustment || ''
        }
      });
      await pool.query('UPDATE all_bookings SET payment_intent_id=$1 WHERE id=$2', [pi.id, row.id]);
      piId = pi.id;
    }

    // Pick a saved card
    const pmList = await stripe.paymentMethods.list({ customer: row.customer_id, type: 'card' });
    const pm = pmList.data[0];
    if (!pm) return res.status(409).send({ error: 'no_saved_card' });

    // Attach and confirm (off-session if possible)
    await stripe.paymentIntents.update(piId, {
      payment_method: pm.id,
      ...(adjustmentDescription ? { description: adjustmentDescription } : {}),
      metadata: {
        order_id: row.id,
        kind: row.kind || 'primary',
        parent_order_id: row.parent_id_of_adjustment || ''
      }
    });
    try {
      const confirmed = await stripe.paymentIntents.confirm(piId, { off_session: true });
      if (confirmed.status === 'requires_action') {
        // needs 3DS in browser
        return res.status(402).send({
          ok: false,
          reason: 'requires_action',
          clientSecret: confirmed.client_secret,
          paymentIntentId: confirmed.id,
          paymentMethodId: pm.id
        });
      }
      try {
        await refreshOrderFees(row.id, { paymentIntentId: confirmed.id });
      } catch (feeErr) {
        console.warn('confirm-with-saved fee refresh failed', feeErr?.message || feeErr);
      }
      const statusLabel =
        confirmed.status === 'requires_capture'
          ? 'Confirmed'
          : confirmed.status === 'succeeded'
            ? 'Captured'
            : confirmed.status;
      try {
        await pool.query('UPDATE all_bookings SET status=$1 WHERE id=$2', [statusLabel, row.id]);
      } catch (statusErr) {
        console.warn('confirm-with-saved status update failed', statusErr?.message || statusErr);
      }
      if (GOOGLE_SCRIPT_WEBHOOK_URL) {
        fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order.status',
            orderId: row.id,
            status: statusLabel,
            customerId: row.customer_id || '',
            paymentIntentId: confirmed.id,
            amount: confirmed.amount || null,
            parentOrderId: row.parent_id_of_adjustment || ''
          })
        }).catch(() => {});
      }
      return res.send({ ok: true, status: confirmed.status, paymentIntentId: confirmed.id, paymentMethodId: pm.id });
    } catch (e) {
      const pi = e?.raw?.payment_intent || e?.payment_intent;
      if (e?.code === 'authentication_required' && pi?.client_secret) {
        return res.status(402).send({
          ok: false,
          reason: 'requires_action',
          clientSecret: pi.client_secret,
          paymentIntentId: pi.id,
          paymentMethodId: pm.id
        });
      }
      const failure = describeStripeFailure(e);
      let retryPrompt = null;
      try {
        retryPrompt = await handlePreauthFailure(row, { error: e, failure });
      } catch (handleErr) {
        console.warn('confirm-with-saved handlePreauthFailure failed', row.id, handleErr?.message || handleErr);
      }
      const reasonText = failure?.friendly || failure?.message || null;
      const friendly = reasonText
        ? `No se pudo autorizar el método de pago. Intenta otro método de pago.`
        : 'No se pudo autorizar el método de pago. Intenta otro método de pago.';
      return res.status(409).json({
        ok: false,
        error: 'preauth_failed',
        message: friendly,
        billingPortalMessage: retryPrompt?.message || null,
        billingPortalUrl: retryPrompt?.url || null,
        decline_code: failure?.decline_code || null,
        failure_code: failure?.failure_code || null,
        stripe_message: failure?.message || null,
        paymentIntentId: failure?.payment_intent_id || piId || null
      });
    }
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      console.error('confirm-with-saved error:', err);
    }
    res.status(status).send({
      error: err.code || 'Internal error',
      message: err.message || 'Internal error',
      linkExpiresAt: err.linkExpiresAt || null
    });
  }
});

// Mark the current PaymentIntent so Stripe saves the card on success
app.post('/orders/:id/apply-consent-to-current-pi', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('SELECT payment_intent_id, created_at FROM all_bookings WHERE id=$1', [id]);
    const row = r.rows[0];
    if (!row || !row.payment_intent_id) {
      return res.status(400).json({ error: 'no_pi' });
    }
    assertOrderLinkActive(row);

    // Important: update BEFORE confirmCardPayment happens on the client
    const updated = await stripe.paymentIntents.update(row.payment_intent_id, {
      setup_future_usage: 'off_session'
    });

    res.json({ ok: true, payment_intent_id: updated.id, setup_future_usage: updated.setup_future_usage });
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) {
      console.error('apply-consent-to-current-pi error:', e?.message || e);
    }
    res.status(status).json({
      error: e.code || 'internal',
      message: e.message || 'Internal error',
      linkExpiresAt: e.linkExpiresAt || null
    });
  }
});

app.post('/billing-portal', async (req, res) => {
  try {
    const { orderId, returnUrl } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    // Find the linked customer for this order
    const { rows } = await pool.query('SELECT customer_id FROM all_bookings WHERE id=$1', [orderId]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'order not found' });
    if (!row.customer_id) {
      return res.status(409).json({ error: 'no_customer', message: 'Order has no linked customer_id' });
    }

    // Where to return after portal (book page fits the saved-card flow)
    const base = process.env.PUBLIC_BASE_URL || 'https://servi-preauth.onrender.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: row.customer_id,
      return_url: returnUrl || `${base}/book?orderId=${encodeURIComponent(orderId)}`
    });

    return res.json({ url: session.url });
  } catch (err) {
    // Surface useful details in logs and a readable message to the client
    console.error('billing-portal error:', err?.type, err?.code, err?.message);
    const message = err?.message || 'Stripe Billing Portal error';
    const code = err?.code || 'stripe_error';
    const status = err?.statusCode || 500;
    return res.status(status).json({ error: message, code });
  }
});

app.get('/success', async (req, res) => {
  try {
    const { orderId } = req.query;
    if (!orderId) return res.redirect(302, '/');

    const { rows } = await pool.query(
      `SELECT id,
              parent_id_of_adjustment,
              payment_intent_id,
              kind,
              service_date,
              service_datetime,
              customer_id,
              saved_payment_method_id,
              status
         FROM all_bookings
        WHERE id = $1`,
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.redirect(302, '/');

  
    if (String(row.kind || '').toLowerCase() === 'book') {
      const h = hoursUntilService(row);
      if (!row.payment_intent_id || h > PREAUTH_WINDOW_HOURS) {
        // Mark as Scheduled server-side (idempotent)…
        await pool.query(
          "UPDATE all_bookings SET status = 'Scheduled' WHERE id = $1 AND (status IS NULL OR status NOT IN ('Confirmed','Captured'))",
          [row.id]
        );
        // …and notify the Sheet
        if (GOOGLE_SCRIPT_WEBHOOK_URL) {
          fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'order.status',
              orderId: row.id,
              status: 'Scheduled',
              customerId: row.customer_id || '',
              parentOrderId: row.parent_id_of_adjustment || row.id
            })
          }).catch(()=>{});
        }

        return res.sendFile(path.join(__dirname, 'public', 'success.html'));
      }
    }


    // If we have a PI, require it to be authorized or captured to show success
    if (row.payment_intent_id) {
      const id = row.payment_intent_id;
      try {
        if (id.startsWith('seti_')) {
          // SetupIntent path (usually not used for /success in book flow, but safe)
          const si = await stripe.setupIntents.retrieve(id);
          if (si && si.status === 'succeeded') {
            return res.sendFile(path.join(__dirname, 'public', 'success.html'));
          }
        } else {
          const pi = await stripe.paymentIntents.retrieve(id);
          if (pi && (pi.status === 'succeeded' || pi.status === 'requires_capture')) {
            return res.sendFile(path.join(__dirname, 'public', 'success.html'));
          }
        }
      } catch (retrieveErr) {
        console.warn('success route PI lookup failed', id, retrieveErr?.message || retrieveErr);
      }
    }

    const statusLabel = String(row.status || '').trim();
    if (BOOK_SUCCESS_STATUSES.has(statusLabel) || PAY_SUCCESS_STATUSES.has(statusLabel)) {
      return res.sendFile(path.join(__dirname, 'public', 'success.html'));
    }

    // Otherwise bounce back to the appropriate page
    const kindLower = String(row.kind || '').toLowerCase();
    if (kindLower === 'adjustment') {
      const target = row.saved_payment_method_id ? '/book' : '/pay';
      return res.redirect(302, `${target}?orderId=${encodeURIComponent(orderId)}`);
    }
    const redirectTarget = kindLower === 'book' ? '/book' : '/pay';
    return res.redirect(302, `${redirectTarget}?orderId=${encodeURIComponent(orderId)}`);
  } catch (e) {
    console.error('success gate error:', e);
    const orderId = req.query.orderId || '';
    return res.redirect(302, `/pay?orderId=${encodeURIComponent(orderId)}`);
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
