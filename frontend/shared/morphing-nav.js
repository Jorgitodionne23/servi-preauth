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
  const BROWSE_HEADER_MORPH_Y = 180;

  function getBrowseHeaderMorphY() {
    return BROWSE_HEADER_MORPH_Y;
  }

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
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 010 20M12 2a15 15 0 000 20"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  };

  // ─── Account icon (shown beside hamburger when logged in) ──────────────
  function buildAccountBtn() {
    if (!window.__user) return '';
    const initial = ((window.__user.name || window.__user.email || '?')[0]).toUpperCase();
    return `<a class="site-header__account-btn" href="/account.html" aria-label="Mi cuenta" title="${window.__user.name || window.__user.email || 'Mi cuenta'}">${initial}</a>`;
  }

  // ─── Section variant detection ──────────────────────────────────────────
  // Section pages get a dedicated sub-brand header (no pill/browse).
  //   partners:   /partners.html, /partners/*, /handbook.html, /handbook/*
  //   helpcenter: /helpcenter.html, /helpcenter/*, /legal.html
  function detectSectionVariant() {
    const p = window.location.pathname;
    if (p.startsWith('/partners') || p.startsWith('/handbook')) return 'partners';
    if (p.startsWith('/helpcenter') || p === '/legal.html' || p.startsWith('/legal')) return 'helpcenter';
    return null;
  }

  function buildSectionHeader(variant) {
    const t = window.__t;
    const lang = window.__lang || 'es';
    const p = window.location.pathname;

    // Sub-link lists per section — last link is the CTA.
    const SECTION_CONFIG = {
      partners: {
        label: 'Partners',
        logoHref: '/partners.html',
        links: [
          { href: '/partners.html#what',       match: () => p === '/partners.html' && (window.location.hash === '' || window.location.hash === '#what'), label: { es: '¿Qué es?',   en: 'What is it?' } },
          { href: '/partners.html#how',        match: () => p === '/partners.html' && window.location.hash === '#how',                                   label: { es: '¿Cómo?',     en: 'How' } },
          { href: '/handbook.html',            match: () => p === '/handbook.html' || p.startsWith('/handbook/'),                                         label: { es: 'Handbook',   en: 'Handbook' } },
          { href: '/partners/registro.html',   match: () => p.startsWith('/partners/'),                                                                   label: { es: 'Regístrate', en: 'Register' }, cta: true },
        ],
      },
      helpcenter: {
        label: lang === 'es' ? 'Help Center' : 'Help Center',
        logoHref: '/helpcenter.html',
        links: [
          { href: '/helpcenter/suggestion.html', match: () => p === '/helpcenter/suggestion.html', label: { es: 'Sugerencia',    en: 'Suggestion' } },
          { href: '/helpcenter/quienes-somos.html', match: () => p === '/helpcenter/quienes-somos.html', label: { es: 'Quiénes Somos', en: 'About Us' } },
          { href: '/helpcenter/contactanos.html',   match: () => p === '/helpcenter/contactanos.html',   label: { es: 'Contáctanos',   en: 'Contact' } },
          { href: '/helpcenter/report.html',        match: () => p === '/helpcenter/report.html',        label: { es: 'Reportar',      en: 'Report' }, cta: true },
        ],
      },
    };

    const cfg = SECTION_CONFIG[variant];
    const linksHtml = cfg.links.map(l => {
      const active = l.match() ? 'true' : 'false';
      const extra = l.cta ? ' site-header__link--cta' : '';
      return `<a class="site-header__link${extra}" href="${l.href}" data-active="${active}">${l.label[lang] || l.label.es}</a>`;
    }).join('');

    return `
    <header class="site-header" data-state="section" data-variant="section" id="site-header">
      <div class="site-header__bar">
        <div class="site-header__logo site-header__logo--section logo">
          <a href="${(variant === 'partners' || variant === 'helpcenter') ? '/index.html' : cfg.logoHref}" class="site-header__logo-servi" style="text-decoration:none">SERVI</a>
          <span class="site-header__logo-divider" aria-hidden="true"></span>
          <a href="${cfg.logoHref}" class="site-header__logo-section" style="text-decoration:none">${cfg.label}<span class="logo-dot">.</span></a>
        </div>

        <nav class="site-header__links site-header__links--section" aria-label="Section">
          ${linksHtml}
        </nav>

        <div class="site-header__right">
          ${buildAccountBtn()}
          <button type="button" class="site-header__hamburger" id="site-hamburger" aria-label="${t.header.menu}" aria-controls="site-drawer">
            ${ICON.hamburger}
          </button>
        </div>
      </div>
    </header>

    <div class="site-header__scrim" id="site-scrim" aria-hidden="true"></div>

    <aside id="site-drawer" class="site-drawer" aria-hidden="true" aria-label="${t.header.menu}"></aside>
    <div class="site-drawer__scrim" id="site-drawer-scrim" aria-hidden="true"></div>
    `;
  }

  // ─── Build: the header bar ──────────────────────────────────────────────
  function buildHeader() {
    const sectionVariant = detectSectionVariant();
    if (sectionVariant) return buildSectionHeader(sectionVariant);

    const t = window.__t;
    const isSmartRequestPage = window.location.pathname === '/smart-request.html';
    const isBrowsePage = window.location.pathname === '/browse.html';
    const browseAttr = isBrowsePage ? ' data-page="browse"' : '';
    const onHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
    const isServicesPage = onHome || isSmartRequestPage || window.location.pathname === '/browse.html' || window.location.pathname === '/service.html';
    // Pre-compute correct initial state for browse so the bar renders at the
    // right size immediately — avoids the height/grid-row transition on load.
    const foldY = isBrowsePage ? getBrowseHeaderMorphY() : 0;
    const initialState = isBrowsePage
      ? (window.scrollY < foldY ? 'browse-expanded' : 'scrolled')
      : 'hero';
    return `
    <header class="site-header" data-state="${initialState}" id="site-header"${browseAttr}>
      <div class="site-header__bar">
        <a href="/index.html" class="site-header__logo logo" style="text-decoration:none;color:#000">SERVI<span class="logo-dot" style="color:#000">.</span></a>

        <nav class="site-header__links" aria-label="Primary">
          <a class="site-header__link" href="${onHome ? '#landing-hero' : '/index.html#landing-hero'}" ${onHome ? 'data-scroll="landing-hero"' : ''}
            data-active="${isServicesPage ? 'true' : 'false'}"
            >${t.header.linkServices}</a>
          <a class="site-header__link" href="/helpcenter.html"
            data-active="${window.location.pathname.startsWith('/helpcenter') ? 'true' : 'false'}"
            >${t.header.linkHelp}</a>
          <a class="site-header__link" href="/partners.html"
            data-active="${window.location.pathname.startsWith('/partners') ? 'true' : 'false'}"
            >${t.header.linkPartners}</a>
        </nav>

        ${isSmartRequestPage ? '' : `<div class="site-header__center">
          <div class="site-header__pill" role="search" aria-label="${t.header.pillDescribe || 'Search'}">
            <!-- Sliding "active card" highlight — glides + morphs between segments
                 (in scrolled-expanded) so the active surface and its popover move
                 as one. Geometry is published as CSS vars from JS. -->
            <div class="search-pill__active-card" aria-hidden="true"></div>
            <div class="search-pill__method-focus" aria-hidden="true"></div>
            <label class="search-pill__segment search-pill__segment--describe" data-segment="describe" aria-label="${t.header.pillDescribe || 'Describe'}">
              <span class="search-pill__icon">${ICON.search}</span>
              <textarea class="search-pill__label search-pill__input" id="spp-describe-input"
                placeholder="${t.header.pillDescribe || 'Describe what you need'}" autocomplete="off"
                spellcheck="false" rows="1" readonly></textarea>
              <button type="button" class="spp-submit-btn search-pill__submit-btn" data-action="spp-submit" aria-label="${(window.__lang || 'es') === 'es' ? 'Enviar' : 'Submit'}">${ICON.arrow}</button>
            </label>
            <span class="search-pill__divider" aria-hidden="true"></span>
            <button type="button" class="search-pill__segment search-pill__segment--camera" data-segment="camera" aria-label="${t.header.pillCamera || 'Camera'}">
              <span class="search-pill__icon">${ICON.camera}</span>
              <span class="search-pill__label search-pill__label--method">${t.header.pillCamera || 'Camera'}</span>
            </button>
            <span class="search-pill__divider" aria-hidden="true"></span>
            <button type="button" class="search-pill__segment search-pill__segment--voice" data-segment="voice" aria-label="${t.header.pillVoice || 'Voice'}">
              <span class="search-pill__icon">${ICON.mic}</span>
              <span class="search-pill__label search-pill__label--method">${t.header.pillVoice || 'Voice'}</span>
            </button>
          </div>
          ${isBrowsePage ? '' : `<button type="button" class="site-header__browse-btn" data-segment="browse" aria-label="${t.header.pillBrowse || 'Browse'}">
            <span>${t.header.pillBrowse || 'Browse'}</span>
          </button>`}
          <div class="search-pill-popover" id="search-pill-popover" aria-hidden="true" data-segment=""></div>
        </div>`}

        <div class="site-header__right">
          ${buildAccountBtn()}
          <button type="button" class="site-header__hamburger" id="site-hamburger" aria-label="${t.header.menu}" aria-controls="site-drawer">
            ${ICON.hamburger}
          </button>
        </div>
      </div>

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
    const onPartners = window.location.pathname.startsWith('/partners');
    const onHelpcenter = window.location.pathname.startsWith('/helpcenter');

    function scrollLink(anchor, label) {
      if (onHome) {
        return `<button type="button" class="site-drawer__link" data-scroll="${anchor}">${label}</button>`;
      }
      return `<a class="site-drawer__link" href="/index.html#${anchor}">${label}</a>`;
    }

    function partnersScrollLink(anchor, label) {
      if (onPartners) {
        return `<button type="button" class="site-drawer__link" data-scroll="${anchor}">${label}</button>`;
      }
      return `<a class="site-drawer__link" href="/partners.html#${anchor}">${label}</a>`;
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
        ${scrollLink('landing-hero', t.header.linkServices)}
        <a class="site-drawer__link" href="/helpcenter.html">${t.header.linkHelp}</a>
        <a class="site-drawer__link" href="/partners.html">${t.header.linkPartners}</a>
        ${onHome ? `
          <div class="site-drawer__divider"></div>
          <a class="site-drawer__link" href="/browse.html">${t.header.linkBrowse || t.header.pillBrowse || 'Browse services'}</a>
          ${scrollLink('how', t.nav.howItWorks)}
          ${scrollLink('testimonials', t.nav.testimonials)}
        ` : onPartners ? `
          <div class="site-drawer__divider"></div>
          <a class="site-drawer__link" href="/partners/registro.html">${lang === 'es' ? 'Regístrate' : 'Sign up'}</a>
          ${partnersScrollLink('what', lang === 'es' ? '¿Qué es?' : 'What is it?')}
          ${partnersScrollLink('how', lang === 'es' ? '¿Cómo?' : 'How?')}
          <a class="site-drawer__link" href="/handbook.html">${lang === 'es' ? 'Handbook' : 'Handbook'}</a>
        ` : onHelpcenter ? `
          <div class="site-drawer__divider"></div>
          <a class="site-drawer__link" href="/helpcenter/suggestion.html">${lang === 'es' ? 'Sugerencia' : 'Suggestion'}</a>
          <a class="site-drawer__link" href="/helpcenter/report.html">${lang === 'es' ? 'Reportar' : 'Report'}</a>
          <a class="site-drawer__link" href="/helpcenter/quienes-somos.html">${lang === 'es' ? 'Quiénes Somos' : 'About Us'}</a>
          <a class="site-drawer__link" href="/helpcenter/contactanos.html">${lang === 'es' ? 'Contáctanos' : 'Contact Us'}</a>
        ` : ''}
      </nav>
      <div class="site-drawer__divider"></div>
      <div class="site-drawer__section site-drawer__section--language">
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

  // The describe panel is either the supporting toolbar OR — once a media tool
  // is tapped — an in-place capture surface (photos / voice / video). Both render
  // inside the same popover so the pill never navigates away to capture.
  function buildDescribePanel() {
    return `<div class="spp-panel spp-panel--describe" data-panel="describe">${_describeInner()}</div>`;
  }

  // Each booking method now owns its own pill segment + popover panel.
  function _describeInner() {
    const lang = window.__lang || 'es';
    return `
      <div class="spp-toolbar">
        <button type="button" class="spp-submit-btn" data-action="spp-submit" aria-label="${lang === 'es' ? 'Enviar' : 'Submit'}">${ICON.arrow}</button>
      </div>
    `;
  }

  // ── Camera method panel — a chooser (Photos / Video) that drills into the
  // existing in-pill capture surfaces. ─────────────────────────────────────
  function buildCameraPanel() {
    return `<div class="spp-panel spp-panel--camera" data-panel="camera">${_cameraInner()}</div>`;
  }
  function _cameraInner() {
    // Once a sub-mode is chosen, reuse the shared capture engine in place.
    if (state.capMode === 'photos' || state.capMode === 'video') return _capturePanel();
    const es = _isEs();
    return `
      <div class="spp-cam-choose">
        <p class="spp-cam-choose__q">${es ? 'Describe tu solicitud con una foto o video.' : 'Describe your request with a photo or video.'}</p>
        <div class="spp-cam-choices">
          <button type="button" class="spp-cam-choice" data-action="spp-cam-photos">
            <span class="spp-cam-choice__ic">${ICON.camera}</span>
            <span class="spp-cam-choice__label">${es ? 'Fotos' : 'Photos'}</span>
          </button>
          <button type="button" class="spp-cam-choice" data-action="spp-cam-video">
            <span class="spp-cam-choice__ic">${ICON.video}</span>
            <span class="spp-cam-choice__label">${es ? 'Video' : 'Video'}</span>
          </button>
        </div>
      </div>
    `;
  }

  // ── Voice method panel — the existing in-pill voice recorder. ────────────
  function buildVoicePanel() {
    return `<div class="spp-panel spp-panel--voice" data-panel="voice">${_voiceInner()}</div>`;
  }
  function _voiceInner() {
    return _capVoicePanel();
  }

  // ─── In-pill media capture ──────────────────────────────────────────────
  // Mirrors the homepage hero's capture engine, but renders into the popover
  // (which is part of the pill) so the user can take photos / record voice /
  // record video without leaving the page. The captured media is handed to the
  // Smart Request review screen only on "Continue/Use" — never to open a tool.
  const _isEs = () => (window.__lang !== 'en');
  const _CAP_VIDEO_MAX_SECONDS = 30;
  function _capFmt(s) { const m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ':' + String(sec).padStart(2, '0'); }
  function _capEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function _capBars() { return Array(28).fill('<span></span>').join(''); }
  function _capStaticBars() { let o = ''; for (let i = 0; i < 28; i++) o += '<span style="transform:scaleY(' + (0.2 + Math.abs(Math.sin(i * 0.9)) * 0.8).toFixed(2) + ')"></span>'; return o; }

  function _capPickFiles(accept, multiple, capture, cb) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; if (multiple) inp.multiple = true; if (capture) inp.capture = capture;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', () => { cb(Array.from(inp.files || [])); inp.remove(); });
    inp.click();
  }
  function _capUpload(file) {
    const API = ((window.CONFIG && window.CONFIG.API_BASE) || '').replace(/\/+$/, '');
    const fd = new FormData(); fd.append('file', file);
    return fetch(API + '/api/uploads', { method: 'POST', body: fd })
      .then(r => { if (!r.ok) throw new Error('upload-' + r.status); return r.json(); });
  }

  // Waveform — real mic if the user grants it, else a simulated animation.
  function _capStartWave(id, existingStream) {
    const wrap = document.getElementById(id); if (!wrap) return;
    const wb = wrap.querySelectorAll('span');
    const bindStream = stream => {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser(); an.fftSize = 64; src.connect(an);
        const data = new Uint8Array(an.frequencyBinCount);
        (function loop() { an.getByteFrequencyData(data); for (let i = 0; i < wb.length; i++) { const v = data[Math.floor(i / wb.length * data.length)] / 255; wb[i].style.transform = 'scaleY(' + Math.max(0.12, v) + ')'; } _capWaveRAF = requestAnimationFrame(loop); })();
      } catch (_) { _capFakeWave(wb); }
    };
    if (existingStream) {
      bindStream(existingStream);
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        _capWaveStream = stream;
        bindStream(stream);
      }).catch(() => _capFakeWave(wb));
    } else { _capFakeWave(wb); }
  }
  function _capFakeWave(wb) { (function loop() { for (let i = 0; i < wb.length; i++) wb[i].style.transform = 'scaleY(' + (0.15 + Math.random() * 0.85).toFixed(2) + ')'; _capWaveRAF = requestAnimationFrame(() => setTimeout(loop, 90)); })(); }
  function _capStopWave() { if (_capWaveRAF) cancelAnimationFrame(_capWaveRAF); _capWaveRAF = null; if (_capWaveStream) { _capWaveStream.getTracks().forEach(t => t.stop()); _capWaveStream = null; } }
  function _capClearVoice() {
    if (!_capRec) return;
    _capRec.discard = true;
    if (_capRec.timer) clearInterval(_capRec.timer);
    if (_capRec.recorder && _capRec.recorder.state !== 'inactive') {
      try { _capRec.recorder.stop(); } catch (_) {}
    }
    if (_capRec.stream) _capRec.stream.getTracks().forEach(t => t.stop());
    if (_capRec.audioUrl) URL.revokeObjectURL(_capRec.audioUrl);
    _capRec = null;
  }

  // Panels reuse the .dash-cap__* design system (loaded globally in landing-theme.css).
  function _capBackBar() { return '<button type="button" class="dash-cap__back" data-action="sppcap-back">' + ICON.back + (_isEs() ? 'Volver' : 'Back') + '</button>'; }
  function _capturePanel() {
    return state.capMode === 'voice' ? _capVoicePanel() : state.capMode === 'video' ? _capVideoPanel() : _capPhotosPanel();
  }
  function _capVoicePanel() {
    const r = _capRec || { phase: 'idle', elapsed: 0 };
    if (r.phase === 'done') {
      return '<div class="dash-cap__voice-done"><button type="button" class="dash-cap__play" data-action="sppcap-voice-play" aria-label="' + (_isEs() ? 'Reproducir grabación' : 'Play recording') + '">' + ICON.play + '</button>' +
        '<div class="dash-wave dash-wave--static">' + _capStaticBars() + '</div>' +
        '<span class="dash-cap__dur">' + _capFmt(r.elapsed) + '</span></div>' +
        '<div class="dash-cap__actions">' +
          '<button type="button" class="dash-cap__btn dash-cap__btn--ghost" data-action="sppcap-voice-reset">' + ICON.mic + (_isEs() ? 'Repetir' : 'Re-record') + '</button>' +
          '<button type="button" class="dash-cap__btn dash-cap__btn--accent" data-action="sppcap-voice-use">' + (_isEs() ? 'Usar grabación' : 'Use recording') + ICON.arrow + '</button>' +
        '</div>';
    }
    const rec = r.phase === 'recording';
    return '<p class="spp-voice-prompt">' + (_isEs() ? 'Describe tu solicitud con una nota de voz.' : 'Describe your request with a voice note.') + '</p>' +
      '<div class="dash-cap__voice">' +
        '<button type="button" class="dash-mic' + (rec ? ' rec' : '') + '" data-action="sppcap-mic-toggle" aria-label="' + (rec ? 'Stop' : 'Record') + '">' + (rec ? ICON.stop : ICON.mic) + '</button>' +
        (rec ? '<div class="dash-wave" id="spp-wave">' + _capBars() + '</div>' : '<div class="dash-wave dash-wave--idle">' + _capBars() + '</div>') +
        '<div class="dash-cap__meta">' + (rec
          ? '<span class="dash-cap__time"><i class="dash-cap__dot"></i><span id="spp-rec-elapsed">' + _capFmt(r.elapsed) + '</span> / ' + _capFmt(60) + '</span>'
          : '<span class="dash-cap__hint">' + (_isEs() ? 'Toca para grabar (máx 1:00)' : 'Tap to record (max 1:00)') + '</span>') + '</div>' +
      '</div>';
  }
  function _capVideoPanel() {
    if (_capRec && _capRec.phase === 'vidrec') {
      return _capBackBar() + '<div class="dash-cap__video-rec">' +
        '<video class="dash-cap__video-preview" id="spp-video-preview" autoplay playsinline muted></video>' +
        '<span class="dash-cap__time dash-cap__time--lg"><i class="dash-cap__dot"></i><span id="spp-rec-elapsed">' + _capFmt(_capRec.elapsed) + '</span> / ' + _capFmt(_CAP_VIDEO_MAX_SECONDS) + '</span>' +
        '<p class="dash-cap__hint">' + (_isEs() ? 'Graba el problema' : 'Film the problem') + '</p>' +
        '<div class="dash-cap__actions"><button type="button" class="dash-cap__btn dash-cap__btn--accent" data-action="sppcap-vid-stop">' + ICON.stop + (_isEs() ? 'Detener' : 'Stop') + '</button></div></div>';
    }
    if (_capMedia.length) {
      const it = _capMedia[0];
      return _capBackBar() +
        '<video class="dash-cap__video-playback" controls playsinline preload="metadata" src="' + _capEsc(it.previewUrl || it.url || '') + '"></video>' +
        '<div class="dash-cap__media-chip' + (it.uploading ? ' uploading' : '') + '">' + ICON.video +
          '<span>' + (it.name ? _capEsc(it.name) : (_isEs() ? 'Video listo' : 'Video ready')) + (it.dur ? ' · ' + _capFmt(it.dur) : '') + '</span>' +
          '<button type="button" class="dash-cap__chip-x" data-action="sppcap-media-clear">' + ICON.close + '</button></div>' +
        '<div class="dash-cap__actions"><button type="button" class="dash-cap__btn dash-cap__btn--accent" data-action="sppcap-media-use">' + (_isEs() ? 'Continuar' : 'Continue') + ICON.arrow + '</button></div>';
    }
    return _capBackBar() + '<div class="dash-cap__drop"><div class="dash-cap__drop-ic">' + ICON.video + '</div>' +
      '<p class="dash-cap__drop-title">' + (_isEs() ? 'Sube o graba un video' : 'Upload or record a video') + '</p>' +
      '<div class="dash-cap__drop-btns">' +
        '<button type="button" class="dash-cap__btn dash-cap__btn--secondary" data-action="sppcap-vid-upload">' + ICON.upload + (_isEs() ? 'Subir video' : 'Upload video') + '</button>' +
        '<button type="button" class="dash-cap__btn dash-cap__btn--secondary" data-action="sppcap-vid-record">' + ICON.video + (_isEs() ? 'Grabar' : 'Record') + '</button></div></div>';
  }
  function _capPhotosPanel() {
    const maxPhotos = 3;
    if (_capMedia.length) {
      const thumbs = _capMedia.map((it, i) =>
        '<div class="dash-thumb' + (it.uploading ? ' uploading' : '') + '">' + (it.url ? '<img src="' + it.url + '" alt="">' : ICON.camera) +
        '<button type="button" class="dash-thumb__x" data-action="sppcap-media-remove:' + i + '">' + ICON.close + '</button></div>').join('');
      const add = _capMedia.length < maxPhotos ? '<button type="button" class="dash-thumb dash-thumb--add" data-action="sppcap-photo-capture" aria-label="' + (_isEs() ? 'Tomar otra foto' : 'Take another photo') + '">' + ICON.plus + '</button>' : '';
      return _capBackBar() + '<div class="dash-thumbs">' + thumbs + add + '</div>' +
        '<div class="dash-cap__actions"><button type="button" class="dash-cap__btn dash-cap__btn--accent" data-action="sppcap-media-use">' +
        (_isEs() ? 'Continuar (' + _capMedia.length + ')' : 'Continue (' + _capMedia.length + ')') + ICON.arrow + '</button></div>';
    }
    return _capBackBar() + '<div class="dash-cap__drop"><div class="dash-cap__drop-ic">' + ICON.camera + '</div>' +
      '<p class="dash-cap__drop-title">' + (_isEs() ? 'Agrega fotos del problema' : 'Add photos of the problem') + '</p>' +
      '<div class="dash-cap__drop-btns">' +
        '<button type="button" class="dash-cap__btn dash-cap__btn--secondary" data-action="sppcap-photo-capture">' + ICON.camera + (_isEs() ? 'Tomar foto' : 'Take photo') + '</button>' +
        '<button type="button" class="dash-cap__btn dash-cap__btn--secondary" data-action="sppcap-photos-add">' + ICON.upload + (_isEs() ? 'Elegir fotos' : 'Choose photos') + '</button>' +
      '</div></div>';
  }

  // Swap the active media panel's inner content in place, then resize the body.
  // Capture lives in the camera/voice panels (the describe panel is text-only).
  function _renderCapture() {
    const popover = document.getElementById('search-pill-popover');
    if (!popover) return;
    const seg = state.segment === 'voice' ? 'voice' : 'camera';
    const panel = popover.querySelector(`.spp-panel--${seg}`);
    if (!panel) return;
    panel.innerHTML = seg === 'voice' ? _voiceInner() : _cameraInner();
    _showActivePanel(seg);
  }

  // Voice recorder — captures audio, duration + a live waveform.
  function _capStartVoice() {
    _capClearVoice();
    _capRec = { phase: 'recording', elapsed: 0, t0: Date.now(), chunks: [] };
    _renderCapture();
    _capRec.timer = setInterval(() => {
      _capRec.elapsed = (Date.now() - _capRec.t0) / 1000;
      const el = document.getElementById('spp-rec-elapsed'); if (el) el.textContent = _capFmt(_capRec.elapsed);
      if (_capRec.elapsed >= 60) _capFinishVoice();
    }, 100);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        if (!_capRec || _capRec.phase !== 'recording') {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        _capRec.stream = stream;
        _capStartWave('spp-wave', stream);
        const recorder = new MediaRecorder(stream);
        const activeRec = _capRec;
        _capRec.recorder = recorder;
        recorder.addEventListener('dataavailable', e => {
          if (e.data && e.data.size) activeRec.chunks.push(e.data);
        });
        recorder.addEventListener('stop', () => {
          if (activeRec.discard) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          const type = recorder.mimeType || 'audio/webm';
          const blob = new Blob(activeRec.chunks || [], { type });
          if (blob.size) activeRec.audioUrl = URL.createObjectURL(blob);
          stream.getTracks().forEach(t => t.stop());
          if (_capRec === activeRec && _capRec.phase === 'done') _renderCapture();
        });
        recorder.start();
      }).catch(() => _capStartWave('spp-wave'));
    } else {
      _capStartWave('spp-wave');
    }
  }
  function _capFinishVoice() {
    if (!_capRec) return;
    clearInterval(_capRec.timer);
    _capStopWave();
    _capRec.phase = 'done';
    if (_capRec.recorder && _capRec.recorder.state !== 'inactive') _capRec.recorder.stop();
    else if (_capRec.stream) _capRec.stream.getTracks().forEach(t => t.stop());
    _renderCapture();
  }
  function _capPlayVoice() {
    if (!_capRec || !_capRec.audioUrl) return;
    const audio = new Audio(_capRec.audioUrl);
    audio.play().catch(() => {});
  }

  function _capPickPhotos(capture) {
    const maxPhotos = 3;
    const slots = maxPhotos - _capMedia.length;
    if (slots <= 0) return;
    _capPickFiles('image/*', !capture, capture ? 'environment' : null, files => {
      files.slice(0, slots).forEach(f => {
        const item = { kind: 'photo', url: URL.createObjectURL(f), uploading: true };
        _capMedia.push(item);
        _capUpload(f).then(d => { item.url = d.url; item.uploading = false; _renderCapture(); })
          .catch(() => { const i = _capMedia.indexOf(item); if (i > -1) _capMedia.splice(i, 1); _renderCapture(); });
      });
      _capMedia = _capMedia.slice(0, maxPhotos); _renderCapture();
    });
  }
  function _capPickVideo(capture) {
    _capPickFiles('video/*', false, capture ? 'environment' : null, files => {
      if (!files.length) return;
      const f = files[0];
      const previewUrl = URL.createObjectURL(f);
      const item = { kind: 'video', url: previewUrl, previewUrl, name: f.name, uploading: true };
      _capMedia = [item]; _renderCapture();
      _capUpload(f).then(d => { item.url = d.url; item.uploading = false; _renderCapture(); })
        .catch(() => { item.uploading = false; _renderCapture(); });
    });
  }
  function _capVideoMimeType() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }
  function _capAttachVideoPreview(stream) {
    const video = document.getElementById('spp-video-preview');
    if (!video) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }
  function _capStartVid() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
      _capPickVideo(true);
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: true
    }).then(stream => {
      const chunks = [];
      const mimeType = _capVideoMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const rec = { phase: 'vidrec', elapsed: 0, t0: Date.now(), stream, recorder, chunks };
      _capRec = rec;
      _renderCapture();
      _capAttachVideoPreview(stream);
      rec.timer = setInterval(() => {
        rec.elapsed = (Date.now() - rec.t0) / 1000;
        const el = document.getElementById('spp-rec-elapsed');
        if (el) el.textContent = _capFmt(rec.elapsed);
        if (rec.elapsed >= _CAP_VIDEO_MAX_SECONDS) _capStopVid();
      }, 100);
      recorder.addEventListener('dataavailable', e => {
        if (e.data && e.data.size) chunks.push(e.data);
      });
      recorder.addEventListener('stop', () => {
        stream.getTracks().forEach(t => t.stop());
        if (rec.discard) return;
        const type = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(chunks, { type });
        const d = Math.min(_CAP_VIDEO_MAX_SECONDS, Math.max(1, Math.round(rec.elapsed || ((Date.now() - rec.t0) / 1000))));
        const file = typeof File === 'function'
          ? new File([blob], 'servi-request-video.webm', { type })
          : blob;
        const previewUrl = URL.createObjectURL(blob);
        const item = { kind: 'video', url: previewUrl, previewUrl, name: 'Recorded video', dur: d, uploading: true };
        if (_capRec === rec) _capRec = null;
        _capMedia = [item];
        _renderCapture();
        _capUpload(file).then(data => { item.url = data.url; item.uploading = false; _renderCapture(); })
          .catch(() => { item.uploading = false; _renderCapture(); });
      });
      recorder.start(250);
    }).catch(() => {
      _capPickVideo(true);
    });
  }
  function _capStopVid() {
    if (!_capRec || _capRec.phase !== 'vidrec') return;
    _capRec.elapsed = (Date.now() - _capRec.t0) / 1000;
    clearInterval(_capRec.timer);
    if (_capRec.recorder && _capRec.recorder.state !== 'inactive') _capRec.recorder.stop();
    else if (_capRec.stream) _capRec.stream.getTracks().forEach(t => t.stop());
  }

  function _capCleanMedia(it) { const o = { kind: it.kind }; if (it.url) o.url = it.url; if (it.dur) o.dur = it.dur; if (it.name) o.name = it.name; if (it.sample) o.sample = true; return o; }
  function _capReset() {
    _capStopWave();
    _capClearVoice();
    _capMedia = []; state.capMode = null;
  }
  // Hand captured media to the Smart Request review screen — same sessionStorage
  // handoff the hero uses. This is the final submit step, not "opening a tool".
  function _capHandoff(payload) {
    if (state._describeText && state._describeText.trim()) {
      payload.text = state._describeText.trim();
      if (typeof window.applyRequestLanguage === 'function') {
        payload.lang = window.applyRequestLanguage(payload.text) || payload.lang;
      }
    }
    try { sessionStorage.setItem('sr_handoff', JSON.stringify(payload)); } catch (_) {}
    const url = new URL('/smart-request.html', window.location.origin);
    url.searchParams.set('return', window.location.pathname + window.location.search + window.location.hash);
    window.location.href = url.toString();
  }

  // The pill segments that own a popover surface (browse routes away instead).
  const PILL_SEGMENTS = ['describe', 'camera', 'voice'];
  const _isPillSegment = (s) => PILL_SEGMENTS.indexOf(s) !== -1;
  const _isMobileHeaderLayout = () => window.matchMedia && window.matchMedia('(max-width: 900px)').matches;

  function _updatePillIndicator() {
    const pill = document.querySelector('.site-header__pill');
    if (!pill) return;

    const activeSegName = _isPillSegment(state.segment) ? state.segment : 'describe';
    const activeBtn = pill.querySelector(`.search-pill__segment[data-segment="${activeSegName}"]`);
    if (!activeBtn) return;

    const pillRect = pill.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const inset = 2;
    const x = Math.max(0, btnRect.left - pillRect.left - inset);
    const width = Math.max(0, btnRect.width - (inset * 2));

    pill.style.setProperty('--pill-indicator-x', `${x}px`);
    pill.style.setProperty('--pill-indicator-width', `${width}px`);
  }

  // ─── Popover anchoring ─────────────────────────────────────────────────
  // The popover "unfolds" from the active segment: it is sized to that
  // segment's exact width and overlaps its bottom edge by 1px, so the segment
  // and the panel read as one continuous surface. Geometry is published as
  // CSS custom properties so the panel can glide + resize between segments.
  function _positionPopover() {
    const popover = document.getElementById('search-pill-popover');
    const center = document.querySelector('.site-header__center');
    const pill = document.querySelector('.site-header__pill');
    if (!popover || !center || !pill) return;
    const segName = _isPillSegment(state.segment) ? state.segment : 'describe';
    const segBtn = pill.querySelector(`.search-pill__segment[data-segment="${segName}"]`);
    if (!segBtn) return;
    const centerRect = center.getBoundingClientRect();
    const segRect = segBtn.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    // "Describe" unfolds from its own (wide) segment. On mobile, camera and
    // voice use narrower panels while preserving the same width/left morph.
    const cameraMobileWidth = Math.min(pillRect.width, 326);
    const voiceMobileWidth = Math.min(pillRect.width, 292);
    const voiceMobileNudge = 6;
    const anchorRect = state.segment === 'describe'
      ? segRect
      : (state.segment === 'camera' && _isMobileHeaderLayout())
        ? {
            left: pillRect.left + ((pillRect.width - cameraMobileWidth) / 2),
            width: cameraMobileWidth
          }
      : (state.segment === 'voice' && _isMobileHeaderLayout())
        ? {
            left: pillRect.right - voiceMobileWidth + voiceMobileNudge,
            width: voiceMobileWidth
          }
        : pillRect;
    const left = anchorRect.left - centerRect.left;
    const top = segRect.bottom - centerRect.top - 1;
    // Exact (un-rounded) so the popover's left/right edges line up with the
    // anchor's to the sub-pixel — any rounding shows up as a visible step.
    popover.style.setProperty('--spp-left', `${left}px`);
    popover.style.setProperty('--spp-top', `${top}px`);
    popover.style.setProperty('--spp-width', `${anchorRect.width}px`);
    // The card highlight in the pill rides the same segment geometry, so it
    // slides + morphs in lockstep with the popover hanging beneath it.
    _positionActiveCard();
  }

  // Position the sliding active-card highlight onto the active segment (relative
  // to the pill). Shown only while a segment is open (scrolled-expanded); it is
  // the white surface the popover continues from.
  function _positionActiveCard() {
    const pill = document.querySelector('.site-header__pill');
    if (!pill) return;
    const card = pill.querySelector('.search-pill__active-card');
    if (!card) return;
    if (!_isPillSegment(state.segment)) {
      card.removeAttribute('data-show');
      _positionMethodFocus(null, pill);
      return;
    }
    const seg = pill.querySelector(`.search-pill__segment[data-segment="${state.segment}"]`);
    if (!seg) return;
    const pr = pill.getBoundingClientRect();
    // Camera/voice turn the entire pill into the welded white surface (their lone
    // segments are too narrow); "describe" highlights just its own segment.
    const sr = state.segment === 'describe' ? seg.getBoundingClientRect() : pr;
    // Absolute children are positioned from the pill's padding box, so offset by
    // its border to land the card exactly on the segment (sub-pixel, like the popover).
    const pcs = getComputedStyle(pill);
    const bl = parseFloat(pcs.borderLeftWidth) || 0;
    const bt = parseFloat(pcs.borderTopWidth) || 0;
    card.style.setProperty('--card-x', `${sr.left - pr.left - bl}px`);
    card.style.setProperty('--card-y', `${sr.top - pr.top - bt}px`);
    card.style.setProperty('--card-w', `${sr.width}px`);
    // +2px so the card underlaps the popover (which starts 1px above the
    // segment's bottom); the popover paints on top, so the seam never shows.
    card.style.setProperty('--card-h', `${sr.height + 2}px`);
    card.setAttribute('data-segment', state.segment);
    card.setAttribute('data-show', 'true');
    _positionMethodFocus(state.segment, pill);
  }

  function _positionMethodFocus(segment, pill) {
    const focus = pill.querySelector('.search-pill__method-focus');
    if (!focus) return;
    const supportsSegment = segment === 'camera' || segment === 'voice' || (segment === 'describe' && _isMobileHeaderLayout());
    if (!supportsSegment) {
      focus.removeAttribute('data-show');
      focus.setAttribute('data-segment', '');
      return;
    }
    const seg = pill.querySelector(`.search-pill__segment[data-segment="${segment}"]`);
    if (!seg) return;
    const pr = pill.getBoundingClientRect();
    const sr = seg.getBoundingClientRect();
    const pcs = getComputedStyle(pill);
    const bl = parseFloat(pcs.borderLeftWidth) || 0;
    focus.style.setProperty('--method-focus-x', `${sr.left - pr.left - bl}px`);
    focus.style.setProperty('--method-focus-w', `${sr.width}px`);
    focus.setAttribute('data-segment', segment);
    focus.setAttribute('data-show', 'true');
  }

  // On open the whole pill morphs (and links reappear / browse button hides),
  // so the active segment's position keeps shifting for a few hundred ms. Glue
  // the popover to it every frame (no glide) until the layout settles, so the
  // toolbar never rests a few px off from the card above it.
  let _morphTrackRAF = null;
  function _setSnap(on) {
    // Suppress the left/width/top glide on BOTH the popover and the card while
    // tracking, so they stay welded to the morphing segment instead of sliding
    // in from a stale position.
    const popover = document.getElementById('search-pill-popover');
    const card = document.querySelector('.search-pill__active-card');
    const focus = document.querySelector('.search-pill__method-focus');
    if (popover) popover.classList.toggle('spp--instant', on);
    // Mobile needs the white active pill to morph smoothly from Describe's wide
    // segment to the Camera/Voz method segments. Keep only the popover snapped
    // there; desktop still snaps the welded card while the header opens.
    const snapActiveSurfaces = on && !_isMobileHeaderLayout();
    [card, focus].forEach(el => { if (el) el.classList.toggle('spp--instant', snapActiveSurfaces); });
  }
  function _trackPopoverDuringMorph(ms) {
    const popover = document.getElementById('search-pill-popover');
    if (!popover) return;
    if (_morphTrackRAF) cancelAnimationFrame(_morphTrackRAF);
    _setSnap(true);
    const start = performance.now();
    const step = () => {
      if (!state.segment) { _setSnap(false); _morphTrackRAF = null; return; }
      _positionPopover();
      if (performance.now() - start < ms) {
        _morphTrackRAF = requestAnimationFrame(step);
      } else {
        _setSnap(false);
        _morphTrackRAF = null;
      }
    };
    _morphTrackRAF = requestAnimationFrame(step);
  }

  // ─── State machine ─────────────────────────────────────────────────────
  const state = {
    scroll: 'hero',       // 'hero' | 'scrolled'
    segment: null,        // null | 'describe' | 'camera' | 'voice' | 'browse'
    drawerOpen: false,
    browseBarExpanded: false,
    whenChoice: 'asap',   // 'asap' | 'date' — legacy hero-search handoff default (when is chosen on smart-request)
    whenDate: '',         // ISO date string when choice === 'date'
    _describeText: '',    // current describe compose text
    capMode: null,        // null | 'photos' | 'voice' | 'video' — active in-pill capture surface
  };
  let _pillIndicatorTimer = null;
  let _capMedia = [];     // captured media in the popover [{kind,url,dur,name,uploading,sample}]
  let _capRec = null;     // transient recorder {phase,elapsed,t0,timer}
  let _capWaveRAF = null, _capWaveStream = null;

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

    // Tag the active segment (drives panel-specific styling) and re-anchor
    // the panel under that segment so it glides + resizes into place.
    popover.setAttribute('data-segment', segment);
    _positionPopover();
  }

  function _syncDescribeInputState() {
    const input = document.getElementById('spp-describe-input');
    if (!input) return;
    input.readOnly = state.segment !== 'describe';
    if (state._describeText !== input.value) input.value = state._describeText;
    _autoGrowDescribe();
  }

  // The describe field is a single-line label in the collapsed pill and a
  // downward-growing compose box when active. Size it to its content and keep
  // the toolbar popover flush against the (now taller) segment's bottom edge.
  const SPP_DESCRIBE_MAX_H = 168; // ~6 lines, then the textarea scrolls
  function _autoGrowDescribe() {
    const ta = document.getElementById('spp-describe-input');
    if (!ta) return;
    if (state.segment !== 'describe') {
      // Collapsed: drop the inline height so the base single-line rule applies.
      ta.style.height = '';
      ta.style.overflowY = '';
      return;
    }
    if (!ta.value) {
      // Empty: use the CSS baseline height. (Measuring scrollHeight here
      // would pick up the placeholder's wrapped height while the field is still
      // narrow mid-morph, inflating it and then snapping down on first keypress.)
      ta.style.height = '';
      ta.style.overflowY = 'hidden';
      _positionPopover();
      return;
    }
    ta.style.height = 'auto';
    const next = Math.min(ta.scrollHeight, SPP_DESCRIBE_MAX_H);
    ta.style.height = next + 'px';
    ta.style.overflowY = ta.scrollHeight > SPP_DESCRIBE_MAX_H ? 'auto' : 'hidden';
    // As the card grows, re-anchor the toolbar to its new bottom edge.
    _positionPopover();
  }

  function applyHeaderState() {
    const header = document.getElementById('site-header');
    const scrim = document.getElementById('site-scrim');
    const popover = document.getElementById('search-pill-popover');
    if (!header) return;
    // Section-variant header has no pill/browse/scroll state — bail early.
    if (header.getAttribute('data-variant') === 'section') return;

    // Header data-state drives bar expansion + scrim
    let ds;
    if (_isPillSegment(state.segment)) ds = 'scrolled-expanded';
    else if (header.getAttribute('data-page') === 'browse' && (state.scroll === 'hero' || state.browseBarExpanded)) ds = 'browse-expanded';
    else if (state.scroll === 'scrolled') ds = 'scrolled';
    else ds = 'hero';
    header.setAttribute('data-state', ds);

    // Pill segment active highlights
    const pill = document.querySelector('.site-header__pill');
    if (pill) pill.setAttribute('data-active-segment', _isPillSegment(state.segment) ? state.segment : 'describe');
    document.querySelectorAll('.search-pill__segment').forEach(btn => {
      btn.setAttribute('data-active', btn.getAttribute('data-segment') === state.segment ? 'true' : 'false');
    });
    _syncDescribeInputState();
    requestAnimationFrame(_updatePillIndicator);
    requestAnimationFrame(_positionActiveCard);
    if (_pillIndicatorTimer) clearTimeout(_pillIndicatorTimer);
    _pillIndicatorTimer = setTimeout(_updatePillIndicator, 280);

    // Browse button active highlight
    const browseBtn = document.querySelector('.site-header__browse-btn');
    if (browseBtn) browseBtn.setAttribute('data-active', state.segment === 'browse' ? 'true' : 'false');

    if (_isPillSegment(state.segment)) {
      scrim.setAttribute('data-visible', 'true');
      scrim.setAttribute('aria-hidden', 'false');

      if (popover && state.segment === 'describe' && _isMobileHeaderLayout()) {
        popover.removeAttribute('data-open');
        popover.setAttribute('aria-hidden', 'true');
        popover.setAttribute('data-segment', '');
        popover.innerHTML = '';
        requestAnimationFrame(() => {
          const inp = document.getElementById('spp-describe-input');
          if (inp) inp.focus();
          _autoGrowDescribe();
          _trackPopoverDuringMorph(520);
        });
      } else if (popover) {
        const alreadyOpen = popover.getAttribute('data-open') === 'true';
        const targetPanelMissing = alreadyOpen && !popover.querySelector(`.spp-panel--${state.segment}`);
        popover.setAttribute('data-segment', state.segment);
        popover.setAttribute('data-open', 'true');
        popover.setAttribute('aria-hidden', 'false');

        if (!alreadyOpen || targetPanelMissing) {
          // First open: desktop keeps the describe toolbar in the popover;
          // mobile describes inline in the pill, so only media panels are mounted.
          const panelsHtml = _isMobileHeaderLayout()
            ? `${buildCameraPanel()}${buildVoicePanel()}`
            : `${buildDescribePanel()}${buildCameraPanel()}${buildVoicePanel()}`;
          popover.innerHTML = `<div class="spp-body">
            ${panelsHtml}
          </div>`;
          // Start collapsed so the body unfolds (0 → natural height) on open.
          const _body = popover.querySelector('.spp-body');
          if (_body) _body.style.height = '0px';
          // Snap geometry before fade-in, then size the active panel.
          // _trackPopoverDuringMorph adds (and solely owns) the .spp--instant
          // snap for the whole open morph — calling _refreshPopoverGeometry here
          // too would schedule a competing 2-frame removal that unglues the
          // popover mid-morph, so it visibly lags the segment (overhang + seam).
          requestAnimationFrame(() => {
            _showActivePanel(state.segment);
            if (state.segment === 'describe') {
              const inp = document.getElementById('spp-describe-input');
              if (inp) inp.focus();
              _autoGrowDescribe();
            }
            // Keep the surface glued to the segment until the open-morph and
            // reflowing nav (links/browse button) fully settle.
            _trackPopoverDuringMorph(720);
          });
        } else {
          // Already open — glide the panel to the newly active segment
          if (state.segment === 'describe') {
            _showActivePanel('describe');
            const inp = document.getElementById('spp-describe-input');
            if (inp) inp.focus();
            _autoGrowDescribe();
          } else {
            // Camera/voice: re-render a fresh capture surface (capture is reset
            // on every segment switch) and size the body to it.
            _renderCapture();
          }
        }
      }

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
    }
  }

  function openSegment(seg) {
    if (seg === 'browse') {
      state.segment = null;
      applyHeaderState();
      // Route to dedicated browse page.
      if (window.location.pathname === '/browse.html') {
        const target = document.getElementById('browse-discovery');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = '/browse.html';
      }
      return;
    }
    // Switching between methods tears down any open capture surface, so each
    // method always starts from a clean state (chooser / idle recorder).
    if (seg !== state.segment) _capReset();
    state.segment = seg;
    applyHeaderState();
  }
  function closeSegment() {
    if (state.capMode || _capRec || _capMedia.length) _capReset();
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
  function buildBookingHandoffUrl(seedText) {
    const url = new URL('/index.html', window.location.origin);
    if (seedText) url.searchParams.set('discover_service', seedText);
    url.searchParams.set('discover_source', 'header_pill');
    if (state.whenChoice === 'date' && state.whenDate) {
      url.searchParams.set('discover_when', 'schedule');
      url.searchParams.set('discover_date', state.whenDate);
    } else {
      url.searchParams.set('discover_when', 'asap');
    }
    return url.pathname + url.search + url.hash;
  }

  function getBookingHandoffOptions() {
    return {
      source: 'header_pill',
      skipDescription: true,
      whenType: state.whenChoice === 'date' && state.whenDate ? 'schedule' : 'asap',
      date: state.whenChoice === 'date' ? state.whenDate : '',
    };
  }

  function routeToBookingIntake(seedText) {
    const text = seedText || '';
    if (window.openConversation && !window.__legacyBooking) {
      window.openConversation(text, getBookingHandoffOptions());
      return;
    }
    if (window.openBooking) {
      window.openBooking();
      if (text) {
        setTimeout(() => {
          window.bookingState && (window.bookingState.description = text);
          const desc = document.getElementById('booking-desc');
          if (desc) desc.value = text;
        }, 100);
      }
      return;
    }
    window.location.href = buildBookingHandoffUrl(text);
  }

  function getSearchPillDescription() {
    const input = document.getElementById('spp-describe-input');
    const text = input ? input.value.trim() : state._describeText.trim();
    state._describeText = text;
    return text;
  }

  function focusSearchPillDescribe() {
    openSegment('describe');
    requestAnimationFrame(() => {
      const input = document.getElementById('spp-describe-input');
      if (input) {
        input.readOnly = false;
        input.focus();
      }
    });
  }

  function releaseSearchPillFocus() {
    const popover = document.getElementById('search-pill-popover');
    const active = document.activeElement;
    const pill = document.querySelector('.site-header__pill');
    if (
      active &&
      typeof active.blur === 'function' &&
      ((popover && popover.contains(active)) || (pill && pill.contains(active)))
    ) {
      active.blur();
    }
  }

  // Open an in-pill capture surface inside the popover (no navigation). `mode`:
  //   'photos' | 'video' open the Camera method; 'voice' opens the Voice method;
  //   'upload' (from the describe "+") jumps the Camera method to the photo picker.
  function openSearchPillMedia(mode) {
    const cap = mode === 'upload' ? 'photos' : mode;
    const targetSeg = cap === 'voice' ? 'voice' : 'camera';
    _capReset();
    // Set the segment directly (not via openSegment, which would _capReset and
    // clear the capMode we want to land on) so the panel opens on the chosen
    // capture surface with no chooser flash.
    state.segment = targetSeg;
    state.capMode = cap;
    applyHeaderState();
    releaseSearchPillFocus();
    requestAnimationFrame(() => {
      _renderCapture();
      if (mode === 'upload') _capPickPhotos(false);
    });
  }

  // Submit the typed description — the "when" and remaining details are now
  // chosen on smart-request.html, so the pill hands the text straight over.
  function submitSearchPillDescribe() {
    const text = getSearchPillDescription();
    if (!text) {
      focusSearchPillDescribe();
      return;
    }
    closeSegment();
    const detectedLang = typeof window.applyRequestLanguage === 'function' ? window.applyRequestLanguage(text) : null;
    const url = new URL('/smart-request.html', window.location.origin);
    url.searchParams.set('text', text);
    url.searchParams.set('lang', detectedLang || (window.__lang === 'en' ? 'en' : 'es'));
    url.searchParams.set('return', window.location.pathname + window.location.search + window.location.hash);
    window.location.href = url.toString();
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
    const directAction = e.target.closest('[data-action]');
    if (directAction && directAction.getAttribute('data-action') === 'spp-submit' && !directAction.closest('#search-pill-popover')) {
      submitSearchPillDescribe();
      return;
    }

    // Pill segments
    const seg = e.target.closest('.search-pill__segment');
    if (seg) {
      const which = seg.getAttribute('data-segment');
      if (which === 'describe') {
        if (state.segment !== 'describe') openSegment('describe');
        requestAnimationFrame(() => {
          const input = document.getElementById('spp-describe-input');
          if (input) {
            input.readOnly = false;
            input.focus();
          }
        });
        return;
      }
      if (which !== 'browse' && state.segment === which) closeSegment();
      else openSegment(which);
      return;
    }
    // Standalone browse button
    const browseBtn = e.target.closest('.site-header__browse-btn');
    if (browseBtn) {
      openSegment('browse');
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
    // Browse page: after scroll collapse, clicking the header bar reveals links again
    // without activating the search pill or opening its popover.
    const bar = e.target.closest('.site-header__bar');
    if (bar) {
      const header = bar.closest('#site-header');
      const interactive = e.target.closest('a, button, input, select, textarea, [role="button"]');
      if (!interactive && header && header.getAttribute('data-page') === 'browse' && state.scroll === 'scrolled' && !state.segment) {
        state.browseBarExpanded = true;
        applyHeaderState();
        return;
      }
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
          if (scrollTarget === 'landing-hero') {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth' });
          }
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
      if (tgt === 'landing-hero') {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        document.getElementById(tgt)?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    // Popover (morphing pill) interactions
    const popover = e.target.closest('#search-pill-popover');
    if (popover) {
      const action = e.target.closest('[data-action]')?.getAttribute('data-action');
      const suggestion = e.target.closest('[data-suggestion]')?.getAttribute('data-suggestion');

      if (suggestion) {
        // Fill the describe input with the suggestion text
        const inp = document.getElementById('spp-describe-input');
        state._describeText = suggestion.trim();
        if (inp) { inp.value = suggestion; inp.focus(); }
        return;
      }
      // In-pill capture actions (own namespace so they never collide with the
      // homepage hero's separate [data-cap] handler).
      if (action && action.indexOf('sppcap-') === 0) {
        const parts = action.split(':'); const cmd = parts[0]; const arg = parts[1];
        switch (cmd) {
          // Camera capture → back to its Photos/Video chooser; Voice has no
          // chooser to return to, so "back" simply collapses the pill.
          case 'sppcap-back':
            if (state.segment === 'voice') { closeSegment(); }
            else { _capReset(); _renderCapture(); }
            break;
          case 'sppcap-mic-toggle': (_capRec && _capRec.phase === 'recording') ? _capFinishVoice() : _capStartVoice(); break;
          case 'sppcap-voice-play': _capPlayVoice(); break;
          case 'sppcap-voice-reset': _capClearVoice(); _renderCapture(); break;
          case 'sppcap-voice-use': _capHandoff({ mode: 'voice', media: [{ kind: 'voice', duration: _capRec ? _capRec.elapsed : 0 }] }); break;
          case 'sppcap-photos-add': _capPickPhotos(false); break;
          case 'sppcap-photo-capture': _capPickPhotos(true); break;
          case 'sppcap-media-remove': _capMedia.splice(+arg, 1); _renderCapture(); break;
          case 'sppcap-media-clear': _capMedia = []; _renderCapture(); break;
          case 'sppcap-media-use':
            if (_capMedia.some(m => m.uploading)) return; // wait for uploads to finish
            _capHandoff({ mode: state.capMode, media: _capMedia.map(_capCleanMedia) });
            break;
          case 'sppcap-vid-upload': _capPickVideo(false); break;
          case 'sppcap-vid-record': _capStartVid(); break;
          case 'sppcap-vid-stop': _capStopVid(); break;
        }
        return;
      }
      if (action === 'spp-attach') {
        // The "+" affordance jumps the Camera method to the photo picker.
        openSearchPillMedia('upload');
        return;
      }
      if (action === 'spp-submit') {
        // Hand the typed description to smart-request.html.
        submitSearchPillDescribe();
        return;
      }
      // Camera chooser → drill into the photo or video capture surface in place.
      if (action === 'spp-cam-photos') {
        state.capMode = 'photos';
        _renderCapture();
        return;
      }
      if (action === 'spp-cam-video') {
        state.capMode = 'video';
        _renderCapture();
        return;
      }
      return; // swallow unhandled clicks inside popover
    }
  }

  function onRootChange() {}

  function onRootInput(e) {
    if (e.target && e.target.id === 'spp-describe-input') {
      state._describeText = e.target.value;
      _autoGrowDescribe();
    }
  }

  function onRootKeydown(e) {
    if (e.key === 'Escape') {
      if (state.segment) closeSegment();
      else if (state.drawerOpen) closeDrawer();
    }
    if (e.key === 'Enter') {
      if (e.target && e.target.id === 'spp-describe-input') {
        // Compose box: plain Enter inserts a newline; the arrow button (or
        // Cmd/Ctrl+Enter) hands the description to smart-request.html.
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          submitSearchPillDescribe();
        }
      } else if (e.target && e.target.id === 'header-panel-input') {
        e.preventDefault();
        const val = e.target.value.trim();
        closeSegment();
        routeToBookingIntake(val);
      }
    }
  }

  // ─── Scroll state observation ─────────────────────────────────────────
  let _scrollObserver = null;
  let _browseScrollHandler = null;
  function initScrollObserver() {
    if (_scrollObserver) _scrollObserver.disconnect();
    if (_browseScrollHandler) {
      window.removeEventListener('scroll', _browseScrollHandler);
      window.removeEventListener('resize', _browseScrollHandler);
      _browseScrollHandler = null;
    }
    // Skip scroll/morph behavior on section-variant headers (static sub-brand bar).
    const header = document.getElementById('site-header');
    if (header && header.getAttribute('data-variant') === 'section') return;
    if (window.location.pathname === '/browse.html') {
      let ticking = false;
      const updateBrowseScroll = () => {
        const foldY = getBrowseHeaderMorphY();
        const nextScroll = window.scrollY < foldY ? 'hero' : 'scrolled';
        if (nextScroll !== state.scroll) {
          state.scroll = nextScroll;
          if (state.scroll === 'scrolled') state.browseBarExpanded = false;
          applyHeaderState();
        } else {
          applyHeaderState();
        }
        ticking = false;
      };
      _browseScrollHandler = () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(updateBrowseScroll);
        }
      };
      updateBrowseScroll();
      window.addEventListener('scroll', _browseScrollHandler, { passive: true });
      window.addEventListener('resize', _browseScrollHandler, { passive: true });
      return;
    }
    const heroSearch = document.getElementById('hero-search-bar');
    const hero = document.querySelector('.landing-hero') || document.querySelector('.dash-hero');
    const sentinel = heroSearch || hero;

    if (!sentinel) {
      // No hero on this page: keep the header in its default 'hero' layout
      // (logo + nav links + hamburger). Otherwise it collapses to the
      // search pill and visually drifts from the rest of the customer site.
      state.scroll = 'hero';
      applyHeaderState();
      return;
    }
    state.scroll = 'hero';
    applyHeaderState();

    _scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        state.scroll = entry.isIntersecting ? 'hero' : 'scrolled';
        if (window.location.pathname === '/browse.html' && state.scroll === 'scrolled') {
          state.browseBarExpanded = false;
        }
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

    // Reset internal state; DOM was wiped.
    // Pre-seed scroll state to match the data-state stamped into the HTML so
    // initScrollObserver → applyHeaderState sees no change and fires no transition.
    if (window.location.pathname === '/browse.html') {
      const foldY = getBrowseHeaderMorphY();
      state.scroll = window.scrollY < foldY ? 'hero' : 'scrolled';
    } else {
      state.scroll = 'hero';
    }
    state.segment = null;
    state.drawerOpen = false;
    state.browseBarExpanded = false;

    // Attach delegated listeners once
    if (!document.body.__servisiteHeaderBound) {
      document.addEventListener('click', onRootClick);
      document.addEventListener('keydown', onRootKeydown);
      document.addEventListener('change', onRootChange);
      document.addEventListener('input', onRootInput);
      document.body.__servisiteHeaderBound = true;
    }
    initScrollObserver();
    // Make visible only after state is applied, so browse-expanded / scrolled
    // states are set before the first paint (prevents a one-frame hero flash).
    el.style.visibility = 'visible';
    initHeroParallax();
    requestAnimationFrame(_updatePillIndicator);
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
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      _updatePillIndicator();
      if (state.segment === 'describe') applyHeaderState();
      else if (_isPillSegment(state.segment)) _positionPopover();
    });
  }, { passive: true });

  // ─── Legacy hamburger shim (used by some shared scripts) ──────────────
  window.toggleMobileMenu = function (show) {
    if (show) openDrawer(); else closeDrawer();
  };
})();
