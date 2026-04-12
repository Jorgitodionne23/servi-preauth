# Email-First Signup Flow — Test Plan & Results

**Last Updated:** 2026-04-12
**Status:** Ready for Testing
**Scope:** End-to-end email-first signup with modal-to-email-link-window verification flow

---

## Overview

This document defines the complete test flow for the **email-first signup journey**, where a user:
1. Enters an email address as their primary identifier in the auth modal
2. Receives a Firebase magic link via email
3. Clicks the link in a new browser tab/window
4. Completes the signup process and returns control to the modal
5. Advances to name collection and completes signup

### Key Feature: Modal Resumption

When the user clicks the email verification link, it opens in a **new window/tab**. The link page:
- Verifies the email with Firebase
- Broadcasts completion signals via `window.opener` event and localStorage
- Shows a success screen with 3-second countdown
- The **original modal listens** and advances automatically without requiring user interaction

---

## System Architecture

### Components Involved

| Component | File | Purpose |
|-----------|------|---------|
| **Auth Modal** | `frontend/shared/shared-auth.js` | Renders identifier screen, triggers email link send, listens for verification |
| **Email Link Handler** | `frontend/shared/shared-auth.js` | Processes Firebase magic link, broadcasts signals |
| **Navbar** | `frontend/shared/shared-nav.js` | Opens auth modal, manages user session |
| **Landing Page** | `frontend/index.html` | Main entry point, includes auth modal listener |
| **Firebase SDK** | Firebase Auth (client-side) | Handles email link generation and verification |
| **Backend Auth** | `backend/index.mjs` | `/api/auth/check-identifier`, `/api/auth/firebase` endpoints |
| **Database** | `backend/db.pg.mjs` | `auth_users` table stores email, phone, verification status |

### Firebase Email Link Configuration

- **Method:** `auth.sendSignInLinkToEmail(email, options)`
- **Options:** `{ url: window.location.origin + '/', handleCodeInApp: true }`
- **Verification:** `auth.isSignInWithEmailLink(window.location.href)` on page load
- **Signing:** `auth.signInWithEmailLink(email, window.location.href)`

### State Persistence

Before sending the email link, the modal saves signup state to localStorage:

```javascript
servi_usl_state = {
  identifier: 'user@example.com',
  identifierType: 'email',
  firstIdentifierType: 'email',
  isNew: true,
  newUserData: {}
}
servi_email_link_target = 'user@example.com'
```

The email link page restores this state after Firebase verification, so the modal knows where to resume.

### Signal Broadcasting

After successful email verification, the email link page broadcasts completion:

1. **localStorage signal** — for cross-tab detection (backup):
   ```javascript
   localStorage.setItem('servi_email_verified_at', timestamp)
   ```

2. **Custom event** — to parent modal (primary):
   ```javascript
   window.opener.dispatchEvent(new Event('servi-email-verified'))
   ```

---

## Test Scenarios

### Scenario 1: Email-First Signup — Fresh Account

**Precondition:** User has no existing account (email not in database)

**Steps:**

