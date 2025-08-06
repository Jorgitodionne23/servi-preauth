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
import Database from 'better-sqlite3';

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const stripe = StripePackage(process.env.STRIPE_SECRET_KEY);
const GOOGLE_SCRIPT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbweLYI8-4Z-kW_wahnkHw-Kgmc1GfjI9-YR6z9enOCO98oTXsd9DgTzN_Cm87Drcycb/exec'; // ✅ Replace with your actual deployed Google Web App URL


// 🧠 Webhook-specific middleware: must go before express.json()
app.use('/webhook', express.raw({ type: 'application/json' }));

// 📦 General middleware
app.use(express.json());
app.use(express.static('public'));

// 🎯 Create PaymentIntent
app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'mxn',
      capture_method: 'manual',
      payment_method_types: ['card'],
    });

    const orderId = `ORD-${Date.now()}`;
    db.prepare(`
      INSERT INTO orders (id, payment_intent_id, amount, status)
      VALUES (?, ?, ?, ?)
    `).run(orderId, paymentIntent.id, amount, 'pending');


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
app.get('/order/:orderId', async (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.orderId);

    if (!row) {
      return res.status(404).send({ error: 'Order not found' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(row.payment_intent_id);
    row.client_secret = paymentIntent.client_secret;

    res.send(row);
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

  const paymentIntentId = event.data.object.id;

  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('✅ PaymentIntent succeeded:', paymentIntentId);
      db.prepare(`UPDATE orders SET status = ? WHERE payment_intent_id = ?`)
        .run('Confirmed', paymentIntentId);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, status: 'Confirmed' })
      }).catch(console.error);

      break;

    case 'payment_intent.payment_failed':
      console.log('❌ PaymentIntent failed:', paymentIntentId);
      db.prepare(`UPDATE orders SET status = ? WHERE payment_intent_id = ?`)
        .run('Failed', paymentIntentId);

      fetch(GOOGLE_SCRIPT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId, status: 'Failed' })
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
