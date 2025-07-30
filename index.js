// Triggering Render deploy
require("dotenv").config();
const express = require('express');
const Stripe = require('stripe');
const path = require('path');
const app = express();

// ✅ Use secret key from .env instead of hardcoding
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(express.json());
app.use(express.static('public'));

// Create PaymentIntent with manual capture
app.post('/create-payment-intent', async (req, res) => {
  const { amount } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      capture_method: 'manual',
      payment_method_types: ['card'],
    });
    res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Serve pay.html with embedded client_secret from URL
app.get('/pay', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

app.listen(4242, () => console.log('Server running on http://localhost:4242'));
