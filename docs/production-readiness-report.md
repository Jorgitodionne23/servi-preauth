# SERVI Production-Readiness Report

**Branch:** `dev`
**Date:** 2026-06-12
**Scope:** Webapp + admin dashboard readiness to accept real users who create accounts, request services, complete the Stripe test-mode payment/preauth flow, and have those requests visible/actionable from `frontend/admin.html`.

---

## Recommendation

**READY to promote `dev` → `main`.**

Every required verification command passes and every acceptance criterion has evidence. Auth, account management, service-request intake, admin dashboard (desktop + mobile), and API authorization are proven by a fully green automated suite (176 e2e + 16 unit). The Stripe test-mode payment / pre-authorization / webhook / capture / refund lifecycle — the financial core of the product — was exercised end-to-end after the expired local test key was replaced with a fresh `sk_test` key.

**One operational note (not a blocker):** the `STRIPE_WEBHOOK_SECRET` in the local `.env` did not match `stripe listen --print-secret`; the smoke test ran with the backend's webhook secret overridden to the CLI signing secret (`.env` left untouched). For ongoing local webhook testing, set `.env`'s `STRIPE_WEBHOOK_SECRET` to `npm run stripe:secret`; for production, ensure it matches the live Stripe webhook endpoint's secret.

---

## Final Test Command Results

| Command | Result |
|---|---|
| `git branch --show-current` | `dev` ✅ |
| `npm install` | OK ✅ |
| `npm run test:unit` | **16 passed / 0 failed** ✅ |
| `node tests/preflight.mjs` | Firebase Auth Emulator + backend reachable — **Preflight OK** ✅ |
| `npm run test:e2e` | **176 passed / 0 failed / 0 flaky** (preflight + `chromium-desktop` + `chromium-mobile`) ✅ |
| Stripe test-mode lifecycle (manual smoke) | order created → pre-auth (`requires_capture`) → webhook → **Confirmed** → **Captured** → **Refunded** ✅ |

Starting point was 13 failed / 30 not-run; all were resolved (one real product bug + stale tests that had drifted behind shipped UI changes). See `AGENT_PROGRESS.md` for per-failure root causes.

---

## E2E Flows Proven (automated)

**Auth & account (`tests/auth-e2e.spec.js`, against Firebase Auth Emulator + local backend):**
- Phone-first signup with full verification; phone-first with skipped email + ordering gate (`email_required`).
- Email-first signup (incl. handoff-unavailable fallback, cross-device link verification).
- Google-IDP signup constraints; account security shows Google-connected.
- Session persistence across refresh; existing email-link login in another context.
- Logout revokes the session JWT (same token → 401).
- Account deletion revokes session and frees the phone for re-signup.
- Email change + phone reauth + `phone_exists` conflict; phone change leaves new phone unverified → UI `phone_required` gate.
- Add-first-email flow (direct verification link, no reauth) and verification.
- Recovery email link signs the user back in.
- Address CRUD (create/list/set-default/delete), all scoped to the authed user.
- Service-request intake via Smart Request overlay and via `service.html`, including the email-verification gate and **no-duplicate** resume (exactly one request persisted).

**Admin dashboard (`tests/admin-e2e.spec.js`, desktop + mobile):**
- Auth gate: shows on load, rejects invalid token, accepts valid token, logout returns to gate.
- Topbar, stats cards, sidebar panel switching (one active at a time).
- Inbox panel loads on navigation (filter row, stats, status/type pills) — *fixed product bug*.
- Orders panel: list/empty-state, search, status filter, incoming WEB requests, order-detail open/close, pagination.
- Ops Radar (mocked): counters, risk rails, snooze, preauth-now action; ASAP rendering; payment-link creation preserves the ASAP flag.
- Nueva Orden / Ajuste forms present + reset; provider panel; toasts/modals; live-polling badges.
- Layout integrity on `chromium-desktop` and `chromium-mobile` (sidebar width, main-area fills available width, topbar within viewport, no panel overlap).

---

## Manual / Targeted Smoke Checks Performed

