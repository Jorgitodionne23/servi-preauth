# Auth Staging Smoke Test

Use this checklist after the local Firebase Auth Emulator suite passes. These checks cover behavior that the emulator cannot prove reliably: live OAuth popups, real delivery, deployed runtime config, CORS, and production rate limits.

## Environment

- Use a staging Firebase project unless production verification is explicitly intended.
- Use Stripe test mode and a staging database.
- Confirm the deployed frontend points at the intended backend API base.
- Confirm the backend has the matching `FIREBASE_PROJECT_ID`, service account, `JWT_SECRET`, CORS origins, and database URL.
- Confirm rate limits are enabled. Do not set `DISABLE_RATE_LIMITS=1`.

## Phone Auth

- In Firebase Console, configure test phone numbers for staging, for example `+525512025121` with code `232323`.
- Sign up phone-first with the configured test number.
- Confirm the OTP succeeds without sending a real SMS.
- Add email, open the delivered link, and confirm `/api/auth/me` returns `phone_verified: true` and `email_verified: true`.
- Sign up phone-first again and skip email. Submit a service request through the browser UI and confirm the network response is `409` with `email_required`.

## Email Links

- Use a real test inbox or provider-specific test mailbox.
- Sign up email-first, open the magic link in the same browser profile, enter name, add phone, and verify OTP.
- Confirm `/api/auth/me` returns both verification flags as `true`.
- Repeat email-first while skipping phone. Submit a service request with an authenticated session and confirm `phone_required`.
- Open an email link in a second tab while the original tab remains open. Confirm the original tab receives the verified session and does not create a duplicate account.
- Open an expired or already-used link and confirm the UI asks for a fresh link.

## Google Auth

- Click the real frontend Google button.
- Complete the live Google OAuth popup.
- Confirm `/api/auth/me` returns `email_verified: true`.
- Confirm phone is missing or unverified for a new Google-only account.
- Submit a service request through the browser UI and confirm `409` with `phone_required`.

## Account Management

- Change account email, confirm the backend sets `email_verified: false`, then verify the new email link and confirm it returns to `true`.
- Change account phone. Confirm the reauth modal appears and requires the currently registered Firebase phone.
- After the DB phone changes, confirm `/api/auth/me` returns the new phone with `phone_verified: false` until the new phone is verified.
- Try changing to another user's phone and confirm `409 phone_exists`.
- In a second browser profile or device, refresh the same account after email or phone changes and confirm stale Firebase identity data does not re-mark the changed identifier as verified.

## Recovery

- Create a phone-first account with a verified email.
- Start "Can't access phone?" from the phone login path.
- Enter the linked email, open the email link, and confirm the session lands on `account.html?section=security`.
- Update the phone from account settings and confirm the verification gate remains closed until the new phone is verified.

## Rate Limit Smoke

- Repeatedly request OTP or email links for the same identifier until the staging limit is reached.
- Confirm the API returns `429 too_many_attempts`.
- Confirm normal successful auth still works for a different identifier.
