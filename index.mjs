/* eslint-env node */
// index.mjs (ES Module version of your server)
import 'dotenv/config';
import express from 'express';
import StripePackage from 'stripe';
import path from 'path';
import { pool, initDb } from './db.pg.mjs';
import { fileURLToPath } from 'url';
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
    return Math.floor((t - Date.now()) / 3_600_000);
  }
  // Fallback: date-only anchored at local noon to avoid DST edges
  if (row.service_date) {
    const [y,m,d] = String(row.service_date).split('-').map(Number);
    const t = new Date(y, (m||1)-1, d||1, 0, 0, 0, 0).getTime();
    return Math.floor((t - Date.now()) / 3_600_000);
  }
  return Infinity;
}

// ── generate a unique public_code for /o/:code ────────────────────────────
async function generateUniqueCode(len = 10) {
  for (let i = 0; i < 6; i++) {
    const code = randomBytes(8)
      .toString('base64url')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, len);

    const { rows } = await pool.query('SELECT 1 FROM orders WHERE public_code = $1', [code]);
    if (rows.length === 0) return code;
  }
  throw new Error('Could not generate unique public code');
}

// ── ensure the order has a Stripe customer; return its id ─────────────────
async function ensureCustomerForOrder(stripe, orderRow) {
  if (orderRow.customer_id) {
    const updates = {};
    if (orderRow.client_name) updates.name = orderRow.client_name;
    if (orderRow.client_email) updates.email = orderRow.client_email;
    if (orderRow.client_phone) updates.phone = orderRow.client_phone;
    if (Object.keys(updates).length) {
      await stripe.customers.update(orderRow.customer_id, updates);
    }  
    return orderRow.customer_id;
  }

  const customer = await stripe.customers.create({
    name: orderRow.client_name || undefined,
    email: orderRow.client_email || undefined,
    phone: orderRow.client_phone || undefined,
  });

  await pool.query('UPDATE orders SET customer_id=$1 WHERE id=$2', [customer.id, orderRow.id]);
  return customer.id;
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

function requireAdminAuth(req, res, next) {
  if (!ADMIN_API_TOKEN) {
    console.error('ADMIN_API_TOKEN is not configured; rejecting admin route access');
    return res.status(500).json({ error: 'admin_auth_not_configured' });
  }

  const authHeader = req.get('authorization') || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim();
  }
  if (!token) {
    token = req.get('x-servi-admin-token') || '';
  }

  if (!constantTimeEquals(token, ADMIN_API_TOKEN)) {
    console.warn('Rejected admin request due to invalid token');
    return res.status(401).json({ error: 'unauthorized' });
  }

  return next();
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
  const { amount, clientName, serviceDescription, serviceDate, serviceDateTime, clientEmail, clientPhone, consent } = req.body;
  try {
    // 1) Find or create Stripe Customer by email/phone (your existing logic)
    // 1) Only SEARCH for an existing customer now; don't create yet
    let existingCustomer = null;
    const esc = (s) => String(s || '').replace(/'/g, "\\'");
    if (clientEmail) {
      const found = await stripe.customers.search({ query: `email:'${esc(clientEmail)}'` });
      if (found.data?.length) existingCustomer = found.data[0];
    }
    if (!existingCustomer && clientPhone) {
      const found = await stripe.customers.search({ query: `phone:'${esc(clientPhone)}'` });
      if (found.data?.length) existingCustomer = found.data[0];
    }

    // Compute policy early
    const longLead = daysAheadFromYMD(serviceDate) >= 5;

    // NEW: compute hoursAhead from serviceDateTime (or date-only as fallback)
    const hoursAhead = (() => {
      try {
        if (serviceDateTime) {
          return Math.floor((new Date(serviceDateTime).getTime() - Date.now()) / 3_600_000);
        }
        if (serviceDate) {
          // choose a local anchor time that matches your sheet logic (e.g., midnight)
          return Math.floor((new Date(`${serviceDate}T00:00:00-06:00`).getTime() - Date.now()) / 3_600_000);
        }
      } catch {}
      return Infinity;
    })();
    // If long lead and NO consent, do not create a new customer yet
    // We can still check for saved card if an existing customer was found
    let saved = false;
    if (existingCustomer) {
      saved = await hasSavedCard(existingCustomer.id, stripe);
    }

    if (existingCustomer && (clientPhone || clientEmail || clientName)) {
      const updates = {};
      if (clientName && !existingCustomer.name) updates.name = clientName;
      if (clientEmail && !existingCustomer.email) updates.email = clientEmail;
      if (clientPhone && !existingCustomer.phone) updates.phone = clientPhone;
      if (Object.keys(updates).length) {
        await stripe.customers.update(existingCustomer.id, updates);
      }
    }

    // Create the order row (allow NULL customer_id for now)
    const orderId = randomUUID();
    const publicCode = await generateUniqueCode();
    await pool.query(
      `INSERT INTO orders
      (id, amount, client_name, service_description, client_phone, client_email, service_date, status, public_code, kind, customer_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'primary',$10)
      ON CONFLICT (id) DO NOTHING`,
      [orderId, amount, clientName || null, serviceDescription || null, clientPhone || null, clientEmail || null, serviceDate || null, 'pending', publicCode, existingCustomer?.id || null]
    );

    // also persist service_date/service_datetime (you already do)
    await pool.query(
      'UPDATE orders SET service_date=$1, service_datetime=$2, client_phone=$3, client_email=$4 WHERE id=$5',
      [serviceDate || null, serviceDateTime || null, clientPhone || null, clientEmail || null, orderId]
    );
    // --- NEW: determine if we already have consent (customer-level or order-level) ---
    let hasConsent = false;
    if (existingCustomer?.id) {
      const cc = await pool.query('SELECT 1 FROM customer_consents WHERE customer_id = $1', [existingCustomer.id]);
      hasConsent = !!cc.rows.length;
    }
    if (!hasConsent) {
      const oc = await pool.query('SELECT 1 FROM order_consents WHERE order_id = $1', [orderId]);
      hasConsent = !!oc.rows.length;
    }

    // Long-lead policy handling
    if (longLead) {
      if (!saved && !consent) {
        // no saved card and no consent → gate; DON'T create a Stripe customer yet
        await pool.query('UPDATE orders SET status=$1, kind=$2 WHERE id=$3', ['Blocked', 'setup_required', orderId]);

        return res.status(403).send({
          error: 'account_required',
          message: 'Solo usuarios con cuenta pueden reservar con 5 días o mas de anticipación.',
          orderId,
          publicCode
        });
      }

      if (!saved) {
        // we have consent but no saved card: we'll create a Customer later when we start SetupIntent
        await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', orderId]);
        return res.send({ orderId, publicCode, requiresSetup: true, hasSavedCard: false });
      }

      // already saved (because existingCustomer had PMs) → book flow, no PI yet
      await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['book', orderId]);
      return res.send({ orderId, publicCode, hasSavedCard: true });
    }

    // Short-lead (≤5d)
    if (!longLead) {
      // If the customer ALREADY has a saved card and we're still >12h out,
        if (saved && hoursAhead > 12) {
          if (hasConsent) {
            await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['book', orderId]);
            return res.send({
              orderId,
              publicCode,
              hasSavedCard: true,
              paymentIntentId: null   // no PI yet
            });
          } else {
            // Saved card found but no consent recorded → collect consent with Setup flow
            await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', orderId]);
            return res.send({
              orderId,
              publicCode,
              requiresSetup: true,    // Sheet should NOT set "Scheduled"
              hasSavedCard: true
            });
          }
        }


      // Otherwise proceed (create or reuse customer, then create a PI now)
      const customer = existingCustomer || await stripe.customers.create({
        name: clientName || undefined,
        email: clientEmail || undefined,
        phone: clientPhone || undefined,
      });

      await pool.query('UPDATE orders SET customer_id=$1 WHERE id=$2', [customer.id, orderId]);

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'mxn',
        capture_method: 'manual',
        payment_method_types: ['card'],
        customer: customer.id,
        ...(consent ? { setup_future_usage: 'off_session' } : {}),
        metadata: { order_id: orderId, kind: 'primary' }
      });

      await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [paymentIntent.id, orderId]);

      return res.send({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderId,
        publicCode,
        hasSavedCard: saved
      });
    }


  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(400).send({ error: err.message });
  }
});