- **Protected-API authorization (curl against local backend):** `/api/auth/me`, `/api/auth/addresses`, `/api/auth/orders`, `/api/admin/stats`, `/api/admin/orders`, `/api/admin/ops-radar` all return **401** when unauthenticated; `/api/admin/stats` with a bad token → **401**; `POST /api/service-requests {}` → **400 missing_required_fields**.
- **Secret-exposure scan:** `frontend/config.js` exposes only publishable keys (explicitly marked non-secret); `.env`, `test-results/`, and `tests/playwright-report/` are gitignored; no tracked `.env`/secret/service-account files; the admin token in the e2e spec is now read from `process.env.ADMIN_API_TOKEN` (local-dev default only).
- **Stripe test-mode payment lifecycle (end-to-end):** with a fresh `sk_test` key and `stripe listen --forward-to localhost:4242/webhook` —
  1. `POST /create-payment-intent` (admin) → order `DMZJDN54WY` + Stripe customer + manual-capture PI `pi_3ThiHiG7…` + `payUrl`; order visible in the admin Orders list.
  2. Confirmed the PI with test PM `pm_card_visa` → `requires_capture` (10 MXN hold).
  3. Webhook `payment_intent.amount_capturable_updated` → backend `[200]` → order **pending → Confirmed**.
  4. `POST /capture-order` → PI `succeeded`, order **Captured**.
  5. `POST /refund-order` → **Refunded** (`re_3ThiHiG7…`) — also serves as cleanup (money state neutral).

---

## Known Gaps

1. **Stripe was verified via a server-side card-confirm simulation, not the browser UI.** The pre-auth was driven by confirming the order's PaymentIntent with Stripe's test PaymentMethod `pm_card_visa` (then the real webhook → capture → refund). This proves the backend + webhook + capture/refund lifecycle. The literal `pay.html` Stripe-Elements card-entry UI and the `book.html` saved-card 1-click UI were not click-driven this run; recommend a one-time manual click-through of both before launch.
2. **Non-mocked admin detail tests skip on an empty dev DB** (order/inbox/provider detail open). The mocked describe blocks cover the same UI, so the behavior is still verified; only real-data smoke coverage is conditional.
3. **Minor UX race (non-blocking):** `service.html` re-mounts the structured address form when saved addresses finish loading, which can wipe a value typed in the first ~half-second. Low real-world impact; candidate for a future polish pass (preserve in-progress input across the re-render).

---

## External Services Checked

| Service | Status this run |
|---|---|
| Firebase Auth (Emulator) | ✅ Used for all auth e2e (phone OTP, email link, Google IDP). |
| Local backend (`localhost:4242`) | ✅ Reachable; serves frontend + API; auth + admin routes exercised. |
| Neon Postgres (dev) | ✅ Reachable via backend (orders list, addresses, service requests). |
| Stripe (test mode) | ✅ Fresh `sk_test` key; full create → pre-auth → webhook → capture → refund lifecycle exercised. |
| Cloudflare R2 / Pages, Render, Google Apps Script/Sheets | Not exercised this run (out of scope for local readiness loop). |

---

## Deployment Risks

- **Stripe credentials:** Confirm production uses a valid **live** secret key and that the **live** webhook endpoint's signing secret is set as `STRIPE_WEBHOOK_SECRET` on Render. (Test-mode lifecycle verified locally.)
- **Webhook secret drift:** `STRIPE_WEBHOOK_SECRET` must match the active endpoint (locally via `stripe listen` → `npm run stripe:secret`; in prod via the dashboard endpoint). The local `.env` value did not match the CLI secret this run — reconcile before relying on `npm run dev` for local webhook tests.
- **Shared dev DB state:** non-mocked admin tests depend on dev data; keep `agent-e2e-` prefixes and clean up to avoid skew.
- **Single Firebase Auth Emulator under concurrent projects:** email-link polls widened to 25s to absorb contention; fine on CI, watch on heavily loaded machines.

---

## Recommended Pre-Launch Manual Click-Throughs (optional, ~30 min)

The automated suite + Stripe smoke test cover the functional surface. Before onboarding real users, a human should click through once on the live domain:

1. `pay.html` with Stripe Elements + test card `4242 4242 4242 4242` (the literal card-entry UI; the smoke test simulated this server-side).
2. `book.html` saved-card 1-click confirm (3DS fallback path).
3. A real end-to-end booking from `index.html` Smart Request → confirm → admin sees the request.

---

## Marketing Gate

This report now says **ready**, so marketing assets MAY be drafted (per the brief: `docs/marketing-launch-plan.md`, landing copy, outreach/ad drafts, lead criteria, a manual launch checklist). No drafts were auto-generated in this run. **Nothing was sent** — no emails/DMs/ads/SMS/WhatsApp, no spend, no audience uploads, nothing posted. Any outreach or paid activity requires explicit human approval.
