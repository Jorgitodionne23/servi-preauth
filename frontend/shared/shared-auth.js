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

  // ── USL flow state ──────────────────────────────────────────────────────────
  let uslIdentifier = '';            // raw value user typed (E164 phone or email)
  let uslIdentifierType = '';        // 'phone' | 'email' (current screen identifier)
  let uslFirstIdentifierType = '';   // 'phone' | 'email' (what user entered on screen 1)
  let uslCurrentOTPType = '';        // 'phone' | 'email' (which OTP is active)
  let uslIsNew = false;              // true = signup, false = login
  let uslNewUserData = {};           // accumulates { phone, email, name } for new user

  // ── Constants ───────────────────────────────────────────────────────────────
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

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function tr()   { return (window.__t || {}).auth || {}; }
  function lang() { return window.__lang || 'es'; }
  function isEs() { return lang() === 'es'; }
  function API()  { return ((window.CONFIG && window.CONFIG.API_BASE) || '').replace(/\/+$/, ''); }

  // ── Modal container ──────────────────────────────────────────────────────────
  if (!document.getElementById('auth-modal-global')) {
    const div = document.createElement('div');
    div.id = 'auth-modal-global';
    document.body.appendChild(div);
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
      if (!config) { console.warn('[SERVI] No Firebase config found'); return false; }
      if (!firebase.apps.length) firebase.initializeApp(config);
      auth = firebase.auth();
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
      window.__user = { id: firebaseUser.uid, email: firebaseUser.email, name: firebaseUser.displayName, phone: firebaseUser.phoneNumber };
      window.__syncError = null;
      window.__syncPromise = syncWithBackend(firebaseUser);
    } else {
      if (localStorage.getItem('servi_pending_logout')) localStorage.removeItem('servi_pending_logout');
      window.__user = null;
      localStorage.removeItem('servi_user_session');
      window.__syncError = null;
      window.__syncPromise = null;
    }
    if (window.buildNavbar) window.buildNavbar();
  }

  async function syncWithBackend(firebaseUser) {
    try {
      var idToken = await firebaseUser.getIdToken(true);
      var res = await fetch(API() + '/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({
          name:  firebaseUser.displayName || (uslNewUserData && uslNewUserData.name) || null,
          phone: firebaseUser.phoneNumber || (uslNewUserData && uslNewUserData.phone) || null,
          email: firebaseUser.email       || (uslNewUserData && uslNewUserData.email) || null,
          phone_verified: uslNewUserData && uslNewUserData.phone_verified != null ? uslNewUserData.phone_verified : (!!firebaseUser.phoneNumber || null),
          email_verified: uslNewUserData && uslNewUserData.email_verified != null ? uslNewUserData.email_verified : (!!firebaseUser.email     || null),
          first_identifier_type: uslFirstIdentifierType || null,
        })
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

  async function awaitSyncAndCheck() {
    if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
    if (window.__syncError) {
      var es = isEs();
      var errMsg = window.__syncError.code === 'phone_exists'
        ? (window.__syncError.message || (es ? 'Este número ya está registrado con otra cuenta.' : 'This phone is already registered with another account.'))
        : (es ? 'Error al conectar con el servidor. Intenta de nuevo.' : 'Error connecting to server. Please try again.');
      if (auth) { try { await auth.signOut(); } catch (_) {} }
      setError(errMsg);
      return false;
    }
    return true;
  }

  // ── onAuthSuccess: close modal, re-render booking step 3 if in-flight ────────
  function onAuthSuccess() {
    closeAuthModal();
    if (window.bookingState && window.bookingState.step === 3 && document.getElementById('booking-panel')) {
      if (window.__user) {
        window.bookingState.clientName  = window.__user.name  || window.bookingState.clientName;
        window.bookingState.clientPhone = window.__user.phone || window.bookingState.clientPhone;
        window.bookingState.clientEmail = window.__user.email || window.bookingState.clientEmail;
      }
      if (window.renderBooking) window.renderBooking();
    }
  }

  // ── Modal shell ──────────────────────────────────────────────────────────────
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

  function infoBanner(text) {
    return '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 12px;font-size:13px;color:#166534;margin-bottom:16px">' + text + '</div>';
  }

  function progressDots(active) {
    // active is 1-indexed (1=screen1, 2=OTP, 3=name, 4=secondary)
    var dots = '';
    for (var i = 1; i <= 4; i++) {
      var bg = i < active ? '#0a0a0a' : i === active ? '#10b981' : '#e8e8e8';
      dots += '<div style="flex:1;height:3px;border-radius:2px;background:' + bg + '"></div>';
    }
    return '<div style="display:flex;gap:4px;margin-bottom:20px">' + dots + '</div>';
  }

  // ── Country select ───────────────────────────────────────────────────────────
  function countrySelect(inputId) {
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

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Identifier Input
  // ══════════════════════════════════════════════════════════════════════════════
  function renderIdentifierScreen() {
    var es = isEs();
    document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Ingresa a SERVI' : 'Sign in to SERVI', false, '');
    setScreen(
      '<button onclick="handleGoogleAuth()" id="google-auth-btn" style="width:100%;padding:14px;border:1.5px solid #e0e0e0;border-radius:12px;background:#fff;font-size:15px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:10px">' +
        icons.google + ' ' + (es ? 'Continuar con Google' : 'Continue with Google') +
      '</button>' +
      '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px"><div style="flex:1;height:1px;background:#eee"></div><span style="font-size:12px;color:#aaa">' + (es ? 'o' : 'or') + '</span><div style="flex:1;height:1px;background:#eee"></div></div>' +
      errorBox() +
      '<div id="usl-input-wrap" style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
        '<div id="usl-country-wrap">' + countrySelect() + '</div>' +
        '<input id="auth-identifier" type="tel" inputmode="numeric" ' +
          'placeholder="' + (es ? 'Teléfono o correo electrónico' : 'Phone number or email') + '" ' +
          'style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'DM Sans\',sans-serif;outline:none" ' +
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
        inp.setAttribute('inputmode', hasLetter ? 'email' : 'numeric');
        if (countryWrap) countryWrap.style.display = hasLetter ? 'none' : '';
      });
    }
    ensureFirebase().then(setupRecaptchaInner);
  }

  window.__uslSubmitIdentifier = async function () {
    var raw = (document.getElementById('auth-identifier') || {}).value.trim();
    if (!raw) { setError(isEs() ? 'Ingresa tu teléfono o correo.' : 'Enter your phone or email.'); return; }

    var isEmail = raw.includes('@');
    var identifier = isEmail ? raw.toLowerCase() : (selectedDial + raw.replace(/\D/g, ''));

    uslIdentifier = identifier;
    uslIdentifierType = isEmail ? 'email' : 'phone';
    uslFirstIdentifierType = uslIdentifierType;
    uslNewUserData = {};

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

    document.getElementById('auth-modal-global').innerHTML = modalShell(title, true, 'window.__uslBack');

    if (isPhone) {
      setScreen(
        progressDots(2) +
        '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
          (es ? 'Enviaremos un código SMS a ' : 'We\'ll send an SMS code to ') +
          '<strong>' + uslIdentifier + '</strong>' +
        '</p>' +
        errorBox() +
        '<div id="recaptcha-container" style="margin-bottom:8px"></div>' +
        '<button class="btn-primary" onclick="window.__uslSendOTP()" id="send-otp-btn" style="width:100%;justify-content:center;margin-bottom:16px">' +
          (es ? 'Enviar código SMS' : 'Send SMS code') +
        '</button>' +
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
        (isLogin
          ? '<div style="margin-top:16px;text-align:center"><button onclick="window.__uslStartRecovery()" style="background:none;border:none;font-size:13px;color:#888;cursor:pointer;font-family:\'DM Sans\',sans-serif;text-decoration:underline">' + (es ? '¿No tienes acceso a tu teléfono?' : 'Can\'t access your phone?') + '</button></div>'
          : '')
      );
      ensureFirebase().then(setupRecaptchaInner);
    } else {
      // Email — magic link
      setScreen(
        progressDots(2) +
        '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
          (es ? 'Te enviaremos un enlace de verificación a ' : 'We\'ll send a verification link to ') +
          '<strong>' + uslIdentifier + '</strong>' +
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
      if (btn) { btn.disabled = true; btn.textContent = '...'; }
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
        // Persist USL state so handleEmailLinkSignIn can restore after redirect
        localStorage.setItem('servi_email_link_target', emailNorm);
        localStorage.setItem('servi_usl_state', JSON.stringify({
          identifier: emailNorm,
          identifierType: uslIdentifierType,
          firstIdentifierType: uslFirstIdentifierType,
          isNew: uslIsNew,
          newUserData: uslNewUserData,
        }));
        await auth.sendSignInLinkToEmail(emailNorm, { url: window.location.origin + '/', handleCodeInApp: true });
        setScreen(
          '<div style="text-align:center;padding:16px 0">' +
            '<div style="font-size:40px;margin-bottom:12px">📧</div>' +
            '<p style="font-size:15px;font-weight:600;margin-bottom:8px">' + (isEs() ? '¡Enlace enviado!' : 'Link sent!') + '</p>' +
            '<p style="font-size:14px;color:#666;line-height:1.6">' +
              (isEs()
                ? 'Revisa <strong>' + uslIdentifier + '</strong> y haz clic en el enlace para continuar.'
                : 'Check <strong>' + uslIdentifier + '</strong> and click the link to continue.') +
            '</p>' +
          '</div>'
        );
      } catch (err) {
        if (eBtn) { eBtn.disabled = false; eBtn.textContent = isEs() ? 'Enviar enlace' : 'Send link'; }
        setError(firebaseErrorMessage(err.code));
      }
    }
  };

  // ── Phone OTP verify ─────────────────────────────────────────────────────────
  // Only called for phone OTP screens. Email verification is handled via handleEmailLinkSignIn.
  window.__uslVerifyOTP = async function () {
    var code = (document.getElementById('auth-otp') || {}).value.trim();
    var es = isEs();
    if (!code || code.length !== 6) { setError(es ? 'Ingresa el código de 6 dígitos.' : 'Enter the 6-digit code.'); return; }

    var btn = document.getElementById('verify-otp-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    setError('');

    try {
      await confirmationResult.confirm(code);

      if (uslIsNew) {
        // Signup: mark phone as verified in flow state, then collect name
        uslNewUserData.phone = uslIdentifier;
        uslNewUserData.phone_verified = true;
        // Backend sync runs in background via onAuthStateChanged — we wait for it before name PATCH
        renderNameCollectionScreen();
      } else {
        // Login: await sync then close
        var syncOk = await awaitSyncAndCheck();
        if (!syncOk) { if (btn) { btn.disabled = false; btn.textContent = es ? 'Verificar' : 'Verify'; } return; }
        onAuthSuccess();
      }
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = es ? 'Verificar' : 'Verify'; }
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

  // ══════════════════════════════════════════════════════════════════════════════
  // SCREEN 2b — Name Collection (signup only)
  // ══════════════════════════════════════════════════════════════════════════════
  function renderNameCollectionScreen() {
    var es = isEs();
    var verifiedLabel = uslCurrentOTPType === 'phone'
      ? (es ? '✓ Teléfono verificado' : '✓ Phone verified')
      : (es ? '✓ Correo verificado'   : '✓ Email verified');

    document.getElementById('auth-modal-global').innerHTML = modalShell(es ? 'Tu nombre' : 'Your name', false, '');
    setScreen(
      progressDots(3) +
      infoBanner(verifiedLabel) +
      '<p style="font-size:14px;color:#666;margin-bottom:16px">' +
        (es ? 'Lo usamos para personalizar tus solicitudes de servicio.' : 'We use this to personalize your service requests.') +
      '</p>' +
      errorBox() +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
        '<input id="signup-first-name" class="input-field" type="text" placeholder="' + (es ? 'Nombre' : 'First name') + '" style="flex:1">' +
        '<input id="signup-last-name"  class="input-field" type="text" placeholder="' + (es ? 'Apellido' : 'Last name') + '" style="flex:1">' +
      '</div>' +
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:20px">' +
        '<input type="checkbox" id="terms-check" style="margin-top:3px;accent-color:#10b981">' +
        '<span style="font-size:13px;color:#555;line-height:1.5">' +
          (es
            ? 'Acepto los <a href="/legal.html" target="_blank" style="color:#10b981;text-decoration:none">Términos de Servicio</a> y la <a href="/legal.html#privacy" target="_blank" style="color:#10b981;text-decoration:none">Política de Privacidad</a>.'
            : 'I agree to the <a href="/legal.html" target="_blank" style="color:#10b981;text-decoration:none">Terms of Service</a> and <a href="/legal.html#privacy" target="_blank" style="color:#10b981;text-decoration:none">Privacy Policy</a>.') +
        '</span>' +
      '</label>' +
      '<button class="btn-primary" onclick="window.__uslNameNext()" id="name-next-btn" style="width:100%;justify-content:center">' +
        (es ? 'Continuar' : 'Continue') +
      '</button>'
    );
    var f = document.getElementById('signup-first-name');
    if (f) f.focus();
  }

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

    // Wait for background sync to complete (phone OTP triggers onAuthStateChanged)
    var syncOk = await awaitSyncAndCheck();
    if (!syncOk) { if (btn) { btn.disabled = false; btn.textContent = es ? 'Continuar' : 'Continue'; } return; }

    // Persist name via PATCH (sync may have created user without name if displayName was blank)
    try {
      var token = getSessionToken();
      if (token && firstName) {
        await fetch(API() + '/api/auth/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ name: uslNewUserData.name })
        });
        if (window.__user) window.__user.name = uslNewUserData.name;
        var raw = localStorage.getItem('servi_user_session');
        if (raw) {
          try {
            var sess = JSON.parse(raw);
            sess.user = Object.assign({}, sess.user, { name: uslNewUserData.name });
            localStorage.setItem('servi_user_session', JSON.stringify(sess));
          } catch (_) {}
        }
      }
    } catch (_) {}

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
      '<input id="cross-id-name" class="input-field" type="text" placeholder="' + (es ? 'Nombre completo' : 'Full name') + '" style="margin-bottom:12px">' +
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
          ? 'Necesitarás un ' + (collectPhone ? 'teléfono' : 'correo') + ' verificado para confirmar solicitudes de servicio. Puedes omitirlo por ahora.'
          : 'You\'ll need a verified ' + (collectPhone ? 'phone number' : 'email') + ' to confirm service requests. You can skip for now.') +
      '</p>' +
      errorBox() +
      (collectPhone
        ? '<div style="display:flex;margin-bottom:12px;border:1.5px solid #e8e8e8;border-radius:10px;overflow:hidden">' +
            countrySelect() +
            '<input id="secondary-phone" type="tel" inputmode="numeric" placeholder="55 1234 5678" style="flex:1;border:none;padding:12px;font-size:15px;font-family:\'DM Sans\',sans-serif;outline:none" onkeydown="if(event.key===\'Enter\') window.__uslSecondaryNext()">' +
          '</div>'
        : '<input id="secondary-email" class="input-field" type="email" placeholder="' + (es ? 'correo@ejemplo.com' : 'email@example.com') + '" style="margin-bottom:12px" onkeydown="if(event.key===\'Enter\') window.__uslSecondaryNext()">') +
      '<button class="btn-primary" onclick="window.__uslSecondaryNext()" style="width:100%;justify-content:center;margin-bottom:10px">' +
        (es ? 'Verificar' : 'Verify') +
      '</button>' +
      '<button onclick="window.__uslSkipSecondary()" style="background:none;border:none;font-size:13px;color:#888;cursor:pointer;font-family:\'DM Sans\',sans-serif;width:100%;text-align:center;padding:8px;text-decoration:underline">' +
        (es ? 'Omitir por ahora' : 'Skip for now') +
      '</button>'
    );
    var el = document.getElementById(collectPhone ? 'secondary-phone' : 'secondary-email');
    if (el) el.focus();
  }

  window.__uslSecondaryNext = function () {
    var es = isEs();
    var collectPhone = uslFirstIdentifierType === 'email';

    if (collectPhone) {
      var digits = (document.getElementById('secondary-phone') || {}).value.replace(/\D/g, '');
      if (!digits) { setError(es ? 'Ingresa tu teléfono.' : 'Enter your phone.'); return; }
      uslNewUserData.phone = selectedDial + digits;
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

  window.__uslSkipSecondary = function () {
    var collectPhone = uslFirstIdentifierType === 'email';
    if (collectPhone) {
      localStorage.setItem('servi_phone_skipped', '1');
    } else {
      localStorage.setItem('servi_email_skipped', '1');
    }
    // Signup complete — sync already happened after primary OTP
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
      var isSecondaryPhoneOTP = uslIsNew && uslFirstIdentifierType === 'email' && uslCurrentOTPType === 'phone';
      if (isSecondaryPhoneOTP) {
        // Let confirmationResult.confirm run, then mark phone verified and finish
        var code = (document.getElementById('auth-otp') || {}).value.trim();
        var es = isEs();
        if (!code || code.length !== 6) { setError(es ? 'Ingresa el código de 6 dígitos.' : 'Enter the 6-digit code.'); return; }
        var btn = document.getElementById('verify-otp-btn');
        if (btn) { btn.disabled = true; btn.textContent = '...'; }
        setError('');
        try {
          // For secondary phone on an email-first account, link the phone credential
          var credential = firebase.auth.PhoneAuthProvider.credential(confirmationResult.verificationId, code);
          var fbUser = auth.currentUser;
          if (fbUser && fbUser.email) {
            // Already signed in with email — link phone
            await fbUser.linkWithCredential(credential);
          } else {
            await confirmationResult.confirm(code);
          }
          uslNewUserData.phone_verified = true;
          localStorage.removeItem('servi_phone_skipped');
          // Patch phone + phone_verified on the user record
          var token = getSessionToken();
          if (token) {
            var fbToken = await (auth.currentUser && auth.currentUser.getIdToken(true));
            if (fbToken) {
              await fetch(API() + '/api/auth/add-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ phone: uslNewUserData.phone, firebase_id_token: fbToken })
              });
            }
          }
          onAuthSuccess();
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = es ? 'Verificar' : 'Verify'; }
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
      await auth.sendSignInLinkToEmail(email.toLowerCase(), { url: window.location.origin + '/', handleCodeInApp: true });
      localStorage.setItem('servi_email_link_target', email.toLowerCase());
      localStorage.setItem('servi_recovery_mode', '1');
      setScreen(
        '<div style="text-align:center;padding:16px 0">' +
          '<div style="font-size:40px;margin-bottom:12px">📧</div>' +
          '<p style="font-size:15px;font-weight:600;margin-bottom:8px">' + (es ? 'Enlace enviado' : 'Link sent') + '</p>' +
          '<p style="font-size:14px;color:#666;line-height:1.6">' +
            (es
              ? 'Revisa tu correo y haz clic en el enlace. Después podrás actualizar tu teléfono desde <strong>Mi cuenta</strong>.'
              : 'Check your email and click the link. You can then update your phone from <strong>My account</strong>.') +
          '</p>' +
        '</div>'
      );
    } catch (err) {
      if (btn) { btn.disabled = false; btn.textContent = es ? 'Enviar enlace de recuperación' : 'Send recovery link'; }
      setError(firebaseErrorMessage(err.code));
    }
  };

  // ── Back navigation ──────────────────────────────────────────────────────────
  window.__uslBack = function () {
    uslNewUserData = {};
    uslCurrentOTPType = '';
    renderIdentifierScreen();
  };

  // ── Send email verification (for account page) ─────────────────────────────────
  window.__sendEmailVerification = async function (email) {
    if (!email) return false;
    var ok = await ensureFirebase();
    if (!ok) return false;
    try {
      await auth.sendSignInLinkToEmail(email.toLowerCase(), { url: window.location.origin + '/', handleCodeInApp: true });
      return true;
    } catch (err) {
      console.error('[sendEmailVerification] Firebase error:', err.code, err.message);
      return false;
    }
  };

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
    document.body.style.fontFamily = '"DM Sans", sans-serif';

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
    icon.style.color = '#10b981';
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
    titleEl.style.fontFamily = '"Syne", sans-serif';
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
  async function handleEmailLinkSignIn() {
    var ok = await ensureFirebase();
    if (!ok) return;
    if (!auth.isSignInWithEmailLink(window.location.href)) return;

    var email = localStorage.getItem('servi_email_link_target');
    if (!email) {
      email = prompt(isEs() ? 'Confirma tu correo electrónico:' : 'Confirm your email address:');
      if (!email) return;
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
    localStorage.removeItem('servi_email_verification_mode');

    try {
      // If already signed in with phone, link email rather than sign in fresh
      if (auth.currentUser && auth.currentUser.phoneNumber) {
        var credential = firebase.auth.EmailAuthProvider.credentialWithLink(email, window.location.href);
        await auth.currentUser.linkWithCredential(credential);
      } else {
        await auth.signInWithEmailLink(email, window.location.href);
      }

      localStorage.removeItem('servi_email_link_target');
      window.history.replaceState({}, document.title, window.location.pathname);

      if (isEmailVerification) {
        // Email verification from account page: just update the session and return to account page
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        if (window.__user) window.__user.email_verified = true;
        var raw = localStorage.getItem('servi_user_session');
        if (raw) {
          try {
            var sess = JSON.parse(raw);
            if (sess.user) sess.user.email_verified = true;
            localStorage.setItem('servi_user_session', JSON.stringify(sess));
          } catch (_) {}
        }
        if (window.buildNavbar) window.buildNavbar();
        window.location.href = '/account.html?section=info';
        return;
      }

      if (isRecovery) {
        // Wait for sync then redirect to account security section
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        window.location.href = '/account.html?section=security';
        return;
      }

      if (uslIsNew && uslFirstIdentifierType === 'email') {
        // Email-first new signup: mark email verified and show success screen
        uslNewUserData.email = email;
        uslNewUserData.email_verified = true;
        // Wait for auto-sync (onAuthStateChanged fired)
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        // Broadcast to any listening modal that email was verified
        window.__broadcastEmailVerified();
        // Show success screen instead of trying to reopen modal on this page
        window.__handleEmailLinkAsScreen();
        return;
      } else if (uslIsNew && uslFirstIdentifierType === 'phone') {
        // Secondary email for phone-first signup: mark email verified
        uslNewUserData.email = email;
        uslNewUserData.email_verified = true;
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        // Patch email_verified on the account
        var token = getSessionToken();
        if (token && auth.currentUser) {
          var fbToken = await auth.currentUser.getIdToken(true);
          await fetch(API() + '/api/auth/add-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ email: email, firebase_id_token: fbToken })
          });
          localStorage.removeItem('servi_email_skipped');
        }
        onAuthSuccess();
      } else {
        // Email login for existing user
        if (window.__syncPromise) { try { await window.__syncPromise; } catch (_) {} }
        onAuthSuccess();
      }
    } catch (err) {
      console.error('[SERVI] Email link sign-in failed:', err);
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
    if (!ok) { alert('Error loading auth. Please refresh the page.'); return; }
    var btn = document.getElementById('google-auth-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      uslFirstIdentifierType = 'email'; // Google gives email
      await auth.signInWithPopup(provider);
      var syncOk = await awaitSyncAndCheck();
      if (!syncOk) { if (btn) { btn.disabled = false; btn.style.opacity = ''; } return; }
      onAuthSuccess();
    } catch (err) {
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
        callback: function () { console.log('[SERVI] reCAPTCHA solved'); },
      });
    } catch (e) { console.warn('[SERVI] RecaptchaVerifier error:', e); }
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  window.logoutUser = async function () {
    window.__user = null;
    window.__syncPromise = null;
    localStorage.removeItem('servi_user_session');
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
      'auth/popup-blocked':             es ? 'El popup fue bloqueado. Permite popups.'        : 'Popup was blocked. Allow popups.',
      'auth/network-request-failed':    es ? 'Error de conexión. Verifica tu internet.'      : 'Connection error. Check your internet.',
      'auth/invalid-action-code':       es ? 'El enlace expiró o ya fue usado.'              : 'The link has expired or already been used.',
      'auth/credential-already-in-use': es ? 'Este identificador ya está asociado a otra cuenta.' : 'This identifier is already linked to another account.',
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
    uslNewUserData = {};
    selectedDial = '+52';
    renderIdentifierScreen();
  };

  window.closeAuthModal = function () {
    document.getElementById('auth-modal-global').innerHTML = '';
    document.body.style.overflow = '';
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} recaptchaVerifier = null; }
    confirmationResult = null;
  };

  // ── Session expiry toast ──────────────────────────────────────────────────────
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

  // ── Init ──────────────────────────────────────────────────────────────────────
  ensureFirebase().then(function () {
    handleEmailLinkSignIn();
    if (window.__sessionExpired) {
      window.__sessionExpired = false;
      setTimeout(function () { if (!window.__user) showSessionExpiredToast(); }, 2500);
    }
  });

})();