// 📄 Serve pay page
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

app.get('/confirm', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'confirm.html'));
});

app.get('/save', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'save.html'));
});


// Serve publishable key to the client (same origin, no CORS needed)
app.get('/config/stripe', (_req, res) => {
  res.send({ pk: process.env.STRIPE_PUBLISHABLE_KEY || '' });
});


app.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const { rows } = await pool.query(`
      SELECT id, payment_intent_id, amount, client_name, client_phone, client_email,
        service_description, service_date, service_datetime, status, created_at,
        public_code, kind, parent_id, customer_id
      FROM orders
      WHERE id = $1
    `, [orderId]);

    const row = rows[0];
    if (!row) return res.status(404).send({ error: 'Order not found' });

    let pi = null;
    let intentType = null;       // 'payment' | 'setup' | null
    let consentRequired = false; // true when kind='setup_required' and no consent recorded

    // helper: check if we already recorded consent for this order
    async function hasConsent(orderId) {
      const c = await pool.query('SELECT 1 FROM order_consents WHERE order_id=$1', [orderId]);
      return !!c.rows.length;
    }

    if (!row.payment_intent_id) {
      const kind = String(row.kind || '').toLowerCase();

      if (kind === 'setup_required') {
        // OPTIONAL: if this customer already has global consent, skip re-consent for this order
        if (row.customer_id) {
          const cc = await pool.query('SELECT 1 FROM customer_consents WHERE customer_id = $1', [row.customer_id]);
          if (cc.rows.length) {
            // If they already have a saved card, move straight to 'book'; otherwise create a SetupIntent
            const alreadySaved = await hasSavedCard(row.customer_id, stripe);
            if (alreadySaved) {
              await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['book', row.id]);
              pi = null;           // book flow has no client_secret
              intentType = null;
            } else {
              const customerId = await ensureCustomerForOrder(stripe, row);
              await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', row.id]);
              const si = await stripe.setupIntents.create({
                customer: customerId,
                automatic_payment_methods: { enabled: true },
                usage: 'off_session',
                metadata: { kind: 'setup', order_id: row.id }
              });
              await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
              pi = si;
              intentType = 'setup';
            }
          } else {
            // No global consent → fall back to per-order consent requirement
            const c = await pool.query('SELECT 1 FROM order_consents WHERE order_id=$1', [row.id]);
            if (!c.rows.length) {
              consentRequired = true;
              pi = null;
              intentType = null; // no client_secret returned
            } else {
              const customerId = await ensureCustomerForOrder(stripe, row);
              await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', row.id]);
              const si = await stripe.setupIntents.create({
                customer: customerId,
                automatic_payment_methods: { enabled: true },
                usage: 'off_session',
                metadata: { kind: 'setup', order_id: row.id }
              });
              await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
              pi = si;
              intentType = 'setup';
            }
          }
        } else {
          // No customer yet → original per-order logic
          const c = await pool.query('SELECT 1 FROM order_consents WHERE order_id=$1', [row.id]);
          if (!c.rows.length) {
            consentRequired = true;
            pi = null;
            intentType = null; // no client_secret returned
          } else {
            const customerId = await ensureCustomerForOrder(stripe, row);
            await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', row.id]);
            const si = await stripe.setupIntents.create({
              customer: customerId,
              automatic_payment_methods: { enabled: true },
              usage: 'off_session',
              metadata: { kind: 'setup', order_id: row.id }
            });
            await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
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

        await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
        pi = si;
        intentType = 'setup';


      } else if (kind === 'book') {
        // Saved-card booking: never create a PI here.
        // The /confirm-with-saved route decides when to create/confirm (≤12h).
        pi = null;
        intentType = null;

      } else {
        // Default (legacy primary/adjustments) — but DON'T create a PI early for saved + >12h
        const hours_ahead = hoursUntilService(row);

        let alreadySaved = false;
        if (row.customer_id) {
          alreadySaved = await hasSavedCard(row.customer_id, stripe);
        }

        if (alreadySaved && hours_ahead > 12) {
          // Convert legacy "primary" into "book" lazily, with no PI on read
          await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['book', row.id]);
          pi = null;
          intentType = null;
        } else {
          const created = await stripe.paymentIntents.create({
            amount: row.amount,
            currency: 'mxn',
            payment_method_types: ['card'],
            capture_method: 'manual',
            customer: row.customer_id || undefined,
            metadata: { kind: row.kind || 'primary', parent_order_id: row.parent_id || '' }
          });
          await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [created.id, row.id]);
          pi = created;
          intentType = 'payment';
        }
      }


    } else {
      // Retrieve existing Intent
      const id = row.payment_intent_id;
      const isSetup = id.startsWith('seti_');
      pi = isSetup
        ? await stripe.setupIntents.retrieve(id)
        : await stripe.paymentIntents.retrieve(id);
      intentType = isSetup ? 'setup' : 'payment';
    }


    // saved-card summary (unchanged)
    let saved_card = null;
    if (row.customer_id) {
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
    }

    const service_display = displayEsMX(row.service_datetime, row.service_date, 'America/Mexico_City');
    const hours_ahead = hoursUntilService(row);
    const preauth_window_open = hours_ahead <= 12 && hours_ahead >= 0;
    const days_ahead = Math.ceil(Math.max(0, hours_ahead) / 24);

    res.set('Cache-Control', 'no-store');
    return res.json({
      ...row,
      client_secret: pi?.client_secret || null,
      intentType,
      consent_required: consentRequired,
      saved_card: saved_card || null,
      service_display,
      days_ahead,
      hours_ahead,             
      preauth_window_open      
    });


  } catch (err) {
    console.error('Error retrieving order:', err);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.get('/o/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase();

    // 1) Find the order by code
    const { rows } = await pool.query(
      'SELECT id, kind, customer_id, saved_payment_method_id FROM orders WHERE public_code = $1',
      [code]
    );
    if (!rows[0]) return res.status(404).send('Not found');
    const row = rows[0];

    // 2) Explicit routing by kind
    if (row.kind === 'adjustment')     return res.redirect(302, `/confirm?orderId=${encodeURIComponent(row.id)}`);
    if (row.kind === 'setup_required') return res.redirect(302, `/pay?orderId=${encodeURIComponent(row.id)}`);
    if (row.kind === 'setup')          return res.redirect(302, `/pay?orderId=${encodeURIComponent(row.id)}`);
    if (row.kind === 'book')           return res.redirect(302, `/book?orderId=${encodeURIComponent(row.id)}`);

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
        `UPDATE orders
           SET kind='book',
               saved_payment_method_id = COALESCE($1, saved_payment_method_id)
         WHERE id=$2`,
        [firstPmId, row.id]
      );
      return res.redirect(302, `/book?orderId=${encodeURIComponent(row.id)}`);
    }

    // 5) No saved PM → pay flow
    return res.redirect(302, `/pay?orderId=${encodeURIComponent(row.id)}`);
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
      /* Pick saved-card "book" orders that are entering the 12h preauth window */
      WITH service_ts AS (
        SELECT
          id,
          amount,
          customer_id,
          saved_payment_method_id,
          parent_id,
          /* Use full timestamp if present; otherwise assume 08:00 local on service_date */
          COALESCE(
            service_datetime,
            (service_date::timestamp AT TIME ZONE 'America/Mexico_City') + INTERVAL '0 hours'
          ) AS svc_at
        FROM orders
        WHERE kind = 'book'
          AND customer_id IS NOT NULL
          AND saved_payment_method_id IS NOT NULL
          AND payment_intent_id IS NULL
      )
      SELECT id, amount, customer_id, saved_payment_method_id, parent_id
      FROM service_ts
      WHERE svc_at >= NOW()
        AND svc_at <  NOW() + INTERVAL '12 hours'
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
          metadata: { kind: 'primary', parent_order_id: row.parent_id || '' }
        });

        await pool.query(
          'UPDATE orders SET payment_intent_id=$1 WHERE id=$2',
          [pi.id, row.id]
        );

        results.push({ orderId: row.id, pi: pi.id, status: pi.status });
      } catch (e) {
        console.error('[preauth-due] failed for', row.id, e?.message);
        results.push({ orderId: row.id, error: e?.message || 'stripe_error' });
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
  const { id } = req.params;
  const { version, text, hash, locale, tz } = req.body || {};
  const ua = req.headers['user-agent'] || '';
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();

  const serverHash = createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
  if (hash && hash !== serverHash) return res.status(400).send({ error: 'bad hash' });

  // Pull order info
  const or = await pool.query(`
    SELECT id, customer_id, saved_payment_method_id, client_name
    FROM orders
    WHERE id = $1
  `, [id]);
  const row = or.rows[0];
  if (!row) return res.status(404).send({ error: 'order not found' });

  // 1) Per-order audit (kept as is)
  await pool.query(`
    INSERT INTO order_consents (order_id, customer_id, payment_method_id, version, consent_text, text_hash, checked_at, ip, user_agent, locale, tz)
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10)
    ON CONFLICT (order_id) DO UPDATE SET
      version = EXCLUDED.version,
      consent_text = EXCLUDED.consent_text,
      text_hash = EXCLUDED.text_hash,
      checked_at = NOW(),
      ip = EXCLUDED.ip,
      user_agent = EXCLUDED.user_agent,
      locale = EXCLUDED.locale,
      tz = EXCLUDED.tz
  `, [id, row.customer_id, row.saved_payment_method_id, version || '1.0', text || '', serverHash, ip, ua, locale || null, tz || null]);

  // 2) One-row-per-customer registry (NEW) — only if we already have a customer_id
  if (row.customer_id) {
    await pool.query(`
      INSERT INTO customer_consents (
        customer_id, customer_name, customer_phone,
        latest_payment_method_id, latest_text_hash, latest_version,
        first_checked_at, last_checked_at,
        first_order_id, last_order_id,
        ip, user_agent, locale, tz
      )
      VALUES ($1,$2,$3,$4,$5, NOW(), NOW(), $6, $6, $7,$8,$9,$10)
      ON CONFLICT (customer_id) DO UPDATE SET
        customer_name            = COALESCE(EXCLUDED.customer_name, customer_consents.customer_name),
        customer_phone           = COALESCE(EXCLUDED.customer_phone, customer_consents.customer_phone),
        latest_payment_method_id = COALESCE(EXCLUDED.latest_payment_method_id, customer_consents.latest_payment_method_id),
        latest_text_hash         = COALESCE(EXCLUDED.latest_text_hash, customer_consents.latest_text_hash),
        latest_version           = COALESCE(EXCLUDED.latest_version, customer_consents.latest_version),
        first_checked_at         = COALESCE(customer_consents.first_checked_at, EXCLUDED.first_checked_at),
        first_order_id           = COALESCE(customer_consents.first_order_id,   EXCLUDED.first_order_id),
        last_checked_at          = EXCLUDED.last_checked_at,
        last_order_id            = EXCLUDED.last_order_id,
        ip                       = EXCLUDED.ip,
        user_agent               = EXCLUDED.user_agent,
        locale                   = EXCLUDED.locale,
        tz                       = EXCLUDED.tz
    `, [
      row.customer_id,
      row.client_name || null,
      row.client_phone || null,
      row.saved_payment_method_id || null,
      serverHash,
      version || '1.0',
      id, // parent/first order id (set on first insert, preserved on conflict)
      ip, ua, locale || null, tz || null
    ]);
  }


  // Promote order if it was gated
  await pool.query("UPDATE orders SET kind='setup' WHERE id=$1 AND kind='setup_required'", [id]);

  res.send({ ok: true, hash: serverHash, version: version || '1.0' });
});


