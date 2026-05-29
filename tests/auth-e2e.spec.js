// To run this suite locally:
//   1. Terminal A: `npm run emulators:auth`           (Firebase Auth Emulator on :9099)
//   2. Terminal B: `npm run start:auth-emulator`      (backend on :4242 wired to emulator)
//   3. Terminal C: `npm run test:e2e`                  (Playwright)
// Env overrides: AUTH_E2E_BASE_URL, FIREBASE_PROJECT_ID, AUTH_EMULATOR_BASE.

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.AUTH_E2E_BASE_URL || 'http://localhost:4242';
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'servi-bec91';
const AUTH_EMULATOR = process.env.AUTH_EMULATOR_BASE || 'http://127.0.0.1:9099';
const RUN_SEED = `${Date.now()}${process.pid}${process.env.TEST_WORKER_INDEX || '0'}`.replace(/\D/g, '');
const RUN_ID = RUN_SEED.slice(-8);
const PHONE_SUFFIX = RUN_SEED.slice(-6);

const phones = {
  phoneFull: `5512${PHONE_SUFFIX}`,
  phoneSkippedEmail: `5522${PHONE_SUFFIX}`,
  emailFullSecondary: `5532${PHONE_SUFFIX}`,
  emailPhoneRequired: `5533${PHONE_SUFFIX}`,
  conflictOwner: `5542${PHONE_SUFFIX}`,
  accountUser: `5552${PHONE_SUFFIX}`,
  accountNewPhone: `5562${PHONE_SUFFIX}`,
  uiPhoneGate: `5582${PHONE_SUFFIX}`,
  uiPhoneGateNew: `5592${PHONE_SUFFIX}`,
  reauthVictim: `5602${PHONE_SUFFIX}`,
  reauthAttacker: `5603${PHONE_SUFFIX}`,
  reauthBlockedPhone: `5604${PHONE_SUFFIX}`,
  recoveryUser: `5572${PHONE_SUFFIX}`,
  logoutUser: `5612${PHONE_SUFFIX}`,
  deleteUser: `5622${PHONE_SUFFIX}`,
  addressUser: `5632${PHONE_SUFFIX}`,
};

function e164(localPhone) {
  return `+52${localPhone}`;
}

function email(label) {
  return `servi-${label}-${RUN_ID}@example.test`;
}

async function emulatorJson(path, options) {
  const res = await fetch(`${AUTH_EMULATOR}${path}`, options);
  if (!res.ok) throw new Error(`Emulator ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function latestSmsCode(phoneNumber) {
  const data = await emulatorJson(`/emulator/v1/projects/${PROJECT_ID}/verificationCodes`);
  const matches = (data.verificationCodes || []).filter((entry) => entry.phoneNumber === phoneNumber);
  if (!matches.length) throw new Error(`No SMS code found for ${phoneNumber}: ${JSON.stringify(data)}`);
  return matches[matches.length - 1].code;
}

async function latestEmailLink(targetEmail) {
  const data = await emulatorJson(`/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const matches = (data.oobCodes || []).filter((entry) =>
    entry.email === targetEmail || entry.newEmail === targetEmail
  );
  if (!matches.length) throw new Error(`No email link found for ${targetEmail}: ${JSON.stringify(data)}`);
  const last = matches[matches.length - 1];
  return last.oobLink || last.link || last.url;
}

async function clearBrowser(page) {
  await page.goto(BASE_URL);
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    if (indexedDB.databases) {
      const databases = await indexedDB.databases();
      await Promise.all(databases.map((db) => db.name && new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(db.name);
        req.onsuccess = req.onerror = req.onblocked = resolve;
      })));
    }
  });
}

async function openAuth(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => typeof window.openAuthModal === 'function');
  await page.evaluate(() => window.openAuthModal('login'));
  await page.waitForSelector('#auth-identifier');
}

async function enterIdentifier(page, identifier) {
  await page.fill('#auth-identifier', identifier);
  await page.click('#usl-continue-btn');
}

async function sendAndVerifyPhoneOtp(page, phoneNumber) {
  await page.waitForSelector('#send-otp-btn');
  await page.click('#send-otp-btn');
  await page.waitForSelector('#auth-otp', { state: 'visible' });
  const code = await latestSmsCode(phoneNumber);
  await page.fill('#auth-otp', code);
  await page.click('#verify-otp-btn');
}

