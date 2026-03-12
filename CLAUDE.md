# SERVI — Project Brief for Claude Code

## What is SERVI?

SERVI is an on-demand home services platform based in **Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX**. Think of it as "Uber for home services" — users request services like cleaning, plumbing, electrical work, personal care, and more. SERVI matches them with verified specialists ("SERVI Partners").

**Current state:** The business currently operates via a Canva-hosted website that redirects users to WhatsApp for ordering. We are building the actual web application to replace this — a real on-demand service platform with authentication, booking, payments, and provider management.

**Contact info:**

- Email: serv.clientserv@gmail.com
- Location: Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX
- WhatsApp: (linked from site)

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

1. **Limpieza / Cleaning** — Home, office, garden care and cleaning services
2. **Reparación y Mantenimiento / Repair & Maintenance** — Plumbing, electrical, technical repairs, installations, structural fixes
3. **Bienestar y Cuidado Personal / Wellness & Personal Care** — Personal care services delivered at home
4. **Mantenimiento / Maintenance** — Preventive maintenance and installations
5. **Abastecimiento y Compras / Supply & Shopping** — Deliveries, grocery runs, errands, product sourcing
6. **Personalizado / Custom** — "Describe it and we'll find it" — catch-all for requests that don't fit a category

---

## Core User Flows

### Authentication (Required before booking)

- Users MUST be logged in to request a service (Uber-style gate)
- Login methods: Email/password, Google OAuth, Apple Sign-In
- Signup collects: full name, email, phone, password
- If a non-authenticated user tries to book, show login modal first, then redirect to booking after auth

### Service Booking (3-step flow)

1. **Select category** — Choose from the 6 service categories
2. **Describe + Schedule** — Free-text description of the need + choose "ASAP" or schedule a specific date/time
3. **Address + Confirm** — Enter full address, review summary, confirm request

### SERVI Match

After a request is confirmed, SERVI assigns a verified specialist based on availability (this is the "SERVI Match" system). Users are notified when matched.

### Provider Onboarding

- Separate section/flow for service providers ("SERVI Partners")
- Partners can apply for free to offer their services through the platform
- Links: "Guide to earning with SERVI" and "Apply as a Partner"

---

## How It Works (3 Steps — for marketing/landing page)

1. **Choose your service** — Select a category and describe what you need
2. **SERVI Match** — We assign the closest verified specialist
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

1. Admin creates order in **Google Sheets** (Apps Script button)
2. Apps Script calls backend → creates Stripe PaymentIntent (manual capture / pre-auth)
3. Customer receives **payment link via WhatsApp**
4. Customer pays on `pay.html` (new card) or confirms on `book.html` (saved card, 1-click)
5. Card is **pre-authorized** (hold, not charged)
6. After service completion, admin **captures** the payment from Sheets
7. Saved-card customers get auto-pre-authorized 24h before service via hourly trigger

**There is currently NO customer-facing service discovery, browsing, or self-service booking UI.** Everything is initiated by the admin. The new landing page + on-demand booking is a NEW layer on top of this system.

### Deployment Topology

| Layer    | Host                   | Details                                                           |
| -------- | ---------------------- | ----------------------------------------------------------------- |
| Backend  | **Render** (Docker)    | `node backend/index.mjs`, auto-deploys on push to `main`          |
| Frontend | **Cloudflare Pages**   | Static HTML from `frontend/` folder                               |
| Database | **Neon** (PostgreSQL)  | Serverless Postgres, `pg` Pool connection                         |
| Admin    | **Google Apps Script** | Container-bound to Google Sheet, synced via `clasp`               |
| Payments | **Stripe**             | Pre-auth (manual capture), saved cards, off-session, 3DS fallback |

### Backend (`backend/`)

- **Runtime:** Node.js with ES modules (`.mjs` extensions only)
- **Framework:** Express 5
- **Entry point:** `backend/index.mjs` — ALL routes and business logic in one file (~2500 lines)
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

