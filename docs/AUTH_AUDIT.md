# Auth Infrastructure Audit

**Date:** 2026-05-07
**Scope:** Firebase Auth + custom JWT session layer (Phase 2 build)
**Method:** Code review of [backend/index.mjs](../backend/index.mjs), [frontend/shared/shared-auth.js](../frontend/shared/shared-auth.js), [frontend/account.html](../frontend/account.html), [backend/db.pg.mjs](../backend/db.pg.mjs), validated against current Firebase Auth guidance via Context7 (`/llmstxt/firebase_google_llms_txt`).

Companion: [auth-flows.html](./auth-flows.html) — visual diagrams of every flow.

## Status (2026-05-07)

**Fixed in this session (10 of 12):** A1, A4, A5, A6, A7, A9, A10, A11, A12, plus partial A6 covers logout revocation.
**Deferred:** A2 + A3 (cookie/CSRF migration — large multi-file change, requires explicit go-ahead because it logs out every existing user). A8 (identifier enumeration — current design is a deliberate UX↔privacy trade-off requiring product input on the cross-identifier merge UX).

Smoke-tested locally: revoked tokens return 401, refresh rotates jti, logout writes `auth_events` and revokes server-side, production startup throws if `JWT_SECRET` or `FIREBASE_SERVICE_ACCOUNT_JSON` are missing.

---

## Findings

12 issues. Severity in headers. Each finding has a `file:line` anchor.

### CRITICAL

#### A1. ✅ FIXED — JWT secret falls back to Stripe webhook secret, then to a hardcoded string

