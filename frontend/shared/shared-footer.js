// ─── SERVI Shared Footer ────────────────────────────────────────────────────
// Augen-style footer: oversized wordmark + tagline row + 4-column link grid.
// Auto-renders into <div id="footer"></div>. Re-renders on 'langchange'.

(function () {
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function buildFooter() {
    const t = window.__t || {};
    const f = t.footer || {};
    const links = f.links || {};
    const tagline = f.tagline
      || (String(document.documentElement.lang || '').toLowerCase().startsWith('en')
        ? 'Home services, done right.'
        : 'Servicios para tu hogar, hechos bien.');

    const columns = [
      {
        title: f.servi || 'SERVI',
        links: [
          { label: links.solicita, href: '/index.html#landing-hero' },
          { label: links.whatWeOffer, href: '/index.html#landing-hero' },
          { label: links.how, href: '/index.html#how' },
          { label: links.app, href: '/index.html#app' },
          { label: links.testimonials, href: '/index.html#testimonials' },
        ],
      },
      {
        title: f.partners || 'Partners',
        links: [
          { label: links.bePartner, href: '/partners.html' },
          { label: links.whatIsPartner, href: '/partners.html#what' },
          { label: links.howPartner, href: '/partners.html#how' },
          { label: links.handbook, href: '/handbook.html' },
        ],
      },
      {
        title: f.help || 'Help',
        links: [
          { label: links.report, href: '/helpcenter.html' },
          { label: links.whoWeAre, href: '/helpcenter/quienes-somos.html' },
          { label: links.contactUs, href: '/helpcenter/contactanos.html' },
        ],
      },
      {
        title: f.legal || 'Legal',
        links: [
          { label: links.terms, href: '/legal.html#terms' },
          { label: links.privacy, href: '/legal.html#privacy' },
          { label: links.cancellation, href: '/legal.html#cancellation' },
          { label: links.legal, href: '/legal.html#legal-notice' },
        ],
      },
    ];

    const colsHTML = columns.map(col => `
      <div class="footer-col">
        <div class="footer-col-title">${escapeHtml(col.title)}</div>
        ${col.links.filter(l => l.label).map(l => `<a class="footer-link" href="${l.href}">${escapeHtml(l.label)}</a>`).join('')}
      </div>
    `).join('');

    const address = (t.contact && t.contact.address) || '';
    const copyright = f.copyright || `© ${new Date().getFullYear()} SERVI`;

    return `
    <footer class="site-footer site-footer--augen">
      <div class="container">
        <div class="footer-top">
          <p class="footer-tagline">${escapeHtml(tagline)}</p>
        </div>
        <div class="footer-wordmark-row">
          <a href="/index.html" class="footer-wordmark logo" style="text-decoration:none;color:inherit">SERVI<span class="footer-wordmark-dot logo-dot">.</span></a>
        </div>
        <div class="footer-grid">
          <div class="footer-col footer-col--about">
            <div class="footer-col-title">${escapeHtml((t.contact && t.contact.title) || 'Contacto')}</div>
            <div class="footer-address">${escapeHtml(address)}</div>
          </div>
          ${colsHTML}
        </div>
        <div class="footer-bottom">
          <div class="footer-copyright">${escapeHtml(copyright)}</div>
        </div>
      </div>
    </footer>`;
  }

  window.buildServiFooter = function () {
    const el = document.getElementById('footer');
    if (!el) return;
    el.innerHTML = buildFooter();
    el.style.visibility = 'visible';
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.buildServiFooter);
  } else {
    window.buildServiFooter();
  }

  window.addEventListener('langchange', window.buildServiFooter);
})();