async function sendAndOpenEmailLink(page, targetEmail, { newTab = false } = {}) {
  await page.waitForSelector('#send-email-link-btn');
  await page.click('#send-email-link-btn');
  let link = null;
  await expect.poll(async () => {
    link = await latestEmailLink(targetEmail).catch(() => null);
    return link;
  }, { timeout: 10_000 }).not.toBeNull();
  if (newTab) {
    const verifier = await page.context().newPage();
    await verifier.goto(link);
    await verifier.waitForLoadState('networkidle');
    await verifier.close();
    await page.bringToFront();
    return;
  }
  await page.goto(link);
  await page.waitForLoadState('networkidle');
}

async function openLatestEmailLink(page, targetEmail, { newTab = false } = {}) {
  let link = null;
  await expect.poll(async () => {
    link = await latestEmailLink(targetEmail).catch(() => null);
    return link;
  }, { timeout: 10_000 }).not.toBeNull();
  if (newTab) {
    const verifier = await page.context().newPage();
    await verifier.goto(link);
    await verifier.waitForLoadState('networkidle');
    await verifier.close();
    await page.bringToFront();
    return;
  }
  await page.goto(link);
  await page.waitForLoadState('networkidle');
}

async function fillName(page, first = 'Test', last = 'User') {
  await page.waitForSelector('#signup-first-name');
  await page.fill('#signup-first-name', first);
  await page.fill('#signup-last-name', last);
  await page.check('#terms-check');
  await page.click('#name-next-btn');
}

async function waitForSession(page) {
  await page.waitForFunction(() => {
    try {
      const session = JSON.parse(localStorage.getItem('servi_user_session') || 'null');
      return !!session?.token;
    } catch (_) {
      return false;
    }
  }, null, { timeout: 15_000 });
  return page.evaluate(() => JSON.parse(localStorage.getItem('servi_user_session')));
}

async function authMe(page) {
  const session = await waitForSession(page);
  return page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token: session.token });
}

async function pollUser(page, predicate) {
  let latest = null;
  await expect.poll(async () => {
    latest = await authMe(page);
    return latest.status === 200 && predicate(latest.body.user);
  }, { timeout: 15_000 }).toBe(true);
  return latest.body.user;
}

async function serviceRequest(page) {
  const session = await waitForSession(page);
  return page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/service-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        category: 'custom',
        description: 'Auth E2E test request',
        serviceAddress: 'Calle Test 123',
        clientName: 'Test User',
        clientPhone: '+525500000000',
        clientEmail: 'auth-e2e@example.test',
        lang: 'en',
      }),
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token: session.token });
}

async function submitLegacyBookingFromUi(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => typeof window.openBooking === 'function' && window.__user);
  await page.evaluate(async () => {
    window.__legacyBooking = true;
    await window.openBooking('custom');
    window.bookingState.description = 'Auth E2E legacy booking request';
    window.bookingState.whenType = 'asap';
    window.bookingState.step = 3;
    window.renderBooking();
  });
  await page.fill('#booking-address', 'Calle UI Legacy 123');

  const responsePromise = page.waitForResponse((res) =>
    res.url().includes('/api/service-requests') && res.request().method() === 'POST'
  );
  const dialogPromise = page.waitForEvent('dialog').then(async (dialog) => {
    const message = dialog.message();
    await dialog.accept();
    return message;
  });

  await page.click('#booking-submit-btn');
  const [response, dialogMessage] = await Promise.all([responsePromise, dialogPromise]);
  return {
    status: response.status(),
    body: await response.json(),
    requestHeaders: response.request().headers(),
    dialogMessage,
  };
}

