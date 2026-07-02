# SERVI Native App — Design Handoff

A short companion to [`README.md`](./README.md) for the designer / founder reviewing this
prototype and the React Native engineer who will eventually productionize it. It records the
**product assumptions** baked into the prototype, the **backend integration points** a real
build must wire, and the **open questions** that need a decision.

This is a **customer-app design reference** — mocked data only, no live services, no real
payments, no admin/provider app. See README for the isolation guarantees.

---

## 1. Product assumptions made

These are choices made to keep the prototype coherent. Confirm or correct each before build.

### Navigation & IA
- **Four bottom tabs**: Inicio (Smart Request), Explorar (Browse), Pedidos (Orders), Cuenta
  (Account). The request builder and auth are **modal stacks** over the tabs; order detail,
  category, and service detail **push** as full-screen cards.
- **The first screen is product UI**, not marketing — Smart Request entry with category
  shortcuts and the active-order dock. No landing-page hero/testimonials in the app.

### Smart Request
- Four input modes mirror the web: **text, voice, photos, video**. Voice/photos run a mocked
  "AI understood" path; **video is admin-review** (no AI parse, no follow-ups) — matching the
  web Smart Request handoff.
- The matcher (`src/data/matcher.ts`) is a **local keyword heuristic** standing in for the
  Claude parse. It returns the same shape (service, summary, confidence, follow-ups) so the UI
  is production-faithful even though the intelligence is fake.
- Match confidence ≥ 70% shows an accent badge; below shows an amber/"pending" badge.

### Auth & booking gate
- Models the dual-identifier flow from `docs/AUTH_STATE_MACHINE.md`: unified phone/email entry,
  dynamic phone/email OTP, required name, optional secondary identifier.
- **Booking gate**: phone verification is always required; a verified email is required for
  returning users / subsequent orders. Surfaced on the verify-email screen and the account
  "email verified" badge. The prototype does not enforce it on submit (no real backend).

### Orders & payments
- A new request is created as **`pending`** ("match pending") — consistent with the real flow
  where admin matches a provider and creates a payment link. Price starts **unconfirmed**
  ("we confirm the price first").
- Lead-time → pre-auth path follows `src/data/paymentModel.ts` (CLAUDE.md guardrails):
  `<5 days, no card → immediate link`; `saved card, >24h → auto pre-auth ~24h before`;
  `saved card, <24h → confirm now`; `≥5 days or visit, no card → needs saved card (blocked)`.
- Mock pricing uses a simple provider→fee→processing→total model for display only; the real
  numbers come from `backend/pricing.mjs`.

### Brand & locale
- Spanish default, EN toggle. CDMX / Santa Fe addresses. Contact routed to **email**
  (mirrors the web `CONTACT_MODE='email'` stopgap while the WhatsApp number is replaced).

---

## 2. Backend integration points (map for productionization)

Replace the mock layer (`src/state/AppStateContext.tsx`, `src/data/matcher.ts`,
`src/data/mockData.ts`) with these real calls. Endpoints below already exist in
`backend/index.mjs`.

| Prototype touchpoint | Real endpoint / service | Notes |
|----------------------|-------------------------|-------|
| `signIn()` / auth flow | Firebase Auth → `POST /api/auth/firebase` | Verify Firebase ID token → custom HS256 JWT (24h). Store JWT in `expo-secure-store`. |
| Identifier check | `POST /api/auth/check-identifier` | Decide signup vs login + which OTP. |
| Add secondary identifier | `POST /api/auth/add-email` / `add-phone` | Booking-gate completion. |
| Session bootstrap / gate | `GET /api/auth/me` | Returns `phone_verified`, `email_verified`, `first_identifier_type`. |
| Session refresh / logout | `POST /api/auth/refresh` / revoke | Rotate `jti`; handle `401 token_revoked` → clear + re-auth. |
| Smart Request parse | `POST /api/parse-request` | Claude proxy; keep the client heuristic as fallback. |
| Voice / photo analysis | `POST /api/parse-media` (Phase 2) | STT + vision; returns same parse shape + transcript/caption. |
| Media uploads | `POST /api/uploads` → Cloudflare R2 | Replace simulated capture with real `getUserMedia` + picker. |
| Submit request | `POST /api/service-requests` | Send the additive Smart Request metadata (requestMode, matchedService, aiSummary, etc.). Enforces the booking gate (409 `email_required` / `phone_required`). |
| Orders list / detail | `GET /api/auth/orders` (+ order status) | Status transitions arrive via Stripe webhooks server-side. |
| Addresses CRUD | `GET/POST/PATCH/DELETE /api/auth/addresses` | Already structured like the prototype's `SavedAddress`. |
| Payments | Stripe PaymentIntents (manual capture), saved cards, off-session, 3DS | The prototype shows concepts only. Reuse `pay.html`/`book.html` logic patterns; **do not restyle the existing web payment pages**. |
| Pricing | `backend/pricing.mjs` (`computePricing`) | Replace the mock price math. |

### Status mapping
`src/data/types.ts → OrderStatus` is a customer-facing superset. Map backend statuses
(`pending`/`Scheduled`/`Confirmed`/`Captured`/`Refunded`/`Blocked`, order kinds
`primary`/`book`/`setup`/`setup_required`) onto it in one adapter; keep `src/components/status.ts`
as the single display-label source (mirrors the web per-surface label approach).

---

## 3. Open questions (need a decision)

1. **Navigation library** — `expo-router` (used here) vs bare React Navigation for the real
   build? expo-router gave clean file-based routing; confirm it's the target.
2. **State management** — the prototype uses React Context. For real data + caching, pick
   React Query / Zustand / Redux Toolkit before scaling.
3. **Video request UX** — keep "admin reviews the clip" (no in-app AI), or add on-device/edge
   analysis later? Drives whether video gets follow-ups.
4. **In-app payments vs links** — does the native app embed Stripe (PaymentSheet) for the
   first-card flow, or keep the web payment-link handoff? Affects PCI scope and the order
   detail "Authorize card" action.
5. **Trusted-specialist / rebook** — the web has anti-disintermediation (save a specialist,
   contact only through SERVI). The prototype hints at it (specialist card, "request again");
   confirm how much of that belongs in v1.
6. **Recurring / calendar plans** — the web has a service calendar + recurring plans. Not in
   this prototype; decide if/when the native app surfaces them.
7. **Provider/Partner scope** — kept here as a secondary CTA only. Confirm there is **no**
   in-app provider experience for v1 (separate app/flow later).
8. **Offline & push** — expected depth for launch? The offline + error states are wired to a
   demo toggle (Account → Demo states), not yet to NetInfo / real fetch errors; no push yet.
9. **Design tokens drift** — the web has two slightly different teals (`#7fc4cf` in
   `shared-styles.css` vs `#95CCD5` in the Smart Request handoff). The prototype standardized on
   the `shared-styles.css` system; confirm the canonical brand palette.

---

## 4. Faithfulness notes

- Catalog data (labels, example services, follow-ups, keywords) is ported verbatim from
  `frontend/shared/browse-data.js` and `frontend/smart-request/catalog.js`.
- Tokens/fonts/icons match the web design system (`shared-styles.css`, Outfit + Plus Jakarta
  Sans, Feather).
- Flow logic references: `docs/AUTH_STATE_MACHINE.md` (auth), CLAUDE.md *Booking Lead-Time
  Guardrails* (pre-auth), `design_handoff_smart_request/README.md` (compose → build → success).
