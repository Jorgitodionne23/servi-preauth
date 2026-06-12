// ─── SERVI Shared Auth (Firebase) ────────────────────────────────────────────
// Unified Sign-in/Login (USL) flow:
//   1. User enters Phone or Email identifier
//   2. Backend checks → signup or login branch
//   Signup: primary OTP → name + terms → secondary ID (optional) → secondary OTP
//   Login:  primary OTP (phone or email based on provider) → done
//   Cross-ID recovery: email not found → check mismatch → merge with phone account
// Include AFTER i18n.js and BEFORE shared-nav.js.

(function () {
  const FIREBASE_VERSION = '10.12.0';
  const CDN_BASE = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION;

  // ── Firebase state ──────────────────────────────────────────────────────────
  let auth = null;
  let recaptchaVerifier = null;
  let confirmationResult = null;
  let firebaseReady = false;
  let usingAuthEmulator = false;

  // ── USL flow state ──────────────────────────────────────────────────────────
  let uslIdentifier = '';            // raw value user typed (E164 phone or email)
  let uslIdentifierType = '';        // 'phone' | 'email' (current screen identifier)
  let uslFirstIdentifierType = '';   // 'phone' | 'email' (what user entered on screen 1)
  let uslCurrentOTPType = '';        // 'phone' | 'email' (which OTP is active)
  let uslIsNew = false;              // true = signup, false = login
  let uslSignupComplete = false;     // true only while explicitly creating the backend user
  let uslSuppressAutoSync = false;   // temporarily prevents auth-state sync during provider checks
  let uslCompletingExisting = false; // true when forcing an incomplete existing profile through required fields
  let uslNewUserData = {};           // accumulates { phone, email, name } for new user

  // ── Email-login routing state (Uber-style) ──────────────────────────────────
  // When a returning user types their email at the identifier screen, we default
  // to phone OTP and show only first name + masked phone. These vars capture the
  // context needed by the OTP screen and the "More options" chooser.
  let uslLoginViaEmail = false;      // true when user typed email but we're sending phone OTP
  let uslTypedEmail = '';            // the email the user typed (used for magic-link fallback)
  let uslAccountFirstName = '';      // first name returned by backend
  let uslAccountPhoneLast4 = '';     // last 4 digits of phone for masked display
  let uslAccountEmailVerified = false; // whether email is verified (controls More options visibility)

  // ── Constants ───────────────────────────────────────────────────────────────
  // Firebase Phone Auth controls the real SMS code length. Keep this at 6 unless
  // the SMS provider is replaced with a custom OTP implementation.
  const PHONE_OTP_CODE_LENGTH = 6;
  const COUNTRIES = [
    { code: 'MX', dial: '+52', flag: '🇲🇽', label: 'MX +52' },
    { code: 'US', dial: '+1',  flag: '🇺🇸', label: 'US +1'  },
    { code: 'CA', dial: '+1',  flag: '🇨🇦', label: 'CA +1'  },
    { code: 'CO', dial: '+57', flag: '🇨🇴', label: 'CO +57' },
    { code: 'AR', dial: '+54', flag: '🇦🇷', label: 'AR +54' },
    { code: 'BR', dial: '+55', flag: '🇧🇷', label: 'BR +55' },
    { code: 'CL', dial: '+56', flag: '🇨🇱', label: 'CL +56' },
    { code: 'PE', dial: '+51', flag: '🇵🇪', label: 'PE +51' },
    { code: 'UY', dial: '+598', flag: '🇺🇾', label: 'UY +598' },
    { code: 'PY', dial: '+595', flag: '🇵🇾', label: 'PY +595' },
    { code: 'BO', dial: '+591', flag: '🇧🇴', label: 'BO +591' },
    { code: 'EC', dial: '+593', flag: '🇪🇨', label: 'EC +593' },
    { code: 'VE', dial: '+58', flag: '🇻🇪', label: 'VE +58' },
    { code: 'CR', dial: '+506', flag: '🇨🇷', label: 'CR +506' },
    { code: 'GT', dial: '+502', flag: '🇬🇹', label: 'GT +502' },
    { code: 'HN', dial: '+504', flag: '🇭🇳', label: 'HN +504' },
    { code: 'SV', dial: '+503', flag: '🇸🇻', label: 'SV +503' },
    { code: 'NI', dial: '+505', flag: '🇳🇮', label: 'NI +505' },
    { code: 'PA', dial: '+507', flag: '🇵🇦', label: 'PA +507' },
    { code: 'DO', dial: '+1', flag: '🇩🇴', label: 'DO +1' },
    { code: 'PR', dial: '+1', flag: '🇵🇷', label: 'PR +1' },
    { code: 'ES', dial: '+34', flag: '🇪🇸', label: 'ES +34' },
    { code: 'PT', dial: '+351', flag: '🇵🇹', label: 'PT +351' },
    { code: 'FR', dial: '+33', flag: '🇫🇷', label: 'FR +33' },
    { code: 'DE', dial: '+49', flag: '🇩🇪', label: 'DE +49' },
    { code: 'IT', dial: '+39', flag: '🇮🇹', label: 'IT +39' },
    { code: 'GB', dial: '+44', flag: '🇬🇧', label: 'GB +44' },
    { code: 'IE', dial: '+353', flag: '🇮🇪', label: 'IE +353' },
    { code: 'NL', dial: '+31', flag: '🇳🇱', label: 'NL +31' },
    { code: 'BE', dial: '+32', flag: '🇧🇪', label: 'BE +32' },
    { code: 'CH', dial: '+41', flag: '🇨🇭', label: 'CH +41' },
    { code: 'AT', dial: '+43', flag: '🇦🇹', label: 'AT +43' },
    { code: 'DK', dial: '+45', flag: '🇩🇰', label: 'DK +45' },
    { code: 'FI', dial: '+358', flag: '🇫🇮', label: 'FI +358' },
    { code: 'NO', dial: '+47', flag: '🇳🇴', label: 'NO +47' },
    { code: 'SE', dial: '+46', flag: '🇸🇪', label: 'SE +46' },
    { code: 'PL', dial: '+48', flag: '🇵🇱', label: 'PL +48' },
    { code: 'CZ', dial: '+420', flag: '🇨🇿', label: 'CZ +420' },
    { code: 'HU', dial: '+36', flag: '🇭🇺', label: 'HU +36' },
    { code: 'RO', dial: '+40', flag: '🇷🇴', label: 'RO +40' },
    { code: 'GR', dial: '+30', flag: '🇬🇷', label: 'GR +30' },
    { code: 'TR', dial: '+90', flag: '🇹🇷', label: 'TR +90' },
    { code: 'UA', dial: '+380', flag: '🇺🇦', label: 'UA +380' },
    { code: 'RU', dial: '+7', flag: '🇷🇺', label: 'RU +7' },
    { code: 'IL', dial: '+972', flag: '🇮🇱', label: 'IL +972' },
    { code: 'AE', dial: '+971', flag: '🇦🇪', label: 'AE +971' },
    { code: 'SA', dial: '+966', flag: '🇸🇦', label: 'SA +966' },
    { code: 'QA', dial: '+974', flag: '🇶🇦', label: 'QA +974' },
    { code: 'KW', dial: '+965', flag: '🇰🇼', label: 'KW +965' },
    { code: 'IN', dial: '+91', flag: '🇮🇳', label: 'IN +91' },
    { code: 'PK', dial: '+92', flag: '🇵🇰', label: 'PK +92' },
    { code: 'BD', dial: '+880', flag: '🇧🇩', label: 'BD +880' },
    { code: 'LK', dial: '+94', flag: '🇱🇰', label: 'LK +94' },
    { code: 'CN', dial: '+86', flag: '🇨🇳', label: 'CN +86' },
    { code: 'HK', dial: '+852', flag: '🇭🇰', label: 'HK +852' },
    { code: 'JP', dial: '+81', flag: '🇯🇵', label: 'JP +81' },
    { code: 'KR', dial: '+82', flag: '🇰🇷', label: 'KR +82' },
    { code: 'TW', dial: '+886', flag: '🇹🇼', label: 'TW +886' },
    { code: 'SG', dial: '+65', flag: '🇸🇬', label: 'SG +65' },
    { code: 'MY', dial: '+60', flag: '🇲🇾', label: 'MY +60' },
    { code: 'TH', dial: '+66', flag: '🇹🇭', label: 'TH +66' },
    { code: 'VN', dial: '+84', flag: '🇻🇳', label: 'VN +84' },
    { code: 'PH', dial: '+63', flag: '🇵🇭', label: 'PH +63' },
    { code: 'ID', dial: '+62', flag: '🇮🇩', label: 'ID +62' },
    { code: 'AU', dial: '+61', flag: '🇦🇺', label: 'AU +61' },
    { code: 'NZ', dial: '+64', flag: '🇳🇿', label: 'NZ +64' },
    { code: 'ZA', dial: '+27', flag: '🇿🇦', label: 'ZA +27' },
    { code: 'NG', dial: '+234', flag: '🇳🇬', label: 'NG +234' },
    { code: 'KE', dial: '+254', flag: '🇰🇪', label: 'KE +254' },
    { code: 'EG', dial: '+20', flag: '🇪🇬', label: 'EG +20' },
    { code: 'MA', dial: '+212', flag: '🇲🇦', label: 'MA +212' },
    { code: 'GH', dial: '+233', flag: '🇬🇭', label: 'GH +233' },
  ];
  window.__SERVI_COUNTRIES = COUNTRIES.slice();
  let selectedDial = '+52';

  const icons = {
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>',
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function tr()   { return (window.__t || {}).auth || {}; }
  function lang() { return window.__lang || 'es'; }
  function isEs() { return lang() === 'es'; }
  function API()  { return ((window.CONFIG && window.CONFIG.API_BASE) || '').replace(/\/+$/, ''); }
  function isSignupFlowLocked() {
    return !!(
      uslCompletingExisting ||
      (uslIsNew && !uslSignupComplete && (
        uslNewUserData.phone_verified ||
        uslNewUserData.email_verified ||
        uslNewUserData.name
      ))
    );
  }
  function shouldDeferBackendSync() {
    return uslSuppressAutoSync || (uslIsNew && !uslSignupComplete);
  }
  function hasPendingEmailVerificationAction() {
    return !!localStorage.getItem('servi_email_verification_mode');
  }
  function resetUslFlowState() {
    uslIdentifier = '';
    uslIdentifierType = '';
    uslFirstIdentifierType = '';
    uslCurrentOTPType = '';
    uslIsNew = false;
    uslSignupComplete = false;
    uslSuppressAutoSync = false;
    uslCompletingExisting = false;
    uslNewUserData = {};
    uslLoginViaEmail = false;
    uslTypedEmail = '';
    uslAccountFirstName = '';
    uslAccountPhoneLast4 = '';
    uslAccountEmailVerified = false;
    window.__syncError = null;
    window.__syncPromise = null;
    window.__user = null;
    localStorage.removeItem('servi_user_session');
  }

  // ── Modal container ──────────────────────────────────────────────────────────
  if (!document.getElementById('auth-modal-global')) {
    const div = document.createElement('div');
    div.id = 'auth-modal-global';
    document.body.appendChild(div);
  }

  function ensureAuthLoadingStyles() {
    if (document.getElementById('servi-auth-loading-styles')) return;
    var style = document.createElement('style');
    style.id = 'servi-auth-loading-styles';
    style.textContent =
      '#auth-modal-global .auth-loading-dots{' +
        'display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:38px;height:1em;vertical-align:middle' +
      '}' +
      '#auth-modal-global .auth-loading-dot{' +
        'width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.42;' +
        'transform:translateY(3px) scale(.78);animation:authDotGesture .9s cubic-bezier(.2,.8,.25,1) infinite' +
      '}' +
      '#auth-modal-global .auth-loading-dot:nth-child(2){animation-delay:.12s}' +
      '#auth-modal-global .auth-loading-dot:nth-child(3){animation-delay:.24s}' +
      '@keyframes authDotGesture{' +
        '0%,80%,100%{opacity:.38;transform:translateY(3px) scale(.78)}' +
        '35%{opacity:1;transform:translateY(-5px) scale(1.12)}' +
        '55%{opacity:.72;transform:translateY(0) scale(.96)}' +
      '}' +
      '@media (prefers-reduced-motion: reduce){' +
        '#auth-modal-global .auth-loading-dot{animation:authDotFade 1.1s ease-in-out infinite;transform:none}' +
        '@keyframes authDotFade{0%,80%,100%{opacity:.35}35%{opacity:1}}' +
      '}';
    document.head.appendChild(style);
  }

  // ── Firebase SDK (dynamic load) ──────────────────────────────────────────────
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (firebaseReady) return true;
    try {
      await loadScript(CDN_BASE + '/firebase-app-compat.js');
      await loadScript(CDN_BASE + '/firebase-auth-compat.js');
      var config = window.CONFIG && window.CONFIG.FIREBASE_CONFIG;
      if (!config || !config.apiKey) { console.warn('[SERVI] No Firebase config or API key found'); return false; }
      if (!firebase.apps.length) firebase.initializeApp(config);
      auth = firebase.auth();
      usingAuthEmulator = !!(
        (location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
        window.CONFIG &&
        window.CONFIG.USE_FIREBASE_AUTH_EMULATOR !== false
      );
      if (usingAuthEmulator) {
        auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
        auth.settings.appVerificationDisabledForTesting = true;
      }
      auth.languageCode = lang();
      firebaseReady = true;
      if (localStorage.getItem('servi_pending_logout')) {
        localStorage.removeItem('servi_pending_logout');
        try { await auth.signOut(); } catch (_) {}
      }
      auth.onAuthStateChanged(onAuthStateChanged);
      return true;
    } catch (err) {
      console.error('[SERVI] Firebase init error:', err);
      return false;
    }
  }

  // ── Auth state listener ──────────────────────────────────────────────────────
  function onAuthStateChanged(firebaseUser) {
    if (firebaseUser) {
      window.__syncError = null;
      if (shouldDeferBackendSync()) {
        window.__user = null;
        window.__syncPromise = null;
        localStorage.removeItem('servi_user_session');
      } else {
        window.__user = { id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName, phone: firebaseUser.phoneNumber };
        window.__syncPromise = syncWithBackend(firebaseUser);
        // Ghost user (Firebase identity exists but auth_users row was never finished)
        // → surface the name-collection screen instead of silently sitting on
        // an unauthenticated navbar. Triggered on cold-start and cross-tab
        // Firebase sync (e.g. email magic link clicked in another tab).
        window.__syncPromise.then(function () { maybeAutoResumeGhost(firebaseUser); });
      }
    } else {
      if (localStorage.getItem('servi_pending_logout')) localStorage.removeItem('servi_pending_logout');
      var rawSession = localStorage.getItem('servi_user_session');
      var preservingEmailAction = hasPendingEmailVerificationAction() && !!rawSession;
      if (preservingEmailAction || rawSession) {
        try {
          var preservedSession = JSON.parse(rawSession || 'null');
          window.__user = preservedSession && preservedSession.user ? preservedSession.user : window.__user;
        } catch (_) {}
      } else {
        window.__user = null;
        localStorage.removeItem('servi_user_session');
      }
      window.__syncError = null;
      window.__syncPromise = null;
    }
    if (window.buildNavbar) window.buildNavbar();
  }

  async function maybeAutoResumeGhost(firebaseUser) {
    if (!window.__syncError || window.__syncError.code !== 'signup_incomplete') return;
    if (uslSuppressAutoSync || uslIsNew || uslCompletingExisting) return;
    if (window.__serviEmailVerifiedPage || /\/email-verified\.html$/.test(window.location.pathname)) return;
    var modalEl = document.getElementById('auth-modal-global');
    if (modalEl && modalEl.innerHTML.trim() !== '') return;
    var resumeType = (firebaseUser && firebaseUser.phoneNumber) ? 'phone' : 'email';
    document.body.style.overflow = 'hidden';
    await resumeIncompleteSignupIfNeeded(firebaseUser, resumeType);
  }

  async function syncWithBackend(firebaseUser, options) {
    try {
      var idToken = await firebaseUser.getIdToken(true);
      // Confirm-Phone login: token carries phone but no email; surface uslTypedEmail so
      // the backend can verify the resolved phone account's email matches what the user typed.
      var emailHint = (uslLoginViaEmail && !firebaseUser.email) ? (uslTypedEmail || null) : null;
      var body = {
        name:  (uslNewUserData && uslNewUserData.name) || firebaseUser.displayName || null,
        phone: firebaseUser.phoneNumber || (uslNewUserData && uslNewUserData.phone) || null,
        email: firebaseUser.email       || (uslNewUserData && uslNewUserData.email) || emailHint || null,
        phone_verified: uslNewUserData && uslNewUserData.phone_verified != null ? uslNewUserData.phone_verified : (!!firebaseUser.phoneNumber || null),
        email_verified: uslNewUserData && uslNewUserData.email_verified != null ? uslNewUserData.email_verified : (firebaseUser.emailVerified === true ? true : null),
        first_identifier_type: uslFirstIdentifierType || null,
      };
      if (options && options.signupComplete) {
        body.signup_complete = true;
        body.terms_accepted = !!(uslNewUserData && uslNewUserData.terms_accepted);
        body.email_skipped = !!(uslNewUserData && uslNewUserData.email_skipped);
        var emailFlowProof = emailLinkFlowSignupProof();
        if (emailFlowProof && body.email) {
          body.email_link_flow_id = emailFlowProof.email_link_flow_id;
          body.email_link_poll_token = emailFlowProof.email_link_poll_token;
        }
      }
      var activeEmailFlowId = getEmailLinkFlowIdFromUrl();
      if (activeEmailFlowId) body.email_link_flow_id = activeEmailFlowId;
      var res = await fetch(API() + '/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        var data = await res.json();
        if (data.user && data.token) {
          window.__user = Object.assign({}, window.__user, data.user);
          localStorage.setItem('servi_user_session', JSON.stringify({ token: data.token, user: window.__user, firebaseUid: firebaseUser.uid }));
          if (window.buildNavbar) window.buildNavbar();
        } else {
          window.__syncError = { code: 'backend_sync_failed', status: 200 };
        }
      } else {
        var errData = {};
        try { errData = await res.json(); } catch (_) {}
        if (res.status === 401 && (errData.error === 'token_revoked' || errData.error === 'user_disabled')) {
          localStorage.removeItem('servi_user_session');
          window.__user = null;
          try { await auth.signOut(); } catch (_) {}
          if (window.buildNavbar) window.buildNavbar();
        } else if (res.status === 409 && errData.error === 'phone_exists') {
          window.__syncError = { code: 'phone_exists', message: errData.message };
        } else if (res.status === 409 && errData.error === 'signup_incomplete') {
          localStorage.removeItem('servi_user_session');
          window.__user = null;
          window.__syncError = { code: 'signup_incomplete', message: errData.message };
        } else if (res.status === 403 && errData.error === 'email_phone_mismatch') {
          localStorage.removeItem('servi_user_session');
          window.__user = null;
          try { await auth.signOut(); } catch (_) {}
          window.__syncError = { code: 'email_phone_mismatch', message: errData.message };
        } else if (res.status === 409 && errData.error === 'firebase_uid_conflict') {
          localStorage.removeItem('servi_user_session');
          window.__user = null;
          try { await auth.signOut(); } catch (_) {}
          window.__syncError = { code: 'firebase_uid_conflict', message: errData.message };
        } else {
          window.__syncError = { code: 'backend_sync_failed', status: res.status, message: errData.message };
        }
        if (res.status === 409 && errData.error === 'signup_incomplete') {
          console.info('[SERVI] Signup continuation needed:', errData.error);
        } else {
          console.error('[SERVI] Backend sync failed:', res.status, errData);
        }
      }
    } catch (err) {
      window.__syncError = { code: 'network_error', message: err.message };
      console.error('[SERVI] Backend sync error:', err.message);
    }
  }

  async function awaitSyncAndCheck() {
    if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
    if (window.__syncError) {
      var es = isEs();
      var errMsg = window.__syncError.code === 'phone_exists'
        ? (window.__syncError.message || (es ? 'Este número ya está registrado con otra cuenta.' : 'This phone is already registered with another account.'))
        : window.__syncError.code === 'signup_incomplete'
          ? (window.__syncError.message || (es ? 'Completa los pasos requeridos para crear tu cuenta.' : 'Complete the required steps to create your account.'))
        : window.__syncError.code === 'email_phone_mismatch'
          ? (es ? 'Ese teléfono no coincide con la cuenta de este correo. Intenta de nuevo.' : 'That phone doesn\'t match the account for this email. Try again.')
        : window.__syncError.code === 'firebase_uid_conflict'
          ? (es ? 'Esta cuenta ya está vinculada a otro método de acceso. Inicia sesión con tu correo.' : 'This account is already linked to another sign-in method. Sign in with your email.')
        : (es ? 'Error al conectar con el servidor. Intenta de nuevo.' : 'Error connecting to server. Please try again.');
      if (auth) { try { await auth.signOut(); } catch (_) {} }
      // For mismatch, return the user to the Confirm-Phone step so they can re-enter their phone.
      if (window.__syncError.code === 'email_phone_mismatch' && uslLoginViaEmail) {
        window.__syncError = null;
        renderConfirmPhoneScreen();
        setError(errMsg);
        return false;
      }
      setError(errMsg);
      return false;
    }
    return true;
  }

  async function resumeIncompleteSignupIfNeeded(firebaseUser, firstIdentifierType) {
    if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
    if (!window.__syncError || window.__syncError.code !== 'signup_incomplete') return false;

    var resumeType = firstIdentifierType || ((firebaseUser && firebaseUser.phoneNumber) ? 'phone' : 'email');
    uslIsNew = true;
    uslSignupComplete = false;
    uslSuppressAutoSync = true;
    uslCompletingExisting = false;
    uslFirstIdentifierType = resumeType;
    uslIdentifierType = resumeType;
    uslCurrentOTPType = resumeType;

    uslNewUserData = Object.assign({}, uslNewUserData || {});
    if (resumeType === 'phone') {
      uslIdentifier = (firebaseUser && firebaseUser.phoneNumber) || uslIdentifier;
      uslNewUserData.phone = uslIdentifier;
      uslNewUserData.phone_verified = true;
    } else {
      uslIdentifier = ((firebaseUser && firebaseUser.email) || uslIdentifier || '').toLowerCase();
      uslNewUserData.email = uslIdentifier;
      uslNewUserData.email_verified = true;
      if (firebaseUser && firebaseUser.displayName && !uslNewUserData.name) {
        uslNewUserData.name = firebaseUser.displayName;
      }
    }

    window.__syncError = null;
    window.__syncPromise = null;
    window.__user = null;
    localStorage.removeItem('servi_user_session');
    renderNameCollectionScreen();
    return true;
  }

  async function completeSignupSync() {
    var firebaseUser = auth && auth.currentUser;
    if (!firebaseUser) {
      setError(isEs() ? 'No pudimos confirmar tu sesión. Intenta de nuevo.' : 'We could not confirm your session. Please try again.');
      return false;
    }
    uslSignupComplete = true;
    uslSuppressAutoSync = false;
    window.__syncError = null;
    window.__syncPromise = syncWithBackend(firebaseUser, { signupComplete: true });
    var ok = await awaitSyncAndCheck();
    if (!ok) uslSignupComplete = false;
    if (ok) {
      try { localStorage.removeItem('servi_email_link_flow'); } catch (_) {}
    }
    return ok;
  }

  async function waitForFirebaseEmail(email, timeoutMs) {
    var target = String(email || '').toLowerCase();
    var deadline = Date.now() + (timeoutMs || 5000);
    while (Date.now() < deadline) {
      if (auth && auth.currentUser && String(auth.currentUser.email || '').toLowerCase() === target) {
        return auth.currentUser;
      }
      await new Promise(function (resolve) { setTimeout(resolve, 250); });
    }
    return auth && auth.currentUser;
  }

  function requiresProfileCompletion(user) {
    return !!(user && !user.name);
  }

  function startExistingProfileCompletion(user) {
    uslCompletingExisting = true;
    uslIsNew = false;
    uslSignupComplete = true;
    uslFirstIdentifierType = (user && user.phone) || (auth && auth.currentUser && auth.currentUser.phoneNumber)
      ? 'phone'
      : 'email';
    uslNewUserData = {
      email: user.email || null,
      name: user.name || '',
      phone: user.phone || (auth && auth.currentUser && auth.currentUser.phoneNumber) || null,
      phone_verified: !!user.phone_verified || !!(auth && auth.currentUser && auth.currentUser.phoneNumber),
      email_verified: !!user.email_verified,
    };
    if (!user.name) {
      renderNameCollectionScreen();
    } else if (!user.phone_verified) {
      renderSecondaryIdentifierScreen();
    } else {
      uslCompletingExisting = false;
      onAuthSuccess();
    }
  }

  // ── onAuthSuccess: close modal, re-render booking step 3 if in-flight ────────
  function onAuthSuccess() {
    uslCompletingExisting = false;
    closeAuthModal(true);
    if (window.bookingState && window.bookingState.step === 3 && document.getElementById('booking-panel')) {
      if (window.__user) {
        window.bookingState.clientName  = window.__user.name  || window.bookingState.clientName;
        window.bookingState.clientPhone = window.__user.phone || window.bookingState.clientPhone;
        window.bookingState.clientEmail = window.__user.email || window.bookingState.clientEmail;
      }
      if (window.renderBooking) window.renderBooking();
    }
    window.dispatchEvent(new Event('servi-auth-success'));
  }

  // ── Modal shell ──────────────────────────────────────────────────────────────
  function modalShell(title, showBack, backFn, forceShowBack) {
    ensureAuthLoadingStyles();
    var locked = isSignupFlowLocked();
    var renderBack = !!showBack && (!locked || !!forceShowBack);
    return (
      '<div class="modal-overlay" onclick="window.__authOverlayClick(event)">' +
        '<div class="modal-content" onclick="event.stopPropagation()" style="max-width:420px">' +
          '<div style="padding:32px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
              (renderBack
                ? '<button onclick="' + backFn + '()" style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;gap:6px;font-size:14px;color:#666;font-family:\'Plus Jakarta Sans\',sans-serif">' + icons.back + (isEs() ? ' Volver' : ' Back') + '</button>'
                : '<div></div>') +
              '<h2 class="heading-md" style="margin:0">' + title + '</h2>' +
              (locked
                ? '<div style="width:28px"></div>'
                : '<button onclick="window.__authCloseClick()" aria-label="' + (isEs() ? 'Cerrar' : 'Close') + '" style="background:none;border:none;cursor:pointer;padding:4px">' + icons.x + '</button>') +
            '</div>' +
            '<div id="auth-screen-body"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function setScreen(html) {
    var el = document.getElementById('auth-screen-body');
    if (el) el.innerHTML = html;
  }

  function setError(msg) {
    var el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  function errorBox() {
    return '<div id="auth-error" role="alert" aria-live="assertive" style="display:none;font-size:13px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;margin-bottom:12px"></div>';
  }

  function loadingDotsMarkup(label) {
    return '<span class="auth-loading-dots" role="status" aria-label="' + label + '">' +
      '<span class="auth-loading-dot"></span>' +
      '<span class="auth-loading-dot"></span>' +
      '<span class="auth-loading-dot"></span>' +
    '</span>';
  }

  function setVerifyOTPButtonLoading(btn, isLoading, es) {
    if (!btn) return;
    btn.disabled = !!isLoading;
    if (isLoading) {
      btn.innerHTML = loadingDotsMarkup(es ? 'Verificando' : 'Verifying');
    } else {
      btn.textContent = es ? 'Verificar' : 'Verify';
    }
  }

  function setSendOTPButtonLoading(btn, isLoading, es) {
    if (!btn) return;
    btn.disabled = !!isLoading;
    if (isLoading) {
      btn.innerHTML = loadingDotsMarkup(es ? 'Enviando código' : 'Sending code');
    } else {
      btn.textContent = es ? 'Enviar código SMS' : 'Send SMS code';
    }
  }

  window.__authOverlayClick = function (event) {
    if (event && event.target !== event.currentTarget) return;
    window.__authCloseClick();
  };

  window.__authCloseClick = function () {
    if (isSignupFlowLocked()) {
      setError(isEs()
        ? 'Completa estos pasos para terminar el registro.'
        : 'Complete these steps to finish sign up.');
      return;
    }
    closeAuthModal();
  };

  function infoBanner(text) {
    return '<div style="background:rgba(149,204,213,0.14);border:1px solid rgba(149,204,213,0.34);border-radius:8px;padding:10px 12px;font-size:13px;color:#4f9fab;margin-bottom:16px">' + text + '</div>';
  }

  function otpInputMarkup(es) {
    var boxes = '';
    for (var i = 0; i < PHONE_OTP_CODE_LENGTH; i++) {
      boxes += '<div class="auth-otp-box" data-otp-index="' + i + '" ' +
        'style="height:54px;border:1.5px solid #d9d9d9;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;color:#0a0a0a;box-sizing:border-box"></div>';
    }
    return (
      '<div id="auth-otp-wrap" role="group" aria-label="' + (es ? 'Código de verificación' : 'Verification code') + '" ' +
        'style="position:relative;display:grid;grid-template-columns:repeat(' + PHONE_OTP_CODE_LENGTH + ',minmax(0,1fr));gap:8px;margin-bottom:12px;cursor:text">' +
        boxes +
        '<input id="auth-otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="' + PHONE_OTP_CODE_LENGTH + '" ' +
          'aria-label="' + (es ? 'Código de ' + PHONE_OTP_CODE_LENGTH + ' dígitos' : PHONE_OTP_CODE_LENGTH + '-digit code') + '" ' +
          'style="position:absolute;inset:0;width:100%;height:100%;opacity:0;border:0;padding:0;margin:0;cursor:text" />' +
      '</div>'
    );
  }

  function updateOTPBoxes() {
    var input = document.getElementById('auth-otp');
    if (!input) return;
    var value = String(input.value || '').replace(/\D/g, '').slice(0, PHONE_OTP_CODE_LENGTH);
    if (input.value !== value) input.value = value;
    var boxes = document.querySelectorAll('.auth-otp-box');
    var focused = document.activeElement === input;
    var activeIndex = Math.min(value.length, PHONE_OTP_CODE_LENGTH - 1);
    boxes.forEach(function (box, index) {
      box.textContent = value[index] || '';
      var isActive = focused && index === activeIndex;
      var isFilled = !!value[index];
      box.style.borderColor = isActive ? '#0a0a0a' : (isFilled ? '#9ca3af' : '#d9d9d9');
      box.style.boxShadow = isActive ? '0 0 0 3px rgba(10,10,10,0.08)' : 'none';
      box.style.background = isFilled ? '#fafafa' : '#fff';
    });
  }

  function attachOTPInputHandlers() {
    var input = document.getElementById('auth-otp');
    var wrap = document.getElementById('auth-otp-wrap');
    if (!input || !wrap) return;
    wrap.addEventListener('click', function () { input.focus(); });
    input.addEventListener('input', updateOTPBoxes);
    input.addEventListener('focus', updateOTPBoxes);
    input.addEventListener('blur', updateOTPBoxes);
    input.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      // The verify button is disabled synchronously while a verification is in flight, so
      // honoring its disabled state here stops a rapid second Enter from re-entering
      // confirmationResult.confirm() / linkWithCredential() and double-submitting the code.
      var vbtn = document.getElementById('verify-otp-btn');
      if (vbtn && vbtn.disabled) return;
      window.__uslVerifyOTP();
    });
    updateOTPBoxes();
  }

  function getOTPCode() {
    return String((document.getElementById('auth-otp') || {}).value || '').replace(/\D/g, '').slice(0, PHONE_OTP_CODE_LENGTH);
  }

  function progressDots(active) {
    // active is 1-indexed (1=screen1, 2=OTP, 3=name, 4=secondary)
    var dots = '';
    for (var i = 1; i <= 4; i++) {
      var bg = i < active ? '#0a0a0a' : i === active ? 'var(--color-accent, #95ccd5)' : '#e8e8e8';
      dots += '<div style="flex:1;height:3px;border-radius:2px;background:' + bg + '"></div>';
    }
    return '<div style="display:flex;gap:4px;margin-bottom:20px">' + dots + '</div>';
  }

  // ── Country select ───────────────────────────────────────────────────────────
  function setSelectedDial(dial) {
    selectedDial = dial || selectedDial;
    var select = document.getElementById('auth-country-code');
    if (select && select.value !== selectedDial) select.value = selectedDial;
  }

  function countryForInternationalDigits(digits) {
    if (!digits) return null;
    var sorted = COUNTRIES.slice().sort(function (a, b) { return b.dial.length - a.dial.length; });
    for (var i = 0; i < sorted.length; i++) {
      var dialDigits = sorted[i].dial.replace(/\D/g, '');
      if (digits.indexOf(dialDigits) === 0) return sorted[i];
    }
    return null;
  }

  function detectDialFromPhoneInput(input) {
    if (!input) return;
    var raw = String(input.value || '').trim();
    var explicitInternational = raw.indexOf('+') === 0 || raw.indexOf('00') === 0;
    if (!explicitInternational) return;

    var digits = raw.replace(/\D/g, '');
    if (raw.indexOf('00') === 0) digits = digits.replace(/^00/, '');
    var country = countryForInternationalDigits(digits);
    if (!country) return;

    setSelectedDial(country.dial);
    var national = digits.slice(country.dial.replace(/\D/g, '').length);
    if (national && input.value !== national) input.value = national;
  }

  function phoneIdentifierFromInput(raw) {
    raw = String(raw || '').trim();
    if (raw.indexOf('+') === 0) return '+' + raw.replace(/\D/g, '');
    if (raw.indexOf('00') === 0) {
      var intlDigits = raw.replace(/\D/g, '').replace(/^00/, '');
      var country = countryForInternationalDigits(intlDigits);
      if (country) setSelectedDial(country.dial);
      return '+' + intlDigits;
    }
    return selectedDial + raw.replace(/\D/g, '');
  }

  function countrySelect(inputId) {
    var opts = COUNTRIES.map(function (c) {
      return '<option value="' + c.dial + '"' + (c.dial === selectedDial ? ' selected' : '') + '>' + c.flag + ' ' + c.label + '</option>';
    }).join('');
    return (
      '<select id="auth-country-code" onchange="window.__uslSetDial(this.value)" ' +
        'style="border:1.5px solid #e8e8e8;border-radius:10px 0 0 10px;padding:12px 8px;font-size:14px;font-family:\'Plus Jakarta Sans\',sans-serif;background:#fff;cursor:pointer;outline:none;flex-shrink:0">' +
        opts +
      '</select>'
    );
  }

  window.__uslSetDial = function (val) { setSelectedDial(val); };

  function getEmailLinkTargetFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var direct = params.get('email') || params.get('email_hint');
      if (direct) return direct.toLowerCase().trim();
      var continueUrl = params.get('continueUrl');
      if (continueUrl) {
        var nested = new URL(continueUrl);
        var nestedEmail = nested.searchParams.get('email') || nested.searchParams.get('email_hint');
        if (nestedEmail) return nestedEmail.toLowerCase().trim();
      }
    } catch (_) {}
    return '';
  }

  function getEmailLinkFlowIdFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var direct = params.get('flow_id');
      if (direct) return direct;
      var continueUrl = params.get('continueUrl');
      if (continueUrl) {
        var nested = new URL(continueUrl);
        return nested.searchParams.get('flow_id') || '';
      }
    } catch (_) {}
    return '';
  }

  async function startEmailLinkFlow(email, purpose) {
    var flowPurpose = purpose || 'login';
    var headers = { 'Content-Type': 'application/json' };
    if (flowPurpose === 'signup_verification' && auth && auth.currentUser && auth.currentUser.phoneNumber) {
      try {
        headers.Authorization = 'Bearer ' + await auth.currentUser.getIdToken(true);
      } catch (_) {}
    }
    var res = await fetch(API() + '/api/auth/email-link-flow/start', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ email: email, purpose: flowPurpose })
    });
    var data = await res.json().catch(function () { return {}; });
    if (flowPurpose === 'signup_verification' && res.status === 404) {
      return null;
    }
    if (!res.ok || !data.flow_id || !data.poll_token) {
      var err = new Error(data.error || 'email_link_flow_start_failed');
      err.code = data.error || 'email_link_flow_start_failed';
      throw err;
    }
    return data;
  }

  function saveEmailLinkFlow(flow) {
    if (!flow || !flow.flow_id || !flow.poll_token) return;
    try {
      localStorage.setItem('servi_email_link_flow', JSON.stringify({
        flow_id: flow.flow_id,
        poll_token: flow.poll_token,
        purpose: flow.purpose || null,
        expires_at: flow.expires_at || null
      }));
    } catch (_) {}
  }

  function loadEmailLinkFlow() {
    try { return JSON.parse(localStorage.getItem('servi_email_link_flow') || 'null'); } catch (_) { return null; }
  }

  async function completeEmailLinkFlowIfPresent() {
    var flowId = getEmailLinkFlowIdFromUrl();
    if (!flowId || !auth || !auth.currentUser) return false;
    var idToken = await auth.currentUser.getIdToken(true);
    var res = await fetch(API() + '/api/auth/email-link-flow/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify({ flow_id: flowId })
    });
    return res.ok;
  }

  async function pollEmailLinkFlow(flow) {
    if (!flow || !flow.flow_id || !flow.poll_token) return null;
    var res = await fetch(API() + '/api/auth/email-link-flow/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow_id: flow.flow_id, poll_token: flow.poll_token })
    });
    if (res.status === 404) {
      try { localStorage.removeItem('servi_email_link_flow'); } catch (_) {}
      return null;
    }
    if (!res.ok) return null;
    return res.json().catch(function () { return null; });
  }

  function acceptEmailLinkFlowSession(data) {
    if (!data || !data.token || !data.user) return false;
    window.__user = data.user;
    try {
      localStorage.setItem('servi_user_session', JSON.stringify({ token: data.token, user: data.user }));
      localStorage.setItem('servi_email_verified_at', Date.now().toString());
      localStorage.removeItem('servi_email_link_flow');
    } catch (_) {}
    if (window.buildNavbar) window.buildNavbar();
    return true;
  }

  function emailLinkFlowSignupProof() {
    var flow = loadEmailLinkFlow();
    if (!flow || !flow.flow_id || !flow.poll_token) return null;
    if (flow.purpose && flow.purpose !== 'signup_verification') return null;
    return {
      email_link_flow_id: flow.flow_id,
      email_link_poll_token: flow.poll_token
    };
  }

  // ── Monitor for email verification in other tab ─────────────────────────────────
  // When user clicks email link in a new tab, that tab verifies and broadcasts.
  // The localStorage flag is a UX trigger ONLY (signals "stop polling, check now") —
  // we never trust it as proof of verification. Final email_verified state is always
  // confirmed server-side via GET /api/auth/me before the booking gate opens.
  window.__monitorEmailVerification = function () {
    var startTime = Date.now();
    var timeout = 10 * 60 * 1000; // 10 minutes
    var pollInterval = null;
    var onVerificationDetected = null;
    var handled = false; // guard against double-calls across storage/poll/visibility triggers
    var flowPollBusy = false;

    function checkVerifiedFlag() {
      return !!localStorage.getItem('servi_email_verified_at');
    }

    // Authoritative server check — flag alone is never trusted (audit A5).
    async function confirmEmailVerifiedWithBackend() {
      try {
        var sess = JSON.parse(localStorage.getItem('servi_user_session') || 'null');
        if (!sess || !sess.token) return null;
        var res = await fetch(API() + '/api/auth/me', {
          headers: { 'Authorization': 'Bearer ' + sess.token }
        });
        if (!res.ok) return null;
        var data = await res.json();
        if (data && data.user && data.user.email_verified === true) {
          return data.user;
        }
        return null;
      } catch (_) {
        return null;
      }
    }

    async function continueAfterVerification() {
      if (handled) return;
      handled = true;
      if (pollInterval) clearInterval(pollInterval);
      if (onVerificationDetected) window.removeEventListener('storage', onVerificationDetected);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      if (uslIsNew && uslFirstIdentifierType === 'email') {
        var primaryEmail = uslIdentifier || localStorage.getItem('servi_email_link_target');
        await waitForFirebaseEmail(primaryEmail, 5000);
        uslNewUserData.email = primaryEmail;
        uslNewUserData.email_verified = true;
        renderNameCollectionScreen();
        return;
      }

      // Existing-user login that landed on a ghost: the "check email" screen
      // is currently shown, so onAuthStateChanged's auto-resume will skip
      // (modal not empty). Resume here directly instead of looping the server
      // poll until timeout.
      if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
      if (window.__syncError && window.__syncError.code === 'signup_incomplete') {
        var emailForResume = uslIdentifier || localStorage.getItem('servi_email_link_target');
        var fbUser = await waitForFirebaseEmail(emailForResume, 5000);
        if (fbUser) await resumeIncompleteSignupIfNeeded(fbUser, 'email');
        return;
      }

      // Server-authoritative confirmation. If backend hasn't yet processed the
      // email verification (race), retry briefly before accepting/rejecting.
      var serverUser = null;
      for (var attempt = 0; attempt < 6; attempt++) {
        serverUser = await confirmEmailVerifiedWithBackend();
        if (serverUser) break;
        await new Promise(function (r) { setTimeout(r, 500); });
      }

      if (!serverUser) {
        // Backend has not confirmed verification — re-arm monitor instead of trusting the flag
        handled = false;
        return;
      }

      var email = serverUser.email;
      if (!window.__user) window.__user = serverUser;
      uslNewUserData.email = email;
      uslNewUserData.email_verified = true;
      if (uslIsNew && uslFirstIdentifierType === 'email') {
        renderNameCollectionScreen();
      } else {
        onAuthSuccess();
      }
    }

    async function continueAfterEmailLinkFlow() {
      if (handled || flowPollBusy) return;
      var flow = loadEmailLinkFlow();
      if (!flow) return;
      flowPollBusy = true;
      try {
        var data = await pollEmailLinkFlow(flow);
        if (data && data.completed && data.purpose === 'signup_verification' && data.email_verified === true) {
          var verifiedEmail = data.email || uslIdentifier || localStorage.getItem('servi_email_link_target');
          uslNewUserData.email = verifiedEmail;
          uslNewUserData.email_verified = true;
          handled = true;
          if (pollInterval) clearInterval(pollInterval);
          if (onVerificationDetected) window.removeEventListener('storage', onVerificationDetected);
          document.removeEventListener('visibilitychange', onVisibilityChange);
          if (uslIsNew && uslFirstIdentifierType === 'email') {
            renderNameCollectionScreen();
          } else if (uslIsNew && uslFirstIdentifierType === 'phone') {
            var created = await completeSignupSync();
            if (created) onAuthSuccess();
          }
          return;
        }
        if (data && data.completed && acceptEmailLinkFlowSession(data)) {
          handled = true;
          if (pollInterval) clearInterval(pollInterval);
          if (onVerificationDetected) window.removeEventListener('storage', onVerificationDetected);
          document.removeEventListener('visibilitychange', onVisibilityChange);
          onAuthSuccess();
        }
      } finally {
        flowPollBusy = false;
      }
    }

    // Listen for storage events (from other tabs setting servi_email_verified_at)
    onVerificationDetected = function (e) {
      if (e.key === 'servi_email_verified_at') {
        continueAfterVerification();
      }
    };
    window.addEventListener('storage', onVerificationDetected);

    // Listen for page visibility changes (user returns to this tab after closing email-verified tab)
    function onVisibilityChange() {
      if (document.hidden) return;
      if (checkVerifiedFlag()) continueAfterVerification();
      continueAfterEmailLinkFlow();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Polling fallback (in case storage event doesn't fire in some browsers).
    // The flag merely triggers a server confirmation — it is not itself proof.
    pollInterval = setInterval(function () {
      if (Date.now() - startTime > timeout) {
        clearInterval(pollInterval);
        return;
      }
      if (checkVerifiedFlag()) continueAfterVerification();
      continueAfterEmailLinkFlow();
    }, 1000);

    // Cleanup on modal close
    var originalCloseAuthModal = window.closeAuthModal;
    window.closeAuthModal = function (force) {
      if (pollInterval) clearInterval(pollInterval);
      if (onVerificationDetected) window.removeEventListener('storage', onVerificationDetected);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.__uslManualEmailContinue = null;
      if (originalCloseAuthModal) originalCloseAuthModal(force);
    };

    // Manual escape hatch: user taps "Ya verifiqué" — bypasses storage event
    // (needed when link opens on another device or in a webview that doesn't
    // share localStorage with the original tab).
    window.__uslManualEmailContinue = async function () {
      var btn = document.getElementById('manual-email-continue-btn');
      var hint = document.getElementById('manual-email-hint');

      if (btn) { btn.disabled = true; btn.textContent = isEs() ? 'Verificando...' : 'Verifying...'; }
      var flowData = await pollEmailLinkFlow(loadEmailLinkFlow());
      if (flowData && flowData.completed && flowData.purpose === 'signup_verification' && flowData.email_verified === true) {
        uslNewUserData.email = flowData.email || uslIdentifier || localStorage.getItem('servi_email_link_target');
        uslNewUserData.email_verified = true;
        if (uslIsNew && uslFirstIdentifierType === 'email') {
          renderNameCollectionScreen();
        } else if (uslIsNew && uslFirstIdentifierType === 'phone') {
          var signupCreated = await completeSignupSync();
          if (signupCreated) onAuthSuccess();
        }
        return;
      }
      if (flowData && flowData.completed && acceptEmailLinkFlowSession(flowData)) {
        onAuthSuccess();
        return;
      }

      if (auth && auth.currentUser && auth.currentUser.email) {
        try {
          // Force-refresh Firebase user state — the local object may be stale and
          // not yet reflect the email_verified flag set after the link was clicked.
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified === true) {
            var idToken = await auth.currentUser.getIdToken(true);
            var res = await fetch(API() + '/api/auth/firebase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
              body: JSON.stringify({})
            });
            if (res.ok) {
              var data = await res.json();
              if (data && data.token) {
                try {
                  var sess = JSON.parse(localStorage.getItem('servi_user_session') || 'null') || {};
                  sess.token = data.token;
                  if (data.user) sess.user = Object.assign({}, sess.user, data.user);
                  localStorage.setItem('servi_user_session', JSON.stringify(sess));
                } catch (_) {}
              }
              try { localStorage.setItem('servi_email_verified_at', Date.now().toString()); } catch (_) {}
              continueAfterVerification();
            } else {
              if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Ya verifiqué mi correo' : 'I verified my email'; }
              if (hint) {
                hint.textContent = isEs()
                  ? 'Hubo un problema al confirmar la verificación. Intenta de nuevo.'
                  : 'There was a problem confirming verification. Please try again.';
                hint.style.display = 'block';
              }
            }
          } else {
            if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Ya verifiqué mi correo' : 'I verified my email'; }
            if (hint) {
              hint.textContent = isEs()
                ? 'Aún no detectamos la verificación. Abre el enlace en este mismo navegador.'
                : "We haven't detected the verification yet. Open the link in this browser.";
              hint.style.display = 'block';
            }
          }
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Ya verifiqué mi correo' : 'I verified my email'; }
          if (hint) {
            hint.textContent = isEs()
              ? 'Error de red. Verifica tu conexión e intenta de nuevo.'
              : 'Network error. Check your connection and try again.';
            hint.style.display = 'block';
          }
        }
        return;
      }

      // No Firebase user yet — poll until auth state resolves
      var waited = 0;
      var waitForAuth = setInterval(function () {
        waited += 500;
        if (auth && auth.currentUser && auth.currentUser.email) {
          clearInterval(waitForAuth);
          try { localStorage.setItem('servi_email_verified_at', Date.now().toString()); } catch (_) {}
          continueAfterVerification();
          return;
        }
        if (waited >= 4000) {
          clearInterval(waitForAuth);
          if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Ya verifiqué mi correo' : 'I verified my email'; }
          if (hint) {
            hint.textContent = isEs()
              ? 'Aún no detectamos la verificación. Abre el enlace en este mismo navegador o vuelve a esta pestaña después de hacer clic.'
              : "We haven't detected the verification yet. Open the link in this browser or return to this tab after clicking it.";
            hint.style.display = 'block';
          }
        }
      }, 500);
    };
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Identifier Input
  // ══════════════════════════════════════════════════════════════════════════════
  function renderIdentifierScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Ingresa a SERVI' : 'Sign in to SERVI', false, '');
    setScreen(
      '<button onclick="handleGoogleAuth()" id="google-auth-btn" style="width:100%;padding:14px;border:1.5px solid #e0e0e0;border-radius:12px;background:#fff;font-size:15px;font-weight:500;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:10px">' +
        icons.google + ' ' + (es ? 'Continuar con Google' : 'Continue with Google') +
      '</button>' +
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px"><div style="flex:1;height:1px;background:#eee"></div><span style="font-size:12px;color:#aaa">' + (es ? 'o' : 'or') + '</span><div style="flex:1;height:1px;background:#eee"></div></div>' +
      errorBox() +
      '<div id="usl-input-wrap" style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
        '<div id="usl-country-wrap">' + countrySelect() + '</div>' +
        '<input id="auth-identifier" type="tel" inputmode="tel" ' +
          'placeholder="' + (es ? 'Teléfono o correo electrónico' : 'Phone number or email') + '" ' +
          'style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'Plus Jakarta Sans\',sans-serif;outline:none" ' +
          'onkeydown="if(event.key===\'Enter\') window.__uslSubmitIdentifier()">' +
      '</div>' +
      '<button class="btn-primary" onclick="window.__uslSubmitIdentifier()" id="usl-continue-btn" style="width:100%;justify-content:center">' + (es ? 'Continuar' : 'Continue') + '</button>' +
      '<div id="recaptcha-container" style="margin-top:8px"></div>'
    );
    document.body.style.overflow = 'hidden';
    var inp = document.getElementById('auth-identifier');
    var countryWrap = document.getElementById('usl-country-wrap');
    if (inp) {
      inp.focus();
      inp.addEventListener('input', function () {
        var hasLetter = /[a-zA-Z]/.test(inp.value);
        inp.setAttribute('type', hasLetter ? 'email' : 'tel');
        inp.setAttribute('inputmode', hasLetter ? 'email' : 'tel');
        if (countryWrap) countryWrap.style.display = hasLetter ? 'none' : '';
        if (!hasLetter) detectDialFromPhoneInput(inp);
      });
    }
    ensureFirebase().then(setupRecaptchaInner);
  }

  window.__uslSubmitIdentifier = async function () {
    var raw = (document.getElementById('auth-identifier') || {}).value.trim();
    if (!raw) { setError(isEs() ? 'Ingresa tu teléfono o correo.' : 'Enter your phone or email.'); return; }

    var isEmail = raw.includes('@');
    var identifier = isEmail ? raw.toLowerCase() : phoneIdentifierFromInput(raw);

    uslIdentifier = identifier;
    uslIdentifierType = isEmail ? 'email' : 'phone';
    uslFirstIdentifierType = uslIdentifierType;
    uslNewUserData = {};
    uslLoginViaEmail = false;
    uslTypedEmail = '';
    uslAccountFirstName = '';
    uslAccountPhoneLast4 = '';
    uslAccountEmailVerified = false;

    var btn = document.getElementById('usl-continue-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      var res = await fetch(API() + '/api/auth/check-identifier', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      var data = await res.json();
      uslIsNew = !data.exists;

      if (!uslIsNew) {
        // Existing user
        var provider = data.provider || uslIdentifierType;
        if (provider === 'google') {
          if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Continuar' : 'Continue'; }
          setError(isEs() ? 'Esta cuenta usa Google. Usa el botón "Continuar con Google".' : 'This account uses Google. Use the "Continue with Google" button.');
          return;
        }

        // Email-identifier login → ask the user to confirm their full phone, then send OTP.
        // Backend returns only the last 4 digits (no full phone, no name) to prevent enumeration.
        if (isEmail && data.phone_last4) {
          uslLoginViaEmail = true;
          uslTypedEmail = identifier;
          uslAccountPhoneLast4 = data.phone_last4 || '';
          uslAccountEmailVerified = !!data.email_verified;
          renderConfirmPhoneScreen();
          return;
        }

        renderOTPScreen(provider === 'email' ? 'email' : 'phone', /* isLogin= */ true);
      } else {
        // New user — go directly to primary OTP
        renderOTPScreen(uslIdentifierType, /* isLogin= */ false);
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Continuar' : 'Continue'; }
      setError(isEs() ? 'Error de conexión. Intenta de nuevo.' : 'Connection error. Try again.');
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // Confirm-Phone screen — shown when login starts from an email that matches an
  // account with a phone. The backend returns only the last 4 digits (no full phone)
  // to prevent enumeration, so the user re-types their full phone before we trigger
  // the SMS OTP. Matches the Uber-style "confirm your number" pattern.
  // ══════════════════════════════════════════════════════════════════════════════
  function renderConfirmPhoneScreen() {
    var es = isEs();
    var title = es ? 'Confirma tu teléfono' : 'Confirm your phone';
    document.getElementById('auth-modal-global').innerHTML = modalShell(title, true, 'window.__uslBack');
    var maskedTail = uslAccountPhoneLast4 ? '••••••' + uslAccountPhoneLast4 : '';
    var hint = es
      ? 'Encontramos tu cuenta. Termina en <strong>' + maskedTail + '</strong>. Escribe tu teléfono completo para recibir un código.'
      : 'We found your account ending in <strong>' + maskedTail + '</strong>. Enter your full phone to receive a code.';
    setScreen(
      progressDots(2) +
      '<p style="font-size:15px;font-weight:700;margin-bottom:6px">' +
        (es ? 'Bienvenido de vuelta' : 'Welcome back') +
      '</p>' +
      '<p style="font-size:14px;color:#666;margin-bottom:16px;line-height:1.5">' + hint + '</p>' +
      errorBox() +
      '<div style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
        countrySelect() +
        '<input id="confirm-phone-input" type="tel" inputmode="numeric" placeholder="55 1234 5678" ' +
          'style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'Plus Jakarta Sans\',sans-serif;outline:none" ' +
          'onkeydown="if(event.key===\'Enter\') window.__uslConfirmPhoneNext()">' +
      '</div>' +
      '<button class="btn-primary" onclick="window.__uslConfirmPhoneNext()" id="confirm-phone-btn" style="width:100%;justify-content:center">' +
        (es ? 'Continuar' : 'Continue') +
      '</button>'
    );
    var el = document.getElementById('confirm-phone-input');
    if (el) el.focus();
  }

  window.__uslConfirmPhoneNext = function () {
    var es = isEs();
    var digits = ((document.getElementById('confirm-phone-input') || {}).value || '').replace(/\D/g, '');
    if (!digits) { setError(es ? 'Ingresa tu teléfono.' : 'Enter your phone.'); return; }
    var candidatePhone = selectedDial + digits;
    // The Confirm-Phone screen is reached only via uslLoginViaEmail. Keep uslTypedEmail
    // intact — it's sent to the backend as the cross-check after OTP succeeds.
    uslIdentifier = candidatePhone;
    uslIdentifierType = 'phone';
    setError('');
    renderOTPScreen('phone', /* isLogin= */ true);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 2a — Primary OTP (phone or email, signup or login)
  // Single function handles all four combinations.
  // ══════════════════════════════════════════════════════════════════════════════
  function renderOTPScreen(type, isLogin) {
    uslCurrentOTPType = type;
    var es = isEs();
    var isPhone = type === 'phone';

    var title = isPhone
      ? (es ? 'Verificar teléfono' : 'Verify phone')
      : (es ? 'Verificar correo'   : 'Verify email');

    // Secondary-phone OTP during email-first signup gets a scoped back that
    // returns to phone entry without wiping Google/email signup state.
    var isSecondaryPhoneOTP = isPhone && uslIsNew && uslFirstIdentifierType === 'email';
    var backFn = isSecondaryPhoneOTP ? 'window.__uslBackToPhoneEntry' : 'window.__uslBack';
    document.getElementById('auth-modal-global').innerHTML = modalShell(title, true, backFn, isSecondaryPhoneOTP);

    if (isPhone) {
      // Login-via-email path passes through Confirm-Phone, so uslIdentifier is the
      // user-typed full phone — safe to display directly. Backend never returns the
      // account's full phone, so there's no longer a masked alternative to switch in.
      var phoneDisplay = uslIdentifier;
      var isReturningUser = !!isLogin;
      var greeting = isReturningUser
        ? '<p style="font-size:15px;font-weight:700;margin-bottom:6px">' +
            (es ? 'Bienvenido de vuelta' : 'Welcome back') +
          '</p>'
        : '';
      var bodyCopy = isReturningUser
        ? (es ? 'Verifica tu identidad con el código SMS enviado a ' : 'Verify your identity with the SMS code sent to ')
        : (es ? 'Enviaremos un código SMS a ' : 'We\'ll send an SMS code to ');
      var moreOptionsBtn = (uslLoginViaEmail && uslAccountEmailVerified)
        ? '<div style="margin-top:12px;text-align:center">' +
            '<button onclick="window.__uslShowMoreOptions()" id="usl-more-options-btn" ' +
              'style="background:#f3f4f6;border:none;border-radius:999px;padding:8px 18px;font-size:13px;font-weight:600;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;color:#0a0a0a">' +
              (es ? 'Más opciones' : 'More options') +
            '</button>' +
          '</div>'
        : '';

      setScreen(
        progressDots(2) +
        greeting +
        '<p id="otp-pre-send-msg" style="font-size:14px;color:#666;margin-bottom:16px">' +
          bodyCopy +
          '<strong>' + phoneDisplay + '</strong>' +
        '</p>' +
        errorBox() +
        '<div id="recaptcha-container" style="margin-bottom:8px"></div>' +
        '<button class="btn-primary" onclick="window.__uslSendOTP()" id="send-otp-btn" style="width:100%;justify-content:center;margin-bottom:16px">' +
          (es ? 'Enviar código SMS' : 'Send SMS code') +
        '</button>' +
        '<div id="otp-entry" style="display:none">' +
          '<p id="otp-sent-msg" style="font-size:14px;color:#666;margin-bottom:12px"></p>' +
          otpInputMarkup(es) +
          '<button class="btn-primary" onclick="window.__uslVerifyOTP()" id="verify-otp-btn" style="width:100%;justify-content:center;margin-bottom:8px">' +
            (es ? 'Verificar' : 'Verify') +
          '</button>' +
          '<button onclick="window.__uslResendOTP()" style="background:none;border:none;font-size:13px;color:var(--color-accent-hover, #74b8c4);font-weight:500;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;width:100%;text-align:center">' +
            (es ? 'Reenviar código' : 'Resend code') +
          '</button>' +
        '</div>' +
        moreOptionsBtn +
        (isLogin && !uslLoginViaEmail
          ? '<div style="margin-top:16px;text-align:center"><button onclick="window.__uslStartRecovery()" style="background:none;border:none;font-size:13px;color:#888;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;text-decoration:underline">' + (es ? '¿No tienes acceso a tu teléfono?' : 'Can\'t access your phone?') + '</button></div>'
          : '')
      );
      ensureFirebase().then(setupRecaptchaInner);
    } else {
      // Email — magic link
      var emailGreeting = isLogin
        ? '<p style="font-size:15px;font-weight:700;margin-bottom:6px">' +
            (es ? 'Bienvenido de vuelta' : 'Welcome back') +
          '</p>'
        : '';
      var emailCopy = isLogin
        ? (es ? 'Verifica tu identidad con un enlace enviado a ' : 'Verify your identity with a link sent to ')
        : (es ? 'Te enviaremos un enlace de verificación a ' : 'We\'ll send a verification link to ');
      setScreen(
        progressDots(2) +
        emailGreeting +
        '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
          emailCopy +
          '<strong>' + uslIdentifier + '</strong>' +
        '</p>' +
        '<p style="font-size:12px;color:#8a6d3b;line-height:1.5;margin:-6px 0 16px">' +
          (es
            ? 'Si no ves el correo, revisa tu carpeta de spam o correo no deseado.'
            : 'If you do not see the email, check your spam or junk folder.') +
        '</p>' +
        errorBox() +
        '<button class="btn-primary" onclick="window.__uslSendOTP()" id="send-email-link-btn" style="width:100%;justify-content:center">' +
          (es ? 'Enviar enlace' : 'Send link') +
        '</button>'
      );
    }
  }

  // ── Unified OTP send ─────────────────────────────────────────────────────────
  window.__uslSendOTP = async function () {
    var ok = await ensureFirebase();
    if (!ok) { setError(isEs() ? 'Error al cargar autenticación.' : 'Error loading auth.'); return; }
    setError('');

    if (uslCurrentOTPType === 'phone') {
      var btn = document.getElementById('send-otp-btn');
      setSendOTPButtonLoading(btn, true, isEs());
      try {
        if (!recaptchaVerifier) setupRecaptchaInner();
        confirmationResult = await auth.signInWithPhoneNumber(uslIdentifier, recaptchaVerifier);
        if (btn) btn.style.display = 'none';
        var preSendMsg = document.getElementById('otp-pre-send-msg');
        if (preSendMsg) preSendMsg.style.display = 'none';
        var entry = document.getElementById('otp-entry');
        if (entry) entry.style.display = 'block';
        var sentMsg = document.getElementById('otp-sent-msg');
        if (sentMsg) sentMsg.textContent = (isEs() ? 'Código enviado a ' : 'Code sent to ') + uslIdentifier;
        var otpInput = document.getElementById('auth-otp');
        attachOTPInputHandlers();
        if (otpInput) otpInput.focus();
      } catch (err) {
        setSendOTPButtonLoading(btn, false, isEs());
        if (err.code === 'auth/too-many-requests') {
          setError(isEs() ? 'Demasiados intentos. Espera unos minutos.' : 'Too many attempts. Wait a few minutes.');
        } else {
          setError(firebaseErrorMessage(err.code));
        }
        setupRecaptchaInner();
      }
    } else {
      // Email magic link
      var eBtn = document.getElementById('send-email-link-btn');
      if (eBtn) { eBtn.disabled = true; eBtn.textContent = '...'; }
      try {
        // Normalize email: lowercase for Firebase consistency
        var emailNorm = uslIdentifier.toLowerCase();
        var linkFlow = null;
        if (uslIdentifierType === 'email') {
          linkFlow = await startEmailLinkFlow(emailNorm, uslIsNew ? 'signup_verification' : 'login');
          saveEmailLinkFlow(linkFlow);
        }
        var emailLinkUrl = window.location.origin + '/email-verified.html?email=' + encodeURIComponent(emailNorm);
        if (linkFlow && linkFlow.flow_id) {
          emailLinkUrl += '&flow_id=' + encodeURIComponent(linkFlow.flow_id);
        }
        // Persist USL state so handleEmailLinkSignIn can restore after redirect
        localStorage.setItem('servi_email_link_target', emailNorm);
        localStorage.setItem('servi_usl_state', JSON.stringify({
          identifier: emailNorm,
          identifierType: uslIdentifierType,
          firstIdentifierType: uslFirstIdentifierType,
          isNew: uslIsNew,
          newUserData: uslNewUserData,
        }));
        await auth.sendSignInLinkToEmail(emailNorm, { url: emailLinkUrl, handleCodeInApp: true });
        setScreen(
          '<div style="text-align:center;padding:16px 0">' +
            '<div style="font-size:40px;margin-bottom:12px">📧</div>' +
            '<p style="font-size:15px;font-weight:600;margin-bottom:8px">' + (isEs() ? '¡Enlace enviado!' : 'Link sent!') + '</p>' +
            '<p style="font-size:14px;color:#666;line-height:1.6;margin-bottom:20px">' +
              (isEs()
                ? 'Revisa <strong>' + uslIdentifier + '</strong> y haz clic en el enlace para continuar. Si no lo encuentras, revisa spam o correo no deseado.'
                : 'Verify link sent to <strong>' + uslIdentifier + '</strong>. <strong>Check your spam folder.</strong>') +
            '</p>' +
            '<button id="manual-email-continue-btn" onclick="window.__uslManualEmailContinue && window.__uslManualEmailContinue()" ' +
              'style="background:#0a0a0a;color:#fff;border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:600;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;width:100%">' +
              (isEs() ? 'Ya verifiqué mi correo' : 'I verified my email') +
            '</button>' +
            '<p id="manual-email-hint" style="display:none;font-size:12px;color:#dc2626;line-height:1.5;margin-top:12px"></p>' +
          '</div>'
        );
        // Monitor for email verification completion in other tab
        window.__monitorEmailVerification();
      } catch (err) {
        if (eBtn) { eBtn.disabled = false; eBtn.textContent = isEs() ? 'Enviar enlace' : 'Send link'; }
        setError(firebaseErrorMessage(err.code));
      }
    }
  };

  // ── Phone OTP verify ─────────────────────────────────────────────────────────
  // Only called for phone OTP screens. Email verification is handled via handleEmailLinkSignIn.
  window.__uslVerifyOTP = async function () {
    var code = getOTPCode();
    var es = isEs();
    if (!code || code.length !== PHONE_OTP_CODE_LENGTH) {
      setError(es ? 'Ingresa el código de ' + PHONE_OTP_CODE_LENGTH + ' dígitos.' : 'Enter the ' + PHONE_OTP_CODE_LENGTH + '-digit code.');
      return;
    }

    var btn = document.getElementById('verify-otp-btn');
    setVerifyOTPButtonLoading(btn, true, es);
    setError('');

    try {
      var verifiedCredential = await confirmationResult.confirm(code);
      var verifiedUser = (verifiedCredential && verifiedCredential.user) || (auth && auth.currentUser);

      if (uslIsNew) {
        // Signup: mark phone as verified in flow state, then collect name
        uslNewUserData.phone = uslIdentifier;
        uslNewUserData.phone_verified = true;
        renderNameCollectionScreen();
      } else {
        // Login: await sync then close
        if (!window.__syncPromise && verifiedUser) {
          window.__syncError = null;
          window.__syncPromise = syncWithBackend(verifiedUser);
        }
        if (await resumeIncompleteSignupIfNeeded(verifiedUser, 'phone')) return;
        var syncOk = await awaitSyncAndCheck();
        if (!syncOk) { setVerifyOTPButtonLoading(btn, false, es); return; }
        if (requiresProfileCompletion(window.__user)) {
          startExistingProfileCompletion(window.__user);
          return;
        }
        onAuthSuccess();
      }
    } catch (err) {
      setVerifyOTPButtonLoading(btn, false, es);
      setError(firebaseErrorMessage(err.code));
    }
  };

  window.__uslResendOTP = function () {
    var btn = document.getElementById('send-otp-btn');
    var entry = document.getElementById('otp-entry');
    if (btn) { btn.style.display = 'block'; setSendOTPButtonLoading(btn, false, isEs()); }
    if (entry) entry.style.display = 'none';
    setupRecaptchaInner();
  };

  // ── More options chooser (email-login only) ───────────────────────────────────
  // Lets a user who started login via email switch to a magic-link instead of SMS.
  window.__uslShowMoreOptions = function () {
    if (!uslLoginViaEmail) return;
    var es = isEs();
    var phoneDisplay = uslAccountPhoneLast4 ? '••••••' + uslAccountPhoneLast4 : '';
    setScreen(
      progressDots(2) +
      '<p style="font-size:15px;font-weight:600;margin-bottom:14px">' +
        (es ? 'Elige cómo verificarte' : 'Choose how to verify') +
      '</p>' +
      errorBox() +
      '<button onclick="window.__uslBackToPhoneOTP()" ' +
        'style="width:100%;padding:14px;border:1.5px solid #e0e0e0;border-radius:12px;background:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;margin-bottom:10px;text-align:left">' +
        '<div style="font-weight:600;margin-bottom:2px">' + (es ? 'Código SMS' : 'SMS code') + '</div>' +
        '<div style="font-size:13px;color:#666">' + phoneDisplay + '</div>' +
      '</button>' +
      '<button onclick="window.__uslSwitchToEmailLink()" ' +
        'style="width:100%;padding:14px;border:1.5px solid #e0e0e0;border-radius:12px;background:#fff;font-size:14px;font-weight:500;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;text-align:left">' +
        '<div style="font-weight:600;margin-bottom:2px">' + (es ? 'Enlace por correo' : 'Email link') + '</div>' +
        '<div style="font-size:13px;color:#666">' + escapeHtml(uslTypedEmail) + '</div>' +
      '</button>'
    );
  };

  window.__uslBackToPhoneOTP = function () {
    renderOTPScreen('phone', /* isLogin= */ true);
  };

  window.__uslSwitchToEmailLink = function () {
    // Switch identifier back to the typed email and send a magic link.
    uslIdentifier = uslTypedEmail;
    uslIdentifierType = 'email';
    renderOTPScreen('email', /* isLogin= */ true);
    // Auto-trigger the magic-link send for parity with the SMS flow's one-tap feel.
    setTimeout(function () { if (window.__uslSendOTP) window.__uslSendOTP(); }, 0);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 2b — Name Collection (signup only)
  // ══════════════════════════════════════════════════════════════════════════════
  function renderNameCollectionScreen() {
    var es = isEs();
    var verifiedLabel = uslCurrentOTPType === 'phone'
      ? (es ? '✓ Teléfono verificado' : '✓ Phone verified')
      : (es ? '✓ Correo verificado'   : '✓ Email verified');
    var canStartOver = isSignupFlowLocked();
    var nameParts = String((uslNewUserData && uslNewUserData.name) || '').trim().split(/\s+/);
    var firstNameValue = nameParts.length ? escapeHtml(nameParts.shift()) : '';
    var lastNameValue = nameParts.length ? escapeHtml(nameParts.join(' ')) : '';

    document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Tu nombre' : 'Your name', false, '');
    setScreen(
      progressDots(3) +
      infoBanner(verifiedLabel) +
      errorBox() +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        '<input id="signup-first-name" class="input-field" type="text" value="' + firstNameValue + '" placeholder="' + (es ? 'Nombre' : 'First name') + '" onkeydown="if(event.key===\'Enter\') window.__uslNameNext()" style="flex:1">' +
        '<input id="signup-last-name"  class="input-field" type="text" value="' + lastNameValue + '" placeholder="' + (es ? 'Apellido' : 'Last name') + '" onkeydown="if(event.key===\'Enter\') window.__uslNameNext()" style="flex:1">' +
      '</div>' +
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:20px">' +
        '<input type="checkbox" id="terms-check" style="margin-top:3px;accent-color:var(--color-accent, #95ccd5)">' +
        '<span style="font-size:13px;color:#555;line-height:1.5">' +
          (es
            ? 'Acepto los <a href="/legal.html" target="_blank" style="color:var(--color-accent-hover, #74b8c4);text-decoration:none">Términos de Servicio</a> y la <a href="/legal.html#privacy" target="_blank" style="color:var(--color-accent-hover, #74b8c4);text-decoration:none">Política de Privacidad</a>.'
            : 'I agree to the <a href="/legal.html" target="_blank" style="color:var(--color-accent-hover, #74b8c4);text-decoration:none">Terms of Service</a> and <a href="/legal.html#privacy" target="_blank" style="color:var(--color-accent-hover, #74b8c4);text-decoration:none">Privacy Policy</a>.') +
        '</span>' +
      '</label>' +
      '<button class="btn-primary" onclick="window.__uslNameNext()" id="name-next-btn" style="width:100%;justify-content:center">' +
        (es ? 'Continuar' : 'Continue') +
      '</button>' +
      (canStartOver
        ? '<button type="button" onclick="window.__uslStartOverFromLockedSignup()" id="auth-start-over-btn" style="width:100%;margin-top:10px;padding:12px;border:0;background:transparent;color:#666;font-size:14px;font-weight:500;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif">' +
            (es ? 'Usar otra cuenta' : 'Use another account') +
          '</button>'
        : '')
    );
    var f = document.getElementById('signup-first-name');
    if (f) f.focus();
  }

  window.__uslStartOverFromLockedSignup = async function () {
    var es = isEs();
    var btn = document.getElementById('auth-start-over-btn');
    if (btn) { btn.disabled = true; btn.textContent = es ? 'Saliendo...' : 'Signing out...'; }
    uslSuppressAutoSync = true;
    window.__syncError = null;
    window.__syncPromise = null;
    localStorage.removeItem('servi_user_session');
    try {
      if (auth && auth.currentUser) await auth.signOut();
    } catch (err) {
      console.warn('[SERVI] Could not sign out while restarting signup:', err && err.message);
    }
    resetUslFlowState();
    selectedDial = '+52';
    document.body.style.overflow = 'hidden';
    renderIdentifierScreen();
  };

  window.__uslNameNext = async function () {
    var firstName = (document.getElementById('signup-first-name') || {}).value.trim();
    var lastName  = (document.getElementById('signup-last-name')  || {}).value.trim();
    var termsOk   = (document.getElementById('terms-check')       || {}).checked;
    var es = isEs();

    if (!firstName) { setError(es ? 'Ingresa tu nombre.' : 'Enter your first name.'); return; }
    if (!lastName)  { setError(es ? 'Ingresa tu apellido.' : 'Enter your last name.'); return; }
    if (!termsOk)   { setError(es ? 'Debes aceptar los términos para continuar.' : 'You must accept the terms to continue.'); return; }

    var btn = document.getElementById('name-next-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    uslNewUserData.name = firstName + ' ' + lastName;
    uslNewUserData.terms_accepted = true;

    if (uslCompletingExisting) {
      try {
        var existingToken = getSessionToken();
        if (existingToken) {
          var patchRes = await fetch(API() + '/api/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + existingToken },
            body: JSON.stringify({ name: uslNewUserData.name })
          });
          if (!patchRes.ok) throw new Error('profile_update_failed');
          var patchData = await patchRes.json();
          if (patchData.user) {
            window.__user = patchData.user;
            var existingRaw = localStorage.getItem('servi_user_session');
            if (existingRaw) {
              try {
                var existingSess = JSON.parse(existingRaw);
                existingSess.user = patchData.user;
                localStorage.setItem('servi_user_session', JSON.stringify(existingSess));
              } catch (_) {}
            }
          }
        }
      } catch (_) {
        if (btn) { btn.disabled = false; btn.textContent = es ? 'Continuar' : 'Continue'; }
        setError(es ? 'No pudimos guardar tu nombre. Intenta de nuevo.' : 'We could not save your name. Try again.');
        return;
      }
      if (auth && auth.currentUser && auth.currentUser.phoneNumber) {
        window.__syncError = null;
        window.__syncPromise = syncWithBackend(auth.currentUser);
        await awaitSyncAndCheck();
      }
      onAuthSuccess();
      return;
    }

    // For email-first new users: check resolve-identifier-mismatch
    if (uslIsNew && uslFirstIdentifierType === 'email') {
      await checkIdentifierMismatch();
    } else {
      renderSecondaryIdentifierScreen();
    }
  };

  // ── Cross-identifier mismatch check (email-first new users) ─────────────────
  async function checkIdentifierMismatch() {
    var es = isEs();
    try {
      var firebaseUser = auth && auth.currentUser;
      if (!firebaseUser) { renderSecondaryIdentifierScreen(); return; }
      var idToken = await firebaseUser.getIdToken(true);
      var res = await fetch(API() + '/api/auth/resolve-identifier-mismatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: uslIdentifier, firebase_id_token: idToken })
      });
      if (!res.ok) { renderSecondaryIdentifierScreen(); return; }
      var data = await res.json();
      if (data.resolution === 'link_to_phone') {
        renderCrossIdNameValidation(data.hint);
      } else {
        renderSecondaryIdentifierScreen();
      }
    } catch (_) {
      renderSecondaryIdentifierScreen();
    }
  }

  // ── Cross-identifier: name validation + phone OTP ────────────────────────────
  function renderCrossIdNameValidation(hint) {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Confirma tu identidad' : 'Confirm your identity', false, '');
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px;line-height:1.6">' +
        (es
          ? 'Encontramos una cuenta registrada con este teléfono. Para vincular tu correo, confirma el nombre de la cuenta (empieza con <strong>' + escapeHtml(hint) + '</strong>).'
          : 'We found an account registered with this phone. To link your email, confirm the account name (starts with <strong>' + escapeHtml(hint) + '</strong>).') +
      '</p>' +
      errorBox() +
      '<input id="cross-id-name" class="input-field" type="text" placeholder="' + (es ? 'Nombre completo' : 'Full name') + '" onkeydown="if(event.key===\'Enter\') window.__uslCrossIdNameNext()" style="margin-bottom:12px">' +
      '<button class="btn-primary" onclick="window.__uslCrossIdNameNext()" id="cross-id-name-btn" style="width:100%;justify-content:center">' +
        (es ? 'Confirmar' : 'Confirm') +
      '</button>'
    );
    var el = document.getElementById('cross-id-name');
    if (el) el.focus();
  }

  window.__uslCrossIdNameNext = async function () {
    var name = (document.getElementById('cross-id-name') || {}).value.trim();
    var es = isEs();
    if (!name) { setError(es ? 'Ingresa el nombre de la cuenta.' : 'Enter the account name.'); return; }

    var btn = document.getElementById('cross-id-name-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    // Validate against the account name via a lightweight server check
    // (We use the resolve endpoint again — the server validates name match)
    try {
      var firebaseUser = auth && auth.currentUser;
      var idToken = firebaseUser ? await firebaseUser.getIdToken() : '';
      var res = await fetch(API() + '/api/auth/resolve-identifier-mismatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: uslIdentifier, firebase_id_token: idToken, validate_name: name })
      });
      var data = await res.json();
      if (data.error === 'name_mismatch') {
        if (btn) { btn.disabled = false; btn.textContent = es ? 'Confirmar' : 'Confirm'; }
        setError(es ? 'El nombre no coincide. Intenta de nuevo.' : 'Name does not match. Try again.');
        return;
      }
      if (data.resolution === 'new_account') {
        renderSecondaryIdentifierScreen();
        return;
      }
      // Name validated — now go to phone OTP to prove phone ownership and complete merge
      // Temporarily switch identifier to the existing phone (server returns it after name match)
      if (data.phone) {
        uslIdentifier = data.phone;
        uslIdentifierType = 'phone';
        uslCurrentOTPType = 'phone';
        renderOTPScreen('phone', false);
      } else {
        renderSecondaryIdentifierScreen();
      }
    } catch (_) {
      if (btn) { btn.disabled = false; btn.textContent = es ? 'Confirmar' : 'Confirm'; }
      setError(es ? 'Error de conexión.' : 'Connection error.');
    }
  };

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 2c — Secondary Identifier Collection (optional)
  // Phone-first → collects email.  Email-first → collects phone.
  // ══════════════════════════════════════════════════════════════════════════════
  function renderSecondaryIdentifierScreen() {
    var es = isEs();
    var collectPhone = uslFirstIdentifierType === 'email'; // email-first needs phone; phone-first needs email

    var title = collectPhone
      ? (es ? 'Agrega tu teléfono' : 'Add your phone')
      : (es ? 'Agrega tu correo'   : 'Add your email');

    document.getElementById('auth-modal-global').innerHTML = modalShell(title, false, '');
    setScreen(
      progressDots(4) +
      '<p style="font-size:14px;color:#666;margin-bottom:16px;line-height:1.6">' +
        (es
          ? (collectPhone
              ? 'Necesitas un teléfono verificado para terminar tu registro.'
              : 'Necesitarás un correo verificado para confirmar solicitudes de servicio. Puedes omitirlo por ahora.')
          : (collectPhone
              ? 'You need a verified phone number to finish sign up.'
              : 'You\'ll need a verified email to confirm service requests. You can skip for now.')) +
      '</p>' +
      errorBox() +
      (collectPhone
        ? '<div style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
            countrySelect() +
            '<input id="secondary-phone" type="tel" inputmode="numeric" placeholder="55 1234 5678" style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'Plus Jakarta Sans\',sans-serif;outline:none" onkeydown="if(event.key===\'Enter\') window.__uslSecondaryNext()">' +
          '</div>'
        : '<input id="secondary-email" class="input-field" type="email" placeholder="' + (es ? 'correo@ejemplo.com' : 'email@example.com') + '" style="margin-bottom:12px" onkeydown="if(event.key===\'Enter\') window.__uslSecondaryNext()">') +
      '<button class="btn-primary" onclick="window.__uslSecondaryNext()" style="width:100%;justify-content:center;margin-bottom:10px">' +
        (es ? 'Verificar' : 'Verify') +
      '</button>' +
      (collectPhone
        ? '<button onclick="window.__uslLoginWithSecondaryPhone()" id="secondary-phone-login-btn" style="display:none;background:none;border:none;font-size:13px;color:#666;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;width:100%;text-align:center;padding:8px;text-decoration:underline">' +
            (es ? '¿Este teléfono ya tiene cuenta? Inicia sesión' : 'Phone already has an account? Log in') +
          '</button>'
        : '<button onclick="window.__uslSkipSecondary()" style="background:none;border:none;font-size:13px;color:#888;cursor:pointer;font-family:\'Plus Jakarta Sans\',sans-serif;width:100%;text-align:center;padding:8px;text-decoration:underline">' +
            (es ? 'Omitir por ahora' : 'Skip for now') +
          '</button>')
    );
    var el = document.getElementById(collectPhone ? 'secondary-phone' : 'secondary-email');
    if (el) el.focus();
  }

  window.__uslSecondaryNext = async function () {
    var es = isEs();
    var collectPhone = uslFirstIdentifierType === 'email';

    if (collectPhone) {
      var digits = (document.getElementById('secondary-phone') || {}).value.replace(/\D/g, '');
      if (!digits) { setError(es ? 'Ingresa tu teléfono.' : 'Enter your phone.'); return; }
      var candidatePhone = selectedDial + digits;
      var nextBtn = document.querySelector('button[onclick="window.__uslSecondaryNext()"]');
      var nextBtnLabel = nextBtn ? nextBtn.textContent : '';
      var loginBtn = document.getElementById('secondary-phone-login-btn');
      if (loginBtn) loginBtn.style.display = 'none';
      if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = '...'; }
      setError('');
      try {
        var checkRes = await fetch(API() + '/api/auth/check-phone-available', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: candidatePhone })
        });
        if (checkRes.ok) {
          var checkData = await checkRes.json();
          if (checkData && checkData.available === false) {
            if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = nextBtnLabel || (es ? 'Verificar' : 'Verify'); }
            if (loginBtn) loginBtn.style.display = 'block';
            setError(es
              ? 'Este número ya está registrado con otra cuenta. Inicia sesión o usa otro número.'
              : 'This phone is already registered with another account. Log in or use a different number.');
            return;
          }
        } else {
          console.warn('[SERVI] check-phone-available non-OK:', checkRes.status);
        }
      } catch (err) {
        console.warn('[SERVI] check-phone-available failed:', err && err.message);
      }
      if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = nextBtnLabel || (es ? 'Verificar' : 'Verify'); }
      uslNewUserData.phone = candidatePhone;
      uslIdentifier = uslNewUserData.phone;
      uslIdentifierType = 'phone';
      renderOTPScreen('phone', false);
    } else {
      var email = (document.getElementById('secondary-email') || {}).value.trim();
      if (!email || !email.includes('@')) { setError(es ? 'Ingresa un correo válido.' : 'Enter a valid email.'); return; }
      uslNewUserData.email = email;
      uslIdentifier = email;
      uslIdentifierType = 'email';
      renderOTPScreen('email', false);
    }
  };

  window.__uslLoginWithSecondaryPhone = async function () {
    var es = isEs();
    var rawPhone = ((document.getElementById('secondary-phone') || {}).value || '').trim();
    var candidatePhone = phoneIdentifierFromInput(rawPhone);
    var btn = document.getElementById('secondary-phone-login-btn');
    var btnLabel = btn ? btn.textContent : '';

    if (!rawPhone || candidatePhone.replace(/\D/g, '').length < 8) {
      setError(es ? 'Ingresa el teléfono para iniciar sesión.' : 'Enter the phone number to log in.');
      return;
    }

    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      var res = await fetch(API() + '/api/auth/check-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: candidatePhone })
      });
      var data = await res.json();

      if (!res.ok) throw new Error('check_identifier_failed');
      if (!data.exists) {
        if (btn) { btn.disabled = false; btn.textContent = btnLabel || (es ? '¿Este teléfono ya tiene cuenta? Inicia sesión' : 'Phone already has an account? Log in'); }
        setError(es
          ? 'Este teléfono no tiene cuenta todavía. Usa Verificar para continuar el registro.'
          : 'This phone is not registered yet. Use Verify to continue sign up.');
        return;
      }
      if (data.provider === 'google') {
        if (btn) { btn.disabled = false; btn.textContent = btnLabel || (es ? '¿Este teléfono ya tiene cuenta? Inicia sesión' : 'Phone already has an account? Log in'); }
        setError(es
          ? 'Esta cuenta usa Google. Vuelve al inicio de sesión y continúa con Google.'
          : 'This account uses Google. Return to sign in and continue with Google.');
        return;
      }

      uslIdentifier = candidatePhone;
      uslIdentifierType = 'phone';
      uslFirstIdentifierType = 'phone';
      uslCurrentOTPType = '';
      uslIsNew = false;
      uslSignupComplete = false;
      uslSuppressAutoSync = false;
      uslCompletingExisting = false;
      uslNewUserData = {};
      uslLoginViaEmail = false;
      uslTypedEmail = '';
      uslAccountFirstName = '';
      uslAccountPhoneLast4 = '';
      uslAccountEmailVerified = false;
      renderOTPScreen('phone', /* isLogin= */ true);
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = btnLabel || (es ? '¿Este teléfono ya tiene cuenta? Inicia sesión' : 'Phone already has an account? Log in'); }
      setError(es ? 'Error de conexión. Intenta de nuevo.' : 'Connection error. Try again.');
    }
  };

  window.__uslSkipSecondary = async function () {
    var collectPhone = uslFirstIdentifierType === 'email';
    var btn = document.querySelector('button[onclick="window.__uslSkipSecondary()"]');
    if (collectPhone) {
      setError(isEs() ? 'El teléfono es obligatorio para registrarte.' : 'Phone is required to sign up.');
      return;
    } else {
      localStorage.setItem('servi_email_skipped', '1');
      uslNewUserData.email_skipped = true;
      uslNewUserData.email_verified = false;
    }
    if (btn) { btn.disabled = true; btn.textContent = isEs() ? 'Creando cuenta...' : 'Creating account...'; }
    var ok = await completeSignupSync();
    if (!ok) { if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Omitir por ahora' : 'Skip for now'; } return; }
    onAuthSuccess();
  };

  // ── After secondary OTP verify ───────────────────────────────────────────────
  // When __uslVerifyOTP runs for secondary phone (email-first signup):
  // uslIsNew is true and uslFirstIdentifierType === 'email' so we call syncWithBackend
  // to update phone_verified=true.  Override __uslVerifyOTP calls onAuthSuccess after secondary.
  // We track this by checking uslCurrentOTPType against uslFirstIdentifierType.
  (function patchVerifyForSecondary() {
    var originalVerify = window.__uslVerifyOTP;
    window.__uslVerifyOTP = async function () {
      // If this is the secondary phone OTP in an email-first signup, we want onAuthSuccess after
      var isSecondaryPhoneOTP = ((uslIsNew && uslFirstIdentifierType === 'email') || uslCompletingExisting) && uslCurrentOTPType === 'phone';
      if (isSecondaryPhoneOTP) {
        // Let confirmationResult.confirm run, then mark phone verified and finish
        var code = getOTPCode();
        var es = isEs();
        if (!code || code.length !== PHONE_OTP_CODE_LENGTH) {
          setError(es ? 'Ingresa el código de ' + PHONE_OTP_CODE_LENGTH + ' dígitos.' : 'Enter the ' + PHONE_OTP_CODE_LENGTH + '-digit code.');
          return;
        }
        var btn = document.getElementById('verify-otp-btn');
        // confirmationResult (and its verificationId) is set when the SMS is sent. If it's
        // missing/stale — the user sat on this screen, the send never completed, or Firebase
        // state was reset — recover to the "send code" state with a clear message instead of
        // throwing an opaque TypeError that surfaces as the generic "An error occurred".
        if (!confirmationResult || !confirmationResult.verificationId) {
          setError(es ? 'Tu código expiró. Solicita uno nuevo.' : 'Your code expired. Request a new one.');
          if (typeof window.__uslResendOTP === 'function') window.__uslResendOTP();
          return;
        }
        setVerifyOTPButtonLoading(btn, true, es);
        setError('');
        try {
          // For secondary phone on an email-first/current account, never confirm as
          // a standalone phone sign-in. That creates a second Firebase Auth user.
          var credential = firebase.auth.PhoneAuthProvider.credential(confirmationResult.verificationId, code);
          var fbUser = await waitForCurrentFirebaseUser(3000);
          if (!fbUser) {
            if (uslIsNew && uslFirstIdentifierType === 'email' && emailLinkFlowSignupProof()) {
              var phoneCredential = await confirmationResult.confirm(code);
              fbUser = (phoneCredential && phoneCredential.user) || (auth && auth.currentUser);
            } else {
              var missingUserErr = new Error('missing_firebase_user_for_phone_link');
              missingUserErr.code = 'servi/missing-firebase-user-for-phone-link';
              throw missingUserErr;
            }
          } else {
            try {
              await fbUser.linkWithCredential(credential);
            } catch (linkErr) {
              if (linkErr && linkErr.code === 'auth/provider-already-linked') {
                await fbUser.reload();
                if (auth.currentUser && auth.currentUser.phoneNumber === uslNewUserData.phone) {
                  fbUser = auth.currentUser;
                } else {
                  throw linkErr;
                }
              } else {
                throw linkErr;
              }
            }
          }
          uslNewUserData.phone_verified = true;
          localStorage.removeItem('servi_phone_skipped');
          if (uslIsNew) {
            var created = await completeSignupSync();
            if (!created) {
              setVerifyOTPButtonLoading(btn, false, es);
              return;
            }
          } else {
            // Patch phone + phone_verified on an existing incomplete user record.
            var token = getSessionToken();
            if (!token) throw new Error('missing_session');
            var fbToken = await (auth.currentUser && auth.currentUser.getIdToken(true));
            if (fbToken) {
              var addRes = await fetch(API() + '/api/auth/add-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ phone: uslNewUserData.phone, firebase_id_token: fbToken })
              });
              if (!addRes.ok) throw new Error('phone_update_failed');
              var addData = await addRes.json();
              if (window.__user) {
                window.__user.phone = addData.phone || uslNewUserData.phone;
                window.__user.phone_verified = true;
              }
              var raw = localStorage.getItem('servi_user_session');
              if (raw) {
                try {
                  var sess = JSON.parse(raw);
                  sess.user = Object.assign({}, sess.user, { phone: addData.phone || uslNewUserData.phone, phone_verified: true });
                  localStorage.setItem('servi_user_session', JSON.stringify(sess));
                } catch (_) {}
              }
            }
          }
          onAuthSuccess();
        } catch (err) {
          setVerifyOTPButtonLoading(btn, false, es);
          setError(firebaseErrorMessage(err.code));
        }
        return;
      }
      return originalVerify();
    };
  })();

  // ══════════════════════════════════════════════════════════════════════════════
  // RECOVERY — Can't access phone
  // ══════════════════════════════════════════════════════════════════════════════
  window.__uslStartRecovery = function () {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Recuperar acceso' : 'Recover access', true, 'window.__uslBack');
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px;line-height:1.6">' +
        (es
          ? 'Ingresa el correo asociado a tu cuenta. Te enviaremos un enlace para ingresar y actualizar tu teléfono.'
          : 'Enter the email linked to your account. We\'ll send a sign-in link so you can update your phone.') +
      '</p>' +
      errorBox() +
      '<input class="input-field" id="recovery-email" type="email" placeholder="' + (es ? 'Correo electrónico' : 'Email address') + '" style="margin-bottom:12px">' +
      '<button class="btn-primary" onclick="window.__uslSendRecoveryEmail()" id="recovery-send-btn" style="width:100%;justify-content:center">' +
        (es ? 'Enviar enlace de recuperación' : 'Send recovery link') +
      '</button>'
    );
  };

  window.__uslSendRecoveryEmail = async function () {
    var email = (document.getElementById('recovery-email') || {}).value.trim();
    var es = isEs();
    if (!email || !email.includes('@')) { setError(es ? 'Ingresa un correo válido.' : 'Enter a valid email.'); return; }

    var btn = document.getElementById('recovery-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      var res = await fetch(API() + '/api/auth/check-identifier', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.toLowerCase() })
      });
      var data = await res.json();
      if (!data.exists) {
        if (btn) { btn.disabled = false; btn.textContent = es ? 'Enviar enlace de recuperación' : 'Send recovery link'; }
        setError(es ? 'No encontramos una cuenta con ese correo.' : 'We couldn\'t find an account with that email.');
        return;
      }
      var ok = await ensureFirebase();
      if (!ok) throw new Error('firebase_unavailable');
      await auth.sendSignInLinkToEmail(email.toLowerCase(), { url: window.location.origin + '/email-verified.html', handleCodeInApp: true });
      localStorage.setItem('servi_email_link_target', email.toLowerCase());
      localStorage.setItem('servi_recovery_mode', '1');
      setScreen(
        '<div style="text-align:center;padding:16px 0">' +
          '<div style="font-size:40px;margin-bottom:12px">📧</div>' +
          '<p style="font-size:15px;font-weight:600;margin-bottom:8px">' + (es ? 'Enlace enviado' : 'Link sent') + '</p>' +
          '<p style="font-size:14px;color:#666;line-height:1.6">' +
            (es
              ? 'Revisa tu correo y haz clic en el enlace. Si no lo encuentras, revisa spam o correo no deseado. Después podrás actualizar tu teléfono desde <strong>Mi cuenta</strong>.'
              : 'Check your email and click the link. If you cannot find it, check your spam or junk folder. You can then update your phone from <strong>My account</strong>.') +
          '</p>' +
        '</div>'
      );
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = es ? 'Enviar enlace de recuperación' : 'Send recovery link'; }
      setError(firebaseErrorMessage(err.code));
    }
  };

  // ── Back navigation ──────────────────────────────────────────────────────────
  window.__uslBackToPhoneEntry = function () {
    // Used from the secondary-phone OTP screen when the user wants to correct
    // a wrong phone without losing Google/email signup state.
    uslCurrentOTPType = '';
    try { if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; } } catch (_) {}
    confirmationResult = null;
    uslNewUserData.phone = null;
    uslNewUserData.phone_verified = false;
    uslIdentifier = '';
    renderSecondaryIdentifierScreen();
  };

  window.__uslBack = function () {
    if (isSignupFlowLocked()) {
      setError(isEs()
        ? 'Completa estos pasos para terminar el registro.'
        : 'Complete these steps to finish sign up.');
      return;
    }
    uslNewUserData = {};
    uslCurrentOTPType = '';
    uslSignupComplete = false;
    uslSuppressAutoSync = false;
    uslCompletingExisting = false;
    uslLoginViaEmail = false;
    uslTypedEmail = '';
    uslAccountFirstName = '';
    uslAccountPhoneLast4 = '';
    uslAccountEmailVerified = false;
    renderIdentifierScreen();
  };

  // ── Send email verification (for account page) ─────────────────────────────────
  window.__sendEmailVerification = async function (email) {
    if (!email) return false;
    try {
      var ok = await ensureFirebase();
      if (!ok) return false;
      var user = await waitForCurrentFirebaseUser(1500);
      if (!user) return false;
      var emailNorm = String(email || '').trim().toLowerCase();
      if (!emailNorm || !emailNorm.includes('@')) return false;
      var verificationSettings = {
        url: window.location.origin + '/email-verified.html',
        handleCodeInApp: true
      };
      var currentEmail = String(user.email || '').trim().toLowerCase();
      if (!currentEmail) {
        await auth.sendSignInLinkToEmail(emailNorm, verificationSettings);
      } else if (currentEmail === emailNorm) {
        if (user.emailVerified === true) {
          await syncVerifiedEmailToBackend(emailNorm, { broadcast: true });
          return true;
        }
        if (!user.sendEmailVerification) return false;
        await user.sendEmailVerification(verificationSettings);
      } else {
        if (!user.verifyBeforeUpdateEmail) return false;
        await user.verifyBeforeUpdateEmail(emailNorm, verificationSettings);
      }
      return true;
    } catch (err) {
      console.error('[sendEmailVerification] Error:', err);
      return false;
    }
  };

  function updateStoredSessionAfterEmailSync(data, verifiedEmail, firebaseUid) {
    var emailNorm = String(verifiedEmail || '').trim().toLowerCase();
    var session = null;
    try { session = JSON.parse(localStorage.getItem('servi_user_session') || 'null') || {}; } catch (_) { session = {}; }
    if (data && data.token) session.token = data.token;
    if (data && data.user) {
      session.user = data.user;
    } else {
      session.user = Object.assign({}, session.user || window.__user || {}, {
        email: emailNorm || (session.user && session.user.email) || null,
        email_verified: true,
        email_skipped_at: null
      });
    }
    if (firebaseUid) session.firebaseUid = firebaseUid;
    if (session.token || session.user) {
      localStorage.setItem('servi_user_session', JSON.stringify(session));
      window.__user = Object.assign({}, window.__user || {}, session.user || {});
    }
    return session.user || null;
  }

  async function syncVerifiedEmailToBackend(email, options) {
    var ok = await ensureFirebase();
    if (!ok) return null;
    var emailNorm = String(email || localStorage.getItem('servi_email_link_target') || '').trim().toLowerCase();
    var user = (options && options.user) || await waitForCurrentFirebaseUser(3000);
    if (user) {
      try { await user.reload(); } catch (_) {}
      user = auth.currentUser || user;
    }
    var sessionToken = window.getSessionToken ? window.getSessionToken() : null;
    var lastError = null;

    async function syncWithSessionToken(firebaseIdToken, firebaseUid) {
      if (!sessionToken || !emailNorm) return null;
      var addRes = await fetch(API() + '/api/auth/add-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionToken },
        body: JSON.stringify(Object.assign({ email: emailNorm }, firebaseIdToken ? { firebase_id_token: firebaseIdToken } : {}))
      });
      var addData = await addRes.json().catch(function () { return {}; });
      if (addRes.ok) {
        updateStoredSessionAfterEmailSync(addData, emailNorm, firebaseUid);
        if (options && options.broadcast) window.__broadcastEmailVerified();
        if (window.buildNavbar) window.buildNavbar();
        return addData;
      }
      lastError = addData;
      return null;
    }

    var idToken = null;
    if (user) {
      var firebaseEmail = String(user.email || '').trim().toLowerCase();
      if (!emailNorm) emailNorm = firebaseEmail;
      if (emailNorm && firebaseEmail === emailNorm && user.emailVerified === true) {
        idToken = await user.getIdToken(true);
        var addData = await syncWithSessionToken(idToken, user.uid);
        if (addData) return addData;

        var syncRes = await fetch(API() + '/api/auth/firebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
          body: JSON.stringify({})
        });
        var syncData = await syncRes.json().catch(function () { return {}; });
        if (syncRes.ok) {
          updateStoredSessionAfterEmailSync(syncData, emailNorm, user.uid);
          if (options && options.broadcast) window.__broadcastEmailVerified();
          if (window.buildNavbar) window.buildNavbar();
          return syncData;
        }
        lastError = syncData;
      }
    }

    // If Firebase's hosted action page consumed the code before this custom page
    // loaded, the client may no longer have a current Firebase user. The backend
    // can still verify the stored Firebase UID with Admin Auth.
    var adminVerifiedData = await syncWithSessionToken(null, user && user.uid);
    if (adminVerifiedData) return adminVerifiedData;

    console.warn('[syncVerifiedEmailToBackend] failed:', lastError || 'missing_verified_firebase_user');
    return null;
  }
  window.__syncVerifiedEmailToBackend = syncVerifiedEmailToBackend;

  function waitForCurrentFirebaseUser(timeoutMs) {
    if (auth && auth.currentUser) return Promise.resolve(auth.currentUser);
    return new Promise(function (resolve) {
      var done = false;
      var timer = null;
      var unsubscribe = null;
      var finish = function (user) {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        try { unsubscribe && unsubscribe(); } catch (_) {}
        resolve(user || (auth && auth.currentUser) || null);
      };
      try {
        unsubscribe = auth.onAuthStateChanged(function (user) { finish(user); });
      } catch (_) {
        finish(null);
        return;
      }
      timer = setTimeout(function () { finish(null); }, timeoutMs || 1500);
    });
  }

  async function exchangeEmailLinkForIdToken(email, href) {
    var linkUrl = new URL(href);
    var oobCode = linkUrl.searchParams.get('oobCode');
    if (!oobCode) throw new Error('missing_oob_code');
    var apiKey = (window.CONFIG && window.CONFIG.FIREBASE_CONFIG && window.CONFIG.FIREBASE_CONFIG.apiKey) ||
      linkUrl.searchParams.get('apiKey') ||
      'fake-api-key';
    var base = usingAuthEmulator
      ? 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1'
      : 'https://identitytoolkit.googleapis.com/v1';
    var res = await fetch(base + '/accounts:signInWithEmailLink?key=' + encodeURIComponent(apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: String(email || '').toLowerCase(), oobCode: oobCode })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok || !data.idToken) {
      var err = new Error(data.error && data.error.message ? data.error.message : 'email_link_exchange_failed');
      err.code = 'auth/invalid-action-code';
      throw err;
    }
    return data.idToken;
  }

  // ── Broadcast email verification completion ──────────────────────────────────
  // Broadcast email verification to parent window.
  // Requirements: window.opener must be accessible (same origin or opened by parent).
  // This is a fire-and-forget function (returns undefined).
  // Event dispatch order: localStorage written first (for backup), then custom event dispatched.
  window.__broadcastEmailVerified = function () {
    try {
      localStorage.setItem('servi_email_verified_at', Date.now().toString());
    } catch (_) {
      // localStorage not available (private browsing)
    }
    try {
      window.dispatchEvent(new Event('servi-email-verified'));
    } catch (_) {}
    if (window.opener) {
      try {
        window.opener.dispatchEvent(new Event('servi-email-verified'));
      } catch (_) {
        // Cross-origin or window closed
      }
    }
  };

  // ── Handle email link as success screen (instead of redirecting) ──────────────
  window.__handleEmailLinkAsScreen = function () {
    var es = isEs();
    var title = es ? '¡Verificación exitosa!' : 'Verification Successful!';
    var message = es ? 'Tu correo ha sido verificado.' : 'Your email has been verified.';
    var closeBtnText = es ? 'Cerrar' : 'Close';
    var closingInText = es ? 'Cerrando en' : 'Closing in';

    // WARNING: This function replaces the entire page (clears document.body.innerHTML).
    // Only call on standalone email verification pages, not pages with existing content.
    document.body.innerHTML = '';
    document.body.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100vh';
    document.body.style.display = 'flex';
    document.body.style.alignItems = 'center';
    document.body.style.justifyContent = 'center';
    document.body.style.fontFamily = '"Plus Jakarta Sans", sans-serif';

    // Create card container
    var card = document.createElement('div');
    card.style.background = '#fafafa';
    card.style.borderRadius = '24px';
    card.style.padding = '48px 40px';
    card.style.maxWidth = '400px';
    card.style.width = '90%';
    card.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.3)';
    card.style.textAlign = 'center';

    // Icon (checkmark in circle)
    var icon = document.createElement('div');
    icon.innerHTML = '✓';
    icon.style.fontSize = '56px';
    icon.style.color = 'var(--color-accent, #95ccd5)';
    icon.style.marginBottom = '24px';
    icon.style.fontWeight = 'bold';
    card.appendChild(icon);

    // Title
    var titleEl = document.createElement('h2');
    titleEl.textContent = title;
    titleEl.style.margin = '0 0 12px 0';
    titleEl.style.fontSize = '24px';
    titleEl.style.fontWeight = '700';
    titleEl.style.color = '#0a0a0a';
    titleEl.style.fontFamily = '"Outfit", sans-serif';
    card.appendChild(titleEl);

    // Message
    var messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.margin = '0 0 32px 0';
    messageEl.style.fontSize = '14px';
    messageEl.style.color = '#666';
    messageEl.style.lineHeight = '1.6';
    card.appendChild(messageEl);

    // Countdown (only if opened by parent window)
    var countdownEl = null;
    if (window.opener) {
      countdownEl = document.createElement('p');
      countdownEl.style.margin = '0 0 24px 0';
      countdownEl.style.fontSize = '14px';
      countdownEl.style.color = '#999';
      countdownEl.style.fontStyle = 'italic';
      card.appendChild(countdownEl);

      var COUNTDOWN_SECONDS = 3;
      var secondsLeft = COUNTDOWN_SECONDS;
      var countdownTimeout = null;
      var updateCountdown = function () {
        if (countdownEl) {
          countdownEl.textContent = closingInText + ' ' + secondsLeft + '...';
        }
        if (secondsLeft > 0) {
          secondsLeft--;
          countdownTimeout = setTimeout(updateCountdown, 1000);
        } else {
          if (countdownTimeout) clearTimeout(countdownTimeout);
          window.close();
        }
      };
      updateCountdown();
    }

    // Close button
    var closeBtn = document.createElement('button');
    closeBtn.textContent = closeBtnText;
    closeBtn.style.background = '#0a0a0a';
    closeBtn.style.color = '#fff';
    closeBtn.style.border = 'none';
    closeBtn.style.borderRadius = '12px';
    closeBtn.style.padding = '12px 32px';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.fontWeight = '600';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.transition = 'opacity 0.2s';
    closeBtn.onclick = function () {
      window.close();
    };
    closeBtn.onmouseover = function () {
      closeBtn.style.opacity = '0.8';
    };
    closeBtn.onmouseout = function () {
      closeBtn.style.opacity = '1';
    };
    card.appendChild(closeBtn);

    // Append card to body
    document.body.appendChild(card);

    // Broadcast email verified signal
    window.__broadcastEmailVerified();
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // EMAIL LINK SIGN-IN (handles link clicks on page load)
  // ══════════════════════════════════════════════════════════════════════════════
  //
  // WINDOW OPENING BEHAVIOR:
  // When users click email verification links from Firebase in their email client:
  // 1. Links open in a NEW WINDOW/TAB (standard browser behavior for email links)
  // 2. This new window has window.opener pointing back to the original modal page
  // 3. The new window processes the email link and verifies the user with Firebase
  // 4. After verification, the email link page broadcasts signals via:
  //    - localStorage.setItem('servi_email_verified_at', timestamp) for cross-tab detection
  //    - window.opener.dispatchEvent(new Event('servi-email-verified')) for modal awareness
  // 5. The original modal listens for the 'servi-email-verified' event and auto-closes
  //
  // STATE PRESERVATION:
  // Before redirecting to send the email link, the auth modal saves USL state to localStorage:
  //    - servi_usl_state: user's signup/login info (identifier, type, isNew flag, etc.)
  //    - servi_email_link_target: the email address being verified
  //    - servi_recovery_mode or servi_email_verification_mode: context flags
  // When the email link page loads, it restores this state from localStorage so the
  // signup/login flow resumes seamlessly in the modal after the user returns.
  //
  // This design allows:
  // - Modal stays open in the background while user verifies email
  // - User sees no jarring redirects or page reloads
  // - Modal auto-closes when verification completes (via window.opener event)
  // - Email verification from account page also works (detects servi_email_verification_mode)
  // ══════════════════════════════════════════════════════════════════════════════
  async function handleEmailLinkSignIn() {
    var ok = await ensureFirebase();
    if (!ok) return;
    var initialLinkUrl = new URL(window.location.href);
    var initialMode = initialLinkUrl.searchParams.get('mode');
    var initialOobCode = initialLinkUrl.searchParams.get('oobCode');
    var pendingAccountEmailVerification = localStorage.getItem('servi_email_verification_mode');
    var isAccountActionCode = !!(
      pendingAccountEmailVerification &&
      initialOobCode &&
      (initialMode === 'verifyAndChange' || initialMode === 'verifyAndChangeEmail' || initialMode === 'verifyEmail')
    );
    var isAccountActionFallback = !!(
      pendingAccountEmailVerification &&
      !initialOobCode &&
      /\/email-verified\.html$/.test(window.location.pathname)
    );
    if (!auth.isSignInWithEmailLink(window.location.href) && !isAccountActionCode && !isAccountActionFallback) return;

    // Retrieve the email address from localStorage (same browser) or from the
    // link context (different browser/device). Do not prompt: clicking the link
    // should be the only confirmation step.
    var email = localStorage.getItem('servi_email_link_target') || getEmailLinkTargetFromUrl();
    if (!email) {
      window.__emailLinkProcessingStatus = 'missing-email';
      return;
    }

    // Restore USL state from before the redirect
    var savedState = null;
    try { savedState = JSON.parse(localStorage.getItem('servi_usl_state') || 'null'); } catch (_) {}
    if (savedState) {
      uslIdentifier = savedState.identifier || email;
      uslIdentifierType = savedState.identifierType || 'email';
      uslFirstIdentifierType = savedState.firstIdentifierType || 'email';
      uslIsNew = !!savedState.isNew;
      uslNewUserData = savedState.newUserData || {};
    }
    localStorage.removeItem('servi_usl_state');

    var isRecovery = localStorage.getItem('servi_recovery_mode');
    localStorage.removeItem('servi_recovery_mode');

    var isEmailVerification = localStorage.getItem('servi_email_verification_mode');

    try {
      var linkUrl = new URL(window.location.href);
      var mode = linkUrl.searchParams.get('mode');
      var oobCode = linkUrl.searchParams.get('oobCode');
      if (isEmailVerification && !oobCode && isAccountActionFallback) {
        var fallbackSyncData = await syncVerifiedEmailToBackend(email);
        if (!fallbackSyncData) return;
        localStorage.removeItem('servi_email_verification_mode');
        localStorage.removeItem('servi_email_link_target');
        window.__broadcastEmailVerified();
        window.__emailLinkProcessingStatus = 'account-email-verified';
        return;
      }
      if (isEmailVerification && oobCode && (mode === 'verifyAndChange' || mode === 'verifyAndChangeEmail' || mode === 'verifyEmail')) {
        await auth.applyActionCode(oobCode);
        var accountActionData = await syncVerifiedEmailToBackend(email);
        if (!accountActionData) throw new Error('account_email_sync_failed');
        localStorage.removeItem('servi_email_link_target');
        localStorage.removeItem('servi_email_verification_mode');
        window.history.replaceState({}, document.title, window.location.pathname);
        window.__broadcastEmailVerified();
        if (window.buildNavbar) window.buildNavbar();
        window.__emailLinkProcessingStatus = 'account-email-verified';
        // Do NOT redirect this tab. The original account.html tab refreshes itself
        // via the broadcast (storage / servi-email-verified listeners), so we leave
        // this verification tab on its success screen for the user to close.
        return;
      }

      if (isEmailVerification) {
        var accountVerifyToken = getSessionToken();
        var accountEmailToken = null;
        var accountLinkUser = await waitForCurrentFirebaseUser(1500);
        if (accountLinkUser) {
          var accountCredential = firebase.auth.EmailAuthProvider.credentialWithLink(email, window.location.href);
          await accountLinkUser.linkWithCredential(accountCredential);
          accountLinkUser = auth.currentUser || accountLinkUser;
          await accountLinkUser.reload();
          accountEmailToken = await (auth.currentUser || accountLinkUser).getIdToken(true);
        } else {
          accountEmailToken = await exchangeEmailLinkForIdToken(email, window.location.href);
        }
        localStorage.removeItem('servi_email_link_target');
        window.history.replaceState({}, document.title, window.location.pathname);

        if (!accountVerifyToken || !accountEmailToken) throw new Error('missing_account_email_proof');
        var accountVerifyRes = await fetch(API() + '/api/auth/add-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + accountVerifyToken },
          body: JSON.stringify({ email: email, firebase_id_token: accountEmailToken })
        });
        var accountVerifyData = await accountVerifyRes.json().catch(function () { return {}; });
        if (!accountVerifyRes.ok) {
          throw new Error(accountVerifyData.error || 'account_email_sync_failed');
        }
        localStorage.removeItem('servi_email_verification_mode');
        updateStoredSessionAfterEmailSync(accountVerifyData, email, (auth.currentUser || accountLinkUser || {}).uid);

        if (window.__user) {
          window.__user.email = accountVerifyData.email || email;
          window.__user.email_verified = true;
          window.__user.email_skipped_at = null;
        }
        var accountRaw = localStorage.getItem('servi_user_session');
        if (accountRaw) {
          try {
            var accountSess = JSON.parse(accountRaw);
            if (accountSess.user) {
              accountSess.user.email = accountVerifyData.email || email;
              accountSess.user.email_verified = true;
              accountSess.user.email_skipped_at = null;
            }
            localStorage.setItem('servi_user_session', JSON.stringify(accountSess));
          } catch (_) {}
        }
        window.__broadcastEmailVerified();
        if (window.buildNavbar) window.buildNavbar();
        window.__emailLinkProcessingStatus = 'account-email-verified';
        // Do NOT redirect this tab — the original account.html tab refreshes via the
        // broadcast. Fall through to the success screen so the user can close this tab.
        return;
      }

      // Give Firebase persistence a moment to restore the existing user before
      // deciding whether to link the email credential or sign in fresh.
      if (!auth.currentUser) {
        await new Promise(function (resolve) {
          var done = false;
          var finish = function () {
            if (done) return;
            done = true;
            try { unsubscribe && unsubscribe(); } catch (_) {}
            resolve();
          };
          var unsubscribe = auth.onAuthStateChanged(function () { finish(); });
          setTimeout(finish, 1500);
        });
      }
      // Account email changes verify a new address for the existing SERVI
      // session. Keep the Firebase user aligned before sending the proof token
      // to the backend; otherwise a stale Firebase email can never verify the
      // newly saved DB email.
      if (auth.currentUser && auth.currentUser.phoneNumber) {
        // If already signed in with phone, link email rather than sign in fresh
        var credential = firebase.auth.EmailAuthProvider.credentialWithLink(email, window.location.href);
        await auth.currentUser.linkWithCredential(credential);
      } else {
        await auth.signInWithEmailLink(email, window.location.href);
      }
      try { await completeEmailLinkFlowIfPresent(); } catch (_) {}

      // Clear the email link target from localStorage to prevent re-verification on subsequent page loads.
      // Also clean up the browser history so the URL no longer shows the verification code.
      localStorage.removeItem('servi_email_link_target');
      window.history.replaceState({}, document.title, window.location.pathname);

      if (isRecovery) {
        // Wait for sync, then broadcast so the original tab continues on its own.
        // Do NOT redirect this verification tab — let it stay on its success screen
        // so the user can close it and return to where they started.
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        window.__broadcastEmailVerified();
        return;
      }

      if (uslIsNew && uslFirstIdentifierType === 'email') {
        // Email-first new signup: mark email verified and show success screen
        uslNewUserData.email = email;
        uslNewUserData.email_verified = true;
        // Broadcast to any listening modal that email was verified
        window.__broadcastEmailVerified();
        // Show success screen instead of trying to reopen modal on this page
        window.__handleEmailLinkAsScreen();
        return;
      } else if (uslIsNew && uslFirstIdentifierType === 'phone') {
        // ══════════════════════════════════════════════════════════════════════════════
        // PHONE-FIRST SECONDARY EMAIL VERIFICATION
        // ══════════════════════════════════════════════════════════════════════════════
        //
        // Context: Phone-first signup flow is:
        //   1. Phone OTP verification → phone_verified = true, account created
        //   2. Name collection (required)
        //   3. Email offer (optional: "skip" or "add email")
        //   4. If email provided → email verification link sent
        //   5. User clicks link → THIS CODE BLOCK EXECUTES
        //
        // Why this is different from email-first:
        // - Email-first: email is PRIMARY identifier, verification is part of signup flow
        //   → shows success screen, tries to resume modal (user is still in modal.html)
        // - Phone-first: email is SECONDARY (phone already verified account)
        //   → just mark email verified on existing account, close cleanly
        //   → user is NOT in modal anymore (already signed up)
        //   → no need for modal resumption or success screen
        //
        // Behavior: Mark email verified in session + sync with backend via API call
        // ──────────────────────────────────────────────────────────────────────────────

        uslNewUserData.email = email;
        uslNewUserData.email_verified = true;

        var created = await completeSignupSync();
        if (!created) return;
        localStorage.removeItem('servi_email_skipped');

        // Close the link-processing flow cleanly (normal redirect, no modal resumption)
        // User will be returned to home or account page depending on where link was clicked
        onAuthSuccess();
      } else {
        // Email login for existing user
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        // Ghost user: Firebase email is verified but no auth_users row exists.
        // Broadcast so any opener tab can route into the resume-signup flow via
        // its onAuthStateChanged auto-resume; don't call onAuthSuccess (which
        // would falsely close a modal the user still needs).
        if (window.__syncError && window.__syncError.code === 'signup_incomplete') {
          if (window.__broadcastEmailVerified) window.__broadcastEmailVerified();
          return;
        }
        if (requiresProfileCompletion(window.__user)) {
          startExistingProfileCompletion(window.__user);
          return;
        }
        onAuthSuccess();
      }
    } catch (err) {
      console.error('[SERVI] Email link sign-in failed:', err);
      window.__emailLinkProcessingStatus = 'error';
      if (err.code === 'auth/invalid-action-code') {
        var es = isEs();
        document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Enlace inválido' : 'Invalid link', false, '');
        document.body.style.overflow = 'hidden';
        renderOTPScreen('email', false);
        setTimeout(function () {
          setError(es
            ? 'Este enlace ya fue usado o expiró. Solicita uno nuevo.'
            : 'This link was already used or has expired. Request a new one.');
        }, 50);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // GOOGLE AUTH
  // ══════════════════════════════════════════════════════════════════════════════
  window.handleGoogleAuth = async function () {
    var ok = await ensureFirebase();
    if (!ok) { setError(isEs() ? 'Error al cargar autenticación. Recarga la página.' : 'Error loading auth. Refresh the page.'); return; }
    var btn = document.getElementById('google-auth-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      uslSuppressAutoSync = true;
      uslFirstIdentifierType = 'email'; // Google gives email
      var googleResult = await auth.signInWithPopup(provider);
      var googleUser = googleResult.user || auth.currentUser;
      var googleEmail = googleUser && googleUser.email ? googleUser.email.toLowerCase() : '';
      uslIdentifier = googleEmail;
      uslIdentifierType = 'email';
      uslCurrentOTPType = 'email';
      uslIsNew = false;
      uslSignupComplete = false;
      uslNewUserData = {
        email: googleEmail,
        email_verified: true,
        name: googleUser.displayName || '',
      };
      window.__user = { id: googleUser.uid, email: googleUser.email, name: googleUser.displayName, phone: googleUser.phoneNumber };
      window.__syncError = null;
      window.__syncPromise = syncWithBackend(googleUser);
      if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
      if (await resumeIncompleteSignupIfNeeded(googleUser, 'email')) {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        return;
      }
      var syncOk = await awaitSyncAndCheck();
      if (!syncOk) { if (btn) { btn.disabled = false; btn.style.opacity = ''; } return; }
      uslSuppressAutoSync = false;
      if (requiresProfileCompletion(window.__user)) {
        startExistingProfileCompletion(window.__user);
        return;
      }
      onAuthSuccess();
    } catch (err) {
      uslSuppressAutoSync = false;
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      console.error('[SERVI] Google auth error:', err);
      setError(firebaseErrorMessage(err.code));
    }
  };

  // ── reCAPTCHA ────────────────────────────────────────────────────────────────
  function setupRecaptchaInner() {
    if (!firebaseReady || !auth) return;
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} recaptchaVerifier = null; }
    var container = document.getElementById('recaptcha-container');
    if (!container) return;
    container.innerHTML = '<div id="recaptcha-widget"></div>';
    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-widget', {
        size: 'invisible',
        callback: function () {
          if (!usingAuthEmulator) console.log('[SERVI] reCAPTCHA solved');
        },
      });
    } catch (e) { console.warn('[SERVI] RecaptchaVerifier error:', e); }
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  // Revoke server-side, sign out of Firebase, and clear all auth-related localStorage.
  // The backend revoke is best-effort and runs in parallel with the redirect — even if
  // the network call fails, the local session is still cleared.
  window.logoutUser = async function () {
    var sess = null;
    try { sess = JSON.parse(localStorage.getItem('servi_user_session') || 'null'); } catch (_) {}

    // Fire-and-forget server revocation (don't block UX on it)
    if (sess && sess.token) {
      try {
        fetch(API() + '/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + sess.token },
          keepalive: true
        }).catch(function () {});
      } catch (_) {}
    }

    window.__user = null;
    window.__syncPromise = null;
    // Clear every auth-related localStorage key (audit A11 — prevent stale flags)
    try {
      localStorage.removeItem('servi_user_session');
      localStorage.removeItem('servi_email_verified_at');
      localStorage.removeItem('servi_email_link_target');
      localStorage.removeItem('servi_email_verification_mode');
      localStorage.removeItem('servi_usl_state');
      localStorage.removeItem('servi_recovery_mode');
      localStorage.removeItem('servi_phone_skipped');
      localStorage.removeItem('servi_email_skipped');
    } catch (_) {}

    if (auth) {
      try { await auth.signOut(); } catch (e) {}
    } else {
      localStorage.setItem('servi_pending_logout', '1');
    }
    var path = window.location.pathname;
    var isHome = (path === '/' || path === '/index.html');
    if (isHome) {
      if (window.buildNavbar) window.buildNavbar();
    } else {
      window.location.href = '/';
    }
  };

  window.updateNavForAuth = function () {
    if (window.buildNavbar) window.buildNavbar();
  };

  // ── Firebase error messages ──────────────────────────────────────────────────
  function firebaseErrorMessage(code) {
    var es = isEs();
    var map = {
      'auth/too-many-requests':         es ? 'Demasiados intentos. Intenta más tarde.'       : 'Too many attempts. Try again later.',
      'auth/invalid-phone-number':      es ? 'Número de teléfono inválido.'                  : 'Invalid phone number.',
      'auth/invalid-verification-code': es ? 'Código incorrecto.'                            : 'Incorrect code.',
      'auth/code-expired':              es ? 'El código expiró. Solicita uno nuevo.'          : 'Code expired. Request a new one.',
      'auth/captcha-check-failed':      es ? 'Error de verificación. Recarga la página.'     : 'Verification error. Reload the page.',
      'auth/invalid-app-credential':    es ? 'Error de verificación local. Recarga la página e intenta de nuevo.' : 'Local verification error. Reload and try again.',
      'auth/missing-app-credential':    es ? 'Error de verificación local. Recarga la página e intenta de nuevo.' : 'Local verification error. Reload and try again.',
      'auth/popup-blocked':             es ? 'El popup fue bloqueado. Permite popups.'        : 'Popup was blocked. Allow popups.',
      'auth/network-request-failed':    es ? 'Error de conexión. Verifica tu internet.'      : 'Connection error. Check your internet.',
      'auth/invalid-action-code':       es ? 'El enlace expiró o ya fue usado.'              : 'The link has expired or already been used.',
      'auth/credential-already-in-use': es ? 'Este identificador ya está asociado a otra cuenta.' : 'This identifier is already linked to another account.',
      'auth/account-exists-with-different-credential': es ? 'Ya existe una cuenta con este correo. Inicia sesión con tu método original.' : 'An account already exists with this email. Sign in with your original method.',
      'auth/email-already-in-use':      es ? 'Este correo ya está registrado.'                   : 'This email is already registered.',
      'auth/invalid-email':             es ? 'Correo electrónico inválido.'                      : 'Invalid email address.',
      'auth/user-disabled':             es ? 'Esta cuenta fue deshabilitada. Contáctanos.'       : 'This account has been disabled. Please contact us.',
      'auth/operation-not-allowed':     es ? 'Este método de acceso no está disponible por ahora.' : 'This sign-in method is not available right now.',
      'auth/requires-recent-login':     es ? 'Por seguridad, vuelve a iniciar sesión e intenta de nuevo.' : 'For your security, sign in again and retry.',
      'servi/missing-firebase-user-for-phone-link': es ? 'Tu sesión expiró. Inicia sesión de nuevo antes de agregar el teléfono.' : 'Your session expired. Sign in again before adding your phone.',
    };
    return map[code] || (es ? 'Ocurrió un error. Intenta de nuevo.' : 'An error occurred. Please try again.');
  }

  // ── Session token helper ──────────────────────────────────────────────────────
  window.getSessionToken = function () {
    try {
      var raw = localStorage.getItem('servi_user_session');
      return raw ? (JSON.parse(raw).token || null) : null;
    } catch (e) { return null; }
  };

  // ── Open / close modal ────────────────────────────────────────────────────────
  window.openAuthModal = function () {
    if (openAuthModal._skipReset) { openAuthModal._skipReset = false; return; }
    uslIdentifier = '';
    uslIdentifierType = '';
    uslFirstIdentifierType = '';
    uslCurrentOTPType = '';
    uslIsNew = false;
    uslSignupComplete = false;
    uslSuppressAutoSync = false;
    uslCompletingExisting = false;
    uslNewUserData = {};
    selectedDial = '+52';
    renderIdentifierScreen();
  };

  window.closeAuthModal = function (force) {
    if (!force && isSignupFlowLocked()) {
      setError(isEs()
        ? 'Completa estos pasos para terminar el registro.'
        : 'Complete these steps to finish sign up.');
      return;
    }
    document.getElementById('auth-modal-global').innerHTML = '';
    document.body.style.overflow = '';
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} recaptchaVerifier = null; }
    confirmationResult = null;
  };

  // Close the auth modal on Escape (reuses __authCloseClick, which respects the signup lock).
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var modal = document.getElementById('auth-modal-global');
    if (modal && modal.innerHTML.trim() !== '') window.__authCloseClick();
  });

  // ── Session expiry toast ──────────────────────────────────────────────────────
  function showSessionExpiredToast() {
    if (document.getElementById('servi-session-toast')) return;
    var es = isEs();
    var toast = document.createElement('div');
    toast.id = 'servi-session-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:12px;font-family:"Plus Jakarta Sans",sans-serif;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px;max-width:90%;animation:fadeInDown 0.3s ease';
    toast.innerHTML = '<span>' + (es ? 'Tu sesión expiró. Inicia sesión de nuevo.' : 'Your session expired. Please sign in again.') + '</span>' +
      '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;padding:0 4px">&times;</button>';
    document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentElement) toast.remove(); }, 6000);
  }

  // ── Service-request submit helpers (shared across pages) ─────────────────────
  // Used by service.html and the Smart Request flow (frontend/smart-request/sr-app.js).
  // These previously lived inside index.html's page script; they now live here so every
  // page that loads shared-auth.js gets authenticated submit + the email gate.

  // Headers for authenticated JSON POSTs — attaches the session Bearer token if present.
  window.__serviJsonAuthHeaders = function () {
    const headers = { 'Content-Type': 'application/json' };
    try {
      const session = JSON.parse(localStorage.getItem('servi_user_session') || 'null');
      if (session && session.token) headers.Authorization = 'Bearer ' + session.token;
    } catch (_) {}
    return headers;
  };

  // Bilingual message for a service-request error code (or a fallback).
  window.__serviceRequestErrorMessage = function (error, fallback) {
    const es = isEs();
    if (error === 'email_required') {
      return es
        ? 'Verifica tu correo electrónico para confirmar tu solicitud.'
        : 'Verify your email to confirm your request.';
    }
    if (error === 'phone_required') {
      return es
        ? 'Verifica tu número de teléfono para confirmar tu solicitud.'
        : 'Verify your phone number to confirm your request.';
    }
    return fallback || (es ? 'Error al enviar. Inténtalo de nuevo.' : 'Submission error. Please try again.');
  };

  function bookingGateEscapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  // Inline "verify your email to continue" gate. Appends into opts.target and, once the
  // email is verified (via storage / servi-email-verified events), calls opts.retry.
  window.__showServiceRequestEmailGate = function (options) {
    const opts = options || {};
    const es = isEs();
    const target = opts.target || document.getElementById('sr-root');
    if (!target) return false;

    document.querySelectorAll('.booking-email-gate').forEach((node) => {
      if (node._cleanup) node._cleanup();
      node.remove();
    });

    const currentEmail = String((window.__user && window.__user.email) || '').trim().toLowerCase();
    const gate = document.createElement('div');
    gate.className = 'booking-email-gate';
    gate.style.cssText = 'border:1px solid #ead8b7;background:#fff8ec;border-radius:10px;padding:14px;margin:12px 0;display:flex;flex-direction:column;gap:10px;color:#4a3421';
    gate.innerHTML = `
      <div style="font-weight:800;font-size:14px">${es ? 'Verifica tu correo para continuar' : 'Verify your email to continue'}</div>
      <div style="font-size:13px;line-height:1.45">${es ? 'Ya usaste tu primera solicitud sin correo verificado. Te enviaremos un enlace de verificación y continuaremos la solicitud cuando se confirme.' : 'You already used your first request without a verified email. We will send a verification link and continue the request after it is confirmed.'}</div>
      ${currentEmail ? `<div style="font-size:13px;font-weight:700">${bookingGateEscapeHtml(currentEmail)}</div>` : `<input class="input-field" id="booking-email-gate-input" type="email" placeholder="${es ? 'correo@email.com' : 'email@example.com'}" style="background:#fff">`}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button type="button" class="btn-accent" id="booking-email-gate-send">${es ? 'Enviar verificación' : 'Send verification'}</button>
        <span id="booking-email-gate-status" style="font-size:12px;color:#6f5742"></span>
      </div>
    `;

    const appendTarget = opts.target || target;
    appendTarget.appendChild(gate);
    try { gate.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}

    const statusEl = gate.querySelector('#booking-email-gate-status');
    const sendBtn = gate.querySelector('#booking-email-gate-send');
    const input = gate.querySelector('#booking-email-gate-input');
    let cleaned = false;

    async function refreshAuthUser() {
      const API = (window.CONFIG && window.CONFIG.API_BASE) || '';
      let session = null;
      try { session = JSON.parse(localStorage.getItem('servi_user_session') || 'null'); } catch (_) {}
      const token = session && session.token;
      if (!token) return null;
      const res = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      if (!data.user) return null;
      window.__user = data.user;
      try {
        session.user = data.user;
        localStorage.setItem('servi_user_session', JSON.stringify(session));
      } catch (_) {}
      return data.user;
    }

    async function retryIfVerified() {
      const user = await refreshAuthUser();
      if (!user || user.email_verified !== true) return;
      cleanup();
      gate.remove();
      if (typeof opts.retry === 'function') setTimeout(opts.retry, 50);
    }

    function onStorage(e) {
      if (e.key === 'servi_email_verified_at') retryIfVerified();
    }

    function onVerified() {
      retryIfVerified();
    }

    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('servi-email-verified', onVerified);
    }

    gate._cleanup = cleanup;
    window.addEventListener('storage', onStorage);
    window.addEventListener('servi-email-verified', onVerified);

    sendBtn.addEventListener('click', async () => {
      const email = currentEmail || String((input && input.value) || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (statusEl) statusEl.textContent = es ? 'Ingresa un correo válido.' : 'Enter a valid email.';
        if (input) input.focus();
        return;
      }
      if (!window.__sendEmailVerification) {
        if (statusEl) statusEl.textContent = es ? 'No se pudo iniciar la verificación.' : 'Could not start verification.';
        return;
      }
      try {
        sendBtn.disabled = true;
        if (statusEl) statusEl.textContent = es ? 'Enviando...' : 'Sending...';
        localStorage.setItem('servi_email_verification_mode', '1');
        localStorage.setItem('servi_email_link_target', email);
        const sent = await window.__sendEmailVerification(email);
        if (!sent) {
          localStorage.removeItem('servi_email_verification_mode');
          localStorage.removeItem('servi_email_link_target');
          sendBtn.disabled = false;
          if (statusEl) statusEl.textContent = es ? 'No se pudo enviar. Intenta de nuevo.' : 'Could not send. Try again.';
          return;
        }
        if (statusEl) statusEl.textContent = es ? 'Revisa tu correo. Continuaremos cuando se verifique.' : 'Check your email. We will continue after verification.';
      } catch (_) {
        localStorage.removeItem('servi_email_verification_mode');
        localStorage.removeItem('servi_email_link_target');
        sendBtn.disabled = false;
        if (statusEl) statusEl.textContent = es ? 'No se pudo enviar. Intenta de nuevo.' : 'Could not send. Try again.';
      }
    });

    return true;
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  // Expose handleEmailLinkSignIn's promise so email-verified.html can await it
  // before showing success UI, ensuring the broadcast fires before user closes the tab.
  var _emailLinkSignInResolve;
  window.__emailLinkProcessingPromise = new Promise(function (resolve) { _emailLinkSignInResolve = resolve; });
  ensureFirebase().then(function () {
    handleEmailLinkSignIn().then(_emailLinkSignInResolve, _emailLinkSignInResolve);
    if (window.__sessionExpired) {
      window.__sessionExpired = false;
      setTimeout(function () { if (!window.__user) showSessionExpiredToast(); }, 2500);
    }
  });

})();
