# SERVI — Project Brief for Claude Code

## What is SERVI?

SERVI is an on-demand home services platform based in **Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX**. Think of it as "Uber for home services" — users request services like cleaning, plumbing, electrical work, personal care, and more. SERVI matches them with verified specialists ("SERVI Partners").

**Current state:** The business currently operates via a Canva-hosted website that redirects users to WhatsApp for ordering. We are building the actual web application to replace this — a real on-demand service platform with authentication, booking, payments, and provider management.

**Contact info:**

- Email: serv.clientserv@gmail.com
- Location: Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX
- WhatsApp: (525525112588)

---

## Design Direction

### Inspiration: Uber's website

- **Minimalist, black/white dominant** palette with a single bold accent color
- **Generous whitespace**, clean information architecture
- **Functional hero section** with clear CTA — not decorative, action-oriented
- **Concise navigation** — simple labels, logical placement
- **Typography-driven** hierarchy — big bold headlines, restrained body text
- **No clutter** — every element earns its place

### Brand Identity

- **Name:** SERVI (keep this name)
- **Logo treatment:** "SERVI." with a green dot — uses Syne font, weight 800
- **Primary color:** #0a0a0a (near-black)
- **Accent color:** #10b981 (emerald green)
- **Background:** #fafafa (off-white)
- **Headline font:** Syne (Google Fonts) — weights 700, 800
- **Body font:** DM Sans (Google Fonts) — weights 300, 400, 500, 700
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

### Authentication (Required for booking confirmation)

- Users can browse and fill booking steps 1-2 without login
- Confirming a booking (step 3) requires authentication
- Auth methods: Phone OTP (Firebase) or Google Sign-In
- Logged-in users have booking data pre-filled
- No email/password auth (passwordless Firebase-only)

### Service Booking (3-step flow)

1. **Smart search or select category** — Choose from the 5 service categories or using the inteligent ccustom request (picture, video, voice message).
2. **Describe + Schedule** — Free-text description of the need + choose "ASAP" or schedule a specific date/time
3. **Address + Confirm** — Enter full address, review summary, confirm request. Phone is neccesary if user does not have account or is not logged in.

### SERVI Match

After a request is confirmed, SERVI Admin team assigns a verified specialist based on availability (this is the "SERVI Match" system). Users are notified when matched.

### Provider Onboarding

- Separate section/flow for service providers ("SERVI Partners")
- Partners can apply for free to offer their services through SERVI.
- Links: "Guide to earning with SERVI" and "Apply as a Partner"

---

## How It Works (3 Steps — for marketing/landing page)

1. **Choose your service** — Select a category and describe what you need
2. **SERVI Match** — We assign the closest/available verified specialist
3. **Done** — Your specialist arrives. We handle the rest.

---

## Testimonials (Real customer quotes)

1. **Diego Flores:** "Un proceso bastante sencillo. No me tuve que preocupar por investigar ni en contactar al especialista. Ya no tengo que estar preguntando en grupos por especialistas."

2. **Patricia Espinoza:** "Mi calentador dejó de funcionar y no sabía a quién acudir. A través de SERVI me conectaron con el especialista indicado, detectó que faltaba una pieza y ellos se encargaron de conseguirla, instalarla y dejar todo funcionando. Muy práctico!"

3. **Valeria Sanchez:** "¡Una alternativa más segura! Me ayudaron sustituir a mi jardinero, con quien estaba teniendo problemas. ¡Estoy más tranquila sabiendo que tengo el respaldo de un intermediario por cualquier cosa!"

---

## Stats (for landing page)

- 500+ services completed
- 98% satisfaction rate
- 50+ verified specialists
- 24h average response time

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

### Current User Flow (Admin-Initiated)

1. Admin creates order in **Google Sheets** (Apps Script button) (We are currently in the process of transitioning to an personalizeed production ready Admin dashboard in order to not depend on google sheets)
2. Apps Script calls backend → creates Stripe PaymentIntent (manual capture / pre-auth)
3. Customer receives **payment link via WhatsApp**
4. Customer pays on `pay.html` (new card) or confirms on `book.html` (saved card, 1-click)
5. Card is **pre-authorized** (hold, not charged)
6. After service completion, admin **captures** the payment from Sheets
7. Saved-card customers get auto-pre-authorized 24h before service via hourly trigger when order is scheduled with more than 72 hours in advance. If order is scheduled and booked within the 72 hour window, pre authorization is done immediately.

