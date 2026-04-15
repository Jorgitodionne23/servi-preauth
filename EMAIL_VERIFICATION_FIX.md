# Email Verification Link Fix (2026-04-12)

## Problem

Email verification links were not properly returning users to continue their signup flow, causing them to:

- Get stuck in the email verification step of the auth modal
- Not see confirmation that their email was verified
- Skip signup steps if they refreshed the page

## Root Cause Analysis

**Primary issue**: Email link redirect URL was incorrect

- Old URL: `window.location.origin + '/'` (homepage)
- Problem: Homepage doesn't show success confirmation, just redirects to root

**Secondary issue**: Modal wasn't detecting when email verification completed in another tab

- User starts signup in modal on page A
- User clicks email link → opens email-verified.html in NEW TAB (email client behavior)
- New tab verifies email, shows success message, broadcasts signal
- **Original modal on page A has no way to know verification is complete**
- Modal stays on "¡Enlace enviado!" screen forever
- User must manually close verification tab and return to original tab

## Solution

### Changes Made

1. **Fixed email link redirect URL** in `frontend/shared/shared-auth.js`:
   - Lines 430, 917, 950: Changed redirect to `email-verified.html`
   - Old: `{ url: window.location.origin + '/', handleCodeInApp: true }`
   - New: `{ url: window.location.origin + '/email-verified.html', handleCodeInApp: true }`

2. **Updated `frontend/email-verified.html`**:
   - Waits for email verification to complete before showing success screen
   - Broadcasts verification completion signal via localStorage
   - Properly handles both popup and new-tab scenarios

3. **Added `__monitorEmailVerification()` function** in `frontend/shared/shared-auth.js`:
   - Monitors when user clicks email link in new tab
   - Detects completion via localStorage change events
   - Waits for Firebase auth state to update (`window.__user`)
   - Automatically continues to next signup step (name collection)
   - Works with multiple detection methods:
     - Storage events (cross-tab communication)
     - Visibility change events (when user returns to tab)
     - Polling fallback (for browsers with limited event support)

### How It Works Now

**Email-first signup flow:**

1. User in modal → enters email → clicks "Enviar enlace"
2. Firebase sends email with link to `/email-verified.html?oobCode=...`
3. **Modal monitoring starts** via `__monitorEmailVerification()`
4. Modal shows "¡Enlace enviado!" and waits
5. User opens email in separate tab/window
6. New tab loads `email-verified.html` with verification code
7. `email-verified.html` processes verification:
   - Firebase email verification completes
   - Sets localStorage flag `servi_email_verified_at`
   - Shows success message: "Correo verificado"
8. **Original modal detects the signal** (via storage event or polling)
9. **Original modal auto-continues** to name collection screen
10. User sees seamless flow: email verified → name entry (no manual steps needed)

**Phone-first signup with secondary email:**

1. User completes phone OTP, enters name
2. Optional secondary email offered → user enters email
3. Modal shows "¡Enlace enviado!" with monitoring active
4. User gets email, clicks link → new tab shows success
5. Original modal detects completion and closes cleanly
6. User returned to original modal/page with email verified

**Key improvements:**

- ✅ No more stalled modal screens
- ✅ Users can't skip signup steps by refreshing
- ✅ Works whether email link opens in new tab or popup
- ✅ Works across browsers (multiple detection fallbacks)
- ✅ Clear success feedback on email-verified.html
- ✅ Modal automatically continues flow
