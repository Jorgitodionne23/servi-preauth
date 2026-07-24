import { SERVI_CATALOG, catalogPromptText, CATEGORY_KEYS } from './smartRequestCatalog.mjs';

export const MAX_TEXT = 600;
export const MEDIA_CONFIDENCE_THRESHOLD = 0.72;
export const MAX_SERVICE_LABEL = 80;
export const MIN_CUSTOM_UNDERSTOOD_CONFIDENCE = 0.45;

export function buildParseSystemPrompt() {
  return `You are SERVI's request-understanding engine. SERVI is an on-demand home-services platform in Mexico City that can arrange a specialist for ANY legitimate home-service need — SERVI is not limited to the categories below. The catalog exists only to help route the request internally when it fits; it is not an exhaustive menu, and a request that doesn't fit it is a normal, expected outcome, not a failure to understand the user. A user typed a service request in plain language. Identify the best-fit category (or 'custom' only when the request is a genuinely different kind of home service that none of the categories cover) and decide what brief follow-up details would help a specialist arrive prepared.

CATALOG (category -> subKey ("label"): example services):
${catalogPromptText()}

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "category": "<one catalog category key, or 'custom' if nothing genuinely fits>",
  "subKey": "<one subKey from that category, or null>",
  "service": "<the single closest example service label, or — if none fit closely — a short custom service name describing what the user needs>",
  "summary": "<one short sentence restating the need, max 12 words>",
  "confidence": <0..1 how well YOU understood the request overall, not merely whether it matched a catalog category — a clear, specific home-service request deserves 0.7+ confidence even when "category" is "custom">,
  "urgency": "<'asap' if they imply now/urgent/emergency, 'scheduled' if they name a day/time, else 'flexible'>",
  "inferredDate": <"YYYY-MM-DD" if a specific day is implied, else null>,
  "followups": [ { "q": "<short question to clarify a missing detail>", "key": "<slug>", "chips": ["<2-4 short option labels>"] } ],
  "candidateServices": ["<up to 4 exact catalog service labels when more than one match is plausible>"]
}
Rules: Ask 1-3 followups whenever the object/space/problem or minimum job scope is missing. These are required before scheduling. Prefer quick chip options; never ask for name, phone, address, date, or price (handled elsewhere). Keep questions under 8 words. Use exact catalog labels for candidateServices. Being off-catalog ('category':'custom') must still be treated as clearly understood whenever the underlying request itself is clear and specific — reserve low confidence (below 0.4) for input that is empty, incoherent, or doesn't describe an actual home-service need at all.`;
}

export function buildMediaAnalysisSystemPrompt() {
  return `You are SERVI's strict media request-understanding engine. SERVI is an on-demand home-services platform in Mexico City. Analyze the user's uploaded photo(s) and decide whether the image visibly shows a concrete home-service request.

CATALOG (category -> subKey ("label"): example services):
${catalogPromptText()}

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "status": "<'understood' only if the photo clearly supports a catalog service, else 'unclear'>",
  "category": "<one catalog category key, or null>",
  "subKey": "<one subKey from that category, or null>",
  "service": "<the single closest example service label, or null>",
  "summary": "<one short sentence, max 12 words>",
  "confidence": <0..1 how sure the visual evidence supports the mapping>,
  "reason": "<short reason if unclear, else empty string>",
  "evidence": ["<1-3 visible observations from the image>"]
}
Rules: Do not infer a hidden problem from weak evidence. If the photo is blank, unrelated, too blurry, mostly people/objects without a visible service issue, or could fit multiple unrelated services, return status "unclear". Only return "understood" when the selected category, subKey, and service are in the catalog and directly supported by visible evidence.`;
}

export function buildParseUserPrompt(text, lang, today = new Date()) {
  const langName = lang === 'en' ? 'English' : 'Spanish';
  const todayStr = today.toISOString().slice(0, 10);
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  return `Today's date is ${todayStr} (${weekday}).
Write the "summary" and all "followups" text in ${langName}.

USER REQUEST:
"""${String(text || '').slice(0, MAX_TEXT)}"""`;
}