**There is now customer-facing self-service booking intake on the landing page.** Customers can submit service requests from the website, and admin still handles manual matching + payment-link creation.

### Deployment Topology

| Layer             | Host                   | Details                                                           |
| ----------------- | ---------------------- | ----------------------------------------------------------------- |
| Backend           | **Render** (Docker)    | `node backend/index.mjs`, auto-deploys on push to `main`          |
| Frontend          | **Cloudflare Pages**   | Static HTML from `frontend/` folder                               |
| Database          | **Neon** (PostgreSQL)  | Serverless Postgres, `pg` Pool connection                         |
| Admin             | **Google Apps Script** | Container-bound to Google Sheet, synced via `clasp`               |
| Payments          | **Stripe**             | Pre-auth (manual capture), saved cards, off-session, 3DS fallback |
| Auth signup/login | **Firebase**           | Free instance                                                     |

### Backend (`backend/`)

- **Runtime:** Node.js with ES modules (`.mjs` extensions only)
- **Framework:** Express 5
- **Entry point:** `backend/index.mjs` — ALL routes and business logic in one file (large monolith, 5k+ lines)
- **Database:** `backend/db.pg.mjs` — Pool connection + full schema (`CREATE TABLE IF NOT EXISTS`)
- **Pricing:** `backend/pricing.mjs` — Dynamic fee calculation (alpha curve for booking fees, Stripe processing fees with VAT)
- **TLS guard:** `ALLOW_INSECURE_DB_TLS=true` throws at startup if `NODE_ENV=production`
- **Admin auth:** Bearer token via `ADMIN_API_TOKEN` env var, constant-time comparison
- **Webhook:** Stripe webhook at `/webhook` with raw body parsing + signature verification
- **Google Sheets sync:** Outbound POST to Apps Script web app URL for status updates

### Key Backend Concepts

- **Order kinds:** `primary`, `book` (saved card), `setup` (needs card save), `setup_required` (needs consent + card), `adjustment` (child order for surcharges/corrections)
- **Pre-auth window:** 24h before service → auto-authorize saved cards (hourly trigger in Apps Script + `/tasks/preauth-due` endpoint)
- **Early pre-auth:** ≤72h allows PI creation without confirm; >72h stays Scheduled
- **Link expiration:** Payment links expire after 2 hours; `retry_token` can extend
- **Consent system:** Per-order audit (`consented_offsession_bookings`) + per-customer registry (`saved_servi_users`)
- **Cash exception:** First-time customers can opt for cash via `/orders/:id/choose-cash`
- **Pricing engine:** `computePricing()` in `pricing.mjs` — provider price → alpha-curve booking fee → Stripe processing fee → VAT → total. Visit pre-auth has fixed pricing ($140 MXN total, $90 provider)

### Database Tables (Neon PostgreSQL)

- `all_bookings` — Main orders table (primary, book, adjustment kinds)
- `consented_offsession_bookings` — Per-order consent audit trail
- `saved_servi_users` — Per-customer consent + saved payment method registry
- `providers` — Verified providers registry (id, name, phone, email, specialty, city)

### Frontend (`frontend/`)

**No framework. No build step. Plain static HTML + vanilla JS on Cloudflare Pages.**

- `frontend/config.js` — Runtime config (`window.CONFIG` with `API_BASE`, `STRIPE_PUBLISHABLE_KEY`, `WHATSAPP_NUMBER`)
- `frontend/pay.html` — Card payment form (Stripe Elements, consent checkbox, terms, cash exception)
- `frontend/book.html` — Saved-card 1-click checkout (phone verification gate, 3DS fallback, billing portal)
- `frontend/success.html` — Post-payment confirmation (order summary, pricing breakdown)
- `frontend/save.html` — Standalone account/card management portal
- `frontend/link-expired.html` — Shown when payment link has expired

**Frontend conventions:**

