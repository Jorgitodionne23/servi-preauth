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
  const WHATSAPP_NUMBER = '525525112588';

  // Contact channel control. The old WhatsApp number was resold, so all contact CTAs
  // are temporarily routed to email by shared/contact-cta.js.
  // To restore WhatsApp: set CONTACT_MODE = 'whatsapp' and update WHATSAPP_NUMBER above.
  // That is the only edit needed — every page's CTA is rebuilt from these values at runtime.
  const CONTACT_EMAIL = 'serv.clientserv@gmail.com';
  const CONTACT_MODE = 'email'; // 'email' | 'whatsapp'

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
    CONTACT_EMAIL,
    CONTACT_MODE,
    FIREBASE_CONFIG,
    GOOGLE_CLIENT_ID: '315005869570-lb1549n2f20thjsmb43neoun4vf1nc1p.apps.googleusercontent.com'
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Global error reporter. config.js is the only script on every page, so this
  // captures JS crashes, unhandled promise rejections, and failed API/payment
  // calls from ALL customer-facing + payment + admin pages and posts them to the
  // backend, where they surface on the admin dashboard "Errores" tab.
  // Fully defensive: it must never break a page, so everything is try/wrapped and
  // rate-capped. Anonymous by design (pay/book/admin have no session token).
  // ───────────────────────────────────────────────────────────────────────────
  (function installErrorReporter() {
    try {
      var ENDPOINT = normalizedApi + '/api/client-errors';
      var MAX_PER_PAGE = 10;      // hard cap per page load — never flood the store
      var sent = 0;
      var seen = {};              // dedupe identical messages within this page load

      function report(payload) {
        try {
          if (sent >= MAX_PER_PAGE) return;
          var msg = (payload && payload.message) || '';
          var key = (payload.source || '') + '|' + msg + '|' + (payload.stack || '').slice(0, 200);
          if (seen[key]) return;
          seen[key] = true;
          sent++;
          var body = JSON.stringify({
            page: location.pathname,
            url: location.href,
            level: payload.level || 'error',
            message: String(msg).slice(0, 2000),
            stack: payload.stack ? String(payload.stack).slice(0, 8000) : null,
            userAgent: navigator.userAgent,
            context: payload.context || null
          });
          // keepalive so a report still flushes if the page is unloading.
          fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body,
            keepalive: true,
            credentials: 'omit'
          }).catch(function () {});
        } catch (_) {}
      }

      window.addEventListener('error', function (e) {
        try {
          // Ignore resource-load errors (img/script 404s) — only real script errors.
          if (!e || (!e.error && !e.message)) return;
          report({
            source: 'js-error',
            message: e.message || (e.error && e.error.message) || 'Script error',
            stack: e.error && e.error.stack,
            context: { filename: e.filename, lineno: e.lineno, colno: e.colno }
          });
        } catch (_) {}
      });

      window.addEventListener('unhandledrejection', function (e) {
        try {
          var reason = e && e.reason;
          var message = (reason && reason.message) || String(reason || 'Unhandled rejection');
          report({
            source: 'promise-rejection',
            message: message,
            stack: reason && reason.stack,
            context: { kind: 'unhandledrejection' }
          });
        } catch (_) {}
      });

      // Wrap fetch to surface network failures + 5xx responses to our OWN backend.
      // Skips 4xx (expected/auth), non-API hosts, and the reporter endpoint (loop guard).
      if (typeof window.fetch === 'function') {
        var _origFetch = window.fetch.bind(window);
        window.fetch = function (input, init) {
          var url = '';
          try { url = (typeof input === 'string') ? input : (input && input.url) || ''; } catch (_) {}
          var isOwnApi = normalizedApi && url.indexOf(normalizedApi) === 0;
          var isReporter = url.indexOf('/api/client-errors') !== -1;
          var p = _origFetch(input, init);
          if (isOwnApi && !isReporter) {
            p.then(function (res) {
              try {
                if (res && res.status >= 500) {
                  var method = (init && init.method) || 'GET';
                  report({
                    source: 'api-5xx',
                    level: 'error',
                    message: 'API ' + res.status + ' ' + method + ' ' + url,
                    context: { status: res.status, method: method, api: url }
                  });
                }
              } catch (_) {}
            }, function (err) {
              try {
                var method2 = (init && init.method) || 'GET';
                report({
                  source: 'api-network',
                  level: 'error',
                  message: 'Network fail ' + method2 + ' ' + url + ' — ' + ((err && err.message) || err),
                  stack: err && err.stack,
                  context: { method: method2, api: url }
                });
              } catch (_) {}
            });
          }
          return p;
        };
      }
    } catch (_) { /* reporter must never break the page */ }
  })();
})();
