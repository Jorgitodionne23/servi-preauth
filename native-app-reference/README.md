# SERVI — Native App Design Reference

A **high-fidelity, runnable customer-app prototype** for [SERVI](../CLAUDE.md) — the
on-demand home-services platform for Santa Fe, Cuajimalpa de Morelos (CDMX). Built with
**Expo + React Native + TypeScript** to explore what SERVI feels like as a polished native
mobile app, before committing to a production React Native build.

> ⚠️ **This is a design reference, not a product.** It uses **mocked data and local
> fixtures only**. It does **not** connect to Firebase, Stripe, Neon, Cloudflare R2, or any
> production SERVI service. It creates **no real payments**. It is fully isolated from the
> web app in `../frontend` and `../backend` — it imports nothing from them and is imported
> by nothing.

---

## The other half

This app has a counterpart: [`../partner-app-reference`](../partner-app-reference/README.md),
the **specialist (SERVI Partner)** app. The two are designed to be one product seen from two
sides — they share a design system, a frozen demo clock, the real pricing engine, and three
order IDs (`SV-204815`, `SV-204766`, `SV-204701`). The full mapping and the production spec
live in **[../INTEROP.md](../INTEROP.md)**.

**Run both side by side** (customer left, specialist right):

```bash
# terminal 1
cd native-app-reference  && npx expo start --web --port 8081
# terminal 2
cd partner-app-reference && npx expo start --web --port 8082
```