- Vanilla JS, direct DOM manipulation
- Stripe.js loaded via CDN (`<script src="https://js.stripe.com/v3/"></script>`)
- Google Fonts via `<link>` (currently Inter)
- `<style>` blocks in each HTML file (dark theme, black background, white text)
- No npm/bundler on frontend side
- All API calls via `fetch()` to `window.CONFIG.API_BASE`

### Apps Script (`apps-script/`)

- **Synced via clasp** (NOT auto-deployed — must manually push + redeploy)
- `Code.js` — Order creation, payment link generation, capture, cancel, adjustments, sidebar, auto-preauth trigger
- `webhook.js` — Receives status updates from backend, writes to Sheet
- Sheet tabs: `SERVI Orders`, `SERVI Adjustments`, `SERVI Changes`
- Column mapping via header aliases (resilient to column reordering)

### Apps Script Provider Recruitment (`apps-script-provider-recruitment/`)

- Separate script for provider spreadsheet
- Generates sequential IDs (`prov-000001`), marks verified/removed status

### Environment Variables (`.env`)

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe credentials
- `DATABASE_URL` — Neon PostgreSQL connection string
- `ADMIN_API_TOKEN` — Shared secret for admin API routes
- `FRONTEND_BASE_URL` — Cloudflare Pages URL (used to build payment links)
- `SHEETS_WEBHOOK_URL` — Google Apps Script exec URL
- `CORS_ALLOWLIST` — Additional allowed origins
- `NODE_ENV` — `production` on Render

---

## Current State: Production Readiness Phase

**Status:**

- ✅ **Phase 1 (Quick Wins) — COMPLETE**
  - Report/suggestion form success messages ✓
  - Pre-filled user info for logged-in users ✓
  - Navbar text contrast fixed ✓
  - Partner button visual differentiation ✓
  - Navbar link reordering ✓

- ✅ **Phase 2 (Firebase Auth + Account Management) — COMPLETE**
  - Firebase auth setup: Phone OTP + Google Sign-In (passwordless)
  - Legacy email/password auth removed
  - Booking auth gate: browse without login, confirm with login
  - Shared auth modal deployed across public pages
  - Account page implemented (profile, addresses, payment methods, delete account)
  - Account page full i18n (ES/EN) with lang-toggle translation
  - Backend auth/account endpoints implemented with proper token issuance

- 📋 **Phase 3 (Booking & Provider Redesign) — PLANNED**
  - Custom-first booking with service examples
  - Image/video/voice upload
  - Providers admin tab + detail view
  - Partner form improvements

### What's Complete

✓ **All 25+ HTML pages** — Landing, Help Center (hub + forms + about + contact), Legal (tabbed), Partners (landing + signup), Handbook (hub + 6 articles)
✓ **All backend API endpoints** — Auth (Firebase sync, token issuance), service requests, reports, partner applications, account management (profile, addresses), admin queries
✓ **All database tables** — `auth_users` (firebase_uid, auth_provider), `service_requests`, `service_reports`, `partner_applications`, `user_addresses` (plus existing `all_bookings`, `saved_servi_users`, etc.)
✓ **Authentication system** — Firebase-only passwordless, phone-first USL flow: unified identifier input, single `renderOTPScreen(type)`, name collection post-OTP, optional secondary identifier, cross-identifier recovery, booking gate enforcement; `phone_verified`/`email_verified`/`first_identifier_type` tracked in DB
✓ **Booking auth gate** — Browse 2 steps without login, login required to confirm step 3
✓ **Account page** — Profile, address management, payment methods, delete account with confirmation (all fully bilingual)
✓ **Shared components** — Navbar (auth modal, user menu dropdown), footer, i18n (ES/EN toggle with live translation), design system (Syne + DM Sans, colors, cards, buttons)
✓ **Bilingual i18n** — Full Spanish/English translation for all pages including account page with lang-change event support
✓ **Mobile-responsive design** — Hamburger menu at 900px, grid layouts
✓ **Existing payment flows untouched** — `pay.html`, `book.html`, `success.html`, `save.html` continue working

### What's Incomplete / In Progress

