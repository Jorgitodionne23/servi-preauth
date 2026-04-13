# Quick Test Guide — Email Verification Fix

## 5-Minute Sanity Check

Run this first to confirm the fix is working before full testing.

### Setup
- Have two windows/tabs open in Chrome/Firefox
- Have test email account ready (Gmail works best)
- Deploy changes to production (or test locally)

### Test: Email-First Signup Auto-Continuation

**Window A (Original Page):**
```
1. Go to https://servi-preauth.pages.dev
2. Click "Solicitar servicio" button
3. Click "Crear cuenta" / "Log in" button in modal
4. Enter email: test+date@example.com (e.g., test+020426@example.com)
5. Click "Continuar" button
6. ✓ Modal should show "¡Enlace enviado!" message
7. ✓ Modal should show message about clicking the email link
8. KEEP THIS WINDOW IN FOCUS (we'll monitor it)
```

**Window B (Email Client):**
```
9. Open your email (Gmail, Outlook, etc.)
10. Find the email with subject containing "SERVI" or "sign in link"
11. Click the blue link in the email
12. ✓ Should open email-verified.html in new tab/window
13. ✓ Should show "Correo verificado" ✓ checkmark
14. ✓ Should show countdown "Cerrando en X segundos..."
15. Wait 3 seconds for auto-close OR click close button
16. ✓ Email verification window should close
```

**Window A (Back to Original - THIS IS THE TEST):**
```
17. ✓ CRITICAL: Modal should now show "Nombre" input field
18. ✓ Should NOT show "¡Enlace enviado!" anymore
19. ✓ Should NOT show any error messages
20. ✓ Should show progress indicator (3/4 steps filled)
21. If you see the "Nombre" field: THE FIX WORKS ✓
22. If still showing "¡Enlace enviado!": Something is broken ✗
```

### Expected Behavior ✓

- Email link opens `/email-verified.html` (not homepage)
- Success page shows clearly
- Original modal detects email verification completion
- Modal auto-continues to name collection
- User sees seamless flow without manual interaction

### Common Issues

**Issue: Email link opens homepage instead of email-verified.html**
- Check: Did you deploy the changes?
- Check: Clear browser cache (Ctrl+Shift+Delete)
- Fix: Re-deploy frontend to Cloudflare Pages

**Issue: Email verification page shows but modal doesn't continue**
- Check: Open browser DevTools → Console tab
- Look for errors like `__monitorEmailVerification is not defined`
- Check: Is shared-auth.js properly included in all pages?
- Fix: Verify shared-auth.js loaded (look for "[SERVI]" log messages)

**Issue: "¡Enlace enviado!" screen never shows**
- Check: Did you hit the email verification limit in Firebase?
- Firebase free tier has rate limits on email sending
- Fix: Try again after 1 hour or use different email addresses

**Issue: Name input field appears but is broken**
- Check: Is JavaScript working? (Try typing in field)
- Check: Are fonts loading? (Syne and DM Sans via Google Fonts)
- Fix: Clear cache and hard-refresh (Ctrl+F5)

## What NOT to See

❌ Blank page after clicking email link
❌ Browser error page
❌ Redirect loops  
❌ Modal stuck on "¡Enlace enviado!" after 30+ seconds
❌ Any browser console errors (red text in DevTools)
❌ The page redirecting you back to homepage

## Success Indicators

✅ Email link works (opens email-verified.html)
✅ Success message clear and bilingual (ES/EN)
✅ Modal continues automatically (Nombre field appears)
✅ Flow is seamless (no manual steps)
✅ Browser console clean (no errors)
✅ Works on both Chrome and Firefox

## If Test Passes

Great! The fix is working. Now proceed to full testing:
- See EMAIL_VERIFICATION_FIX.md for complete test cases
- Test phone-first with secondary email
- Test cross-browser behavior
- Test on mobile devices

## If Test Fails

1. **Check browser console** (F12 → Console tab)
   - Look for red error messages
   - Copy-paste any errors to share

2. **Check network requests** (F12 → Network tab)
   - Filter for `sendOobCode`
   - Should see 200 status (not 400)
   - Look for CORS errors

3. **Check localStorage** (F12 → Application tab → Local Storage)
   - Look for `servi_email_link_target`
   - Look for `servi_email_verified_at` after verification

4. **Report**
   - Take screenshot of browser console
   - Note which step failed
   - Share in GitHub issue or conversation

## Debug Mode

To see what's happening:

```javascript
// In browser console while on modal page:
localStorage.getItem('servi_email_verified_at')
// If null: email-verified.html never broadcast
// If timestamp: broadcast worked, monitoring should detect it

window.__user
// If {email: "test+...@gmail.com"}: auth succeeded
// If null or {}: auth didn't complete yet

// To see monitoring status:
document.getElementById('auth-modal-global').innerHTML
// Should show "Nombre" field if successful
```

## Expected Timeframe

- Email sending: 1-5 seconds
- Email delivery: 5-30 seconds
- Email verification page: <1 second
- Modal auto-continuation: <2 seconds (after user closes email tab)

Total: Less than 1 minute from clicking "Enviar enlace" to seeing name input field.
