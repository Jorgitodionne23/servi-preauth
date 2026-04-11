# SERVI Auth — Unified Sign-up/Login (USL) Redesign
**Date:** 2026-04-11
**Status:** Approved — pending implementation
**Scope:** `shared-auth.js` · `backend/db.pg.mjs` · `backend/index.mjs`

---

## Problem

The current auth flow has three gaps:

1. **No name collection screen** — `uslNewUserData.name` is referenced in state but there is no `renderNameCollectionScreen()`. Names reach the backend only if the user came via Google (which provides `displayName`); phone-only signups have no name.

2. **Email is required in signup** — The current `renderSignupEmailScreen()` has no skip option. The spec says email should be optional at signup and only enforced at booking step 3.

3. **No `phone_verified` / `email_verified` tracking** — `auth_users` has no verification flags. The backend cannot distinguish "user provided email" from "user verified email". The booking gate cannot enforce this.

4. **Asymmetric flow** — The signup path was only designed for phone-first entry. Email-first signup hits `renderSignupPhoneScreen()` but has no symmetric counterpart for all subsequent steps.

5. **Duplicate account risk** — A user who signed up with phone (skipping email) and later tries to log in with an email the system doesn't recognize would silently create a second account.

---

## Solution Overview

A fully symmetric phone-first / email-first USL flow with:
- Progressive disclosure: primary OTP → name → secondary ID (optional) → secondary OTP (optional)
- Verification flags tracked in DB and returned in all auth responses
- Cross-identifier recovery flow with a new backend endpoint
- Booking gate that enforces both identifiers verified before service request confirmation
- Single `renderOTPScreen(type)` function replacing hardcoded "phone OTP" screens

---

## State Machine

```
User clicks Log In / reaches Booking Step 3
         │
         ▼
Screen 1: Identifier Input
  ├─ Google OAuth (shortcut, bypasses all OTP)
  └─ Phone or Email (auto-detect @)
         │
         ▼
POST /api/auth/check-identifier → { exists, provider }
         │
    ┌────┴────┐
    │ exists? │
    └────┬────┘
    NO   │   YES
    ▼         ▼
SIGNUP     LOGIN
  │           │
  ▼           ▼
Screen 2a: Primary OTP    Screen 2a: OTP (type from provider field)
(type = first_identifier_type)  Phone OTP for phone users
  │                             Email OTP for email users
  │                             Recovery link shown for phone login
  ▼                                     │
                                        ▼
                               POST /api/auth/firebase
Screen 2b: Name Collection       → { token, user }
(required, both paths)                  │
  │                                     ▼
  ▼                              Done — auth modal closes
Screen 2c: Secondary ID (optional)
  ├─ Skip → servi_email_skipped=1 or servi_phone_skipped=1
  └─ Enter → Screen 2d: Secondary OTP
                │
                ▼
         POST /api/auth/firebase
         → creates auth_users row
         phone_verified / email_verified set accordingly
                │
                ▼
         Done — account created

─── Cross-Identifier Login Recovery ─────────────────────────
Email login attempt → check-identifier → { exists: false }
         │
         ▼
POST /api/auth/resolve-identifier-mismatch
  (requires firebase_id_token proving email ownership)
         │
    ┌────┴────────────────────────────┐
    │ resolution?                     │
    └────┬───────────────┬────────────┘
  new_account           link_to_phone
    │                        │
    ▼                        ▼
Normal signup          Email OTP verified
                            │
                            ▼
                       Screen: Name validation
                       (must match existing DB record ±fuzzy)
                            │
                            ▼
                       Screen: Phone OTP
                       (confirm identity)
                            │
                            ▼
                       UPDATE auth_users: email + email_verified=true
                       Logged in as merged account

─── Booking Step 3 Gate ──────────────────────────────────────
GET /api/auth/me → check phone_verified, email_verified
         │
    phone_verified=false?  →  inline phone collection + Phone OTP
    email_verified=false?  →  inline email collection + Email OTP
         │
         ▼
POST /api/service-requests succeeds (both flags true)
```

---

## Screens

### Screen 1 — Identifier Input
- Google OAuth button (primary shortcut)
- Unified phone/email field
  - Country picker visible by default
  - Hides automatically when `@` is typed
  - `inputmode` switches `numeric` ↔ `email`
- Continue button → `POST /api/auth/check-identifier`

