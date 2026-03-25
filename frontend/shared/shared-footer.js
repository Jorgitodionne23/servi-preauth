// ─── SERVI Shared Footer ────────────────────────────────────────────────────
// Injects the 4-column footer into the page. Include after i18n.js.
// Usage: <div id="footer"></div> then this script auto-renders.

(function () {
  function buildFooter() {
    const t = window.__t;

    const columns = [
      {
        title: t.footer.servi,
        links: [
          { label: t.footer.links.solicita, href: '/index.html#services' },
          { label: t.footer.links.whatWeOffer, href: '/index.html#services' },
          { label: t.footer.links.how, href: '/index.html#how' },
          { label: t.footer.links.app, href: '/index.html#app' },
          { label: t.footer.links.testimonials, href: '/index.html#testimonials' },
        ],
      },
      {
        title: t.footer.partners,
        links: [
          { label: t.footer.links.bePartner, href: '/partners.html' },
          { label: t.footer.links.whatIsPartner, href: '/partners.html#what' },
          { label: t.footer.links.howPartner, href: '/partners.html#how' },
          { label: t.footer.links.handbook, href: '/handbook.html' },
        ],
      },
      {
        title: t.footer.help,
        links: [
          { label: t.footer.links.report, href: '/helpcenter.html' },
          { label: t.footer.links.whoWeAre, href: '/helpcenter/quienes-somos.html' },
          { label: t.footer.links.contactUs, href: '/helpcenter/contactanos.html' },
        ],
      },
      {
        title: t.footer.legal,
        links: [
          { label: t.footer.links.terms, href: '/legal.html#terms' },
          { label: t.footer.links.privacy, href: '/legal.html#privacy' },
          { label: t.footer.links.cancellation, href: '/legal.html#cancellation' },
          { label: t.footer.links.legal, href: '/legal.html#legal-notice' },
        ],
      },
    ];

    const colsHTML = columns.map(col => `
      <div>
        <div class="footer-col-title">${col.title}</div>
        ${col.links.map(l => `<a class="footer-link" href="${l.href}">${l.label}</a>`).join('')}
      </div>
    `).join('');

    return `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="logo" style="font-size:22px;margin-bottom:20px">SERVI<span class="logo-dot">.</span></div>
            <div class="text-xs">${t.contact.address}</div>
          </div>
          ${colsHTML}
        </div>
        <div class="footer-bottom">
          <div class="text-xs" style="color:#aaa">${t.footer.copyright}</div>
        </div>
      </div>
    </footer>`;
  }

  window.buildServiFooter = function () {
    const el = document.getElementById('footer');
    if (el) el.innerHTML = buildFooter();
    if (el) el.style.visibility = 'visible';
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.buildServiFooter);
  } else {
    window.buildServiFooter();
  }

  // Re-render on language change
  window.addEventListener('langchange', window.buildServiFooter);
})();