| # | Action | Expected Outcome |
|---|--------|------------------|
| 1 | Click "Solicitar servicio" on landing page | Auth modal opens, Identifier screen rendered with email input field |
| 2 | Input: `test.newuser@example.com` | Input field auto-detects email (no @ pre-validation needed), country dropdown hides, input mode switches to `email` |
| 3 | Click "Continuar" button | Button disables (shows "..."), backend checks identifier |
| 4 | **Endpoint:** `POST /api/auth/check-identifier` | Backend returns `{ exists: false, identifierType: 'email' }` |
| 5 | Modal renders Email OTP screen | Screen shows: progress dots (2/4), email message, "Enviar enlace" button, error box |
| 6 | Click "Enviar enlace" button | Button disables, Firebase `sendSignInLinkToEmail` called, screen replaces with "Link sent" message with emoji and instructions |
| 7 | User receives email from Firebase | Email subject: "Sign in to SERVI" (or localized), contains clickable link with magic code |
| 8 | User clicks link in email | **New window/tab opens**, email link page loads, `window.opener` set to original tab |
| 9 | **Page load:** Email link verification | `handleEmailLinkSignIn()` runs: detects email link via `isSignInWithEmailLink()`, retrieves email from localStorage, restores USL state |
| 10 | Firebase processes email link | `auth.signInWithEmailLink()` completes, Firebase user created with `email_verified=true` |
| 11 | **Backend sync** | `onAuthStateChanged()` fires, triggers `syncWithBackend()`, issues JWT, stores in localStorage |
| 12 | **Success screen rendered** | Email link page shows: green checkmark, "¡Verificación exitosa!" title, message, "Closing in 3..." countdown, close button |
| 13 | **Signal broadcast** | Page calls `window.__broadcastEmailVerified()`: writes to localStorage, dispatches `servi-email-verified` event to original modal |
| 14 | **Modal detects signal** | Original modal receives `servi-email-verified` event, recognizes `uslIsNew=true` and `uslFirstIdentifierType='email'` |
| 15 | **Modal advances** | Modal shows Name Collection screen (no need for secondary OTP), progress dots at 3/4 |
| 16 | User sees name collection screen | Fields: first name (required), last name (required), terms checkbox, "Continuar" button |
| 17 | 3-second countdown expires on email link page | Email link tab closes automatically (`window.close()`) |
| 18 | User fills name fields (optional) | Example: `Juan García` |
| 19 | User clicks "Continuar" | PATCH `/api/auth/me` called with name, account saved with `email_verified=true` and `phone_verified=false` |
| 20 | Modal closes on success | `onAuthSuccess()` triggers, modal closes, user returned to landing page |
| 21 | Navbar shows user logged in | Avatar displays, user name visible, "Mi Cuenta" menu appears |
| 22 | Verify database state | `auth_users` table shows: `firebase_uid`, `email='test.newuser@example.com'`, `email_verified=true`, `phone_verified=false`, `first_identifier_type='email'` |

**Success Criteria:**
- ✅ Modal opens on CTA click
- ✅ Identifier screen accepts email input
- ✅ Backend recognizes new user (exists=false)
- ✅ Email magic link sent successfully
- ✅ Email link page opens in new window/tab
- ✅ Firebase verification succeeds
- ✅ Modal receives signal and advances to name screen
- ✅ User completes name entry
- ✅ Account created with `email_verified=true`
- ✅ User logged in, navbar shows name

---

### Scenario 2: Email-First Signup → Secondary Phone (Optional)

**Precondition:** User started email-first signup, completed name screen

**Steps:**

| # | Action | Expected Outcome |
|---|--------|------------------|
| 1 | After name collection, modal shows Secondary Identifier screen | Title: "¿Tu teléfono?" (optional), country dropdown + phone input, "Continuar" button, "Omitir" (skip) button |
| 2 | User enters phone (optional) | Example: `+525551234567` |
| 3 | Click "Continuar" | Modal proceeds to phone OTP verification |
| 4 | User verifies phone OTP | Standard 6-digit SMS code flow |
| 5 | After phone verification | Backend PATCH marks `phone_verified=true` |
| 6 | Modal closes, user logged in | Navbar shows email + phone verified |
| 7 | Verify database state | `auth_users` shows: `email_verified=true`, `phone_verified=true`, `phone_number='+525551234567'` |

**Alternative:** User clicks "Omitir" (skip phone)

| # | Action | Expected Outcome |
|---|--------|------------------|
| 1-2 | (same) | |
| 3 | Click "Omitir" button | Backend marks `servi_email_skipped=1` (or equiv. flag) |
| 4 | Modal closes | User is `email_verified=true`, `phone_verified=false` |
| 5 | At booking step 3 | System requires phone (booking gate enforces `phone_verified=true`), user prompted to add phone |

**Success Criteria:**
- ✅ Secondary phone screen appears after name
- ✅ Phone OTP flow works
- ✅ Skip button allows email-only signup
- ✅ Database reflects correct verification states

---

### Scenario 3: Email Link Already Used (Invalid Code)

**Precondition:** User received email link, but link was already used or expired

**Steps:**

| # | Action | Expected Outcome |
|---|--------|------------------|
| 1 | User clicks email link that was already used | Email link page loads |
| 2 | Firebase verifies link | `auth.signInWithEmailLink()` throws `auth/invalid-action-code` |
| 3 | Error handler triggers | Modal renders back on email link page, shows error message |
| 4 | Error message displays | "Este enlace ya fue usado o expiró. Solicita uno nuevo." (ES) or English equiv. |
| 5 | User can request new link | "Enviar enlace" button is enabled, user can retry |
| 6 | User clicks "Volver" (back arrow) | Back to identifier screen |

