// Triggering Render deploy
require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const path = require("path");
const app = express();

// ✅ Use secret key from .env
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// — In-memory store for orders (swap for a DB in prod) —
const orders = {};

app.use(express.json());
app.use(express.static("public"));

// Create PaymentIntent with manual capture + generate a real orderId
app.post("/create-payment-intent", async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      capture_method: "manual",
      payment_method_types: ["card"],
    });

    // Generate a unique order ID
    const orderId = `ORD-${Date.now()}`;

    // Store the minimal order record
    orders[orderId] = {
      paymentIntentId: paymentIntent.id,
      amount,
      status: "pending",
    };

    // Send clientSecret + our new orderId back to the frontend
    res.send({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderId,
    });
  } catch (err) {
    console.error("Error creating payment intent:", err);
    res.status(400).send({ error: err.message });
  }
});

// Serve your payment page
app.get("/pay", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pay.html"));
});

// (Optional) expose an endpoint to fetch order details by orderId
app.get("/order/:orderId", (req, res) => {
  const order = orders[req.params.orderId];
  if (order) {
    return res.send(order);
  }
  res.status(404).send({ error: "Order not found" });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
