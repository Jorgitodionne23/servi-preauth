# SERVI — Production Readiness Checklist

Audit date: 2026-07-02. Each item explains, in simple terms, what needs work before real customers use the platform. Ordered by priority.

**Status (2026-07-02):** items 2, 3, 4 done; item 5 half done (CI workflow added, live smoke test still pending). Items 1 (new WhatsApp number) and 6 (pick an error tracker) need account/ops decisions outside the code.

---

## 🔴 Blockers — must be resolved before launch

### 1. Replace the WhatsApp number
**What's wrong:** The old business number (`525525112588`) was resold and now reaches a stranger. Payment links are delivered *via WhatsApp* — the core payment flow has no delivery channel right now (email is a stopgap).
**The fix:** Get a new phone number + WhatsApp Business account. Then one edit in `frontend/config.js`: set the new `WHATSAPP_NUMBER` and flip `CONTACT_MODE` back to `'whatsapp'`.

### 2. Patch vulnerable dependencies ✅ DONE
**What's wrong:** `npm audit` reports **22 vulnerabilities (1 critical, 6 high)** in production dependencies: `protobufjs` (critical — arbitrary code execution, pulled in by Firebase Admin), `multer` (DoS via uploads — SERVI accepts file uploads), `nodemailer` (SMTP command injection), `path-to-regexp` (ReDoS), `form-data`, `@grpc/grpc-js`.
**The fix:** Run `npm audit fix` (all have non-breaking fixes available), rerun the unit tests, and smoke-test auth + uploads since Firebase Admin and multer are touched.
**Done:** `npm audit fix` applied + `nodemailer` bumped 6.x → 9.x (same `createTransport`/`sendMail` API). Production deps now have **0 critical/high**; 8 moderates remain, all transitive under `firebase-admin`'s Google Cloud chain (needs an upstream release — `--force` would break firebase-admin). Unit tests pass.

### 3. Add security headers to the backend ✅ DONE
**What's wrong:** Express serves everything with no `helmet`, no HSTS, no `X-Frame-Options`, no Content-Security-Policy. This leaves the payment pages more exposed to clickjacking and injection than they need to be.
**The fix:** Add `helmet` with a config that doesn't break Stripe.js, Firebase, or Google Fonts, and verify `pay.html` / `book.html` still work.
**Done:** `helmet` added in `backend/index.mjs` (CSP and COOP deliberately off — CDN scripts and Google Sign-In popups need them; HSTS, nosniff, frameguard, etc. on). Production pages are served by Cloudflare Pages, so a `frontend/_headers` file adds the same protections there. Verify payment + login flows during the live smoke test (item 5).

### 4. Provider capability links never expire ✅ DONE
**What's wrong:** The new `provider.html` link (`?order=…&pt=…`) is a bearer token stored in `all_bookings.provider_link_token`. `resolveProviderLinkOrder()` checks the token but **never checks `provider_link_created_at`** — a leaked or forwarded link works forever, letting anyone check in, share location, or file price-change requests on that order.
**The fix:** Reject tokens older than a sensible TTL (e.g., valid until ~48h after the service date) and/or clear the token once the order reaches a terminal status. Admin can already rotate links, so expiry is cheap to add.
**Done:** new `backend/providerLink.mjs` policy, enforced in `resolveProviderLinkOrder()` (covers all `/api/provider/*` endpoints): links die immediately on refunded/declined/canceled orders, stop working 72h after the service date, and fall back to a 14-day lifetime from mint for orders with no parseable date. Unit-tested in `backend/providerLink.test.mjs`.

### 5. End-to-end smoke test on the live domain 🟡 CI DONE, SMOKE TEST PENDING
**What's wrong:** Already flagged in the project brief — no full pass over the real production stack has been done. Playwright e2e specs exist (`tests/`) but nothing runs them in CI; only the preauth cron has a workflow.
**The fix:** One scripted pass on the live domain: phone OTP, email magic link, Google OAuth, browse → service → confirm booking, payment link (new card + saved card), capture/refund in admin, and the new provider link flow. Then add a GitHub Actions workflow that runs `test:unit` (and ideally the e2e suite against staging) on every push.
**Done so far:** `.github/workflows/tests.yml` runs unit tests + a high/critical dependency audit on every push/PR to `main`/`dev`. (Also fixed `eslint.config.js`, which was broken by a stray CommonJS block and made `npx eslint` unusable.) The manual live smoke test is still pending.

### 6. Production error visibility
**What's wrong:** The backend logs errors with ~230 `console.*` calls. If Stripe captures start failing at 2 a.m., nobody finds out unless they read Render logs. The only alerting that exists is the preauth cron filing a GitHub issue on failure.
**The fix:** Add an error tracker (e.g., Sentry free tier — one `npm install` + a few lines) or at minimum a Render log-based alert, so payment/auth failures notify someone instead of scrolling by.

---

## 🟡 Strengthen — should be done soon after (or alongside) launch

### 7. Finish the admin migration off Google Apps Script
**What's wrong:** Order creation still requires the legacy Apps Script + Google Sheet. That's a manual-deploy single point of failure sitting in the middle of the money flow.
**The fix:** Bring order creation into `admin.html` + the backend (capture/cancel/refund are already there), then retire the Sheets path.

### 8. Real legal copy review
**What's wrong:** `legal.html` now embeds Google Docs via iframes — better than placeholders, but the content depends on those Docs staying public and unedited, and iframed Docs are poor on mobile.
**The fix:** Confirm the four documents are lawyer-reviewed and final, verify the share settings, and consider rendering the text as real HTML so it can't silently break or disappear.

### 9. Database safety net
**What's wrong:** There's no documented backup/restore story for the Neon database that holds every order and customer.
**The fix:** Verify Neon's point-in-time restore is enabled on the production branch, note the retention window, and do one practice restore.

### 10. Rate-limit coverage check on public provider endpoints
**What's wrong:** `/api/provider/*` endpoints share `publicFormLimit` (5/min/IP). Combined with the non-expiring token (item 4) that's thin protection; also worth confirming `/api/parse-request` (paid Claude API calls) has its own limit so someone can't run up the Anthropic bill.
**The fix:** After fixing item 4, confirm each unauthenticated endpoint has a limiter appropriate to its cost.

---

## 🟢 Noted — known debt, not launch-gating

- **`pay.html` / `book.html` ~60% duplication** — refactor into a shared component when convenient (already tracked in the brief).
- **`backend/index.mjs` is ~10,100 lines** — splitting routes into modules would ease maintenance; risky to do right before launch, defer.
- **Unit tests pass today** (28/28 via `npm run test:unit`) — keep it that way by wiring them into CI (see item 5).

---

## Suggested execution order

1. `npm audit fix` + helmet (items 2, 3) — small, mechanical, high value.
2. Provider link expiry (item 4) — small backend change.
3. Error tracking (item 6) — small setup.
4. CI workflow for tests (part of item 5).
5. WhatsApp number (item 1) — external/ops task, can run in parallel.
6. Live smoke test (item 5) — after 1–4 land.
7. Items 7–10 scheduled after launch confidence.