async function submitConversationBookingFromUi(page) {
  await page.goto(BASE_URL);
  await page.waitForFunction(() => typeof window.openConversation === 'function' && window.__user);
  await page.evaluate(() => {
    window.__legacyBooking = false;
    window.openConversation('Auth E2E conversational booking request');
  });
  await page.click('#bk-convo-send');
  await page.locator('#bk-convo-stream .hero-chip').first().click();
  await page.fill('#bk-convo-addr', 'Calle UI Conversation 456');
  await page.click('#bk-convo-addr-send');
  await page.waitForSelector('#bk-convo-confirm');

  const responsePromise = page.waitForResponse((res) =>
    res.url().includes('/api/service-requests') && res.request().method() === 'POST'
  );
  await page.click('#bk-convo-confirm');
  const response = await responsePromise;
  const body = await response.json();
  await page.waitForFunction(() => {
    const bubbles = Array.from(document.querySelectorAll('#bk-convo-stream .bk-convo__bubble--bot'));
    return bubbles.some((bubble) => /verifica|verify/i.test(bubble.textContent || ''));
  });
  const botMessages = await page.locator('#bk-convo-stream .bk-convo__bubble--bot').allTextContents();
  return {
    status: response.status(),
    body,
    requestHeaders: response.request().headers(),
    botMessage: botMessages[botMessages.length - 1] || '',
  };
}

async function changeAccountPhoneWithReauth(page, newPhone, currentFirebasePhone) {
  await page.goto(`${BASE_URL}/account.html?section=info`);
  await page.waitForSelector('#info-phone');
  await page.fill('#info-phone', newPhone);
  await page.click('#info-save-btn');
  await page.waitForSelector('#reauth-step');
  await page.click('#reauth-send-btn');
  await page.waitForSelector('#reauth-otp-input', { state: 'visible' });
  const reauthCode = await latestSmsCode(currentFirebasePhone);
  await page.fill('#reauth-otp-input', reauthCode);
  await page.click('#reauth-confirm-btn');
  return pollUser(page, (u) => u.phone === newPhone);
}

async function syncFirebaseSession(page) {
  return page.evaluate(async ({ baseUrl }) => {
    const firebaseUser = window.firebase?.auth()?.currentUser;
    if (!firebaseUser) throw new Error('No Firebase user in browser session');
    const idToken = await firebaseUser.getIdToken(true);
    const res = await fetch(`${baseUrl}/api/auth/firebase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ first_identifier_type: 'phone' }),
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL });
}

async function firebaseUserSnapshot(page) {
  return page.evaluate(async () => {
    const firebaseUser = window.firebase?.auth()?.currentUser;
    if (!firebaseUser) return null;
    await firebaseUser.reload();
    const refreshed = window.firebase.auth().currentUser || firebaseUser;
    return {
      uid: refreshed.uid,
      email: refreshed.email || null,
      phoneNumber: refreshed.phoneNumber || null,
    };
  });
}

async function attemptIncompleteGoogleBackendSync(extraBody = {}) {
  const targetEmail = email('google');
  const idp = await emulatorJson(`/identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      postBody: `id_token=${JSON.stringify({
        sub: `google-${RUN_ID}`,
        email: targetEmail,
        email_verified: true,
        name: 'Google E2E',
      })}&providerId=google.com`,
      requestUri: BASE_URL,
      returnIdpCredential: true,
      returnSecureToken: true,
    }),
  });
  const sync = await fetch(`${BASE_URL}/api/auth/firebase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idp.idToken}`,
    },
    body: JSON.stringify({
      name: 'Google E2E',
      email: targetEmail,
      email_verified: true,
      first_identifier_type: 'email',
      ...extraBody,
    }),
  });
  return { status: sync.status, body: await sync.json(), firebaseUid: idp.localId };
}

async function phoneFirstSignup(page, { phone, secondaryEmail, skipEmail = false, first = 'Phone', last = 'User' }) {
  await clearBrowser(page);
  await openAuth(page);
  await enterIdentifier(page, phone);
  await sendAndVerifyPhoneOtp(page, e164(phone));
  await fillName(page, first, last);
  if (skipEmail) {
    await page.waitForSelector('button[onclick="window.__uslSkipSecondary()"]');
    const storedBeforeSkip = await page.evaluate(() => localStorage.getItem('servi_user_session'));
    expect(storedBeforeSkip).toBeNull();
    await page.click('button[onclick="window.__uslSkipSecondary()"]');
    await waitForSession(page);
    return;
  }
  await page.waitForSelector('#secondary-email');
  await page.fill('#secondary-email', secondaryEmail);
  await page.click('button[onclick="window.__uslSecondaryNext()"]');
  await sendAndOpenEmailLink(page, secondaryEmail);
  await waitForSession(page);
}

