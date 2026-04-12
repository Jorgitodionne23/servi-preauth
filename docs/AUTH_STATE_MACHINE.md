# SERVI Auth Redesign — Visual Spec

**Full flow:** identifier entry → backend check → signup or login → booking gate

---

## 1. Auth State Machine

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

## 3. Database Schema Changes

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
  first_identifier_type VARCHAR(10),
  
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

## 4. Backend API Endpoints

### Endpoint Changes Summary

| Method | Route | Status | Auth | Request Body | Response | Notes |
|--------|-------|--------|------|--------------|----------|-------|
| POST | `/api/auth/check-identifier` | modified | Public | `{ identifier }` | `{ exists, provider }` | provider: 'phone'\|'google'\|'email'. Add provider field to response so frontend knows which OTP type to offer. |
| POST | `/api/auth/firebase` | modified | Firebase ID token | `{ name, phone, email, phone_verified, email_verified, first_identifier_type }` | `{ token, user }` | user includes phone_verified, email_verified. Accept and persist new fields. Return verification status in user object so frontend knows state immediately after sync. |
| POST | `/api/auth/add-email` | new | JWT Bearer | `{ email, firebase_id_token }` | `{ ok: true, email_verified: true }` | Called after email OTP verified in booking gate. Verifies the Firebase ID token confirms email ownership, then sets email=email, email_verified=true on the user row. |
| GET | `/api/auth/me` | modified | JWT Bearer | — | `{ id, name, email, phone, phone_verified, email_verified, ... }` | Add phone_verified and email_verified to response. Booking step 3 calls this to decide if gate is needed. |
| POST | `/api/service-requests` | modified | JWT Bearer (required at step 3) | `{ category, description, ... }` | `{ id, status }` or 409 `{ error: 'email_required' }` | If authenticated user has email_verified=false: return 409 with 'email_required' error. Frontend shows booking gate. |

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

## 5. LocalStorage Keys

Complete inventory — existing + new

| Key | Status | Description |
|-----|--------|-------------|
| `servi_user_session` | Existing | `{ token, user, firebaseUid }` — user now includes phone_verified, email_verified |
| `servi_email_skipped` | NEW | "1" when user clicked "Skip for now" on Screen 2c. Cleared when email is later verified |
| `servi_email_link_target` | Existing | Email address for sign-in link flow |
| `servi_recovery_mode` | Existing | "1" during phone recovery via email link |
| `servi_pending_logout` | Existing | Deferred Firebase signOut across pages |
| `servi_usl_state` | NEW (optional) | Persist USL flow state across OTP confirmation page load if needed: `{ identifier, identifierType, isNew, newUserData }` |

---

## 6. Step-by-Step Flow Breakdowns

### Signup Branch — Step by Step

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

### Booking Gate — Step by Step

**1. User reaches Step 3**
- Already logged in
- Frontend calls `GET /api/auth/me` to check email_verified

**2. Missing email?**
- Show inline banner inside booking panel: "Add your email to confirm this request"
- Not a full modal

**3. Email OTP inline**
- Small form embedded in booking step 3
- Email field → "Send code" → 6-digit OTP → verify
- On success: `email_verified=true`

**4. Proceed**
- `PATCH /api/auth/me` or `/api/auth/add-email` sets email + email_verified
- Booking confirmation unlocked

---

## 7. Design Summary

### Files Changed
- `shared-auth.js`
- `db.pg.mjs`
- `index.mjs`

### New Screens
- Screen 2b (name)
- Screen 2c (email opt)
- Screen 2d (email OTP)
- Screen 3 (booking gate)

### New DB Columns
- `phone_verified`
- `email_verified`
- `first_identifier_type`

### New Endpoints
- `POST /api/auth/add-email`

### Modified Endpoints
- `check-identifier`
- `/api/auth/firebase`
- `GET /api/auth/me`
- `POST /api/service-requests`

### New LocalStorage Keys
- `servi_email_skipped`
- `servi_usl_state`
