// Runtime config for the static frontend. Edit this file (or set window.CONFIG before it loads)
// to point the UI at the correct backend and Stripe publishable key.
//
// HOW ENVIRONMENT SWITCHING WORKS:
// - Local/Render: placeholders are token strings → rawApi falls back to window.location.origin
//                 (backend serves frontend on the same origin), Stripe uses the test key below.
// - Production : Cloudflare Pages middleware (_middleware.js) replaces __API_BASE__ and
//                __STRIPE_PK__ with the real values from Cloudflare env vars before serving
//                this file. Set API_BASE and STRIPE_PUBLISHABLE_KEY in the Cloudflare Pages
//                dashboard → Settings → Environment variables.
(function bootstrapConfig() {
  // Token replaced by Cloudflare middleware in production. Locally, rawApi falls through to
  // window.location.origin (Express backend serves frontend on the same port).
  const placeholderApi = '__API_BASE__';

  // Token replaced by Cloudflare middleware in production with the live key.
  // Locally the middleware never runs, so we fall back to the test publishable key below.
  // Publishable keys are NOT secret — they are safe to commit.
  const placeholderPk = '__STRIPE_PK__';
  const localTestPk   = 'pk_test_51QzK6tG7utWo2rQvhFzSBxh59IMDentv5zN7jfKWtf5vkFiGkcuEENhumOpKGjkf33tGqrL3b3o05pp0DDvcJn4r00pQcvaQXR';

  const explicit = window.CONFIG || {};
  const isSameOriginBackend =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '::1' ||
    window.location.hostname.endsWith('.onrender.com');
  const fallbackApi = isSameOriginBackend ? window.location.origin : 'https://servi-preauth.onrender.com';

  // If the middleware replaced __API_BASE__ with a real URL, use it.
  // Otherwise local dev uses the same Express origin, while static deployments
  // still call the Render backend instead of the Pages host.
  const rawApi =
    explicit.API_BASE ||
    window.CONFIG_API_BASE ||
    window.SERVI_API_BASE ||
    (placeholderApi !== '__API_BASE__' ? placeholderApi : '') ||
    '';
  const normalizedApi = (rawApi || '').replace(/\/+$/, '') || fallbackApi;

  // If the middleware replaced __STRIPE_PK__ with the live key, use it.
  // Otherwise (local dev) use the test publishable key — safe to commit, not a secret.
  const rawPk =
    explicit.STRIPE_PUBLISHABLE_KEY ||
    window.CONFIG_STRIPE_PUBLISHABLE_KEY ||
    window.STRIPE_PUBLISHABLE_KEY ||
    (placeholderPk !== '__STRIPE_PK__' ? placeholderPk : localTestPk) ||
    '';

  // Single source of truth for the WhatsApp support number.
  // Update here when the number changes; then update the href values in each HTML file.
  const WHATSAPP_NUMBER = '525525112588';

  // Firebase configuration — apiKey is the Firebase Web API Key (public by design, safe to commit).
  // Do NOT delete or rotate this key in Google Cloud Console; Firebase Auth depends on it.
  const explicitFirebase = explicit.FIREBASE_CONFIG || {};
  const FIREBASE_CONFIG = {
    apiKey:
      explicitFirebase.apiKey ||
      window.CONFIG_FIREBASE_API_KEY ||
      window.FIREBASE_API_KEY ||
      'AIzaSyDu2mpz4vbiwvuE7VHF0UhWCNyt_qPAz7s',
    authDomain:
      explicitFirebase.authDomain ||
      window.CONFIG_FIREBASE_AUTH_DOMAIN ||
      'servi-bec91.firebaseapp.com',
    projectId:
      explicitFirebase.projectId ||
      window.CONFIG_FIREBASE_PROJECT_ID ||
      'servi-bec91',
    storageBucket:
      explicitFirebase.storageBucket ||
      window.CONFIG_FIREBASE_STORAGE_BUCKET ||
      'servi-bec91.firebasestorage.app',
    messagingSenderId:
      explicitFirebase.messagingSenderId ||
      window.CONFIG_FIREBASE_MESSAGING_SENDER_ID ||
      '315005869570',
    appId:
      explicitFirebase.appId ||
      window.CONFIG_FIREBASE_APP_ID ||
      '1:315005869570:web:ceff25c61cc8b5b361d11b'
  };

  window.CONFIG = {
    API_BASE: normalizedApi,
    STRIPE_PUBLISHABLE_KEY: rawPk,
    WHATSAPP_NUMBER,
    FIREBASE_CONFIG,
    GOOGLE_CLIENT_ID: '315005869570-lb1549n2f20thjsmb43neoun4vf1nc1p.apps.googleusercontent.com'
  };
})();
