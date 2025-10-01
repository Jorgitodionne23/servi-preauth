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
import { randomUUID, randomBytes, createHash } from 'crypto';

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
    const t = new Date(y, (m||1)-1, d||1, 12, 0, 0, 0).getTime();
    return Math.floor((t - Date.now()) / 3_600_000);
  }
  return Infinity;
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
app.post('/create-payment-intent', async (req, res) => {
  const { amount, clientName, serviceDescription, serviceDate, serviceDateTime, clientEmail, clientPhone, consent } = req.body;
  try {
    // 1) Find or create Stripe Customer by email/phone (your existing logic)
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
    const customer = existingCustomer || await stripe.customers.create({
      name: clientName || undefined,
      email: clientEmail || undefined,
      phone: clientPhone || undefined,
    });

    // 2) Create the order row FIRST (pending, kind='primary')
    const orderId = randomUUID();
    async function generateUniqueCode() {
      for (let i = 0; i < 6; i++) {
        const code = randomBytes(8).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        const { rows } = await pool.query('SELECT 1 FROM orders WHERE public_code = $1', [code]);
        if (rows.length === 0) return code;
      }
      throw new Error('Could not generate unique public code');
    }
    const publicCode = await generateUniqueCode();

    await pool.query(
      `INSERT INTO orders
       (id, amount, client_name, service_description, service_date, status, public_code, kind, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'primary',$8)
       ON CONFLICT (id) DO NOTHING`,
      [orderId, amount, clientName || null, serviceDescription || null, serviceDate || null, 'pending', publicCode, customer.id]
    );

    // NEW: persist normalized date-only + full timestamp for display
    await pool.query(
      'UPDATE orders SET service_date=$1, service_datetime=$2 WHERE id=$3',
      [serviceDate || null, serviceDateTime || null, orderId]
    );

    // [DEBUG LOG] ← This is the exact place for the debug line you asked about
    console.log('[create-payment-intent] persisted dates', {
      orderId,
      serviceDate,      // e.g., '2025-09-25'
      serviceDateTime,  // e.g., '2025-09-25T16:00:00-05:00'
      publicCode
    });

    const longLead = daysAheadFromYMD(serviceDate) >= 5;
    const saved = await hasSavedCard(customer.id, stripe);

    if (longLead) {
      if (!consent && !saved) {
        await pool.query('UPDATE orders SET status=$1, kind=$2 WHERE id=$3', ['Blocked', 'setup_required', orderId]);
        return res.status(403).send({
          error: 'account_required',
          message: 'Solo usuarios con cuenta pueden reservar con 5 días o mas de anticipación.',
          orderId,
          publicCode
        });
      }

      // If card not saved yet → user must save now (SetupIntent will be created on /create-setup-intent)
      if (!saved) {
        await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', orderId]);
        return res.send({ orderId, publicCode, requiresSetup: true, hasSavedCard: false });
      }

      // Card saved → scheduled booking: no PI yet. Mark as Scheduled in DB.
      await pool.query('UPDATE orders SET kind=$1, status=$2 WHERE id=$3', ['book', 'Scheduled', orderId]);
      return res.send({ orderId, publicCode, hasSavedCard: true, scheduled: true });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'mxn',
      capture_method: 'manual',
      payment_method_types: ['card'],
      customer: customer.id,
      ...(consent ? { setup_future_usage: 'off_session' } : {}),
      metadata: { order_id: orderId, kind: 'primary' }
    });

    await pool.query(
      'UPDATE orders SET payment_intent_id=$1 WHERE id=$2',
      [paymentIntent.id, orderId]
    );

    return res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
      publicCode,
      hasSavedCard: saved
    });
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
      SELECT id, payment_intent_id, amount, client_name, service_description,
             service_date, service_datetime, status, created_at, public_code,
             kind, parent_id, customer_id
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
        const c = await pool.query('SELECT 1 FROM order_consents WHERE order_id=$1', [row.id]);
        if (!c.rows.length) {
          consentRequired = true;
          pi = null;
          intentType = null; // no client_secret returned
        } else {
          await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', row.id]);
          const si = await stripe.setupIntents.create({
            customer: row.customer_id || undefined,
            automatic_payment_methods: { enabled: true },
            usage: 'off_session',
            metadata: { kind: 'setup', order_id: row.id }
          });
          await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
          pi = si;
          intentType = 'setup';
        }

      } else if (kind === 'setup') {
        const si = await stripe.setupIntents.create({
          customer: row.customer_id || undefined,
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
        // Default (legacy primary or adjustments): create a PI now
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
  const code = String(req.params.code || '').toUpperCase();
  const { rows } = await pool.query(
    'SELECT id, kind, customer_id FROM orders WHERE public_code = $1',
    [code]
  );
  if (!rows[0]) return res.status(404).send('Not found');

  const row = rows[0];

  // 🔹 explicit routing by kind
  if (row.kind === 'adjustment')      return res.redirect(302, `/confirm?orderId=${encodeURIComponent(row.id)}`);
  if (row.kind === 'setup_required')  return res.redirect(302, `/save?orderId=${encodeURIComponent(row.id)}`); // consent gate lives in /pay
  if (row.kind === 'setup')           return res.redirect(302, `/save?orderId=${encodeURIComponent(row.id)}`); // setup flow also handled on /pay
  if (row.kind === 'book')            return res.redirect(302, `/book?orderId=${encodeURIComponent(row.id)}`);

  // legacy 'primary': decide by saved card
  let hasSaved = false;
  if (row.customer_id) {
    const pmList = await stripe.paymentMethods.list({ customer: row.customer_id, type: 'card', limit: 1 });
    hasSaved = pmList.data.length > 0;
  }
  return res.redirect(302,
    hasSaved
      ? `/book?orderId=${encodeURIComponent(row.id)}`
      : `/pay?orderId=${encodeURIComponent(row.id)}`
  );
});

// 📡 Stripe Webhook handler ex
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
            (service_date::timestamp AT TIME ZONE 'America/Mexico_City') + INTERVAL '8 hours'
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

  const r = await pool.query('SELECT payment_intent_id, customer_id, saved_payment_method_id FROM orders WHERE id=$1', [id]);
  if (!r.rows[0]) return res.status(404).send({ error: 'order not found' });

  await pool.query(`
    INSERT INTO order_consents (order_id, customer_id, payment_method_id, version, consent_text, text_hash, checked_at, ip, user_agent, locale, tz)
    VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10)
    ON CONFLICT (order_id) DO UPDATE SET
      version=EXCLUDED.version, consent_text=EXCLUDED.consent_text, text_hash=EXCLUDED.text_hash,
      checked_at=NOW(), ip=EXCLUDED.ip, user_agent=EXCLUDED.user_agent, locale=EXCLUDED.locale, tz=EXCLUDED.tz
  `, [id, r.rows[0].customer_id, r.rows[0].saved_payment_method_id, version || '1.0', text || '', serverHash, ip, ua, locale || null, tz || null]);

  const maybeIntentId = r.rows[0].payment_intent_id || '';
  // Only touch a real PaymentIntent (pi_...). Skip if it's a SetupIntent (seti_...)
  if (maybeIntentId.startsWith('pi_')) {
    await stripe.paymentIntents.update(maybeIntentId, {
      setup_future_usage: 'off_session',
      metadata: {
        cof_consent: 'true',
        cof_consent_version: version || '1.0',
        cof_consent_hash: serverHash
      }
    });
  }

  await pool.query(
    "UPDATE orders SET kind='setup' WHERE id=$1 AND kind='setup_required'",
    [id]
  );

  res.send({ ok: true, hash: serverHash, version: version || '1.0' });
});

