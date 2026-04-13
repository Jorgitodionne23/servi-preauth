# SERVI Auth Redesign — Visual Spec (v2)

**Updated design with 3 critical refinements:**
- ✅ Symmetric signup flow (phone-first AND email-first)
- ✅ Cross-identifier recovery (prevents duplicate accounts)
- ✅ Dynamic OTP screen copy (context-aware titles)

**Full flow:** identifier entry → backend check → signup or login → booking gate

---

## 0. Three Critical Adjustments (v2)

### ① Cross-Identifier Recovery
**Problem:** User signs up with phone, skips email. Later tries to login with email → backend creates duplicate account.

**Solution:** New endpoint `POST /api/auth/resolve-identifier-mismatch` detects and merges orphaned accounts.

Flow:
1. Email login → not found
2. Check if phone account exists (that skipped email)
3. If yes: Email OTP → name validation → phone OTP → merge into one record
4. Prevents duplicate account creation

### ② Dynamic OTP Screen Copy
**Problem:** Screen 2a says "Verificar teléfono" even for email-first signup users.

**Solution:** Screen titles render dynamically based on `first_identifier_type`:
- Phone-first path: "Verificar teléfono"
- Email-first path: "Verificar correo"

No more hardcoded "Phone" copy on email paths.

### ③ Symmetric Signup Flow
**Problem:** v1 only documented phone-first.

**Solution:** Email-first path mirrors phone-first with identical logic:
- **Phone-first:** Phone OTP → Name → Email (optional) → Email OTP
- **Email-first:** Email OTP → Name → Phone (optional) → Phone OTP

Same skip mechanic applies to secondary identifier in both paths.

---

## 1. Symmetric Signup Flow

Phone-first and email-first paths are **mirrors of each other**.

### Step Comparison

| Step | 📱 Phone-First | 📧 Email-First |
|------|---|---|
| **1. Identifier** | User enters phone. Country picker visible. `first_identifier_type = 'phone'` | User enters email. Country picker hides. `first_identifier_type = 'email'` |
| **Check** | `POST /api/auth/check-identifier` → `{ exists: false }` → route to signup (same for both) | ↑ same |
| **2. Primary OTP** | Phone SMS via Firebase `signInWithPhoneNumber()`. Screen: "Verificar teléfono" | Email code via Firebase `sendSignInLinkToEmail()`. Screen: "Verificar correo" |
| **3. Name Collection** | First + Last name, required, cannot skip. (same for both paths) | ↑ same |
| **4. Secondary (optional)** | Email input + "Omitir por ahora" link. Sets `servi_email_skipped=1` if skipped | Phone input + "Omitir por ahora" link. Sets `servi_phone_skipped=1` if skipped |
| **5. Secondary OTP** | Email OTP → `email_verified=true` | Phone SMS → `phone_verified=true` |
| **Final** | `POST /api/auth/firebase` → creates auth_users row (same for both) | ↑ same |
| **Booking Gate** | Triggered if `email_verified=false` at Step 3 | Triggered if `phone_verified=false` at Step 3 |

**Implementation note:** The booking gate must check BOTH flags and return either:
- `{ error: 'email_required' }` if email_verified is false (phone-first user)
- `{ error: 'phone_required' }` if phone_verified is false (email-first user)

Frontend renders appropriate inline collection form.

---

## 2. Cross-Identifier Login Recovery

**Scenario:** User signs up via phone, skips email. Later they try to login with that email address.

**Problem:** `check-identifier` returns "not found" → system would create second account.

**Solution:** New endpoint detects orphaned phone accounts and merges them.

### Recovery Flow

```
Enter email
    ↓
POST /api/auth/check-identifier → { exists: false }
    ↓
POST /api/auth/resolve-identifier-mismatch [NEW]
    ↓
Result: orphaned phone account found?
    ↓ YES
Email OTP verification
(confirm they own this email)
    ↓
Name validation screen
(must match DB record ±fuzzy match)
    ↓
Phone OTP verification
(confirm they own the phone)
    ↓
Merge: email + email_verified=true
added to existing phone account row
```

### POST /api/auth/resolve-identifier-mismatch [NEW]

**Request:**
```json
{
  "identifier": "juan@gmail.com",
  "type": "email"
}
```

