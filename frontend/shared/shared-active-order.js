// ─── SERVI Active-Order Dock ─────────────────────────────────────────────────
// A global, self-contained floating widget that surfaces a logged-in customer's
// ongoing/pending order on every customer-facing page, so they can check status or
// pay in one tap without opening account.html.
//
// • No-ops unless: shared session present AND the user has ≥1 active order.
// • Prioritizes a payable order (payment due) → pulses amber; otherwise calm teal.
// • "Completar pago" mints a FRESH payment link (POST /api/auth/orders/:id/payment-link)
//   and opens it in a new tab — same never-expired logic as the account orders drawer.
// • Self-injects CSS + markup, bilingual (ES/EN), idempotent. Hidden on account.html
//   (which has its own orders UI) and absent from standalone payment pages (no shared JS).
(function () {
  if (window.__serviActiveOrderInit) return;
  window.__serviActiveOrderInit = true;

  var path = String(location.pathname || '').toLowerCase();
  if (path.indexOf('account') !== -1) return; // account page already lists orders

  var API = (window.CONFIG && window.CONFIG.API_BASE) || '';
  var _state = 'pill'; // Page-local UI state; fresh page loads start compact unless payment is due.

  // ── i18n ──
  function isEs() {
    if (window.__lang) return window.__lang !== 'en';
    return (localStorage.getItem('servi-lang') || 'es') !== 'en';
  }
  var STR = {
    es: {
      pay: 'Pago pendiente', active: 'Pedido activo', requested: 'Solicitud recibida',
      authorized: 'Autorizado', scheduled: 'Programado', cash: 'Pago en efectivo', inProcess: 'En proceso',
      ctaPay: 'Completar pago', view: 'Ver pedido', viewAll: 'Ver todos',
      moreOne: 'pedido más', moreMany: 'pedidos más',
      ariaOpen: 'Ver tu pedido activo', ariaClose: 'Minimizar',
      generating: 'Generando…', payError: 'No pudimos abrir el pago. Intenta de nuevo.',
      payGone: 'Este pedido ya no está disponible para pago en línea.',
    },
    en: {
      pay: 'Payment pending', active: 'Active order', requested: 'Request received',
      authorized: 'Authorized', scheduled: 'Scheduled', cash: 'Cash payment', inProcess: 'In progress',
      ctaPay: 'Complete payment', view: 'View order', viewAll: 'View all',
      moreOne: 'more order', moreMany: 'more orders',
      ariaOpen: 'View your active order', ariaClose: 'Minimize',
      generating: 'Generating…', payError: 'We could not open the payment. Please try again.',
      payGone: 'This order is no longer available for online payment.',
    },
  };
  function t() { return isEs() ? STR.es : STR.en; }

  var CAT = {
    cleaning:  { icon: '🧽', es: 'Limpieza',       en: 'Cleaning', tint: 'rgba(149,204,213,0.22)' },
    repair:    { icon: '🔧', es: 'Reparación',     en: 'Repair',   tint: 'rgba(244,182,97,0.20)' },
    moving:    { icon: '📦', es: 'Mudanza',        en: 'Moving',   tint: 'rgba(146,166,228,0.20)' },
    wellness:  { icon: '💆', es: 'Bienestar',      en: 'Wellness', tint: 'rgba(231,158,189,0.20)' },
    suppliers: { icon: '🛒', es: 'Abastecimiento', en: 'Supply',   tint: 'rgba(143,206,156,0.20)' },
    custom:    { icon: '✨', es: 'Personalizado',  en: 'Custom',   tint: 'rgba(196,178,228,0.20)' },
  };
  function catMeta(k) { return CAT[String(k || '').toLowerCase()] || CAT.custom; }
  function catLabel(k) { var m = catMeta(k); return isEs() ? m.es : m.en; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function getToken() { return (window.getSessionToken && window.getSessionToken()) || null; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ── status → short label + tone ──
  function shortStatus(o) {
    var s = t();
    if (o.source === 'request') return s.requested;
    if (o.payable) return s.pay;
    switch (String(o.status || '').trim().toLowerCase()) {
      case 'confirmed': return s.authorized;
      case 'scheduled': return s.scheduled;
      case 'pending cash': return s.cash;
      default: return s.inProcess;
    }
  }
  function tone(o) { return o.payable ? 'pay' : 'active'; }
  function isPaymentPending(o) { return !!(o && o.payable); }

  function whenLabel(o) {
    var raw = o.serviceDateTime || o.serviceDate || null;
    if (o.isAsap) return isEs() ? 'Lo antes posible' : 'ASAP';
    if (!raw) return null;
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(raw)) ? raw + 'T12:00:00' : raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString(isEs() ? 'es-MX' : 'en-US', { day: 'numeric', month: 'short' });
  }

  // ── pick the most urgent active order ──
  function pickPrimary(list) {
    var payable = list.filter(function (o) { return o.payable; });
    return (payable.length ? payable : list)[0] || null;
  }

  // ── data ──
  var _orders = [];
  var _primary = null;
  var _payInFlight = false;

  async function fetchActive() {
    var token = getToken();
    if (!token) return [];
    try {
      var res = await fetch(API + '/api/auth/orders', { headers: { 'Authorization': 'Bearer ' + token } });
      if (!res.ok) return [];
      var d = await res.json();
      return (d.orders || []).filter(function (o) { return o.bucket === 'active'; });
    } catch (e) { return []; }
  }

  // ── fresh-link payment (popup-safe, mirrors account.html startOrderPayment) ──
  async function pay(order, btn) {
    if (_payInFlight) return;
    _payInFlight = true;
    var s = t();
    var token = getToken();
    var tab = window.open('', '_blank');
    if (tab) { try { tab.document.write('<!doctype html><meta charset="utf-8"><title>SERVI</title><body style="font-family:system-ui,sans-serif;color:#555;padding:40px">' + esc(s.generating) + '</body>'); } catch (e) {} }
    var prev = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = s.generating; }
    var done = function () { if (btn) { btn.disabled = false; if (prev != null) btn.textContent = prev; } _payInFlight = false; };
    try {
      var res = await fetch(API + '/api/auth/orders/' + encodeURIComponent(order.id) + '/payment-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      });
      if (res.status === 409) { if (tab) tab.close(); alert(s.payGone); done(); refresh(); return; }
      if (!res.ok) throw new Error('link_failed');
      var d = await res.json();
      var q = encodeURIComponent(d.orderId || order.id);
      var page = (d.flow || order.payFlow) === 'book' ? '/book.html' : '/pay.html';
      var url = page + '?order=' + q + '&orderId=' + q + '&rt=' + encodeURIComponent(d.rt);
      if (tab) tab.location.href = url; else window.location.href = url;
      done();
    } catch (e) { if (tab) tab.close(); alert(s.payError); done(); }
  }

  // ── render ──
  var STYLE_ID = 'servi-ao-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '.servi-ao{position:fixed;right:22px;bottom:22px;z-index:120;font-family:var(--font-body,"DM Sans",system-ui,sans-serif);max-width:min(330px,calc(100vw - 28px))}'
      + '.servi-ao *{box-sizing:border-box}'
      + '.servi-ao[data-state="pill"] .servi-ao__card{display:none}'
      + '.servi-ao[data-state="card"] .servi-ao__pill{display:none}'
      // pill
      + '.servi-ao__pill{display:inline-flex;align-items:center;gap:10px;padding:11px 15px;border:1px solid rgba(17,17,17,0.08);border-radius:999px;background:rgba(255,255,255,0.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 18px 40px -22px rgba(17,17,17,0.45);cursor:pointer;font:inherit;color:#1a1a1a;animation:aoIn .45s cubic-bezier(.16,1,.3,1) both}'
      + '.servi-ao__pill:hover{transform:translateY(-2px);box-shadow:0 22px 46px -22px rgba(17,17,17,0.5)}'
      + '.servi-ao__pill,.servi-ao__pill *{transition:transform .18s ease,box-shadow .18s ease}'
      + '.servi-ao__dot{width:9px;height:9px;border-radius:999px;flex:0 0 auto}'
      + '.servi-ao__pill-emoji{font-size:17px;line-height:1}'
      + '.servi-ao__pill-text{font-size:13px;font-weight:700;white-space:nowrap;letter-spacing:-.01em}'
      + '.servi-ao__chev{display:inline-flex;align-items:center;justify-content:center;width:14px;font-size:14px;line-height:1;color:#8c8c8c;margin-left:1px;transform:translateY(-1px)}'
      // tone
      + '.servi-ao[data-tone="pay"] .servi-ao__dot{background:#d68a1f;box-shadow:0 0 0 0 rgba(214,138,31,.5);animation:aoPulse 2s infinite}'
      + '.servi-ao[data-tone="active"] .servi-ao__dot{background:#3f9aa8}'
      // card
      + '.servi-ao__card{width:330px;max-width:calc(100vw - 28px);background:#fff;border:1px solid rgba(17,17,17,0.07);border-radius:20px;box-shadow:0 28px 64px -28px rgba(17,17,17,0.5);overflow:hidden;animation:aoCardIn .42s cubic-bezier(.16,1,.3,1) both}'
      + '.servi-ao__hero{position:relative;padding:18px 18px 16px;background:linear-gradient(155deg,var(--ao-tint,rgba(149,204,213,.18)),rgba(255,255,255,0) 80%)}'
      + '.servi-ao__close{position:absolute;top:12px;right:12px;width:28px;height:28px;padding:0;border-radius:999px;border:1px solid rgba(17,17,17,0.08);background:rgba(255,255,255,0.7);color:#444;font-size:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;line-height:0}'
      + '.servi-ao__close::before,.servi-ao__close::after{content:"";position:absolute;top:50%;left:50%;width:12px;height:1.6px;border-radius:999px;background:currentColor;transform:translate(-50%,-50%) rotate(45deg)}'
      + '.servi-ao__close::after{transform:translate(-50%,-50%) rotate(-45deg)}'
      + '.servi-ao__close:hover{background:#fff}'
      + '.servi-ao[data-close-locked="true"] .servi-ao__row{padding-right:0}'
      + '.servi-ao__row{display:flex;gap:12px;align-items:center;padding-right:30px}'
      + '.servi-ao__icon{width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,0.7);display:inline-flex;align-items:center;justify-content:center;font-size:22px;flex:0 0 auto;box-shadow:0 8px 18px -14px rgba(17,17,17,.6)}'
      + '.servi-ao__title{font-size:15px;font-weight:800;color:#1a1a1a;letter-spacing:-.01em;line-height:1.2}'
      + '.servi-ao__status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;margin-top:4px}'
      + '.servi-ao[data-tone="pay"] .servi-ao__status{color:#a8690f}'
      + '.servi-ao[data-tone="active"] .servi-ao__status{color:#2b6d77}'
      + '.servi-ao__status .servi-ao__dot{width:7px;height:7px}'
      + '.servi-ao__meta{padding:0 18px 4px;margin-top:12px;font-size:12.5px;color:#7a7a7a;display:flex;gap:6px 14px;flex-wrap:wrap}'
      + '.servi-ao__meta span{display:inline-flex;align-items:center;gap:5px;min-width:0;max-width:100%}'
      + '.servi-ao__meta b{font-weight:600;color:#5b5b5b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.servi-ao__actions{display:flex;gap:8px;padding:14px 18px 16px}'
      + '.servi-ao__cta{flex:1;border:none;border-radius:12px;background:#1a1a1a;color:#fff;font:inherit;font-size:13px;font-weight:700;padding:11px 14px;cursor:pointer;transition:background .18s ease,transform .18s ease}'
      + '.servi-ao__cta:hover{background:#5fb3c2;transform:translateY(-1px)}'
      + '.servi-ao__cta:disabled{opacity:.6;cursor:default;transform:none}'
      + '.servi-ao__ghost{flex:1;border:1.5px solid #dcdcdc;border-radius:12px;background:#fff;color:#1a1a1a;font:inherit;font-size:13px;font-weight:700;padding:10px 14px;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;transition:border-color .18s ease,background .18s ease}'
      + '.servi-ao__ghost:hover{border-color:#5fb3c2;background:rgba(149,204,213,.12)}'
      + '.servi-ao__more{padding:0 18px 16px;margin-top:-4px}'
      + '.servi-ao__more a{font-size:12px;font-weight:700;color:#3f9aa8;text-decoration:none}'
      + '.servi-ao__more a:hover{text-decoration:underline}'
      + '@keyframes aoIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}'
      + '@keyframes aoCardIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}'
      + '@keyframes aoPulse{0%{box-shadow:0 0 0 0 rgba(214,138,31,.5)}70%{box-shadow:0 0 0 9px rgba(214,138,31,0)}100%{box-shadow:0 0 0 0 rgba(214,138,31,0)}}'
      + '@media (max-width:600px){.servi-ao{left:14px;right:14px;bottom:calc(14px + env(safe-area-inset-bottom));max-width:none}.servi-ao__pill{width:100%;justify-content:flex-start}.servi-ao__pill-text{white-space:normal}.servi-ao__card{width:100%}}'
      + '@media (prefers-reduced-motion:reduce){.servi-ao__pill,.servi-ao__card{animation:none}.servi-ao[data-tone="pay"] .servi-ao__dot{animation:none}}';
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  var root = null;
  function getState(o) {
    return isPaymentPending(o) ? 'card' : _state;
  }
  function setState(s) {
    if (isPaymentPending(_primary) && s === 'pill') return;
    _state = s === 'card' ? 'card' : 'pill';
    if (root) root.setAttribute('data-state', getState(_primary));
  }

  function render() {
    if (!_primary) { if (root) { root.remove(); root = null; } return; }
    injectStyles();
    var s = t();
    var o = _primary;
    var cm = catMeta(o.category);
    var when = whenLabel(o);
    var extra = _orders.length - 1;
    var moreTxt = extra > 0 ? ('+' + extra + ' ' + (extra === 1 ? s.moreOne : s.moreMany)) : '';
    var closeLocked = isPaymentPending(o);

    if (!root) {
      root = document.createElement('div');
      root.className = 'servi-ao';
      document.body.appendChild(root);
    }
    root.setAttribute('data-tone', tone(o));
    root.setAttribute('data-state', getState(o));
    root.setAttribute('data-close-locked', closeLocked ? 'true' : 'false');
    root.style.setProperty('--ao-tint', cm.tint);

    root.innerHTML =
      '<button class="servi-ao__pill" type="button" aria-label="' + esc(s.ariaOpen) + '">' +
        '<span class="servi-ao__dot"></span>' +
        '<span class="servi-ao__pill-emoji">' + cm.icon + '</span>' +
        '<span class="servi-ao__pill-text">' + esc(shortStatus(o)) + '</span>' +
        '<span class="servi-ao__chev">▴</span>' +
      '</button>' +
      '<div class="servi-ao__card" role="dialog" aria-label="' + esc(catLabel(o.category)) + '">' +
        '<div class="servi-ao__hero">' +
          (closeLocked ? '' : '<button class="servi-ao__close" type="button" aria-label="' + esc(s.ariaClose) + '">✕</button>') +
          '<div class="servi-ao__row">' +
            '<span class="servi-ao__icon">' + cm.icon + '</span>' +
            '<div style="min-width:0">' +
              '<div class="servi-ao__title">' + esc(catLabel(o.category)) + '</div>' +
              '<div class="servi-ao__status"><span class="servi-ao__dot"></span>' + esc(shortStatus(o)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        ((when || o.address)
          ? '<div class="servi-ao__meta">' +
              (when ? '<span>📅 <b>' + esc(when) + '</b></span>' : '') +
              (o.address ? '<span>📍 <b>' + esc(o.address) + '</b></span>' : '') +
            '</div>'
          : '') +
        '<div class="servi-ao__actions">' +
          (o.payable ? '<button class="servi-ao__cta" type="button">' + esc(s.ctaPay) + '</button>' : '') +
          '<a class="servi-ao__ghost" href="/account.html?section=orders">' + esc(s.view) + '</a>' +
        '</div>' +
        (moreTxt ? '<div class="servi-ao__more"><a href="/account.html?section=orders">' + esc(moreTxt) + ' →</a></div>' : '') +
      '</div>';

    root.querySelector('.servi-ao__pill').addEventListener('click', function () { setState('card'); });
    var close = root.querySelector('.servi-ao__close');
    if (close) close.addEventListener('click', function () { setState('pill'); });
    var cta = root.querySelector('.servi-ao__cta');
    if (cta) cta.addEventListener('click', function () { pay(o, cta); });
  }

  // ── lifecycle ──
  async function refresh() {
    _orders = await fetchActive();
    _primary = pickPrimary(_orders);
    render();
  }

  function hasSessionHint() {
    try { return !!localStorage.getItem('servi_user_session'); } catch (e) { return false; }
  }

  async function boot() {
    if (window.__syncPromise) { try { await window.__syncPromise; } catch (e) {} }
    // Wait briefly for the session token to be restored by shared-auth.js, but don't spin
    // for clearly logged-out visitors (no stored session) — the common landing-page case.
    var hint = hasSessionHint();
    for (var i = 0; i < 24 && !getToken(); i++) {
      if (!hint && i >= 2) break;
      await sleep(150);
    }
    if (!getToken()) return; // not logged in → stay silent
    await refresh();
    // Re-check when the user returns to the tab (status may have changed).
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && getToken()) refresh();
    });
    // Re-render text on language switch; let other pages nudge a data refresh.
    window.addEventListener('langchange', function () { if (_primary) render(); });
    window.addEventListener('servi-orders-changed', refresh);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
