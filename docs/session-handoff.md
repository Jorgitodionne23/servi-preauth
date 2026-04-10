# Session Handoff — Auth Flow Hardening

**Date:** 2026-04-10
**Branch:** main (all commits pushed to origin)

---

## What Was Done This Session

### Auth Gap Analysis
Used context7 (Firebase docs) + codebase exploration to identify 8 auth flow gaps. Prioritized and planned the top 4 critical/important ones.

### Implemented (4 fixes, 9 commits, all on main)

| Commit | Change |
|--------|--------|
| `96dac73` | `getIdToken(true)` in `syncWithBackend` — forces fresh Firebase token on every backend sync (prevents stale cached tokens bypassing revocation) |
| `96dac73` | Handle `token_revoked` and `user_disabled` 401 from backend — clears localStorage, calls `auth.signOut()`, rebuilds navbar |
| `e62c013` | `verifyIdToken(idToken, true)` on backend — enables Firebase revocation registry check; distinct error codes for `auth/id-token-revoked` → `token_revoked` and `auth/user-disabled` → `user_disabled` |
| `ab7d102` | `POST /api/auth/change-password` replaced with 410 Gone — was dead code (no users have `password_hash`), now clearly deprecated |
| `08c9640` | `console.warn` at startup when `JWT_SECRET` not set — prevents silent session invalidation if `STRIPE_WEBHOOK_SECRET` rotates |
| `aa9900d` | `.gitignore` — added `test-results/`, `.claude/settings.local.json`, `docs/superpowers/` |

### Test Coverage Added
- `tests/05-session.spec.js` — test 5.8 (skipped — Firebase doesn't fire in Playwright env without emulator; documents the gap)
- `tests/04-account.spec.js` — test 4.14 (Security section has no password inputs, confirms Firebase-only auth messaging)

---

## Current Auth System State

### What's Working
- Firebase phone OTP + Google Sign-In (passwordless)
- `syncWithBackend` POSTs to `/api/auth/firebase`, gets custom HS256 JWT (30-day), stores in `servi_user_session` localStorage
- Session restoration on page load via `restoreSession()` — validates JWT expiry, clears stale pre-Firebase tokens
- Navbar shows user name/avatar when logged in, login buttons when logged out
- Account page: edit profile, manage addresses, manage payment methods (Stripe SetupIntent), delete account
- Token revocation: admin can revoke a Firebase session → next page load signs the user out automatically (requires revoking in Firebase Console)
- Backend correctly classifies revoked vs disabled vs invalid tokens with distinct error codes

### Pending Operator Action
**Set `JWT_SECRET` on Render** — currently falls back to `STRIPE_WEBHOOK_SECRET`. If Stripe rotates that secret, all sessions invalidate silently. A startup warning fires until this is set.
```bash
# Generate value:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Add as JWT_SECRET in Render → servi-preauth → Environment
```

---

## Remaining Auth Gaps (Not Yet Addressed)

### Important

**1. No re-authentication before destructive operations**
- `DELETE /api/auth/me` and `PATCH /api/auth/me` (phone change) only require a valid JWT — no Firebase re-auth challenge
- Firebase best practice: require `reauthenticateWithCredential` before account deletion and phone number changes
- Frontend: show a re-auth modal (OTP or Google) before calling these endpoints
- Backend: optionally require a short-lived `reauth_token` (or rely entirely on Firebase client-side)
- Risk: medium — attacker with a stolen session token can delete the account within the 30-day JWT window

**2. No cross-device session revocation for custom JWTs**
- When a user deletes their account, the backend deletes the DB row + Firebase user
- Other devices holding a valid JWT (up to 30-day expiry) will pass `verifySessionToken()` but then fail on DB queries (user row gone) — so most endpoints return 404/empty. Low practical risk.
- However `requireUserAuth` itself is stateless — it only checks JWT signature + expiry, not DB existence
- True fix: maintain a token revocation list in DB, or shorten JWT expiry (e.g. 7 days) and add a refresh endpoint
- Risk: low — deleted account JWTs fail gracefully on all protected endpoints that query the DB

### Low Priority

**3. Phone conflict error not surfaced gracefully in account.html**
- `PATCH /api/auth/me` returns `{ error: 'phone_exists' }` when the new phone is already registered
- The frontend error handler in account.html likely shows a generic error or silently fails
- Fix: check for `phone_exists` in the PATCH error handler and show a specific message

**4. Recovery flow ("Can't access your phone?") untested**
- Exists in `shared-auth.js` as a multi-step flow: email OTP → update phone
- Has not been end-to-end tested; edge cases around partial completion (e.g. email verified but phone update fails) are likely
- Fix: manual QA pass + add error recovery for mid-flow failures

---

## Key Architectural Decisions Made

- **`getIdToken(true)` on every sync** — chosen over only refreshing on 401 because a cached token can't trigger revocation detection server-side. The network cost is one extra Firebase call per page load (acceptable).
- **Both `token_revoked` AND `user_disabled` handled identically on frontend** — same sign-out behavior. Combined into a single condition.
- **change-password is 410, not removed** — keeps the route registered so clients get a clear signal instead of 404. Handler is 3 lines.
- **Test 5.8 is skipped, not deleted** — preserves the test intent + documents the Firebase emulator gap. Ready to unskip when emulator is configured in `playwright.config.js`.
- **No DB migration needed** — all changes are application-layer only.

---

## Files Changed This Session

| File | What Changed |
|------|-------------|
| `backend/index.mjs` | `verifyIdToken` → `checkRevoked: true`; revoked/disabled error codes; `change-password` → 410; JWT_SECRET startup warning |
| `frontend/shared/shared-auth.js` | `getIdToken(true)`; `token_revoked`/`user_disabled` 401 sign-out handler |
| `tests/05-session.spec.js` | Test 5.8 added (skipped); test ordering fixed; fallback documented |
| `tests/04-account.spec.js` | Test 4.14 — Security section has no password inputs |
| `.gitignore` | Added `test-results/`, `.claude/settings.local.json`, `docs/superpowers/` |

---

## Next Session Starting Point

Pick up from the 4 remaining gaps above. Suggested order:
1. **Phone conflict error** (30 min) — small frontend-only fix in account.html
2. **Re-auth before delete/phone change** (2-3 hrs) — requires re-auth modal UX + backend gate
3. **Recovery flow QA** (1 hr) — manual testing + edge case fixes in shared-auth.js
4. **Cross-device JWT revocation** (2-3 hrs) — design decision needed (revocation list vs shorter expiry + refresh endpoint)
