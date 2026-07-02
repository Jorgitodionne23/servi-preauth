# SERVI Preauth

Backend, payments, and admin tooling for **SERVI** — an on-demand home services platform for Santa Fe, Cuajimalpa de Morelos (CDMX). Customers request services on the website; SERVI Admin matches a verified specialist; payment is **pre-authorized** on a Stripe card hold and captured after the service is complete.

> Full project context — design system, service categories, bilingual conventions, page-by-page architecture — lives in [`CLAUDE.md`](./CLAUDE.md). Read that first if you're new to the project.

---

## How It Works

1. Customer submits a service request via the website (`index.html` → booking flow) **or** contacts SERVI on WhatsApp.
2. SERVI Admin reviews the request in **`admin.html`** (the primary admin dashboard) — or in the legacy Google Sheets / Apps Script tool — matches a provider, and creates an order in the backend.
3. The backend creates a Stripe **PaymentIntent** in manual-capture mode (pre-auth).
4. The customer receives a payment link via WhatsApp.
   - First-time card: customer pays on **`pay.html`** (Stripe Elements).
   - Returning customer with saved card: 1-click confirm on **`book.html`**.
5. The card is **held, not charged**. After the service is delivered, admin captures the payment.
6. Saved-card customers are auto-pre-authorized 24 h before their appointment by an hourly trigger (`/tasks/preauth-due`).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js / Express 5 (ES modules) on **Render** (Docker) |
| Database | **Neon** (serverless PostgreSQL) via `pg` Pool |
| Payments | **Stripe** — pre-auth (manual capture), saved cards, off-session, 3DS fallback |
| Auth | **Firebase Auth** (frontend identity) + custom HS256 session JWT (backend) |
| File storage | **Cloudflare R2** (S3-compatible) — voice/photo/video attachments on service requests |
| Frontend | Static HTML + vanilla JS on **Cloudflare Pages** (no build step) |
| Admin (primary) | `frontend/admin.html` — token-protected dashboard backed by `/api/admin/*` routes |
| Admin (legacy) | Google Apps Script + Sheets — still active for order creation and the auto-preauth cron until fully migrated |

---

## Project Structure

```
backend/
  index.mjs          — all server routes and business logic (~10.1k lines)
  db.pg.mjs          — PostgreSQL schema (CREATE TABLE IF NOT EXISTS) + connection pool
  pricing.mjs        — alpha-curve booking fee + Stripe processing fee with VAT

frontend/
  index.html         — landing page (hero, categories, how-it-works, testimonials)
  smart-request.html — standalone Smart Request intake (describe / show / say what you need)
  browse.html        — service category browser
  service.html       — individual service request flow (describe + schedule)
  account.html       — auth-guarded profile, addresses, payment methods, delete account
  email-verified.html — post-email-verification landing page
  partners.html      — partner signup hub  +  partners/registro.html (application form)
  handbook.html      — provider guide index  +  handbook/ subpages
  helpcenter.html    — support index  +  helpcenter/ subpages
  legal.html         — términos, privacidad, cancelación, aviso legal
  provider.html      — specialist's per-order tracking panel (tokenized link, no login)
  admin.html         — primary admin dashboard (inbox + orders, token-protected)
  pay.html           — Stripe Elements payment form (first-time card)
  book.html          — saved-card 1-click checkout
  success.html       — post-payment confirmation
  save.html          — standalone card / account management
  link-expired.html  — shown when a payment link has expired
  config.js          — runtime config (API_BASE, Stripe publishable key, Firebase config, WhatsApp number)
  smart-request/     — Smart Request app (catalog.js, heuristic.js, parse.js, sr-app.js, sr-icons.js, sr-styles.css)
  shared/            — shared-styles.css, landing-theme.css, shared-auth.js,
                       shared-nav.js, shared-footer.js, morphing-nav.js,
                       i18n.js (ES/EN), browse-data.js, address-form.js,
                       shared-active-order.js, contact-cta.js, motion.js

functions/
  _middleware.js     — Cloudflare Pages middleware (injects Firebase API key into config.js at edge)

apps-script/         — local mirror of the live Google Apps Script (synced via clasp)
  Code.js            — order creation, payment links, capture/cancel, auto-preauth trigger
  webhook.js         — receives backend status updates and writes to the Sheet

apps-script-provider-recruitment/
                     — separate Apps Script utility for generating provider IDs

docs/                — AUTH_STATE_MACHINE.md, AUTH_AUDIT.md, session-handoff.md, etc.
tests/               — Playwright e2e suites (admin, auth) + preflight script

native-app-reference/  — Expo + React Native + TypeScript prototype of a SERVI native
                         mobile app. Mocked data only; isolated from the web app. Not
                         production — kept as a design reference.
dashboard.jsx          — Standalone React artifact from an admin-dashboard redesign
                         (Claude-generated). Visual ideas are ported into admin.html;
                         this file is kept as a reference only.
```

---

## Environment Variables