// Read consent (used by the Sheet for the Adjustments tab)
app.get('/orders/:id/consent', async (req, res) => {
  const { id } = req.params;

  // Find order's customer_id
  const o = await pool.query('SELECT customer_id FROM orders WHERE id=$1', [id]);
  const cId = o.rows[0]?.customer_id;
  if (!cId) {
    // Fallback: check only this order’s legacy row
    const r0 = await pool.query('SELECT version, text_hash FROM order_consents WHERE order_id=$1', [id]);
    if (!r0.rows[0]) return res.send({ ok:false });
    return res.send({ ok:true, version: r0.rows[0].version || '1.0', hash: r0.rows[0].text_hash });
  }

  // Prefer canonical customer-level registry
  const r = await pool.query(`
    SELECT latest_version AS version,
           latest_text_hash AS hash,
           first_order_id,
           first_checked_at,
           last_checked_at
    FROM customer_consents
    WHERE customer_id=$1
  `, [cId]);

  if (r.rows[0]) {
    return res.send({
      ok: true,
      version: r.rows[0].version || '1.0',
      hash: r.rows[0].hash || null,
      first_order_id: r.rows[0].first_order_id || null,
      first_checked_at: r.rows[0].first_checked_at || null,
      last_checked_at: r.rows[0].last_checked_at || null
    });
  }

  // Legacy fallback
  const r2 = await pool.query('SELECT version, text_hash FROM order_consents WHERE order_id=$1', [id]);
  if (!r2.rows[0]) return res.send({ ok:false });
  return res.send({ ok:true, version: r2.rows[0].version || '1.0', hash: r2.rows[0].text_hash });
});


