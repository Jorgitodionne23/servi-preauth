# Email Verification Flow — Edge Case Testing Documentation

**Date Created:** 2026-04-12
**Component:** Email Link Modal Resumption System
**Status:** Ready for Testing
**Tester Name:** [To be filled in]
**Test Date:** [To be filled in]

---

## Overview

This document describes edge cases and failure scenarios for the email verification flow implemented in Tasks 1-7. The flow allows signup modal to resume verification when a user clicks an email verification link in a new tab/window.

**Key System Components:**
- `frontend/email-verified.html` — Success screen shown after email link click
- `frontend/shared/shared-auth.js` — Email verification signal functions and modal listeners
- `frontend/index.html` — Auth modal with email-verified event listener
- `localStorage` keys — `servi_email_link_target`, `servi_email_verified_at`, `servi_email_verification_mode`
- `window.opener` — Reference to parent window when email link opens in new tab

---

## Edge Case 1: Modal Closed Before Email Link Click

**Scenario:** User starts signup with email verification → modal is closed → user clicks email verification link in new tab

**Setup Steps:**
1. Open `https://servi-preauth.pages.dev` in Chrome
2. Click "Login / Crear cuenta" button to open auth modal
3. If on phone: Enter email (e.g., `testuser@gmail.com`)
   - Tap "Continuar" → "Enviar código" button to trigger Firebase magic link
   - Don't wait for SMS code
4. Immediately close the auth modal (click X button or outside modal)
5. Open email client (Gmail or test email inbox)
6. Click the Firebase magic link verification link
   - **Expected:** New tab opens with success screen

**Expected Behavior:**
- Success screen displays (language matches localStorage setting)
- "Closing in 3 seconds..." countdown is **hidden**
- "Cerrar / Close" button is visible and clickable
- Clicking button manually closes the tab
- No errors in browser console

**Why:** `window.opener` is `null` because modal was closed before link opened. Success page detects this and hides countdown.