async function emailFirstSignup(page, { primaryEmail, secondaryPhone, first = 'Email', last = 'User' }) {
  await clearBrowser(page);
  await openAuth(page);
  await enterIdentifier(page, primaryEmail);
  await sendAndOpenEmailLink(page, primaryEmail, { newTab: true });
  await fillName(page, first, last);
  await page.waitForSelector('#secondary-phone');
  await page.fill('#secondary-phone', secondaryPhone);
  await page.click('button[onclick="window.__uslSecondaryNext()"]');
  await sendAndVerifyPhoneOtp(page, e164(secondaryPhone));
  await waitForSession(page);
}

test.describe.configure({ mode: 'serial', retries: 0, timeout: 60_000 });

test('phone-first signup, full verification', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.phoneFull,
    secondaryEmail: email('phone-full'),
    first: 'PhoneFull',
  });
  const me = await authMe(page);
  expect(me.status).toBe(200);
  expect(me.body.user.phone).toBe(e164(phones.phoneFull));
  expect(me.body.user.phone_verified).toBe(true);
  expect(me.body.user.email_verified).toBe(true);
});

test('phone-first signup, skipped email, ordering gate returns email_required', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.phoneSkippedEmail,
    skipEmail: true,
    first: 'PhoneNoEmail',
  });
  const me = await authMe(page);
  expect(me.status).toBe(200);
  expect(me.body.user.phone_verified).toBe(true);
  expect(me.body.user.email_verified).toBe(false);
  expect(me.body.user.email_skipped_at).toBeTruthy();
  const request = await serviceRequest(page);
  expect(request.status).toBe(409);
  expect(request.body.error).toBe('email_required');

  const uiRequest = await submitLegacyBookingFromUi(page);
  expect(uiRequest.status).toBe(409);
  expect(uiRequest.body.error).toBe('email_required');
  expect(uiRequest.requestHeaders.authorization).toMatch(/^Bearer /);
  expect(uiRequest.dialogMessage).toMatch(/correo|email/i);

  await page.goto(`${BASE_URL}/account.html`);
  await expect(page.locator('#email-verify-warning')).toBeVisible();
  await expect(page.locator('#email-warning-action')).toContainText(/agregar|add/i);

  const skippedEmail = email('phone-skipped-added');
  const skippedFirebaseBefore = await firebaseUserSnapshot(page);
  await page.fill('#info-email', skippedEmail);
  await page.click('#info-save-btn');
  await page.waitForSelector('#reauth-step');
  await page.click('#reauth-send-btn');
  await page.waitForSelector('#reauth-otp-input', { state: 'visible' });
  const reauthCode = await latestSmsCode(e164(phones.phoneSkippedEmail));
  await page.fill('#reauth-otp-input', reauthCode);
  await page.click('#reauth-confirm-btn');
  await expect.poll(async () => (await authMe(page)).body.user.email_verified, { timeout: 10_000 }).toBe(false);
  const staleSkippedSync = await syncFirebaseSession(page);
  expect(staleSkippedSync.status).toBe(200);
  expect(staleSkippedSync.body.user.email_verified).toBe(false);
  await openLatestEmailLink(page, skippedEmail);
  await page.goto(`${BASE_URL}/account.html`);
  await expect.poll(async () => {
    const me = await authMe(page);
    return me.body.user.email === skippedEmail && me.body.user.email_verified === true;
  }, { timeout: 15_000 }).toBe(true);
  const skippedFirebaseAfter = await firebaseUserSnapshot(page);
  expect(skippedFirebaseAfter.uid).toBe(skippedFirebaseBefore.uid);
  expect(skippedFirebaseAfter.email).toBe(skippedEmail);
  await expect(page.locator('#email-verify-warning')).toBeHidden();

  const verifiedRequest = await serviceRequest(page);
  expect(verifiedRequest.status).toBe(201);
});

test('email-first signup, full verification', async ({ page }) => {
  await emailFirstSignup(page, {
    primaryEmail: email('email-full'),
    secondaryPhone: phones.emailFullSecondary,
    first: 'EmailFull',
  });
  const user = await pollUser(page, (u) =>
    u.phone === e164(phones.emailFullSecondary) &&
    u.phone_verified === true &&
    u.email_verified === true
  );
  expect(user.phone).toBe(e164(phones.emailFullSecondary));
});

