// ─── SERVI Shared Navbar ────────────────────────────────────────────────────
// Injects a sticky navbar into the page. Include after i18n.js.
// Usage: <div id="navbar"></div> then this script auto-renders.
//
// Config (set before this script loads):
//   window.__navType = 'main' | 'helpcenter' | 'partners'  (default: 'main')

(function () {
  const type = window.__navType || 'main';

  function getLinks(t) {
    if (type === 'helpcenter') {
      return [
        { label: t.nav.helpCenter, href: '/helpcenter.html' },
        { label: t.hero.cta, href: '/index.html#services' },
        { label: t.nav.partners, href: '/partners.html' },
      ];
    }
    if (type === 'partners') {
      return [
        { label: '¿Qué?', href: '/partners.html#what', i18n: { es: '¿Qué?', en: 'What?' } },
        { label: '¿Cómo?', href: '/partners.html#how', i18n: { es: '¿Cómo?', en: 'How?' } },
        { label: 'Handbook', href: '/handbook.html' },
      ];
    }
    // main
    return [
      { label: t.nav.services, anchor: 'services' },
      { label: t.nav.howItWorks, anchor: 'how' },
      { label: t.nav.testimonials, anchor: 'testimonials' },
      { label: t.nav.helpCenter, href: '/helpcenter.html' },
      { label: t.nav.partners, href: '/partners.html' },
    ];
  }

  function buildNav() {
    const t = window.__t;
    const lang = window.__lang;
    const links = getLinks(t);

    const logoSuffix = type === 'partners'
      ? ' <span style="color:#888;font-weight:400;font-size:16px;margin-left:4px">| Partner</span>'
      : '';

    const onHome = (window.location.pathname === '/' || window.location.pathname === '/index.html');
    const linksHTML = links.map(l => {
      if (l.anchor) {
        if (onHome) {
          return `<a class="nav-link" style="cursor:pointer" onclick="document.getElementById('${l.anchor}')?.scrollIntoView({behavior:'smooth'})">${l.label}</a>`;
        }
        return `<a class="nav-link" href="/index.html#${l.anchor}">${l.label}</a>`;
      }
      const label = l.i18n ? l.i18n[lang] : l.label;
      return `<a class="nav-link" href="${l.href}">${label}</a>`;
    }).join('');

    const navClass = type === 'helpcenter' ? 'navbar navbar--light-on-dark' : 'navbar';

    return `
    <nav class="${navClass}" id="site-navbar">
      <div class="navbar__inner">
        <a href="/index.html" class="logo" style="text-decoration:none">SERVI<span class="logo-dot">.</span>${logoSuffix}</a>

        <div class="desktop-nav" style="display:flex;align-items:center;gap:32px">
          ${linksHTML}
        </div>

        <div style="display:flex;align-items:center;gap:12px">
          <div class="lang-toggle">
            <button class="lang-btn ${lang === 'es' ? 'lang-active' : 'lang-inactive'}" data-lang="es" onclick="setLang('es');document.getElementById('navbar').innerHTML='';buildNavbar()">ES</button>
            <button class="lang-btn ${lang === 'en' ? 'lang-active' : 'lang-inactive'}" data-lang="en" onclick="setLang('en');document.getElementById('navbar').innerHTML='';buildNavbar()">EN</button>
          </div>

          <div class="desktop-nav" style="display:flex;align-items:center;gap:8px">
            ${window.__user
              ? `<div class="user-menu" id="user-menu">
                   <button class="user-menu-trigger" onclick="toggleUserMenu()" aria-label="User menu">
                     <span class="user-menu-avatar">${((window.__user.name || window.__user.email || '?')[0]).toUpperCase()}</span>
                     <span class="user-menu-name">${(window.__user.name || window.__user.email || '').split(' ')[0]}</span>
                     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
                   </button>
                   <div class="user-menu-dropdown" id="user-menu-dropdown">
                     <div class="user-menu-dropdown-header">
                       <div class="um-name">${window.__user.name || ''}</div>
                       <div class="um-email">${window.__user.email || window.__user.phone || ''}</div>
                     </div>
                     <a href="/account.html" class="user-menu-item">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                       ${lang === 'es' ? 'Mi cuenta' : 'My account'}
                     </a>
                     <div class="user-menu-divider"></div>
                     <button class="user-menu-item user-menu-item--danger" onclick="logoutUser && logoutUser()">
                       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                       ${lang === 'es' ? 'Cerrar sesión' : 'Log out'}
                     </button>
                   </div>
                 </div>`
              : `<button class="nav-login-btn" onclick="openAuthModal && openAuthModal('login')">${t.nav.login}</button>
                 <button class="nav-signup-btn" onclick="openAuthModal && openAuthModal('signup')">${t.nav.signup}</button>`
            }
          </div>

          <button class="hamburger" onclick="toggleMobileMenu(true)" aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile menu -->
    <div id="mobile-overlay" class="mobile-overlay" style="display:none" onclick="toggleMobileMenu(false)"></div>
    <div id="mobile-menu" class="mobile-menu" style="display:none">
      <div style="display:flex;justify-content:flex-end;margin-bottom:32px">
        <button onclick="toggleMobileMenu(false)" style="background:none;border:none;cursor:pointer;padding:4px">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:20px">
        ${links.map(l => {
          if (l.anchor) return `<a onclick="document.getElementById('${l.anchor}')?.scrollIntoView({behavior:'smooth'});toggleMobileMenu(false)" style="font-size:18px;font-weight:500;color:#0a0a0a;cursor:pointer">${l.label}</a>`;
          const label = l.i18n ? l.i18n[lang] : l.label;
          return `<a href="${l.href}" style="font-size:18px;font-weight:500;color:#0a0a0a;text-decoration:none">${label}</a>`;
        }).join('')}
        <div style="height:1px;background:#eee;margin:8px 0"></div>
        ${window.__user
          ? `<span style="font-size:16px;font-weight:600;font-family:'DM Sans',sans-serif">Hola, ${(window.__user.name || window.__user.email || '').split(' ')[0]}</span>
             <a href="/account.html" onclick="toggleMobileMenu(false)" style="font-size:16px;font-weight:500;color:#0a0a0a;text-decoration:none;font-family:'DM Sans',sans-serif">${lang === 'es' ? 'Mi cuenta' : 'My account'}</a>
             <button onclick="toggleMobileMenu(false);logoutUser && logoutUser()" style="background:none;border:none;font-size:16px;font-weight:500;cursor:pointer;text-align:left;font-family:'DM Sans',sans-serif;color:#ef4444">${lang === 'es' ? 'Cerrar sesión' : 'Log out'}</button>`
          : `<button onclick="toggleMobileMenu(false);openAuthModal && openAuthModal('login')" style="background:none;border:none;font-size:16px;font-weight:600;cursor:pointer;text-align:left;font-family:'DM Sans',sans-serif">${t.nav.login}</button>
             <button class="btn-primary" onclick="toggleMobileMenu(false);openAuthModal && openAuthModal('signup')" style="justify-content:center">${t.nav.signup}</button>`
        }
      </div>
    </div>`;
  }

  // ─── Session restore (runs on every page before rendering) ──
  function restoreSession() {
    try {
      const raw = localStorage.getItem('servi_user_session');
      if (!raw) { window.__user = null; return; }
      const session = JSON.parse(raw);
      // Clear stale pre-migration sessions (no token and no firebaseUid) — force re-auth
      if (!session.token && !session.firebaseUid) {
        localStorage.removeItem('servi_user_session');
        window.__user = null;
        return;
      }
      let tokenPayload = null;
      if (session.token) {
        const parts = session.token.split('.');
        if (parts.length === 3) {
          tokenPayload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
          if (tokenPayload.exp && Date.now() / 1000 > tokenPayload.exp) {
            localStorage.removeItem('servi_user_session');
            window.__user = null;
            return;
          }
        }
      }
      // Build window.__user: start from session.user, then overlay fields
      // from the signed token payload so that fields added after a session
      // was originally stored (e.g. phone) are picked up on the next page load.
      const base = session.user || {};
      window.__user = {
        id:    base.id    || tokenPayload?.user_id || null,
        email: base.email || tokenPayload?.email   || null,
        name:  base.name  || tokenPayload?.name    || null,
        phone: base.phone || tokenPayload?.phone   || null,
      };
      if (!window.__user.id) { window.__user = null; }
      console.log('[SERVI] session restored:', window.__user);
    } catch (e) { window.__user = null; }
  }

  // Expose globally so i18n can re-render
  window.buildNavbar = function () {
    restoreSession();
    const el = document.getElementById('navbar');
    if (el) el.innerHTML = buildNav();
    if (el) el.style.visibility = 'visible';
  };

  // ─── User menu dropdown toggle + click-outside ──
  window.toggleUserMenu = function () {
    var dd = document.getElementById('user-menu-dropdown');
    if (dd) dd.classList.toggle('user-menu-dropdown--open');
  };
  document.addEventListener('click', function (e) {
    var menu = document.getElementById('user-menu');
    var dd = document.getElementById('user-menu-dropdown');
    if (dd && menu && !menu.contains(e.target)) {
      dd.classList.remove('user-menu-dropdown--open');
    }
  });

  window.toggleMobileMenu = function (show) {
    const overlay = document.getElementById('mobile-overlay');
    const menu = document.getElementById('mobile-menu');
    if (overlay) overlay.style.display = show ? 'block' : 'none';
    if (menu) menu.style.display = show ? 'block' : 'none';
    document.body.style.overflow = show ? 'hidden' : '';
  };

  // Scroll-aware navbar
  function initScrollWatcher() {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const nav = document.getElementById('site-navbar');
          if (nav) {
            if (window.scrollY > 40) nav.classList.add('navbar--scrolled');
            else nav.classList.remove('navbar--scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.buildNavbar(); initScrollWatcher(); });
  } else {
    window.buildNavbar();
    initScrollWatcher();
  }

  // Re-render on language change
  window.addEventListener('langchange', () => { window.buildNavbar(); });
})();