There is no committed `.env.example` — copy the table below into your local `.env`. **Local dev uses Stripe test keys.** Production keys live on Render and Cloudflare Pages and are not stored in the repo.

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_live_...` in prod, `sk_test_...` locally) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) — for local dev, get it from `stripe listen --forward-to localhost:4242/webhook` (or run `npm run stripe:listen`) |
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `ADMIN_API_TOKEN` | Yes | Shared secret for `/api/admin/*` Bearer auth |
| `FRONTEND_BASE_URL` | Yes | Cloudflare Pages URL — used to build payment links |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Yes (prod) | Firebase Admin SDK service account JSON — required to verify Firebase ID tokens and check revocation |
| `JWT_SECRET` | Yes (prod) | Secret used to sign the custom session JWT. Must be set on Render; backend throws at startup in production if missing |
| `ANTHROPIC_API_KEY` | Yes (prod) | Backend-only Claude API key for Smart Request text parsing (`POST /api/parse-request`). When missing, the request falls back to a client-side heuristic |
| `SHEETS_WEBHOOK_URL` | Optional | Google Apps Script exec URL for legacy Sheet sync |
| `R2_ACCOUNT_ID` | Optional | Cloudflare R2 — for service request file uploads |
| `R2_ACCESS_KEY_ID` | Optional | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Optional | Cloudflare R2 secret |
| `R2_BUCKET_NAME` | Optional | Cloudflare R2 bucket |
| `R2_PUBLIC_URL` | Optional | Public base URL for R2-hosted files |
| `CORS_ALLOWLIST` | Optional | Extra comma-separated allowed origins |
| `NODE_ENV` | Yes | `production` on Render; anything else locally |
| `ALLOW_INSECURE_DB_TLS` | Dev only | Setting `true` while `NODE_ENV=production` throws at startup |

---

## Running Locally

```bash
npm install
# Create .env with values from the table above
npm start
```

The server starts on port `4242` (override with `PORT`). Express also serves the static `frontend/` folder on the same port, so the frontend points at `window.location.origin` in dev.

### Useful scripts

```bash
npm start                    # run the backend (also serves frontend)
npm run emulators:auth       # start the Firebase Auth emulator (port 9099)
npm run start:auth-emulator  # run backend against the local Auth emulator
npm run test:e2e             # Playwright end-to-end suite (auth + admin)
npm run test:e2e:install     # install the Chromium browser Playwright needs
```

---

## Branches & Deployment

- **`main`** — production. Pushing here triggers an automatic Render deploy (backend) and a Cloudflare Pages deploy (frontend). Kept intentionally behind `dev` until a release is planned.
- **`dev`** — active development / staging. All day-to-day work happens here. Auto-deploys to the Render staging service.

Workflow: develop on `dev`, then open a PR from `dev` into `main` when ready to ship. Each environment has its own Stripe / Firebase / database keys set permanently in its dashboard — no manual key swapping.

> If you see references to a `feature/servi-platform` branch anywhere, they're stale. That branch was deleted.

---

## Authentication (Dual-Auth Model)

Identity is handled by **Firebase Auth** on the frontend; sessions are issued by the SERVI backend.

1. User signs in with Firebase (phone OTP, email magic link, or Google).
2. Frontend posts the resulting **Firebase ID token** to `POST /api/auth/firebase`.
3. Backend verifies the token via the Firebase Admin SDK (`verifyIdToken(token, checkRevoked=true)`), then issues a **custom HS256 JWT** (24-hour TTL) signed with `JWT_SECRET`.
4. The custom JWT is stored in `localStorage` as `servi_user_session` and sent on every protected request as `Authorization: Bearer …`.
5. `POST /api/auth/refresh` rotates a near-expired JWT (new `jti`). Logout, account deletion, and identifier changes insert into `revoked_sessions` so old tokens fail server-side.

A `401 { error: 'token_revoked' | 'user_disabled' | 'invalid_token' }` from the backend tells the frontend to clear `localStorage`, call `auth.signOut()`, and rebuild the navbar — this is the normal recovery path, not a bug.

The booking gate (`POST /api/service-requests`) always requires `phone_verified=true`. `email_verified=true` is required for returning users (anyone with prior service activity); a brand-new user who skipped email at signup may place their **first** order with phone-only, then must verify email for subsequent orders.

Full design lives in [`docs/AUTH_STATE_MACHINE.md`](./docs/AUTH_STATE_MACHINE.md). Past hardening work is recorded in [`docs/AUTH_AUDIT.md`](./docs/AUTH_AUDIT.md) and [`docs/session-handoff.md`](./docs/session-handoff.md) (historical snapshots — not living docs).

---

## Apps Script (Legacy, Migration In Progress)

`apps-script/` is a **local mirror** of the live Google Apps Script project. It is **not** auto-deployed — changes must be pushed via `clasp` and the active deployment manually advanced.

```bash
# First-time
npm install -g @google/clasp
clasp login

# Pull the live version into the local mirror
cd apps-script && clasp pull

# Push local changes to the live project
cd apps-script && clasp push
```

After pushing, open the Apps Script editor → Deploy → Manage deployments → New version, and update the active deployment.

`admin.html` is now the primary admin tool. Apps Script remains in use for order creation and the hourly auto-preauth trigger until the migration to `admin.html` + `/api/admin/*` is complete.

---

## Key Concepts

**Pre-authorization.** A hold placed on the customer's card without actually charging it. The hold expires after ~7 days; the admin captures (charges) it after the service is complete.

**Off-session charges.** Customers who consent to saving their card can be charged automatically for future bookings. The hourly `autoPreauthScheduled_` trigger (Apps Script) and the `/tasks/preauth-due` endpoint scan saved-card orders that have entered the 24-hour window and call `/confirm-with-saved`.

**Order kinds:**
- `primary` — standard order with a payment form
- `book` — saved-card order (no card entry, pre-auth created automatically)
- `setup` / `setup_required` — needs the card to be saved (and consent) before pre-auth can run
- `adjustment` — fee correction linked to a parent order

**Pricing.** `computePricing()` in `pricing.mjs`: provider price → alpha-curve booking fee → Stripe processing fee → VAT → total. Visit pre-auth uses fixed pricing ($140 MXN total, $90 provider).