⚠️ **End-to-end QA testing** — All flows need testing on live domain (phone OTP, Google OAuth, booking, account management)
⚠️ **Admin dashboard refinement** — Tabs built (Inbox, Orders), may need detail panels, refinement
⚠️ **Legal page text** — Structure built, 5 placeholders for legal documents (términos, privacidad, etc.)
⚠️ **Payment flow integration** — Existing pay.html/book.html/success.html untouched; verify booking flow → payment link creation works end-to-end
⚠️ **Potential bugs** — Testing may uncover issues in auth edge cases, form validation, error handling

---

## Authentication & User Accounts

### Current Implementation

> **Verified 2026-04-11** — USL redesign live: phone OTP → name → email skip → booking gate → cross-identifier merge

- **Frontend auth:** Firebase-only (passwordless), phone-first USL (Unified Sign-up/Login) flow
  - **Unified identifier input** — single field, auto-detects phone vs email (@ triggers email mode)
  - **Phone OTP** via invisible reCAPTCHA (`signInWithPhoneNumber`)
  - **Email magic link** via Firebase `sendSignInLinkToEmail` (email path — no 6-digit codes)
  - **Google OAuth** via popup (`signInWithPopup`) — bypasses all OTP screens
  - No email/password auth (passwordless Firebase-only)
- **Backend:** `POST /api/auth/firebase` syncs Firebase ID token → issues custom JWT (30-day HS256)
- **Session storage:** localStorage (`servi_user_session`) stores `{ token, user, firebaseUid }` where `user` includes `phone_verified`, `email_verified`
- **Verification tracking:** `auth_users` table has `phone_verified`, `email_verified`, `first_identifier_type` columns
- **Booking gate:** `POST /api/service-requests` enforces `email_verified=true` + `phone_verified=true` for authenticated users; returns 409 with `email_required` or `phone_required` error code
- **Cross-identifier recovery:** `POST /api/auth/resolve-identifier-mismatch` detects orphaned phone-only accounts when an unrecognised email is submitted — triggers name-validation + phone OTP merge flow
- **Account page:** Fully bilingual, edit profile, manage addresses, delete account
- **Navbar:** Shows logged-in user's name + avatar + dropdown menu with My Account / Logout

### Auth Flow

**Signup (phone-first):**
1. User enters phone number in unified identifier field → `POST /api/auth/check-identifier` → `{ exists: false }`
2. Phone OTP screen — enter SMS code → Firebase verifies
3. Name collection screen — first + last name (required) + terms checkbox
4. Secondary identifier screen — add email (optional, skip available → sets `servi_email_skipped=1`)
5. If email entered → Firebase magic link sent → after click, email verified → `POST /api/auth/add-email`
6. `POST /api/auth/firebase` creates account with `phone_verified=true`, `first_identifier_type='phone'`
7. JWT stored in localStorage, modal closes

**Login:**
1. User enters phone or email → `POST /api/auth/check-identifier` → `{ exists: true, provider }`
2. OTP screen rendered for provider's type (`'phone'` or `'email'`)
3. Verify → `POST /api/auth/firebase` → JWT refreshed, modal closes

**Google OAuth (all paths):**
- Google popup → Firebase → `POST /api/auth/firebase` with `email_verified=true`, `phone_verified=false`
- Booking gate will request phone at step 3

**Email-first signup:** symmetric to phone-first — email OTP → name → phone optional → `POST /api/auth/add-phone`

**Cross-identifier recovery:** unrecognised email + existing phone-only account → `POST /api/auth/resolve-identifier-mismatch` → name validation → phone OTP → account merged with `email_verified=true`

### Logged-In User Benefits

- **Faster booking confirmation** — Pre-filled name, phone, email on booking step 3
- **Saved addresses** — Create/manage addresses from account page, auto-fill on next booking
- **Account page access** — Edit profile, manage addresses, manage payment methods, delete account
- **Secure bookings** — All API calls use Bearer token for authorization

### Future Vision

- All customers MUST have an account + saved payment method to order services
- For now, accounts are optional for convenience; guests can still order

### Payment Method Logic