export function buildMediaAnalysisUserPrompt(lang, imageCount, today = new Date()) {
  const langName = lang === 'en' ? 'English' : 'Spanish';
  const todayStr = today.toISOString().slice(0, 10);
  return `Today's date is ${todayStr}.
Write "summary" and "reason" in ${langName}.
Analyze ${Number(imageCount) || 0} uploaded photo(s).`;
}

const URGENCY = ['asap', 'scheduled', 'flexible'];

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWhenFollowup(item) {
  const text = [
    item?.key,
    item?.q,
    Array.isArray(item?.chips) ? item.chips.join(' ') : '',
  ].map(normalizeSearch).join(' ');
  return /\b(when|timing|date|schedule|scheduled|asap|soon|today|tomorrow|week|weekend|urgent|cuando|fecha|programar|agendar|agenda|pronto|hoy|manana|semana|urgente)\b/.test(text);
}

function clampConfidence(value, fallback = 0) {
  let confidence = Number(value);
  if (!Number.isFinite(confidence)) confidence = fallback;
  return Math.min(1, Math.max(0, confidence));
}

function normalizeServiceLabel(value) {
  return normalizeSearch(value);
}

function sanitizeServiceText(value) {
  return String(value == null ? '' : value)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SERVICE_LABEL);
}

// strictService=true (default) preserves the original exact-literal-match behavior, which
// parseMediaModelResponse relies on (photo analysis stays strict/fail-closed, unchanged).
// strictService=false is the text-parse path: category+subKey are still catalog-validated
// ground truth, but the freeform "service" string is accepted as-is (sanitized), since the
// model is explicitly invited to describe a need that has no exact example-label match.
export function validateCatalogSelection(data, opts = {}) {
  const strictService = opts.strictService !== false;
  const rawCategory = String(data?.category || '').trim();
  if (rawCategory === 'custom') {
    const service = sanitizeServiceText(data?.service);
    return {
      valid: !!service,
      category: 'custom',
      subKey: null,
      service: service || null,
      reason: service ? '' : 'invalid_service',
    };
  }
  if (!CATEGORY_KEYS.includes(rawCategory)) {
    return { valid: false, category: 'custom', subKey: null, service: null, reason: 'invalid_category' };
  }
  const subKey = data?.subKey != null ? String(data.subKey) : '';
  const category = SERVI_CATALOG[rawCategory];
  const sub = category?.subs?.find((item) => item.key === subKey);
  if (!sub) {
    return { valid: false, category: 'custom', subKey: null, service: null, reason: 'invalid_subkey' };
  }
  if (strictService) {
    const serviceNorm = normalizeServiceLabel(data?.service);
    const service = (sub.services || []).find((item) => normalizeServiceLabel(item) === serviceNorm);
    if (!service) {
      return { valid: false, category: 'custom', subKey: null, service: null, reason: 'invalid_service' };
    }
    return { valid: true, category: rawCategory, subKey: sub.key, service, reason: '' };
  }
  const freeform = sanitizeServiceText(data?.service);
  if (!freeform) {
    return { valid: false, category: 'custom', subKey: null, service: null, reason: 'invalid_service' };
  }
  return { valid: true, category: rawCategory, subKey: sub.key, service: freeform, reason: '' };
}

function normalizeEvidence(value) {
  const raw = Array.isArray(value) ? value : (typeof value === 'string' && value.trim() ? [value] : []);
  return raw.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 3);
}

function normalizeCandidates(value, selection) {
  if (!Array.isArray(value) || !selection?.category || selection.category === 'custom') return [];
  const category = SERVI_CATALOG[selection.category];
  const allowed = new Map((category?.subs || []).flatMap((sub) =>
    (sub.services || []).map((service) => [normalizeServiceLabel(service), { service, subKey: sub.key, subLabel: sub.label }])
  ));
  const seen = new Set();
  return value.map((item) => allowed.get(normalizeServiceLabel(item))).filter((item) => {
    if (!item || seen.has(item.service)) return false;
    seen.add(item.service);
    return true;
  }).slice(0, 4);
}

