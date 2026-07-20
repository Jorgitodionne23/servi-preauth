/* ─────────────────────────────────────────────────────────────────────────
   SERVI parse engine. Turns a free-text request into a structured, editable
   request object — the "intelligence" behind the prompt box.

   window.serviParse(text, { engine }) -> Promise<{
     category, categoryLabel, emoji, subKey, subLabel, service,
     summary, confidence, urgency: 'asap'|'scheduled'|'flexible',
     inferredDate: null|'YYYY-MM-DD', inferredDateLabel: null|string,
     followups: [{ q, key, chips? }], source: 'ai'|'heuristic'
   }>

   • engine 'ai'        → calls backend /api/parse-request, grounded by SERVI_CATALOG.
   • engine 'heuristic' → keyword scoring only (works fully offline).
   • 'ai' silently falls back to heuristic on any error / missing helper.
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  const CAT = () => window.SERVI_CATALOG || {};

  function norm(s) { return String(s || '').toLowerCase(); }
  function normSearch(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isWhenFollowup(item) {
    const key = normSearch(item && item.key);
    const q = normSearch(item && item.q);
    const chips = normSearch((item && item.chips || []).join(' '));
    const text = key + ' ' + q + ' ' + chips;
    return /\b(when|timing|date|schedule|scheduled|asap|soon|today|tomorrow|week|weekend|urgent|cuando|fecha|programar|agendar|agenda|pronto|hoy|manana|semana|urgente)\b/.test(text);
  }

  function stripWhenFollowups(items) {
    return (items || []).filter((item) => !isWhenFollowup(item));
  }

  // ── Natural-language date inference → real date ──────────────────────────
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function inferDate(text) {
    if (window.ServiHeuristic && typeof window.ServiHeuristic.inferDate === 'function') {
      return window.ServiHeuristic.inferDate(text);
    }
    const t = norm(text);
    const today = new Date();
    const mk = (d) => {
      const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    const label = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (/\btoday\b|\bright now\b|\bnow\b/.test(t)) return null; // handled as asap, no scheduled date
    if (/\btomorrow\b/.test(t)) { const d = new Date(today); d.setDate(d.getDate() + 1); return { date: mk(d), label: label(d) }; }
    if (/\bthis weekend\b/.test(t)) {
      const d = new Date(today); const add = (6 - d.getDay() + 7) % 7 || 6; d.setDate(d.getDate() + add); return { date: mk(d), label: 'This weekend · ' + label(d) };
    }
    for (let i = 0; i < DAYS.length; i++) {
      if (new RegExp('\\b' + DAYS[i] + '\\b').test(t)) {
        const d = new Date(today);
        let add = (i - d.getDay() + 7) % 7;
        if (add === 0) add = 7;            // "on saturday" → next saturday
        if (/\bnext\b/.test(t)) add += 7;
        d.setDate(d.getDate() + add);
        return { date: mk(d), label: label(d) };
      }
    }
    return null;
  }

  function inferUrgency(text) {
    if (window.ServiHeuristic && typeof window.ServiHeuristic.inferUrgency === 'function') {
      return window.ServiHeuristic.inferUrgency(text);
    }
    const t = norm(text);
    if (/\b(asap|urgent|urgently|emergency|right now|immediately|today|tonight|now|flooding|flooded|burst|leaking everywhere|locked out)\b/.test(t)) return 'asap';
    if (inferDate(t) || /\b(schedule|next week|on (mon|tue|wed|thu|fri|sat|sun)|tomorrow|weekend|at \d)\b/.test(t)) return 'scheduled';
    return 'flexible';
  }

  // ── Heuristic catalog match (keyword scoring) ────────────────────────────
  function heuristicMatch(text) {
    const t = ' ' + norm(text).replace(/[^a-z0-9\s]/g, ' ') + ' ';
    let best = null;
    const cats = CAT();
    for (const catKey in cats) {
      const cat = cats[catKey];
      cat.subs.forEach((sub) => {
        let score = 0;
        sub.kw.forEach((k) => { if (t.includes(' ' + k + ' ') || t.includes(k)) score += (k.includes(' ') ? 3 : 2); });
        // service-label word overlap
        sub.services.forEach((svc) => {
          norm(svc).split(/\s+/).forEach((w) => { if (w.length > 3 && t.includes(w)) score += 1; });
        });
        if (!best || score > best.score) best = { catKey, sub, score };
      });
    }
    return best && best.score > 0 ? best : null;
  }

  function pickService(sub, text) {
    const t = norm(text);
    let best = sub.services[0], bestScore = -1;
    sub.services.forEach((svc) => {
      let s = 0;
      norm(svc).split(/\s+/).forEach((w) => { if (w.length > 3 && t.includes(w)) s += 1; });
      if (s > bestScore) { bestScore = s; best = svc; }
    });
    return best;
  }

  function followupsFor(subKey) {
    return stripWhenFollowups((window.SERVI_FOLLOWUPS && window.SERVI_FOLLOWUPS[subKey]) || window.SERVI_GENERIC_FOLLOWUPS);
  }

  function heuristic(text) {
    if (window.ServiHeuristic && typeof window.ServiHeuristic.parse === 'function') {
      return window.ServiHeuristic.parse(text, {
        catalog: CAT(),
        signals: window.SERVI_HEURISTIC_SIGNALS || {},
        followups: window.SERVI_FOLLOWUPS || {},
        genericFollowups: window.SERVI_GENERIC_FOLLOWUPS || [],
        lang: (window.__lang === 'en') ? 'en' : 'es',
      });
    }
    const m = heuristicMatch(text);
    const urgency = inferUrgency(text);
    const dateInfo = urgency === 'scheduled' ? inferDate(text) : null;
    if (!m) {
      return {
        aiStatus: 'unclear',
        aiReason: 'no_catalog_match',
        category: 'custom', categoryLabel: 'Custom request', emoji: '✨',
        subKey: null, subLabel: null, service: null,
        summary: String(text || '').trim(),
        confidence: 0.35, urgency,
        inferredDate: dateInfo ? dateInfo.date : null,
        inferredDateLabel: dateInfo ? dateInfo.label : null,
        followups: stripWhenFollowups(window.SERVI_GENERIC_FOLLOWUPS),
        source: 'heuristic',
      };
    }
    const cat = CAT()[m.catKey];
    const service = pickService(m.sub, text);
    const conf = Math.min(0.95, 0.5 + m.score * 0.06);
    return {
      aiStatus: 'understood',
      aiReason: null,
      category: m.catKey, categoryLabel: cat.label, emoji: cat.emoji,
      subKey: m.sub.key, subLabel: m.sub.label, service,
      summary: String(text || '').trim(),
      confidence: conf, urgency,
      inferredDate: dateInfo ? dateInfo.date : null,
      inferredDateLabel: dateInfo ? dateInfo.label : null,
      followups: followupsFor(m.sub.key),
      source: 'heuristic',
    };
  }

  async function ai(text) {
    const API = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const lang = (window.__lang === 'en') ? 'en' : 'es';
    const res = await fetch(API + '/api/parse-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text || '').slice(0, 600), lang }),
    });
    if (!res.ok) throw new Error('parse-http-' + res.status);
    const data = await res.json();

    const cats = CAT();
    const catKey = cats[data.category] ? data.category : 'custom';
    const cat = cats[catKey];
    const sub = cat ? cat.subs.find((s) => s.key === data.subKey) : null;
    let dateLabel = null;
    if (data.inferredDate) {
      const d = new Date(data.inferredDate + 'T00:00:00');
      if (!isNaN(d)) dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    let followups = Array.isArray(data.followups) ? stripWhenFollowups(data.followups.filter((f) => f && f.q)).slice(0, 3) : [];
    if (!followups.length) followups = sub ? followupsFor(sub.key) : window.SERVI_GENERIC_FOLLOWUPS;
    followups = stripWhenFollowups(followups);
    const clientDate = inferDate(text);
    const inferredDate = data.inferredDate || (clientDate ? clientDate.date : null);
    const inferredDateLabel = data.inferredDate ? dateLabel : (clientDate ? clientDate.label : null);
    const modelUrgency = ['asap', 'scheduled', 'flexible'].includes(data.urgency) ? data.urgency : 'flexible';
    const clientUrgency = inferUrgency(text);
    const urgency = clientUrgency !== 'flexible' ? clientUrgency : modelUrgency;

    return {
      aiStatus: data.aiStatus || 'understood',
      aiReason: data.aiReason || null,
      aiEvidence: data.aiEvidence || [],
      category: catKey,
      categoryLabel: cat ? cat.label : 'Custom request',
      emoji: cat ? cat.emoji : '✨',
      subKey: sub ? sub.key : null,
      subLabel: sub ? sub.label : null,
      service: data.service || (sub ? sub.services[0] : null),
      summary: data.summary || String(text || '').trim(),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.7,
      urgency: inferredDate ? 'scheduled' : urgency,
      inferredDate,
      inferredDateLabel,
      followups,
      understandingStatus: data.understandingStatus || null,
      missingFields: Array.isArray(data.missingFields) ? data.missingFields : [],
      requiredFollowups: Array.isArray(data.requiredFollowups) ? stripWhenFollowups(data.requiredFollowups).slice(0, 3) : [],
      candidateServices: Array.isArray(data.candidateServices) ? data.candidateServices.slice(0, 4) : [],
      understandingSummary: data.understandingSummary || data.summary || String(text || '').trim(),
      source: 'ai',
    };
  }

	  function mediaSummary(kind, reason) {
	    const es = window.__lang !== 'en';
	    if (kind === 'voice') {
	      return es
	        ? 'No pude descifrar la nota de voz.'
	        : 'I could not decipher the voice note.';
	    }
	    if (reason === 'no_public_image_url') {
	      return es
	        ? 'No pude analizar las fotos automáticamente.'
	        : 'I could not analyze the photos automatically.';
	    }
	    return es
	      ? 'No pude identificar el servicio con suficiente certeza.'
	      : 'I could not identify the service with enough certainty.';
	  }

  function unclearMedia(kind, reason) {
    return {
      mode: kind,
      adminReview: true,
      aiStatus: 'unclear',
      aiReason: reason || 'unable_to_decipher',
      aiEvidence: [],
      emoji: '✨',
      category: 'custom',
      categoryLabel: 'Custom request',
      subKey: null,
      subLabel: null,
      service: null,
      summary: mediaSummary(kind, reason),
      confidence: 0,
      urgency: 'flexible',
      inferredDate: null,
      inferredDateLabel: null,
      followups: [],
      source: kind === 'voice' ? 'voice-manual-review' : 'photo-unclear',
    };
  }

  async function parseMediaDetails(kind, details) {
    const text = String(details || '').trim();
    if (!text) return null;
    try {
      const parsed = await ai(text);
      return Object.assign(parsed, {
        mode: kind,
        supplementalDetails: text,
        source: kind + '-details-ai',
      });
    } catch (e) {
      const parsed = heuristic(text);
      return Object.assign(parsed, {
        mode: kind,
        supplementalDetails: text,
        source: kind + '-details-heuristic',
      });
    }
  }

  window.serviParse = async function serviParse(text, opts) {
    const engine = (opts && opts.engine) || 'ai';
    if (engine === 'heuristic') return heuristic(text);
    try {
      return await ai(text);
    } catch (e) {
      const h = heuristic(text);
      h.source = 'heuristic';
      return h;
    }
  };

  // expose helpers for UI (e.g. when editing service manually)
  window.serviInferDate = inferDate;

  /* ═══════════════════════════════════════════════════════════════════════
     MULTIMODAL ANALYSIS — fail closed. Voice is stored for manual review
     under the Anthropic-only constraint; photos use the backend vision
     endpoint and return an explicit unclear state when evidence is weak.
     ═══════════════════════════════════════════════════════════════════════ */

  async function callMediaBackend(kind, payload) {
    if (kind === 'voice') return unclearMedia('voice', 'audio_transcription_unavailable');
    const API = (window.CONFIG && window.CONFIG.API_BASE) || '';
    const lang = (window.__lang === 'en') ? 'en' : 'es';
    const media = Array.isArray(payload.media) ? payload.media : [];
    if (!media.length) return unclearMedia('photos', 'no_media');
    const res = await fetch(API + '/api/analyze-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: kind, media, lang }),
    });
    if (!res.ok) throw new Error('media-http-' + res.status);
    const data = await res.json();
    const cats = CAT();
    const catKey = cats[data.category] ? data.category : 'custom';
    const cat = cats[catKey];
    const sub = cat ? cat.subs.find((s) => s.key === data.subKey) : null;
    const isUnderstood = data.aiStatus === 'understood' && sub && data.service;
    if (!isUnderstood) {
      const unclear = unclearMedia('photos', data.aiReason || 'insufficient_visual_evidence');
      unclear.summary = data.summary || unclear.summary;
      unclear.aiEvidence = Array.isArray(data.aiEvidence) ? data.aiEvidence : [];
      unclear.confidence = typeof data.confidence === 'number' ? data.confidence : 0;
      return unclear;
    }
    return {
      aiStatus: 'understood',
      aiReason: null,
      aiEvidence: Array.isArray(data.aiEvidence) ? data.aiEvidence : [],
      category: catKey,
      categoryLabel: cat.label,
      emoji: cat.emoji,
      subKey: sub.key,
      subLabel: sub.label,
      service: data.service,
      summary: data.summary || data.service,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      urgency: ['asap', 'scheduled', 'flexible'].includes(data.urgency) ? data.urgency : 'flexible',
      inferredDate: data.inferredDate || null,
      inferredDateLabel: null,
      followups: [],
      source: 'photo-ai',
    };
  }

  // VOICE → manual review unless a future caller provides a real transcript.
  window.serviAnalyzeVoice = async function (payload) {
    const data = payload || {};
    if (data.transcript) {
      const parsed = await ai(data.transcript);
      return Object.assign(parsed, { mode: 'voice', transcript: data.transcript, source: 'voice-text-ai' });
    }
    const detailParsed = await parseMediaDetails('voice', data.details);
    if (detailParsed) return detailParsed;
    const parsed = await callMediaBackend('voice', data);
    return Object.assign(parsed, { mode: 'voice' });
  };

  // PHOTOS → strict backend vision analysis.
  window.serviAnalyzePhotos = async function (payload) {
    const data = payload || {};
    const detailParsed = await parseMediaDetails('photos', data.details);
    try {
      const parsed = await callMediaBackend('photos', data);
      if (parsed && parsed.aiStatus !== 'understood' && detailParsed) return detailParsed;
      return Object.assign(parsed, { mode: 'photos' });
    } catch (e) {
      if (detailParsed) return detailParsed;
      return unclearMedia('photos', 'analysis_failed');
    }
  };

  // VIDEO → Wizard-of-Oz. We *show* an AI-style analysis, but no service is
  // parsed: the admin team reviews the clip and follows up on WhatsApp.
  window.serviAnalyzeVideo = async function (payload) {
    const data = payload || {};
    const detailParsed = await parseMediaDetails('video', data.details);
    if (detailParsed) return detailParsed;
    return {
      mode: 'video', adminReview: true, aiStatus: 'manual_review', aiReason: 'video_manual_review', aiEvidence: [],
      emoji: '🎬', categoryLabel: 'Video request', service: null,
      summary: 'Our specialists will review your video in detail.',
      followups: [], source: 'video-review',
    };
  };
})();