// Read consent (used by the Sheet for the Adjustments tab)
app.get('/orders/:id/consent', async (req, res) => {
  const r = await pool.query('SELECT version, text_hash FROM order_consents WHERE order_id=$1', [req.params.id]);
  if (!r.rows[0]) return res.send({ ok: false });
  res.send({ ok: true, version: r.rows[0].version || '1.0', hash: r.rows[0].text_hash });
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

  async function generateUniqueCode() {
    for (let i = 0; i < 6; i++) {
      const code = randomBytes(8).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const { rows } = await pool.query('SELECT 1 FROM orders WHERE public_code = $1', [code]);
      if (!rows.length) return code;
    }
    throw new Error('Could not generate unique public code');
  }
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
app.post('/capture-order', async (req, res) => {
  try {
    const { orderId, paymentIntentId, amount } = req.body || {};
    let piId = paymentIntentId;

    if (!piId && orderId) {
      const r = await pool.query('SELECT payment_intent_id FROM orders WHERE id=$1', [orderId]);
      if (!r.rows[0] || !r.rows[0].payment_intent_id) return res.status(404).send({ error: 'order not found' });
      piId = r.rows[0].payment_intent_id;
    }
    if (!piId) return res.status(400).send({ error: 'missing paymentIntentId or orderId' });

    const current = await stripe.paymentIntents.retrieve(piId);
    if (current.capture_method !== 'manual') {
      return res.status(400).send({ error: 'not a manual-capture intent' });
    }
    if (current.status !== 'requires_capture') {
      return res.status(400).send({ error: `PI not capturable (status=${current.status})` });
    }

    const params = {};
    if (Number.isInteger(amount) && amount > 0) {
      // Stripe expects amount_to_capture in the smallest currency unit
      params.amount_to_capture = amount;
    }

    const updated = await stripe.paymentIntents.capture(piId, params);
    // Webhook will mark as Captured and notify Sheets; we just echo back
    return res.send({ ok: true, paymentIntentId: updated.id, status: updated.status, captured: params.amount_to_capture || 'full' });
  } catch (e) {
    console.error('capture-order error:', e);
    return res.status(500).send({ error: e.message || 'capture failed' });
  }
});

app.post('/void-order', async (req, res) => {
  try {
    const { orderId, paymentIntentId, reason } = req.body || {};
    let intentId = paymentIntentId;

    if (!intentId && orderId) {
      const r = await pool.query('SELECT payment_intent_id FROM orders WHERE id=$1', [orderId]);
      if (!r.rows[0] || !r.rows[0].payment_intent_id) {
        return res.status(404).send({ error: 'Order not found or has no linked Intent' });
      }
      intentId = r.rows[0].payment_intent_id;
    }
    if (!intentId) {
      return res.status(400).send({ error: 'Missing paymentIntentId or orderId' });
    }
    
    // Check the ID prefix to determine the type
    let updated;
    if (intentId.startsWith('seti_')) {
      updated = await stripe.setupIntents.cancel(intentId, {
        cancellation_reason: reason || 'requested_by_customer'
      });
    } else {
      updated = await stripe.paymentIntents.cancel(intentId, {
        cancellation_reason: reason || 'requested_by_customer'
      });
    }

    // Webhook will update Sheets on payment_intent.canceled or setup_intent.canceled
    return res.send({ ok: true, intentId: updated.id, status: updated.status });
  } catch (e) {
    console.error('void-order error:', e);
    return res.status(500).send({ error: e.message || 'Void failed' });
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

      // Try to get the orderId from metadata; otherwise pick the most recent setup-related order for this customer
      let orderId = si.metadata?.order_id || null;
      if (!orderId && cust) {
        try {
          const r = await pool.query(
            `SELECT id FROM orders
            WHERE customer_id=$1 AND kind IN ('setup_required','setup','book')
            ORDER BY created_at DESC
            LIMIT 1`,
            [cust]
          );
          orderId = r.rows[0]?.id || null;
        } catch {}
      }

      if (orderId) {
        // Store PM & customer; promote order to 'book' so links route to /book
        await pool.query(
          `UPDATE orders
            SET status=$1,
                saved_payment_method_id=COALESCE($2, saved_payment_method_id),
                customer_id=COALESCE($3, customer_id),
                kind='book'
          WHERE id=$4`,
          ['Saved', pmId, cust, orderId]
        );

        // 👉 Always “Setup created” here (NOT the scheduled variant)
        fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order.status',
            orderId,
            status: 'Setup created'
          })
        }).catch(()=>{});
      }

      // Optional: keep Clients sheet in sync
      if (cust) {
        try {
          const c = await stripe.customers.retrieve(cust);
          fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ type:'customer.updated', id:c.id, name:c.name||'', email:c.email||'', phone:c.phone||'' })
          }).catch(()=>{});
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

      // (A) If you later add a DB 'clients' table, you could sync it here.
      // await pool.query(
      //   'UPDATE clients SET name=$1, email=$2, phone=$3 WHERE customer_id=$4',
      //   [c.name || null, c.email || null, c.phone || null, c.id]
      // );

      // (B) Tell your Google Apps Script to upsert the SERVI Clients row.
      //     Reuse your existing Apps Script webhook URL constant.
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


    default:
      console.log(`Unhandled event type: ${event.type}`);
  }


  res.status(200).send('Webhook received');
});

app.post('/confirm-with-saved', async (req, res) => {
  try {
    const { orderId } = req.body || {};
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
    if (hoursAhead > 12) {
      const cameFromSetup = !!(row.payment_intent_id && String(row.payment_intent_id).startsWith('seti_'));
      if (cameFromSetup && GOOGLE_SCRIPT_WEBHOOK_URL) {
        fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order.status',
            orderId: row.id,
            status: 'Setup created for scheduled order'
          })
        }).catch(() => {});
      }

      return res.status(409).json({
        error: 'preauth_window_closed',
        message: 'Tu servicio quedó programado. Realizaremos la preautorización 12 horas antes del servicio.'
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
      'SELECT id, payment_intent_id, kind, service_date, service_datetime FROM orders WHERE id = $1',
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.redirect(302, '/');

    // If this is a saved-card booking (kind='book') and we are still >12h away,
    // we intentionally have no PI yet → show success immediately.
    if (String(row.kind || '').toLowerCase() === 'book') {
      const h = hoursUntilService(row);
      if (!row.payment_intent_id || h > 12) {
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
