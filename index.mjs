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
import { randomUUID, randomBytes } from 'crypto';

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
app.post('/create-payment-intent', async (req, res) => {
const { amount, clientName, serviceDescription, serviceDate } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'mxn',
      capture_method: 'manual',
      payment_method_types: ['card'],
    });

  const orderId = randomUUID();

  async function generateUniqueCode() {
      for (let i = 0; i < 6; i++) {
        const code = randomBytes(8).toString('base64url')
          .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
        const { rows } = await pool.query('SELECT 1 FROM orders WHERE public_code = $1', [code]);
        if (rows.length === 0) return code;
      }
      throw new Error('Could not generate unique public code');
    }
    const publicCode = await generateUniqueCode();

    await pool.query(
      `INSERT INTO orders
       (id, payment_intent_id, amount, client_name, service_description, service_date, status, public_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [orderId, paymentIntent.id, amount, clientName || null, serviceDescription || null,
       serviceDate || null, 'pending', publicCode]
    );

  // Respond to Sheets
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

// 📦 Updated order fetch with client_secret
// 📦 Order fetch (no client_secret returned)
// 📦 Order fetch (includes client_secret again so pay.html can confirm)
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
  const { rows } = await pool.query('SELECT id FROM orders WHERE public_code = $1', [code]);
  if (!rows[0]) return res.status(404).send('Not found');
  res.redirect(302, `/pay?orderId=${rows[0].id}`);
});


// 📡 Stripe Webhook handler
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
