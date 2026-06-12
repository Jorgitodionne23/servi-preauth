/* ─── SERVI Motion Layer ──────────────────────────────────────────────────────
   GSAP scroll reveals + stat counters. Purely visual: markup is never hidden
   by CSS, so if the GSAP CDN fails to load the page is fully visible/static.

   Declarative API (add attributes in HTML, no JS changes needed):
     data-reveal           fade-up 32px on scroll into view (once)
     data-reveal-stagger   children fade-up with 0.15s stagger (once)
     data-count="500"      number counts 0 → 500 over 2.4s (once)
     data-count-container  counts every .stat-num found inside when scrolled
                           into view (safe for JS/i18n-rendered stats)
─────────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  var EASE = 'power3.out';

  // [data-reveal] — single element fade-up
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    gsap.from(el, {
      y: 32, opacity: 0, duration: 0.9, ease: EASE,
      scrollTrigger: { trigger: el, start: 'top 86%', once: true }
    });
  });

  // [data-reveal-stagger] — direct children fade-up, slow 0.15s stagger
  document.querySelectorAll('[data-reveal-stagger]').forEach(function (parent) {
    if (!parent.children.length) return;
    gsap.from(parent.children, {
      y: 32, opacity: 0, duration: 0.8, ease: EASE, stagger: 0.15,
      scrollTrigger: { trigger: parent, start: 'top 84%', once: true }
    });
  });

  // [data-count] — stat counter, 2.4s
  document.querySelectorAll('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    gsap.fromTo(el, { textContent: 0 }, {
      textContent: target, duration: 2.4, ease: 'power2.out',
      snap: { textContent: 1 },
      scrollTrigger: { trigger: el, start: 'top 88%', once: true }
    });
  });

  // [data-count-container] — counts .stat-num children when the container
  // scrolls into view. Children are queried at enter time, so stats rendered
  // dynamically (i18n) are picked up. Prefix/suffix text ("+", "%") is kept.
  function countStat(el) {
    var text = el.textContent || '';
    var m = text.match(/(\d[\d,.]*)/);
    if (!m) return;
    var target = parseFloat(m[1].replace(/,/g, ''));
    if (isNaN(target)) return;
    var prefix = text.slice(0, m.index);
    var suffix = text.slice(m.index + m[1].length);
    var state = { v: 0 };
    gsap.to(state, {
      v: target, duration: 2.4, ease: 'power2.out',
      onUpdate: function () { el.textContent = prefix + Math.round(state.v) + suffix; }
    });
  }
  document.querySelectorAll('[data-count-container]').forEach(function (box) {
    ScrollTrigger.create({
      trigger: box, start: 'top 85%', once: true,
      onEnter: function () { box.querySelectorAll('.stat-num').forEach(countStat); }
    });
  });
})();
