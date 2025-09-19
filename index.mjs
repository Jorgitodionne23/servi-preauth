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

    // 3) 7-day gate
    const longLead = daysAheadFromYMD(serviceDate) > 7;
    const saved = await hasSavedCard(customer.id, stripe);

    if (longLead) {
      // Only “account users” (consent or saved card) can reserve >7d in advance
      if (!consent && !saved) {
        await pool.query('UPDATE orders SET status=$1, kind=$2 WHERE id=$3', ['Blocked', 'setup_required', orderId]);
        return res.status(403).send({
          error: 'account_required',
          message: 'Solo usuarios con cuenta pueden reservar con más de 7 días de anticipación.',
          orderId,
          publicCode
        });
      }

      // If card not saved yet → user must save now (SetupIntent will be created on /create-setup-intent)
      if (!saved) {
        await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['setup', orderId]);
        return res.send({ orderId, publicCode, requiresSetup: true, hasSavedCard: false });
      }

      // Card saved → booking flow (no PI yet; /order/:id or /confirm-with-saved will create/confirm later)
      await pool.query('UPDATE orders SET kind=$1 WHERE id=$2', ['book', orderId]);
      return res.send({ orderId, publicCode, hasSavedCard: true });
    }

    // 4) ≤ 7 days → create manual-capture PI now
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
        // >7d and user hasn't consented yet → don't create any Intent
        const ok = await hasConsent(row.id);
        if (!ok) {
          consentRequired = true;
          intentType = null;   // no client_secret returned
        } else {
          // consent exists now → promote to 'setup' and create SetupIntent
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
        // Save-card flow (consent presumably on file already)
        const si = await stripe.setupIntents.create({
          customer: row.customer_id || undefined,
          automatic_payment_methods: { enabled: true },
          usage: 'off_session',
          metadata: { kind: 'setup', order_id: row.id }
        });
        await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [si.id, row.id]);
        pi = si;
        intentType = 'setup';

      } else {
        // Default: manual-capture PI for ≤7d / primary flow
        pi = await stripe.paymentIntents.create({
          amount: row.amount,
          currency: 'mxn',
          payment_method_types: ['card'],
          capture_method: 'manual',
          customer: row.customer_id || undefined,
          metadata: { kind: row.kind || 'primary', parent_order_id: row.parent_id || '' }
        });
        await pool.query('UPDATE orders SET payment_intent_id=$1 WHERE id=$2', [pi.id, row.id]);
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

    // NEW: pretty display string for UI
    const service_display = displayEsMX(row.service_datetime, row.service_date, 'America/Mexico_City');

    res.set('Cache-Control', 'no-store');
    return res.json({
      ...row,
      client_secret: pi?.client_secret || null, // null when consent_required
      intentType,                               // 'payment' | 'setup' | null
      consent_required: consentRequired,        // true → UI must block and POST /orders/:id/consent
      saved_card: saved_card || null,
      service_display                           // 👈 "Jueves, 25 de Septiembre, a las 4:00 P.M."
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

  if (r.rows[0].payment_intent_id) {
    await stripe.paymentIntents.update(r.rows[0].payment_intent_id, {
      // When confirmed, Stripe will attach PM to the customer for future off-session use
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

// Cancel a manual-capture PaymentIntent to release the hold. bb
// Body: { orderId?: string, paymentIntentId?: string, reason?: string }
app.post('/void-order', async (req, res) => {
  try {
    const { orderId, paymentIntentId, reason } = req.body || {};
    let piId = paymentIntentId;

    if (!piId && orderId) {
      const r = await pool.query('SELECT payment_intent_id FROM orders WHERE id=$1', [orderId]);
      if (!r.rows[0] || !r.rows[0].payment_intent_id) return res.status(404).send({ error: 'order not found' });
      piId = r.rows[0].payment_intent_id;
    }
    if (!piId) return res.status(400).send({ error: 'missing paymentIntentId or orderId' });

    const updated = await stripe.paymentIntents.cancel(piId, {
      cancellation_reason: reason || 'requested_by_customer'
    });
    // Webhook will update Sheets on payment_intent.canceled
    return res.send({ ok: true, paymentIntentId: updated.id, status: updated.status });
  } catch (e) {
    console.error('void-order error:', e);
    return res.status(500).send({ error: e.message || 'void failed' });
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
      const si = event.data.object;
      const pmId = si.payment_method || null;
      const cust = si.customer || null;
      const orderId = si.metadata?.order_id || null;

      if (orderId) {
        // Mark Saved; store PM and Customer; promote to 'book' so future links route to one-click booking
        await pool.query(
          `UPDATE orders
            SET status=$1,
                saved_payment_method_id=COALESCE($2, saved_payment_method_id),
                customer_id=COALESCE($3, customer_id),
                kind='book'
          WHERE id=$4`,
          ['Saved', pmId, cust, orderId]
        );

        // Notify Sheets (Status column becomes "Saved")
        fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ paymentIntentId: si.id, status: 'Saved', orderId })
        }).catch(()=>{});
      }

      // Optionally push a customer.updated to keep Clients synced
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
      'SELECT id, payment_intent_id, customer_id FROM orders WHERE id=$1',
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.status(404).send({ error: 'order not found' });

    const pmList = await stripe.paymentMethods.list({
      customer: row.customer_id,
      type: 'card'
    });
    const pm = pmList.data[0];
    if (!pm) return res.status(409).send({ error: 'no_saved_card' });

    // attach saved PM to PI and confirm
    await stripe.paymentIntents.update(row.payment_intent_id, {
      payment_method: pm.id
    });

    try {
      const confirmed = await stripe.paymentIntents.confirm(row.payment_intent_id);
      if (confirmed.status === 'requires_action') {
        return res.status(402).send({
          ok: false,
          reason: 'requires_action',
          clientSecret: confirmed.client_secret,
          paymentIntentId: confirmed.id
        });
      }
      return res.send({ ok: true, status: confirmed.status, paymentIntentId: confirmed.id });
    } catch (e) {
      if (e?.code === 'authentication_required' && e?.raw?.payment_intent?.client_secret) {
        return res.status(402).send({
          ok: false,
          reason: 'requires_action',
          clientSecret: e.raw.payment_intent.client_secret,
          paymentIntentId: e.raw.payment_intent.id
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

    // Get the order, including kind so we know where to send them back
    const { rows } = await pool.query(
      'SELECT id, payment_intent_id, kind FROM orders WHERE id = $1',
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.redirect(302, '/');

    const isAdjustment = String(row.kind || '').toLowerCase() === 'adjustment';
    const redirectTarget = isAdjustment ? '/confirm' : '/pay';

    // If no PI yet, treat as unpaid and send to the right page
    if (!row.payment_intent_id) {
      return res.redirect(302, `${redirectTarget}?orderId=${encodeURIComponent(orderId)}`);
    }

    // Ask Stripe for the live status (don’t rely on webhook timing)
    const pi = await stripe.paymentIntents.retrieve(row.payment_intent_id);

    // OK statuses for showing success:
    // - adjustments (auto-capture):        succeeded
    // - primary (manual capture):          requires_capture (authorized) or succeeded (captured)
    const ok = pi && (pi.status === 'succeeded' || pi.status === 'requires_capture');

    if (!ok) {
      // Not paid/authorized → send them to confirm (adjustment) or pay (primary)
      return res.redirect(302, `${redirectTarget}?orderId=${encodeURIComponent(orderId)}`);
    }

    // Good to show success UI
    return res.sendFile(path.join(__dirname, 'public', 'success.html'));
  } catch (e) {
    console.error('success gate error:', e);
    const orderId = req.query.orderId || '';
    // Fallback to confirm for adjustments, pay for primaries (best-effort: default to /pay)
    return res.redirect(302, `/pay?orderId=${encodeURIComponent(orderId)}`);
  }
});

// 🚀 Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