- **Pre-authorization:** Existing logic in `backend/pricing.mjs` already handles pre-auth timing. Depends on order nature (24h before service, early pre-auth if ≤72h, etc.). **Do not redesign this.**
- **Saved cards:** When a user saves a card, it's validated and stored. Pre-auth happens according to the order's schedule.
- **Reference:** Study Uber's auth/account flow for UX inspiration.

---

## Service Request Booking Flow

### Customer Journey

1. Click "Solicitar servicio" (CTA on landing or navbar)
2. **Step 1-2 (Browse):** No login required
   - Select category (6 options)
   - Describe service needed (free text)
   - Choose timing ("Lo antes posible" or schedule)
3. **Step 3 (Confirm):** Login REQUIRED via Firebase (phone OTP or Google)
   - Auth modal opens
   - After login: pre-filled name, phone, email from account
   - Enter/confirm service address
   - Review + confirm
4. Submit → Service request created in database
5. Confirmation screen: "¡Solicitud enviada! Te contactaremos pronto por WhatsApp."

### Backend Processing

- Endpoint: `POST /api/service-requests` (public, rate-limited)
- Creates entry in `service_requests` table with `status: 'pending'`
- **Admin matching:** Admin team MANUALLY reviews request, finds available provider, contacts customer via WhatsApp
- **Order creation:** Admin creates order in Google Sheets (Apps Script), which triggers payment flow
- Pending web service requests are surfaced in the **Orders** tab as "WEB-..." rows until converted into a payment order

### Database Table: `service_requests`