**Actual Results:**
```
[Tester fills in]
- Success screen displays: [ ] Yes [ ] No
- Countdown hidden: [ ] Yes [ ] No
- Close button visible: [ ] Yes [ ] No
- Close button works: [ ] Yes [ ] No
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 2: Email Link Opened in Same Window (No window.opener)

**Scenario:** Instead of Firefox/Chrome auto-opening link in new tab, user navigates to email link on same page (same-window click)

**Setup Steps:**
1. Start signup flow with email identifier
2. Enter email → request verification code sent
3. Open browser DevTools console on signup page
4. Manually navigate to the email verification link on same page:
   ```javascript
   window.location = 'https://servi-preauth.pages.dev/email-verified.html?mode=email-verify&code=...'
   ```
5. This simulates navigating to the link on the same window (no new tab/window opened)

**Expected Behavior:**
- Success screen displays
- Countdown timer is **hidden** (because `window.opener` is `undefined` in same-window navigation)
- Page shows success message in correct language
- "Cerrar / Close" button closes the page
- No automatic 3-second close

**Why:** `window.opener` check fails in same-window navigation because there's no parent window context.

**Actual Results:**
```
[Tester fills in]
- Page loads without error: [ ] Yes [ ] No
- Countdown hidden: [ ] Yes [ ] No
- Success message displays: [ ] Yes [ ] No
- Language correct: [ ] Yes [ ] No
- Manual close button works: [ ] Yes [ ] No
- Auto-close does NOT occur: [ ] Correct [ ] Incorrect (auto-closed when shouldn't)
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 3: Multiple Email Verifications in Same Browser Session

**Scenario:** User starts two separate signup flows with different emails, clicks both verification links in sequence

**Setup Steps:**
1. Open `servi-preauth.pages.dev` in Chrome
2. Click "Login / Crear cuenta" → Modal opens
3. Enter first email: `user1@gmail.com`
4. Click "Continuar" → "Enviar código" to send verification link
5. **Keep the modal open**
6. Open new browser tab, navigate to same site
7. Click "Login / Crear cuenta" again → **New second modal opens**
8. Enter second email: `user2@gmail.com`
9. Click "Continuar" → "Enviar código" to send verification link
10. **Keep both modals open**
11. Open email client, click first verification link (for `user1@gmail.com`)
    - Success screen shows for first email
    - First modal should resume with email marked verified
12. Go back to first browser tab, click second verification link (for `user2@gmail.com`)
    - Success screen shows for second email
    - Second modal should resume with email marked verified

**Expected Behavior:**
- Both verification processes complete independently
- Each localStorage key (`servi_email_link_target`, `servi_email_verified_at`) reflects the most recent verification
- Both modals receive `servi-email-verified` event and resume properly
- No crosstalk between the two signup processes
- Both users can complete signup independently

**Why:** localStorage is shared across tabs, so `servi_email_verified_at` gets overwritten. Modals listen for generic `servi-email-verified` event, so both will trigger. Only the most recently verified email is persisted.

**Actual Results:**
```
[Tester fills in]
- First email verification completes: [ ] Yes [ ] No
- First modal resumes: [ ] Yes [ ] No
- First modal shows email verified: [ ] Yes [ ] No
- Second email verification completes: [ ] Yes [ ] No
- Second modal resumes: [ ] Yes [ ] No
- Second modal shows email verified: [ ] Yes [ ] No
- localStorage reflects second email: [ ] Yes [ ] No
- No console crosstalk errors: [ ] Yes [ ] No
- Both users can proceed: [ ] Yes [ ] No
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 4: Language Switching (Email Verification with Different Languages)

**Scenario:** User starts signup in English → sends verification link → opens link in Spanish mode

**Setup Steps:**
1. Open `servi-preauth.pages.dev`
2. Check current language in navbar (should default to "ES")
3. Click language toggle → Switch to "EN"
4. Click "Login / Crear cuenta" → Modal opens in English
5. Enter email → Send verification link
6. **Before clicking link:** Go to navbar, click language toggle → Switch back to "ES"
7. Open email verification link in new tab
8. Success screen should show (which language?)

**Expected Behavior:**
- Success screen displays in **English** (the language that was active when verification link was clicked, stored in localStorage)
- Not in Spanish (despite current page setting)
- Countdown and close button text match the language
- Modal resumes in correct language context

**Why:** `localStorage.getItem('servi_lang')` is read at email-verified.html page load. If user changed global language toggle before clicking link, email-verified.html should still show the language from when the verification was triggered.

**Alternate Test:**
- Start in Spanish → Send link → Switch to English → Click link → Should show Spanish success screen

**Actual Results:**
```
[Tester fills in]
- Test Case A (EN start, ES before click):
  - Success screen language: [EN / ES / Wrong]
  - Expected: EN, Actual: ____
  - Countdown language matches: [ ] Yes [ ] No
  - Modal resumes in correct state: [ ] Yes [ ] No

- Test Case B (ES start, EN before click):
  - Success screen language: [ES / EN / Wrong]
  - Expected: ES, Actual: ____
  - Countdown language matches: [ ] Yes [ ] No
  - Modal resumes in correct state: [ ] Yes [ ] No

- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 5: Private Browsing Mode / localStorage Unavailable

**Scenario:** User initiates signup in private/incognito browsing where localStorage may be unavailable or read-only

**Setup Steps:**
1. Open Chrome in Incognito mode (or Firefox in Private)
2. Navigate to `servi-preauth.pages.dev`
3. Click "Login / Crear cuenta" → Modal opens
4. Enter email identifier
5. Click "Continuar" → Send verification link
6. Check if Safari/Firefox/Chrome throws quota exceeded error in DevTools
7. Click email verification link
8. Expected: Success screen shows despite localStorage limitations

**Expected Behavior:**
- Modal opens in private mode without errors
- Email verification link can be clicked
- Success screen displays even if localStorage is unavailable
- "Closing in 3 seconds..." countdown still works (uses `setInterval`, not localStorage)
- Manual close button functions
- No console errors related to storage quota

**Why:** Code should have try-catch around `localStorage.setItem()` to prevent quota exceeded errors from breaking the flow.

**Implementation Check:**
```javascript
try {
  localStorage.setItem('servi_email_verified_at', Date.now().toString());
} catch (e) {
  // quota exceeded or private mode — continue anyway
  console.warn('[SERVI] localStorage unavailable:', e.message);
}
```

**Actual Results:**
```
[Tester fills in]
- Incognito mode: [ ] Chrome [ ] Firefox [ ] Safari
- Modal opens without errors: [ ] Yes [ ] No
- Email verification completes: [ ] Yes [ ] No
- Success screen displays: [ ] Yes [ ] No
- Countdown timer works: [ ] Yes [ ] No
- Close button works: [ ] Yes [ ] No
- localStorage quota error in console: [ ] Yes [ ] No (should be No)
- Any storage-related console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 6: Rapid Successive Email Link Clicks (Double-Click)

**Scenario:** User quickly double-clicks or taps email verification link twice in rapid succession

**Setup Steps:**
1. Start signup flow with email
2. Send verification link
3. Open email verification link in new tab
4. **Immediately** click "Cerrar / Close" button twice rapidly OR wait for auto-close and rapidly re-open the page in same tab
5. Observe modal resumption behavior

**Expected Behavior:**
- First verification completes, success screen shows
- Modal receives `servi-email-verified` event and resumes
- Second rapid click/open is ignored or handled gracefully
- Modal state remains consistent
- No duplicate account creation
- No console errors from race conditions

**Why:** Email verification should be idempotent. Clicking same link twice shouldn't double-verify or corrupt state.

**Actual Results:**
```
[Tester fills in]
- First click works: [ ] Yes [ ] No
- Modal resumes after first click: [ ] Yes [ ] No
- Second rapid click handled: [ ] Gracefully [ ] With error [ ] Ignored
- Modal state consistent: [ ] Yes [ ] No
- No duplicate events in console: [ ] Yes [ ] No
- No account duplication: [ ] Yes [ ] No
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 7: Network Latency During Verification

**Scenario:** Email link clicked but network is slow (throttled connection)

**Setup Steps:**
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G" or custom throttle (50 Kbps down, 20 Kbps up)
3. Click email verification link
4. Monitor:
   - Page load time
   - Firebase verification call completion
   - Modal resumption timing

**Expected Behavior:**
- Page loads (slowly) but doesn't hang
- Success screen displays after Firebase verification completes (may take 3-5s)
- Countdown timer begins only after verification succeeds
- Modal resumes despite latency
- No timeout errors
- User can manually close while waiting

**Why:** Network latency shouldn't break the flow. Countdown should only start after successful verification.

**Actual Results:**
```
[Tester fills in]
- Page loads under throttle: [ ] Yes [ ] No
- Firebase verification succeeds: [ ] Yes [ ] No
- Success screen displays: [ ] Yes [ ] No
- Countdown starts: [ ] Yes [ ] No
- Modal resumes: [ ] Yes [ ] No
- Load time (estimated): ____ seconds
- Any timeout errors: [ ] Yes [ ] No
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 8: Browser Back Button After Email Verification

**Scenario:** User clicks email verification link → sees success screen → presses browser back button

**Setup Steps:**
1. Start signup flow, send verification link
2. Click email link → Success screen displays
3. **Before** 3-second auto-close (if window.opener exists), press browser back button
4. OR if auto-closed, manually reopen the link in history

**Expected Behavior:**
- If back button pressed during countdown: Tab closes or goes back to email client
- If tab already auto-closed: No back history (new tab from link)
- Modal in original tab should still be in correct state (email verified or awaiting next step)

**Why:** Browser history isn't meaningful for email link success pages. They should be ephemeral.

**Actual Results:**
```
[Tester fills in]
- Back button during countdown: [Closes / Goes back / Other: ____]
- Original modal state preserved: [ ] Yes [ ] No
- Modal still shows email verified status: [ ] Yes [ ] No
- No state corruption: [ ] Yes [ ] No
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 9: Modal Refresh Before Email Verification Complete

**Scenario:** User closes modal, refreshes the page, then clicks email verification link

**Setup Steps:**
1. Start signup flow
2. Send email verification link
3. Close modal
4. Press F5 (Refresh) on the signup page
5. Click email verification link
6. New success screen opens in new tab

**Expected Behavior:**
- Success screen displays (no window.opener, countdown hidden)
- Manual close button works
- Refreshed page state doesn't interfere
- No stale references or errors

**Actual Results:**
```
[Tester fills in]
- Success screen displays: [ ] Yes [ ] No
- Countdown hidden (no window.opener): [ ] Yes [ ] No
- Manual close works: [ ] Yes [ ] No
- Refreshed page state OK: [ ] Yes [ ] No
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Edge Case 10: Email Verification Across Different Devices/Browsers

**Scenario:** User starts signup on mobile, clicks verification link on desktop (different browser/device context)

**Setup Steps:**
1. Start signup on iPhone Safari → Enter email → Send link
2. Send verification link to email
3. Open email on macOS Chrome (different device, different browser)
4. Click verification link
5. Observe:
   - Success screen displays
   - `window.opener` is null (different browser instance)
   - Countdown hidden
   - No errors

**Expected Behavior:**
- Success screen displays regardless of device/browser
- `window.opener` check fails (expected, since different browser)
- Manual close works
- Original Safari modal on iPhone remains in pending state (because event won't fire across browsers/devices)
- User can complete signup manually if needed

**Why:** Cross-device doesn't trigger modal resumption (localStorage event won't fire). This is OK — user can manually continue or check original device.

**Actual Results:**
```
[Tester fills in]
- Original device: [iPhone / Android / Desktop]
- Click device: [Desktop / Tablet / Phone]
- Success screen displays: [ ] Yes [ ] No
- Countdown hidden: [ ] Yes [ ] No
- Original modal did NOT auto-resume (expected): [ ] Yes [ ] No (expected: yes)
- User can manually complete signup: [ ] Yes [ ] No
- Console errors: [Describe any]
```

**Pass/Fail:** [ ] Pass [ ] Fail

---

## Troubleshooting Guide

### Issue: Countdown Timer Always Showing (Even No window.opener)

**Possible Causes:**
1. `window.opener` check is failing (check line in email-verified.html: `if (window.opener)`)
2. Browser security policy preventing window.opener access

**Debugging Steps:**
```javascript
// In email-verified.html DevTools Console:
console.log('window.opener:', window.opener);
console.log('Type:', typeof window.opener);
console.log('Has postMessage?', window.opener && typeof window.opener.postMessage);
```

**Expected:**
- `window.opener: null` or `undefined` when not opened by parent
- `window.opener: [object Window]` when opened by parent via `.open()`

**Fix:**
- Verify line 128 in email-verified.html: `if (window.opener) {`
- Check console for CORS or security warnings

---

### Issue: Modal Not Resuming After Email Verification

**Possible Causes:**
1. `servi-email-verified` event listener not attached to modal
2. `window.opener.dispatchEvent()` failing silently
3. localStorage not accessible (private mode)
4. Modal already closed before event fires

**Debugging Steps:**
```javascript
// In Modal (index.html) DevTools Console:
console.log('Auth modal exists:', !!document.getElementById('auth-modal-global'));
console.log('Event listener attached:', true); // check HTML for addEventListener

// In email-verified.html:
console.log('About to dispatch event to opener:', window.opener);
if (window.opener) {
  console.log('Dispatching servi-email-verified event');
  window.opener.dispatchEvent(new Event('servi-email-verified'));
}
```

**Expected:**
- Event dispatches without error
- Original modal console shows: `[SERVI] Email verified event received`

**Fix:**
- Ensure index.html includes event listener (search for `servi-email-verified`)
- Check for CSP violations blocking event dispatch
- Verify both windows are same origin

---

### Issue: Success Screen Shows Wrong Language

**Possible Causes:**
1. `localStorage.getItem('servi_lang')` returns undefined
2. Language was changed after link was sent but before clicked
3. localStorage not persisted across tabs

**Debugging Steps:**
```javascript
// In email-verified.html DevTools Console:
console.log('Stored language:', localStorage.getItem('servi_lang'));
console.log('Current lang() result:', lang()); // calls lang() helper function
console.log('isEs() result:', isEs()); // check ES/EN logic
```

**Expected:**
- `localStorage.getItem('servi_lang')` = `'es'` or `'en'` (whatever was set when link was clicked)
- `isEs()` returns boolean matching stored language

**Fix:**
- Ensure language toggle sets `localStorage.setItem('servi_lang', 'es')` or `'en'`
- Don't change language after sending verification link (or accept current language)

---

### Issue: "Closing in X seconds" Countdown Doesn't Decrement

**Possible Causes:**
1. `setInterval` cleared prematurely
2. `window.opener` exists but page didn't load correctly
3. Timer references wrong DOM element ID

**Debugging Steps:**
```javascript
// In email-verified.html DevTools Console (while countdown is visible):
console.log('Interval running:', true);
console.log('Countdown element:', document.getElementById('countdown-num'));
console.log('window.opener:', window.opener);
```

**Expected:**
- Countdown element exists and updates every 1000ms
- Numbers decrement: 3 → 2 → 1 → 0

**Fix:**
- Check `setInterval` is called (line ~129 in email-verified.html)
- Verify countdown element IDs: `countdown-num` (ES) or `countdown-num-en` (EN)
- Clear browser cache if timeout looks stale

---

### Issue: Rapid Clicks Cause Duplicate Events

**Possible Causes:**
1. Event listener not debounced
2. Multiple verification requests fired
3. Modal resumption logic runs twice

**Debugging Steps:**
```javascript
// In shared-auth.js or index.html, add counter:
let emailVerifiedCount = 0;
document.addEventListener('servi-email-verified', function() {
  emailVerifiedCount++;
  console.log('Email verified event #' + emailVerifiedCount);
  if (emailVerifiedCount > 1) console.warn('Multiple verifications detected!');
});
```

**Expected:**
- Event fires once per verification
- Counter should stay at 1

**Fix:**
- Add event listener once (not repeatedly)
- Consider debounce if user double-clicks link
- Check for listeners added multiple times via DevTools: `getEventListeners(document)` in Chrome

---

### Issue: localStorage Quota Exceeded in Private Mode

**Possible Causes:**
1. Code doesn't have try-catch around `localStorage.setItem()`
2. Other sites filled up localStorage
3. Browser privacy settings restrict localStorage

**Debugging Steps:**
```javascript
// Test localStorage availability:
try {
  localStorage.setItem('test-key', 'test-value');
  console.log('localStorage works');
  localStorage.removeItem('test-key');
} catch (e) {
  console.error('localStorage error:', e.message);
}
```

**Expected:**
- No "QuotaExceededError" thrown
- If private mode, storage may fail silently but shouldn't break flow

**Fix:**
- Wrap all `localStorage.setItem()` in try-catch
- Verify Firebase email-verified.html code has error handling
- Clear localStorage on test devices if quota full

---

### Issue: window.opener Is Blocked (Security Policy)

**Possible Causes:**
1. Different origins (HTTPS vs HTTP, different domains)
2. Strict CORS policy on parent window
3. Browser extension blocking cross-window communication

**Debugging Steps:**
```javascript
// In email-verified.html:
if (window.opener) {
  try {
    window.opener.location.href; // check access
    console.log('window.opener accessible');
  } catch (e) {
    console.error('window.opener blocked:', e.message);
  }
}
```

**Expected:**
- No error accessing `window.opener`
- Both pages same origin (`servi-preauth.pages.dev`)

**Fix:**
- Verify both signup modal and email link page are same origin
- Check browser console for CORS or "cross-origin" warnings
- Disable privacy extensions (uBlock, etc.) if testing

---

## Testing Checklist Summary

**Before Testing:**
- [ ] All files deployed (email-verified.html, shared-auth.js, index.html)
- [ ] Firebase project configured with email link auth
- [ ] localStorage accessible in browser
- [ ] Backend API responding (`/api/auth/check-identifier`, etc.)

**Core Test Cases (Must Pass):**
- [ ] Edge Case 1: Modal closed before email link click
- [ ] Edge Case 2: Email link opened in same window
- [ ] Edge Case 3: Multiple email verifications
- [ ] Edge Case 4: Language switching
- [ ] Edge Case 5: Private browsing mode

**Additional Test Cases (Should Pass):**
- [ ] Edge Case 6: Rapid successive clicks
- [ ] Edge Case 7: Network latency
- [ ] Edge Case 8: Browser back button
- [ ] Edge Case 9: Modal refresh before verification
- [ ] Edge Case 10: Cross-device verification

**Sign-Off:**
- Tester Name: ___________________
- Test Date: ___________________
- Environment: [Production / Staging / Local]
- Overall Result: [ ] All Pass [ ] Some Fail [ ] Major Issues
- Critical Blockers: [List any]
- Notes: [Additional observations]

---

## Appendix: Quick Reference — localStorage Keys

| Key | Purpose | Set By | Value Example |
|-----|---------|--------|----------------|
| `servi_lang` | Current language | Language toggle | `'es'` or `'en'` |
| `servi_email_link_target` | Email being verified | shared-auth.js | `'user@example.com'` |
| `servi_email_verified_at` | Timestamp of verification | email-verified.html | `'1744502400000'` |
| `servi_email_verification_mode` | Indicates email verification in progress | shared-auth.js | `'true'` or unset |
| `servi_session` | User session token | shared-auth.js | JSON with `token`, `user`, etc. |

---

## Appendix: Event Flow Diagram

```
Modal Open (index.html)
    ↓
User enters email identifier
    ↓
Firebase sends magic link to email
    ↓
Modal displays "Link sent, check email"
    ↓
[Modal listens for 'servi-email-verified' event]
    ↓
User opens email verification link (new tab)
    ↓
email-verified.html loads
    ↓
Firebase verifies email signature
    ↓
Set localStorage['servi_email_verified_at']
    ↓
window.opener.dispatchEvent(new Event('servi-email-verified'))
    ↓
[If window.opener exists: countdown starts, auto-closes in 3s]
[If no window.opener: countdown hidden, manual close only]
    ↓
Original modal receives 'servi-email-verified' event
    ↓
Modal updates UI: "Email verified ✓"
    ↓
Modal continues to next step (name, phone, etc.)
```

---

## Appendix: Code References

**Key implementation files:**

1. **frontend/email-verified.html** (Lines 126-145)
   - Countdown timer logic
   - window.opener check
   - Auto-close after 3s

2. **frontend/shared/shared-auth.js** (Lines 876-898)
   - broadcastEmailVerified() function
   - localStorage.setItem('servi_email_verified_at')
   - Event dispatch to window.opener

3. **frontend/index.html** (Around line 150-200, approximate)
   - Modal event listener for 'servi-email-verified'
   - Modal resumption logic

4. **backend/index.mjs** (Existing endpoints)
   - `/api/auth/check-identifier` — Verify email exists
   - `/api/auth/firebase` — Sync Firebase user with backend

---

**End of Edge Case Testing Documentation**

For questions or issues during testing, contact: serv.clientserv@gmail.com
