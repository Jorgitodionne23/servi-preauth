# SERVI Preauth

Stripe payment pre-authorization system for SERVI — a Spanish-language home services marketplace in Mexico.

## How It Works

1. Admin creates an order via Google Sheets (Apps Script button) → backend creates a Stripe PaymentIntent
2. Customer receives a payment link → fills card details on `pay.html` → card is pre-authorized (not yet charged)
3. After the service is completed, admin captures the payment from the Sheet
4. Clients who save their card can book future orders via `book.html` (1-click, no card entry needed)
5. Saved-card orders are pre-authorized automatically when the service appointment enters the 24-hour window

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js / Express (ES modules) on Render |
| Database | PostgreSQL on Neon |
| Payments | Stripe (pre-auth / manual capture) |
| Admin dashboard | Google Apps Script + Google Sheets |
| Frontend | Static HTML on Cloudflare Pages |

---

## Project Structure

```
backend/
  index.mjs          — all server routes and business logic
  db.pg.mjs          — PostgreSQL schema and connection pool
  pricing.mjs        — fee calculation logic

frontend/
  pay.html           — customer payment form (first-time card entry)
  book.html          — 1-click checkout for clients with a saved card
  success.html       — post-payment confirmation page
  save.html          — customer account / card management
  link-expired.html  — shown when a payment link has expired
  config.js          — runtime config (API_BASE, Stripe publishable key, WhatsApp number)

apps-script/         — synced to live Apps Script via clasp (see Apps Script section below)
  Code.js            — main Sheet integration (order creation, capture, cancel, etc.)
  webhook.js         — receives status updates from backend and writes to Sheet

apps-script-provider-recruitment/
                     — separate Apps Script utility for generating provider IDs
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values before running locally.

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_live_...` or `sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ADMIN_API_TOKEN` | Yes | Shared secret for admin API routes |
| `FRONTEND_BASE_URL` | Yes | URL of the Cloudflare Pages deployment |
| `SHEETS_WEBHOOK_URL` | Yes | Google Apps Script exec URL for Sheet sync |
| `CORS_ALLOWLIST` | No | Extra comma-separated allowed origins |
| `NODE_ENV` | Yes | Set to `production` on Render |

---

## Running Locally

```bash
npm install
cp .env.example .env
# Fill in .env values
npm start
```

The server starts on port `3000` by default.

---

## Deployment

The backend is deployed to **Render** as a Docker container. Every push to `main` triggers a new deploy automatically.

The frontend is deployed to **Cloudflare Pages** from the `frontend/` folder.

---

## Apps Script

The `apps-script/` folder contains **local mirrors** of the live Google Apps Script project. They are not deployed automatically — changes must be manually pasted into the live Apps Script editor and redeployed as a new version.

### Syncing changes with clasp (recommended)

`clasp` is Google's command-line tool for managing Apps Script projects.

**First-time setup:**
```bash
npm install -g @google/clasp
clasp login
```

**To pull the latest live version into the local mirror:**
```bash
cd apps-script
clasp pull
```

**To push local changes to the live project:**
```bash
cd apps-script
clasp push
```

After pushing, open the Apps Script editor, create a new version (Deploy → Manage deployments → New version), and update the active deployment to that version.

> The Script ID can be found in the Apps Script editor under Project Settings.

---

## Key Concepts

**Pre-authorization:** A hold placed on a customer's card without actually charging it. The hold expires after ~7 days. The admin captures (charges) it after the service is complete.

**Off-session charges:** Customers who consent to saving their card can be charged automatically for future bookings without being present. The `autoPreauthScheduled_` trigger in Apps Script handles this by calling `/confirm-with-saved` when an appointment enters the 24-hour window.

**Order kinds:**
- `primary` — standard order with a payment form
- `book` — saved-card order (no card entry, pre-auth created automatically)
- `adjustment` — fee correction linked to a parent order
