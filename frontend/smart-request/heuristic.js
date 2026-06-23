/* Deterministic Smart Request fallback.
   Browser-safe shared module: attaches to window/globalThis.ServiHeuristic. */
(function (root) {
  const DAY_ALIASES = [
    ['sunday', 'domingo'],
    ['monday', 'lunes'],
    ['tuesday', 'martes'],
    ['wednesday', 'miercoles', 'miércoles'],
    ['thursday', 'jueves'],
    ['friday', 'viernes'],
    ['saturday', 'sabado', 'sábado'],
  ];

  const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'by', 'can', 'for', 'from', 'i', 'in', 'is', 'it', 'me', 'my', 'need', 'of', 'on', 'or', 'the', 'to', 'we',
    'al', 'algo', 'con', 'de', 'del', 'el', 'en', 'es', 'la', 'las', 'le', 'lo', 'los', 'me', 'mi', 'mis', 'necesito', 'para', 'por', 'que', 'se', 'un', 'una',
  ]);

  function stripMarks(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeText(value) {
    return stripMarks(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenize(value) {
    const normalized = normalizeText(value);
    return normalized ? normalized.split(' ').filter(Boolean) : [];
  }

  function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  function isWhenFollowup(item) {
    const key = normalizeText(item && item.key);
    const q = normalizeText(item && item.q);
    const chips = normalizeText((item && item.chips || []).join(' '));
    const text = `${key} ${q} ${chips}`;
    return /\b(when|timing|date|schedule|scheduled|asap|soon|today|tomorrow|week|weekend|urgent|cu[aá]ndo|cuando|fecha|programar|agendar|agenda|pronto|hoy|manana|semana|urgente)\b/.test(text);
  }

  function stripWhenFollowups(items) {
    return (items || []).filter((item) => !isWhenFollowup(item));
  }

  function mkDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function dateLabel(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function inferDate(text, todayInput) {
    const t = ` ${normalizeText(text)} `;
    const today = todayInput ? new Date(todayInput) : new Date();
    if (Number.isNaN(today.getTime())) return null;
    if (/\b(today|hoy|right now|now|ahora|ahorita)\b/.test(t)) return null;
    if (/\b(tomorrow|manana)\b/.test(t)) {
      const d = new Date(today);
      d.setDate(d.getDate() + 1);
      return { date: mkDate(d), label: dateLabel(d) };
    }
    if (/\b(this weekend|fin de semana|este fin)\b/.test(t)) {
      const d = new Date(today);
      const add = (6 - d.getDay() + 7) % 7 || 6;
      d.setDate(d.getDate() + add);
      return { date: mkDate(d), label: `This weekend · ${dateLabel(d)}` };
    }
    for (let dayIndex = 0; dayIndex < DAY_ALIASES.length; dayIndex += 1) {
      if (DAY_ALIASES[dayIndex].some((day) => new RegExp(`\\b${normalizeText(day)}\\b`).test(t))) {
        const d = new Date(today);
        let add = (dayIndex - d.getDay() + 7) % 7;
        if (add === 0) add = 7;
        if (/\b(next|proximo|proxima|siguiente)\b/.test(t)) add += 7;
        d.setDate(d.getDate() + add);
        return { date: mkDate(d), label: dateLabel(d) };
      }
    }
    return null;
  }

  function inferUrgency(text, todayInput) {
    const t = ` ${normalizeText(text)} `;
    const hasFutureDate = !!inferDate(text, todayInput);
    if (hasFutureDate || /\b(schedule|scheduled|next week|this week|weekend|programar|agendar|agenda|cita|proxima semana|esta semana|fin de semana)\b/.test(t)) {
      return 'scheduled';
    }
    if (/\b(asap|urgent|urgently|emergency|right now|immediately|today|tonight|now|flooding|flooded|burst|locked out|hoy|urgente|emergencia|ahora|ahorita|inmediato|ya|esta noche|inundado|inundacion|reventado|encerrado)\b/.test(t)) {
      return 'asap';
    }
    return 'flexible';
  }

  function phraseScore(textNorm, tokenSet, phrase, weight) {
    const normalized = normalizeText(phrase);
    if (!normalized) return 0;
    const parts = normalized.split(' ').filter((w) => w && !STOPWORDS.has(w));
    if (!parts.length) return 0;
    const padded = ` ${textNorm} `;
    if (parts.length === 1) return tokenSet.has(parts[0]) ? weight : 0;
    if (padded.includes(` ${normalized} `)) return weight + Math.min(4, parts.length);
    const hits = parts.filter((part) => tokenSet.has(part)).length;
    if (hits === parts.length) return weight * 0.7 + hits * 0.6;
    if (hits >= 2 && hits / parts.length >= 0.67) return weight * 0.35 + hits * 0.35;
    return 0;
  }

  function scoreTerms(textNorm, tokenSet, terms, weight) {
    return unique(terms).reduce((sum, term) => sum + phraseScore(textNorm, tokenSet, term, weight), 0);
  }

  function serviceSignalsFor(subKey, signals) {
    const subSignals = signals && signals[subKey];
    return subSignals && Array.isArray(subSignals.services) ? subSignals.services : [];
  }

  function scoreService(sub, subSignals, textNorm, tokenSet) {
    let best = { service: sub.services && sub.services[0] ? sub.services[0] : null, score: 0 };
    (sub.services || []).forEach((service, index) => {
      const signal = (subSignals.services || []).find((item) => item.index === index || item.service === service) || {};
      const serviceText = [service].concat(signal.terms || []);
      const score = scoreTerms(textNorm, tokenSet, serviceText, 2.6);
      if (score > best.score) best = { service, score };
    });
    return best;
  }

  function followupsFor(subKey, followups, genericFollowups, ambiguousChoices, lang) {
    if (ambiguousChoices && ambiguousChoices.length) {
      return [{
        q: lang === 'es' ? '¿Qué servicio encaja mejor?' : 'Which service fits best?',
        key: 'service_clarification',
        chips: ambiguousChoices.slice(0, 4),
      }];
    }
    return stripWhenFollowups((followups && followups[subKey]) || genericFollowups || []);
  }

  function matchCatalog(text, options) {
    const opts = options || {};
    const catalog = opts.catalog || {};
    const signals = opts.signals || {};
    const textNorm = normalizeText(text);
    const tokenSet = new Set(tokenize(textNorm));
    let candidates = [];

    Object.keys(catalog).forEach((catKey) => {
      const cat = catalog[catKey];
      (cat.subs || []).forEach((sub) => {
        const subSignals = signals[sub.key] || {};
        const baseTerms = []
          .concat(cat.label || [])
          .concat(sub.label || [])
          .concat(sub.kw || [])
          .concat(sub.kwEs || [])
          .concat(subSignals.terms || []);
        const servicePick = scoreService(sub, subSignals, textNorm, tokenSet);
        let score = 0;
        score += scoreTerms(textNorm, tokenSet, baseTerms, 2.2);
        score += servicePick.score * 1.25;
        score -= scoreTerms(textNorm, tokenSet, subSignals.negative || [], 2.4);
        if (score > 0) {
          candidates.push({
            catKey,
            cat,
            sub,
            score,
            service: servicePick.service,
            serviceScore: servicePick.score,
          });
        }
      });
    });

    candidates = candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] || null;
    const runnerUp = candidates[1] || null;
    if (!best || best.score < 4.2) return { best: null, runnerUp, candidates };

    const margin = runnerUp ? best.score - runnerUp.score : best.score;
    const ambiguous = !!runnerUp && runnerUp.score >= 4.2 && (margin < 3.2 || runnerUp.score / best.score > 0.66);
    const confidence = Math.max(0.42, Math.min(
      ambiguous ? 0.68 : 0.95,
      0.38 + Math.min(0.38, best.score / 28) + Math.min(0.19, margin / 18)
    ));
    return { best, runnerUp, candidates, ambiguous, confidence };
  }

  function parse(text, options) {
    const opts = options || {};
    const catalog = opts.catalog || {};
    const followups = opts.followups || {};
    const genericFollowups = opts.genericFollowups || [];
    const signals = opts.signals || {};
    const urgency = inferUrgency(text, opts.today);
    const dateInfo = urgency === 'scheduled' ? inferDate(text, opts.today) : null;
    const match = matchCatalog(text, { catalog, signals });

    if (!match.best) {
      return {
        aiStatus: 'unclear',
        aiReason: 'no_catalog_match',
        category: 'custom',
        categoryLabel: 'Custom request',
        emoji: '✨',
        subKey: null,
        subLabel: null,
        service: null,
        summary: String(text || '').trim(),
        confidence: 0.32,
        urgency,
        inferredDate: dateInfo ? dateInfo.date : null,
        inferredDateLabel: dateInfo ? dateInfo.label : null,
        followups: stripWhenFollowups(genericFollowups),
        source: 'heuristic',
        _debug: { candidates: match.candidates.slice(0, 3).map((c) => ({ subKey: c.sub.key, score: Number(c.score.toFixed(2)) })) },
      };
    }

    const best = match.best;
    const choices = match.ambiguous
      ? unique(match.candidates.slice(0, 3).map((c) => c.sub.label || c.sub.key))
      : [];
    return {
      aiStatus: 'understood',
      aiReason: null,
      category: best.catKey,
      categoryLabel: best.cat.label,
      emoji: best.cat.emoji,
      subKey: best.sub.key,
      subLabel: best.sub.label,
      service: best.service || (best.sub.services && best.sub.services[0]) || null,
      summary: String(text || '').trim(),
      confidence: match.confidence,
      urgency,
      inferredDate: dateInfo ? dateInfo.date : null,
      inferredDateLabel: dateInfo ? dateInfo.label : null,
      followups: followupsFor(best.sub.key, followups, genericFollowups, choices, opts.lang),
      source: 'heuristic',
      _debug: {
        ambiguous: !!match.ambiguous,
        margin: match.runnerUp ? Number((best.score - match.runnerUp.score).toFixed(2)) : null,
        candidates: match.candidates.slice(0, 3).map((c) => ({ subKey: c.sub.key, score: Number(c.score.toFixed(2)) })),
      },
    };
  }

  root.ServiHeuristic = {
    inferDate,
    inferUrgency,
    matchCatalog,
    normalizeText,
    parse,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
