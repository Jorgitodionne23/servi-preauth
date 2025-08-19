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
app.use(express.static('public'));

// 🎯 Create PaymentIntent
// 🎯 Create PaymentIntent (save card for later off-session charges)
app.post('/create-payment-intent', async (req, res) => {
  const { amount, clientName, serviceDescription, serviceDate, clientEmail, clientPhone } = req.body;
  try {
    // Create a lightweight Customer to attach the card to
    const customer = await stripe.customers.create({
      name: clientName || undefined,
      email: clientEmail || undefined,
      phone: clientPhone || undefined,
    });

    const paymentIntent = await stripe.payment_intents.create({
      amount,
      currency: 'mxn',
      capture_method: 'manual',
      payment_method_types: ['card'],
      customer: customer.id,
      setup_future_usage: 'off_session', // save card for later
    });

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
       (id, payment_intent_id, amount, client_name, service_description, service_date, status, public_code, kind, customer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'primary',$9)
       ON CONFLICT (id) DO NOTHING`,
      [orderId, paymentIntent.id, amount, clientName || null, serviceDescription || null, serviceDate || null, 'pending', publicCode, customer.id]
    );

    res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
      publicCode
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

app.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const { rows } = await pool.query(`
      SELECT id, payment_intent_id, amount, client_name, service_description,
             service_date, status, created_at, public_code
      FROM orders
      WHERE id = $1
    `, [orderId]);

    const row = rows[0];
    if (!row) return res.status(404).send({ error: 'Order not found' });

    const pi = await stripe.paymentIntents.retrieve(row.payment_intent_id);
    res.send({ ...row, client_secret: pi.client_secret });
  } catch (err) {
    console.error('Error retrieving order:', err.message);
    res.status(500).send({ error: 'Internal server error' });
  }
});

app.get('/o/:code', async (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const { rows } = await pool.query('SELECT id, kind FROM orders WHERE public_code = $1', [code]);
  if (!rows[0]) return res.status(404).send('Not found');
  const target = rows[0].kind === 'adjustment' ? '/confirm' : '/pay';
  res.redirect(302, `${target}?orderId=${rows[0].id}`);
});



// 📡 Stripe Webhook handler
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
      metadata: { cof_consent: 'true', cof_consent_version: version || '1.0', cof_consent_hash: serverHash }
    });
  }
  res.send({ ok: true, hash: serverHash, version: version || '1.0' });
});

// Read consent (used by the Sheet for the Adjustments tab)
app.get('/orders/:id/consent', async (req, res) => {
  const r = await pool.query('SELECT version, text_hash FROM order_consents WHERE order_id=$1', [req.params.id]);
  if (!r.rows[0]) return res.send({ ok: false });
  res.send({ ok: true, version: r.rows[0].version || '1.0', hash: r.rows[0].text_hash });
});

// Create an adjustment child order; try off-session first, fall back to 3DS confirm
app.post('/create-adjustment', async (req, res) => {
  const { parentOrderId, amount, note } = req.body || {};
  if (!parentOrderId || !amount) return res.status(400).send({ error: 'missing fields' });

  const p = await pool.query('SELECT customer_id, saved_payment_method_id, payment_intent_id FROM orders WHERE id=$1', [parentOrderId]);
  if (!p.rows[0]) return res.status(404).send({ error: 'parent not found' });

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

  let pi = null, mode = 'needs_action';
  try {
    pi = await stripe.paymentIntents.create({
      amount, currency: 'mxn',
      customer: p.rows[0].customer_id || undefined,
      payment_method: p.rows[0].saved_payment_method_id || undefined,
      off_session: !!(p.rows[0].customer_id && p.rows[0].saved_payment_method_id),
      confirm: !!(p.rows[0].customer_id && p.rows[0].saved_payment_method_id),
      capture_method: 'automatic',
      description: note ? `SERVI ajuste: ${note}` : 'SERVI ajuste',
      metadata: {
        kind: 'adjustment',
        parent_order_id: parentOrderId,
        initial_payment_intent: p.rows[0].payment_intent_id || ''
      }
    });
    mode = (pi && pi.status === 'succeeded') ? 'charged' : 'needs_action';
  } catch (_) {
    // fall back to a client-side confirm if SCA is required or we lacked a saved PM
  }

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

  res.send({ childOrderId: childId, paymentIntentId: pi?.id || null, publicCode, mode });
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
    // AUTHORIZED / CONFIRMED (manual-capture flow)
    case 'charge.succeeded': {
      console.log('✅ Confirmed (charge.succeeded):', paymentIntentId);
      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
                   ['Confirmed', paymentIntentId]);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, status: 'Confirmed' })
      }).then(async r => console.log('Sheets confirm:', r.status, await r.text()))
        .catch(e => console.error('Sheets confirm failed:', e));
      break;
    }

    // CAPTURED / PAID
    case 'payment_intent.succeeded': {
      console.log('💰 Captured (payment_intent.succeeded):', paymentIntentId);
      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
                      ['Captured', paymentIntentId]);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, status: 'Captured' })
      }).then(async r => console.log('Sheets captured:', r.status, await r.text()))
        .catch(e => console.error('Sheets captured failed:', e));
      break;
    }

    // (optional) failure/cancel hygiene
    case 'payment_intent.payment_failed':
    case 'charge.failed':
    case 'charge.expired':
    case 'payment_intent.canceled': {
      console.log('❌ Failed/Cancelled:', paymentIntentId, event.type);
      await pool.query('UPDATE orders SET status = $1 WHERE payment_intent_id = $2',
                      ['Failed', paymentIntentId]);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, status: 'Failed' })
      }).catch(e => console.error('Sheets fail notify failed:', e));
      break;
    }

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
      break;
    }


    default:
      console.log(`Unhandled event type: ${event.type}`);
  }


  res.status(200).send('Webhook received');
});

// 🚀 Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