### Screen 2a — Primary OTP
- **Rendered by:** `renderOTPScreen(type)` — single function, type = `'phone'` or `'email'`
- Title: `"Verificar teléfono"` or `"Verificar correo"` based on `type`
- For phone: SMS via Firebase `signInWithPhoneNumber()` + invisible reCAPTCHA
- For email: Firebase `sendSignInLinkToEmail()` (existing) or Firebase email OTP
- 6-box digit entry UI (same component for both)
- Recovery link shown only for **login** path: `"¿No tienes acceso a tu teléfono?"`
- Progress indicator: 4 dots, dot 2 active

### Screen 2b — Name Collection
- First name + Last name fields side-by-side
- **Required.** No skip option.
- Shown only on **signup** path (not login)
- Progress indicator: dot 3 active
- Info banner: `"✓ [Teléfono / Correo] verificado"`

### Screen 2c — Secondary Identifier (optional)
- For phone-first: email input
- For email-first: phone input (with country picker)
- Skip link: `"Omitir por ahora"`
  - Sets `servi_email_skipped=1` (phone-first) or `servi_phone_skipped=1` (email-first)
- Warning text: `"Necesitarás un correo/teléfono verificado para confirmar solicitudes"`
- Progress indicator: dot 4 active

### Screen 2d — Secondary OTP
- Same `renderOTPScreen(type)` with opposite type
- Shown only if user provided secondary identifier in 2c

### Screen 3 — Booking Gate (inline, not a modal)
- Embedded inside booking panel at step 3
- Yellow warning banner: `"Completa tu perfil para confirmar"`
- Compact email or phone field + `"Enviar código"` button
- Inline OTP entry after code sent
- Confirm button is disabled/greyed until gate resolved
- Calls `POST /api/auth/add-email` or `POST /api/auth/add-phone` on success

---

## Database Changes

### New columns on `auth_users`

```sql
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS
  phone_verified BOOLEAN DEFAULT false;

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS
  email_verified BOOLEAN DEFAULT false;

ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS
  first_identifier_type VARCHAR(10);
-- values: 'phone' | 'email'

-- Backfill existing phone users
UPDATE auth_users
SET phone_verified = true,
    first_identifier_type = 'phone'
WHERE phone IS NOT NULL
  AND firebase_uid IS NOT NULL;

-- Backfill Google / email-link users
UPDATE auth_users
SET email_verified = true,
    first_identifier_type = 'email'
WHERE email IS NOT NULL
  AND auth_provider IN ('google', 'email')
  AND phone_verified = false;
```

### No table drops. All changes are additive.

---

## Backend Endpoints

### Modified: `POST /api/auth/check-identifier`
**Change:** Add `provider` field to response.

```
Request:  { identifier: string }
Response: { exists: bool, provider: 'phone'|'google'|'email'|null }
```

`provider` is `null` when `exists=false`. Frontend uses it to render correct login OTP type.

---

### New: `POST /api/auth/resolve-identifier-mismatch`
**Auth:** Requires `firebase_id_token` in body (proves caller owns the email address being checked — email OTP must complete before calling this).
**Rate limit:** 5/min per IP.

```
Request:  { identifier: string, firebase_id_token: string }

Response A — no orphan found:
  { resolution: 'new_account' }
  → Frontend proceeds with normal signup

Response B — orphaned phone account detected:
  { resolution: 'link_to_phone', hint: 'Ju' }
  → hint = first 2 chars of name from existing row
  → Frontend shows name-validation + phone OTP merge flow
```

**Security:** The endpoint must not reveal hint until `firebase_id_token` is valid. This prevents account enumeration — an attacker cannot determine if a phone account exists without first proving ownership of the email.

**Name matching logic:**
```
candidate.name.toLowerCase().startsWith(submitted_name.toLowerCase().slice(0, 3))
OR Levenshtein distance ≤ 2
```
3 failed attempts → 10-minute cooldown on that IP.

**On successful merge:**
```sql
UPDATE auth_users
SET email = $email, email_verified = true
WHERE id = $existing_user_id;
```

---

### Modified: `POST /api/auth/firebase`
**Change:** Accept and persist new verification fields. Return them in response.

```
Request body additions:
  phone_verified?: bool
  email_verified?: bool
  first_identifier_type?: 'phone'|'email'
  name?: string  (first + last, collected in Screen 2b)

Response user object additions:
  phone_verified: bool
  email_verified: bool
```

---

### New: `POST /api/auth/add-email`
**Auth:** JWT Bearer (existing session).

```
Request:  { email: string, firebase_id_token: string }
Response: { ok: true, email_verified: true }

On success:
  UPDATE auth_users SET email=$email, email_verified=true WHERE id=$user_id
  Return updated user fields
```

Used by booking gate (Screen 3) for phone-first users who skipped email.

---