```sql
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  is_asap BOOLEAN DEFAULT FALSE,
  service_address TEXT,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  customer_id TEXT,
  status TEXT DEFAULT 'pending',
  converted_order_id TEXT,
  lang TEXT DEFAULT 'es',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Admin Dashboard

**File:** `frontend/admin.html` — Web-based admin panel protected by `ADMIN_API_TOKEN`

### Tabs Overview

#### 1. **Inbox Tab**

Shows: **Reports + Suggestions + Partner Applications** (service requests are handled from Orders tab)

**Workflow:** Each submission type has different resolution path (see below)

**UI Reference:** `dashboard.jsx` REPORTS section shows Uber/DoorDash/Rappi pattern:

- Stats cards at top (Open Issues, In Review, Resolved, Suggestions)
- Filters by type and table-level status values used by each submission type
- Report cards list with subject, customer, type badge, priority badge, status badge
- Click card → detail side panel opens
- Detail panel shows: customer info, subject, description, linked order (if applicable), resolution notes textarea, action buttons
- Bottom: "How Big Platforms Handle This" info box with real-world examples

**Actions by Type:**

- **Reports (Complaints):** Mark `new` → `reviewed` → `resolved` with admin notes.
- **Suggestions:** Mark `new` → `reviewed` → `resolved` as needed.
- **Partner Applications:** Review and update status (`pending`, `reviewed`, `verified`, `rejected`).

**Database Tables:**

- `service_reports` (type: 'incident' or 'suggestion', status: new/reviewed/resolved)
- `partner_applications` (status: pending/reviewed/verified/rejected)

#### 2. **Orders Tab**

Shows: All orders from `all_bookings`

**Display:** Order ID, customer name, service, amount, status, service date, provider
**Status badges:** Pending, Setup required, Scheduled, Confirmed, Captured, Declined, Canceled, etc.
**Actions:** View details, capture, cancel, refund
**Filters:** By status, search by name/phone/order ID, sort by date

#### 3. **Auth Gate**

- Login screen → enter `ADMIN_API_TOKEN` → stored in `sessionStorage`
- All API calls use `Authorization: Bearer {token}`

### Admin Backend Endpoints

- `GET /api/admin/orders` — List orders with pagination, filtering, search
- `GET /api/admin/orders/:id` — Full order details
- `GET /api/reports` — List reports/suggestions (admin auth; filters by type/status)
- `PATCH /api/reports/:id` — Update report status/notes (admin auth)
- `GET /api/partner-applications` — List applications (admin auth)
- `PATCH /api/partner-applications/:id` — Update application status (admin auth)
- `GET /api/admin/stats` — Quick stats (requests today, pending orders, confirmed, revenue)

---

### ─── SHARED COMPONENTS ───

All public-facing pages share these elements (implement as reusable JS includes or copy-paste with consistent structure):

**Navbar (customer-facing pages):**

- SERVI. logo (links to index.html)
- Links: Servicios, Cómo funciona, Testimonios (index.html anchors), Partners, Help Center
- ES/EN toggle
- Login / Crear cuenta buttons (or user avatar if logged in)
- Mobile hamburger at ≤900px

**Navbar (Help Center pages):**

- SERVI. logo
- Help Center, Solicitar, Trabajar links

**Navbar (Partners/Handbook pages):**

- SERVI. | Partner logo
- ¿Qué?, ¿Cómo?, Handbook links

**Footer (all pages):**
4 columns matching the current site:

- SERVI: Solicita, Qué ofrecemos, Cómo, App, Testimonios
- Partners: Quiero ser partner, Qué es ser Partner, Cómo ser Partner, Handbook
- Help Center: Reportar/sugerencia, Quiénes Somos, Contáctanos
- Legal: Términos, Privacidad, Política de Cancelación, Aviso Legal

---

### ─── DESIGN SYSTEM ───

**Customer-facing pages (landing, help center, partners, handbook, legal):**

- Uber-inspired: minimalist, generous whitespace, typography-driven
- **Headline font:** Syne (Google Fonts) — 700, 800
- **Body font:** DM Sans (Google Fonts) — 300, 400, 500, 700
- **Colors:** Primary #0a0a0a, Accent #10b981 (emerald green), Background #fafafa
- **Logo:** "SERVI." with green dot, Syne 800
- Light theme throughout
- Sticky navbar with scroll-aware blur, mobile hamburger at 900px
- Cards with subtle borders (#e8e8e8), 16px radius, hover lift + shadow
- Smooth animations (fadeUp, slideUp)
- Bilingual ES/EN with toggle in navbar, Spanish default

**Admin dashboard:**

- Dark theme (matches existing payment pages aesthetic)
- Inter font
- Clean data tables, minimal but functional
- Internal tool — prioritize usability over visual flair

**Existing payment pages (`pay.html`, `book.html`, `success.html`, `save.html`):**

- DO NOT RESTYLE. They keep their existing dark theme + Inter font.

---

### ─── SERVICE REQUEST INTAKE (Booking Flow) ───

**Purpose:** Structured way for customers to request services via the website. Creates a **request** that the admin team processes manually (finds provider, contacts customer via WhatsApp, creates order + payment link in Google Sheets).

**Customer flow:**

1. Click "Solicitar servicio" on landing page
2. _(Optional)_ Log in or create account — OR continue as guest
3. Select service category (6 categories)
4. Describe what they need (free text)
5. Choose when: "Lo antes posible" (ASAP) or schedule date/time
6. Enter address
7. Enter contact info: name, phone (required), email
8. Review summary → Submit
9. Confirmation: "¡Solicitud enviada! Te contactaremos pronto por WhatsApp."

**Auth model: Optional account creation**

- Guests submit with name + phone + email (no password)
- Optionally create account (email + password) for faster future requests
- Logged-in users get info pre-filled
- Integrates with existing `saved_servi_users` table

**New database table: `service_requests`**

```sql
CREATE TABLE IF NOT EXISTS service_requests (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  is_asap BOOLEAN DEFAULT FALSE,
  service_address TEXT,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  client_email TEXT,
  customer_id TEXT,
  status TEXT DEFAULT 'pending',
  converted_order_id TEXT,
  lang TEXT DEFAULT 'es',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New database table: `service_reports`** (for incidents + suggestions)

```sql
CREATE TABLE IF NOT EXISTS service_reports (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,              -- 'incident' or 'suggestion'
  category TEXT,                   -- incident type or suggestion category
  name TEXT,
  email TEXT,
  phone TEXT,
  description TEXT NOT NULL,
  incident_date TEXT,              -- for incidents only
  status TEXT DEFAULT 'new',       -- new, reviewed, resolved, archived
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New database table: `partner_applications`**

```sql
CREATE TABLE IF NOT EXISTS partner_applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  specialty TEXT,
  city TEXT,
  experience TEXT,
  status TEXT DEFAULT 'pending',   -- pending, reviewed, verified, rejected
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New backend endpoints:**

- `POST /api/service-requests` — Create service request (public, rate-limited)
- `GET /api/service-requests` — List all requests (admin auth)
- `PATCH /api/service-requests/:id` — Update status (admin auth)
- `POST /api/reports` — Submit incident report or suggestion (public, rate-limited)
- `GET /api/reports` — List all reports/suggestions (admin auth)
- `PATCH /api/reports/:id` — Update status/notes (admin auth)
- `POST /api/partner-applications` — Submit partner application (public, rate-limited)
- `GET /api/partner-applications` — List all applications (admin auth)
- `PATCH /api/partner-applications/:id` — Update status (admin auth)

**Notification:** All form submissions POST to `SHEETS_WEBHOOK_URL` so the team sees them in Google Sheets immediately (types: `service_request.created`, `report.created`, `partner_application.created`).

---

### ─── ADMIN DASHBOARD ───

**File:** `frontend/admin.html`

Web-based admin panel protected by `ADMIN_API_TOKEN`. Replaces Google Forms + starts replacing Google Sheets.

**Sections/Tabs:**

1. **Inbox** — Unified view of ALL incoming submissions
   - Incident reports (from Help Center)
   - Suggestions (from Help Center)
   - Partner applications (from Partners page)
   - Filter by type and status
   - Quick status updates

   Service requests are managed from the Orders tab (pending web intake rows).

2. **Orders Management** — View all orders from `all_bookings`
   - Table: order ID (short code), customer name, service, amount, status, service date, provider
   - Status badges: Pending, Setup required, Scheduled, Confirmed, Captured, Declined, Canceled, etc.
   - Expandable details (pricing breakdown, PI, consent)
   - Actions: Capture, Cancel, Refund (partial), View in Stripe Dashboard
   - Filter by status, search by name/phone/order ID, sort by date

3. **Auth gate** — Token-based
   - Login screen → `sessionStorage`
   - All calls use `Authorization: Bearer {token}`
   - Same `ADMIN_API_TOKEN` from `.env`

**Admin backend endpoints:**

- `GET /api/admin/orders` — List orders with pagination, filtering, search
- `GET /api/admin/orders/:id` — Full order details
- `GET /api/admin/stats` — Quick stats (requests today, pending orders, confirmed, revenue)
- Existing capture/cancel/refund endpoints already work — dashboard just calls them

---

## Production Readiness Checklist

Before launching to production, verify:

- [ ] **Booking flow:** End-to-end from landing CTA to `service_requests` table to order creation
- [x] **Auth flow:** USL redesign implemented — phone-first signup, email optional, cross-identifier recovery, booking gate (2026-04-11)
- [ ] **Auth flow QA:** End-to-end manual test on real iOS/Android devices (phone OTP, Google OAuth, email magic link, booking gate)
- [ ] **All 25 pages:** Content complete, mobile responsive, bilingual (ES/EN)
- [ ] **Form submissions:** Reports, suggestions, partner apps all submit to backend + Sheets webhook
- [ ] **Admin dashboard:** Login works, Inbox shows all types (reports, suggestions, apps), Orders tab shows all orders, filters work, can update status
- [ ] **Legal page:** All 5 placeholders filled with actual legal text
- [ ] **Manage Account page:** Designed and functional (name, phone, email, addresses, payment methods, preferences)
- [ ] **Integration testing:** Full end-to-end flows verified (see checklist below)
- [ ] **Deployment:** Merged to `main`, Render auto-deploys, Cloudflare Pages live, no errors in console

---

## Integration Testing Checklist (Before Launch)

### Guest User Flow

- [ ] Load homepage, click "Solicitar servicio"
- [ ] Booking modal appears, category select visible
- [ ] Navigate through all 5 steps (category → describe → schedule → address → confirm)
- [ ] Form submits successfully, request appears in database
- [ ] Admin sees pending request in Orders as web intake row
- [ ] Sheets webhook fires (check Google Sheet for new row)
- [ ] Confirmation page shows success message

### Authenticated User Flow

- [ ] Click Login/Signup on navbar
- [ ] Auth modal opens
- [ ] Signup: Enter email, phone, password → account created → redirected to home, navbar shows name
- [ ] Return to booking → info is pre-filled (name, email, phone)
- [ ] Submit booking while logged in
- [ ] Can access "Manage Account" page → can edit info

### Report Submission Flow

- [ ] Go to Help Center → click "Reportar Incidente o Problema"
- [ ] Report form opens, fill fields (name, email, phone, incident type, description, date)
- [ ] Submit → success confirmation
- [ ] Admin logs into dashboard → Inbox tab shows report
- [ ] Admin can mark `reviewed`, write resolution notes, then mark `resolved`
- [ ] Report status updates in admin dashboard

### Suggestion Submission Flow

- [ ] Go to Help Center → click "Compartir Sugerencia o Idea"
- [ ] Suggestion form opens, fill fields (name, email optional, category, description)
- [ ] Submit → success confirmation
- [ ] Admin sees in Inbox tab (filtered as "Suggestion")
- [ ] Admin can mark as reviewed

### Partner Application Flow

- [ ] Go to Partners page → click "Regístrate a SERVI"
- [ ] Registration form opens (name, phone, email, specialty, city, experience)
- [ ] Submit → success confirmation
- [ ] Admin logs in → Inbox shows partner application
- [ ] Admin extracts phone number → contacts via WhatsApp with pre-built message
- [ ] Admin marks `reviewed` → after interview → `verified` or `rejected`

### Admin Dashboard

- [ ] Login with ADMIN_API_TOKEN works
- [ ] Inbox tab loads, shows all submission types
- [ ] Filters work for current report/app status values and type selections
- [ ] Can update report status (`new`/`reviewed`/`resolved`) and partner app status (`pending`/`reviewed`/`verified`/`rejected`)
- [ ] Orders tab shows all orders from all_bookings
- [ ] Can view order details, capture/cancel buttons present
- [ ] Search/filter by status, customer name, order ID works

### Existing Payment Flows (Must Not Break)

- [ ] `pay.html` still works (new card payment)
- [ ] `book.html` still works (saved card 1-click)
- [ ] `success.html` displays correctly
- [ ] Stripe webhooks still fire
- [ ] Google Apps Script still receives status updates
- [ ] Capture/cancel/refund from Sheets still works

---

## Known Blockers / Issues

### ✅ RESOLVED

### 🟡 PENDING TESTING

_[Test these flows and report back if you encounter issues. Format: Issue name (component, severity) — description, expected vs. actual behavior, estimated fix time]_

## Reference Files & Resources

- **Dashboard reference:** `dashboard.jsx` — Read the "REPORTS" section (line ~228) for Inbox UI pattern
- **PDF content:** `/docs/pdfs/` — Help Center, Partners, Handbook content
- **Existing payment styling:** `frontend/pay.html`, `book.html` — Reference for dark-theme admin dashboard
- **i18n system:** `frontend/shared/i18n.js` — Full translation system (916 lines, ES/EN complete)
- **Design system:** `frontend/shared/shared-styles.css` — All brand colors, components, animations

---

## Key Principles (Still Valid)

1. **Do NOT break existing flows** — `pay.html`, `book.html`, `success.html`, `save.html`, all backend routes, Stripe webhooks, and Apps Script must continue working unchanged.
2. **Plain HTML/CSS/JS only** — No React, no build step, no bundler. Match existing `frontend/` patterns.
3. **Express + ESM conventions** — All routes in `.mjs`, use existing `pool` connection, follow `requireAdminAuth` pattern.
4. **Shared components** — Navbar, footer, and i18n are reusable across all pages to avoid duplication.
5. **Uber-quality UX** — Polished, intentional, professional on customer pages.
6. **Mobile-first** — Most CDMX users on phones.
7. **Bilingual** — ES/EN toggle, Spanish default. Admin dashboard can be Spanish-only.
8. **Content placeholders** — Use clear `<!-- [PLACEHOLDER: Section title] -->` markers where text is missing.
9. **Integrate, don't replace** — New intake feeds into existing pipeline. Dashboard reads from same database. Sheets continues in parallel.
