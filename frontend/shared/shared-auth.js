// ─── SERVI Shared Auth (Firebase) ────────────────────────────────────────────
// Provides global auth modal with Firebase authentication.
// Supports: Phone OTP, Google OAuth (passwordless only — no email/password)
// Include AFTER i18n.js and BEFORE shared-nav.js.

(function () {
  const FIREBASE_VERSION = '10.12.0';
  const CDN_BASE = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION;

  // State
  let auth = null;
  let recaptchaVerifier = null;
  let confirmationResult = null;
  let firebaseReady = false;

  const icons = {
    x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>',
  };

  function tr() { return (window.__t || {}).auth || {}; }
  function lang() { return window.__lang || 'es'; }

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
      auth.onAuthStateChanged(onAuthStateChanged);
      return true;
    } catch (err) {
      console.error('[SERVI] Firebase init error:', err);
      return false;
    }
  }

  // ─── Auth state listener ──────────────────────────────────────────────────
  function onAuthStateChanged(firebaseUser) {
    if (firebaseUser) {
      window.__user = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName,
        phone: firebaseUser.phoneNumber,
      };
      // Optimistic write — syncWithBackend will overwrite with real token
      localStorage.setItem('servi_user_session', JSON.stringify({ user: window.__user, firebaseUid: firebaseUser.uid }));
      window.__syncError = null;
      syncWithBackend(firebaseUser);
    } else {
      window.__user = null;
      localStorage.removeItem('servi_user_session');
      window.__syncError = null;
    }
    if (window.buildNavbar) window.buildNavbar();
  }

  async function syncWithBackend(firebaseUser) {
    try {
      var idToken = await firebaseUser.getIdToken();
      var API = ((window.CONFIG && window.CONFIG.API_BASE) || '').replace(/\/+$/, '');
      var res = await fetch(API + '/api/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ name: firebaseUser.displayName, phone: firebaseUser.phoneNumber, email: firebaseUser.email })
      });
      if (res.ok) {
        var data = await res.json();
        if (data.user) {
          window.__user = Object.assign({}, window.__user, data.user);
          // Store token so getSessionToken() works for authenticated API calls
          localStorage.setItem('servi_user_session', JSON.stringify({
            token: data.token || null,
            user: window.__user,
            firebaseUid: firebaseUser.uid,
          }));
          if (window.buildNavbar) window.buildNavbar();
        }
      } else {
        var errData = {};
        try { errData = await res.json(); } catch (_) {}
        if (res.status === 409 && errData.error === 'phone_exists') {
          window.__syncError = { code: 'phone_exists', message: errData.message };
        } else {
          window.__syncError = { code: 'backend_sync_failed', status: res.status };
        }
        console.error('[SERVI] Backend sync failed:', res.status, errData);
      }
    } catch (err) {
      window.__syncError = { code: 'network_error', message: err.message };
      console.error('[SERVI] Backend sync error:', err.message);
    }
  }

  // ─── After successful auth ────────────────────────────────────────────────
  function onAuthSuccess() {
    closeAuthModal();
    // If booking panel is open at the confirm step, re-render with user info pre-filled
    if (window.bookingState && window.bookingState.step === 3 && document.getElementById('booking-panel')) {
      if (window.__user) {
        window.bookingState.clientName = window.__user.name || window.bookingState.clientName;
        window.bookingState.clientPhone = window.__user.phone || window.bookingState.clientPhone;
        window.bookingState.clientEmail = window.__user.email || window.bookingState.clientEmail;
      }
      if (window.renderBooking) window.renderBooking();
      return;
    }
    // Otherwise open booking from start (only on landing page)
    var path = window.location.pathname;
    if ((path === '/index.html' || path === '/') && window.openBooking) {
      window.openBooking();
    }
  }

  // ─── Open Auth Modal ──────────────────────────────────────────────────────
  window.openAuthModal = function (mode) {
    var a = tr();
    var isEs = lang() === 'es';

    document.getElementById('auth-modal-global').innerHTML =
      '<div class="modal-overlay" onclick="closeAuthModal()">' +
        '<div class="modal-content" onclick="event.stopPropagation()" style="max-width:420px">' +
          '<div style="padding:32px">' +

            // Header
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">' +
              '<h2 class="heading-md" id="auth-title">' + (isEs ? 'Ingresa a SERVI' : 'Sign in to SERVI') + '</h2>' +
              '<button onclick="closeAuthModal()" style="background:none;border:none;cursor:pointer;padding:4px">' + icons.x + '</button>' +
            '</div>' +

            // Google
            '<button onclick="handleGoogleAuth()" id="google-auth-btn" style="width:100%;padding:14px;border:1.5px solid #e0e0e0;border-radius:12px;background:#fff;font-size:15px;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:10px">' +
              icons.google + ' ' + (a.google || 'Continuar con Google') +
            '</button>' +

            // Divider
            '<div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">' +
              '<div style="flex:1;height:1px;background:#eee"></div>' +
              '<span class="text-xs" style="color:#aaa">' + (a.or || 'o') + '</span>' +
              '<div style="flex:1;height:1px;background:#eee"></div>' +
            '</div>' +

            // ── Phone form ──
            '<div id="auth-phone-form" style="display:flex;flex-direction:column;gap:12px">' +
              '<div id="phone-step-1">' +
                '<input class="input-field" id="auth-phone-name" placeholder="' + (a.name || 'Nombre completo') + '" style="margin-bottom:12px">' +
                '<input class="input-field" id="auth-phone-number" type="tel" placeholder="' + (a.phonePlaceholder || '+52 55 1234 5678') + '">' +
                '<div id="recaptcha-container" style="margin-top:8px"></div>' +
                '<button class="btn-primary" onclick="handleSendOTP()" id="send-otp-btn" style="width:100%;justify-content:center;margin-top:8px">' +
                  (a.sendCode || 'Enviar código') +
                '</button>' +
              '</div>' +
              '<div id="phone-step-2" style="display:none">' +
                '<p style="font-size:14px;color:#666;margin-bottom:12px" id="otp-sent-msg"></p>' +
                '<input class="input-field" id="auth-otp" type="text" inputmode="numeric" maxlength="6" placeholder="' + (a.otpPlaceholder || 'Código de 6 dígitos') + '" style="text-align:center;font-size:20px;letter-spacing:8px">' +
                '<button class="btn-primary" onclick="handleVerifyOTP()" id="verify-otp-btn" style="width:100%;justify-content:center;margin-top:12px">' +
                  (a.verify || 'Verificar') +
                '</button>' +
                '<button onclick="handleResendOTP()" style="background:none;border:none;font-size:13px;color:#10b981;font-weight:500;cursor:pointer;font-family:\'DM Sans\',sans-serif;text-align:center;margin-top:8px;width:100%">' + (a.resendCode || 'Reenviar código') + '</button>' +
              '</div>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>';

    document.body.style.overflow = 'hidden';
    setupRecaptcha();
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

    try {
      var provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      await auth.signInWithPopup(provider);
      onAuthSuccess();
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
      console.error('[SERVI] Google auth error:', err);
      alert(firebaseErrorMessage(err.code));
    }
  };

  // ─── Phone OTP ────────────────────────────────────────────────────────────
  function setupRecaptcha() {
    if (!firebaseReady || !auth) {
      ensureFirebase().then(function () { setupRecaptchaInner(); });
      return;
    }
    setupRecaptchaInner();
  }

  function setupRecaptchaInner() {
    if (recaptchaVerifier) { try { recaptchaVerifier.clear(); } catch (e) {} }
    var container = document.getElementById('recaptcha-container');
    if (!container) return;
    container.innerHTML = '<div id="recaptcha-widget"></div>';
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-widget', {
      size: 'invisible',
      callback: function () { console.log('[SERVI] reCAPTCHA solved'); },
    });
  }

  window.handleSendOTP = async function () {
    var ok = await ensureFirebase();
    if (!ok) { alert('Error loading auth.'); return; }

    var phone = (document.getElementById('auth-phone-number') || {}).value.trim();
    var isEs = lang() === 'es';
    if (!phone) { alert(isEs ? 'Ingresa tu número de teléfono.' : 'Enter your phone number.'); return; }

    // Normalize: assume Mexico (+52) if no country code
    if (!phone.startsWith('+')) {
      phone = '+52' + phone.replace(/\D/g, '').replace(/^52/, '');
    }

    var btn = document.getElementById('send-otp-btn');
    btn.disabled = true; btn.textContent = '...';

    try {
      if (!recaptchaVerifier) setupRecaptchaInner();
      confirmationResult = await auth.signInWithPhoneNumber(phone, recaptchaVerifier);

      document.getElementById('phone-step-1').style.display = 'none';
      document.getElementById('phone-step-2').style.display = 'block';
      var a = tr();
      document.getElementById('otp-sent-msg').textContent =
        (a.codeSent || 'Código enviado a {phone}').replace('{phone}', phone);
      var otpInput = document.getElementById('auth-otp');
      if (otpInput) otpInput.focus();
    } catch (err) {
      btn.disabled = false; btn.textContent = tr().sendCode || 'Enviar código';
      alert(firebaseErrorMessage(err.code));
      setupRecaptchaInner();
    }
  };

  window.handleVerifyOTP = async function () {
    var code = (document.getElementById('auth-otp') || {}).value.trim();
    var isEs = lang() === 'es';
    if (!code || code.length !== 6) { alert(isEs ? 'Ingresa el código de 6 dígitos.' : 'Enter the 6-digit code.'); return; }

    var btn = document.getElementById('verify-otp-btn');
    btn.disabled = true; btn.textContent = '...';

    try {
      await confirmationResult.confirm(code);
      // Update display name for new phone users
      var user = auth.currentUser;
      var nameInput = document.getElementById('auth-phone-name');
      if (nameInput && nameInput.value.trim() && !user.displayName) {
        await user.updateProfile({ displayName: nameInput.value.trim() });
        await user.getIdToken(true);
      }
      // Wait briefly for syncWithBackend (triggered by onAuthStateChanged) to settle
      window.__syncError = null;
      await new Promise(function (resolve) { setTimeout(resolve, 800); });
      if (window.__syncError && window.__syncError.code === 'phone_exists') {
        if (auth) { try { await auth.signOut(); } catch (_) {} }
        btn.disabled = false; btn.textContent = tr().verify || 'Verificar';
        alert(window.__syncError.message || (isEs ? 'Este número ya está registrado con otra cuenta.' : 'This phone is already registered under a different account.'));
        return;
      }
      onAuthSuccess();
    } catch (err) {
      btn.disabled = false; btn.textContent = tr().verify || 'Verificar';
      alert(firebaseErrorMessage(err.code));
    }
  };

  window.handleResendOTP = function () {
    document.getElementById('phone-step-1').style.display = 'block';
    document.getElementById('phone-step-2').style.display = 'none';
    var btn = document.getElementById('send-otp-btn');
    if (btn) { btn.disabled = false; btn.textContent = tr().sendCode || 'Enviar código'; }
    setupRecaptchaInner();
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  window.logoutUser = async function () {
    try { if (auth) await auth.signOut(); } catch (e) {}
    window.__user = null;
    localStorage.removeItem('servi_user_session');
    if (window.buildNavbar) window.buildNavbar();
  };

  // ─── Update Navbar (backward-compat alias) ────────────────────────────────
  window.updateNavForAuth = function () {
    if (window.buildNavbar) window.buildNavbar();
  };

  // ─── Error messages ───────────────────────────────────────────────────────
  function firebaseErrorMessage(code) {
    var isEs = lang() === 'es';
    var map = {
      'auth/too-many-requests':          isEs ? 'Demasiados intentos. Intenta más tarde.' : 'Too many attempts. Try again later.',
      'auth/invalid-phone-number':       isEs ? 'Número de teléfono inválido.' : 'Invalid phone number.',
      'auth/invalid-verification-code':  isEs ? 'Código incorrecto.' : 'Incorrect code.',
      'auth/code-expired':               isEs ? 'El código expiró. Solicita uno nuevo.' : 'Code expired. Request a new one.',
      'auth/captcha-check-failed':       isEs ? 'Error de verificación. Recarga la página.' : 'Verification error. Reload the page.',
      'auth/popup-blocked':              isEs ? 'El popup fue bloqueado. Permite popups e intenta de nuevo.' : 'Popup was blocked. Allow popups and try again.',
      'auth/network-request-failed':     isEs ? 'Error de conexión. Verifica tu internet.' : 'Connection error. Check your internet.',
    };
    return map[code] || (isEs ? 'Ocurrió un error. Intenta de nuevo.' : 'An error occurred. Please try again.');
  }

  // ─── Session token helper (used by account.html and booking flow) ─────────
  window.getSessionToken = function () {
    try {
      const raw = localStorage.getItem('servi_user_session');
      return raw ? (JSON.parse(raw).token || null) : null;
    } catch { return null; }
  };

  // ─── Init Firebase on load ────────────────────────────────────────────────
  ensureFirebase();

})();
