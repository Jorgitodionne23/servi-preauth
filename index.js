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

async function main() {
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
        id: orderId,
        paymentIntentId: paymentIntent.id,
        amount,
        status: "created",
      });
      await db.write();

      res.send({
        clientSecret: paymentIntent.client_secret,
        orderId,
      });
    } catch (error) {
      res.status(400).send({ error: error.message });
    }
  });

  // ✅ Webhook handler
  app.post("/webhook", (request, response) => {
    const sig = request.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.log(`❌ Webhook signature verification failed: ${err.message}`);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      console.log(`✅ PaymentIntent succeeded: ${paymentIntent.id}`);

      const order = db.data.orders.find(
        (o) => o.paymentIntentId === paymentIntent.id
      );
      if (order) {
        order.status = "succeeded";
        db.write();
      }
    } else {
      console.log(`Unhandled event type: ${event.type}`);
    }

    response.send();
  });

  app.listen(4242, () => console.log("Server running on http://localhost:4242"));
}

main();
