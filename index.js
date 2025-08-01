require("dotenv").config();
const express = require("express");
const Stripe = require("stripe");
const path = require("path");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const app = express();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Setup lowdb
const db = new Low(new JSONFile("db.json"));
await db.read();
db.data ||= { orders: [] };

// 🧠 Webhook-specific middleware: must go before express.json()
app.use("/webhook", express.raw({ type: "application/json" }));

// 📦 General middleware
app.use(express.json());
app.use(express.static("public"));

// 🎯 Create PaymentIntent with manual capture
app.post("/create-payment-intent", async (req, res) => {
  const { amount } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "mxn",
      capture_method: "manual",
      payment_method_types: ["card"],
    });

    const orderId = `ORD-${Date.now()}`;
    db.data.orders.push({
      orderId,
      paymentIntentId: paymentIntent.id,
      amount,
      status: "pending",
    });
    await db.write();

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

// 📄 Serve payment form
app.get("/pay", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pay.html"));
});

// 🔍 Fetch order by ID
app.get("/order/:orderId", async (req, res) => {
  await db.read();
  const order = db.data.orders.find((o) => o.orderId === req.params.orderId);
  if (order) return res.send(order);
  res.status(404).send({ error: "Order not found" });
});

// 📡 Webhook handler
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
app.post("/webhook", (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "payment_intent.succeeded":
      const paymentIntent = event.data.object;
      console.log("✅ PaymentIntent succeeded:", paymentIntent.id);
      break;

    case "payment_intent.payment_failed":
      console.log("❌ PaymentIntent failed:", event.data.object.id);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).send("Webhook received");
});

// 🚀 Start server
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
