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

## Testing

### Test Case 1: Email-First Signup (PRIMARY TEST)
```
1. Open landing page, click "Solicitar servicio"
2. Click login button in modal
3. Enter email address (e.g., test@example.com)
4. Click "Continuar" button
5. Modal shows "¡Enlace enviado!" with message about checking email
✓ Modal should be waiting/monitoring (listening for email verification)
6. Open email inbox (in same browser)
7. Click the email verification link
✓ Should open email-verified.html in NEW TAB
✓ Should show "Correo verificado" / "Email verified" with checkmark
✓ Should show countdown "Cerrando en 3 segundos..."
8. Wait 3 seconds OR click close button
✓ Email verification tab should close
9. Return focus to ORIGINAL TAB with modal
✓ CRITICAL: Modal should auto-continue to NAME COLLECTION screen
✓ Should show "Nombre" / "Name" input field
✓ Should NOT still show "¡Enlace enviado!" message
✓ User should seamlessly continue signup without manual action
```

### Test Case 2: Phone-First Signup with Secondary Email
```
1. Open landing page, click "Solicitar servicio"
2. Click login button in modal
3. Enter phone number (e.g., +52 55 1234 5678)
4. Complete phone OTP verification
5. Enter first and last name
6. When offered secondary email, enter email address
7. Click "Agregar email"
8. Modal shows "¡Enlace enviado!" and monitoring starts
9. Check email inbox, click the verification link
✓ Should open email-verified.html in NEW TAB
✓ Should show "Correo verificado" success message
✓ Should have close button and countdown
10. Close the verification tab
11. Return to original modal
✓ Modal should auto-detect verification and close cleanly
✓ Should return to home page or show confirmation
✓ User should NOT need to manually close modal
```

### Test Case 3: Multiple Tabs / Window Switching
```
1. Open two browser windows side-by-side
2. In Window A: Start signup, enter email, show "¡Enlace enviado!"
3. In Window B: Open email inbox, get the verification link
4. In Window B: Click the link, verify email, see success screen
5. Return focus to Window A
✓ Window A modal should auto-continue to name collection
✓ Should not require any manual interaction
✓ Flow should be seamless
```

### Test Case 4: Slow Network / Delayed Verification
```
1. Enter email and trigger verification
2. Modal shows "¡Enlace enviado!" and starts monitoring
3. Simulate slow network: wait 5 seconds before opening email link
4. Click email link and verify
✓ Should still work - monitoring has 10-minute timeout
✓ Modal should continue to next step
```

### Test Case 5: Account Page Email Verification
```
1. Login to account with existing credentials
2. Go to /account.html section for email
3. Enter email address
4. Modal shows "¡Enlace enviado!"
5. Open email, click link
✓ Should open email-verified.html
✓ Should show success message
6. Close or wait for auto-close
✓ Should redirect back to /account.html?section=info
✓ Email should now show as verified
```

### Test Case 6: Expired/Invalid Link
```
1. Request email verification link
2. Wait 24+ hours (or simulate expired link)
3. Click the expired link
✓ Should show error: "Este enlace ya fue usado o expiró"
✓ Should offer to send a new link
✓ Modal should NOT hang or show blank page
```

## Verification Checklist

After deploying this fix, verify these critical behaviors:

- [ ] **Email link opens correct page**: Clicking email link opens `/email-verified.html` (not homepage)
- [ ] **Success message displays**: `email-verified.html` shows "Correo verificado" with checkmark
- [ ] **Countdown works**: If opened as popup, shows countdown and auto-closes
- [ ] **Modal auto-continues**: After verification, original modal automatically continues to next step
- [ ] **Name collection appears**: User sees name input field after email verification (email-first flow)
- [ ] **No manual interaction needed**: User doesn't need to manually close windows or refresh pages
- [ ] **Browser console clean**: No errors logged (check browser dev tools → Console)
- [ ] **Multiple browsers**: Test on Chrome, Safari, Firefox (storage events work differently)
- [ ] **Different device**: Email link works on phone receiving email, continues on desktop modal
- [ ] **Expired links**: Clicking old link shows error message, not blank page
- [ ] **Secondary email**: Phone-first users can add secondary email without issues
- [ ] **Account page**: Email verification from account page redirects back correctly

## Deployment

1. **Merge to main branch** — creates new commit
2. **Render backend auto-deploys** — watches `main` branch
3. **Cloudflare Pages auto-deploys** — watches `frontend/` folder
4. **No environment changes needed** — email link URL is hardcoded correctly
5. **No database migrations needed** — uses existing tables
6. **Monitor for errors** — check Render logs and Cloudflare Pages for any issues

### Rollback Plan

If issues arise:
1. Revert three lines in `shared-auth.js` back to `window.location.origin + '/'`
2. Revert `email-verified.html` to simpler version
3. Remove monitoring function calls
4. Push changes and redeploy

But the fix should be solid - it's a straightforward redirect + monitoring pattern.
