/* ════════════════════════════════════════════════════════════════════════
   SERVI Smart Request — vanilla app (no framework). Drop-in for the SERVI
   marketing site. Orchestrates: compose → (AI analyze) → build → success.

   INTEGRATION SEAMS (see SERVI-INTEGRATION.md):
     • window.CONFIG.API_BASE        — your API origin (uploads + submit)
     • window.__user                 — logged-in user ({name,phone,email})
     • window.openAuthModal('login') — your auth gate (optional hook)
     • window.getDashAddress()        — saved address (optional hook)
     • window.__serviJsonAuthHeaders()— auth headers for POST (optional hook)
   All hooks are optional — the file runs standalone for design review.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  var I = window.SR_ICON;
  var CAT = function () { return window.SERVI_CATALOG || {}; };
  var DEFAULT_ADDR = (typeof window.getDashAddress === 'function' && window.getDashAddress()) || 'CDMX';
  function defaultAddress() { return (typeof window.getDashAddress === 'function' && window.getDashAddress()) || DEFAULT_ADDR; }

  // ── settings (localStorage-persisted; surfaced via the Tweaks button) ──
  var SETTINGS = Object.assign({ engine: 'ai', voiceLimit: 60, twoPane: true, showNext: true },
    JSON.parse(localStorage.getItem('sr_settings') || '{}'));
  function saveSettings() { localStorage.setItem('sr_settings', JSON.stringify(SETTINGS)); }

  // ── state ──
  var S = {
    phase: 'compose',          // compose | build | success
    mode: 'text',              // text | voice | photos | video
    text: '',
    atts: [],                  // media attached to a TEXT request [{kind,url,name,sample}]
    media: [],                 // captured media items for voice/photos/video
    thinking: false,
    req: { emoji: '✨', categoryLabel: 'Custom request' },
    answers: {},
    when: '', date: '', time: '', dateLabel: '',
    address: DEFAULT_ADDR,
    addressDetails: null,
    // recorder transients
    rec: null,
  };

  var root = document.getElementById('sr-root');

  // ── i18n ──
  function curLang() { return (window.__lang === 'en') ? 'en' : 'es'; }
  if (typeof window.lang !== 'function') window.lang = curLang;
  function tr(key, vars) {
    var dict = (window.__t && window.__t.smartRequest) || {};
    var s = dict[key] != null ? dict[key] : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function syncRequestLanguage(text) {
    if (typeof window.applyRequestLanguage === 'function') return window.applyRequestLanguage(text);
    return null;
  }
  function plural(n) { return n > 1 ? 's' : ''; }
  function srDebug() { try { return localStorage.getItem('sr_debug') === '1' || /[?&]srdebug=1/.test(location.search); } catch (e) { return false; } }
  function clientReqId() { return 'sr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); }
  window.addEventListener('langchange', function () {
    var ov = document.getElementById('sr-overlay');
    if (ov && !ov.hidden) render();
  });

  // ── tiny helpers ──
  function h(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function fmtTime(s) { var m = Math.floor(s / 60), sec = Math.floor(s % 60); return m + ':' + String(sec).padStart(2, '0'); }
  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
  function btn(variant, size, label, opts) {
    opts = opts || {};
    var icoL = opts.iconLeft ? opts.iconLeft : '', icoR = opts.iconRight ? opts.iconRight : '';
    return '<button type="button" class="sr-btn sr-btn--' + variant + ' sr-btn--' + size + (opts.block ? ' sr-btn--block' : '') + '"' +
      (opts.action ? ' data-action="' + opts.action + '"' : '') + (opts.disabled ? ' disabled' : '') + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
      icoL + '<span>' + esc(label) + '</span>' + icoR + '</button>';
  }
  function badge(variant, inner, cls) { return '<span class="sr-badge sr-badge--' + variant + (cls ? ' ' + cls : '') + '">' + inner + '</span>'; }
  function aiBadge(cls) {
    return '<span class="sr-ai-badge' + (cls ? ' ' + cls : '') + '">' + I.spark(14) + '<span>' + esc(tr('poweredByAi')) + '</span></span>';
  }
  function modeLabel(key, kind) {
    if (key === 'video') return tr(kind === 'sub' ? 'modeVideoSub' : 'modeVideo');
    if (key === 'photos') return tr(kind === 'sub' ? 'modePhotosSub' : 'modePhotos');
    return tr(kind === 'sub' ? 'modeVoiceSub' : 'modeVoice');
  }
  var SR_ADDR_PREFIX = 'sr_addr';
  function addressFallbackDetails() {
    if (S.addressDetails) return S.addressDetails;
    var address = S.address || defaultAddress();
    if (window.ServiAddress && typeof window.ServiAddress.parseDisplayAddress === 'function') {
      var parsed = window.ServiAddress.parseDisplayAddress(address);
      if (parsed && (parsed.street || parsed.neighborhood || parsed.city || parsed.state || parsed.postal_code)) return parsed;
    }
    return { address_type: 'house', street: address };
  }
  function syncAddressFromFields() {
    if (!window.ServiAddress || !document.getElementById(SR_ADDR_PREFIX + '_root')) return;
    S.addressDetails = window.ServiAddress.collect(SR_ADDR_PREFIX);
    S.address = window.ServiAddress.format(S.addressDetails) || S.addressDetails.street || '';
    var submitBtn = document.getElementById('sr-submit');
    if (submitBtn) submitBtn.disabled = !(S.address.trim() && (S.when === 'asap' || S.date));
  }
  function mountAddressFields() {
    if (S.phase !== 'build' || !window.ServiAddress || !document.getElementById(SR_ADDR_PREFIX + '_root')) return;
    window.ServiAddress.init(SR_ADDR_PREFIX, {});
    window.ServiAddress.fill(SR_ADDR_PREFIX, addressFallbackDetails());
  }

  // ════════════════════════════ COMPOSE ════════════════════════════════════
  var SR_PLACEHOLDER_FALLBACKS = {
    es: [
      'Necesito una limpieza profunda para un departamento de 2 recámaras...',
      'Tengo una fuga en la cocina y necesito un plomero hoy...',
      'Quiero montar una TV de 55 pulgadas en la sala...',
      'Necesito mover un sofá grande este fin de semana...',
      'Busco masaje a domicilio para dos personas...',
    ],
    en: [
      'Deep clean for a 2-bedroom apartment this Saturday...',
      'My kitchen sink is leaking and I need a plumber today...',
      'Mount a 55-inch TV on the living room wall...',
      'Move a large sofa this weekend...',
      'At-home massage for two people...',
    ],
  };
  var srPlaceholderTimer = null;
  var srPlaceholderIndex = 0;
  var MODE_TILES = [
    { key: 'photos', label: 'Add photos', sub: 'Snap or upload', icon: 'camera' },
    { key: 'voice', label: 'Voice note', sub: 'Say it out loud', icon: 'mic' },
    { key: 'video', label: 'Record a video', sub: 'Show the problem', icon: 'video' },
  ];

  function srPlaceholderExamples() {
    var dashHero = (window.__t && window.__t.dashHero) || {};
    var examples = Array.isArray(dashHero.placeholderExamples) ? dashHero.placeholderExamples.filter(Boolean) : [];
    if (examples.length) return examples;
    return SR_PLACEHOLDER_FALLBACKS[curLang()] || SR_PLACEHOLDER_FALLBACKS.es;
  }

  function srPlaceholderText() {
    var examples = srPlaceholderExamples();
    return examples[srPlaceholderIndex % examples.length] || '';
  }

  function stopSrPlaceholderRotation() {
    if (!srPlaceholderTimer) return;
    clearInterval(srPlaceholderTimer);
    srPlaceholderTimer = null;
  }

  function setSrPlaceholderExample(ta) {
    if (!ta || document.activeElement === ta || ta.value.trim()) {
      if (ta) ta.placeholder = '';
      return;
    }
    ta.placeholder = srPlaceholderText();
  }

  function startSrPlaceholderRotation() {
    var ta = document.getElementById('sr-ta');
    if (!ta) return;
    var examples = srPlaceholderExamples();
    stopSrPlaceholderRotation();
    setSrPlaceholderExample(ta);
    if (document.activeElement === ta || ta.value.trim() || examples.length < 2) return;
    srPlaceholderTimer = setInterval(function () {
      if (document.activeElement === ta || ta.value.trim()) {
        stopSrPlaceholderRotation();
        ta.placeholder = '';
        return;
      }
      srPlaceholderIndex = (srPlaceholderIndex + 1) % examples.length;
      setSrPlaceholderExample(ta);
    }, 2800);
  }

  function composeHTML() {
    var boxInner;
    if (S.mode === 'text') {
      var textReady = !!S.text.trim() && !S.atts.some(function (a) { return a.uploading; });
      boxInner =
        '<textarea class="sr-ta" id="sr-ta" rows="3" spellcheck="false" placeholder="' + esc(srPlaceholderText()) + '">' + esc(S.text) + '</textarea>' +
        (S.atts.length ? '<div class="sr-att-row">' + S.atts.map(function (a, i) {
          var isVideo = a.kind === 'video';
          var media = isVideo
            ? '<div class="sr-att__ph">' + I.video(16) + '</div>'
            : (a.sample ? '<div class="sr-att__ph">' + I.camera(16) + '</div>' : '<img src="' + a.url + '" alt="">');
          return '<div class="sr-att' + (a.uploading ? ' uploading' : '') + '">' + media +
            '<button type="button" class="sr-att__x" data-action="remove-att:' + i + '">' + I.x(12) + '</button></div>';
        }).join('') + '</div>' : '') +
        '<div class="sr-box__bar"><div class="sr-box__bar-left">' +
          '<span class="sr-attach-hint">' + esc(tr('attachHint')) + '</span>' +
          '<div class="sr-attach-actions">' +
            '<button type="button" class="sr-mini-attach" data-action="attach-photos" aria-label="' + esc(tr('attachPhotos')) + '" title="' + esc(tr('attachPhotos')) + '">' + I.camera(15) + '</button>' +
            '<button type="button" class="sr-mini-attach" data-action="attach-video" aria-label="' + esc(tr('attachVideo')) + '" title="' + esc(tr('attachVideo')) + '">' + I.video(15) + '</button>' +
          '</div></div>' +
          '<button type="button" class="sr-iconbtn ' + (S.text.trim() ? 'sr-iconbtn--accent' : 'sr-iconbtn--solid') + '" data-action="send-text" aria-label="Send"' + (textReady ? '' : ' disabled') + '>' + I.send(18) + '</button>' +
        '</div>';
    } else {
      boxInner = '<button type="button" class="sr-box__back" data-action="mode:text">' + I.back(16) + esc(tr('backToTyping')) + '</button>' +
        (S.mode === 'voice' ? voicePanelHTML() : mediaPanelHTML());
    }

    return '<div class="sr-stage sr-stage--narrow sr-fade-in"><div class="sr-compose">' +
      '<div class="sr-intel-row"><div class="sr-eyebrow"><span class="sr-eyebrow__spark">' + I.spark(15) + '</span>' + esc(tr('eyebrow')) + '</div>' + aiBadge() + '</div>' +
      '<h1 class="sr-title">' + esc(tr('title')) + '</h1>' +
      '<p class="sr-sub">' + esc(tr('sub')) + '</p>' +
      '<div class="sr-box' + (S.mode !== 'text' ? ' sr-box--media' : '') + '" id="sr-box">' + boxInner + '</div>' +
      '<div class="sr-modes-head">' + esc(tr('modesHead')) + '</div>' +
      '<div class="sr-modes">' + MODE_TILES.map(function (m) {
        return '<button type="button" class="sr-mode' + (S.mode === m.key ? ' on' : '') + '" data-action="mode:' + m.key + '">' +
          '<span class="sr-mode__ic">' + I[m.icon](20) + '</span><span class="sr-mode__txt">' +
          '<span class="sr-mode__label">' + esc(modeLabel(m.key)) + '</span><span class="sr-mode__sub">' + esc(modeLabel(m.key, 'sub')) + '</span></span></button>';
      }).join('') + '</div>' +
      '<div class="sr-browse"><span class="sr-browse__q">' + esc(tr('browseQ')) + '</span>' +
        '<button type="button" class="sr-browse__btn" data-action="browse-open">' + I.grid(16) + esc(tr('browseBtn')) + '</button></div>' +
      '</div></div>';
  }

  function additionalDetailsHTML(cls) {
    return '<label class="sr-extra-details' + (cls ? ' ' + cls : '') + '">' +
      '<span class="sr-extra-details__label">' + esc(tr('additionalDetails')) + '</span>' +
      '<textarea class="sr-extra-details__input" data-sr-details rows="2" spellcheck="false" placeholder="' + esc(tr('additionalDetailsPlaceholder')) + '">' + esc(S.text) + '</textarea>' +
      '</label>';
  }

  // ── voice panel (renders by S.rec.phase) ──
	  function voicePanelHTML() {
	    var r = S.rec || { phase: 'idle', elapsed: 0 };
	    if (r.phase === 'done') {
	      var item = (S.media || []).filter(function (m) { return m.kind === 'voice'; })[0] || r.item || {};
	      var isUploading = !!item.uploading;
	      var uploadFailed = !!item.uploadError;
	      return '<div class="sr-capture sr-capture--voice">' +
	        '<div class="sr-voice-done"><div class="sr-voice-play">' + I.play(18) + '</div>' +
	        '<div class="sr-wave sr-wave--static">' + staticBars() + '</div>' +
	        '<span class="sr-voice-dur">' + fmtTime(r.elapsed) + '</span></div>' +
          additionalDetailsHTML('sr-extra-details--voice') +
	        '<div class="sr-capture__actions">' +
	          btn('ghost', 'sm', tr('reRecord'), { action: 'voice-reset', iconLeft: I.mic(16) }) +
	          btn('accent', 'sm', uploadFailed ? tr('uploadFailed') : (isUploading ? tr('uploading') : tr('useRecording')), { action: 'voice-use', iconRight: I.arrow(16), disabled: isUploading || uploadFailed }) + '</div>' +
	        '<p class="sr-capture__note">' + esc(tr('voiceNote')) + '</p>' +
	        '</div>';
	    }
    var rec = r.phase === 'recording';
    return '<div class="sr-capture sr-capture--voice">' +
      '<button type="button" class="sr-mic' + (rec ? ' rec' : '') + '" data-action="mic-toggle" aria-label="' + (rec ? 'Stop' : 'Record') + '">' + (rec ? I.stop(30) : I.mic(30)) + '</button>' +
      (rec ? '<div class="sr-wave" id="sr-wave">' + Array(28).fill('<span></span>').join('') + '</div>'
           : '<div class="sr-wave sr-wave--idle">' + Array(28).fill('<span></span>').join('') + '</div>') +
      '<div class="sr-voice-meta">' + (rec
        ? '<span class="sr-rec-time"><i class="sr-rec-dot"></i><span id="sr-rec-elapsed">' + fmtTime(r.elapsed) + '</span> / ' + fmtTime(SETTINGS.voiceLimit) + '</span>'
        : '<span class="sr-capture__hint">' + esc(tr('tapToRecord', { limit: fmtTime(SETTINGS.voiceLimit) })) + '</span>') + '</div>' +
      '</div>';
  }
  function staticBars() { var o = ''; for (var i = 0; i < 28; i++) o += '<span style="transform:scaleY(' + (0.2 + Math.abs(Math.sin(i * 0.9)) * 0.8).toFixed(2) + ')"></span>'; return o; }

  // ── photos / video panel ──
  function mediaPanelHTML() {
    var isPhotos = S.mode === 'photos';
    var r = S.rec || {};
    if (!isPhotos && r.phase === 'vidrec') {
      return '<div class="sr-capture sr-capture--video"><div class="sr-vidrec">' +
        '<span class="sr-rec-time sr-rec-time--lg"><i class="sr-rec-dot"></i><span id="sr-rec-elapsed">' + fmtTime(r.elapsed) + '</span> / ' + fmtTime(90) + '</span>' +
        '<p class="sr-capture__hint">' + esc(tr('filmHint')) + '</p></div>' +
        '<div class="sr-capture__actions">' + btn('accent', 'sm', tr('stopRecording'), { action: 'vid-stop', iconLeft: I.stop(16) }) + '</div></div>';
    }
    var has = S.media.length > 0;
    var body;
    if (has) {
      body = '<div class="sr-thumbs">' + S.media.map(function (it, i) {
        var inner = it.kind === 'photo'
          ? (it.sample ? '<div class="sr-thumb__ph">' + I.camera(20) + '</div>' : '<img src="' + it.url + '" alt="">')
          : '<div class="sr-thumb__ph">' + I.video(20) + (it.dur ? '<span>' + fmtTime(it.dur) + '</span>' : '') + '</div>';
        return '<div class="sr-thumb' + (it.uploading ? ' uploading' : '') + '">' + inner + '<button type="button" class="sr-thumb__x" data-action="media-remove:' + i + '">' + I.x(13) + '</button></div>';
      }).join('') + (isPhotos && S.media.length < 5 ? '<button type="button" class="sr-thumb sr-thumb--add" data-action="media-upload">' + I.plus(20) + '</button>' : '') + '</div>';
    } else {
      body = '<div class="sr-drop"><div class="sr-drop__icon">' + (isPhotos ? I.camera(26) : I.video(26)) + '</div>' +
        '<p class="sr-drop__title">' + esc(isPhotos ? tr('photosTitle') : tr('videoTitle')) + '</p>' +
	        '<div class="sr-drop__btns">' + btn('secondary', 'sm', isPhotos ? tr('choosePhotos') : tr('uploadVideo'), { action: 'media-upload', iconLeft: I.upload(16) }) +
	          (!isPhotos ? btn('secondary', 'sm', tr('recordNow'), { action: 'media-record', iconLeft: I.video(16) }) : '') + '</div>' +
	        (srDebug() ? '<button type="button" class="sr-sample" data-action="media-sample">' + esc(tr('trySample')) + '</button>' : '') + '</div>';
    }
    var note = isPhotos
      ? tr('photosNote')
      : tr('videoNote');
    return '<div class="sr-capture">' + body + (has ? additionalDetailsHTML() : '') +
      '<div class="sr-capture__foot"><p class="sr-capture__note">' + note + '</p>' +
        (has ? btn('accent', 'sm', isPhotos ? tr('continuePhotos', { n: S.media.length, s: plural(S.media.length) }) : tr('continueVideo'), { action: 'media-use', iconRight: I.arrow(16) }) : '') +
      '</div></div>';
  }

  // ════════════════════════════ BUILD ══════════════════════════════════════
	  function understandingHTML() {
	    var req = S.req;
	    if (req.aiStatus === 'unclear' || req.adminReview) return unableHTML(req);
	    var transcript = req.transcript ? '<div class="sr-transcript"><b>' + esc(tr('transcribed')) + '</b>“' + esc(req.transcript) + '”</div>'
	      : (req.caption ? '<div class="sr-transcript"><b>' + esc(tr('fromPhotos')) + '</b>' + esc(req.caption) + '</div>' : '');
	    return '<div class="sr-understand sr-fade-in"><div class="sr-understand__top">' +
	      '<span class="sr-understand__emoji">' + (req.emoji || '✨') + '</span><div class="sr-understand__head">' +
	      '<div class="sr-understand__eyebrow">' + I.spark(13) + esc(tr('understood')) + '</div>' +
	      '<div class="sr-understand__svc"><strong>' + esc(req.service || tr('customRequest')) + '</strong>' +
	      '<span class="sr-understand__cat">' + esc(req.subLabel ? req.subLabel + ' · ' + req.categoryLabel : req.categoryLabel) + '</span></div></div></div>' +
	      (req.summary ? '<p class="sr-understand__summary">“' + esc(req.summary) + '”</p>' : '') + transcript +
	      '<button type="button" class="sr-link" data-action="open-picker">' + I.edit(14) + esc(tr('changeService')) + '</button></div>';
	  }

	  function unableHTML(req) {
	    var isVoice = S.mode === 'voice';
	    var title = isVoice ? tr('unableVoiceTitle') : (S.mode === 'photos' ? tr('unablePhotosTitle') : tr('manualReviewTitle'));
	    var desc = req.summary || (isVoice ? tr('unableVoiceDesc') : tr('unablePhotosDesc'));
	    var icon = isVoice ? I.mic(22) : (S.mode === 'photos' ? I.camera(22) : I.video(22));
	    return '<div class="sr-understand sr-understand--unclear sr-fade-in"><div class="sr-understand__top">' +
	      '<span class="sr-understand__emoji">' + icon + '</span><div class="sr-understand__head">' +
	      '<div class="sr-understand__eyebrow">' + I.shield(13) + esc(tr('manualReview')) + '</div>' +
	      '<div class="sr-understand__svc"><strong>' + esc(title) + '</strong>' +
	      '<span class="sr-understand__cat">' + esc(tr('manualReviewSub')) + '</span></div></div></div>' +
	      '<p class="sr-understand__summary sr-understand__summary--plain">' + esc(desc) + '</p>' +
	      '<div class="sr-capture__actions sr-understand__actions">' +
	        btn('secondary', 'sm', tr('addDetails'), { action: 'clarify-text', iconLeft: I.edit(14) }) +
	        btn('ghost', 'sm', tr('changeService'), { action: 'open-picker', iconLeft: I.edit(14) }) +
	      '</div></div>';
	  }

  function mediaReceivedHTML() {
    var n = S.media.length;
    var map = {
      photos: { ic: I.camera(22), label: tr('photosReceived', { n: n, s: plural(n) }), desc: tr('photosReceivedDesc') },
      video: { ic: I.video(22), label: tr('videoReceived'), desc: tr('videoReceivedDesc') },
    };
    var m = map[S.mode] || map.photos;
    return '<div class="sr-understand sr-understand--media sr-fade-in"><div class="sr-understand__top">' +
      '<span class="sr-media-badge">' + m.ic + '</span><div class="sr-understand__head">' +
      '<div class="sr-understand__eyebrow">' + I.check(13) + esc(tr('requestCaptured')) + '</div>' +
      '<div class="sr-understand__svc"><strong>' + m.label + '</strong></div></div></div>' +
      '<p class="sr-understand__summary sr-understand__summary--plain">' + m.desc + '</p></div>';
  }

  function followupsHTML() {
    var f = S.req.followups;
    if (!f || !f.length || S.mode !== 'text') return '';
    return '<div class="sr-card sr-fade-in"><div class="sr-card__head"><h3 class="sr-card__title">' + esc(tr('quickDetails')) + '</h3>' +
      '<span class="sr-card__opt">' + esc(tr('quickDetailsOpt')) + '</span></div><div class="sr-fups">' +
      f.map(function (q, i) {
        var key = q.key || ('q' + i);
        var control = (q.chips && q.chips.length)
          ? '<div class="sr-chips">' + q.chips.map(function (ch) {
              return '<button type="button" class="sr-chip' + (S.answers[key] === ch ? ' on' : '') + '" data-action="chip:' + key + '" data-val="' + esc(ch) + '">' + esc(ch) + '</button>';
            }).join('') + '</div>'
          : '<input class="sr-fup__input" data-fup="' + key + '" placeholder="' + esc(tr('typeAnswer')) + '" value="' + esc(S.answers[key] || '') + '">';
        return '<div class="sr-fup"><div class="sr-fup__q">' + esc(q.q) + '</div>' + control + '</div>';
      }).join('') + '</div></div>';
  }

  function whenWhereHTML() {
    var todayMin = new Date().toISOString().slice(0, 10);
    return '<div class="sr-card sr-fade-in"><div class="sr-card__head"><h3 class="sr-card__title">' + esc(tr('whenWhere')) + '</h3></div>' +
      '<div class="sr-when sr-when--time">' +
        '<button type="button" class="sr-radio' + (S.when === 'asap' ? ' sr-radio--on' : '') + '" data-action="when:asap">' +
          '<span class="sr-radio__ic">' + I.bolt(18) + '</span><span class="sr-radio__txt"><span class="sr-radio__label">' + esc(tr('asap')) + '</span>' +
          '<span class="sr-radio__desc">' + esc(tr('asapDesc')) + '</span></span></button>' +
        '<button type="button" class="sr-radio' + (S.when === 'schedule' ? ' sr-radio--on' : '') + '" data-action="when:schedule">' +
          '<span class="sr-radio__ic">' + I.calendar(18) + '</span><span class="sr-radio__txt"><span class="sr-radio__label">' + esc(tr('schedule')) + '</span>' +
          '<span class="sr-radio__desc">' + esc(S.dateLabel && S.when === 'schedule' ? tr('detected', { d: S.dateLabel }) : tr('scheduleDesc')) + '</span></span></button>' +
      '</div>' +
      (S.when === 'schedule' ? '<div class="sr-sched">' +
        '<input type="date" class="sr-input" id="sr-date" min="' + todayMin + '" value="' + esc(S.date) + '">' +
        '<input type="time" class="sr-input" id="sr-time" value="' + esc(S.time) + '"></div>' : '') +
      '<div class="sr-where"><label class="sr-where__label">' + I.pin(15) + esc(tr('serviceAddress')) + '</label>' +
        (window.ServiAddress
          ? '<div class="sr-where__row sr-where__row--structured">' + window.ServiAddress.fieldsHTML(SR_ADDR_PREFIX, { compact: true, showDefault: false }) + '</div>'
          : '<div class="sr-where__row"><input class="sr-input" id="sr-addr" placeholder="' + esc(tr('addressPlaceholder')) + '" value="' + esc(S.address) + '">' +
            '<button type="button" class="sr-loc" data-action="use-loc" aria-label="Use current location">' + I.pin(16) + '</button></div>') + '</div>' +
      '</div>';
  }

  // Recap rows shared by the inline rail summary (desktop) and the mobile
  // confirmation modal. Returns just the `.sr-sum__rows` block so both surfaces
  // can wrap it in their own container.
  function summaryRowsHTML() {
    var req = S.req;
    var details = Object.keys(S.answers).filter(function (k) { return S.answers[k]; }).map(function (k) { return S.answers[k]; });
    if (S.mode !== 'text' && S.text && S.text.trim()) details.unshift(S.text.trim());
    var whenStr = S.when === 'asap' ? tr('asap') : (S.when === 'schedule' ? (S.date ? fmtDate(S.date) + (S.time ? ' · ' + S.time : '') : tr('scheduled')) : '');
    var mediaLabel = S.mode === 'voice' ? tr('voiceNoteLabel') : S.mode === 'video' ? tr('videoClip') : S.mode === 'photos' ? tr('nPhotos', { n: S.media.length }) : null;
    function row(label, val) { return val ? '<div class="sr-sum__row"><span class="sr-sum__label">' + label + '</span><span class="sr-sum__val">' + esc(val) + '</span></div>' : ''; }
    var svcVal = (S.mode === 'text' || S.mode === 'voice' || S.mode === 'photos') && req.service ? req.service : mediaLabel;
    return '<div class="sr-sum__rows">' +
        row(tr('rowService'), svcVal) +
        ((S.mode !== 'video' && req.subLabel) ? row(tr('rowCategory'), req.categoryLabel) : '') +
        (details.length ? row(tr('rowDetails'), details.join(' · ')) : '') +
        row(tr('rowWhen'), whenStr) +
        row(tr('rowWhere'), S.address || '—') +
      '</div>';
  }

  function summaryHTML() {
    var req = S.req;
    return '<div class="sr-sum"><div class="sr-sum__head"><span class="sr-sum__emoji">' + (req.emoji || '✨') + '</span>' + esc(tr('yourRequest')) + '</div>' +
      summaryRowsHTML() + '</div>';
  }

  function nextStepsHTML() {
    if (SETTINGS.showNext === false) return '';
    var steps = [
      { ic: I.users(17), t: tr('step1'), d: tr('step1d') },
      { ic: I.tag(17), t: tr('step2'), d: tr('step2d') },
      { ic: I.whatsapp(17), t: tr('step3'), d: tr('step3d') },
    ];
    return '<div class="sr-next"><div class="sr-next__head"><span class="sr-next__title">' + esc(tr('whatsNext')) + '</span>' +
      badge('neutral', I.clock(12) + ' ' + esc(tr('eta')), 'sr-next__eta') + '</div>' +
      '<ol class="sr-next__list">' + steps.map(function (s) {
        return '<li class="sr-next__step"><span class="sr-next__ic">' + s.ic + '</span><span><strong>' + s.t + '</strong><span class="sr-next__d">' + s.d + '</span></span></li>';
      }).join('') + '</ol>' +
      '<div class="sr-next__trust">' + I.shield(14) + esc(tr('trust')) + '</div></div>';
  }

  // ── Trusted specialist (rebooking preference) ──
  // Fetches the logged-in user's trusted specialists once the request category is known, then
  // offers to prefer one for this booking. A preference, not a guarantee (re-validated server-side).
  function srMaybeLoadTrusted() {
    if (S.phase !== 'build' || S.thinking || !window.__user) return;
    var cat = S.req && S.req.category;
    if (!cat || S._trustedFetching || S._trustedCat === cat) return;
    var token = (function () { try { return (JSON.parse(localStorage.getItem('servi_user_session') || 'null') || {}).token || ''; } catch (_) { return ''; } })();
    if (!token) { S._trustedCat = cat; return; }
    S._trustedFetching = true;
    var API = (window.CONFIG && window.CONFIG.API_BASE) || '';
    fetch(API + '/api/auth/trusted-specialists?category=' + encodeURIComponent(cat), { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : { specialists: [] }; })
      .then(function (d) {
        S._trusted = (d.specialists || []).filter(function (s) { return s.available; });
        S._trustedCat = cat; S._trustedFetching = false;
        var pref = S._trusted.filter(function (s) { return s.isPreferred; })[0] || S._trusted[0];
        S._prefer = pref ? pref.providerId : null;
        render();
      })
      .catch(function () { S._trustedFetching = false; S._trustedCat = cat; });
  }

  function trustedSelectorHTML() {
    var list = S._trusted || [];
    if (!list.length) return '';
    var es = curLang() === 'es';
    var title = es ? 'Tu especialista de confianza' : 'Your trusted specialist';
    var noPref = es ? 'Sin preferencia — primer disponible' : 'No preference — first available';
    var note = es
      ? 'Es una preferencia, no una garantía. Si no está disponible, te conectamos con otro especialista verificado.'
      : "This is a preference, not a guarantee. If they're unavailable we'll connect you with another verified specialist.";
    function optBtn(id, name, desc, on) {
      return '<button type="button" class="sr-radio' + (on ? ' sr-radio--on' : '') + '" data-action="prefer:' + esc(id) + '">' +
        '<span class="sr-radio__ic">' + I.shield(18) + '</span><span class="sr-radio__txt">' +
        '<span class="sr-radio__label">' + esc(name) + '</span>' +
        (desc ? '<span class="sr-radio__desc">' + esc(desc) + '</span>' : '') + '</span></button>';
    }
    var opts = list.map(function (s) {
      var name = (s.maskedName || '★') + (s.isPreferred ? (es ? ' · Preferido' : ' · Preferred') : '');
      var desc = s.completedForYou > 0
        ? (es ? ('Completó ' + s.completedForYou + ' servicio' + (s.completedForYou === 1 ? '' : 's') + ' para ti') : ('Completed ' + s.completedForYou + ' service' + (s.completedForYou === 1 ? '' : 's') + ' for you'))
        : '';
      return optBtn(s.providerId, name, desc, S._prefer === s.providerId);
    }).join('');
    opts += optBtn('none', noPref, '', S._prefer == null);
    return '<div class="sr-card sr-fade-in"><div class="sr-card__head"><h3 class="sr-card__title">' + esc(title) + '</h3></div>' +
      '<div class="sr-when">' + opts + '</div>' +
      '<p class="sr-rail__fine" style="margin-top:10px">' + esc(note) + '</p></div>';
  }

  function buildHTML() {
	    var left = '<div class="sr-pane-left">' +
	      (S.thinking
	        ? '<div class="sr-think"><span class="sr-think__spark">' + I.spark(18) + '</span><div><div class="sr-think__line">' +
	            esc(S.mode === 'photos' ? tr('thinkPhotos') : S.mode === 'voice' ? tr('thinkVoice') : S.mode === 'video' ? tr('thinkVideo') : tr('thinkText')) +
	            '</div><div class="sr-think__bars"><i></i><i></i><i></i></div></div></div>'
	        : ((S.mode === 'video') ? mediaReceivedHTML()
	            : understandingHTML()) + followupsHTML()) +
      (S.thinking ? '' : whenWhereHTML()) + (S.thinking ? '' : trustedSelectorHTML()) + '</div>';

    var canSend = S.address.trim() && (S.when === 'asap' || (S.when === 'schedule' && S.date));
    var right = '<div class="sr-pane-right"><div class="sr-rail">' + summaryHTML() + nextStepsHTML() +
      btn('accent', 'lg', tr('sendRequest'), { action: 'submit', block: true, id: 'sr-submit', disabled: S.thinking || !canSend, iconRight: I.send(18) }) +
      '<p class="sr-rail__fine">' + esc(tr('fine')) + '</p></div></div>';

    return '<div class="sr-stage"><div class="sr-dash' + (SETTINGS.twoPane === false ? ' sr-dash--single' : '') + '" style="' +
      (SETTINGS.twoPane === false ? 'grid-template-columns:minmax(0,640px);justify-content:center' : '') + '">' + left + right + '</div></div>';
  }

  // ════════════════════════════ SUCCESS ════════════════════════════════════
  function successHTML() {
    var id = S.submittedId ? String(S.submittedId).slice(0, 8).toUpperCase() : null;
    var whenStr = S.when === 'asap' ? tr('asap') : (S.date ? fmtDate(S.date) + (S.time ? ' · ' + S.time : '') : tr('scheduled'));
    var what = (S.mode === 'text' || S.mode === 'voice' || S.mode === 'photos') && S.req.service ? S.req.service
      : (S.mode === 'voice' ? tr('voiceNoteLabel') : S.mode === 'video' ? tr('videoClip') : tr('nPhotos', { n: S.media.length }));
    return '<div class="sr-stage sr-stage--narrow sr-fade-in"><div class="sr-success">' +
      '<div class="sr-success__check">' + I.checkCircle(40) + '</div>' +
      '<h2 class="sr-success__title">' + esc(tr('successTitle')) + '</h2>' +
      '<p class="sr-success__sub">' + esc(tr('successSub')) + '</p>' +
      '<div class="sr-success__card">' + (id ? '<div class="sr-success__id">' + esc(tr('successRequest')) + ' <strong>#' + esc(id) + '</strong></div>' : '') +
        '<div class="sr-success__rows"><div><span>' + esc(tr('successRequest')) + '</span>' + esc(what) + '</div>' +
        '<div><span>' + esc(tr('rowWhen')) + '</span>' + esc(whenStr) + '</div><div><span>' + esc(tr('rowWhere')) + '</span>' + esc(S.address || '—') + '</div></div></div>' +
      '<div class="sr-success__actions">' + btn('accent', 'md', tr('openWhatsapp'), { action: 'open-whatsapp', iconLeft: I.whatsapp(18) }) +
        btn('secondary', 'md', tr('myOrders'), { action: 'my-orders', iconLeft: I.grid(18) }) +
        btn('secondary', 'md', tr('newRequest'), { action: 'reset' }) + '</div></div></div>';
  }

  // ════════════════════════════ TOP BAR + MODALS ═══════════════════════════
  function topbarHTML() {
    if (window.SR_USE_SITE_HEADER) {
      return '';
    }
    var loc = S.address.length > 22 ? defaultAddress() : S.address;
    return '<header class="sr-top"><div class="sr-top__in">' +
      '<span class="servi-logo" style="font-size:26px">SERVI<i class="servi-logo__dot"></i></span>' +
      '<div class="sr-top__right">' +
      '<span class="sr-top__loc">' + I.pin(14) + esc(loc) + '</span>' +
      '<span class="sr-lang"><button class="' + (curLang() === 'en' ? 'on' : '') + '" data-action="sr-lang:en">EN</button><button class="' + (curLang() === 'es' ? 'on' : '') + '" data-action="sr-lang:es">ES</button></span>' +
      (srDebug() ? '<button type="button" class="sr-iconbtn sr-iconbtn--outline" data-action="open-tweaks" aria-label="Settings" style="width:38px;height:38px">' + I.sliders(17) + '</button>' : '') +
      '</div></div></header>';
  }

  function render() {
    root = root || document.getElementById('sr-root');
    if (!root) return;
    var body = S.phase === 'compose' ? composeHTML() : S.phase === 'build' ? buildHTML() : successHTML();
    root.innerHTML = topbarHTML() + '<main class="sr-main">' + body + '</main>';
    mountAddressFields();
    if (S.phase === 'compose' && S.mode === 'text') {
      var ta = document.getElementById('sr-ta');
      if (ta && ta.value.trim()) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      startSrPlaceholderRotation();
    } else {
      stopSrPlaceholderRotation();
    }
    srMaybeLoadTrusted();
  }

  // ── service picker modal ──
  var pickerCat = null;
  function openPicker() {
    pickerCat = (S.req.category && CAT()[S.req.category]) ? S.req.category : 'cleaning';
    renderPicker();
  }
  function renderPicker() {
    var cats = CAT(), c = cats[pickerCat];
    var html = '<div class="sr-modal__overlay" data-action="modal-close"><div class="sr-modal" data-stop>' +
      '<div class="sr-modal__head"><h3 class="sr-modal__title">' + esc(tr('chooseService')) + '</h3>' +
      '<button type="button" class="sr-modal__close" data-action="modal-close">' + I.x(18) + '</button></div>' +
      '<div class="sr-modal__body"><div class="sr-pick__cats">' + Object.keys(cats).map(function (k) {
        return '<button type="button" class="sr-pick__cat' + (pickerCat === k ? ' on' : '') + '" data-pickcat="' + k + '"><span>' + cats[k].emoji + '</span>' + cats[k].label + '</button>';
      }).join('') + '</div><div class="sr-pick__list">' + c.subs.map(function (sub) {
        return '<div class="sr-pick__group"><div class="sr-pick__group-label">' + sub.label + '</div>' +
          sub.services.map(function (svc) {
            return '<button type="button" class="sr-pick__svc' + (S.req.service === svc ? ' on' : '') + '" data-pick="' + esc(svc) + '" data-sub="' + sub.key + '">' +
              esc(svc) + (S.req.service === svc ? I.check(16) : '') + '</button>';
          }).join('') + '</div>';
      }).join('') + '</div></div></div></div>';
    mountModal(html);
  }

  function openBrowse() {
    var cats = CAT();
    var html = '<div class="sr-modal__overlay" data-action="modal-close"><div class="sr-modal" data-stop>' +
      '<div class="sr-modal__head"><h3 class="sr-modal__title">' + esc(tr('browseAll')) + '</h3>' +
      '<button type="button" class="sr-modal__close" data-action="modal-close">' + I.x(18) + '</button></div>' +
      '<div class="sr-modal__body"><p style="margin:0 0 16px;font-size:14px;color:var(--text-secondary)">' + esc(tr('browseLead')) + '</p>' +
      '<div class="sr-browsegrid">' + Object.keys(cats).map(function (k) {
        return '<div class="sr-browsecard" data-action="modal-close"><span class="sr-browsecard__emoji">' + cats[k].emoji + '</span><span class="sr-browsecard__name">' + cats[k].label + '</span></div>';
      }).join('') + '</div></div></div></div>';
    mountModal(html);
  }

  // ── tweaks modal ──
  function openTweaks() {
    var seg = function (action, val, cur, label) { return '<button type="button" class="sr-pick__cat' + (cur ? ' on' : '') + '" data-action="' + action + ':' + val + '">' + label + '</button>'; };
    var html = '<div class="sr-modal__overlay" data-action="modal-close"><div class="sr-modal" data-stop style="max-width:460px">' +
      '<div class="sr-modal__head"><h3 class="sr-modal__title">Settings</h3><button type="button" class="sr-modal__close" data-action="modal-close">' + I.x(18) + '</button></div>' +
      '<div class="sr-modal__body" style="display:flex;flex-direction:column;gap:20px">' +
        '<div><div class="sr-pick__group-label">Parse engine</div><div class="sr-pick__cats">' +
          seg('tw-engine', 'ai', SETTINGS.engine === 'ai', 'AI (primary)') + seg('tw-engine', 'heuristic', SETTINGS.engine === 'heuristic', 'Heuristic') + '</div>' +
          '<p style="margin:8px 0 0;font-size:12px;color:var(--text-muted)">AI understands free text; heuristic is the offline keyword fallback.</p></div>' +
        '<div><div class="sr-pick__group-label">Layout after send</div><div class="sr-pick__cats">' +
          seg('tw-layout', 'two', SETTINGS.twoPane !== false, 'Two-pane') + seg('tw-layout', 'single', SETTINGS.twoPane === false, 'Single column') + '</div></div>' +
        '<div><div class="sr-pick__group-label">Voice limit</div><div class="sr-pick__cats">' +
          [30, 60, 90, 120].map(function (v) { return seg('tw-voice', v, SETTINGS.voiceLimit === v, v + 's'); }).join('') + '</div></div>' +
        '<div><div class="sr-pick__group-label">“What happens next” panel</div><div class="sr-pick__cats">' +
          seg('tw-next', 'on', SETTINGS.showNext !== false, 'Show') + seg('tw-next', 'off', SETTINGS.showNext === false, 'Hide') + '</div></div>' +
      '</div></div></div>';
    mountModal(html);
  }

  // ── mobile confirmation modal ──
  // On the stacked (mobile) layout the inline rail summary is hidden to save
  // scroll; instead, tapping "Send request" surfaces this double-confirm sheet
  // so the client reviews their details one last time before it's submitted.
  function srIsStacked() {
    try { return window.matchMedia('(max-width: 920px)').matches; } catch (_) { return false; }
  }
  function openConfirm() {
    var html = '<div class="sr-modal__overlay" data-action="modal-close"><div class="sr-modal sr-modal--confirm" data-stop>' +
      '<div class="sr-modal__head"><h3 class="sr-modal__title">' + esc(tr('confirmTitle')) + '</h3>' +
        '<button type="button" class="sr-modal__close" data-action="modal-close" aria-label="' + esc(tr('editRequest')) + '">' + I.x(18) + '</button></div>' +
      '<div class="sr-modal__body sr-confirm">' +
        '<p class="sr-confirm__lead">' + esc(tr('confirmLead')) + '</p>' +
        '<div class="sr-confirm__sum">' + summaryRowsHTML() + '</div>' +
        '<div class="sr-confirm__acts">' +
          btn('accent', 'lg', tr('confirmSend'), { action: 'submit-go', block: true, id: 'sr-confirm-go', iconRight: I.send(18) }) +
          btn('secondary', 'md', tr('editRequest'), { action: 'modal-close', block: true }) +
        '</div>' +
        '<p class="sr-confirm__fine">' + esc(tr('fine')) + '</p>' +
      '</div></div></div>';
    mountModal(html);
  }

  var modalLayer = null;
  function modalMountTarget() {
    return document.getElementById('sr-overlay') || document.body;
  }
  function mountModal(html) { closeModal(); modalLayer = h(html); modalMountTarget().appendChild(modalLayer); }
  function closeModal() { if (modalLayer) { modalLayer.remove(); modalLayer = null; } }

  // ════════════════════════════ ACTIONS ════════════════════════════════════
	  function switchMode(m) { discardActiveVoice(); S.mode = m; S.text = ''; S.atts = []; S.media = []; S.rec = null; render(); }

  function submitText() {
    if (!S.text.trim()) return;
    if (S.atts.some(function (a) { return a.uploading; })) return;
    syncRequestLanguage(S.text);
    runAnalyze('text', S.text.trim());
  }

  function runAnalyze(mode, payloadText) {
    if (mode === 'text') syncRequestLanguage(payloadText);
    S.mode = mode; S.answers = {}; S.phase = 'build'; S.thinking = true; S.req = { emoji: '✨', categoryLabel: 'Custom request' };
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    var started = Date.now();
	    var p;
	    if (mode === 'text') p = window.serviParse(payloadText, { engine: SETTINGS.engine });
	    else if (mode === 'voice') p = window.serviAnalyzeVoice({ media: S.media, details: S.text.trim() });
	    else if (mode === 'photos') p = window.serviAnalyzePhotos({ media: S.media, details: S.text.trim() });
    else p = window.serviAnalyzeVideo({ media: S.media, details: S.text.trim() });
    p.then(function (parsed) {
      var wait = Math.max(0, 850 - (Date.now() - started));
      setTimeout(function () {
        S.req = parsed;
        if (parsed.inferredDate) { S.when = 'schedule'; S.date = parsed.inferredDate; S.dateLabel = parsed.inferredDateLabel || ''; }
        else if (parsed.urgency === 'asap') { S.when = 'asap'; S.date = ''; S.dateLabel = ''; }
        else if (parsed.urgency === 'scheduled') { S.when = 'schedule'; S.date = ''; S.dateLabel = ''; }
        else { S.when = ''; S.date = ''; S.dateLabel = ''; }
        S.thinking = false; render();
      }, wait);
    });
  }

	  // ── recorders ──
	  function audioMimeType() {
	    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
	    var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
	    for (var i = 0; i < types.length; i++) {
	      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
	    }
	    return '';
	  }

	  function startVoice() {
	    function beginFallback() {
	      S.rec = { phase: 'recording', elapsed: 0, t0: Date.now(), noRecorder: true };
	      render();
	      S.rec.timer = setInterval(function () {
	        S.rec.elapsed = (Date.now() - S.rec.t0) / 1000;
	        var el = document.getElementById('sr-rec-elapsed'); if (el) el.textContent = fmtTime(S.rec.elapsed);
	        if (S.rec.elapsed >= SETTINGS.voiceLimit) finishVoice();
	      }, 100);
	      startWave('sr-wave');
	    }
	    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
	      beginFallback();
	      return;
	    }
	    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
	      var chunks = [];
	      var mimeType = audioMimeType();
	      var recorder = new MediaRecorder(stream, mimeType ? { mimeType: mimeType } : undefined);
	      var rec = { phase: 'recording', elapsed: 0, t0: Date.now(), stream: stream, recorder: recorder, chunks: chunks };
	      S.rec = rec;
	      render();
	      rec.timer = setInterval(function () {
	        rec.elapsed = (Date.now() - rec.t0) / 1000;
	        var el = document.getElementById('sr-rec-elapsed'); if (el) el.textContent = fmtTime(rec.elapsed);
	        if (rec.elapsed >= SETTINGS.voiceLimit) finishVoice();
	      }, 100);
	      startWaveFromStream('sr-wave', stream);
	      recorder.addEventListener('dataavailable', function (e) {
	        if (e.data && e.data.size) chunks.push(e.data);
	      });
	      recorder.addEventListener('stop', function () {
	        stream.getTracks().forEach(function (t) { t.stop(); });
	        if (rec.discard) return;
	        var type = recorder.mimeType || mimeType || 'audio/webm';
	        var blob = new Blob(chunks, { type: type });
	        var dur = Math.max(1, Math.round(rec.elapsed || ((Date.now() - rec.t0) / 1000)));
	        var file = typeof File === 'function'
	          ? new File([blob], 'servi-voice-note.webm', { type: type })
	          : blob;
	        var previewUrl = URL.createObjectURL(blob);
	        var item = { kind: 'voice', url: previewUrl, previewUrl: previewUrl, name: 'Voice note', dur: dur, uploading: true };
	        S.media = [item];
	        S.rec = { phase: 'done', elapsed: dur, item: item };
	        render();
	        uploadAttachment(file).then(function (d) { item.url = d.url; item.uploading = false; render(); })
	          .catch(function () { item.uploading = false; item.uploadError = true; render(); });
	      });
	      recorder.start(250);
	    }).catch(function () {
	      beginFallback();
	    });
	  }
	  function finishVoice() {
	    if (!S.rec) return;
	    var rec = S.rec;
	    rec.elapsed = (Date.now() - rec.t0) / 1000;
	    clearInterval(rec.timer);
	    if (rec.recorder && rec.recorder.state !== 'inactive') {
	      if (waveRAF) cancelAnimationFrame(waveRAF);
	      waveRAF = null; waveStream = null;
	      rec.recorder.stop();
	      return;
	    }
	    stopWave();
	    rec.phase = 'done';
	    render();
	  }
	  function discardActiveVoice() {
	    if (!S.rec) return;
	    clearInterval(S.rec.timer);
	    S.rec.discard = true;
	    if (S.rec.recorder && S.rec.recorder.state !== 'inactive') S.rec.recorder.stop();
	    else if (S.rec.stream) S.rec.stream.getTracks().forEach(function (t) { t.stop(); });
	    stopWave();
	  }
  function startVid() {
    S.rec = { phase: 'vidrec', elapsed: 0, t0: Date.now() };
    render();
    S.rec.timer = setInterval(function () {
      S.rec.elapsed = (Date.now() - S.rec.t0) / 1000;
      var el = document.getElementById('sr-rec-elapsed'); if (el) el.textContent = fmtTime(S.rec.elapsed);
      if (S.rec.elapsed >= 90) stopVid();
    }, 100);
  }
  function stopVid() { if (!S.rec) return; clearInterval(S.rec.timer); var d = Math.max(1, Math.round(S.rec.elapsed)); S.rec = null; S.media = [{ kind: 'video', sample: true, dur: d }]; render(); }

	  // waveform animation (real mic if available, else simulated)
	  var waveRAF = null, waveStream = null;
	  function startWaveFromStream(id, stream) {
	    var wrap = document.getElementById(id); if (!wrap || !stream) return;
	    var bars = wrap.querySelectorAll('span');
	    try {
	      waveStream = stream;
	      var ctx = new (window.AudioContext || window.webkitAudioContext)();
	      var src = ctx.createMediaStreamSource(stream);
	      var an = ctx.createAnalyser(); an.fftSize = 64; src.connect(an);
	      var data = new Uint8Array(an.frequencyBinCount);
	      (function loop() {
	        an.getByteFrequencyData(data);
	        for (var i = 0; i < bars.length; i++) {
	          var v = data[Math.floor(i / bars.length * data.length)] / 255;
	          bars[i].style.transform = 'scaleY(' + Math.max(0.12, v) + ')';
	        }
	        waveRAF = requestAnimationFrame(loop);
	      })();
	    } catch (_) {
	      fakeWave(bars);
	    }
	  }
	  function startWave(id) {
	    var wrap = document.getElementById(id); if (!wrap) return;
    var bars = wrap.querySelectorAll('span');
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        waveStream = stream;
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var src = ctx.createMediaStreamSource(stream);
        var an = ctx.createAnalyser(); an.fftSize = 64; src.connect(an);
        var data = new Uint8Array(an.frequencyBinCount);
        (function loop() { an.getByteFrequencyData(data); for (var i = 0; i < bars.length; i++) { var v = data[Math.floor(i / bars.length * data.length)] / 255; bars[i].style.transform = 'scaleY(' + Math.max(0.12, v) + ')'; } waveRAF = requestAnimationFrame(loop); })();
      }).catch(function () { fakeWave(bars); });
    } else { fakeWave(bars); }
  }
  function fakeWave(bars) { (function loop() { for (var i = 0; i < bars.length; i++) bars[i].style.transform = 'scaleY(' + (0.15 + Math.random() * 0.85).toFixed(2) + ')'; waveRAF = requestAnimationFrame(function () { setTimeout(loop, 90); }); })(); }
  function stopWave() { if (waveRAF) cancelAnimationFrame(waveRAF); waveRAF = null; if (waveStream) { waveStream.getTracks().forEach(function (t) { t.stop(); }); waveStream = null; } }

  // ── hidden file input ──
  function pickFiles(accept, multiple, capture, cb) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept; if (multiple) inp.multiple = true; if (capture) inp.capture = capture;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', function () { cb(Array.from(inp.files || [])); inp.remove(); });
    inp.click();
  }
  function uploadAttachment(file) {
    var API = (window.CONFIG && window.CONFIG.API_BASE) || '';
    var fd = new FormData(); fd.append('file', file);
    return fetch(API + '/api/uploads', { method: 'POST', body: fd })
      .then(function (r) { if (!r.ok) throw new Error('upload-' + r.status); return r.json(); });
  }

  function addVideoFile(file) {
    if (!file) return;
    var item = { kind: 'video', url: URL.createObjectURL(file), name: file.name, uploading: true };
    S.media = [item]; render();
    uploadAttachment(file).then(function (d) { item.url = d.url; item.uploading = false; render(); })
      .catch(function () { item.uploading = false; render(); });
  }

  var MAX_TEXT_ATTS = 4;
  function addTextAttachment(file, kind) {
    if (!file || S.atts.length >= MAX_TEXT_ATTS) return;
    var item = { kind: kind, url: URL.createObjectURL(file), name: file.name, uploading: true };
    S.atts.push(item);
    uploadAttachment(file).then(function (d) { item.url = d.url; item.uploading = false; render(); })
      .catch(function () { var i = S.atts.indexOf(item); if (i > -1) S.atts.splice(i, 1); render(); });
  }

  function pickVideo(capture) {
    pickFiles('video/*', false, capture ? 'environment' : null, function (files) {
      addVideoFile(files[0]);
    });
  }

  // ── production-shaped payload for POST /api/service-requests ──
	  function buildPayload() {
	    var details = Object.keys(S.answers).filter(function (k) { return S.answers[k]; }).map(function (k) { return S.answers[k]; });
      var extraDetails = S.text ? S.text.trim() : '';
	    var desc = S.req.summary || '';
      if (S.mode === 'text') desc = desc || extraDetails;
      else if (extraDetails) desc = desc ? (desc + ' — ' + extraDetails) : extraDetails;
	    if (details.length) desc += (desc ? ' — ' : '') + details.join(', ');
	    if (S.req.transcript) {
        desc = S.req.transcript;
        if (S.mode !== 'text' && extraDetails) desc += ' — ' + extraDetails;
        if (details.length) desc += ' — ' + details.join(', ');
      }
	    var aiStatus = S.req.aiStatus || (S.req.adminReview ? 'manual_review' : 'understood');
	    var isUnderstood = aiStatus === 'understood';
	    return {
	      category: S.req.category || 'custom',
	      description: desc,
      preferredDate: S.when === 'schedule' ? S.date : null,
      preferredTime: S.when === 'schedule' ? (S.time || null) : null,
      isAsap: S.when === 'asap',
      serviceAddress: S.address,
      serviceAddressDetails: S.addressDetails || undefined,
      clientName: (window.__user && window.__user.name) || '',
      clientPhone: (window.__user && window.__user.phone) || '',
      clientEmail: (window.__user && window.__user.email) || '',
      lang: (typeof window.lang === 'function' ? window.lang() : 'en'),
	      attachments: (S.atts.concat(S.media)).map(function (a) { return a.url; }).filter(Boolean),
	      // ── additive SERVI Intelligence metadata (admin dispatch context) ──
	      requestMode: S.mode,
	      matchedService: isUnderstood ? (S.req.service || null) : null,
	      matchedSubKey: isUnderstood ? (S.req.subKey || null) : null,
	      aiSummary: S.req.summary || null,
	      aiConfidence: S.req.confidence || null,
	      aiSource: S.req.source || null,
	      aiStatus: aiStatus,
	      aiReason: S.req.aiReason || null,
	      aiEvidence: Array.isArray(S.req.aiEvidence) ? S.req.aiEvidence : [],
	      detailAnswers: S.answers,
      clientRequestId: (S._reqId || (S._reqId = clientReqId())),
      // Trusted-specialist preference (server re-validates the provider is verified).
      preferredProviderId: S._prefer || undefined,
    };
  }

  // Validate + sync the structured address. Returns false if invalid (the form
  // focuses the offending field). Run this before opening the mobile confirm
  // sheet so that focus lands on a visible field, not one hidden behind it.
  function srEnsureAddress() {
    if (window.ServiAddress && document.getElementById(SR_ADDR_PREFIX + '_root')) {
      if (!window.ServiAddress.validate(SR_ADDR_PREFIX)) return false;
      syncAddressFromFields();
    }
    return true;
  }

  function submit() {
    if (!srEnsureAddress()) return;
    if (!window.__user) {
      if (typeof window.openAuthModal === 'function') {
        var resume = function () { window.removeEventListener('servi-auth-success', resume); setTimeout(submit, 100); };
        window.addEventListener('servi-auth-success', resume);
        window.openAuthModal('login');
      }
      return;
    }
    var payload = buildPayload();
    payload.clientName = (window.__user && window.__user.name) || '';
    payload.clientPhone = (window.__user && window.__user.phone) || '';
    payload.clientEmail = (window.__user && window.__user.email) || '';

    // The confirm-sheet button (mobile) takes priority over the rail button so
    // the loading state shows where the user actually tapped.
    function activeSubmitBtn() { return document.getElementById('sr-confirm-go') || document.getElementById('sr-submit'); }
    var btnEl = activeSubmitBtn();
    if (btnEl) { btnEl.disabled = true; var sp = btnEl.querySelector('span'); if (sp) sp.textContent = tr('sending'); }
    var API = (window.CONFIG && window.CONFIG.API_BASE) || '';
    var headers = (typeof window.__serviJsonAuthHeaders === 'function') ? window.__serviJsonAuthHeaders() : { 'Content-Type': 'application/json' };

    function restoreBtn() {
      var b = activeSubmitBtn();
      if (b) { b.disabled = false; var s = b.querySelector('span'); if (s) s.textContent = b.id === 'sr-confirm-go' ? tr('confirmSend') : tr('sendRequest'); }
    }

    fetch(API + '/api/service-requests', { method: 'POST', headers: headers, body: JSON.stringify(payload) })
      .then(function (r) {
        if (r.ok) return r.json().catch(function () { return {}; });
        return r.json().catch(function () { return {}; }).then(function (body) {
          var e = new Error(body.message || ('HTTP ' + r.status));
          e.status = r.status; e.body = body; throw e;
        });
      })
      .then(function (data) {
        if (payload.serviceAddressDetails && window.ServiAddress && window.ServiAddress.rememberLastUsed) {
          window.ServiAddress.rememberLastUsed(payload.serviceAddressDetails);
        }
        S.submittedId = data && data.id; S.phase = 'success'; closeModal(); render(); window.scrollTo({ top: 0 });
      })
      .catch(function (err) {
        // Dismiss the confirm sheet (if open) so gates/alerts below it are visible.
        closeModal();
        if (err && err.body && err.body.error === 'email_required' && typeof window.__showServiceRequestEmailGate === 'function') {
          restoreBtn();
          window.__showServiceRequestEmailGate({ target: document.querySelector('.sr-pane-left') || document.getElementById('sr-root'), retry: submit });
          return;
        }
        if (err && err.body && err.body.error === 'phone_required') {
          restoreBtn();
          alert(err.body.message || tr('errorGeneric'));
          return;
        }
        restoreBtn();
        var msg = (typeof window.__serviceRequestErrorMessage === 'function')
          ? window.__serviceRequestErrorMessage(err && err.body && err.body.error, tr('errorGeneric'))
          : (err && err.message) || tr('errorGeneric');
        alert(msg);
      });
  }

	  function reset() {
	    discardActiveVoice(); stopWave(); if (S.rec && S.rec.timer) clearInterval(S.rec.timer);
    S.phase = 'compose'; S.mode = 'text'; S.text = ''; S.atts = []; S.media = []; S.rec = null; S._reqId = null; S.submittedId = null;
    S.thinking = false; S.req = { emoji: '✨', categoryLabel: 'Custom request' }; S.answers = {};
    S.when = ''; S.date = ''; S.time = ''; S.dateLabel = ''; S.address = defaultAddress(); S.addressDetails = null;
    S._trusted = []; S._trustedCat = null; S._trustedFetching = false; S._prefer = null;
    render();
  }

  // ════════════════════════════ EVENT DELEGATION ═══════════════════════════
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action], [data-pick], [data-pickcat]');
    if (!t) return;

    if (t.hasAttribute('data-pickcat')) { pickerCat = t.getAttribute('data-pickcat'); renderPicker(); return; }
    if (t.hasAttribute('data-pick')) {
      var svc = t.getAttribute('data-pick'), subKey = t.getAttribute('data-sub');
      var cats = CAT(), c = cats[pickerCat], sub = c.subs.find(function (s) { return s.key === subKey; });
	      S.req = Object.assign({}, S.req, { category: pickerCat, categoryLabel: c.label, emoji: c.emoji, subKey: subKey, subLabel: sub.label, service: svc, confidence: 1, aiStatus: 'understood', aiReason: null });
      S.answers = {}; closeModal(); render(); return;
    }

    var a = t.getAttribute('data-action'); if (!a) return;
    var parts = a.split(':'), cmd = parts[0], arg = parts[1];

    switch (cmd) {
      case 'mode':
        switchMode(arg);
        break;
      case 'send-text': submitText(); break;
      case 'attach-photos': pickFiles('image/*', true, 'environment', function (files) {
        files.slice(0, MAX_TEXT_ATTS - S.atts.length).forEach(function (f) { addTextAttachment(f, 'photo'); });
        S.atts = S.atts.slice(0, MAX_TEXT_ATTS); render();
      }); break;
      case 'attach-video': pickFiles('video/*', false, null, function (files) {
        addTextAttachment(files[0], 'video');
        S.atts = S.atts.slice(0, MAX_TEXT_ATTS); render();
      }); break;
      case 'remove-att': S.atts.splice(+arg, 1); render(); break;
      case 'mic-toggle': (S.rec && S.rec.phase === 'recording') ? finishVoice() : startVoice(); break;
	      case 'voice-use': if (S.media.some(function (m) { return m.uploading; })) return; runAnalyze('voice'); break;
	      case 'voice-reset': discardActiveVoice(); S.rec = null; S.media = []; render(); break;
      case 'media-upload': pickFiles(S.mode === 'photos' ? 'image/*' : 'video/*', S.mode === 'photos', S.mode === 'photos' ? 'environment' : null, function (files) {
          if (S.mode === 'photos') {
            files.slice(0, 5 - S.media.length).forEach(function (f) {
              var item = { kind: 'photo', url: URL.createObjectURL(f), uploading: true };
              S.media.push(item);
              uploadAttachment(f).then(function (d) { item.url = d.url; item.uploading = false; render(); })
                .catch(function () { var i = S.media.indexOf(item); if (i > -1) S.media.splice(i, 1); render(); });
            });
            S.media = S.media.slice(0, 5);
          } else { addVideoFile(files[0]); return; }
          render();
        }); break;
      case 'media-record': startVid(); break;
      case 'media-sample': if (S.mode === 'photos') S.media = S.media.concat([{ kind: 'photo', sample: true }]).slice(0, 5); else S.media = [{ kind: 'video', sample: true, dur: 12 }]; render(); break;
      case 'media-remove': S.media.splice(+arg, 1); render(); break;
      case 'media-use': if (S.media.some(function (m) { return m.uploading; })) return; runAnalyze(S.mode); break;
      case 'vid-stop': stopVid(); break;
	      case 'open-picker': openPicker(); break;
	      case 'clarify-text': S.phase = 'compose'; S.mode = 'text'; S.text = ''; S.rec = null; render(); break;
      case 'when': S.when = arg; if (arg === 'asap') { S.date = ''; S.time = ''; } render(); break;
      case 'use-loc': {
        if (window.ServiAddress && document.getElementById(SR_ADDR_PREFIX + '_root')) {
          window.ServiAddress.geolocate(SR_ADDR_PREFIX);
          setTimeout(syncAddressFromFields, 1200);
          break;
        }
        var locBtn = document.querySelector('.sr-loc'); if (locBtn) locBtn.classList.add('busy');
        if (!navigator.geolocation) { if (locBtn) locBtn.classList.remove('busy'); break; }
        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos.coords.latitude, lng = pos.coords.longitude;
          var done = function (addr) { S.address = addr; render(); };
          if (typeof window.__serviReverseGeocode === 'function') {
            Promise.resolve(window.__serviReverseGeocode(lat, lng)).then(function (a) { done(a || (lat.toFixed(5) + ', ' + lng.toFixed(5))); }).catch(function () { done(lat.toFixed(5) + ', ' + lng.toFixed(5)); });
          } else { done(lat.toFixed(5) + ', ' + lng.toFixed(5)); }
        }, function () { var b = document.querySelector('.sr-loc'); if (b) b.classList.remove('busy'); });
        break;
      }
      case 'chip': var key = arg, val = t.getAttribute('data-val'); S.answers[key] = (S.answers[key] === val ? '' : val); render(); break;
      case 'prefer': S._prefer = (arg === 'none' ? null : arg); render(); break;
      case 'submit':
        // Mobile (stacked) layout: confirm details in a sheet first. Desktop sends directly.
        if (srIsStacked() && S.phase === 'build') { if (srEnsureAddress()) openConfirm(); }
        else submit();
        break;
      case 'submit-go': submit(); break;
      case 'reset': reset(); break;
      case 'my-orders': window.location.href = '/account.html?section=orders'; break;
      case 'sr-lang': if (typeof window.setLang === 'function') window.setLang(arg); else { window.__lang = arg; } render(); break;
      case 'browse-open': window.location.href = '/browse.html'; break;
      case 'open-tweaks': openTweaks(); break;
      case 'modal-close': if (e.target.closest('[data-stop]') && !e.target.closest('.sr-modal__close') && !e.target.closest('.sr-browsecard')) return; closeModal(); break;
      case 'open-whatsapp': {
        var cfg = window.CONFIG || {};
        if ((cfg.CONTACT_MODE || 'whatsapp') === 'email') {
          window.location.href = 'mailto:' + (cfg.CONTACT_EMAIL || 'serv.clientserv@gmail.com');
        } else {
          window.open('https://wa.me/' + (cfg.WHATSAPP_NUMBER || '525525112588'), '_blank');
        }
        break;
      }
      case 'tw-engine': SETTINGS.engine = arg; saveSettings(); openTweaks(); break;
      case 'tw-layout': SETTINGS.twoPane = (arg === 'two'); saveSettings(); openTweaks(); break;
      case 'tw-voice': SETTINGS.voiceLimit = +arg; saveSettings(); openTweaks(); break;
      case 'tw-next': SETTINGS.showNext = (arg === 'on'); saveSettings(); openTweaks(); break;
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'sr-ta') { S.text = e.target.value; var send = document.querySelector('[data-action="send-text"]'); if (send) { send.disabled = !S.text.trim(); send.classList.toggle('sr-iconbtn--accent', !!S.text.trim()); send.classList.toggle('sr-iconbtn--solid', !S.text.trim()); } if (S.text.trim()) { stopSrPlaceholderRotation(); e.target.placeholder = ''; syncRequestLanguage(S.text); } var box = document.getElementById('sr-box'); }
    else if (e.target.hasAttribute && e.target.hasAttribute('data-sr-details')) { S.text = e.target.value; }
    else if (e.target.id === 'sr-addr') { S.address = e.target.value; }
    else if (e.target.closest && e.target.closest('#' + SR_ADDR_PREFIX + '_root')) { syncAddressFromFields(); }
    else if (e.target.id === 'sr-date') { S.date = e.target.value; var s = document.getElementById('sr-submit'); if (s) s.disabled = !(S.address.trim() && (S.when === 'asap' || S.date)); }
    else if (e.target.id === 'sr-time') { S.time = e.target.value; }
    else if (e.target.hasAttribute && e.target.hasAttribute('data-fup')) { S.answers[e.target.getAttribute('data-fup')] = e.target.value; }
  });
  document.addEventListener('focusin', function (e) { if (e.target.id === 'sr-ta') { stopSrPlaceholderRotation(); e.target.placeholder = ''; var b = document.getElementById('sr-box'); if (b) b.classList.add('focus'); } });
  document.addEventListener('focusout', function (e) { if (e.target.id === 'sr-ta') { var b = document.getElementById('sr-box'); if (b) b.classList.remove('focus'); if (!e.target.value.trim()) startSrPlaceholderRotation(); } });
  document.addEventListener('keydown', function (e) {
    if (e.target.id === 'sr-ta' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitText(); }
    if (e.key === 'Escape') {
      if (modalLayer) closeModal();
      else { var ov = document.getElementById('sr-overlay'); if (ov && !ov.hidden) window.closeSmartRequest(); }
    }
  });

  window.openSmartRequest = function (opts) {
    opts = opts || {};
    root = root || document.getElementById('sr-root');
    var ov = document.getElementById('sr-overlay'); if (ov) ov.hidden = false;
    document.body.classList.add('sr-open');
    if ((opts.lang === 'es' || opts.lang === 'en') && typeof window.setLang === 'function' && window.__lang !== opts.lang) {
      window.setLang(opts.lang);
    }
    reset();
    if (opts.text) {
      S.text = String(opts.text);
      if (opts.atts && opts.atts.length) S.atts = opts.atts;  // carry attachments through to submit
      if (opts.media && opts.media.length) S.media = opts.media;  // media complements the written request
      var handoffMode = opts.mode && opts.mode !== 'text' ? opts.mode : 'text';
      S.mode = handoffMode;
      render(); runAnalyze(handoffMode, String(opts.text).trim());
    } else if (opts.media && opts.media.length) {            // inline-capture handoff → straight to review
      S.mode = opts.mode || 'photos';
      S.media = opts.media;
      runAnalyze(S.mode);
    } else if (opts.mode && opts.mode !== 'text') { switchMode(opts.mode); }
  };
	  window.closeSmartRequest = function () {
	    stopSrPlaceholderRotation();
	    discardActiveVoice(); stopWave(); if (S.rec && S.rec.timer) clearInterval(S.rec.timer);
	    var ov = document.getElementById('sr-overlay'); if (ov) ov.hidden = true;
	    document.body.classList.remove('sr-open');
	  };
})();
