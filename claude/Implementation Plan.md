# Implementation Plan

This file is the active execution board for new changes, fixes, implementations, and plans.

## Current Objective

- [ ] Add current objective here

## In Progress

- [ ] Add active tasks here

## Planned Next

- [ ] Add upcoming tasks here

## Completed (Recent)

- Date: 2026-04-07
- Request summary: Initialize live execution structure for Implementation Plan.
- What was implemented: Moved/renamed plan file and added live execution sections above archived baseline.
- Files touched: `claude/Implementation Plan.md`, `CLAUDE.md`
- Status: done
- Follow-up: Update this section after each completed implementation request.

## Bugs / Hotfix Queue

- [ ] Add bugs/hotfixes here

## User Feedback -> Product Changes

- [ ] Add validated learning and resulting changes here

## Blocked / Needs Decision

- [ ] Add blockers/decisions here

## Archived Baseline (Do Not Edit)

---

name: Implementation Plan — Phases 1, 2, 3 (Complete Roadmap)
description: Detailed step-by-step plan for quick wins, Firebase migration, and booking/provider redesign
type: project

---

# SERVI Production Readiness — Implementation Plan

**Project Status:**

- ✅ **Phase 1:** COMPLETE (Report/Suggestion forms, navbar fixes, partner button styling)
- ✅ **Legal Pages:** READY (Google Doc embedded, anchor links set for signup modal)
- 🔄 **Phase 2:** READY TO START (Firebase Auth + Account Management)
- 📋 **Phase 3:** PLANNED (Booking & Provider Redesign)

**Decision Snapshot:**

- Auth platform: **Firebase** (SMS/OTP, OTP management, reCAPTCHA for toll fraud)
- Booking modal: **Option A** (Custom-first with expandable category examples)
- Provider documents: **Government ID only at signup** (rest verified by admin manually)
- Legal content: ✅ **READY** (Google Doc embedded with iframe, all sections in one doc)

---

## PHASE 1: Quick Wins (3-5 days)

**Goal:** Fix simple issues, improve UX, establish baseline before major auth migration.

### 1.1 Report Form: Success Confirmation

**File:** `frontend/helpcenter/report.html`
**Change:** After `POST /api/reports` succeeds, show confirmation screen instead of redirecting.

```javascript
// Current: alert('Report submitted'); location.href = '/helpcenter.html'
// New: Show modal/page:
// "¡Gracias por tu reporte!
// Tu reporte ha sido recibido. Nuestro equipo lo revisará pronto."
// [Volver a Help Center button]
```

**Backend:** No change needed.

---

### 1.2 Report Form: Pre-fill Logged-in User Info

**File:** `frontend/helpcenter/report.html`
**Change:** If `window.__user` exists (logged in), pre-fill name/email/phone fields.

```javascript
// On page load:
if (window.__user) {
  document.getElementById('report-name').value = window.__user.name || '';
  document.getElementById('report-email').value = window.__user.email || '';
  document.getElementById('report-phone').value = window.__user.phone || '';
}
```

**Backend:** No change needed.

---

### 1.3 Navbar: Fix Header Text Inversion Bug

