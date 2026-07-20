import { SERVI_CATALOG, catalogPromptText, CATEGORY_KEYS } from './smartRequestCatalog.mjs';

export const MAX_TEXT = 600;
export const MEDIA_CONFIDENCE_THRESHOLD = 0.72;

export function buildParseSystemPrompt() {
  return `You are SERVI's request-understanding engine. SERVI is an on-demand home-services platform in Mexico City. A user typed a service request in plain language. Map it to the closest service in SERVI's catalog and decide what brief follow-up details would help a specialist arrive prepared.

CATALOG (category -> subKey ("label"): example services):
${catalogPromptText()}

Respond with ONLY a JSON object (no prose, no markdown) of this exact shape:
{
  "category": "<one catalog category key, or 'custom' if nothing fits>",
  "subKey": "<one subKey from that category, or null>",
  "service": "<the single closest example service label, or a short custom service name>",
  "summary": "<one short sentence restating the need, max 12 words>",
  "confidence": <0..1 how sure the mapping is>,
  "urgency": "<'asap' if they imply now/urgent/emergency, 'scheduled' if they name a day/time, else 'flexible'>",
  "inferredDate": <"YYYY-MM-DD" if a specific day is implied, else null>,
  "followups": [ { "q": "<short question to clarify a missing detail>", "key": "<slug>", "chips": ["<2-4 short option labels>"] } ],
  "candidateServices": ["<up to 4 exact catalog service labels when more than one match is plausible>"]
}
Rules: Ask 1-3 followups whenever the object/space/problem or minimum job scope is missing. These are required before scheduling. Prefer quick chip options; never ask for name, phone, address, date, or price (handled elsewhere). Keep questions under 8 words. Use exact catalog labels for candidateServices. A vague or off-catalog request must not be presented as understood.`;
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

export function validateCatalogSelection(data) {
  const rawCategory = String(data?.category || '').trim();
  if (rawCategory === 'custom') {
    return {
      valid: true,
      category: 'custom',
      subKey: null,
      service: data?.service != null ? String(data.service) : null,
      reason: '',
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
  const serviceNorm = normalizeServiceLabel(data?.service);
  const service = (sub.services || []).find((item) => normalizeServiceLabel(item) === serviceNorm);
  if (!service) {
    return { valid: false, category: 'custom', subKey: null, service: null, reason: 'invalid_service' };
  }
  return { valid: true, category: rawCategory, subKey: sub.key, service, reason: '' };
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

  const selection = validateCatalogSelection(data);
  let confidence = clampConfidence(data.confidence, 0.7);
  if (!selection.valid) confidence = Math.min(confidence, 0.4);
  const urgency = URGENCY.includes(data.urgency) ? data.urgency : 'flexible';
  const inferredDate = /^\d{4}-\d{2}-\d{2}$/.test(data.inferredDate || '') ? data.inferredDate : null;
  const followups = Array.isArray(data.followups)
    ? data.followups.filter((f) => f && typeof f.q === 'string' && f.q.trim() && !isWhenFollowup(f)).slice(0, 3)
        .map((f) => ({ q: String(f.q), key: String(f.key || ''), ...(Array.isArray(f.chips) ? { chips: f.chips.map(String).slice(0, 4) } : {}) }))
    : [];
  const candidateServices = normalizeCandidates(data.candidateServices, selection);
  const catalogUnderstood = selection.valid && selection.category !== 'custom';
  const understandingStatus = !catalogUnderstood
    ? 'unresolved'
    : ((confidence < 0.62 || candidateServices.length > 1 || followups.length > 0) ? 'clarifying' : 'understood');

  return {
    aiStatus: catalogUnderstood ? 'understood' : 'unclear',
    aiReason: selection.reason || (selection.category === 'custom' ? 'off_catalog' : ''),
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
