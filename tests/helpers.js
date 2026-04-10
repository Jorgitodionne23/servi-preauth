// ─── Shared test helpers ──────────────────────────────────────────────────────

export const BASE = 'https://servi-preauth.pages.dev';
export const TEST_PHONE = '+52 55 1202 5121';
export const TEST_PHONE_E164 = '+525512025121';
export const TEST_OTP = '232323';

/**
 * Inject a fake logged-in session.
 * - Writes fake JWT to localStorage (via addInitScript)
 * - Routes the Firebase auth SDK to a minimal mock that fires onAuthStateChanged
 *   with the fake user, preventing Firebase from clearing the session.
 */
export async function injectFakeSession(page, user = {}) {
  const defaultUser = {
    id: 'test-user-playwright-001',
    email: 'test@playwright.local',
    name: 'QA Tester',
    phone: TEST_PHONE_E164,
  };
  const u = { ...defaultUser, ...user };

  // Build a fake JWT (exp = 30 days from now)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    user_id: u.id, email: u.email, name: u.name, phone: u.phone,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    iat: Math.floor(Date.now() / 1000),
  }));
  const fakeToken = `${header}.${payload}.fakesig`;
  const sessionJson = JSON.stringify({ token: fakeToken, user: u, firebaseUid: 'firebase-uid-playwright' });

  // 1. Seed localStorage before page scripts run
  await page.addInitScript(([s]) => {
    try { localStorage.setItem('servi_user_session', s); } catch (e) {}
  }, [sessionJson]);

  // 2. Intercept Firebase auth CDN script and replace with minimal mock
  //    that fires onAuthStateChanged with our fake user.
  const fakeFirebaseUser = {
    uid: 'firebase-uid-playwright',
    email: u.email,
    displayName: u.name,
    phoneNumber: u.phone,
  };
  const mockScript = `
(function() {
  'use strict';
  const FAKE_USER = ${JSON.stringify(fakeFirebaseUser)};
  FAKE_USER.getIdToken = function() { return Promise.resolve('fake-token'); };
  FAKE_USER.reauthenticateWithPopup = async function() { return { user: FAKE_USER }; };
  FAKE_USER.reauthenticateWithPhoneNumber = async function() {
    return { confirm: async () => ({ user: FAKE_USER }) };
  };

  // Build mock auth instance
  function makeMockAuth() {
    const listeners = [];
    let _currentUser = FAKE_USER;
    const inst = {
      currentUser: FAKE_USER,
      languageCode: 'es',
      settings: { appVerificationDisabledForTesting: true },
      onAuthStateChanged: function(cb) {
        listeners.push(cb);
        // Fire immediately after a microtask (mimic real Firebase async)
        setTimeout(() => cb(_currentUser), 10);
        return function() { const i = listeners.indexOf(cb); if (i > -1) listeners.splice(i, 1); };
      },
      signOut: async function() {
        _currentUser = null;
        inst.currentUser = null;
        listeners.forEach(cb => cb(null));
      },
      signInWithPopup: async function() { return { user: FAKE_USER }; },
      signInWithPhoneNumber: async function() { return { confirm: async () => ({ user: FAKE_USER }) }; },
      sendSignInLinkToEmail: async function() {},
      isSignInWithEmailLink: function() { return false; },
      signInWithEmailLink: async function() { return { user: FAKE_USER }; },
    };
    return inst;
  }

  const mockAuth = makeMockAuth();

  // When firebase-app-compat sets window.firebase, we patch the auth getter
  let _firebase = window.firebase;
  Object.defineProperty(window, 'firebase', {
    configurable: true,
    get: function() { return _firebase; },
    set: function(val) {
      _firebase = val;
      // Override auth() to return our mock
      if (val && typeof val === 'object') {
        val.auth = function() { return mockAuth; };
        val.auth.GoogleAuthProvider = function() { return { addScope: function() {} }; };
        val.auth.RecaptchaVerifier = function() {
          return { clear: function() {}, render: async function() { return 0; } };
        };
        val.auth.PhoneAuthProvider = function() {};
        // Ensure apps array is populated so ensureFirebase() doesn't reinitialize
        if (!val.apps) val.apps = [{}];
        const origInit = val.initializeApp;
        val.initializeApp = function(cfg) {
          if (!val.apps || val.apps.length === 0) {
            if (origInit) origInit.call(val, cfg);
          }
        };
      }
    }
  });
})();
`;

  // Intercept both firebase-app-compat and firebase-auth-compat
  await page.route('**/firebase-app-compat.js', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    await route.fulfill({ contentType: 'application/javascript', body: body + '\n' + mockScript });
  });

  await page.route('**/firebase-auth-compat.js', async (route) => {
    await route.fulfill({ contentType: 'application/javascript', body: '// firebase-auth-compat mocked' });
  });

  // 3. Intercept GET /api/auth/me so the account-page auth guard doesn't redirect.
  //    Only mock GET and POST /api/auth/firebase — let DELETE and PATCH through to real backend or test-specific routes.
  await page.route('**/api/auth/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: { id: u.id, email: u.email, name: u.name, phone: u.phone, auth_provider: u.auth_provider || 'phone' } }),
      });
    } else {
      await route.continue();
    }
  });

  // 4. Intercept POST /api/auth/firebase so the Firebase sync doesn't fail.
  await page.route('**/api/auth/firebase', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: fakeToken, user: u }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Clear any session from localStorage.
 * Uses addInitScript so it works even before first navigation.
 */
export async function clearSession(page) {
  await page.addInitScript(() => {
    try { localStorage.removeItem('servi_user_session'); } catch (e) {}
  });
}

/**
 * Wait for the navbar to show a user name (i.e. auth completed and navbar rebuilt).
 */
export async function waitForLoggedInNavbar(page, timeout = 10000) {
  await page.waitForSelector('.user-menu-trigger', { timeout });
}

/**
 * Enable Firebase app verification bypass for test phone numbers.
 * Must be called via addInitScript before page loads.
 */
export function firebaseTestModeScript() {
  return `
    (function() {
      const interval = setInterval(() => {
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
          try {
            const a = firebase.auth();
            if (a && a.settings) {
              a.settings.appVerificationDisabledForTesting = true;
              clearInterval(interval);
            }
          } catch(e) {}
        }
      }, 50);
    })();
  `;
}