test('email-first signup requires verified phone before creating session', async ({ page }) => {
  await clearBrowser(page);
  await openAuth(page);
  const primaryEmail = email('email-phone-required');
  await enterIdentifier(page, primaryEmail);
  await sendAndOpenEmailLink(page, primaryEmail, { newTab: true });
  await fillName(page, 'EmailPhone', 'Required');
  await page.waitForSelector('#secondary-phone');
  await expect(page.locator('button[onclick="window.__uslSkipSecondary()"]')).toHaveCount(0);
  const storedBeforePhone = await page.evaluate(() => localStorage.getItem('servi_user_session'));
  expect(storedBeforePhone).toBeNull();

  const requiredPhone = phones.emailPhoneRequired;
  await page.fill('#secondary-phone', requiredPhone);
  await page.click('button[onclick="window.__uslSecondaryNext()"]');
  await sendAndVerifyPhoneOtp(page, e164(requiredPhone));
  const me = await authMe(page);
  expect(me.status).toBe(200);
  expect(me.body.user.email_verified).toBe(true);
  expect(me.body.user.phone_verified).toBe(true);
});

test('Google signup via emulator IDP cannot create an email-only or body-asserted phone user', async () => {
  // Firebase Auth Emulator exposes deterministic IDP REST endpoints. The real
  // Google popup remains a staging smoke test because it depends on browser
  // popup handling and live Google OAuth configuration.
  const sync = await attemptIncompleteGoogleBackendSync();
  expect(sync.status).toBe(409);
  expect(sync.body.error).toBe('signup_incomplete');

  const spoofedPhoneSync = await attemptIncompleteGoogleBackendSync({
    signup_complete: true,
    terms_accepted: true,
    phone: e164(phones.emailPhoneRequired),
    phone_verified: true,
  });
  expect(spoofedPhoneSync.status).toBe(409);
  expect(spoofedPhoneSync.body.error).toBe('signup_incomplete');
});

test('account page email change, verification, phone reauth, and phone_exists conflict', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.conflictOwner,
    secondaryEmail: email('conflict-owner'),
    first: 'Conflict',
  });

  await phoneFirstSignup(page, {
    phone: phones.accountUser,
    secondaryEmail: email('account-original'),
    first: 'Account',
  });

  await page.goto(`${BASE_URL}/account.html?section=info`);
  await page.waitForSelector('#info-email');
  const accountFirebaseBefore = await firebaseUserSnapshot(page);
  const changedEmail = email('account-changed');
  await page.fill('#info-email', changedEmail);
  await page.click('#info-save-btn');
  await page.waitForSelector('#reauth-step');
  await page.click('#reauth-send-btn');
  await page.waitForSelector('#reauth-otp-input', { state: 'visible' });
  const emailChangeReauthCode = await latestSmsCode(e164(phones.accountUser));
  await page.fill('#reauth-otp-input', emailChangeReauthCode);
  await page.click('#reauth-confirm-btn');
  await expect.poll(async () => (await authMe(page)).body.user.email_verified, { timeout: 10_000 }).toBe(false);
  const staleAccountSync = await syncFirebaseSession(page);
  expect(staleAccountSync.status).toBe(200);
  expect(staleAccountSync.body.user.email_verified).toBe(false);

  await openLatestEmailLink(page, changedEmail);
  await page.goto(`${BASE_URL}/account.html?section=info`);
  await expect.poll(async () => {
    const me = await authMe(page);
    return me.body.user.email === changedEmail && me.body.user.email_verified === true;
  }, { timeout: 15_000 }).toBe(true);
  const accountFirebaseAfter = await firebaseUserSnapshot(page);
  expect(accountFirebaseAfter.uid).toBe(accountFirebaseBefore.uid);
  expect(accountFirebaseAfter.email).toBe(changedEmail);

  await page.fill('#info-phone', e164(phones.accountNewPhone));
  await page.click('#info-save-btn');
  await page.waitForSelector('#reauth-step');
  await page.click('#reauth-send-btn');
  await page.waitForSelector('#reauth-otp-input', { state: 'visible' });
  const reauthCode = await latestSmsCode(e164(phones.accountUser));
  await page.fill('#reauth-otp-input', reauthCode);
  await page.click('#reauth-confirm-btn');
  await expect.poll(async () => (await authMe(page)).body.user.phone, { timeout: 15_000 }).toBe(e164(phones.accountNewPhone));
  const afterPhoneChange = await authMe(page);
  expect(afterPhoneChange.body.user.phone_verified).toBe(false);

  await page.fill('#info-phone', e164(phones.conflictOwner));
  await page.click('#info-save-btn');
  await page.waitForSelector('#reauth-step');
  await page.click('#reauth-send-btn');
  await page.waitForSelector('#reauth-otp-input', { state: 'visible' });
  const conflictReauthCode = await latestSmsCode(e164(phones.accountUser));
  await page.fill('#reauth-otp-input', conflictReauthCode);
  await page.click('#reauth-confirm-btn');
  await expect(page.locator('#info-error')).toContainText(/teléfono|phone/i);
});