**Response A (no orphan found):**
```json
{
  "orphaned": false,
  "action": "create_new_account"
}
```

**Response B (orphaned account found):**
```json
{
  "orphaned": true,
  "hint": {
    "name_first_char": "J",  // Partial name, only after Email OTP verified
    "phone_last_4": "5678"
  }
}
```

**Security note:** The hint (partial name) is only returned AFTER Email OTP succeeds. This prevents account enumeration attacks.

---

## 3. Dynamic OTP Screen Copy

**Implementation:** Single function `renderOTPScreen(type)` handles both phone and email paths.

```javascript
function renderOTPScreen(type) {
  // type: 'phone' | 'email'
  const es = isEs();
  
  const title = type === 'phone'
    ? (es ? 'Verificar teléfono' : 'Verify phone')
    : (es ? 'Verificar correo'   : 'Verify email');

  const subtitle = type === 'phone'
    ? (es ? 'Enviamos un código SMS a ' : 'We sent an SMS to ')
    : (es ? 'Enviamos un código de 6 dígitos a ' : 'We sent a 6-digit code to ');

  // render modal with dynamic title + subtitle
  renderOTPModal({ title, subtitle, type });
}
```

**Tracked in:**
- Flow state (JavaScript)
- localStorage `servi_usl_state` (persists across page reloads)
- DB `auth_users.first_identifier_type` (persists across sessions)

---

## 4. Auth State Machine

### Overview

User clicks "Log in" or reaches Booking Step 3

**Flow Path:**

1. **📱 Screen 1 — Identifier Input**
   - Unified phone/email field
   - Google button
   - Auto-detect @ symbol

2. **POST /api/auth/check-identifier**
   - Returns: `{ exists: bool, provider: string }`

3. **⬦ New user?**

**YES → Signup Path:**
- 📱 Screen 2a — Phone OTP (Send SMS, Verify 6-digit code, reCAPTCHA)
- Firebase: `signInWithPhoneNumber()`
- 📝 Screen 2b — Name Collection (First name + Last name, required, needed for bookings)
- 📧 Screen 2c — Email Collection (Optional, "Skip for now" link)
- Sets localStorage: `servi_email_skipped=1`

**If Email Given:**
- 📧 Screen 2d — Email OTP (6-digit code to email)

**If Email Skipped:**
- No email_verified set initially

4. **POST /api/auth/firebase**
   - Creates auth_users row
   - Sets: `phone_verified=true`, `email_verified=true/false`
   - Returns JWT

5. **✓ Account created · Logged in**

**NO → Login Path:**
- 📱 Screen 2a — Phone OTP (Same screen, recovery link shown)
- "Can't access phone?" → email link
- Firebase: `signInWithPhoneNumber()`
- **POST /api/auth/firebase** (Updates last_login, returns JWT)
- **✓ Logged in**

### Booking Step 3 Gate (Separate Trigger)

⚠️ **Booking Step 3 — Pre-confirmation check**

1. **GET /api/auth/me** → check `phone_verified`, `email_verified`

2. **⬦ email_verified = false?**

   **YES:**
   - 📧 Screen 3 — Booking Gate
   - Inline banner: "Complete your profile to confirm"
   - Collect email → Email OTP → sets `email_verified=true`
   - **✓ Proceed to booking confirmation**

---

## 2. UI Screen Mockups

### Screen 1 — Identifier Input

```
SERVI.

Ingresa a SERVI
Escribe tu número o correo para continuar

Continuar con Google

o

🇲🇽 ▼  
55 1234 5678

Continuar →

Si usas correo, el ícono de bandera desaparecerá automáticamente
```

### Screen 2a — Phone OTP

```
SERVI.

← Volver

Verificar teléfono
Enviamos un código SMS a +52 55 1234 5678

3  8  4  [blank]  [blank]  [blank]

Verificar

Reenviar código

¿No tienes acceso a tu teléfono?
```

### Screen 2b — Name Collection

```
SERVI.

← Volver

✓ Número verificado
¿Cuál es tu nombre?
Lo usamos para personalizar tus solicitudes de servicio

Juan [text field]
Apellido [text field]

Continuar →
```

### Screen 2c — Email Collection (optional)