app.get('/book', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'book.html'));
});

// Create an adjustment child order; off-session if we can, else 3DS confirm.
// HONORS Sheets "Capture Type" via req.body.capture = 'automatic' | 'manual'
app.post('/create-adjustment', async (req, res) => {
  const { parentOrderId, amount, note, capture } = req.body || {};
  if (!parentOrderId || !amount) return res.status(400).send({ error: 'missing fields' });

  const p = await pool.query('SELECT customer_id, saved_payment_method_id, payment_intent_id FROM orders WHERE id=$1', [parentOrderId]);
  if (!p.rows[0]) return res.status(404).send({ error: 'parent not found' });

  // Check if parent order has consent on file
  const consent = await pool.query('SELECT 1 FROM order_consents WHERE order_id=$1', [parentOrderId]);
  const hasConsent = !!consent.rows.length;

  // We can try off-session ONLY if we have consent and a saved PM on the same customer
  const canChargeOffSession = !!(hasConsent && p.rows[0].customer_id && p.rows[0].saved_payment_method_id);

  const childId = randomUUID();
  const publicCode = await generateUniqueCode();

  const captureMethod = (String(capture).toLowerCase() === 'manual') ? 'manual' : 'automatic';
  const baseCreate = {
    amount,
    currency: 'mxn',
    customer: p.rows[0].customer_id || undefined,
    capture_method: captureMethod,
    description: note ? `SERVI ajuste: ${note}` : 'SERVI ajuste',
    metadata: {
      kind: 'adjustment',
      parent_order_id: parentOrderId,
      initial_payment_intent: p.rows[0].payment_intent_id || ''
    }
  };

  let pi = null, mode = 'needs_action';
  try {
    if (canChargeOffSession) {
      // Try to confirm off-session with saved card
      pi = await stripe.paymentIntents.create({
        ...baseCreate,
        payment_method: p.rows[0].saved_payment_method_id,
        off_session: true,
        confirm: true
      });
      // Interpret mode by capture_method
      mode = (captureMethod === 'automatic')
        ? (pi.status === 'succeeded' ? 'charged' : 'needs_action')
        : (pi.status === 'requires_capture' ? 'authorized' : 'needs_action');
    } else {
      // No card on file or no consent → create unconfirmed PI for client flow
      pi = await stripe.paymentIntents.create({
        ...baseCreate,
        payment_method_types: ['card']
      });
      mode = 'needs_action';
    }
  } catch (err) {
    console.error('[create-adjustment] primary create error:', err?.message);
    // Salvage PI from error if present; else create unconfirmed with chosen capture_method
    const errPI = err?.raw?.payment_intent || err?.payment_intent || null;
    if (errPI) {
      pi = (typeof errPI === 'string') ? await stripe.paymentIntents.retrieve(errPI) : errPI;
    } else {
      pi = await stripe.paymentIntents.create({
        ...baseCreate,
        payment_method_types: ['card']
      });
    }
    mode = 'needs_action';
  }

  console.log('[create-adjustment]', {
    captureMethod,
    canChargeOffSession,
    pi: pi?.id,
    pi_status: pi?.status
  });

  await pool.query(`
    INSERT INTO orders (id, payment_intent_id, amount, status, public_code, kind, parent_id, customer_id, saved_payment_method_id)
    VALUES ($1, $2, $3, $4, $5, 'adjustment', $6, $7, $8)
  `, [
    childId,
    pi?.id || null,
    amount,
    pi?.status || 'pending',
    publicCode,
    parentOrderId,
    p.rows[0].customer_id || null,
    p.rows[0].saved_payment_method_id || null
  ]);

  res.send({ childOrderId: childId, paymentIntentId: pi?.id || null, publicCode, mode, captureMethod });
});

