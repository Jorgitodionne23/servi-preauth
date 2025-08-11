/* eslint-env node */
// index.mjs (ES Module version of your server)
import 'dotenv/config';
import express from 'express';
import StripePackage from 'stripe';
import path from 'path';
import db from './db.mjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import { randomUUID } from 'crypto';

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const stripe = StripePackage(process.env.STRIPE_SECRET_KEY);
const GOOGLE_SCRIPT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbweLYI8-4Z-kW_wahnkHw-Kgmc1GfjI9-YR6z9enOCO98oTXsd9DgTzN_Cm87Drcycb/exec'

// 📦 General middleware
app.use(express.json());
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
// Save row (now passing serviceDate and status correctly)
  db.prepare(`
    INSERT INTO orders (
      id,
      payment_intent_id,
      amount,
      client_name,
      service_description,
      service_date,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    paymentIntent.id,
    amount,
    clientName || null,
    serviceDescription || null,
    serviceDate || null,   // <- was missing
    'pending'
  );

  // Respond to Sheets
  res.send({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
    orderId,
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

    const row = db.prepare(`
      SELECT 
        id,
        payment_intent_id,
        amount,
        client_name,
        service_description,
        service_date,
        status,
        created_at
      FROM orders
      WHERE id = ?
    `).get(orderId);

    if (!row) return res.status(404).send({ error: 'Order not found' });

    // add client_secret back for the payment page
    const pi = await stripe.paymentIntents.retrieve(row.payment_intent_id);
    res.send({ ...row, client_secret: pi.client_secret });
  } catch (err) {
    console.error('Error retrieving order:', err.message);
    res.status(500).send({ error: 'Internal server error' });
  }
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
    case 'charge.succeeded':
      console.log('✅ Charge succeeded:', paymentIntentId);
      db.prepare(`UPDATE orders SET status = ? WHERE payment_intent_id = ?`)
        .run('Confirmed', paymentIntentId);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentIntentId, 
          status: 'Confirmed' })
      }).catch(console.error);

      break;

    case 'payment_intent.payment_failed':
      console.log('❌ PaymentIntent failed:', paymentIntentId);
      db.prepare(`UPDATE orders SET status = ? WHERE payment_intent_id = ?`)
        .run('Failed', paymentIntentId);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentIntentId, 
          status: 'Failed' })
      }).catch(console.error);

      break;

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
