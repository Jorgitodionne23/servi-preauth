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
- Booking gate enforces both `email_verified=true` + `phone_verified=true`
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
- **Entry point:** `backend/index.mjs` — ALL routes and business logic in one file (~7,700 lines)
- **Database:** `backend/db.pg.mjs` — Pool connection + full schema (`CREATE TABLE IF NOT EXISTS`). See this file for authoritative table definitions.
- **Pricing:** `backend/pricing.mjs` — Dynamic fee calculation (alpha curve for booking fees, Stripe processing fees with VAT)
- **TLS guard:** `ALLOW_INSECURE_DB_TLS=true` throws at startup if `NODE_ENV=production`
- **Admin auth:** Bearer token via `ADMIN_API_TOKEN` env var, constant-time comparison
- **Webhook:** Stripe webhook at `/webhook` with raw body parsing + signature verification
- **Google Sheets sync:** Outbound POST to Apps Script web app URL for status updates (legacy, `SHEETS_WEBHOOK_URL`)
- **Smart Request AI parse:** `POST /api/parse-request` proxies Claude Haiku via `@anthropic-ai/sdk` using `ANTHROPIC_API_KEY`; the browser never sees the key. `POST /api/service-requests` persists additive Smart Request metadata (`request_mode`, matched service/subkey, AI summary/confidence/source, detail answers).

### Key Backend Concepts

- **Order kinds:** `primary`, `book` (saved card), `setup` (needs card save), `setup_required` (needs consent + card), `adjustment` (child order for surcharges/corrections)
- **Pre-auth window:** 24h before service → auto-authorize saved cards (hourly GitHub Actions trigger → `/tasks/preauth-due`)
- **Early pre-auth:** ≤72h allows PI creation without confirm; >72h stays Scheduled
- **Link expiration:** Payment links expire after 2 hours; `retry_token` can extend
- **Consent system:** Per-order audit (`consented_offsession_bookings`) + per-customer registry (`saved_servi_users`)
- **Cash exception:** First-time customers can opt for cash via `/orders/:id/choose-cash`
- **Pricing engine:** `computePricing()` in `pricing.mjs` — provider price → alpha-curve booking fee → Stripe processing fee → VAT → total. Visit pre-auth has fixed pricing ($140 MXN total, $90 provider)
- **Admin endpoints:** All `/api/admin/*` routes are in `backend/index.mjs` (orders list/detail/stats, reports, partner applications, capture/cancel/refund)

### Database

See `backend/db.pg.mjs` for the full schema. Key tables: `all_bookings`, `consented_offsession_bookings`, `saved_servi_users`, `auth_users`, `user_addresses`, `service_requests`, `providers`, `service_reports`, `partner_applications`, `revoked_sessions`.

### Frontend (`frontend/`)

**No framework. No build step. Plain static HTML + vanilla JS on Cloudflare Pages.**

#### Shared Components (`frontend/shared/`)

- `shared-styles.css` — Global design system (brand colors, components, animations)
- `landing-theme.css` — Extended CSS for landing/marketing pages (~92KB)
- `shared-auth.js` — Firebase auth flow (phone OTP, email magic link, Google OAuth, cross-identifier recovery — ~2,550 lines)
- `shared-nav.js` — Navigation bar (language toggle, auth state, user menu dropdown, mobile hamburger)
- `shared-footer.js` — 4-column footer component
- `morphing-nav.js` — Animated navbar variant used on landing page (~1,094 lines)
- `i18n.js` — Full Spanish/English translation system
- `browse-data.js` — Service category/provider data for browse and service pages

**Navbar (customer-facing pages):** SERVI. logo, Servicios / Cómo funciona / Testimonios (index.html anchors), Partners, Help Center, ES/EN toggle, Login/Crear cuenta (or user avatar + dropdown if logged in), mobile hamburger at ≤900px.

**Navbar variants:** Help Center pages use a simplified nav; Partners/Handbook pages use a partner-branded nav.

**Footer (all pages):** 4 columns — SERVI, Partners, Help Center, Legal.

#### Customer-Facing Pages

- `index.html` — Landing page (hero, categories, how it works, testimonials, contact)
- `browse.html` — Service category browser / discovery page
- `service.html` — Individual service request flow (describe + schedule)
- `account.html` — User account management (edit profile, saved addresses, delete account — auth-guarded)
- `email-verified.html` — Post-email-verification landing page
- `legal.html` — Legal terms (términos, privacidad, cancelación, aviso legal)
- `partners.html` — Partner signup hub
- `handbook.html` — Provider guide index → `handbook/` subpages (7 guide pages)
- `helpcenter.html` — Support index → `helpcenter/` subpages (4 pages including report/suggestion forms)
- `partners/registro.html` — Partner application form

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

---

## Development Workflow & Environment Management

### Git Branches

- **`main`** — Production (auto-deploys to Render & Cloudflare)
- **`dev`** — Staging (auto-deploys to Render staging service)

Work on `dev`, merge to `main` when ready for production. No manual env var swapping — each environment has its keys set permanently in their respective dashboards.

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
