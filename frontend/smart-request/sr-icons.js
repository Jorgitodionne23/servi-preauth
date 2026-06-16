/* SERVI Smart Request — vanilla icon set. Each fn returns an SVG markup string.
   Feather/Lucide-class: 1.7 stroke, round caps, currentColor. */
(function () {
  function svg(size, body) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) +
      '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }
  var P = function (d) { return '<path d="' + d + '"/>'; };

  var I = {
    spark: function (s) { return svg(s, P('M12 3v3M12 18v3M3 12h3M18 12h3') + P('M12 8.5a3.5 3.5 0 0 0 3.5 3.5 3.5 3.5 0 0 0-3.5 3.5 3.5 3.5 0 0 0-3.5-3.5A3.5 3.5 0 0 0 12 8.5z')); },
    send: function (s) { return svg(s, P('M5 12h14') + P('M12 5l7 7-7 7')); },
    plus: function (s) { return svg(s, P('M12 5v14M5 12h14')); },
    pin: function (s) { return svg(s, P('M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z') + '<circle cx="12" cy="10" r="3"/>'); },
    camera: function (s) { return svg(s, P('M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z') + '<circle cx="12" cy="13" r="4"/>'); },
    video: function (s) { return svg(s, '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>'); },
    mic: function (s) { return svg(s, P('M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z') + P('M19 10v2a7 7 0 01-14 0v-2') + '<line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>'); },
    grid: function (s) { return svg(s, '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'); },
    bolt: function (s) { return svg(s, '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'); },
    calendar: function (s) { return svg(s, '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'); },
    check: function (s) { return svg(s, P('M20 6L9 17l-5-5')); },
    checkCircle: function (s) { return svg(s, P('M22 11.08V12a10 10 0 11-5.93-9.14') + P('M22 4L12 14.01l-3-3')); },
    x: function (s) { return svg(s, P('M18 6L6 18M6 6l12 12')); },
    arrow: function (s) { return svg(s, P('M5 12h14M12 5l7 7-7 7')); },
    back: function (s) { return svg(s, P('M19 12H5M12 19l-7-7 7-7')); },
    edit: function (s) { return svg(s, P('M12 20h9') + P('M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z')); },
    shield: function (s) { return svg(s, P('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z')); },
    whatsapp: function (s) { return svg(s, P('M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z')); },
    users: function (s) { return svg(s, P('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2') + '<circle cx="9" cy="7" r="4"/>' + P('M23 21v-2a4 4 0 0 0-3-3.87') + P('M16 3.13a4 4 0 0 1 0 7.75')); },
    tag: function (s) { return svg(s, P('M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z') + '<line x1="7" y1="7" x2="7.01" y2="7"/>'); },
    clock: function (s) { return svg(s, '<circle cx="12" cy="12" r="9"/>' + P('M12 7v5l3 2')); },
    stop: function (s) { return svg(s, '<rect x="7" y="7" width="10" height="10" rx="1.5"/>'); },
    play: function (s) { return svg(s, '<polygon points="6 4 20 12 6 20 6 4"/>'); },
    upload: function (s) { return svg(s, P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4') + P('M17 8l-5-5-5 5') + '<line x1="12" y1="3" x2="12" y2="15"/>'); },
    sliders: function (s) { return svg(s, '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'); },
  };

  window.SR_ICON = I;
})();
