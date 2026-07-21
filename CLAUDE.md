# SERVI — Project Brief for Claude Code

## What is SERVI?

SERVI is an on-demand home services platform based in **Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX**. Think of it as "Uber for home services" — users request services like cleaning, plumbing, electrical work, personal care, and more. SERVI matches them with verified specialists ("SERVI Partners").

**Current state:** The web application is live with authentication, service request booking, an admin dashboard, and Stripe payment processing (pre-authorization model). Admin still manually matches providers and creates payment links.

**Contact info:**

- Email: serv.clientserv@gmail.com
- Location: Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX
- WhatsApp: (525525112588)

---

## Design Direction

### Brand Identity

- **Name:** SERVI
- **Headline font:** Not final
- **Body font:** Not final
- **Colors:** Not final
- **Logo:** logo-servi-white.png
- **Design philosophy:** Completely fresh redesign. Do NOT use the old Canva site's illustrations, mascots, monospace fonts, or rounded cartoon aesthetic. This is a professional, Uber-caliber product.

### UI Patterns

- Cards with subtle borders (#e8e8e8), 16px border-radius, hover lift + shadow
- Buttons: primary (black, 12px radius), secondary (outlined)
- Inputs: 1.5px border, 12px radius, clean focus states
- Modals: 24px radius, backdrop blur, slide-up animation
- Full-screen booking panel for the service request flow
- Sticky navbar with scroll-aware background blur
- Smooth section dividers (gradient line)
- Mobile-responsive with hamburger menu at 900px breakpoint

**Customer-facing pages:** Uber-inspired, minimalist, generous whitespace, typography-driven, light theme, smooth animations (fadeUp, slideUp), bilingual ES/EN, Spanish default.

**Admin dashboard + payment pages:** Dark theme, Inter font. DO NOT RESTYLE payment pages.

---

## Bilingual (ES/EN)

The entire application must support **Spanish and English** with a toggle in the navbar. Spanish is the default language. All content, labels, CTAs, error messages, and booking flow text must exist in both languages.

---

## Service Categories

SERVI offers 5 main categories + a custom/catch-all option:

1. **Limpieza / Clean** — Home, office, garden care and cleaning services
2. **Armar, Reparar y Mantenimiento / Build, Repair & Maintenance** — Plumbing, electrical, technical repairs, installations, structural fixes
3. **Bienestar y Cuidado Personal / Wellness & Personal Care** — Personal care services delivered at home
4. **Mantenimiento / Maintenance** — Preventive maintenance and installations
5. **Abastecimiento y Compras / Supply & Shopping** — Deliveries, grocery runs, errands, product sourcing
6. **Personalizado / Custom** — "Describe it and we'll find it" — catch-all for requests that don't fit a category

---

## Core User Flows

### Service Booking

1. **Smart Request** (`index.html` + `frontend/smart-request/`) — Primary landing-page request flow. Users can describe, show, or say what they need; text parsing goes through `POST /api/parse-request` and falls back to the client heuristic.
2. **Browse / Smart search** (`browse.html`) — Choose from the service catalog or search. No login required.
3. **Describe + Schedule** (`service.html`) — Individual service pages still support free-text description + "ASAP" or scheduled date/time.
4. **Address + Confirm** — Enter full address, review summary, confirm. **Login required** (Firebase phone OTP, email magic link, or Google Sign-In). Logged-in users get name/phone/email pre-filled.

After confirmation: "¡Solicitud enviada! Te contactaremos pronto por WhatsApp." Admin manually matches a provider and creates a payment link.

### Authentication

- Auth methods: Phone OTP (Firebase), Email magic link (Firebase), Google Sign-In (popup)
- Unified identifier input — single field, auto-detects phone vs email
- Signup collects: phone or email (primary) → name → secondary identifier (optional)
- **Dual-auth model:** Firebase handles user identity on the frontend (phone OTP, email magic link, Google OAuth). The frontend posts the Firebase ID token to `POST /api/auth/firebase`; the backend verifies it via the Firebase Admin SDK and issues its own **custom HS256 session JWT (24-hour TTL)**. Clients send that JWT as `Authorization: Bearer …` for all `/api/auth/*` and other user-scoped routes.
- Session refresh + revocation: `POST /api/auth/refresh` rotates a near-expired JWT (new `jti`); logout, account deletion, and password/phone changes write to the `revoked_sessions` table so old tokens fail server-side immediately.
- Booking gate: `phone_verified=true` is always required. `email_verified=true` is required for returning users (those with prior service activity); a brand-new user who skipped email at signup may place their **first** order with phone-only, then must verify email for subsequent orders. Enforced in `POST /api/service-requests` (`backend/index.mjs`)
- Cross-identifier recovery merges orphaned phone-only accounts when email is added

### SERVI Match

After a request is confirmed, SERVI Admin team assigns a verified specialist based on availability. Users are notified when matched.

### Provider Onboarding

- Separate section/flow for service providers ("SERVI Partners")
- Partners can apply for free to offer their services through SERVI

---

## Page Structure

### Landing Page (single-page scroll)

1. **Hero** — Headline + CTA to request a service
2. **Service Categories** — 6 interactive cards
3. **How It Works** — 3-step visual
4. **Why SERVI** — Value proposition + stats
5. **Testimonials** — 3 customer reviews
6. **Providers Section** — Dark background CTA for partners
7. **Contact** — Address, email, WhatsApp
8. **Footer** — 4-column links (SERVI, Partners, Help Center, Legal)

### Footer Link Columns

**SERVI:** Solicita, Qué ofrecemos, Cómo funciona, App, Testimonios
**Partners:** Quiero ser partner, Qué es ser Partner, Cómo ser Partner, Handbook
**Help Center:** Reportar/sugerencia, Quiénes Somos, Contáctanos
**Legal:** Términos, Privacidad, Política de Cancelación, Aviso Legal

---

## Existing System Architecture (READ THIS CAREFULLY)

This is NOT a simple payment form. It's a complete **admin-driven order management platform** with sophisticated payment orchestration. Understand the full system before changing anything.

### Payment Flow (Admin-Initiated)

1. Customer submits service request via website OR contacts via WhatsApp
2. Admin reviews request, matches provider, creates order in **admin dashboard** (`admin.html`) or Google Sheets (legacy)
3. Backend creates Stripe PaymentIntent (manual capture / pre-auth)
4. Customer receives **payment link via WhatsApp**
5. Customer pays on `pay.html` (new card) or confirms on `book.html` (saved card, 1-click)
6. Card is **pre-authorized** (hold, not charged)
7. After service completion, admin **captures** the payment
8. Saved-card customers get auto-pre-authorized 24h before service via hourly trigger

### Deployment Topology

| Layer | Host | Details |
|-------|------|---------|
| Backend | **Render** (Docker) | `node backend/index.mjs`, auto-deploys on push to `main` |
| Frontend | **Cloudflare Pages** | Static HTML from `frontend/` folder |
| File Storage | **Cloudflare R2** | S3-compatible, for video/audio/image uploads |
| Database | **Neon** (PostgreSQL) | Serverless Postgres, `pg` Pool connection |
| Admin (legacy) | **Google Apps Script** | Container-bound to Google Sheet, synced via `clasp` — still active for order creation and auto-preauth triggers; migration to `admin.html` in progress |
| Payments | **Stripe** | Pre-auth (manual capture), saved cards, off-session, 3DS fallback |
| Auth | **Firebase** | Phone OTP, email magic link, Google OAuth (free tier) |

### Backend (`backend/`)

- **Runtime:** Node.js with ES modules (`.mjs` extensions only)
- **Framework:** Express 5
- **Entry point:** `backend/index.mjs` — all Express routes and most business logic in one file (~10,100 lines). A handful of pure helpers have been extracted into sibling modules (below).
- **Database:** `backend/db.pg.mjs` — Pool connection + full schema (`CREATE TABLE IF NOT EXISTS`). See this file for authoritative table definitions.
- **Pricing:** `backend/pricing.mjs` — Dynamic fee calculation (alpha curve for booking fees, Stripe processing fees with VAT)
- **Ops radar:** `backend/ops-radar.mjs` — Order-severity classification/sorting used by the admin ops feed (`classifyOrderOps`, `sortOpsItems`, `summarizeOps`).
- **Provider link expiry:** `backend/providerLink.mjs` — Policy for when a per-order `provider.html?pt=…` token stops being honored (grace window after service, fallback lifetime for ASAP orders).
- **Smart Request helpers:** `backend/smartRequestCatalog.mjs` (server-side mirror of the frontend catalog) and `backend/smartRequestParse.mjs` (prompt builders + response validation for the Anthropic parse call).
- **Timezone:** `backend/timezone.mjs` — Sets `process.env.TZ` from `APP_TIME_ZONE` (defaults to `America/Mexico_City`) so all server-side date math is in CDMX time.
- **Unit tests:** `backend/*.test.mjs` run via `npm run test:unit` (node:test); Playwright e2e suites live in `tests/`.
- **TLS guard:** `ALLOW_INSECURE_DB_TLS=true` throws at startup if `NODE_ENV=production`
- **Admin auth:** Bearer token via `ADMIN_API_TOKEN` env var, constant-time comparison
- **Webhook:** Stripe webhook at `/webhook` with raw body parsing + signature verification
- **Google Sheets sync:** Outbound POST to Apps Script web app URL for status updates (legacy, `SHEETS_WEBHOOK_URL`)
- **Smart Request AI parse:** `POST /api/parse-request` proxies Claude Haiku via `@anthropic-ai/sdk` using `ANTHROPIC_API_KEY`; the browser never sees the key. `POST /api/service-requests` persists additive Smart Request metadata (`request_mode`, matched service/subkey, AI summary/confidence/source, detail answers).

### Key Backend Concepts

- **Order kinds:** `primary`, `book` (saved card), `setup` (needs card save), `setup_required` (needs consent + card), `adjustment` (child order for surcharges/corrections)
- **Pre-auth window (24h):** the hourly cron (`/tasks/preauth-due`, GitHub Actions) auto-authorizes saved cards **off-session** ~24h before service → `Confirmed`. The customer does nothing after booking.
- **Saved-card requirement (5 days):** orders booked **≥5 days out require a saved card + consent**; guests are blocked until they create an account / save a card. See **Booking Lead-Time Guardrails** below.
- **Link expiration:** Payment links expire after 2 hours; `retry_token` mints a fresh 2-hour link (used by `account.html` "My Orders" so a logged-in user can self-serve their own pending order).
- **Consent system:** Per-order audit (`consented_offsession_bookings`) + per-customer registry (`saved_servi_users`)
- **Cash exception:** First-time customers can opt for cash via `/orders/:id/choose-cash`
- **Pricing engine:** `computePricing()` in `pricing.mjs` — provider price → alpha-curve booking fee → Stripe processing fee → VAT → total. Visit pre-auth has fixed pricing ($140 MXN total, $90 provider)
- **Admin endpoints:** All `/api/admin/*` routes are in `backend/index.mjs` (orders list/detail/stats, reports, partner applications, capture/cancel/refund)

### Booking Lead-Time Guardrails (Pre-Auth Timing)

**Why this exists:** A Stripe card hold (pre-authorization) is only valid for ~7 days before the bank releases it. So SERVI **never places a hold more than ~5 days early**, and it refuses to accept an order it could not eventually hold. Everything below follows from that one constraint.

**Two thresholds drive the whole model:**

- **5 days (120h) — the "saved card required" line.**
- **24 hours — the "automatic pre-auth" line.**

**Special rule — Visits (`bookingKey='visita'`):** a visit-to-quote **always requires an account with a saved card, at any lead time**. A visit with no saved card is immediately `Blocked` / `setup_required` — the 5-day / 24h thresholds below don't apply to it.

**Saved-card users** (= a Stripe customer with a card on file **AND** a recorded off-session consent/mandate in `saved_servi_users` / `consented_offsession_bookings`). A saved card **without** recorded consent is *not* enough — the order is routed through a `setup` flow to collect consent first:

- Can book at **any** lead time. The order is created as kind `book`, status `Scheduled` — **no hold is placed yet**.
- The hourly cron (`/tasks/preauth-due`) automatically pre-authorizes the saved card **off-session ~24h before** the service → `Confirmed`. The user does nothing after booking.
- The "wait until ~24h before" deferral only applies when the service is **more than 24h away at booking time**. If they book a service that is already **<24h away**, there is nothing to wait for — an immediate `primary` PaymentIntent is created to confirm on the spot instead of being scheduled.

**Guests / users without a saved card:**

- **Less than 5 days out:** allowed. A PaymentIntent is created **immediately** (kind `primary`); the customer authorizes their card on `pay.html` right away. The hold is placed now and lasts long enough (~7 days) to reach the service date.
- **5 or more days out:** **blocked** as a guest (`status='Blocked'`, `kind='setup_required'`). They must create an account + save a card (consent) → kind `setup` (SetupIntent) → and from then on they follow the saved-card flow above.

**In one line:** holds are deferred to 24h before service for saved cards; guests must pay up front and can only do so when the service is <5 days away; anything ≥5 days away requires a saved card.

**Links / self-service:** payment links expire after 2h; `retry_token` mints a fresh link. `account.html` "My Orders" lets a logged-in user re-open and pay their own pending/`Scheduled` order directly — no admin step needed.

> **Note (ignore for normal flow):** the code also contains a `≤72h` "early pre-auth" branch in `/confirm-with-saved` that can create/confirm a hold before the 24h window. This was built as a **manual/admin testing trigger** (simulating events) and is **not** part of the normal automatic user logic. The canonical model is the **5-day gate + 24h auto-auth** described above.

### Database

See `backend/db.pg.mjs` for the full schema. Key tables: `all_bookings`, `consented_offsession_bookings`, `saved_servi_users`, `auth_users`, `user_addresses`, `service_requests`, `providers`, `service_reports`, `partner_applications`, `revoked_sessions`.

### Frontend (`frontend/`)

**No framework. No build step. Plain static HTML + vanilla JS on Cloudflare Pages.**

#### Shared Components (`frontend/shared/`)

- `shared-styles.css` — Global design system (brand colors, components, animations)
- `landing-theme.css` — Extended CSS for landing/marketing pages (~123KB)
- `shared-auth.js` — Firebase auth flow (phone OTP, email magic link, Google OAuth, cross-identifier recovery — ~3,070 lines)
- `shared-nav.js` — Navigation bar (language toggle, auth state, user menu dropdown, mobile hamburger)
- `shared-footer.js` — 4-column footer component
- `morphing-nav.js` — Animated navbar variant used on landing page (~1,770 lines)
- `i18n.js` — Full Spanish/English translation system
- `browse-data.js` — Service category/provider data for browse and service pages
- `service-details.js` — Per-subcategory "tell us more" follow-up questions (bilingual chips + short text) shown in the `service.html` booking sidebar so admin gets dispatch context without interrogating the customer
- `address-form.js` — Shared structured CDMX-aware address form (`window.ServiAddress`) used by `account.html` saved-address book and `service.html` booking panel
- `shared-active-order.js` — Floating "active order" dock that surfaces a logged-in customer's ongoing/pending order on every customer-facing page (status + pay shortcut)
- `contact-cta.js` — Runtime rewrite of contact CTAs based on `window.CONFIG.CONTACT_MODE` (`'email'` vs `'whatsapp'`); single edit in `config.js` toggles every `wa.me` link site-wide
- `motion.js` — Declarative GSAP scroll-reveal + stat-counter motion layer; markup stays visible if GSAP CDN fails

**Navbar (customer-facing pages):** SERVI. logo, Servicios / Cómo funciona / Testimonios (index.html anchors), Partners, Help Center, ES/EN toggle, Login/Crear cuenta (or user avatar + dropdown if logged in), mobile hamburger at ≤900px.

**Navbar variants:** Help Center pages use a simplified nav; Partners/Handbook pages use a partner-branded nav.

**Footer (all pages):** 4 columns — SERVI, Partners, Help Center, Legal.

#### Customer-Facing Pages

- `index.html` — Landing page (hero, categories, how it works, testimonials, contact)
- `smart-request.html` — Standalone Smart Request page (describe / show / say what you need; backed by `frontend/smart-request/` + `POST /api/parse-request`)
- `browse.html` — Service category browser / discovery page
- `service.html` — Individual service request flow (describe + schedule)
- `account.html` — User account management (edit profile, saved addresses, delete account — auth-guarded)
- `email-verified.html` — Post-email-verification landing page
- `legal.html` — Legal terms (términos, privacidad, cancelación, aviso legal)
- `partners.html` — Partner signup hub
- `handbook.html` — Provider guide index → `handbook/` subpages (7 guide pages)
- `helpcenter.html` — Support index → `helpcenter/` subpages (4 pages including report/suggestion forms)
- `partners/registro.html` — Partner application form

#### Specialist (Provider) Page

- `provider.html` — **Panel del especialista**, a tokenized order-tracking page given to the assigned SERVI Partner for an individual order. Lets the specialist see job details, check in for each phase, propose price changes, and share live location. Backed by `/api/provider/order`, `/api/provider/checkin`, `/api/provider/price-change`, and `/api/provider/location` in `backend/index.mjs`. Authenticated via a per-order provider token (`pt`) in the link — no login.

#### Payment Pages (standalone dark theme — DO NOT RESTYLE)

- `config.js` — Runtime config (`window.CONFIG` with `API_BASE`, `STRIPE_PUBLISHABLE_KEY`, `WHATSAPP_NUMBER`, `FIREBASE_CONFIG`)
- `pay.html` — Card payment form (Stripe Elements, consent checkbox, terms, cash exception)
- `book.html` — Saved-card 1-click checkout (phone verification gate, 3DS fallback, billing portal)
- `success.html` — Post-payment confirmation (order summary, pricing breakdown)
- `save.html` — Standalone account/card management portal
- `link-expired.html` — Shown when payment link has expired

#### Admin Dashboard

- `admin.html` — **Primary admin interface** (token-protected, dark theme)
  - **Inbox tab:** Incident reports, suggestions, partner applications (filter by type/status)
  - **Orders tab:** All orders from `all_bookings` + pending web requests as "WEB-..." rows
  - Actions: Capture, Cancel, Refund (partial), View in Stripe Dashboard

**Frontend conventions:**

- Vanilla JS, direct DOM manipulation
- Stripe.js loaded via CDN
- Google Fonts via `<link>`
- Customer pages use shared components; payment pages have inline styles
- No npm/bundler on frontend side
- All API calls via `fetch()` to `window.CONFIG.API_BASE`

### Apps Script (`apps-script/`) — Active, Migration In Progress

- **Synced via clasp** (NOT auto-deployed — must manually push + redeploy)
- `Code.js` — Order creation, payment link generation, capture, cancel, adjustments, sidebar, auto-preauth trigger
- `webhook.js` — Receives status updates from backend, writes to Sheet
- Sheet tabs: `SERVI Orders`, `SERVI Adjustments`, `SERVI Changes`
- **`admin.html` is now the primary admin tool.** Apps Script still handles order creation and the preauth cron trigger until fully migrated.

### Apps Script Provider Recruitment (`apps-script-provider-recruitment/`)

- Separate script for provider spreadsheet
- Generates sequential IDs (`prov-000001`), marks verified/removed status

### Native Apps (customer + specialist) — wired to the live backend

The two Expo apps are no longer mocked prototypes — they are the production customer and specialist apps, wired to `backend/` (July 2026). They still import nothing from `frontend/`; they talk to the same API the web app uses.

- `native-app-reference/` — the **customer** app (Expo + RN + TS, `mx.servi.app`). Firebase phone OTP → `POST /api/auth/firebase` session; Smart Request submission → `POST /api/service-requests` (lands in admin inbox as WEB-… rows, same pipeline as web/WhatsApp); orders + live check-in timeline (`GET /api/auth/orders`, `GET /api/auth/orders/:id/lifecycle`); media capture uploads to R2; payment links open the existing web `pay.html`/`book.html` in an in-app browser (no card data in-app). Tips + email/Google sign-in deferred. See its `README.md` for the release checklist.
- `partner-app-reference/` — the **specialist (SERVI Partner)** app (`mx.servi.partner`). Provider phone OTP → `POST /api/provider/auth/firebase` (provider-scoped session JWT); offers + jobs via `GET /api/provider/jobs` with race-safe accept; check-in/location/price-change use the session variants of the existing provider routes (the per-order `provider.html?pt=…` link still works); onboarding applications → `partner_applications`. Earnings are read-only; **Stripe Connect payouts deferred** — admin keeps paying manually. See its `README.md`.
- **Admin linkage:** `admin.html` order panel has an "Ofertas a especialistas" section (`POST /api/admin/orders/:id/offer`) that pushes an order to a specialist's app.
- **`INTEROP.md`** (repo root) — the two-app system spec: type↔table mapping, which routes are built vs still pending (tips, Connect payouts), schema, and the Stripe Connect plan.
- **Three-way pricing sync:** `backend/pricing.mjs`, `native-app-reference/src/data/pricing.ts`, and `partner-app-reference/src/data/pricing.ts` must stay numerically identical. The two `pricing.ts` files are byte-identical, along with the shared theme/UI/i18n/clock/networking files — `scripts/check-app-sync.mjs` (`npm run check:sync`) enforces this.
- `dashboard.jsx` (repo root) — React source artifact from a Claude-generated admin dashboard redesign. The visual ideas have been ported into `frontend/admin.html`; this file is kept as a reference only.
- `frontend/design_handoff_smart_request/` — Original design handoff package (standalone HTML/CSS/JS prototype + integration guide) for the Smart Request booking flow. The flow has since been ported into `frontend/smart-request/` and `frontend/index.html`; the handoff folder is kept as reference only and is not loaded by the live app.

### Environment Variables (`.env`)

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe credentials
- `DATABASE_URL` — Neon PostgreSQL connection string
- `ADMIN_API_TOKEN` — Shared secret for admin API routes
- `FRONTEND_BASE_URL` — Cloudflare Pages URL (used to build payment links)
- `SHEETS_WEBHOOK_URL` — Google Apps Script exec URL
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase Admin SDK credentials (backend auth verification)
- `JWT_SECRET` — Custom session token secret. Required in production: backend throws at startup if missing when `NODE_ENV=production`. Locally it falls back to a dev-only string so a missing `.env` doesn't crash development.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` — Cloudflare R2 file uploads
- `ANTHROPIC_API_KEY` — Backend-only Claude API key for Smart Request text parsing
- `CORS_ALLOWLIST` — Additional allowed origins
- `NODE_ENV` — `production` on Render

---

### What's Incomplete / In Progress

- **⚠️ WhatsApp number needs replacing** — The old WhatsApp business number (`525525112588`) was **resold** and the WhatsApp Business account is no longer accessible; messages now reach a stranger. As a stopgap, all contact CTAs are routed to email (`serv.clientserv@gmail.com`) via `frontend/shared/contact-cta.js`, controlled by `CONTACT_MODE='email'` in `frontend/config.js`. **TODO: get a new phone number + WhatsApp Business account.** Once live, set the new `WHATSAPP_NUMBER` and flip `CONTACT_MODE` back to `'whatsapp'` in `config.js` — that single edit restores WhatsApp across all pages.
- **Smoke test before first real users** — All flows need end-to-end testing on live domain: phone OTP, Google OAuth, browse→service→confirm booking, account management, payment link flow
- **Admin dashboard migration** — Order creation still requires Apps Script; target is full `admin.html` + backend workflow
- **Legal page text** — `legal.html` structure is built but contains placeholder content; real legal copy needed
- **pay.html / book.html code duplication** — ~60% of HTML/JS is identical between the two; refactor into a shared component when convenient (not urgent)

---

## Reference Files & Resources

- **Auth state machine:** `docs/AUTH_STATE_MACHINE.md` — Detailed auth flow documentation
- **i18n system:** `frontend/shared/i18n.js` — Full translation system (ES/EN)
- **Design system:** `frontend/shared/shared-styles.css` — All brand colors, components, animations
- **Cloudflare middleware:** `functions/_middleware.js` — Injects Firebase API key into config.js at deploy time
- **Auth flow visualization:** `docs/auth-flows.html`
- **Test suites:** `tests/` — Playwright end-to-end specs (`auth-e2e.spec.js`, `admin-e2e.spec.js`) plus `preflight.mjs`; run with `npm run test:e2e`. Backend `*.test.mjs` unit files run with `npm run test:unit`.

---

## Development Workflow & Environment Management

### Git Branches

- **`main`** — Production. The live site deploys from here (Render backend + Cloudflare Pages frontend). Kept intentionally behind `dev` until a release is planned.
- **`dev`** — Active development. All day-to-day work happens here. Auto-deploys to the Render staging service.

Workflow: develop on `dev`, then open a PR from `dev` into `main` when ready to ship. No manual env var swapping — each environment has its keys set permanently in their respective dashboards.

> If you see references to a `feature/servi-platform` branch anywhere, they're stale. That branch was deleted.

### Local Setup

**`.env` (local only, test keys):**
- `STRIPE_SECRET_KEY=sk_test_...`
- `STRIPE_WEBHOOK_SECRET=whsec_test_...` (run `stripe listen --forward-to localhost:4242/webhook` to get current one)
- `FIREBASE_SERVICE_ACCOUNT_JSON={...}` (Firebase Admin SDK service account JSON — required for token verification)
- `ANTHROPIC_API_KEY=sk-ant-...` (enables real Smart Request parsing; missing key falls back to heuristic)
- `NODE_ENV=development`

**Frontend:** `config.js` uses test Stripe key and falls back to `window.location.origin` for API (Express serves frontend on same port).

### Production Keys (Auto-Injected)

- **Render production:** Has `STRIPE_SECRET_KEY=sk_live_...`, `FIREBASE_SERVICE_ACCOUNT_JSON`, and must include `ANTHROPIC_API_KEY` for Smart Request AI parsing
- **Cloudflare Pages:** Middleware injects `STRIPE_PUBLISHABLE_KEY=pk_live_...` and `API_BASE` at edge via env vars

No manual key changes needed — push to `main` and production uses live keys automatically.

---

## Key Principles

1. **Do NOT break existing flows** — `pay.html`, `book.html`, `success.html`, `save.html`, all backend routes, Stripe webhooks, and Apps Script must continue working unchanged.
2. **Plain HTML/CSS/JS only** — No React, no build step, no bundler. Match existing `frontend/` patterns.
3. **Express + ESM conventions** — All routes in `.mjs`, use existing `pool` connection, follow `requireAdminAuth` pattern.
4. **Shared components** — Navbar, footer, auth, and i18n are reusable across all pages via `frontend/shared/`.
5. **Uber-quality UX** — Polished, intentional, professional on customer pages.
6. **Mobile-first** — Most CDMX users on phones.
7. **Bilingual** — ES/EN toggle, Spanish default. Admin dashboard can be Spanish-only.
8. **Integrate, don't replace** — New intake feeds into existing pipeline. Dashboard reads from same database. Sheets continues in parallel until fully migrated.
