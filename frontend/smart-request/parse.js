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
    return (window.SERVI_FOLLOWUPS && window.SERVI_FOLLOWUPS[subKey]) || window.SERVI_GENERIC_FOLLOWUPS;
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
        category: 'custom', categoryLabel: 'Custom request', emoji: '✨',
        subKey: null, subLabel: null, service: null,
        summary: String(text || '').trim(),
        confidence: 0.35, urgency,
        inferredDate: dateInfo ? dateInfo.date : null,
        inferredDateLabel: dateInfo ? dateInfo.label : null,
        followups: window.SERVI_GENERIC_FOLLOWUPS,
        source: 'heuristic',
      };
    }
    const cat = CAT()[m.catKey];
    const service = pickService(m.sub, text);
    const conf = Math.min(0.95, 0.5 + m.score * 0.06);
    return {
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
    let followups = Array.isArray(data.followups) ? data.followups.filter((f) => f && f.q).slice(0, 3) : [];
    if (!followups.length) followups = sub ? followupsFor(sub.key) : window.SERVI_GENERIC_FOLLOWUPS;

    return {
      category: catKey,
      categoryLabel: cat ? cat.label : 'Custom request',
      emoji: cat ? cat.emoji : '✨',
      subKey: sub ? sub.key : null,
      subLabel: sub ? sub.label : null,
      service: data.service || (sub ? sub.services[0] : null),
      summary: data.summary || String(text || '').trim(),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.7,
      urgency: ['asap', 'scheduled', 'flexible'].includes(data.urgency) ? data.urgency : inferUrgency(text),
      inferredDate: data.inferredDate || null,
      inferredDateLabel: dateLabel,
      followups,
      source: 'ai',
    };
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
     MULTIMODAL ANALYSIS — voice & photos get the same "Here's what I
     understood" flow; video is Wizard-of-Oz (looks AI, reviewed by admin).

     PROTOTYPE NOTE: voice/photos analyze a transcript/caption string through
     the same text engine.
     In PRODUCTION, replace the body of `callMediaBackend` with a real call to
     a multimodal endpoint (speech-to-text + vision) — see SERVI-INTEGRATION.md.
     ═══════════════════════════════════════════════════════════════════════ */

  // Representative transcripts/captions for the in-prototype demo only.
  const SAMPLES = {
    voice: [
      'Hi, my bathroom sink is draining really slowly and it smells bad, I think it is clogged. Can someone come take a look this week?',
      'I need a deep cleaning for my two bedroom apartment, we just had a party last night and it is a mess.',
      'Looking for someone to mount a 55 inch TV on the living room wall and hide the cables.',
    ],
    photos: [
      'Photo shows a kitchen sink cabinet with a leaking P-trap; water pooling on the cabinet floor.',
      'Photo shows a wall-mounted light fixture hanging loose with exposed wiring.',
      'Photo shows a wooden shelf that has detached from the wall, with anchors pulled out.',
    ],
  };
  let sampleIdx = { voice: 0, photos: 0 };
  window.__serviSampleText = function (kind) {
    const pool = SAMPLES[kind] || SAMPLES.voice;
    const v = pool[sampleIdx[kind] % pool.length];
    sampleIdx[kind] = (sampleIdx[kind] || 0) + 1;
    return v;
  };

  // PRODUCTION SWAP POINT — replace with a real multimodal backend request.
  async function callMediaBackend(kind, payload) {
    // payload = { transcript } | { caption } | { fileUrls }
    const text = payload.transcript || payload.caption || '';
    if (!text) throw new Error('no-media-text');
    const parsed = await ai(text);           // reuse the grounded text engine
    return parsed;
  }

  // VOICE → transcribe (prod) → parse. Returns an understanding object.
  window.serviAnalyzeVoice = async function (payload) {
    const data = payload || {};
    const transcript = data.transcript || window.__serviSampleText('voice');
    try {
      const parsed = await callMediaBackend('voice', { transcript });
      return Object.assign(parsed, { mode: 'voice', transcript, source: 'voice-ai' });
    } catch (e) {
      const h = heuristic(transcript);
      return Object.assign(h, { mode: 'voice', transcript, source: 'voice-heuristic' });
    }
  };

  // PHOTOS → vision caption (prod) → parse. Returns an understanding object.
  window.serviAnalyzePhotos = async function (payload) {
    const data = payload || {};
    const caption = data.caption || window.__serviSampleText('photos');
    try {
      const parsed = await callMediaBackend('photos', { caption });
      return Object.assign(parsed, { mode: 'photos', caption, source: 'photo-ai' });
    } catch (e) {
      const h = heuristic(caption);
      return Object.assign(h, { mode: 'photos', caption, source: 'photo-heuristic' });
    }
  };

  // VIDEO → Wizard-of-Oz. We *show* an AI-style analysis, but no service is
  // parsed: the admin team reviews the clip and follows up on WhatsApp.
  window.serviAnalyzeVideo = function () {
    return Promise.resolve({
      mode: 'video', adminReview: true,
      emoji: '🎬', categoryLabel: 'Video request', service: null,
      summary: 'Our specialists will review your video in detail.',
      followups: [], source: 'video-review',
    });
  };
})();