**File:** [backend/index.mjs:59](../backend/index.mjs#L59)

```js
const JWT_SECRET = process.env.JWT_SECRET
  || process.env.STRIPE_WEBHOOK_SECRET
  || process.env.ADMIN_API_TOKEN
  || 'servi-fallback-auth-secret';
```

Two distinct problems:

1. If `JWT_SECRET` env is unset (current state per startup warning), the session signing key is `STRIPE_WEBHOOK_SECRET`. Rotating Stripe's webhook secret — a routine ops action — silently invalidates every active user session.
2. The literal string `'servi-fallback-auth-secret'` is in the source tree. Anyone running this code without env vars (local dev, a misconfigured staging env) produces forgeable tokens. The string is also in git history forever.

**Recommendation:** require `JWT_SECRET` at startup in production; remove the hardcoded fallback entirely.

---

### HIGH

#### A2. Custom JWTs stored in `localStorage`, readable by any XSS

**Files:** [frontend/shared/shared-auth.js:129](../frontend/shared/shared-auth.js#L129), [frontend/account.html:488](../frontend/account.html#L488)

`servi_user_session` (JWT + user record + Firebase UID) is written to `localStorage` and read for sensitive ops (delete account, change password, address CRUD). Any XSS — including a third-party script on the same origin — can read the JWT and use it for the full 7-day TTL.

Firebase's documented pattern is `httpOnly; Secure; SameSite=Lax` session cookies created via `createSessionCookie()` (Context7 — Firebase Admin SDK manage-cookies docs).

#### A3. No CSRF protection on state-changing endpoints

**Files:** all `PATCH`/`DELETE`/`POST` routes under `/api/auth/*`

CSRF is not currently exploitable because the JWT lives in `localStorage` and is sent via `Authorization: Bearer …` (browsers don't auto-attach this). **The moment cookies are introduced (per A2), CSRF becomes immediately exploitable.** Firebase's `createSessionCookie` example pairs the cookie with a CSRF token (double-submit pattern) for exactly this reason — both fixes must ship together.

#### A4. ✅ FIXED — Phone re-verification bypass on profile edit

**File:** [backend/index.mjs:4883-4927](../backend/index.mjs#L4883-L4927) (`PATCH /api/auth/me`)

A user can change their phone number without OTP and the server does **not** reset `phone_verified` to `false`. Booking gate requires `phone_verified=true`, so a user can swap to an arbitrary phone they don't own and still book.

**Recommendation:** on phone change, set `phone_verified=false` and require the new number to pass the OTP flow before bookings re-enable.

#### A5. ✅ FIXED — Email verification trusted from another tab via `localStorage`

**File:** [frontend/shared/shared-auth.js:319-341](../frontend/shared/shared-auth.js#L319-L341)

Cross-tab handoff after the email verification link is clicked uses `localStorage.servi_email_verified_at`. The frontend treats the presence of this key as proof of verification. A malicious script (or a service-worker poisoning attack) can write the key without any backend confirmation and bypass the email-verified gate.

**Recommendation:** trust only the backend's authoritative `email_verified` flag returned by `GET /api/auth/me`. The localStorage key may stay as a UX trigger (refresh state) but must not gate access.

---

### MODERATE

#### A6. ✅ FIXED — JWT TTL is 7 days, no refresh, no server-side revocation

**File:** [backend/index.mjs:66](../backend/index.mjs#L66)

```js
const fullPayload = { ...payload, iat: now, exp: now + (7 * 24 * 60 * 60) };
```

CLAUDE.md says 30 days; reality is 7. Either way: Firebase ID tokens are 1h with auto-refresh — the SERVI custom JWT has neither short TTL nor a revocation list. Logout ([shared-auth.js:1376](../frontend/shared/shared-auth.js#L1376)) clears `localStorage` but the JWT remains valid server-side until expiry. Stolen → valid for a week.

**Recommendation:** drop TTL to ~1h; add a `revoked_sessions` table keyed on a `jti` claim, or migrate to Firebase session cookies (`verifySessionCookie(cookie, checkRevoked=true)`).

#### A7. ✅ FIXED — `requireRecentAuth` accepts 5-minute-old Firebase tokens

**File:** [backend/index.mjs:4848](../backend/index.mjs#L4848)

```js
async function requireRecentAuth(req, res, maxAgeSecs = 300) { … }
```

Firebase's session-cookie example uses 5min as a **one-shot** at session-cookie creation, not as ongoing re-auth for every sensitive action. A 4-minute-old token can authorize a phone change. For destructive operations, reduce to ~60s or require a fresh Firebase reauthentication.

#### A8. Account / identifier enumeration

**File:** [backend/index.mjs:4800-4881](../backend/index.mjs#L4800-L4881) (`/api/auth/resolve-identifier-mismatch`), [backend/index.mjs:4889](../backend/index.mjs#L4889) (`409 email_exists`)

`resolve-identifier-mismatch` returns distinct payloads for "phone has orphan account" vs "new account". `PATCH /api/auth/me` returns `409 email_exists` only when an email is taken. Combined, an attacker can map phone↔email pairs across the platform.

**Recommendation:** normalize responses (always 200 + neutral message); send any disambiguation cues out-of-band (email/SMS).

#### A9. ✅ FIXED — SMS bombing risk — no per-identifier rate limit

**Files:** [backend/index.mjs:605-615](../backend/index.mjs#L605-L615) (`publicFormLimit` = 5/min/IP)

Rate limits are per-IP only. A botnet rotating IPs can request unlimited OTPs to a single victim's phone number. Firebase's built-in App Check / reCAPTCHA helps but is not an app-level cap.

**Recommendation:** add a Postgres-backed bucket keyed on the normalized phone/email identifier (e.g., max 3 OTP/hour per phone, 10/day).

#### A10. ✅ FIXED — Firebase token revocation depends on service-account credentials

**File:** [backend/index.mjs:47-53](../backend/index.mjs#L47-L53)

Without `FIREBASE_SERVICE_ACCOUNT_JSON`, `verifyIdToken(idToken, true)` cannot consult the revocation list. There is a `console.warn` but no startup fail.

**Recommendation:** make startup hard-fail if the env var is missing in production.

---

### LOW

#### A11. ✅ FIXED — Pending-logout state is racey

**File:** [frontend/shared/shared-auth.js:82-103](../frontend/shared/shared-auth.js#L82-L103)

Cross-tab logout coordination via `localStorage.servi_pending_logout`. Edge cases (slow Firebase signout, multiple tabs, private mode) can leave a half-logged-out session.

#### A12. ✅ FIXED — No audit log for sensitive auth actions

No DB row written for: password change, phone change, email change, login from new device, account delete. Forensics on a compromised account are impossible.

**Recommendation:** add an `auth_events` table — `(user_id, event_type, ip, user_agent, created_at, metadata jsonb)` — and write on every sensitive action. (Account deletion intentionally excluded per product decision.)

---

## Prioritized Fix Plan

### P0 — ship before next deploy

| # | Fix | File |
|---|-----|------|
| A1 | Set `JWT_SECRET` in Render env (prod + staging); remove hardcoded fallback string; throw at startup if missing in prod | [backend/index.mjs:59](../backend/index.mjs#L59) |
| A4 | Reset `phone_verified=false` on phone change in `PATCH /api/auth/me` | [backend/index.mjs:4883](../backend/index.mjs#L4883) |

### P1 — within sprint

| # | Fix |
|---|-----|
| A2 + A3 | Migrate `localStorage` JWT → Firebase session cookies (`createSessionCookie`, `httpOnly; Secure; SameSite=Lax`) **and** add CSRF token cookie + double-submit. Both must ship together. |
| A5 | Make email-verification check authoritative server-side (`GET /api/auth/me`); demote localStorage key to UX-only trigger |
| A6 | Drop JWT TTL to ~1h; add `revoked_sessions` table or use session-cookie revocation |
| A9 | Per-identifier rate limit (Postgres bucket on normalized phone/email) for OTP/auth endpoints |
| A10 | Hard-fail startup if `FIREBASE_SERVICE_ACCOUNT_JSON` missing in production |

### P2 — next iteration

| # | Fix |
|---|-----|
| A7 | Tighten `requireRecentAuth` to 60s for destructive ops; keep 5min for routine edits |
| A8 | Normalize identifier-lookup responses to be enumeration-resistant |
| A12 | Add `auth_events` audit log table; write on login, password change, phone change, email change |
| A11 | Audit `localStorage` flag handling in `shared-auth.js` for race conditions |

### Explicitly out of scope

**No re-authentication / OTP step on `DELETE /api/auth/me`** (per product decision). Frictionless deletion stays — same JWT-only check as today. Risk acknowledged: an XSS that steals the JWT can delete the account.

---

## Existing utilities to reuse when implementing

- `signSessionToken` / `verifySessionToken` — [backend/index.mjs:64-80](../backend/index.mjs#L64-L80)
- `requireRecentAuth` — [backend/index.mjs:4848](../backend/index.mjs#L4848)
- `publicFormLimit` / `adminRateLimit` — [backend/index.mjs:605-613](../backend/index.mjs#L605-L613)
- `firebaseAdmin.auth()` — already initialized at [backend/index.mjs:47-51](../backend/index.mjs#L47-L51); `createSessionCookie` available without new deps