export function parseModelResponse(raw) {
  const str = String(raw == null ? '' : raw);
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no-json');
  const data = JSON.parse(str.slice(start, end + 1));

  const selection = validateCatalogSelection(data, { strictService: false });
  let confidence = clampConfidence(data.confidence, 0.7);
  if (!selection.valid) confidence = Math.min(confidence, 0.4);
  const urgency = URGENCY.includes(data.urgency) ? data.urgency : 'flexible';
  const inferredDate = /^\d{4}-\d{2}-\d{2}$/.test(data.inferredDate || '') ? data.inferredDate : null;
  const followups = Array.isArray(data.followups)
    ? data.followups.filter((f) => f && typeof f.q === 'string' && f.q.trim() && !isWhenFollowup(f)).slice(0, 3)
        .map((f) => ({ q: String(f.q), key: String(f.key || ''), ...(Array.isArray(f.chips) ? { chips: f.chips.map(String).slice(0, 4) } : {}) }))
    : [];
  const candidateServices = normalizeCandidates(data.candidateServices, selection);
  // A catalog-category match is ground-truthed against the real catalog, so it's always
  // "understood" regardless of confidence. A 'custom' (off-catalog) match has no catalog
  // ground truth, so it additionally needs a minimum confidence — this guards against the
  // model inventing a plausible label for vague/gibberish input, without treating "off
  // catalog" itself as a failure to understand (that's the whole point of Smart Request).
  const isCatalogMatch = selection.valid && selection.category !== 'custom';
  const isViableCustomMatch = selection.valid && selection.category === 'custom' && confidence >= MIN_CUSTOM_UNDERSTOOD_CONFIDENCE;
  const understood = isCatalogMatch || isViableCustomMatch;
  const understandingStatus = !understood
    ? 'unresolved'
    : ((confidence < 0.62 || candidateServices.length > 1 || followups.length > 0) ? 'clarifying' : 'understood');

  return {
    aiStatus: understood ? 'understood' : 'unclear',
    aiReason: understood ? '' : (selection.reason || (selection.category === 'custom' ? 'low_confidence_custom' : '')),
    category: selection.category,
    subKey: selection.subKey,
    service: selection.service,
    summary: data.summary != null ? String(data.summary) : '',
    confidence,
    urgency,
    inferredDate,
    followups,
    understandingStatus,
    missingFields: followups.map((item) => item.key).filter(Boolean),
    requiredFollowups: followups.map((item) => ({ ...item, required: true })),
    candidateServices,
    understandingSummary: data.summary != null ? String(data.summary) : '',
  };
}

export function parseMediaModelResponse(raw) {
  const str = String(raw == null ? '' : raw);
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no-json');
  const data = JSON.parse(str.slice(start, end + 1));

  const selection = validateCatalogSelection(data);
  const requestedStatus = data.status === 'understood' ? 'understood' : 'unclear';
  const evidence = normalizeEvidence(data.evidence);
  const confidence = clampConfidence(data.confidence, 0);
  const reason = String(data.reason || selection.reason || '').trim();
  const shouldBeUnclear =
    requestedStatus !== 'understood' ||
    !selection.valid ||
    confidence < MEDIA_CONFIDENCE_THRESHOLD ||
    evidence.length === 0;

  if (shouldBeUnclear) {
    return {
      aiStatus: 'unclear',
      aiReason: reason || selection.reason || 'insufficient_visual_evidence',
      aiEvidence: evidence,
      category: 'custom',
      subKey: null,
      service: null,
      summary: data.summary != null ? String(data.summary) : '',
      confidence: Math.min(confidence, 0.4),
      urgency: 'flexible',
      inferredDate: null,
      followups: [],
    };
  }

  return {
    aiStatus: 'understood',
    aiReason: '',
    aiEvidence: evidence,
    category: selection.category,
    subKey: selection.subKey,
    service: selection.service,
    summary: data.summary != null ? String(data.summary) : '',
    confidence,
    urgency: 'flexible',
    inferredDate: null,
    followups: [],
  };
}