### New: `POST /api/auth/add-phone`
**Auth:** JWT Bearer.

```
Request:  { phone: string, firebase_id_token: string }
Response: { ok: true, phone_verified: true }

On success:
  UPDATE auth_users SET phone=$phone, phone_verified=true WHERE id=$user_id
```

Symmetric counterpart to `add-email`, used by email-first users who skipped phone.

---

### Modified: `GET /api/auth/me`
**Change:** Add `phone_verified` and `email_verified` to response.

```
Response additions:
  phone_verified: bool
  email_verified: bool
```

Booking step 3 calls this immediately after auth to determine gate state.

---

### Modified: `POST /api/service-requests`
**Change:** Check verification flags for authenticated users.

```javascript
if (req.user) {
  const { phone_verified, email_verified } = await pool.query(
    'SELECT phone_verified, email_verified FROM auth_users WHERE id = $1',
    [req.user.id]
  ).then(r => r.rows[0]);

  if (!email_verified) {
    return res.status(409).json({
      error: 'email_required',
      message: 'Verifica tu correo para confirmar tu solicitud'
    });
  }

  if (!phone_verified) {
    return res.status(409).json({
      error: 'phone_required',
      message: 'Verifica tu teléfono para confirmar tu solicitud'
    });
  }
}
```

---

## Frontend State

### Module-level state additions (`shared-auth.js`)
```javascript
let uslFirstIdentifierType = ''; // 'phone' | 'email'
// Set in __uslSubmitIdentifier, persisted to localStorage
```

### localStorage keys — complete inventory

| Key | Value | Purpose |
|---|---|---|
| `servi_user_session` | `{ token, user, firebaseUid }` | Existing — `user` now includes `phone_verified`, `email_verified` |
| `servi_email_skipped` | `"1"` | User skipped email on phone-first signup. Cleared on email verification. |
| `servi_phone_skipped` | `"1"` | **NEW** — User skipped phone on email-first signup. Cleared on phone verification. |
| `servi_usl_state` | `{ firstIdentifierType }` | **NEW** — Persists first_identifier_type across OTP page load |
| `servi_email_link_target` | email address | Existing — email for sign-in link flow |
| `servi_recovery_mode` | `"1"` | Existing — deferred Firebase signOut |
| `servi_pending_logout` | `"1"` | Existing — deferred Firebase signOut |

---

## Implementation Notes

### `renderOTPScreen(type)` replaces three functions
Current code has `renderLoginOTPScreen()` and the inline OTP inside `renderSignupPhoneScreen()`. Replace with one `renderOTPScreen(type)` that:
- Accepts `type: 'phone' | 'email'`
- Renders dynamic title, subtitle, and identifier display
- Calls appropriate Firebase method based on type
- Same 6-box digit entry UI

### `syncWithBackend` must forward new fields
The `syncWithBackend()` call in `onAuthStateChanged` currently passes `{ name, phone, email }`. It must also forward `phone_verified`, `email_verified`, `first_identifier_type` from `uslNewUserData`.

### Booking panel integration
The inline booking gate (Screen 3) is rendered inside the existing booking step 3 panel, not as a modal. It replaces the confirm button area with the inline form until both flags are verified. After gate resolution, the regular confirm button reappears.

### Google OAuth
Google users come in with `email_verified=true` (Google guarantees email). They have no phone — `phone_verified=false`. The booking gate for Google users will request phone collection + Phone OTP at step 3.

---

## Testing Checklist

- [ ] Signup via phone → OTP → name → skip email → account created → `email_verified=false`
- [ ] Signup via phone → OTP → name → provide email → email OTP → `email_verified=true`
- [ ] Signup via email → email OTP → name → skip phone → `phone_verified=false`
- [ ] Signup via email → email OTP → name → provide phone → phone OTP → `phone_verified=true`
- [ ] Login via phone → OTP → logged in (no name/email screens)
- [ ] Booking step 3 with `email_verified=false` → inline gate appears → verify email → can confirm
- [ ] Booking step 3 with `phone_verified=false` (Google user) → inline gate → verify phone → can confirm
- [ ] `POST /api/service-requests` with `email_verified=false` → 409 `email_required`
- [ ] Cross-identifier: signup phone → skip email → logout → login with new email → resolve-mismatch → name validation → phone OTP → merged account
- [ ] Cross-identifier: orphan detection does not reveal name hint before email OTP succeeds
- [ ] Google OAuth → `email_verified=true`, `phone_verified=false`, booking gate asks for phone
- [ ] Existing users (pre-migration): backfill sets correct flags, no re-auth required
