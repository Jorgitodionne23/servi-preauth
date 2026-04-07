// Runtime config for the static frontend. Edit this file (or set window.CONFIG before it loads)
// to point the UI at the correct backend and Stripe publishable key.
(function bootstrapConfig() {
  const placeholderApi = 'http://localhost:4242';
  const placeholderPk = 'pk_live_51QzK6tG7utWo2rQv6la6tTL3pXXWiw2cUXUfnPeMtNEzywIa7AmQiRZgFFFxSmSTYdHoaD8Mel6gTQBHi5c7oINm00Tu5bdEHo';

  const explicit = window.CONFIG || {};
  const rawApi =
    explicit.API_BASE ||
    window.CONFIG_API_BASE ||
    window.SERVI_API_BASE ||
    (placeholderApi !== '__API_BASE__' ? placeholderApi : '') ||
    '';
  const normalizedApi = (rawApi || '').replace(/\/+$/, '') || window.location.origin;

  const rawPk =
    explicit.STRIPE_PUBLISHABLE_KEY ||
    window.CONFIG_STRIPE_PUBLISHABLE_KEY ||
    window.STRIPE_PUBLISHABLE_KEY ||
    placeholderPk ||
    '';

  // Single source of truth for the WhatsApp support number.
  // Update here when the number changes; then update the href values in each HTML file.
  const WHATSAPP_NUMBER = '525525112588';

  // Firebase configuration
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBYowh63UIEk_znMumnW0mNZuv8bkBsHag",
    authDomain: "servi-bec91.firebaseapp.com",
    projectId: "servi-bec91",
    storageBucket: "servi-bec91.firebasestorage.app",
    messagingSenderId: "315005869570",
    appId: "1:315005869570:web:ceff25c61cc8b5b361d11b"
  };

  window.CONFIG = {
    API_BASE: normalizedApi,
    STRIPE_PUBLISHABLE_KEY: rawPk,
    WHATSAPP_NUMBER,
    FIREBASE_CONFIG,
    GOOGLE_CLIENT_ID: '315005869570-lb1549n2f20thjsmb43neoun4vf1nc1p.apps.googleusercontent.com'
  };
})();