test('account phone change leaves new phone unverified and UI booking gate returns phone_required', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.uiPhoneGate,
    secondaryEmail: email('ui-phone-gate'),
    first: 'UiPhoneGate',
  });

  const changed = await changeAccountPhoneWithReauth(
    page,
    e164(phones.uiPhoneGateNew),
    e164(phones.uiPhoneGate)
  );
  expect(changed.phone_verified).toBe(false);

  const staleFirebaseSync = await syncFirebaseSession(page);
  expect(staleFirebaseSync.status).toBe(200);
  expect(staleFirebaseSync.body.user.phone).toBe(e164(phones.uiPhoneGateNew));
  expect(staleFirebaseSync.body.user.phone_verified).toBe(false);

  const uiRequest = await submitConversationBookingFromUi(page);
  expect(uiRequest.status).toBe(409);
  expect(uiRequest.body.error).toBe('phone_required');
  expect(uiRequest.requestHeaders.authorization).toMatch(/^Bearer /);
  expect(uiRequest.botMessage).toMatch(/teléfono|phone/i);
});

test('reauth token must belong to the same account as the SERVI session', async ({ page, browser }) => {
  await phoneFirstSignup(page, {
    phone: phones.reauthVictim,
    secondaryEmail: email('reauth-victim'),
    first: 'ReauthVictim',
  });
  const victimSession = await waitForSession(page);
  const victimBefore = await authMe(page);

  const attackerContext = await browser.newContext();
  const attackerPage = await attackerContext.newPage();
  await phoneFirstSignup(attackerPage, {
    phone: phones.reauthAttacker,
    secondaryEmail: email('reauth-attacker'),
    first: 'ReauthAttacker',
  });
  const attackerFirebaseToken = await attackerPage.evaluate(async () => {
    const firebaseUser = window.firebase?.auth()?.currentUser;
    if (!firebaseUser) throw new Error('No attacker Firebase user');
    return firebaseUser.getIdToken(true);
  });
  await attackerContext.close();

  const blocked = await page.evaluate(async ({ baseUrl, sessionToken, reauthToken, newPhone }) => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`,
        'X-Firebase-Reauth-Token': reauthToken,
      },
      body: JSON.stringify({ phone: newPhone }),
    });
    return { status: res.status, body: await res.json() };
  }, {
    baseUrl: BASE_URL,
    sessionToken: victimSession.token,
    reauthToken: attackerFirebaseToken,
    newPhone: e164(phones.reauthBlockedPhone),
  });

  expect(blocked.status).toBe(401);
  expect(blocked.body.error).toBe('reauth_user_mismatch');
  const victimAfter = await authMe(page);
  expect(victimAfter.body.user.phone).toBe(victimBefore.body.user.phone);
  expect(victimAfter.body.user.phone_verified).toBe(true);
});

test('recovery email link signs in and lands on account security', async ({ page }) => {
  const recoveryEmail = email('recovery');
  await phoneFirstSignup(page, {
    phone: phones.recoveryUser,
    secondaryEmail: recoveryEmail,
    first: 'Recovery',
  });

  await clearBrowser(page);
  await openAuth(page);
  await enterIdentifier(page, phones.recoveryUser);
  await page.waitForSelector('button[onclick="window.__uslStartRecovery()"]');
  await page.click('button[onclick="window.__uslStartRecovery()"]');
  await page.waitForSelector('#recovery-email');
  await page.fill('#recovery-email', recoveryEmail);
  await page.click('#recovery-send-btn');
  await openLatestEmailLink(page, recoveryEmail);
  await expect(page).toHaveURL(/account\.html\?section=security/);
});

test('logout revokes session JWT — same token returns 401 on /api/auth/me', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.logoutUser,
    secondaryEmail: email('logout'),
    first: 'Logout',
  });
  const session = await waitForSession(page);
  const token = session.token;

  // Sanity: token works pre-logout.
  const before = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    return res.status;
  }, { baseUrl: BASE_URL, token });
  expect(before).toBe(200);

  // Server-side revocation via /api/auth/logout.
  const logout = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token });
  expect(logout.status).toBe(200);
  expect(logout.body.ok).toBe(true);

  // Same token must now be rejected — proves revoked_sessions is consulted.
  const after = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    return res.status;
  }, { baseUrl: BASE_URL, token });
  expect(after).toBe(401);
});

test('account deletion revokes session and frees the phone for fresh re-signup', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.deleteUser,
    secondaryEmail: email('delete'),
    first: 'Delete',
  });
  const session = await waitForSession(page);
  const originalToken = session.token;
  const originalUserId = session.user.id;

  const del = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token: originalToken });
  expect(del.status).toBe(200);
  expect(del.body.ok).toBe(true);

  // Old token must be invalid (revoked + user row gone).
  const stale = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    return res.status;
  }, { baseUrl: BASE_URL, token: originalToken });
  expect(stale).toBe(401);

  // Re-signup with the SAME phone must succeed and produce a different user id —
  // proves the row was actually deleted, not just soft-marked.
  await phoneFirstSignup(page, {
    phone: phones.deleteUser,
    secondaryEmail: email('delete-redo'),
    first: 'DeleteRedo',
  });
  const newSession = await waitForSession(page);
  expect(newSession.user.id).not.toBe(originalUserId);
  expect(newSession.user.phone).toBe(e164(phones.deleteUser));
});

test('address CRUD — create, list, set default, delete; all scoped to authed user', async ({ page }) => {
  await phoneFirstSignup(page, {
    phone: phones.addressUser,
    secondaryEmail: email('address'),
    first: 'Address',
  });
  const session = await waitForSession(page);
  const token = session.token;

  // POST first address (default=true).
  const created = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: 'Casa', street: 'Calle Primera 1', city: 'CDMX', is_default: true }),
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token });
  expect(created.status).toBe(201);
  expect(created.body.address.is_default).toBe(true);
  const firstId = created.body.address.id;

  // POST second address (default=false).
  const second = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label: 'Oficina', street: 'Calle Segunda 2', city: 'CDMX' }),
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token });
  expect(second.status).toBe(201);
  const secondId = second.body.address.id;

  // List shows both, ordered with default first.
  const list = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token });
  expect(list.status).toBe(200);
  expect(list.body.addresses.length).toBe(2);
  expect(list.body.addresses[0].id).toBe(firstId);
  expect(list.body.addresses[0].is_default).toBe(true);

  // Flip default to second; first must lose default.
  const flip = await page.evaluate(async ({ baseUrl, token, id }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses/${id}/default`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    return { status: res.status, body: await res.json() };
  }, { baseUrl: BASE_URL, token, id: secondId });
  expect(flip.status).toBe(200);

  const afterFlip = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses`, { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  }, { baseUrl: BASE_URL, token });
  const defaultId = afterFlip.addresses.find((a) => a.is_default).id;
  expect(defaultId).toBe(secondId);
  expect(afterFlip.addresses.filter((a) => a.is_default).length).toBe(1);

  // DELETE first address; list shrinks to one.
  const del = await page.evaluate(async ({ baseUrl, token, id }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status;
  }, { baseUrl: BASE_URL, token, id: firstId });
  expect(del).toBe(200);

  const afterDel = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses`, { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  }, { baseUrl: BASE_URL, token });
  expect(afterDel.addresses.length).toBe(1);
  expect(afterDel.addresses[0].id).toBe(secondId);

  // 404 on deleting an address that doesn't belong to this user (use a fake id).
  const ghost = await page.evaluate(async ({ baseUrl, token }) => {
    const res = await fetch(`${baseUrl}/api/auth/addresses/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status;
  }, { baseUrl: BASE_URL, token });
  expect(ghost).toBe(404);
});
