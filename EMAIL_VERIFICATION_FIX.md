# Email Verification Link Fix (2026-04-12)

## Problem

Email verification links were redirecting to the homepage instead of showing a success page, causing users to:
- Get stuck in the email verification step of the auth modal
- Refresh the page and skip the entire signup flow (Name Collection, Phone OTP, etc.)
- Not see any confirmation that their email was verified

## Root Cause

The email link redirect URL in `shared-auth.js` was configured to send Firebase email links to the homepage (`window.location.origin + '/'`) instead of a dedicated email verification page. 

When the email link was clicked:
1. User opened the homepage with the email verification code in the URL
2. The homepage loaded shared-auth.js which processed the email code
3. For email-first signups, a success screen was shown
4. **For phone-first signups with secondary email, only the modal would close** — leaving the user on the homepage with no indication of success
5. Users could then refresh and skip the rest of the signup flow

## Solution

### Changes Made

1. **Changed email link redirect URL** in `frontend/shared/shared-auth.js`:
   - Line 430: Signup email OTP link
   - Line 833: Recovery email link  
   - Line 866: Account page email verification link
   - Old: `{ url: window.location.origin + '/', handleCodeInApp: true }`
   - New: `{ url: window.location.origin + '/email-verified.html', handleCodeInApp: true }`

2. **Updated `frontend/email-verified.html`**:
   - Added wait for email link processing to complete (`window.__syncPromise`)
   - Added broadcast signal to parent modal when verification completes
   - Ensures countdown only starts after email verification is done

### How It Now Works

**Flow for all email verification types:**

1. User is in auth modal on any page
2. User enters email → modal persists state to `localStorage`
3. Firebase sends email with link to `https://servi-preauth.pages.dev/email-verified.html?oobCode=...`
4. User clicks email link → opens `email-verified.html` with verification code
5. `email-verified.html` includes `shared-auth.js` which:
   - Detects the email verification code
   - Completes Firebase email verification
   - Syncs with backend if needed
   - Broadcasts success to parent modal (if opened via window.opener)
6. **User sees clear "Email Verified" success message with close button**
7. Countdown auto-closes window if opened as popup
8. Parent modal receives signal and can resume signup flow

**Phone-first secondary email case specifically:**
- After email verification completes, the page stays showing the success message
- User can close the window manually or wait for auto-close countdown
- Original modal in background is notified via broadcast signal
- No jarring redirects or missing feedback

## Testing

### Test Case 1: Email-First Signup
```
1. Open landing page, click "Solicitar servicio"
2. Click login button
3. Enter email address (e.g., test@example.com)
4. Click "Continuar" to send email link
5. Check email inbox
6. Click the email verification link
✓ Should open email-verified.html
✓ Should show "Correo verificado" / "Email verified"
✓ Should show countdown or close button
✓ After closing, modal should resume signup flow (name collection, etc.)
```

### Test Case 2: Phone-First Signup with Secondary Email
```
1. Open landing page, click "Solicitar servicio"
2. Click login button
3. Enter phone number (e.g., +52 55 1234 5678)
4. Complete phone OTP verification
5. Enter name
6. When offered secondary email, enter email address
7. Click "Agregar email"
8. Check email inbox
9. Click the email verification link
✓ Should open email-verified.html
✓ Should show "Correo verificado" success message
✓ Should NOT show modal overlay on top
✓ Should show close button and countdown
✓ No redirect loops or blank pages
```

### Test Case 3: Account Page Email Verification
```
1. Login to account (or existing account)
2. Go to /account.html
3. In "Personal Info" section, add email address
4. Click "Verify email"
5. Check email inbox
6. Click the email verification link
✓ Should open email-verified.html
✓ Should show "Correo verificado" message
✓ Should have close button
✓ Should return to account page after closing
```

### Test Case 4: Cross-Browser/Device Email Link
```
1. On Browser A: Start signup, enter email (but don't verify yet)
2. On Browser B: Receive email with verification link
3. Click the link on Browser B
✓ Should prompt for email confirmation (localStorage not available on Browser B)
✓ Should complete verification
✓ Should show success message
✓ Should work on Browser A next time they open the modal
```

### Test Case 5: Expired Link Handling
```
1. Request email verification link
2. Wait for link to expire (usually 24 hours)
3. Click expired link
✓ Should show error message: "Este enlace ya fue usado o expiró"
✓ Should offer to send a new link
✓ Should not hang or redirect to blank page
```

## Verification

After deploying this fix, verify:

- [ ] Email links no longer redirect to homepage
- [ ] `email-verified.html` shows properly formatted success message
- [ ] Countdown timer works if page opened as popup
- [ ] No console errors in browser dev tools
- [ ] Modal in background receives email verified signal
- [ ] Users can complete signup after email verification
- [ ] Cross-browser email links work (with email confirmation prompt)
- [ ] Expired links show proper error message

## Deployment

1. Push changes to main branch
2. Render backend auto-deploys
3. Cloudflare Pages auto-deploys frontend
4. No new environment variables needed
5. No database migrations needed
