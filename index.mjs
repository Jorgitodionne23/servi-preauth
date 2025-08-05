// index.mjs (ES Module version of your server)
import 'dotenv/config';
import express from 'express';
import StripePackage from 'stripe';
import path from 'path';
import db from './db.mjs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const stripe = StripePackage(process.env.STRIPE_SECRET_KEY);

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
    db.run(
  `INSERT INTO orders (id, payment_intent_id, amount, status)
   VALUES (?, ?, ?, ?)`,
  [orderId, paymentIntent.id, amount, 'pending'],
  (err) => {
    if (err) console.error('DB insert error:', err.message);
  }
);


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
app.get('/order/:orderId', (req, res) => {
  db.get(
    `SELECT * FROM orders WHERE id = ?`,
    [req.params.orderId],
    async (err, row) => {
      if (err) {
        console.error('DB fetch error:', err.message);
        return res.status(500).send({ error: 'Internal server error' });
      }
      if (!row) return res.status(404).send({ error: 'Order not found' });

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(row.payment_intent_id);
        row.client_secret = paymentIntent.client_secret; // ✅ Add secret to response
        res.send(row);
      } catch (err) {
        console.error('Stripe fetch error:', err.message);
        res.status(500).send({ error: 'Failed to retrieve PaymentIntent' });
      }
    }
  );
});


// 📡 Stripe Webhook handler
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/webhook', (req, res) => {
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
      db.run(
        `UPDATE orders SET status = ? WHERE payment_intent_id = ?`,
        ['Confirmed', paymentIntentId],
        (err) => {
          if (err) console.error('DB update error:', err.message);
        }
      );
      break;

    case 'payment_intent.payment_failed':
      console.log('❌ PaymentIntent failed:', paymentIntentId);
      db.run(
        `UPDATE orders SET status = ? WHERE payment_intent_id = ?`,
        ['Failed', paymentIntentId],
        (err) => {
          if (err) console.error('DB update error:', err.message);
        }
      );
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