## What We're Building — Phase 1 (Full Scope)

A complete website rebuild + admin dashboard in one push. Four workstreams:

1. **Full public website** — 25+ pages replacing the Canva-hosted site entirely
2. **Service request intake** — Structured booking form + report/suggestion forms
3. **Admin dashboard** — Web-based admin panel (requests inbox, orders management, reports/suggestions)
4. **Backend additions** — New tables, endpoints, and webhook notifications

---

### ─── COMPLETE SITE MAP ───

All new files live in `frontend/`. All pages share a consistent new design language (Uber-inspired, light theme, Syne + DM Sans). Every page has: shared navbar, shared footer (4-column links), bilingual ES/EN toggle, mobile responsive.

**Text content:** Many pages have full text extracted from the PDFs in `/docs/`. Where content is available, use it. Where marked `[PLACEHOLDER]`, leave a clearly marked empty section for the developer to fill in later. Structure and layout matter more than copy.

#### 1. MAIN LANDING PAGE

**File:** `frontend/index.html`
Single-page scroll:

- Sticky navbar (SERVI. logo, nav links, ES/EN toggle, Login/Signup)
- Hero — Headline + "Solicitar servicio" CTA
- Service categories — 6 cards (Limpieza, Reparación y Mantenimiento, Bienestar y Cuidado Personal, Mantenimiento, Abastecimiento y Compras, Personalizado)
- How it works — 3-step (Choose → SERVI Match → Done)
- Why SERVI — Value prop + stats (500+, 98%, 50+, 24h)
- App preview section — "¡Muy pronto!" with phone mockup showing the service categories
- Testimonials — 3 reviews (Diego Flores, Patricia Espinoza, Valeria Sanchez)
- Provider recruitment — Dark section with "¿Eres proveedor?" CTA → links to Partners page
- Contact — Address, email, WhatsApp
- "Solicita tu servicio" floating/final CTA
- Footer

#### 2. HELP CENTER

**File:** `frontend/helpcenter.html`
Hub page with:

- Header: "Reporta Problemas o Comparte Ideas"
- Intro text about the Centro de Ayuda y Feedback
- Two CTA buttons: "Reportar Incidente o Problema" → opens report form, "Compartir Sugerencia o Idea" → opens suggestion form
- Footer

#### 3. REPORT INCIDENT FORM (replaces Google Form)

**File:** `frontend/helpcenter/report.html`
Form fields: name, email, phone, incident type (dropdown), description (textarea), date of incident, submit button.
Submissions go to `service_reports` database table + admin dashboard inbox + Sheets webhook.

#### 4. SHARE SUGGESTION FORM (replaces Google Form)

**File:** `frontend/helpcenter/suggestion.html`
Form fields: name, email (optional), suggestion category (dropdown), description (textarea), submit button.
Submissions go to same `service_reports` table (type: 'suggestion') + admin dashboard + Sheets webhook.

#### 5. QUIÉNES SOMOS (About Us)

**File:** `frontend/helpcenter/quienes-somos.html`
Full content from PDF page 2 of Help_Center.pdf:

- "¿Quiénes Somos?" heading
- Mission text (service evolution, connecting people with specialists)
- "Nuestro Punto de Vista" section
- "Lo que hacemos diferente" — 4 differentiators with icons:
  - Centralización
  - Gestión total
  - Más flexibilidad
  - Nosotros no ponemos los límites
- "Nuestra comunidad" section
- "¿Qué sigue?" section
- Footer

#### 6. CONTÁCTANOS (Help Center version)

**File:** `frontend/helpcenter/contactanos.html`

- Heading: "Contáctanos"
- "¿Tienes mas dudas o preguntas de como trabajar con SERVI?"
- WhatsApp CTA button → `https://wa.me/525525112588`
- Footer

#### 7. LEGAL (Tabbed/Accordion page)

