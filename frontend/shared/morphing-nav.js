// ─── SERVI Site Header — Three-State (Hero / Scrolled-Collapsed / Scrolled-Expanded) ──
// Landing page header. Renders:
//   1. Persistent rectangular floating header (logo · nav links · hamburger)
//   2. A booking search pill that only appears once past the hero search
//   3. A non-modal scrim + expanded panel for segmented pill (prompt / categories)
//   4. A right-side drawer for the hamburger (links, language toggle, auth row)
//
// State machine (data-state on .site-header):
//   A "hero"              — at top of hero; 3 nav links visible; pill hidden
//   B "scrolled"          — past hero; nav links hidden; pill collapsed + visible
//   C "scrolled-expanded" — pill active; scrim + panel visible; nav links re-appear
//
// Backward-compat entry points preserved:
//   window.buildNavbar, window.updateNavForAuth,
//   window._heroSearchSubmit, window._heroChipClick

(function () {

  // ─── Session restore (unchanged from previous implementation) ──────────
  function restoreSession() {
    try {
      const raw = localStorage.getItem('servi_user_session');
      if (!raw) { window.__user = null; return; }
      const session = JSON.parse(raw);
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
            const expiredAgo = Math.floor(Date.now() / 1000) - tokenPayload.exp;
            if (expiredAgo <= 86400) {
              const base = session.user || {};
              window.__user = {
                id: base.id || tokenPayload?.user_id || null,
                email: base.email || tokenPayload?.email || null,
                name: base.name || tokenPayload?.name || null,
                phone: base.phone || tokenPayload?.phone || null,
                auth_provider: base.auth_provider || null,
              };
              if (!window.__user.id) { window.__user = null; return; }
              (async function tryRefresh() {
                try {
                  const apiBase = ((window.CONFIG && window.CONFIG.API_BASE) || '').replace(/\/+$/, '');
                  const refreshRes = await fetch(apiBase + '/api/auth/refresh', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + session.token }
                  });
                  if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    if (data.token && data.user) {
                      const newSession = { token: data.token, user: data.user, firebaseUid: session.firebaseUid };
                      localStorage.setItem('servi_user_session', JSON.stringify(newSession));
                      window.__user = data.user;
                      if (window.buildNavbar) window.buildNavbar();
                    }
                  } else {
                    localStorage.removeItem('servi_user_session');
                    window.__user = null;
                    window.__sessionExpired = true;
                    if (window.buildNavbar) window.buildNavbar();
                  }
                } catch (_) {}
              })();
              return;
            }
            localStorage.removeItem('servi_user_session');
            window.__user = null;
            window.__sessionExpired = true;
            return;
          }
        }
      }
      const base = session.user || {};
      window.__user = {
        id: base.id || tokenPayload?.user_id || null,
        email: base.email || tokenPayload?.email || null,
        name: base.name || tokenPayload?.name || null,
        phone: base.phone || tokenPayload?.phone || null,
        auth_provider: base.auth_provider || null,
      };
      if (!window.__user.id) { window.__user = null; }
    } catch (e) { window.__user = null; }
  }

  // ─── Icons ──────────────────────────────────────────────────────────────
  const ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    hamburger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  };

  // ─── Build: the header bar ──────────────────────────────────────────────
  function buildHeader() {
    const t = window.__t;
    return `
    <header class="site-header" data-state="hero" id="site-header">
      <div class="site-header__bar">
        <a class="site-header__logo" href="/index.html" aria-label="SERVI">SERVI<span class="site-header__logo-dot">.</span></a>

        <nav class="site-header__links" aria-label="Primary">
          <a class="site-header__link" href="#services" data-scroll="services"
            data-active="${(window.location.pathname === '/' || window.location.pathname === '/index.html') ? 'true' : 'false'}"
            >${t.header.linkServices}</a>
          <a class="site-header__link" href="/helpcenter.html"
            data-active="${window.location.pathname.startsWith('/helpcenter') ? 'true' : 'false'}"
            >${t.header.linkHelp}</a>
          <a class="site-header__link" href="/partners.html"
            data-active="${window.location.pathname.startsWith('/partners') ? 'true' : 'false'}"
            >${t.header.linkPartners}</a>
        </nav>

        <div class="site-header__center">
          <div class="site-header__pill" role="search" aria-label="${t.header.pillDescribe || 'Search'}">
            <button type="button" class="search-pill__segment search-pill__segment--describe" data-segment="describe" aria-label="${t.header.pillDescribe || 'Describe'}">
              <span class="search-pill__icon">${ICON.search}</span>
              <span class="search-pill__label">${t.header.pillDescribe || 'Describe what you need'}</span>
            </button>
            <span class="search-pill__divider" aria-hidden="true"></span>
            <button type="button" class="search-pill__segment search-pill__segment--when" data-segment="when" aria-label="${t.header.pillWhen || 'When'}">
              <span class="search-pill__label search-pill__label--when" id="pill-when-label">${t.header.pillWhen || 'When'}</span>
            </button>
          </div>
          <button type="button" class="site-header__browse-btn" data-segment="browse" aria-label="${t.header.pillBrowse || 'Browse'}">
            <span>${t.header.pillBrowse || 'Browse'}</span>
          </button>
          <div class="search-pill-popover" id="search-pill-popover" aria-hidden="true" data-segment=""></div>
        </div>

        <button type="button" class="site-header__hamburger" id="site-hamburger" aria-label="${t.header.menu}" aria-controls="site-drawer">
          ${ICON.hamburger}
        </button>
      </div>

      <div class="site-header__panel" id="site-header-panel" data-active-segment="" aria-hidden="true"></div>
    </header>

    <div class="site-header__scrim" id="site-scrim" aria-hidden="true"></div>

    <aside id="site-drawer" class="site-drawer" aria-hidden="true" aria-label="${t.header.menu}"></aside>
    <div class="site-drawer__scrim" id="site-drawer-scrim" aria-hidden="true"></div>
    `;
  }

  // ─── Build: drawer content ──────────────────────────────────────────────
  function buildDrawerContent() {
    const t = window.__t;
    const lang = window.__lang;
    const onHome = (window.location.pathname === '/' || window.location.pathname === '/index.html');

    function scrollLink(anchor, label) {
      if (onHome) {
        return `<button type="button" class="site-drawer__link" data-scroll="${anchor}">${label}</button>`;
      }
      return `<a class="site-drawer__link" href="/index.html#${anchor}">${label}</a>`;
    }

    const authRow = window.__user
      ? `
        <div class="site-drawer__user">
          <div class="site-drawer__avatar">${((window.__user.name || window.__user.email || '?')[0]).toUpperCase()}</div>
          <div class="site-drawer__user-meta">
            <div class="site-drawer__user-name">${window.__user.name || ''}</div>
            <div class="site-drawer__user-contact">${window.__user.email || window.__user.phone || ''}</div>
          </div>
        </div>
        <a class="site-drawer__row" href="/account.html">
          <span class="site-drawer__row-icon">${ICON.user}</span>
          <span>${lang === 'es' ? 'Mi cuenta' : 'My account'}</span>
        </a>
        <button type="button" class="site-drawer__row site-drawer__row--danger" data-action="logout">
          <span class="site-drawer__row-icon">${ICON.logout}</span>
          <span>${lang === 'es' ? 'Cerrar sesión' : 'Log out'}</span>
        </button>
      `
      : `
        <button type="button" class="site-drawer__auth" data-action="login">
          <span class="site-drawer__row-icon">${ICON.user}</span>
          <span>${t.header.authRow}</span>
        </button>
      `;

    return `
      <div class="site-drawer__header">
        <span class="site-drawer__title">${t.header.menu}</span>
        <button type="button" class="site-drawer__close" data-action="close-drawer" aria-label="${t.header.close}">${ICON.close}</button>
      </div>
      <nav class="site-drawer__nav" aria-label="${t.header.menu}">
        ${scrollLink('services', t.header.linkServices)}
        <a class="site-drawer__link" href="/helpcenter.html">${t.header.linkHelp}</a>
        <a class="site-drawer__link" href="/partners.html">${t.header.linkPartners}</a>
        ${onHome ? `
          <div class="site-drawer__divider"></div>
          ${scrollLink('how', t.nav.howItWorks)}
          ${scrollLink('testimonials', t.nav.testimonials)}
        ` : ''}
      </nav>
      <div class="site-drawer__divider"></div>
      <div class="site-drawer__section">
        <div class="site-drawer__section-label">
          <span class="site-drawer__row-icon">${ICON.globe}</span>
          ${t.header.language}
        </div>
        <div class="site-drawer__lang">
          <button type="button" class="site-drawer__lang-btn${lang === 'es' ? ' is-active' : ''}" data-action="lang-es">ES</button>
          <button type="button" class="site-drawer__lang-btn${lang === 'en' ? ' is-active' : ''}" data-action="lang-en">EN</button>
        </div>
      </div>
      <div class="site-drawer__divider"></div>
      <div class="site-drawer__section">
        ${authRow}
      </div>
    `;
  }

  // ─── Build: panel content (suggestions OR categories) ────────────────────
  // Suggestions-only panel (search input is now inline in row 2 of the bar)
  function buildSuggestionsPanel() {
    const t = window.__t;
    const suggestions = (t.heroSuggestions || []);
    if (!suggestions.length) return '';
    return `
      <div class="header-panel header-panel--prompt">
        <div class="header-panel__suglabel">${t.hero2.suggestionsLabel || ''}</div>
        <ul class="header-panel__suggestions">
          ${suggestions.map(s => `<li><button type="button" class="header-panel__suggestion" data-suggestion="${s.replace(/"/g,'&quot;')}">${s}</button></li>`).join('')}
        </ul>
      </div>
    `;
  }

  function buildCategoriesPanel() {
    const t = window.__t;
    const cats = [
      { key: 'cleaning', sub: t.categories.cleaningSub },
      { key: 'repair', sub: t.categories.repairSub },
      { key: 'moving', sub: t.categories.movingSub },
      { key: 'wellness', sub: t.categories.wellnessSub },
      { key: 'suppliers', sub: t.categories.suppliersSub },
    ];
    return `
      <div class="header-panel header-panel--categories">
        <div class="header-panel__cats">
          ${cats.map(({key, sub}) => `
            <button type="button" class="header-panel__cat" data-category="${key}">
              <div class="header-panel__cat-title">${t.categories[key]}</div>
              <div class="header-panel__cat-sub">${(sub || []).slice(0,3).join(' · ')}</div>
              <span class="header-panel__cat-arrow">${ICON.arrow}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function buildDescribePanel() {
    const t = window.__t;
    const suggestions = t.heroSuggestions || [];
    return `
      <div class="spp-panel" data-panel="describe">
        <div class="spp-input-row">
          <input type="text" class="spp-input" id="spp-describe-input"
            placeholder="${t.header.pillDescribe || 'Describe what you need'}"
            autocomplete="off">
          <button type="button" class="spp-icon-btn" data-action="spp-camera" aria-label="Camera">${ICON.camera}</button>
          <button type="button" class="spp-icon-btn" data-action="spp-mic" aria-label="Mic">${ICON.mic}</button>
          <button type="button" class="spp-submit-btn" data-action="spp-submit" aria-label="Submit">${ICON.arrow}</button>
        </div>
        ${suggestions.length ? `
          <div class="spp-suggestions-label">${t.hero2.suggestionsLabel || 'Try asking'}</div>
          <ul class="spp-suggestions">
            ${suggestions.slice(0, 4).map(s => `<li><button type="button" class="spp-suggestion" data-suggestion="${s.replace(/"/g,'&quot;')}">${s}</button></li>`).join('')}
          </ul>
        ` : ''}
      </div>
    `;
  }

  function buildWhenPanel() {
    const t = window.__t;
    const isAsap = state.whenChoice === 'asap';
    const isDate = state.whenChoice === 'date';
    return `
      <div class="spp-panel" data-panel="when">
        <div class="spp-when-opts">
          <button type="button" class="spp-when-opt" data-action="spp-when-asap" data-selected="${isAsap}">
            <span class="spp-when-opt-icon">${ICON.zap}</span>
            ${t.header.pillWhenAsap || 'As soon as possible'}
          </button>
          <button type="button" class="spp-when-opt" data-action="spp-when-date" data-selected="${isDate}">
            <span class="spp-when-opt-icon">${ICON.calendar}</span>
            ${t.header.pillWhenDate || 'Choose a date'}
          </button>
          <input type="date" class="spp-date-input" id="spp-date-input"
            ${isDate ? '' : 'hidden'}
            value="${state.whenDate}"
            min="${new Date().toISOString().split('T')[0]}">
        </div>
      </div>
    `;
  }

  function _updateWhenLabel() {
    const el = document.getElementById('pill-when-label');
    if (!el) return;
    const t = window.__t;
    if (state.whenChoice === 'asap') {
      el.textContent = t.header.pillWhenAsap || 'ASAP';
      el.style.color = 'var(--color-accent)';
    } else if (state.whenChoice === 'date' && state.whenDate) {
      const d = new Date(state.whenDate + 'T12:00:00');
      el.textContent = d.toLocaleDateString(window.__lang === 'es' ? 'es-MX' : 'en-US', { month: 'short', day: 'numeric' });
      el.style.color = 'var(--color-accent)';
    } else {
      el.textContent = t.header.pillWhen || 'When';
      el.style.color = '';
    }
  }

  // ─── State machine ─────────────────────────────────────────────────────
  const state = {
    scroll: 'hero',      // 'hero' | 'scrolled'
    segment: null,       // null | 'describe' | 'when' | 'browse'
    drawerOpen: false,
    whenChoice: 'asap',  // 'asap' | 'date'
    whenDate: '',        // ISO date string when choice === 'date'
  };

  function _showActivePanel(segment) {
    const popover = document.getElementById('search-pill-popover');
    if (!popover) return;
    const body = popover.querySelector('.spp-body');
    if (!body) return;

    // Show the matching panel, hide others
    const panels = body.querySelectorAll('.spp-panel');
    let targetHeight = 0;
    panels.forEach(p => {
      const isTarget = p.getAttribute('data-panel') === segment;
      p.setAttribute('data-visible', isTarget ? 'true' : 'false');
      if (isTarget) targetHeight = p.scrollHeight;
    });

    // Animate body height to new panel's natural height
    body.style.height = targetHeight + 'px';

    // Update popover width based on segment
    popover.setAttribute('data-segment', segment);
  }

  function applyHeaderState() {
    const header = document.getElementById('site-header');
    const scrim = document.getElementById('site-scrim');
    const popover = document.getElementById('search-pill-popover');
    const panel = document.getElementById('site-header-panel');
    if (!header) return;

    // Header data-state drives bar expansion + scrim
    let ds;
    if (state.segment === 'describe' || state.segment === 'when') ds = 'scrolled-expanded';
    else if (state.scroll === 'scrolled') ds = 'scrolled';
    else ds = 'hero';
    header.setAttribute('data-state', ds);

    // Pill segment active highlights
    document.querySelectorAll('.search-pill__segment').forEach(btn => {
      btn.setAttribute('data-active', btn.getAttribute('data-segment') === state.segment ? 'true' : 'false');
    });

    // Browse button active highlight
    const browseBtn = document.querySelector('.site-header__browse-btn');
    if (browseBtn) browseBtn.setAttribute('data-active', state.segment === 'browse' ? 'true' : 'false');

    if (state.segment === 'describe' || state.segment === 'when') {
      scrim.setAttribute('data-visible', 'true');
      scrim.setAttribute('aria-hidden', 'false');

      if (popover) {
        const alreadyOpen = popover.getAttribute('data-open') === 'true';
        popover.setAttribute('data-segment', state.segment);
        popover.setAttribute('data-open', 'true');
        popover.setAttribute('aria-hidden', 'false');

        if (!alreadyOpen) {
          // First open: render both panels into the popover
          popover.innerHTML = `<div class="spp-body">
            ${buildDescribePanel()}
            ${buildWhenPanel()}
          </div>`;
          // Set initial heights after render
          requestAnimationFrame(() => {
            _showActivePanel(state.segment);
            if (state.segment === 'describe') {
              const inp = document.getElementById('spp-describe-input');
              if (inp) inp.focus();
            }
          });
        } else {
          // Already open — just switch active panel (no rebuild)
          _showActivePanel(state.segment);
          if (state.segment === 'describe') {
            const inp = document.getElementById('spp-describe-input');
            if (inp) inp.focus();
          }
        }
      }

      // Clear legacy panel (no longer drives content)
      if (panel) { panel.setAttribute('data-active-segment', ''); panel.setAttribute('aria-hidden', 'true'); panel.innerHTML = ''; }

    } else {
      // Closed
      scrim.removeAttribute('data-visible');
      scrim.setAttribute('aria-hidden', 'true');
      if (popover) {
        popover.removeAttribute('data-open');
        popover.setAttribute('aria-hidden', 'true');
        popover.setAttribute('data-segment', '');
        setTimeout(() => { if (popover.getAttribute('data-open') !== 'true') popover.innerHTML = ''; }, 260);
      }
      if (panel) { panel.setAttribute('data-active-segment', ''); panel.setAttribute('aria-hidden', 'true'); panel.innerHTML = ''; }
    }
  }

  function openSegment(seg) {
    if (seg === 'browse') {
      state.segment = null;
      applyHeaderState();
      // Scroll to categories on the landing page, or navigate there
      if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
        document.getElementById('landing-hero')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.location.href = '/index.html#services';
      }
      return;
    }
    state.segment = seg;
    applyHeaderState();
  }
  function closeSegment() {
    state.segment = null;
    applyHeaderState();
  }

  // ─── Drawer ────────────────────────────────────────────────────────────
  function openDrawer() {
    const drawer = document.getElementById('site-drawer');
    const scrim = document.getElementById('site-drawer-scrim');
    if (!drawer) return;
    drawer.innerHTML = buildDrawerContent();
    drawer.setAttribute('data-open', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    scrim.setAttribute('data-open', 'true');
    scrim.setAttribute('aria-hidden', 'false');
    state.drawerOpen = true;
  }
  function closeDrawer() {
    const drawer = document.getElementById('site-drawer');
    const scrim = document.getElementById('site-drawer-scrim');
    if (!drawer) return;
    drawer.removeAttribute('data-open');
    drawer.setAttribute('aria-hidden', 'true');
    scrim.removeAttribute('data-open');
    scrim.setAttribute('aria-hidden', 'true');
    state.drawerOpen = false;
  }

  // ─── Booking routing (preserve existing contracts) ────────────────────
  function routeToBookingIntake(seedText) {
    if (window.openConversation && !window.__legacyBooking) {
      window.openConversation(seedText || '');
      return;
    }
    if (window.openBooking) {
      window.openBooking();
      if (seedText) {
        setTimeout(() => {
          window.bookingState && (window.bookingState.description = seedText);
          const desc = document.getElementById('booking-desc');
          if (desc) desc.value = seedText;
        }, 100);
      }
    }
  }

  window._heroSearchSubmit = function () {
    const input = document.getElementById('hero-search-input');
    const val = input ? input.value.trim() : '';
    routeToBookingIntake(val);
    if (input) input.value = '';
  };

  window._heroChipClick = function (text) {
    const input = document.getElementById('hero-search-input');
    if (input) input.value = text;
    routeToBookingIntake(text);
    if (input) input.value = '';
  };

  // ─── Delegated event handler ───────────────────────────────────────────
  function onRootClick(e) {
    // Pill segments
    const seg = e.target.closest('.search-pill__segment');
    if (seg) {
      const which = seg.getAttribute('data-segment');
      if (which !== 'browse' && state.segment === which) closeSegment();
      else openSegment(which);
      return;
    }
    // Scrim (page dim): close segment
    if (e.target.id === 'site-scrim') { closeSegment(); return; }
    // Drawer scrim
    if (e.target.id === 'site-drawer-scrim') { closeDrawer(); return; }
    // Hamburger
    if (e.target.closest('#site-hamburger')) {
      if (state.drawerOpen) closeDrawer(); else openDrawer();
      return;
    }
    // Inside drawer
    const drawer = e.target.closest('#site-drawer');
    if (drawer) {
      const action = e.target.closest('[data-action]')?.getAttribute('data-action');
      const scrollTarget = e.target.closest('[data-scroll]')?.getAttribute('data-scroll');
      const link = e.target.closest('a.site-drawer__link, a.site-drawer__row');
      if (action === 'close-drawer') { closeDrawer(); return; }
      if (action === 'logout') {
        closeDrawer();
        window.logoutUser && window.logoutUser();
        return;
      }
      if (action === 'login') {
        closeDrawer();
        window.openAuthModal && window.openAuthModal('login');
        return;
      }
      if (action === 'lang-es') {
        window.setLang && window.setLang('es');
        // re-render the drawer content with new strings
        drawer.innerHTML = buildDrawerContent();
        return;
      }
      if (action === 'lang-en') {
        window.setLang && window.setLang('en');
        drawer.innerHTML = buildDrawerContent();
        return;
      }
      if (scrollTarget) {
        closeDrawer();
        setTimeout(() => {
          document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth' });
        }, 60);
        return;
      }
      if (link) { closeDrawer(); return; }
    }

    // Header links "Services" anchor (same-page scroll)
    const headerLink = e.target.closest('.site-header__link[data-scroll]');
    if (headerLink) {
      const tgt = headerLink.getAttribute('data-scroll');
      e.preventDefault();
      document.getElementById(tgt)?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    // Popover (morphing pill) interactions
    const popover = e.target.closest('#search-pill-popover');
    if (popover) {
      const action = e.target.closest('[data-action]')?.getAttribute('data-action');
      const suggestion = e.target.closest('[data-suggestion]')?.getAttribute('data-suggestion');

      if (suggestion) {
        closeSegment();
        routeToBookingIntake(suggestion);
        return;
      }
      if (action === 'spp-submit') {
        const inp = document.getElementById('spp-describe-input');
        const val = inp ? inp.value.trim() : '';
        closeSegment();
        routeToBookingIntake(val);
        return;
      }
      if (action === 'spp-camera') {
        closeSegment();
        window._dashShowCameraExplain && window._dashShowCameraExplain();
        return;
      }
      if (action === 'spp-mic') {
        closeSegment();
        window._dashShowMicExplain && window._dashShowMicExplain();
        return;
      }
      if (action === 'spp-when-asap') {
        state.whenChoice = 'asap';
        state.whenDate = '';
        _updateWhenLabel();
        // Update UI in place
        const pop = document.getElementById('search-pill-popover');
        if (pop) {
          const asapBtn = pop.querySelector('[data-action="spp-when-asap"]');
          const dateBtn = pop.querySelector('[data-action="spp-when-date"]');
          const dateInput = pop.querySelector('#spp-date-input');
          if (asapBtn) asapBtn.setAttribute('data-selected', 'true');
          if (dateBtn) dateBtn.setAttribute('data-selected', 'false');
          if (dateInput) dateInput.hidden = true;
          // Re-sync body height
          _showActivePanel('when');
        }
        return;
      }
      if (action === 'spp-when-date') {
        state.whenChoice = 'date';
        _updateWhenLabel();
        const pop = document.getElementById('search-pill-popover');
        if (pop) {
          const asapBtn = pop.querySelector('[data-action="spp-when-asap"]');
          const dateBtn = pop.querySelector('[data-action="spp-when-date"]');
          const dateInput = pop.querySelector('#spp-date-input');
          if (asapBtn) asapBtn.setAttribute('data-selected', 'false');
          if (dateBtn) dateBtn.setAttribute('data-selected', 'true');
          if (dateInput) { dateInput.hidden = false; dateInput.focus(); }
          _showActivePanel('when');
        }
        return;
      }
      return; // swallow unhandled clicks inside popover
    }

    // Panel interactions (suggestions + categories dropdown)
    const panel = e.target.closest('#site-header-panel');
    if (panel) {
      const suggestion = e.target.closest('[data-suggestion]')?.getAttribute('data-suggestion');
      const category = e.target.closest('[data-category]')?.getAttribute('data-category');
      if (suggestion) {
        closeSegment();
        routeToBookingIntake(suggestion);
        return;
      }
      if (category) {
        closeSegment();
        window.openBooking && window.openBooking(category);
        return;
      }
    }
  }

  function onRootChange(e) {
    if (e.target && e.target.id === 'spp-date-input') {
      state.whenDate = e.target.value;
      _updateWhenLabel();
    }
  }

  function onRootKeydown(e) {
    if (e.key === 'Escape') {
      if (state.segment) closeSegment();
      else if (state.drawerOpen) closeDrawer();
    }
    if (e.key === 'Enter') {
      if (e.target && (e.target.id === 'header-panel-input' || e.target.id === 'spp-describe-input')) {
        e.preventDefault();
        const val = e.target.value.trim();
        closeSegment();
        routeToBookingIntake(val);
      }
    }
  }

  // ─── Scroll state observation ─────────────────────────────────────────
  let _scrollObserver = null;
  function initScrollObserver() {
    if (_scrollObserver) _scrollObserver.disconnect();
    const heroSearch = document.getElementById('hero-search-bar');
    const hero = document.querySelector('.landing-hero') || document.querySelector('.dash-hero');
    const sentinel = heroSearch || hero;

    if (!sentinel) {
      state.scroll = 'scrolled';
      applyHeaderState();
      return;
    }
    state.scroll = 'hero';
    applyHeaderState();

    _scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        state.scroll = entry.isIntersecting ? 'hero' : 'scrolled';
        applyHeaderState();
      });
    }, { threshold: 0, rootMargin: '-72px 0px 0px 0px' });
    _scrollObserver.observe(sentinel);
  }

  // ─── Hero parallax: direct transform per object (no CSS var cascade) ────
  let _parallaxAttached = false;
  function initHeroParallax() {
    const hero = document.querySelector('.landing-hero');
    if (!hero || _parallaxAttached) return;
    _parallaxAttached = true;

    // Trajectories: large enough to fully exit the viewport
    const TRAJ = {
      'hero-object--tl': { dx: -480, dy: -380 },
      'hero-object--tr': { dx:  480, dy: -380 },
      'hero-object--bl': { dx: -520, dy:  340 },
      'hero-object--br': { dx:  520, dy:  340 },
    };
    const TRAJ_MOBILE = {
      'hero-object--tl': { dx: -220, dy: -180 },
      'hero-object--tr': { dx:  220, dy: -180 },
      'hero-object--bl': { dx: -240, dy:  160 },
      'hero-object--br': { dx:  240, dy:  160 },
    };
    const objData = Array.from(hero.querySelectorAll('.hero-object')).map(el => {
      const key = Object.keys(TRAJ).find(k => el.classList.contains(k)) || '';
      return { el, key };
    });

    // Cache hero absolute position — avoids getBoundingClientRect on every frame
    let heroTop = 0, heroHeight = 1;
    function cacheLayout() {
      const rect = hero.getBoundingClientRect();
      heroTop   = rect.top + window.scrollY;
      heroHeight = Math.max(rect.height, 1);
    }
    cacheLayout();
    window.addEventListener('resize', () => { cacheLayout(); update(); }, { passive: true });

    let ticking = false;
    function update() {
      const scrollY = window.scrollY;
      const p = Math.min(1, Math.max(0, (scrollY - heroTop) / heroHeight));
      const mobile = window.innerWidth <= 900;
      const map = mobile ? TRAJ_MOBILE : TRAJ;
      for (const { el, key } of objData) {
        const { dx, dy } = map[key] || { dx: 0, dy: 0 };
        el.style.transform = `translate3d(${dx * p}px,${dy * p}px,0)`;
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  // ─── Public entry points ──────────────────────────────────────────────
  window.buildNavbar = function () {
    restoreSession();
    const el = document.getElementById('navbar');
    if (!el) return;
    el.innerHTML = buildHeader();
    el.style.visibility = 'visible';

    // Reset internal state; DOM was wiped
    state.segment = null;
    state.drawerOpen = false;

    // Attach delegated listeners once
    if (!document.body.__servisiteHeaderBound) {
      document.addEventListener('click', onRootClick);
      document.addEventListener('keydown', onRootKeydown);
      document.addEventListener('change', onRootChange);
      document.body.__servisiteHeaderBound = true;
    }
    initScrollObserver();
    initHeroParallax();
  };

  window.updateNavForAuth = function () {
    window.buildNavbar && window.buildNavbar();
  };

  // ─── Auto-init & re-render on language change ─────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { window.buildNavbar(); });
  } else {
    window.buildNavbar();
  }
  window.addEventListener('langchange', () => { window.buildNavbar(); });

  // ─── Legacy hamburger shim (used by some shared scripts) ──────────────
  window.toggleMobileMenu = function (show) {
    if (show) openDrawer(); else closeDrawer();
  };
})();