```
SERVI.

← Volver

Agrega tu correo
Recibe confirmaciones y facilita la recuperación de tu cuenta

correo@ejemplo.com [text field]

Verificar correo →

Omitir por ahora

Necesitarás un correo verificado para confirmar solicitudes de servicio
```

### Screen 2d — Email OTP

```
SERVI.

← Volver

Verificar correo
Enviamos un código de 6 dígitos a juan@gmail.com

[box] [box] [box] [box] [box] [box]

Verificar

Reenviar código

Código válido por 10 minutos
```

### Screen 3 — Booking Gate (inline)

```
SERVI.

Paso 3 — Confirmar solicitud

Limpieza de hogar · Lo antes posible

⚠️ Completa tu perfil para continuar
Necesitas un correo verificado para confirmar solicitudes. Solo toma un momento.

Agrega tu correo electrónico
correo@ejemplo.com [text field]

Enviar código →

Confirmar solicitud (bloqueado)
```

---

## 5. Database Schema Changes

Three new columns on `auth_users` · no table drops

### Migration SQL (db.pg.mjs additions)

```sql
-- Add verification tracking columns
ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;

ALTER TABLE auth_users
  ADD COLUMN IF NOT EXISTS first_identifier_type VARCHAR(10);
  -- 'phone' | 'email'

-- Backfill existing phone users
UPDATE auth_users
SET phone_verified = true
WHERE phone IS NOT NULL
  AND firebase_uid IS NOT NULL;
```

### auth_users Table After Migration

```sql
CREATE TABLE auth_users (
  id                   TEXT PRIMARY KEY,
  email                TEXT UNIQUE,
  phone                TEXT UNIQUE,
  name                 TEXT,
  firebase_uid         TEXT UNIQUE,
  auth_provider        TEXT,
  stripe_customer_id   TEXT,
  google_id            TEXT,
  last_login           TIMESTAMPTZ,
  
  -- NEW: verification tracking
  phone_verified       BOOLEAN DEFAULT false,
  email_verified       BOOLEAN DEFAULT false,
  first_identifier_type VARCHAR(10),  -- 'phone' | 'email'
  
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

### Sample Rows

#### User who skipped email
```json
{
  "id": "usr_abc123",
  "phone": "+525512345678",
  "email": null,
  "name": "Juan García",
  "phone_verified": true,
  "email_verified": false,
  "first_identifier_type": "phone"
}
```

#### User who verified both phone and email
```json
{
  "id": "usr_def456",
  "phone": "+525587654321",
  "email": "juan@gmail.com",
  "name": "Juan García",
  "phone_verified": true,
  "email_verified": true,
  "first_identifier_type": "phone"
}
```

#### Google signup (email is primary, phone pending)
```json
{
  "id": "usr_ghi789",
  "email": "maria@gmail.com",
  "phone": null,
  "name": "Maria Lopez",
  "phone_verified": false,
  "email_verified": true,
  "first_identifier_type": "email"
}
```

---

## 6. Backend API Endpoints

### New Endpoints (v2)

| Route | Auth | Request | Response | Purpose |
|-------|------|---------|----------|---------|
| **POST** `/api/auth/resolve-identifier-mismatch` | Firebase ID token | `{ identifier, type }` | `{ orphaned: bool, hint? }` | Detect orphaned phone accounts when email login fails. Returns partial name only after Email OTP verified. Prevents account enumeration. |
| **POST** `/api/auth/add-phone` | JWT Bearer | `{ phone, firebase_id_token }` | `{ ok: true, phone_verified: true }` | Symmetric to add-email. Called after phone OTP verified in booking gate or recovery flow. Sets phone + phone_verified=true on user row. |

### Modified Endpoints (v2)

| Route | Status | Auth | Request | Response | Notes |
|-------|--------|------|---------|----------|-------|
| **POST** `/api/auth/check-identifier` | modified | Public | `{ identifier }` | `{ exists, provider }` | provider: 'phone'\|'google'\|'email'. Helps frontend know which OTP type to offer. |
| **POST** `/api/auth/firebase` | modified | Firebase ID token | `{ name, phone, email, phone_verified, email_verified, first_identifier_type }` | `{ token, user }` | Accept and persist new verification fields + `first_identifier_type`. Return all in user object so frontend has authoritative state. |
| **GET** `/api/auth/me` | modified | JWT Bearer | — | `{ id, name, email, phone, phone_verified, email_verified, first_identifier_type, ... }` | Return verification status + identifier type. Booking step 3 calls this to decide which gate (if any) is needed. |
| **POST** `/api/auth/add-email` | existing | JWT Bearer | `{ email, firebase_id_token }` | `{ ok: true, email_verified: true }` | Unchanged. Called after email OTP verified in booking gate (phone-first users). |
| **POST** `/api/service-requests` | modified | JWT Bearer (required at step 3) | `{ category, description, ... }` | `{ id, status }` or 409 `{ error: 'email_required' \| 'phone_required' }` | **v2 change:** Check BOTH phone_verified and email_verified. Return 409 with appropriate error based on what's missing. Frontend shows appropriate inline collection form. |

### POST /api/service-requests — Gate Logic (Pseudocode)

```javascript
// Inside POST /api/service-requests, after auth check:

if (req.user) {
  // Authenticated user — enforce email verification
  const { email_verified } = await pool.query(
    'SELECT email_verified FROM auth_users WHERE id = $1',
    [req.user.id]
  );

  if (!email_verified) {
    return res.status(409).json({
      error: 'email_required',
      message: 'Verifica tu correo para confirmar tu solicitud'
    });
  }
}

// Continue with service request creation...
```

---

## 7. LocalStorage Keys

Complete inventory — existing + new

| Key | Status | Description |
|-----|--------|-------------|
| `servi_user_session` | Existing | `{ token, user, firebaseUid }` — user now includes phone_verified, email_verified, first_identifier_type |
| `servi_email_skipped` | NEW (v1) | "1" when user clicked "Skip for now" on email collection screen. Cleared when email is later verified. |
| `servi_phone_skipped` | NEW (v2) | "1" when user clicked "Skip for now" on phone collection screen (email-first path). Cleared when phone is later verified. |
| `servi_email_link_target` | Existing | Email address for sign-in link flow |
| `servi_recovery_mode` | Existing | "1" during phone recovery via email link |
| `servi_pending_logout` | Existing | Deferred Firebase signOut across pages |
| `servi_usl_state` | NEW (v1) | Persist USL flow state across OTP confirmation page reload: `{ identifier, identifierType, isNew, newUserData, first_identifier_type }` |

---

## 8. Step-by-Step Flow Breakdowns

### Signup Branch — Step by Step (Phone-First)

**1. Identifier Entry**
- Phone (with country picker) or email auto-detected
- Google OAuth always available as shortcut

**2. Phone OTP Verification**
- Firebase `signInWithPhoneNumber()`
- Invisible reCAPTCHA
- Verify 6-digit SMS code

**3. Name Collection**
- First name + Last name fields
- Required
- Cannot be skipped — needed for booking invoices

**4. Email Collection (optional)**
- Explain why email helps (booking confirmations, recovery)
- "Skip for now" link available
- Sets `servi_email_skipped=1`

**5. Email OTP (if email given)**
- Firebase sends 6-digit code to email
- On verify: `email_verified=true` saved to DB

**6. Backend Sync**
- `POST /api/auth/firebase`: creates auth_users row with `phone_verified=true`, `email_verified=true/false`, `first_identifier_type='phone'`

### Signup Branch — Step by Step (Email-First)

**1. Identifier Entry**
- Email auto-detected (@ symbol) or user selects email mode
- Country picker hides

**2. Email OTP Verification**
- Firebase `sendSignInLinkToEmail()` or email OTP code
- Verify 6-digit code

**3. Name Collection**
- First name + Last name fields
- Required
- Cannot be skipped — needed for booking invoices

**4. Phone Collection (optional)**
- Explain why phone helps (SMS confirmations, recovery)
- "Skip for now" link available
- Sets `servi_phone_skipped=1`

**5. Phone OTP (if phone given)**
- Firebase SMS code
- On verify: `phone_verified=true` saved to DB

**6. Backend Sync**
- `POST /api/auth/firebase`: creates auth_users row with `phone_verified=true/false`, `email_verified=true`, `first_identifier_type='email'`

### Login Branch — Step by Step

**1. Identifier Entry**
- Same screen
- Backend confirms account exists → route to login

**2. Phone OTP**
- Same reCAPTCHA + SMS flow
- Recovery link visible: "Can't access your phone?" → sends email magic link

**3. Backend Sync**
- `POST /api/auth/firebase`: updates last_login, returns existing JWT
- No name/email collection

**4. Done**
- Auth modal closes
- Navbar shows user name
- Booking step 3 may then check email_verified if missing

### Cross-Identifier Recovery — Step by Step

**1. User attempts email login**
- Already has phone account (from earlier signup)
- Skipped email during signup

**2. Check identifier**
- `POST /api/auth/check-identifier` → `{ exists: false }`
- Email not in system

**3. Resolve mismatch**
- `POST /api/auth/resolve-identifier-mismatch`
- Backend checks: does orphaned phone account exist?
- Returns `{ orphaned: true }`

**4. Email OTP verification**
- Frontend shows email OTP screen
- User enters code
- Frontend calls `POST /api/auth/firebase` with email OTP token

**5. Name validation**
- Screen asks user to enter name
- Compare against DB record (fuzzy match allowed)
- If matches → proceed

**6. Phone OTP verification**
- User verifies phone with SMS code
- Firebase `signInWithPhoneNumber()`

**7. Merge**
- `POST /api/auth/firebase` with BOTH email + phone verified
- Updates existing auth_users row
- Sets: `email=...`, `email_verified=true`
- Returns JWT

**8. Done**
- User is now logged in with complete profile
- No duplicate account created

### Booking Gate — Step by Step

**1. User reaches Step 3**
- Already logged in
- Frontend calls `GET /api/auth/me` to check verification status

**2. Check verification status**
- If `first_identifier_type='phone'` and `email_verified=false` → show email gate
- If `first_identifier_type='email'` and `phone_verified=false` → show phone gate

**3. Collection form inline**
- Small form embedded in booking step 3
- Email: "Add your email" field → "Send code" → 6-digit OTP → verify
- Phone: "Add your phone" field → Country picker → "Send code" → SMS OTP → verify
- On success: email_verified=true (or phone_verified=true)

**4. Proceed**
- `POST /api/auth/add-email` (or add-phone) completes
- User can now confirm booking

---

## 9. Implementation Summary

### v2 Changes from v1

| Area | v1 | v2 |
|------|----|----|
| **Signup paths** | Phone-first only | Phone-first + Email-first (symmetric) |
| **OTP screen copy** | Hardcoded | Dynamic based on first_identifier_type |
| **Orphaned account handling** | None | New resolve-identifier-mismatch endpoint |
| **Booking gate** | Email-only check | Dual check (email for phone-first, phone for email-first) |

### Files to Modify
- `frontend/shared/shared-auth.js` — Add email-first path, renderOTPScreen() dynamic logic
- `backend/index.mjs` — Add POST /api/auth/resolve-identifier-mismatch, POST /api/auth/add-phone, update service-requests gate logic
- `backend/db.pg.mjs` — No schema changes (v1 already added columns)

### New Screens
- Screen 2a — Dynamic OTP (Phone or Email based on type)
- Screen 2b — Name Collection (identical for both paths)
- Screen 2c — Secondary Identifier (Email for phone-first, Phone for email-first)
- Screen 2d — Secondary OTP (Email or Phone)
- Screen 3 — Booking Gate (symmetric — email OR phone collection inline)
- Recovery screen 1 — Cross-identifier name validation

### New DB Columns
- ✅ `phone_verified` (from v1)
- ✅ `email_verified` (from v1)
- ✅ `first_identifier_type` (from v1)

No new columns needed for v2.

### New Endpoints (v2)
- `POST /api/auth/resolve-identifier-mismatch` — Detect & merge orphaned accounts
- `POST /api/auth/add-phone` — Symmetric to add-email, for email-first users

### Modified Endpoints (v2)
- `POST /api/auth/firebase` — Already handles new fields from v1
- `GET /api/auth/me` — Already returns verification flags from v1
- `POST /api/service-requests` — Update gate logic: check phone_verified too, return `{ error: 'phone_required' }` if missing

### New LocalStorage Keys
- ✅ `servi_email_skipped` (from v1)
- `servi_phone_skipped` — NEW (v2): "1" when email-first user skips phone
- ✅ `servi_usl_state` (from v1)

No new features needed for existing keys.