Open **SV-204701** in both. The customer sees it *assigned to Pablo M.*; the specialist *is*
Pablo — tap **Voy en camino → Llegué → Empecé** on the partner side (or use the customer
app's Account → Demo states → **Avanzar fase**) and the customer's on-site timeline ticks in
lockstep. Set your machine to a non-CDMX timezone for one run — the clock is CDMX-fixed, so
both apps still agree.

> **Deliberate asymmetry:** the partner app has a "Why SERVI" value screen; this app does
> not. The customer-facing version of that argument lives on the marketing site
> (`../frontend/index.html`), not inside the transactional app.

Shared files are kept byte-identical by `../scripts/check-app-sync.mjs` — run
`npm run check:sync`.

---

## Run it

Prereqs: Node 18+ and npm (developed against Node 22.17, npm 10.9).

```bash
cd native-app-reference
npm install
npx expo start
```

Then:

- **Web (recommended for review):** press `w`, or run `npm run web`. Opens in the browser;
  the design is phone-width and still feels native (tab bar, sheets, safe areas).
- **iOS simulator:** press `i` (requires Xcode on macOS).
- **Android emulator:** press `a` (requires Android Studio).
- **Real device:** install **Expo Go** and scan the QR code.

To produce a static web build (what CI/verification uses):

```bash
npx expo export --platform web   # outputs to dist/
```

---

## What you can click through

The first screen is **usable product UI** (a Smart Request entry), not a marketing page.
Spanish is the default language; toggle ES/EN from the pill in any tab header.

| Area | Route | What it shows |
|------|-------|---------------|
| **Home / Smart Request** | `app/(tabs)/index.tsx` | "Describe, show, or say what you need" — text prompt box + voice/photo/video entry tiles, category shortcuts, and a floating **active-order dock**. |
| **Browse** | `app/(tabs)/browse.tsx` → `browse/[category]` → `browse/service/[key]` | Category cards, live **search** across the catalog, subcategory lists, and a service-detail preview with "Request this". |
| **Request builder** | `app/request/{compose,build,address,review,submitted}` | Capture references (voice waveform, photo grid, video) → **"Here's what I understood"** + match %, follow-up chips, ASAP vs scheduled date/time → address picker → **review & confirm** with the payment/pre-auth reference → **submitted / match pending**. |
| **Auth gate** | `app/auth/{identifier,otp,name,verify-email}` | Unified phone/email + Google concept, dynamic phone/email **OTP**, name collection, and the returning-user **email-verification booking gate**. Faithful to `../docs/AUTH_STATE_MACHINE.md`. |
| **Orders** | `app/(tabs)/orders.tsx` | Active vs Past lists of the customer's orders. |
| **Active order** | `app/order/[id].tsx` | Full lifecycle view: status header, **timeline**, matched specialist, summary, price breakdown, and a payment reference that adapts to state — **pending / scheduled / confirmed (card held) / assigned / in-progress / completed / captured / refunded / cancelled / blocked**. |
| **Account** | `app/(tabs)/account.tsx` → `account/addresses` | Profile, saved CDMX addresses (CRUD), **saved-payment-method reference**, order history, language toggle, help, and the **Partner secondary CTA**. |
| **Payment & pre-auth reference** | `app/payment-info.tsx` | UI-only explainer of the whole model (below). |
| **Help / Partner** | `app/help.tsx`, `app/partner.tsx` | Email contact (matches the web `CONTACT_MODE='email'` stopgap) + FAQ; Partner entry as a **secondary CTA only** (no full provider app). |

### Payment & pre-authorization — represented accurately, with NO Stripe

Every payment surface shows a **"Reference prototype — no real payments"** disclaimer and
explains the real model (see `src/data/paymentModel.ts`, mirroring CLAUDE.md's *Booking
Lead-Time Guardrails*):

- **Card hold, not a charge** — pre-authorize, capture after the service.
- **Payment link** for a first-time card.
- **Saved-card + consent** for automatic future bookings.
- **Auto pre-auth ~24 h before** the service (the customer does nothing).
- **5+ days out requires a saved card.**
- **Visits to quote always require a saved card.**

The review screen has a "saved card / no card" toggle so you can preview each pre-auth path.

---

## What is mocked (everything)

| Concern | In this prototype | In production |
|---------|-------------------|---------------|
| Auth | `src/state/AppStateContext.tsx` — starts signed-in as a mock user; the auth flow is a clickable reference | Firebase Auth + the custom HS256 session JWT (`/api/auth/*`) |
| Smart Request parse | `src/data/matcher.ts` — local keyword heuristic | `POST /api/parse-request` (Claude) + client heuristic fallback |
| Service catalog | `src/data/catalog.ts` — ported from `frontend/shared/browse-data.js` + `frontend/smart-request/catalog.js` | Same source data, served/owned by the backend |
| Orders & status | `src/data/mockData.ts` — one order per lifecycle state | `all_bookings` + Stripe webhooks |
| Payments | UI references only (`paymentModel.ts`, `PaymentConceptCard`) | Stripe PaymentIntents (manual capture), saved cards, off-session |
| Addresses | in-memory CRUD | `/api/auth/addresses` |
| Media capture/upload | simulated (timers, placeholders) | `getUserMedia` + `POST /api/uploads` → Cloudflare R2 |
| Persistence | none (in-memory; resets on reload) | backend DB + token in storage |

No secrets, keys, or network calls to any SERVI service exist anywhere in this folder.

---

## Design system

Ported from the live web app so the native app reads as the same brand:

- **Tokens** — `src/theme/tokens.ts` (colors, radii, spacing, shadows, motion) mirror
  `frontend/shared/shared-styles.css`. Ink-forward palette, restrained teal accent.
- **Type** — `src/theme/typography.ts`: **Outfit** (display) + **Plus Jakarta Sans** (body),
  via `@expo-google-fonts`. Same pairing as the web.
- **Icons** — Feather via `@expo/vector-icons` (matches the web's 1.7px-stroke Feather look).
- **Motion** — `react-native-reanimated` entrances + press-scale; `expo-haptics` (no-op on web).
- **Components** — `src/components/ui/*` (Button, Card, Chip, Input, Badge, BottomSheet,
  SegmentedControl, rows, states, logo) + domain components (`OrderCard`, `StatusTimeline`,
  `SmartRequestBox`, `ActiveOrderDock`, `ServicePicker`, …).

---

## Project structure

```
src/
  app/                 # expo-router routes (see the table above)
  components/           # ui/ primitives + domain components
  data/                 # catalog.ts, matcher.ts, mockData.ts, paymentModel.ts, types.ts
  i18n/                 # strings.ts (ES/EN) + I18nContext (ES default)
  state/                # AppStateContext (mock session, draft, orders, addresses)
  theme/                # tokens.ts, typography.ts
```

---

## Verification (this build)

Run from `native-app-reference/`:

| Command | Result |
|---------|--------|
| `npm install` | ✅ installs (Expo SDK 56, RN 0.85, React 19) |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx eslint src` | ✅ 0 errors, 0 warnings |
| `npx expo export --platform web` | ✅ bundles; **all 26 routes statically render to HTML** (every screen renders without runtime errors) |

After the build passed, an **adversarial multi-agent review** swept the prototype across four
dimensions (runtime/expo-router correctness, design quality & contrast, SERVI-flow
faithfulness, and brief completeness). 13 confirmed findings were fixed — a broken avatar
route, an off-by-one in the pre-auth lead-time boundary, WCAG-AA contrast on badges/captions,
two emoji/glyph-as-UI uses replaced with the icon system, plus making the **offline**,
**error**, **blocked**, and **visit-requires-card** states actually reachable (Account → Demo
states; review screen visit toggle; a blocked mock order). All three checks above were re-run
green afterward.

**Not run here:** native iOS/Android simulator launches (no simulator in this environment).
Expo Web is the verification path; `i`/`a` work locally with Xcode/Android Studio installed.

---

## What to revisit before production

This is a **design reference**. Before turning it into a shippable app:

1. **Wire real services** — replace `AppStateContext` + `matcher.ts` + `mockData.ts` with
   the SERVI backend (`/api/auth/*`, `/api/parse-request`, `/api/service-requests`,
   addresses, orders) and Firebase Auth. See `DESIGN_HANDOFF.md` for the integration map.
2. **Real Stripe** — implement the actual pre-auth / saved-card / 3DS flows. Today it is
   reference UI only.
3. **Real media** — `getUserMedia` for voice/video, image picker + R2 uploads for photos.
4. **Persistence** — store the session/JWT and language choice (e.g. `expo-secure-store` +
   `AsyncStorage`); the prototype is in-memory and resets on reload.
5. **Native date/time pickers** — the builder uses quick-select chips; swap for real pickers.
6. **Accessibility** — audit labels, focus order, dynamic type, and contrast.
7. **Deep links / push / offline** — wire `scheme: servi` links and push for order updates.
   The **offline** and **error** states are reachable in the prototype via **Account → Demo
   states** (toggles that drive the app-wide offline banner and a simulated request-parse
   failure with retry); swap the demo toggle for a real **NetInfo** detector + real fetch
   errors in production.
8. **i18n completeness** — `src/i18n/strings.ts` covers these screens; expand and reconcile
   with `frontend/shared/i18n.js` for full parity.
9. **Design QA on device** — verify fonts, blur, safe areas, and motion on real iOS/Android.
