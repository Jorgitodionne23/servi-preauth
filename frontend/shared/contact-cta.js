/**
 * contact-cta.js — runtime rewrite layer for contact CTAs.
 *
 * Pages hardcode `wa.me` links as an inert fallback. This script reads CONTACT_MODE
 * from window.CONFIG and rebuilds every `a[href*="wa.me"]` accordingly:
 *
 *   CONTACT_MODE === 'email'    → mailto:CONTACT_EMAIL (the WhatsApp number was resold)
 *   CONTACT_MODE === 'whatsapp' → https://wa.me/WHATSAPP_NUMBER (config-driven number)
 *
 * Any existing `?text=` payload is preserved (as a mailto subject, or the wa.me text).
 * Channel-named labels ("WhatsApp", "Abrir WhatsApp") are relabeled to "Correo" in email
 * mode; action labels ("Solicitar enlace", etc.) keep their text and only get a new href.
 *
 * To restore WhatsApp once the new line is live: flip CONTACT_MODE + WHATSAPP_NUMBER in
 * config.js. No per-page edits required.
 */
(function () {
  function rewrite() {
    var cfg = window.CONFIG || {};
    var mode = cfg.CONTACT_MODE || 'whatsapp';
    var email = cfg.CONTACT_EMAIL || 'serv.clientserv@gmail.com';
    var number = cfg.WHATSAPP_NUMBER || '525525112588';

    var links = document.querySelectorAll('a[href*="wa.me"]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var href = a.getAttribute('href') || '';

      // Preserve any prefilled ?text= payload (e.g. "Solicitar nuevo enlace").
      var text = '';
      var q = href.indexOf('?text=');
      if (q !== -1) {
        try { text = decodeURIComponent(href.slice(q + 6)); } catch (e) { text = href.slice(q + 6); }
      }

      if (mode === 'email') {
        var mailto = 'mailto:' + email;
        if (text) mailto += '?subject=' + encodeURIComponent(text);
        a.setAttribute('href', mailto);
        a.removeAttribute('target'); // mailto shouldn't open a blank tab

        // Relabel only bare channel-named labels (e.g. plain "WhatsApp" footer links on
        // the ES-only payment pages). Where i18n.js manages the label (data-i18n present),
        // leave it alone — those strings were already switched to email wording in i18n.js.
        var labelEl = a.querySelector('span') || a;
        if (!labelEl.hasAttribute('data-i18n') && /whatsapp/i.test(labelEl.textContent || '')) {
          labelEl.textContent = 'Correo';
        }
      } else {
        // WhatsApp mode: rebuild from the config number so a future swap is one edit.
        var wa = 'https://wa.me/' + number;
        if (text) wa += '?text=' + encodeURIComponent(text);
        a.setAttribute('href', wa);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', rewrite);
  } else {
    rewrite();
  }
  // Re-run after full load to win any race with i18n.js re-translating labels.
  window.addEventListener('load', rewrite);
})();