**File:** `frontend/legal.html`
One page with 5 tabs or accordion sections:

- Términos y Condiciones de Uso — `[PLACEHOLDER: paste from Google Doc]`
- Aviso de Privacidad — `[PLACEHOLDER]`
- Política de Cancelación — `[PLACEHOLDER]`
- Aviso Legal — `[PLACEHOLDER]`
- Términos y Condiciones de Stripe — `[PLACEHOLDER]`

Each section has a clear heading and scrollable text area. Tabs switch between documents. The actual legal text will be pasted in later by the developer.

#### 8. PARTNERS LANDING

**File:** `frontend/partners.html`
Single-page scroll with anchor sections:

- **Hero:** "Impulsa tus ventas con SERVI" + "Sé parte de una comunidad exclusiva de especialistas reales y ofrece tus servicios a domicilio" + "Regístrate a SERVI" CTA
- **¿Qué es ser un SERVI Partner?** — 4 benefit cards:
  - 🔓 Libertad con estructura
  - 💬 Cero estrés, más enfoque
  - 🏅 Una comunidad, un estándar
  - 💵 Mayores Ingresos
- **¿Cómo ser Partner?** — 3 steps:
  1. Requisitos mínimos (18+, phone, WhatsApp)
  2. Tener especialidad comprobable
  3. Completar aplicación → link to registration form
- **Handbook CTA:** "¿Ya eres SERVI Partner? Échale un vistazo a nuestro manual" → links to Handbook
- Footer

#### 9. PARTNER REGISTRATION FORM

**File:** `frontend/partners/registro.html`
Form: name, phone, email, specialty/category (dropdown), city, experience description, submit.
Submissions go to `partner_applications` table + admin dashboard + Sheets webhook.

#### 10. PARTNERS HANDBOOK (Hub)

**File:** `frontend/handbook.html`

- Header: "Partners Handbook" + "Un manual para el SERVI Partner. Todo lo que necesitas saber para trabajar con excelencia dentro de la comunidad SERVI"
- 6 article cards linking to sub-pages:
  1. Guía comunitaria
  2. ¿Cómo prepararte para tu cita?
  3. Video demostrativo
  4. Los tipos de cambios en precio
  5. ¿Cómo se calcula tu calificación?
  6. ¿Cómo funcionan los pagos?
- Footer

#### 11. HANDBOOK: Guía Comunitaria

**File:** `frontend/handbook/guia-comunitaria.html`
Content from Handbook PDF page 2:

- 3 principles with icons: Trata a todos con respeto, Cuida tu seguridad y la de los demás, Cumple con las normas
- Full text for each principle
- Cross-navigation cards to other 5 handbook articles
- Footer

#### 12. HANDBOOK: Cómo prepararte para tu cita

**File:** `frontend/handbook/prepararte-cita.html`
Content from Handbook PDF page 3:

- 4 steps with illustrations: Revisa detalles, Herramientas listas, Celular con batería, Planea tu llegada
- Cross-navigation cards
- Footer

#### 13. HANDBOOK: Video demostrativo

**File:** `frontend/handbook/video-demostrativo.html`
Content from Handbook PDF page 4:

- "Cómo tomar una solicitud" heading
- Embedded video placeholder (or phone mockup with video screenshot)
- Text: "Una vez registrado como proveedor, mira este video para aprender como tomar tu primer solicitud con SERVI."
- Cross-navigation cards
- Footer

#### 14. HANDBOOK: Cambio de Precios

**File:** `frontend/handbook/cambio-precios.html`
Content from Handbook PDF page 5:

- "Si el precio cambia, notifícalo antes de continuar!"
- 4 types: Pieza adicional, Petición adicional, Tiempo adicional, Cambio de Servicio
- "También es importante" section (4 info blocks)
- Cross-navigation cards
- Footer

#### 15. HANDBOOK: Tu Calificación