**File:** `frontend/shared/shared-styles.css` or `frontend/shared/shared-nav.js`
**Issue:** Text inverts to white when scrolling to top (navbar blurs but text doesn't have sufficient contrast).

**Solution:** Check navbar CSS for scroll-aware blur logic. Likely need to:

- Ensure text color doesn't invert on blur
- Or add `backdrop-filter: blur()` with solid background on scroll (not transparent)
- Or add `background: rgba(255,255,255,0.95)` on scroll instead of full transparency

**Exact fix TBD after reading `shared-nav.js`**

---

### 1.4 Partner Registration Button: Visual Differentiation

**File:** `frontend/partners.html` and `frontend/partners/registro.html`
**Change:** Make "Regístrate a SERVI" button visually distinct from user auth buttons.

**Current:** `class="btn-primary"` (black button, matches user Login/Signup)
**New:** Create `class="btn-partner"` (different color — suggest: dark green #0a7c59 or outlined style)

```css
.btn-partner {
  background: #0a7c59;
  color: white;
  border: none;
  /* or make it outlined */
}
```

**Why:** Avoid users confusing partner signup with user account signup.

---

### 1.5 Navbar: Swap Partners ↔ Help Center Positions

**File:** `frontend/shared/shared-nav.js` (or inline in each page)
**Change:** Move Partners link to right side, Help Center to left.

**Current order:** [Logo] [Servicios] [Partners] [Help Center] [ES/EN] [Login/User]
**New order:** [Logo] [Servicios] [Help Center] [ES/EN] [Partners] [Login/User]

---

### Phase 1 Summary

| Task                         | File                              | Complexity | Time          |
| ---------------------------- | --------------------------------- | ---------- | ------------- |
| Report success confirmation  | helpcenter/report.html            | Low        | 1h            |
| Pre-fill logged-in user info | helpcenter/report.html            | Low        | 30m           |
| Fix navbar text inversion    | shared-nav.js / shared-styles.css | Low-Med    | 1-2h          |
| Differentiate partner button | partners.html                     | Low        | 30m           |
| Swap navbar positions        | shared-nav.js                     | Low        | 15m           |
| **TOTAL**                    | —                                 | —          | **4-5 hours** |

---

## PREREQUISITE: Legal Pages Completeness

**Before Phase 2 implementation:** The signup flow requires users to accept Terms of Service + Privacy Policy. These must be:

1. **Completed** — All placeholders filled with actual legal text
2. **Accessible** — Links in signup modal point to `/legal.html#terminos` and `/legal.html#privacidad`
3. **Anchor IDs** — Ensure your legal.html has:
   ```html
   <section id="terminos"><!-- Terms of Service --></section>
   <section id="privacidad"><!-- Privacy Policy --></section>
   ```

**Current status:** `legal.html` exists but has placeholders. Fill these before Phase 2 begins.

**Note:** This doesn't block Phase 1 (quick wins), but must be done before Firebase signup goes live.

---

## PHASE 2: Firebase Auth Migration & Account Management (5-7 days)

**Goal:** Replace homemade auth with professional Firebase Auth. Implement user menu + Manage Account page.

### 2.1 Firebase Setup (Prerequisite)

1. Create Firebase project (if not exists)
2. Enable Authentication → Email/Password + Phone (SMS)
3. Get Firebase config (apiKey, projectId, etc.)
4. Add to `frontend/config.js`:
   ```javascript
   window.FIREBASE_CONFIG = {
     apiKey: '...',
     authDomain: '...',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...',
   };
   ```

---

### 2.2 Update Auth Modal to Use Firebase

**File:** `frontend/shared/shared-auth.js`
**Changes:**

**Remove:**

- Email/password signup logic that posts to `/api/auth/signup`
- Email/password login logic that posts to `/api/auth/login`
- JWT session storage in localStorage

**Add:**

- Firebase `signupWithEmailPassword()` (email, password, phone, name)
- Firebase `loginWithEmailPassword()` (email, password)
- Firebase `signupWithPhoneOTP()` (phone) → verify OTP
- Firebase `sendPasswordReset()` (email)
- Store `firebase.auth().currentUser` in `window.__user`

**Signup Form Addition (Legal):**
Add checkbox in signup modal before submit button:

```html
<label
  style="display:flex;align-items:flex-start;gap:8px;margin-bottom:16px;font-size:13px"
>
  <input type="checkbox" id="terms-accepted" required />
  <span>
    Acepto los
    <a href="/legal.html#terminos" target="_blank" style="color:#10b981"
      >Términos de Servicio</a
    >
    y la
    <a href="/legal.html#privacidad" target="_blank" style="color:#10b981"
      >Política de Privacidad</a
    >
  </span>
</label>
```

**JavaScript:**

- Signup button disabled until checkbox is checked
- On successful signup, save `terms_accepted: true` + timestamp to database
- Google OAuth signup should also show this checkbox before confirming

**Backend:**

- Add `terms_accepted_at TIMESTAMPTZ` column to `auth_users`
- Prevent account creation if `terms_accepted` is false

**Key behavior:**

- On successful signup/login, store user data in `localStorage` for quick access
- On page load, check `firebase.auth().currentUser` to restore session
- Google OAuth still works (Firebase handles it)
- Users cannot signup without accepting terms

---

### 2.3 Update Backend Auth Endpoints

**File:** `backend/index.mjs`
**Changes:** Convert existing `/api/auth/signup` and `/api/auth/login` to Firebase ID token verification.

**Old pattern:**

```javascript
POST /api/auth/signup { email, password, name, phone }
→ Hash password, store in DB, return session token
```

**New pattern:**

```javascript
POST /api/auth/verify-token { idToken }
→ Verify Firebase ID token, upsert user in DB, return session token
```

This way:

- Frontend uses Firebase for auth (passwords never touch your backend)
- Backend only verifies the token Firebase issued
- Much more secure

---

### 2.4 Create User Menu / Profile Dropdown

**File:** `frontend/shared/shared-nav.js`
**Add:** When user is logged in, show dropdown instead of "Login" button.

```html
<!-- Logged out -->
<button onclick="openAuthModal('login')">Iniciar sesión</button>
<button onclick="openAuthModal('signup')">Crear cuenta</button>

<!-- Logged in -->
<div class="user-menu">
  <button onclick="toggleUserMenu()">
    <span>Nombre del Usuario</span>
    <svg><!-- dropdown arrow --></svg>
  </button>
  <div class="user-menu-dropdown" id="user-menu-dropdown">
    <a href="/profile.html">Mi perfil</a>
    <a href="/orders.html">Mis ordenes</a>
    <a href="/account.html">Configurar cuenta</a>
    <a href="#" onclick="logout()">Cerrar sesión</a>
  </div>
</div>
```

**CSS:** Add hover + click styles for dropdown.

---

### 2.5 Create Manage Account Page

**File:** `frontend/account.html` (new)
**Sections:**

1. **Personal Info** (edit: name, email, phone)
2. **Security** (change password, 2FA toggle)
3. **Addresses** (saved addresses for bookings — add/edit/delete)
4. **Payment Methods** (if future feature)
5. **Preferences** (notifications, language)

**Backend:**

- `PATCH /api/auth/me` — update user info
- `POST /api/auth/change-password` — change password (Firebase handles)
- `GET /api/auth/me` — fetch current user
- Address CRUD endpoints (if not exists)

---

### 2.6 Update Database Schema (if needed)

**Current:** `auth_users` table has `id, email, phone, password_hash, created_at`

**New:** Add Firebase integration columns:

```sql
ALTER TABLE auth_users ADD COLUMN firebase_uid TEXT UNIQUE;
ALTER TABLE auth_users ADD COLUMN provider TEXT DEFAULT 'email'; -- 'email', 'google', 'phone'
```

**Why:** Track which provider the user used (email, Google, phone OTP).

---

### Phase 2 Summary

| Task                    | File                   | Complexity | Time            |
| ----------------------- | ---------------------- | ---------- | --------------- |
| Firebase setup          | config.js              | Med        | 2h              |
| Update auth modal       | shared-auth.js         | High       | 3h              |
| Update backend auth     | backend/index.mjs      | High       | 3h              |
| User menu dropdown      | shared-nav.js          | Med        | 2h              |
| Manage Account page     | account.html + backend | High       | 3h              |
| Database schema updates | backend/db.pg.mjs      | Low        | 1h              |
| **TOTAL**               | —                      | —          | **14-15 hours** |

---

## PHASE 3: Booking & Provider Redesign (7-10 days)

**Goal:** Custom-first booking with service examples, image/video/voice upload, new Providers admin tab.

### 3.1 Redesign Booking Modal Structure

**File:** `frontend/index.html` (booking panel)
**New flow:**

```
Step 1: Choose Method
  [Custom Request (AI will diagnose)] [Browse Categories]

If Custom:
  Step 2: Describe Your Need
    - Text input (free form)
    - Image upload
    - Video upload
    - Voice message (record or upload)
    [Optional: "AI will analyze this and find the right provider"]

  Step 3: Preferred Date/Time
    - ASAP
    - Schedule (date + time picker)

  Step 4: Service Address
    - Address input

  Step 5: Contact Info
    - Pre-filled if logged in
    - Name, Email, Phone

  Step 6: Confirm & Submit

If Browse Categories:
  Step 2: Select Category
    - Clean (expand to show: house cleaning, office cleaning, garden care, etc.)
    - Fix/Maintenance (expand to show: plumbing, electrical, HVAC, etc.)
    - [etc. for other 4 categories]
    - Each service example is clickable

  Step 3: Select Service → Specific Detail Questions
    - If "house cleaning": "What rooms? What type of cleaning?"
    - If "plumbing": "What's the issue? (leak, clog, installation, etc.)"
    - [Different questions per service]

  Step 4: Additional Info (image/video/voice like Custom)

  Step 5: Date/Time

  Step 6: Address

  Step 7: Contact Info

  Step 8: Confirm & Submit
```

**Rationale:** Custom-first emphasizes core differentiator. Categories are helpful for users who know what they want.

---

### 3.2 Add Service Examples Per Category

**Backend:** `backend/index.mjs`
**New endpoint:** `GET /api/service-categories`

```javascript
{
  "categories": [
    {
      "id": "cleaning",
      "name_es": "Limpieza",
      "name_en": "Cleaning",
      "services": [
        { "id": "house_cleaning", "name_es": "Limpieza de casa", "name_en": "House Cleaning" },
        { "id": "office_cleaning", "name_es": "Limpieza de oficina", "name_en": "Office Cleaning" },
        // ...
      ]
    },
    // ... other categories
  ]
}
```

**Frontend:** Load on booking modal open, display as expandable cards.

---

### 3.3 Add Image/Video/Voice Upload

**Frontend:** `frontend/index.html` (booking panel)
**Add file input + preview:**

```html
<label>Attachments (Optional)</label>
<input type="file" id="booking-image" accept="image/*" />
<input type="file" id="booking-video" accept="video/*" />
<input type="file" id="booking-voice" accept="audio/*" />
<div id="preview"><!-- show thumbnails --></div>
```

**Backend:** `POST /api/service-requests`

- Accept `FormData` with `file` fields
- Upload to cloud storage (Cloudflare R2, S3, or simple file storage)
- Store file URLs in `service_requests.attachments` (JSON array)

---

### 3.4 Add Dynamic Detail Questions

**Backend:** New endpoint `GET /api/service-categories/:categoryId/services/:serviceId/questions`

Returns questions specific to the service:

```javascript
[
  { id: "rooms", type: "text", label_es: "¿Cuáles cuartos?", label_en: "Which rooms?" },
  { id: "pet_friendly", type: "boolean", label_es: "¿Tiene mascotas?", ... },
  // ...
]
```

**Frontend:** Dynamically render form based on response.

---

### 3.5 Update Partner Registration Form

**File:** `frontend/partners/registro.html`
**Changes:**

**Specialty field:**

```html
<select id="specialty">
  <option>Limpieza</option>
  <option>Reparación y Mantenimiento</option>
  <!-- ... -->
  <option>Otro</option>
</select>
<input
  id="specialty-other"
  placeholder="Especifica tu especialidad"
  style="display:none"
/>
<script>
  document.getElementById('specialty').onchange = (e) => {
    document.getElementById('specialty-other').style.display =
      e.target.value === 'Otro' ? 'block' : 'none';
  };
</script>
```

**Multiple Services:**

```html
<label>Services You Offer</label>
<div id="services-list">
  <input type="text" placeholder="Service 1" />
</div>
<button onclick="addServiceInput()">+ Add Another Service</button>
```

**Coverage Areas:**

```html
<label>Areas You Serve (Within the city)</label>
<input type="text" placeholder="e.g., Santa Fe, Cuajimalpa, Polanco" />
<small>List the neighborhoods/areas where you provide services</small>
```

**Government ID Upload:**

```html
<label>Government ID (Required)</label>
<input type="file" id="provider-id" accept="image/*" required />
<small
  >Upload a photo of your government ID (passport, driver's license,
  etc.)</small
>
```

**Database Schema:**

```sql
ALTER TABLE partner_applications ADD COLUMN services_offered TEXT[]; -- array
ALTER TABLE partner_applications ADD COLUMN coverage_areas TEXT;
ALTER TABLE partner_applications ADD COLUMN id_document_url TEXT;
```

---

### 3.6 Create "Providers" Admin Tab

**File:** `frontend/admin.html`
**New tab structure:**

```html
<nav class="admin-tabs">
  <button onclick="switchTab('inbox')">Inbox</button>
  <button onclick="switchTab('orders')">Orders</button>
  <button onclick="switchTab('providers')">Providers</button>
</nav>

<section id="providers-tab" style="display:none">
  <!-- Provider list & detail view -->
</section>
```

**Providers List UI:**

- Table: Name | Specialty | Status (pending/verified/rejected) | Applied | Actions (View, Contact)
- Filter by status
- Search by name/phone

**Status Badges:**

- Pending (yellow)
- Verified (green)
- Rejected (red)
- Suspended (gray)

---

### 3.7 Provider Detail View

**File:** `frontend/admin.html` (detail panel)
**Sections:**

**Overview tab:**

- Name, phone, email
- Specialty, services offered, coverage areas
- Join date, number of completed orders, rating
- Status badge + action buttons (Approve, Reject, Contact, Suspend)

**Documents tab:**

- Government ID (image + verification checkbox)
- Status: ☐ Pending | ☑ Verified | ❌ Rejected

**Orders tab:**

- Table: Order ID | Customer | Service | Amount | Date | Rating
- "No orders yet" if empty

**Notes tab:**

- Admin notes textarea
- Status reason (e.g., "Pending interview", "Waiting for additional documents")
- Contact log (timestamps of WhatsApp messages sent)

**Contact button:**

- Pre-filled WhatsApp message:
  ```
  "Hola [Provider Name], Te contactamos desde SERVI. Tu aplicación está siendo revisada.
  Por favor, confirma tu disponibilidad y cualquier documento adicional necesario.
  ¿Podemos agendar una llamada? Gracias."
  ```

---

### 3.8 Backend Endpoints for Provider Management

**New/Updated endpoints:**

```javascript
GET /api/admin/providers
  → List all provider applications with filters (status, created_at)

GET /api/admin/providers/:id
  → Full provider details + documents + orders + notes

PATCH /api/admin/providers/:id
  → Update status (pending → contacted → verified/rejected → suspended)
  → Update admin_notes

POST /api/admin/providers/:id/contact
  → Log contact attempt (timestamp + message sent)

DELETE /api/admin/providers/:id/documents/:docId
  → Delete uploaded document (rare, but useful for cleanup)
```

---

### 3.9 Implement Report Resolution Workflow

**File:** `frontend/admin.html` (Inbox tab)
**Current state:** Can view reports, see type/status badge
**New:** Implement resolution workflow

**Detail panel for reports:**

- Subject, description, customer info
- Status dropdown: new → in_review → resolved
- Admin notes textarea (for resolution details)
- "How Big Platforms Handle This" context box with examples

**Example:** Report of "late service"

- Admin marks "In Review"
- Writes: "Spoke with provider on 2026-03-25. Delay was due to traffic. Customer offered $10 credit."
- Marks "Resolved"

**Database:**

```sql
-- Ensure service_reports has these columns:
ALTER TABLE service_reports ADD COLUMN admin_notes TEXT;
ALTER TABLE service_reports ADD COLUMN resolved_at TIMESTAMPTZ;
ALTER TABLE service_reports ADD COLUMN resolution_notes TEXT;
```

---

### Phase 3 Summary

| Task                             | File                         | Complexity | Time            |
| -------------------------------- | ---------------------------- | ---------- | --------------- |
| Redesign booking modal structure | index.html                   | High       | 3h              |
| Add service examples endpoint    | backend/index.mjs            | Med        | 2h              |
| Image/video/voice upload         | index.html + backend         | Med-High   | 3h              |
| Dynamic detail questions         | backend/index.mjs + frontend | High       | 3h              |
| Update partner registration form | partners/registro.html       | Med        | 2h              |
| Create Providers admin tab       | admin.html                   | High       | 3h              |
| Provider detail view UI          | admin.html                   | High       | 4h              |
| Provider management endpoints    | backend/index.mjs            | High       | 4h              |
| Report resolution workflow       | admin.html                   | Med        | 2h              |
| **TOTAL**                        | —                            | —          | **26-27 hours** |

---

## Overall Timeline

| Phase                             | Scope                                | Est. Time                           |
| --------------------------------- | ------------------------------------ | ----------------------------------- |
| Phase 1 (Quick Wins)              | 5 easy fixes                         | 4-5 hours                           |
| Phase 2 (Firebase + Account Mgmt) | Auth migration + user menu           | 14-15 hours                         |
| Phase 3 (Booking & Provider)      | Custom-first booking + Providers tab | 26-27 hours                         |
| **TOTAL**                         | —                                    | **44-47 hours** (~1 week full-time) |

---

## Recommended Execution Order

1. **Phase 1 first** → Quick wins build momentum + fix immediate UX issues
2. **Phase 2 next** → Firebase migration before adding more features (security-first)
3. **Phase 3 last** → With solid auth + account management, then redesign booking/providers

---

## Files to Modify / Create

### Phase 1

- `frontend/helpcenter/report.html`
- `frontend/partners.html`
- `frontend/partners/registro.html`
- `frontend/shared/shared-nav.js`
- `frontend/shared/shared-styles.css`

### Phase 2

- `frontend/config.js` (add Firebase config)
- `frontend/shared/shared-auth.js` (rewrite for Firebase)
- `frontend/account.html` (new)
- `frontend/shared/shared-nav.js` (user menu dropdown)
- `backend/index.mjs` (Firebase token verification)
- `backend/db.pg.mjs` (add firebase_uid, provider columns)

### Phase 3

- `frontend/index.html` (booking modal redesign)
- `frontend/partners/registro.html` (multiple services, coverage areas, ID upload)
- `frontend/admin.html` (Providers tab + provider detail view + report resolution)
- `backend/index.mjs` (service categories endpoint, provider management, file uploads)
- `backend/db.pg.mjs` (schema updates for services_offered, coverage_areas, id_document_url)

---

## Next Step