// Capture an authorized manual-capture PaymentIntent (optionally partial).
// Body: { orderId?: string, paymentIntentId?: string, amount?: number }  // amount in CENTS
app.post('/capture-order', requireAdminAuth, async (req, res) => {
  try {
    const { orderId, paymentIntentId, amount } = req.body || {};
    let piId = paymentIntentId;
    let orderRow = null;

    if (!piId && orderId) {
      const r = await pool.query('SELECT id, payment_intent_id, amount FROM orders WHERE id=$1', [orderId]);
      if (!r.rows[0] || !r.rows[0].payment_intent_id) return res.status(404).send({ error: 'order not found' });
      orderRow = r.rows[0];
      piId = orderRow.payment_intent_id;
    }
    if (!piId) return res.status(400).send({ error: 'missing paymentIntentId or orderId' });

    if (!orderRow) {
      const r = await pool.query('SELECT id, amount FROM orders WHERE payment_intent_id=$1 LIMIT 1', [piId]);
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

      const r = await pool.query('SELECT id, customer_id FROM orders WHERE payment_intent_id = $1 LIMIT 1', [paymentIntentId]);
      const row = r.rows[0] || {};

      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2', ['Captured', paymentIntentId]);

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

      // Use metadata.order_id when present (we set this when creating the SetupIntent)
      let orderId = si.metadata?.order_id || null;

      // Fallback: most recent order for this customer in setup/book states
      if (!orderId && cust) {
        try {
          const r = await pool.query(
            `SELECT id FROM orders
            WHERE customer_id = $1
              AND kind IN ('setup_required','setup','book')
            ORDER BY created_at DESC
            LIMIT 1`,
            [cust]
          );
          orderId = r.rows[0]?.id || null;
        } catch {}
      }

      if (orderId) {
        const statusLabel = 'Scheduled';

        await pool.query(
          `UPDATE orders
              SET status                  = $1,
                  saved_payment_method_id = COALESCE($2, saved_payment_method_id),
                  customer_id             = COALESCE($3, customer_id),
                  kind                    = 'book'
            WHERE id = $4`,
          [statusLabel, pmId, cust, orderId]
        );

        const consentRow = await pool.query(`
          SELECT order_id,
                 version,
                 text_hash,
                 checked_at,
                 ip,
                 user_agent,
                 locale,
                 tz
            FROM order_consents
           WHERE order_id = $1
        `, [orderId]);
        const consentMeta = consentRow.rows[0] || {};

        if (cust) {
          const orderInfo = await pool.query(
            'SELECT client_name, client_phone FROM orders WHERE id = $1',
            [orderId]
          );
          const customerName  = orderInfo.rows[0]?.client_name  || null;
          const customerPhone = orderInfo.rows[0]?.client_phone || null;

          await pool.query(`
            INSERT INTO customer_consents (
              customer_id,
              customer_name,
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
              $1,$2,$3,$4,
              $5,$6,$7,NOW(),
              $8,$8,$9,$10,$11,$12
            )
            ON CONFLICT (customer_id) DO UPDATE SET
              customer_name            = COALESCE($2, customer_consents.customer_name),
              customer_phone           = COALESCE($3, customer_consents.customer_phone),
              latest_payment_method_id = COALESCE($4, customer_consents.latest_payment_method_id),
              latest_text_hash         = COALESCE($5, customer_consents.latest_text_hash),
              latest_version           = COALESCE($6, customer_consents.latest_version),
              first_checked_at         = COALESCE(customer_consents.first_checked_at, $7),
              last_checked_at          = NOW(),
              first_order_id           = COALESCE(customer_consents.first_order_id, $8),
              last_order_id            = $8,
              ip                       = COALESCE($9, customer_consents.ip),
              user_agent               = COALESCE($10, customer_consents.user_agent),
              locale                   = COALESCE($11, customer_consents.locale),
              tz                       = COALESCE($12, customer_consents.tz)
          `, [
            cust,
            customerName,
            customerPhone,
            pmId || null,
            consentMeta.text_hash || null,
            consentMeta.version || null,
            consentMeta.checked_at || null,
            consentMeta.order_id || orderId,
            consentMeta.ip || null,
            consentMeta.user_agent || null,
            consentMeta.locale || null,
            consentMeta.tz || null
          ]);
        }

        if (GOOGLE_SCRIPT_WEBHOOK_URL) {
          fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'order.status',
              orderId,
              status: statusLabel,
              customerId: cust || ''
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
      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
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
      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
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
      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
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

      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
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
          'UPDATE orders SET saved_payment_method_id = COALESCE($1, saved_payment_method_id), customer_id = COALESCE($2, customer_id) WHERE payment_intent_id = $3',
          [pmId, cust, obj.id]
        );
      }

      if (obj.capture_method === 'manual' && obj.status === 'requires_capture') {
        const r = await pool.query('SELECT id, customer_id FROM orders WHERE payment_intent_id = $1 LIMIT 1', [obj.id]);
        const row = r.rows[0] || {};

        await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2', ['Confirmed', obj.id]);

        console.log('[PI capturable] order:', row.id, 'pi:', obj.id, 'status → Confirmed'); // <— add

        if (GOOGLE_SCRIPT_WEBHOOK_URL) {
          fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: obj.id,
              status: 'Confirmed',
              orderId: row.id || '',
              customerId: row.customer_id || ''
            })
          }).catch(() => {});
        }
      }
      break;
    }

    case 'customer.updated': {
      const c = event.data.object; // Stripe Customer
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

      await pool.query(`
        INSERT INTO customer_consents (
          customer_id,
          customer_name,
          customer_phone,
          last_checked_at
        )
        VALUES ($1,$2,$3,NOW())
        ON CONFLICT (customer_id) DO UPDATE SET
          customer_name  = COALESCE($2, customer_consents.customer_name),
          customer_phone = COALESCE($3, customer_consents.customer_phone),
          last_checked_at = NOW()
      `, [c.id, c.name || null, c.phone || null]);

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
          INSERT INTO customer_consents (customer_id, latest_payment_method_id, last_checked_at)
          VALUES ($1,$2,NOW())
          ON CONFLICT (customer_id) DO UPDATE SET
            latest_payment_method_id = $2,
            last_checked_at = NOW()
        `, [customerId, pm.id]);
      }
      break;
    }
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }


  res.status(200).send('Webhook received');
});

app.post('/confirm-with-saved', async (req, res) => {
  try {
    const { orderId, force } = req.body || {};
    if (!orderId) return res.status(400).send({ error: 'orderId required' });

    const { rows } = await pool.query(
      `SELECT id, payment_intent_id, customer_id, amount, kind, parent_id, service_date, service_datetime
         FROM orders
        WHERE id = $1`,
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.status(404).send({ error: 'order not found' });

    const hoursAhead = hoursUntilService(row);
    if (hoursAhead > 12 && !force) {
      const serviceMs = row.service_datetime
        ? new Date(row.service_datetime).getTime()
        : new Date(String(row.service_date) + 'T08:00:00-05:00').getTime();
      const opensAtMs = serviceMs - (12 * 60 * 60 * 1000);

      return res.status(409).json({
        error: 'preauth_window_closed',
        remaining_hours: Math.ceil(hoursAhead),
        preauth_window_opens_at: new Date(opensAtMs).toISOString()
      });
    }





    // ≤12h → create/confirm a manual-capture PI now
    let piId = row.payment_intent_id || null;
    const isSetup = piId && String(piId).startsWith('seti_');

    // Ensure we have a real PI (not a SetupIntent)
    if (!piId || isSetup) {
      const pi = await stripe.paymentIntents.create({
        amount: row.amount,
        currency: 'mxn',
        payment_method_types: ['card'],
        capture_method: 'manual',
        customer: row.customer_id || undefined,
        metadata: {
          kind: 'primary',
          parent_order_id: row.parent_id || ''
        }
      });
      await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [pi.id, row.id]);
      piId = pi.id;
    }

    // Pick a saved card
    const pmList = await stripe.paymentMethods.list({ customer: row.customer_id, type: 'card' });
    const pm = pmList.data[0];
    if (!pm) return res.status(409).send({ error: 'no_saved_card' });

    // Attach and confirm (off-session if possible)
    await stripe.paymentIntents.update(piId, { payment_method: pm.id });
    try {
      const confirmed = await stripe.paymentIntents.confirm(piId, { off_session: true });
      if (confirmed.status === 'requires_action') {
        // needs 3DS in browser
        return res.status(402).send({
          ok: false,
          reason: 'requires_action',
          clientSecret: confirmed.client_secret,
          paymentIntentId: confirmed.id
        });
      }
      return res.send({ ok: true, status: confirmed.status, paymentIntentId: confirmed.id });
    } catch (e) {
      const pi = e?.raw?.payment_intent || e?.payment_intent;
      if (e?.code === 'authentication_required' && pi?.client_secret) {
        return res.status(402).send({
          ok: false,
          reason: 'requires_action',
          clientSecret: pi.client_secret,
          paymentIntentId: pi.id
        });
      }
      throw e;
    }
  } catch (err) {
    console.error('confirm-with-saved error:', err);
    res.status(500).send({ error: 'Internal error' });
  }
});

// Mark the current PaymentIntent so Stripe saves the card on success
app.post('/orders/:id/apply-consent-to-current-pi', async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query('SELECT payment_intent_id FROM orders WHERE id=$1', [id]);
    const row = r.rows[0];
    if (!row || !row.payment_intent_id) {
      return res.status(400).json({ error: 'no_pi' });
    }

    // Important: update BEFORE confirmCardPayment happens on the client
    const updated = await stripe.paymentIntents.update(row.payment_intent_id, {
      setup_future_usage: 'off_session'
    });

    res.json({ ok: true, payment_intent_id: updated.id, setup_future_usage: updated.setup_future_usage });
  } catch (e) {
    console.error('apply-consent-to-current-pi error:', e?.message);
    res.status(500).json({ error: e?.message || 'internal' });
  }
});

app.post('/billing-portal', async (req, res) => {
  try {
    const { orderId, returnUrl } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    // Find the linked customer for this order
    const { rows } = await pool.query('SELECT customer_id FROM orders WHERE id=$1', [orderId]);
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
      'SELECT id, payment_intent_id, kind, service_date, service_datetime, customer_id FROM orders WHERE id = $1',
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.redirect(302, '/');

  
    if (String(row.kind || '').toLowerCase() === 'book') {
      const h = hoursUntilService(row);
      if (!row.payment_intent_id || h > 12) {
        // Mark as Scheduled server-side (idempotent)…
        await pool.query(
          "UPDATE orders SET status = 'Scheduled' WHERE id = $1 AND (status IS NULL OR status NOT IN ('Confirmed','Captured'))",
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
              customerId: row.customer_id || ''
            })
          }).catch(()=>{});
        }

        return res.sendFile(path.join(__dirname, 'public', 'success.html'));
      }
    }


    // If we have a PI, require it to be authorized or captured to show success
    if (row.payment_intent_id) {
      const id = row.payment_intent_id;
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
    }

    // Otherwise bounce back to the appropriate page
    const redirectTarget = (String(row.kind || '').toLowerCase() === 'adjustment') ? '/confirm' : '/pay';
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
