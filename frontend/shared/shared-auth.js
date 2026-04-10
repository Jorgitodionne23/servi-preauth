// ─── SERVI Shared Auth (Firebase) ────────────────────────────────────────────
// Unified Sign-in/Login (USL) flow:
//   1. User enters Phone or Email identifier
//   2. Backend checks if it exists → signup or login branch
//   Signup: collect missing counterpart → terms acceptance → OTP/verify
//   Login:  OTP (phone) or email link; Google always available
//   Recovery: user can't access phone → email OTP → update phone
// Include AFTER i18n.js and BEFORE shared-nav.js.

(function () {
  const FIREBASE_VERSION = '10.12.0';
  const CDN_BASE = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION;

  // State
  let auth = null;
  let recaptchaVerifier = null;
  let confirmationResult = null;
  let firebaseReady = false;

  // USL flow state
  let uslIdentifier = '';    // raw value user typed
  let uslIdentifierType = ''; // 'phone' | 'email'
  let uslIsNew = false;       // true = signup, false = login
  let uslNewUserData = {};    // accumulates {phone, email, name} for new user

  const COUNTRIES = [
    { code: 'MX', dial: '+52', flag: '🇲🇽', label: 'MX +52' },
    { code: 'US', dial: '+1',  flag: '🇺🇸', label: 'US +1'  },
    { code: 'CA', dial: '+1',  flag: '🇨🇦', label: 'CA +1'  },
    { code: 'CO', dial: '+57', flag: '🇨🇴', label: 'CO +57' },
    { code: 'AR', dial: '+54', flag: '🇦🇷', label: 'AR +54' },
    { code: 'BR', dial: '+55', flag: '🇧🇷', label: 'BR +55' },
    { code: 'CL', dial: '+56', flag: '🇨🇱', label: 'CL +56' },
    { code: 'PE', dial: '+51', flag: '🇵🇪', label: 'PE +51' },
    { code: 'ES', dial: '+34', flag: '🇪🇸', label: 'ES +34' },
  ];
  let selectedDial = '+52';

  const icons = {
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>',
  };

  function tr() { return (window.__t || {}).auth || {}; }
  function lang() { return window.__lang || 'es'; }
  function isEs() { return lang() === 'es'; }
  function API() { return ((window.CONFIG && window.CONFIG.API_BASE) || '').replace(/\/+$/, ''); }

  // ─── Inject auth-modal container ───────────────────────────────────────────
  if (!document.getElementById('auth-modal-global')) {
    const div = document.createElement('div');
    div.id = 'auth-modal-global';
    document.body.appendChild(div);
  }

  // ─── Firebase SDK (dynamic load) ──────────────────────────────────────────
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureFirebase() {
    if (firebaseReady) return true;
    try {
      await loadScript(CDN_BASE + '/firebase-app-compat.js');
      await loadScript(CDN_BASE + '/firebase-auth-compat.js');
      var config = window.CONFIG && window.CONFIG.FIREBASE_CONFIG;
      if (!config) { console.warn('[SERVI] No Firebase config found'); return false; }
      if (!firebase.apps.length) firebase.initializeApp(config);
      auth = firebase.auth();
      auth.languageCode = lang();
      firebaseReady = true;

      // Complete any pending logout from a previous page where Firebase wasn't loaded
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

  // ─── Auth state listener ──────────────────────────────────────────────────
  // onAuthStateChanged sets a temporary window.__user for navbar display but
  // does NOT persist to localStorage until syncWithBackend succeeds with a JWT.
  // Callers (OTP verify, Google auth) must await window.__syncPromise before
  // calling onAuthSuccess to ensure the backend token is stored.
  function onAuthStateChanged(firebaseUser) {
    if (firebaseUser) {
      // Temporary user for navbar — not persisted yet
      window.__user = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        phone: firebaseUser.phoneNumber,
      };
      window.__syncError = null;
      window.__syncPromise = syncWithBackend(firebaseUser);
    } else {
      // Signed out — if a pending logout flag exists, don't re-trigger
      if (localStorage.getItem('servi_pending_logout')) {
        localStorage.removeItem('servi_pending_logout');
      }
      window.__user = null;
      localStorage.removeItem('servi_user_session');
      window.__syncError = null;
      window.__syncPromise = null;
    }
    if (window.buildNavbar) window.buildNavbar();
  }

  async function syncWithBackend(firebaseUser) {
    try {
      var idToken = await firebaseUser.getIdToken();
      var res = await fetch(API() + '/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ name: firebaseUser.displayName, phone: firebaseUser.phoneNumber, email: firebaseUser.email || (uslNewUserData && uslNewUserData.email) || null })
      });
      if (res.ok) {
        var data = await res.json();
        if (data.user && data.token) {
          window.__user = Object.assign({}, window.__user, data.user);
          localStorage.setItem('servi_user_session', JSON.stringify({
            token: data.token,
            user: window.__user,
            firebaseUid: firebaseUser.uid,
          }));
          if (window.buildNavbar) window.buildNavbar();
        } else {
          window.__syncError = { code: 'backend_sync_failed', status: 200 };
          console.error('[SERVI] Backend sync: missing token or user in response');
        }
      } else {
        var errData = {};
        try { errData = await res.json(); } catch (_) {}
        if (res.status === 409 && errData.error === 'phone_exists') {
          window.__syncError = { code: 'phone_exists', message: errData.message };
        } else {
          window.__syncError = { code: 'backend_sync_failed', status: res.status, message: errData.message };
        }
        console.error('[SERVI] Backend sync failed:', res.status, errData);
      }
    } catch (err) {
      window.__syncError = { code: 'network_error', message: err.message };
      console.error('[SERVI] Backend sync error:', err.message);
    }
  }

  // Helper: await backend sync, check for errors, handle failure
  // Returns true if sync succeeded, false if it failed (and shows error + signs out)
  async function awaitSyncAndCheck() {
    if (window.__syncPromise) {
      try { await window.__syncPromise; } catch (_) {}
    }
    if (window.__syncError) {
      var es = isEs();
      var errMsg;
      if (window.__syncError.code === 'phone_exists') {
        errMsg = window.__syncError.message || (es ? 'Este número ya está registrado con otra cuenta.' : 'This phone is already registered with another account.');
      } else {
        errMsg = es ? 'Error al conectar con el servidor. Intenta de nuevo.' : 'Error connecting to server. Please try again.';
      }
      // Sign out of Firebase since backend rejected
      if (auth) { try { await auth.signOut(); } catch (_) {} }
      setError(errMsg);
      return false;
    }
    return true;
  }

  // ─── After successful auth ────────────────────────────────────────────────
  // Bug 7 fix: only re-render booking if already mid-flow at step 3.
  // Do NOT auto-open booking from scratch.
  function onAuthSuccess() {
    closeAuthModal();
    if (window.bookingState && window.bookingState.step === 3 && document.getElementById('booking-panel')) {
      if (window.__user) {
        window.bookingState.clientName = window.__user.name || window.bookingState.clientName;
        window.bookingState.clientPhone = window.__user.phone || window.bookingState.clientPhone;
        window.bookingState.clientEmail = window.__user.email || window.bookingState.clientEmail;
      }
      if (window.renderBooking) window.renderBooking();
    }
    // No automatic booking open — user navigates themselves
  }

  // ─── Modal shell helpers ──────────────────────────────────────────────────
  function modalShell(title, showBack, backFn) {
    return (
      '<div class="modal-overlay" onclick="closeAuthModal()">' +
        '<div class="modal-content" onclick="event.stopPropagation()" style="max-width:420px">' +
          '<div style="padding:32px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
              (showBack
                ? '<button onclick="' + backFn + '()" style="background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;gap:6px;font-size:14px;color:#666;font-family:\'DM Sans\',sans-serif">' + icons.back + (isEs() ? ' Volver' : ' Back') + '</button>'
                : '<div></div>') +
              '<h2 class="heading-md" style="margin:0">' + title + '</h2>' +
              '<button onclick="closeAuthModal()" style="background:none;border:none;cursor:pointer;padding:4px">' + icons.x + '</button>' +
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
    return '<div id="auth-error" style="display:none;font-size:13px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;margin-bottom:12px"></div>';
  }

  // ─── Country code dropdown HTML ───────────────────────────────────────────
  function countrySelect() {
    var opts = COUNTRIES.map(function (c) {
      return '<option value="' + c.dial + '"' + (c.dial === selectedDial ? ' selected' : '') + '>' + c.flag + ' ' + c.label + '</option>';
    }).join('');
    return (
      '<select id="auth-country-code" onchange="window.__uslSetDial(this.value)" ' +
        'style="border:1.5px solid #e8e8e8;border-radius:10px 0 0 10px;padding:12px 8px;font-size:14px;font-family:\'DM Sans\',sans-serif;background:#fff;cursor:pointer;outline:none;flex-shrink:0">' +
        opts +
      '</select>'
    );
  }

  window.__uslSetDial = function (val) { selectedDial = val; };

  // ─── SCREEN 1: Identifier entry ───────────────────────────────────────────
  function renderIdentifierScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Ingresa a SERVI' : 'Sign in to SERVI', false, ''
    );

    setScreen(
      // Google
      '<button onclick="handleGoogleAuth()" id="google-auth-btn" style="width:100%;padding:14px;border:1.5px solid #e0e0e0;border-radius:12px;background:#fff;font-size:15px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:10px">' +
        icons.google + ' ' + (es ? 'Continuar con Google' : 'Continue with Google') +
      '</button>' +

      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">' +
        '<div style="flex:1;height:1px;background:#eee"></div>' +
        '<span style="font-size:12px;color:#aaa">' + (es ? 'o' : 'or') + '</span>' +
        '<div style="flex:1;height:1px;background:#eee"></div>' +
      '</div>' +

      errorBox() +

      // Unified phone/email input — country dropdown shows for phone, hides for email
      '<div id="usl-input-wrap" style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
        '<div id="usl-country-wrap">' + countrySelect() + '</div>' +
        '<input id="auth-identifier" type="tel" inputmode="numeric" ' +
          'placeholder="' + (es ? 'Teléfono o correo electrónico' : 'Phone number or email') + '" ' +
          'style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'DM Sans\',sans-serif;outline:none" ' +
          'onkeydown="if(event.key===\'Enter\') window.__uslSubmitIdentifier()">' +
      '</div>' +

      '<button class="btn-primary" onclick="window.__uslSubmitIdentifier()" id="usl-continue-btn" style="width:100%;justify-content:center">' +
        (es ? 'Continuar' : 'Continue') +
      '</button>' +

      '<div id="recaptcha-container" style="margin-top:8px"></div>'
    );

    document.body.style.overflow = 'hidden';
    var inp = document.getElementById('auth-identifier');
    var countryWrap = document.getElementById('usl-country-wrap');
    if (inp) {
      inp.focus();
      // Dynamically switch between phone and email mode
      inp.addEventListener('input', function () {
        var isEmail = inp.value.includes('@');
        inp.setAttribute('type', isEmail ? 'email' : 'tel');
        inp.setAttribute('inputmode', isEmail ? 'email' : 'numeric');
        if (countryWrap) countryWrap.style.display = isEmail ? 'none' : '';
      });
    }
    ensureFirebase().then(setupRecaptchaInner);
  }

  // ─── Check identifier against backend ────────────────────────────────────
  window.__uslSubmitIdentifier = async function () {
    var raw = (document.getElementById('auth-identifier') || {}).value.trim();
    if (!raw) { setError(isEs() ? 'Ingresa tu teléfono o correo.' : 'Enter your phone or email.'); return; }

    var isEmail = raw.includes('@');
    var identifier;
    if (isEmail) {
      identifier = raw.toLowerCase();
    } else {
      // Build E164 from country code + digits
      var digits = raw.replace(/\D/g, '');
      identifier = selectedDial + digits;
    }

    uslIdentifier = identifier;
    uslIdentifierType = isEmail ? 'email' : 'phone';
    uslNewUserData = {};

    var btn = document.getElementById('usl-continue-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      var res = await fetch(API() + '/api/auth/check-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      });
      var data = await res.json();
      uslIsNew = !data.exists;

      if (uslIsNew) {
        // New user — need counterpart identifier
        if (uslIdentifierType === 'phone') {
          uslNewUserData.phone = identifier;
          renderSignupEmailScreen();
        } else {
          uslNewUserData.email = identifier;
          renderSignupPhoneScreen();
        }
      } else {
        // Existing user — go straight to OTP/verify
        if (uslIdentifierType === 'phone') {
          renderLoginOTPScreen();
        } else {
          renderLoginEmailLinkScreen();
        }
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Continuar' : 'Continue'; }
      setError(isEs() ? 'Error de conexión. Intenta de nuevo.' : 'Connection error. Try again.');
    }
  };

  // ─── SIGNUP: Collect missing counterpart ─────────────────────────────────
  function renderSignupEmailScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Crear cuenta' : 'Create account', true, 'window.__uslBack'
    );
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
        (es ? 'Número confirmado. Ahora ingresa tu correo.' : 'Phone confirmed. Now enter your email.') +
      '</p>' +
      errorBox() +
      '<input class="input-field" id="signup-email" type="email" placeholder="' + (es ? 'Correo electrónico' : 'Email address') + '" style="margin-bottom:12px">' +
      '<button class="btn-primary" onclick="window.__uslSignupEmailNext()" style="width:100%;justify-content:center;margin-bottom:12px">' +
        (es ? 'Continuar' : 'Continue') +
      '</button>'
    );
  }

  function renderSignupPhoneScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Crear cuenta' : 'Create account', true, 'window.__uslBack'
    );
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
        (es ? 'Correo confirmado. Ahora ingresa tu teléfono para verificar tu identidad.' : 'Email confirmed. Now enter your phone to verify your identity.') +
      '</p>' +
      errorBox() +
      '<div style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
        countrySelect() +
        '<input id="signup-phone" type="tel" inputmode="numeric" placeholder="55 1234 5678" ' +
          'style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'DM Sans\',sans-serif;outline:none">' +
      '</div>' +
      '<button class="btn-primary" onclick="window.__uslSignupPhoneNext()" style="width:100%;justify-content:center;margin-bottom:12px">' +
        (es ? 'Continuar' : 'Continue') +
      '</button>' +
      '<div id="recaptcha-container" style="margin-top:8px"></div>'
    );
    ensureFirebase().then(setupRecaptchaInner);
  }

  window.__uslSignupEmailNext = function () {
    var email = (document.getElementById('signup-email') || {}).value.trim();
    var es = isEs();
    if (!email || !email.includes('@')) { setError(es ? 'Ingresa un correo válido.' : 'Enter a valid email.'); return; }
    uslNewUserData.email = email;
    renderTermsScreen();
  };

  window.__uslSignupPhoneNext = function () {
    var digits = (document.getElementById('signup-phone') || {}).value.replace(/\D/g, '');
    var es = isEs();
    if (!digits) { setError(es ? 'Ingresa tu teléfono.' : 'Enter your phone.'); return; }
    uslNewUserData.phone = selectedDial + digits;
    uslIdentifier = uslNewUserData.phone;
    uslIdentifierType = 'phone';
    renderTermsScreen();
  };

  // ─── SIGNUP: Terms acceptance ─────────────────────────────────────────────
  function renderTermsScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Términos y condiciones' : 'Terms & conditions', true, 'window.__uslBack'
    );
    setScreen(
      '<p style="font-size:14px;color:#555;margin-bottom:20px;line-height:1.6">' +
        (es
          ? 'Al crear tu cuenta en SERVI aceptas nuestros <a href="/legal.html" target="_blank" style="color:#10b981;text-decoration:none">Términos de Servicio</a> y nuestra <a href="/legal.html#privacy" target="_blank" style="color:#10b981;text-decoration:none">Política de Privacidad</a>.'
          : 'By creating your SERVI account you agree to our <a href="/legal.html" target="_blank" style="color:#10b981;text-decoration:none">Terms of Service</a> and <a href="/legal.html#privacy" target="_blank" style="color:#10b981;text-decoration:none">Privacy Policy</a>.') +
      '</p>' +
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:20px">' +
        '<input type="checkbox" id="terms-check" style="margin-top:3px;accent-color:#10b981">' +
        '<span style="font-size:14px;color:#333">' +
          (es ? 'Acepto los términos y condiciones' : 'I agree to the terms and conditions') +
        '</span>' +
      '</label>' +
      errorBox() +
      '<button class="btn-primary" onclick="window.__uslAcceptTerms()" style="width:100%;justify-content:center">' +
        (es ? 'Crear cuenta' : 'Create account') +
      '</button>'
    );
  }

  window.__uslAcceptTerms = async function () {
    if (!document.getElementById('terms-check').checked) {
      setError(isEs() ? 'Debes aceptar los términos para continuar.' : 'You must accept the terms to continue.');
      return;
    }
    // Proceed to phone OTP verification
    renderLoginOTPScreen();
  };

  // ─── LOGIN / SIGNUP: Phone OTP screen ────────────────────────────────────
  function renderLoginOTPScreen() {
    var es = isEs();
    var phoneDisplay = uslIdentifier;
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Verificar teléfono' : 'Verify phone', true, 'window.__uslBack'
    );
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
        (es ? 'Enviaremos un código SMS a ' : 'We\'ll send an SMS code to ') +
        '<strong>' + phoneDisplay + '</strong>' +
      '</p>' +
      errorBox() +
      '<div id="recaptcha-container" style="margin-bottom:8px"></div>' +
      '<button class="btn-primary" onclick="window.__uslSendOTP()" id="send-otp-btn" style="width:100%;justify-content:center;margin-bottom:16px">' +
        (es ? 'Enviar código SMS' : 'Send SMS code') +
      '</button>' +

      // OTP entry (hidden until sent)
      '<div id="otp-entry" style="display:none">' +
        '<p id="otp-sent-msg" style="font-size:14px;color:#666;margin-bottom:12px"></p>' +
        '<input class="input-field" id="auth-otp" type="text" inputmode="numeric" maxlength="6" ' +
          'placeholder="' + (es ? 'Código de 6 dígitos' : '6-digit code') + '" ' +
          'style="text-align:center;font-size:22px;letter-spacing:10px;margin-bottom:12px" ' +
          'onkeydown="if(event.key===\'Enter\') window.__uslVerifyOTP()">' +
        '<button class="btn-primary" onclick="window.__uslVerifyOTP()" id="verify-otp-btn" style="width:100%;justify-content:center;margin-bottom:8px">' +
          (es ? 'Verificar' : 'Verify') +
        '</button>' +
        '<button onclick="window.__uslResendOTP()" style="background:none;border:none;font-size:13px;color:#10b981;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;width:100%;text-align:center">' +
          (es ? 'Reenviar código' : 'Resend code') +
        '</button>' +
      '</div>' +

      // Recovery link (only for existing users who can't access their phone)
      (!uslIsNew
        ? '<div style="margin-top:16px;text-align:center">' +
            '<button onclick="window.__uslStartRecovery()" style="background:none;border:none;font-size:13px;color:#888;cursor:pointer;font-family:\'DM Sans\',sans-serif;text-decoration:underline">' +
              (es ? '¿No tienes acceso a tu teléfono?' : 'Can\'t access your phone?') +
            '</button>' +
          '</div>'
        : '')
    );
    ensureFirebase().then(function () { setupRecaptchaInner(); });
  }

  window.__uslSendOTP = async function () {
    var ok = await ensureFirebase();
    if (!ok) { setError(isEs() ? 'Error al cargar autenticación.' : 'Error loading auth.'); return; }

    var btn = document.getElementById('send-otp-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      if (!recaptchaVerifier) setupRecaptchaInner();
      confirmationResult = await auth.signInWithPhoneNumber(uslIdentifier, recaptchaVerifier);

      if (btn) btn.style.display = 'none';
      var entry = document.getElementById('otp-entry');
      if (entry) entry.style.display = 'block';
      var sentMsg = document.getElementById('otp-sent-msg');
      if (sentMsg) sentMsg.textContent = (isEs() ? 'Código enviado a ' : 'Code sent to ') + uslIdentifier;
      var otpInput = document.getElementById('auth-otp');
      if (otpInput) otpInput.focus();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Enviar código SMS' : 'Send SMS code'; }
      setError(firebaseErrorMessage(err.code));
      setupRecaptchaInner();
    }
  };

  window.__uslVerifyOTP = async function () {
    var code = (document.getElementById('auth-otp') || {}).value.trim();
    var es = isEs();
    if (!code || code.length !== 6) { setError(es ? 'Ingresa el código de 6 dígitos.' : 'Enter the 6-digit code.'); return; }

    var btn = document.getElementById('verify-otp-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      await confirmationResult.confirm(code);

      // For new users: set display name
      var user = auth.currentUser;
      if (uslIsNew && uslNewUserData.name && !user.displayName) {
        await user.updateProfile({ displayName: uslNewUserData.name });
        await user.getIdToken(true);
      }

      // Wait for backend sync to complete (replaces fragile 800ms timeout)
      var syncOk = await awaitSyncAndCheck();
      if (!syncOk) {
        if (btn) { btn.disabled = false; btn.textContent = es ? 'Verificar' : 'Verify'; }
        return;
      }
      onAuthSuccess();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Verificar' : 'Verify'; }
      setError(firebaseErrorMessage(err.code));
    }
  };

  window.__uslResendOTP = function () {
    var btn = document.getElementById('send-otp-btn');
    var entry = document.getElementById('otp-entry');
    if (btn) { btn.style.display = 'block'; btn.disabled = false; btn.textContent = isEs() ? 'Enviar código SMS' : 'Send SMS code'; }
    if (entry) entry.style.display = 'none';
    setupRecaptchaInner();
  };

  // ─── LOGIN: Email link screen (existing email users) ─────────────────────
  function renderLoginEmailLinkScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Verificar correo' : 'Verify email', true, 'window.__uslBack'
    );
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
        (es ? 'Enviaremos un enlace de inicio de sesión a ' : 'We\'ll send a sign-in link to ') +
        '<strong>' + uslIdentifier + '</strong>' +
      '</p>' +
      errorBox() +
      '<button class="btn-primary" onclick="window.__uslSendEmailLink()" id="send-email-link-btn" style="width:100%;justify-content:center">' +
        (es ? 'Enviar enlace' : 'Send link') +
      '</button>'
    );
  }

  window.__uslSendEmailLink = async function () {
    var ok = await ensureFirebase();
    if (!ok) { setError(isEs() ? 'Error al cargar autenticación.' : 'Error loading auth.'); return; }

    var btn = document.getElementById('send-email-link-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      var actionSettings = {
        url: window.location.href,
        handleCodeInApp: true,
      };
      await auth.sendSignInLinkToEmail(uslIdentifier, actionSettings);
      localStorage.setItem('servi_email_link_target', uslIdentifier);
      setScreen(
        '<div style="text-align:center;padding:16px 0">' +
          '<div style="font-size:40px;margin-bottom:12px">📧</div>' +
          '<p style="font-size:15px;font-weight:600;margin-bottom:8px">' + (isEs() ? '¡Enlace enviado!' : 'Link sent!') + '</p>' +
          '<p style="font-size:14px;color:#666">' +
            (isEs() ? 'Revisa tu bandeja de entrada y haz clic en el enlace para ingresar.' : 'Check your inbox and click the link to sign in.') +
          '</p>' +
        '</div>'
      );
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = isEs() ? 'Enviar enlace' : 'Send link'; }
      setError(firebaseErrorMessage(err.code));
    }
  };

  // ─── RECOVERY: Can't access phone ────────────────────────────────────────
  window.__uslStartRecovery = function () {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(
      es ? 'Recuperar acceso' : 'Recover access', true, 'window.__uslBack'
    );
    setScreen(
      '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
        (es
          ? 'Ingresa el correo asociado a tu cuenta. Te enviaremos un código para verificar tu identidad y actualizar tu teléfono.'
          : 'Enter the email linked to your account. We\'ll send a code to verify your identity and update your phone.') +
      '</p>' +
      errorBox() +
      '<input class="input-field" id="recovery-email" type="email" placeholder="' + (es ? 'Correo electrónico' : 'Email address') + '" style="margin-bottom:12px">' +
      '<button class="btn-primary" onclick="window.__uslSendRecoveryEmail()" id="recovery-send-btn" style="width:100%;justify-content:center">' +
        (es ? 'Enviar código de recuperación' : 'Send recovery code') +
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
      // Check that this email belongs to the account with the phone
      var res = await fetch(API() + '/api/auth/check-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email.toLowerCase() })
      });
      var data = await res.json();
      if (!data.exists) {
        if (btn) { btn.disabled = false; btn.textContent = es ? 'Enviar código de recuperación' : 'Send recovery code'; }
        setError(es ? 'No encontramos una cuenta con ese correo.' : 'We couldn\'t find an account with that email.');
        return;
      }

      // Send sign-in link so they can authenticate via email
      var ok = await ensureFirebase();
      if (!ok) throw new Error('firebase_unavailable');
      await auth.sendSignInLinkToEmail(email.toLowerCase(), { url: window.location.href, handleCodeInApp: true });
      localStorage.setItem('servi_email_link_target', email.toLowerCase());
      localStorage.setItem('servi_recovery_mode', '1');

      setScreen(
        '<div style="text-align:center;padding:16px 0">' +
          '<div style="font-size:40px;margin-bottom:12px">📧</div>' +
          '<p style="font-size:15px;font-weight:600;margin-bottom:8px">' + (es ? 'Enlace enviado' : 'Link sent') + '</p>' +
          '<p style="font-size:14px;color:#666">' +
            (es
              ? 'Revisa tu correo y haz clic en el enlace. Después de ingresar podrás actualizar tu número de teléfono desde <strong>Mi cuenta</strong>.'
              : 'Check your email and click the link. After signing in you can update your phone number from <strong>My account</strong>.') +
          '</p>' +
        '</div>'
      );
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = es ? 'Enviar código de recuperación' : 'Send recovery code'; }
      setError(firebaseErrorMessage(err.code));
    }
  };

  // ─── Back navigation ──────────────────────────────────────────────────────
  window.__uslBack = function () {
    uslNewUserData = {};
    renderIdentifierScreen();
  };

  // ─── Handle email sign-in link on page load ────────────────────────────────
  async function handleEmailLinkSignIn() {
    var ok = await ensureFirebase();
    if (!ok) return;
    if (!auth.isSignInWithEmailLink(window.location.href)) return;

    var email = localStorage.getItem('servi_email_link_target');
    if (!email) {
      email = prompt(isEs() ? 'Confirma tu correo electrónico:' : 'Confirm your email address:');
      if (!email) return;
    }

    try {
      await auth.signInWithEmailLink(email, window.location.href);
      localStorage.removeItem('servi_email_link_target');
      var isRecovery = localStorage.getItem('servi_recovery_mode');
      localStorage.removeItem('servi_recovery_mode');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);

      // Wait for backend sync before proceeding
      if (window.__syncPromise) {
        try { await window.__syncPromise; } catch (_) {}
      }

      if (isRecovery) {
        window.location.href = '/account.html?section=security';
      } else {
        onAuthSuccess();
      }
    } catch (err) {
      console.error('[SERVI] Email link sign-in failed:', err);
    }
  }

  // ─── Open Auth Modal (public entry point) ─────────────────────────────────
  window.openAuthModal = function () {
    uslIdentifier = '';
    uslIdentifierType = '';
    uslIsNew = false;
    uslNewUserData = {};
    selectedDial = '+52';
    renderIdentifierScreen();
  };

  // ─── Close Modal ──────────────────────────────────────────────────────────
  window.closeAuthModal = function () {
    document.getElementById('auth-modal-global').innerHTML = '';
    document.body.style.overflow = '';
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} recaptchaVerifier = null; }
    confirmationResult = null;
  };

  // ─── Google Auth ──────────────────────────────────────────────────────────
  window.handleGoogleAuth = async function () {
    var ok = await ensureFirebase();
    if (!ok) { alert('Error loading auth. Please refresh the page.'); return; }

    var btn = document.getElementById('google-auth-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      await auth.signInWithPopup(provider);

      // Wait for backend sync (triggered by onAuthStateChanged)
      var syncOk = await awaitSyncAndCheck();
      if (!syncOk) {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        return;
      }
      onAuthSuccess();
    } catch (err) {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      console.error('[SERVI] Google auth error:', err);
      setError(firebaseErrorMessage(err.code));
    }
  };

  // ─── Recaptcha ─────────────────────────────────────────────────────────────
  function setupRecaptchaInner() {
    if (!firebaseReady || !auth) return;
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} recaptchaVerifier = null; }
    var container = document.getElementById('recaptcha-container');
    if (!container) return;
    container.innerHTML = '<div id="recaptcha-widget"></div>';
    try {
      recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-widget', {
        size: 'invisible',
        callback: function () { console.log('[SERVI] reCAPTCHA solved'); },
      });
    } catch (e) { console.warn('[SERVI] RecaptchaVerifier error:', e); }
  }

  // ─── Logout ────────────────────────────────────────────────────────────────
  window.logoutUser = async function () {
    // Clear local session first
    window.__user = null;
    window.__syncPromise = null;
    localStorage.removeItem('servi_user_session');

    // Sign out of Firebase — if SDK isn't loaded, set a flag so next page load completes it
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

  // ─── Update Navbar (backward-compat alias) ─────────────────────────────────
  window.updateNavForAuth = function () {
    if (window.buildNavbar) window.buildNavbar();
  };

  // ─── Error messages ────────────────────────────────────────────────────────
  function firebaseErrorMessage(code) {
    var es = isEs();
    var map = {
      'auth/too-many-requests':          es ? 'Demasiados intentos. Intenta más tarde.' : 'Too many attempts. Try again later.',
      'auth/invalid-phone-number':       es ? 'Número de teléfono inválido.' : 'Invalid phone number.',
      'auth/invalid-verification-code':  es ? 'Código incorrecto.' : 'Incorrect code.',
      'auth/code-expired':               es ? 'El código expiró. Solicita uno nuevo.' : 'Code expired. Request a new one.',
      'auth/captcha-check-failed':       es ? 'Error de verificación. Recarga la página.' : 'Verification error. Reload the page.',
      'auth/popup-blocked':              es ? 'El popup fue bloqueado. Permite popups e intenta de nuevo.' : 'Popup was blocked. Allow popups and try again.',
      'auth/network-request-failed':     es ? 'Error de conexión. Verifica tu internet.' : 'Connection error. Check your internet.',
      'auth/invalid-action-code':        es ? 'El enlace expiró o ya fue usado.' : 'The link has expired or already been used.',
    };
    return map[code] || (es ? 'Ocurrió un error. Intenta de nuevo.' : 'An error occurred. Please try again.');
  }

  // ─── Session token helper ──────────────────────────────────────────────────
  window.getSessionToken = function () {
    try {
      const raw = localStorage.getItem('servi_user_session');
      return raw ? (JSON.parse(raw).token || null) : null;
    } catch { return null; }
  };

  // ─── Session expiry toast ──────────────────────────────────────────────────
  function showSessionExpiredToast() {
    if (document.getElementById('servi-session-toast')) return;
    var es = isEs();
    var toast = document.createElement('div');
    toast.id = 'servi-session-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:12px;font-family:"DM Sans",sans-serif;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,0.15);display:flex;align-items:center;gap:10px;max-width:90%;animation:fadeInDown 0.3s ease';
    toast.innerHTML = '<span>' + (es ? 'Tu sesión expiró. Inicia sesión de nuevo.' : 'Your session expired. Please sign in again.') + '</span>' +
      '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;padding:0 4px">&times;</button>';
    document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentElement) toast.remove(); }, 6000);
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  ensureFirebase().then(function (ok) {
    handleEmailLinkSignIn();

    // If JWT was expired but Firebase re-authenticated, sync is already in progress.
    // If Firebase has no session either, show a toast after a short delay.
    if (window.__sessionExpired) {
      window.__sessionExpired = false;
      setTimeout(function () {
        if (!window.__user) {
          showSessionExpiredToast();
        }
      }, 2500); // Give Firebase onAuthStateChanged time to fire
    }
  });

})();