**Success Criteria:**
- ✅ Invalid code caught by error handler
- ✅ User-friendly error message displayed
- ✅ User can request new link or go back

---

### Scenario 4: Email Link Clicked in Different Browser/Device

**Precondition:** User sent email link from Device A, clicks it on Device B

**Steps:**

| # | Action | Expected Outcome |
|---|--------|------------------|
| 1 | User clicks email link from Device B | Email link page loads |
| 2 | localStorage does NOT contain `servi_email_link_target` | (Device B has separate localStorage) |
| 3 | Fallback prompt appears | User prompted: "Confirma tu correo electrónico:" |
| 4 | User enters email in prompt | Example: `test.newuser@example.com` |
| 5 | Firebase verification proceeds | Email link signed in successfully |
| 6 | Success screen appears | Confirmation shown, but no countdown (no `window.opener` on Device B) |
| 7 | User clicks "Close" button | Page closes or redirects to home |
| 8 | Device A modal status | On Device A, modal is still waiting (Device B didn't have parent window) |

**Success Criteria:**
- ✅ Fallback prompt handles missing localStorage
- ✅ Email entry via prompt works
- ✅ Verification succeeds without parent window
- ✅ User can close successfully

---

### Scenario 5: Cross-Tab localStorage Detection (Bonus)

**Precondition:** Email link page doesn't have `window.opener` (e.g., user right-clicked → "Open in new tab")

**Steps:**

| # | Action | Expected Outcome |
|---|--------|------------------|
| 1 | Email link page processes verification | `handleEmailLinkSignIn()` completes |
| 2 | `window.__broadcastEmailVerified()` writes localStorage | `servi_email_verified_at` set to timestamp |
| 3 | Original modal periodically checks localStorage | (If event dispatch fails) modal can fall back to polling/storage event |
| 4 | Modal detects timestamp in localStorage | Modal recognizes email verification and advances |

**Note:** Primary mechanism is event dispatch; localStorage is backup.

---

## Edge Cases & Error Handling

### Edge Case 1: Modal Closed Before Email Link Clicked

**Expected Behavior:**
- Email link page verifies successfully
- Shows success screen (no countdown since `window.opener` is null)
- User can close tab manually
- If user returns to main page later, they're already logged in (Firebase session persists)

### Edge Case 2: Firebase Rate Limit (Too Many Link Sends)

**Expected Behavior:**
- Firebase throws `auth/too-many-requests` on `sendSignInLinkToEmail()`
- Error handler catches, displays: "Demasiados intentos. Espera unos minutos."
- User can wait and retry

### Edge Case 3: Network Timeout During Email Link Verification

**Expected Behavior:**
- Firebase throws network error
- `handleEmailLinkSignIn()` catches error
- Error message displayed (non-`invalid-action-code` errors)
- User prompted to retry or go back

### Edge Case 4: User Modifies Email Between Steps

**Scenario:** User enters `user@example.com` on screen 1, deletes email from localStorage, clicks link with email from URL

**Expected Behavior:**
- Fallback email extraction logic triggers
- Email extracted from Firebase link
- Verification proceeds with URL email

---

## Success Criteria Checklist

### Core Flow (Must Pass)

- [ ] **Screen 1 — Identifier Input**
  - [ ] Modal opens on CTA click
  - [ ] Email input field visible
  - [ ] Country dropdown hides for email input
  - [ ] "Continuar" button enabled

- [ ] **Backend — Identifier Check**
  - [ ] `POST /api/auth/check-identifier` called
  - [ ] Returns `{ exists: false }` for new user
  - [ ] Returns `{ exists: true, provider: 'email' }` for existing email account

- [ ] **Screen 2 — Email OTP**
  - [ ] Progress dots show 2/4
  - [ ] "Enviar enlace" button visible and clickable
  - [ ] Error box rendered (empty initially)

- [ ] **Email Link Send**
  - [ ] `sendSignInLinkToEmail()` called with normalized email
  - [ ] USL state saved to localStorage (`servi_usl_state`, `servi_email_link_target`)
  - [ ] "Link sent!" message appears
  - [ ] User receives Firebase email

- [ ] **Email Link Click**
  - [ ] Link opens in new window/tab
  - [ ] `window.opener` references original modal page
  - [ ] `handleEmailLinkSignIn()` runs on page load

- [ ] **Email Verification**
  - [ ] `auth.isSignInWithEmailLink()` returns true
  - [ ] USL state restored from localStorage
  - [ ] `auth.signInWithEmailLink(email, url)` succeeds
  - [ ] Firebase user created with `email_verified=true`

- [ ] **Backend Sync**
  - [ ] `onAuthStateChanged()` fires (Firebase listener)
  - [ ] `syncWithBackend()` called, JWT issued
  - [ ] Session stored in localStorage

- [ ] **Signal Broadcasting**
  - [ ] `window.__broadcastEmailVerified()` called
  - [ ] localStorage `servi_email_verified_at` set
  - [ ] Custom event `servi-email-verified` dispatched to opener

- [ ] **Original Modal Reception**
  - [ ] Modal listener receives `servi-email-verified` event
  - [ ] Modal state checks: `uslIsNew=true`, `uslFirstIdentifierType='email'`
  - [ ] Modal advances to Name Collection screen

- [ ] **Success Screen on Email Link Page**
  - [ ] Green checkmark (✓) icon displayed
  - [ ] "¡Verificación exitosa!" title (ES) or "Verification Successful!" (EN)
  - [ ] Message: "Tu correo ha sido verificado" (ES)
  - [ ] 3-second countdown: "Cerrando en 3..."
  - [ ] Close button clickable

- [ ] **Email Link Tab Close**
  - [ ] Countdown expires after 3 seconds
  - [ ] Tab closes automatically (`window.close()`)
  - [ ] If user manually closes, no error

- [ ] **Name Collection Screen**
  - [ ] Progress dots show 3/4
  - [ ] First name field (required)
  - [ ] Last name field (required)
  - [ ] Terms checkbox
  - [ ] "Continuar" button

- [ ] **Account Creation**
  - [ ] PATCH `/api/auth/me` called with `{ first_name, last_name }`
  - [ ] Backend stores user in `auth_users` table
  - [ ] `email_verified=true` set
  - [ ] JWT refreshed, stored in localStorage

- [ ] **Modal Closure & Navbar Update**
  - [ ] Modal closes
  - [ ] Navbar rebuilds with user avatar + name
  - [ ] "Mi Cuenta" dropdown available
  - [ ] User is logged in

- [ ] **Database State**
  - [ ] `auth_users` table contains new account
  - [ ] `firebase_uid`, `email`, `first_name`, `last_name` populated
  - [ ] `email_verified=true`, `phone_verified=false`
  - [ ] `first_identifier_type='email'`

---

### Bilingual (ES/EN) ✓

- [ ] All screens display in user's selected language
- [ ] Error messages localized
- [ ] Success screen uses correct language
- [ ] Toggle in navbar switches language mid-flow

---

### Mobile Responsiveness

- [ ] Modal renders fully on iPhone (375px)
- [ ] Modal renders fully on Android (360px)
- [ ] Touchable buttons (min 44px)
- [ ] Input fields accessible without zoom

---

## Test Execution Notes

### Environment Setup

**Prerequisites:**
1. **Backend running:** `node backend/index.mjs` (or deployed on Render)
   - Environment variables set (see `.env.example`)
   - Firebase config in `backend/config.js`
   - Database connected

2. **Frontend running:** Static files served (Cloudflare Pages or local dev server)
   - `frontend/index.html` accessible
   - `frontend/config.js` has correct API_BASE and FIREBASE_CONFIG

3. **Firebase Project configured:**
   - Email sign-in enabled
   - Magic link sender configured (from email)
   - reCAPTCHA v3 invisible verified

4. **Email Testing:**
   - Test email account ready (e.g., Gmail sandbox, temporary email service)
   - Able to access and click links in emails

### Test Execution Steps

**Option A: Manual Testing**

1. Open landing page in browser (e.g., `https://servi-preauth.pages.dev`)
2. Click "Solicitar servicio" button
3. Follow steps 1-21 from Scenario 1 above
4. Check database to verify account created
5. Repeat for other scenarios as needed

**Option B: Automated Testing (Playwright)**

See `tests/03-auth-otp.spec.js` and related test files for example Playwright tests.

### Debugging Tips

**If email link doesn't open in new window:**
- Check browser console for errors
- Verify Firebase config is loaded
- Ensure `handleCodeInApp: true` is set

**If modal doesn't advance after email verification:**
- Check browser console for event dispatch errors
- Verify `window.opener` is accessible (same origin)
- Check localStorage for `servi_usl_state` (should be cleared after use)
- Listen for `servi-email-verified` event in modal listener code

**If success screen doesn't appear:**
- Check `uslIsNew` and `uslFirstIdentifierType` values in shared-auth.js
- Verify `__handleEmailLinkAsScreen()` is being called
- Check that `window.location.origin` is set correctly

**Database Verification:**

```sql
-- Check newly created user
SELECT * FROM auth_users WHERE email = 'test.newuser@example.com';

-- Expected columns:
-- firebase_uid (non-null UUID)
-- email (lowercased)
-- first_name, last_name
-- email_verified (true)
-- phone_verified (false)
-- first_identifier_type ('email')
-- auth_provider (Firebase provider type)
-- created_at (current timestamp)
```

---

## Test Results

### Test Date: [TO BE FILLED]

| Scenario | Pass/Fail | Notes | Tester |
|----------|-----------|-------|--------|
| 1. Email-First Signup — Fresh Account | [ ] | | |
| 2. Secondary Phone (Optional) | [ ] | | |
| 3. Invalid Email Code | [ ] | | |
| 4. Different Device/Browser | [ ] | | |
| 5. localStorage Fallback | [ ] | | |

### Issues Encountered

| Issue | Severity | Resolution |
|-------|----------|-----------|
| (Add if found) | | |

### Sign-Off

- **Tested by:** [Name]
- **Date:** [YYYY-MM-DD]
- **Overall Status:** [ ] Pass [ ] Fail [ ] Partial
- **Ready for Production:** [ ] Yes [ ] No

---

## Implementation References

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `renderIdentifierScreen()` | `shared-auth.js` | Renders email/phone input screen |
| `renderOTPScreen('email', isLogin)` | `shared-auth.js` | Renders email magic link screen |
| `window.__uslSendOTP()` | `shared-auth.js` | Sends Firebase magic link |
| `handleEmailLinkSignIn()` | `shared-auth.js` | Processes email link on page load |
| `window.__broadcastEmailVerified()` | `shared-auth.js` | Signals completion to parent window |
| `window.__handleEmailLinkAsScreen()` | `shared-auth.js` | Shows success screen on email link page |
| `onAuthStateChanged(firebaseUser)` | `shared-auth.js` | Syncs Firebase user to backend |
| `setupAuthModalListener()` | `index.html` | Listens for `servi-email-verified` event |

### Key localStorage Keys

| Key | Purpose | Lifetime |
|-----|---------|----------|
| `servi_email_link_target` | Email being verified | Cleared after verification |
| `servi_usl_state` | Signup state (identifier, type, isNew, etc.) | Cleared after verification |
| `servi_recovery_mode` | Account security recovery context | Cleared after use |
| `servi_email_verification_mode` | Account email add/verify context | Cleared after use |
| `servi_email_verified_at` | Timestamp of verification (backup signal) | Kept for future reference |

### Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/check-identifier` | POST | Check if identifier (email/phone) exists |
| `/api/auth/firebase` | POST | Sync Firebase user to backend, issue JWT |
| `/api/auth/me` | PATCH | Update current user (name, etc.) |
| `/api/auth/add-email` | POST | Add/verify secondary email |

---

## Known Limitations & Future Work

1. **Firebase Email Link Expiration:** Links expire after 24 hours. If user doesn't click within 24 hours, they must request a new link. ✅ Handled by `auth/invalid-action-code` error.

2. **Cross-Device Email Links:** If email link clicked on different device, user must provide email via prompt. ✅ Handled by fallback prompt in `handleEmailLinkSignIn()`.

3. **Mobile Email Clients:** Some email clients may not properly preserve `handleCodeInApp: true`. If link opens in browser, Firebase will redirect with `?link=...` code in URL. ✅ Firebase SDK handles both in-app and redirect modes.

4. **Slow Network:** If sync takes >5 seconds after email verification, user might see lag. ✅ Mitigated by showing success screen while sync happens in background.

5. **Private Browsing:** localStorage not available; cross-tab signal may fail. ✅ Fallback to custom event (same-origin).

---

## Conclusion

This test plan covers the **email-first signup flow** from identifier input through account creation. The key innovation is **modal-to-email-link-window signal broadcasting**, which allows the modal to advance seamlessly after the user verifies their email in a separate window/tab.

**All success criteria must be met before production deployment.**

For questions or updates, contact: `serv.clientserv@gmail.com`