**File:** `frontend/handbook/calificacion.html`
Content from Handbook PDF page 6:

- Intro about reputation and rating
- "¿Cómo se calcula por servicio?" — SERVI rating + Client rating = final
- "¿Cómo se calcula general?" — average across all services
- "¿Cómo mejorar?" — 5 tips
- Cross-navigation cards
- Footer

#### 16. HANDBOOK: ¿Cómo funcionan los pagos?

**File:** `frontend/handbook/pagos.html`
Content from Handbook PDF page 7:

- "Recibe tus pagos de forma rápida, clara y sin complicaciones"
- El monto exacto acordado
- Método de pago flexible (transferencia, efectivo)
- Tiempo de transferencia
- Historial de pagos vía WhatsApp
- Cross-navigation cards
- Footer

#### 17. HANDBOOK: Contáctanos

**File:** `frontend/handbook/contactanos.html`
Content from Handbook PDF page 8:

- Same WhatsApp CTA as Help Center contact
- Cross-navigation cards to all 6 handbook articles
- "¿Todavía no eres SERVI Partner verificado?" + CTA to Partners page
- Footer

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
  status TEXT DEFAULT 'pending',   -- pending, contacted, verified, rejected
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
   - Service requests (from booking flow)
   - Incident reports (from Help Center)
   - Suggestions (from Help Center)
   - Partner applications (from Partners page)
   - Filter by type, status, date
   - Quick status updates

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

### ─── DESIGN REFERENCE ───

- `servi-app.jsx` — React prototype with design system (re-implement in vanilla HTML/CSS/JS)
- `/docs/pdfs/` — PDF exports of all Canva pages (SERVI landing, Help Center, Partners, Handbook) — use for content reference
- `frontend/pay.html`, `book.html` — Reference for dark-theme admin dashboard styling

---

### ─── BUILD ORDER (Recommended) ───

1. **Database** — Create `service_requests`, `service_reports`, `partner_applications` tables
2. **Backend routes** — All new POST/GET/PATCH endpoints for requests, reports, applications, admin
3. **Shared CSS/JS** — Extract shared navbar, footer, i18n, and styles into `frontend/shared/` (e.g., `shared-styles.css`, `shared-nav.js`, `shared-footer.js`, `i18n.js`)
4. **Landing page** (`index.html`) — Full page with booking flow
5. **Help Center pages** (hub + report form + suggestion form + quiénes somos + contáctanos)
6. **Legal page** (tabbed accordion)
7. **Partners page** (landing + registration form)
8. **Handbook** (hub + 6 article pages + contáctanos)
9. **Admin dashboard** (`admin.html`)
10. **Integration testing** — Verify all forms submit correctly, Sheets webhook fires, existing payment pages untouched

---

### ─── KEY PRINCIPLES ───

1. **Do NOT break existing flows** — `pay.html`, `book.html`, `success.html`, `save.html`, all backend routes, Stripe webhooks, and Apps Script must continue working unchanged.
2. **Plain HTML/CSS/JS only** — No React, no build step, no bundler. Match existing `frontend/` patterns. CDN for libraries.
3. **Express + ESM conventions** — New routes in `.mjs`, use existing `pool`, follow `requireAdminAuth` pattern.
4. **Shared components** — Navbar, footer, and i18n should be reusable across all 25+ pages to avoid duplication.
5. **Uber-quality UX** on customer pages — Polished, intentional, professional.
6. **Mobile-first** — Most CDMX users are on phones.
7. **Bilingual** — ES/EN toggle, Spanish default. All customer-facing pages. Admin dashboard can be Spanish-only.
8. **Content placeholders** — Where text isn't provided, use clear `<!-- [PLACEHOLDER: Section title] -->` markers.
9. **Integrate, don't replace** — New intake feeds INTO existing pipeline. Dashboard reads FROM same database. Sheets continues in parallel.
