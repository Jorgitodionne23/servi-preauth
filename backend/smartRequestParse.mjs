import { catalogPromptText, CATEGORY_KEYS } from './smartRequestCatalog.mjs';

export const MAX_TEXT = 600;

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
  "followups": [ { "q": "<short question to clarify a missing detail>", "key": "<slug>", "chips": ["<2-4 short option labels>"] } ]
}
Rules: 1-3 followups, only ones that genuinely help; prefer questions with quick chip options; never ask for name, phone, address, date, or price (handled elsewhere). Keep questions under 8 words.`;
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

const URGENCY = ['asap', 'scheduled', 'flexible'];

export function parseModelResponse(raw) {
  const str = String(raw == null ? '' : raw);
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('no-json');
  const data = JSON.parse(str.slice(start, end + 1));

  const category = CATEGORY_KEYS.includes(data.category) ? data.category : 'custom';
  let confidence = Number(data.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.7;
  confidence = Math.min(1, Math.max(0, confidence));
  const urgency = URGENCY.includes(data.urgency) ? data.urgency : 'flexible';
  const inferredDate = /^\d{4}-\d{2}-\d{2}$/.test(data.inferredDate || '') ? data.inferredDate : null;
  const followups = Array.isArray(data.followups)
    ? data.followups.filter((f) => f && typeof f.q === 'string' && f.q.trim()).slice(0, 3)
        .map((f) => ({ q: String(f.q), key: String(f.key || ''), ...(Array.isArray(f.chips) ? { chips: f.chips.map(String).slice(0, 4) } : {}) }))
    : [];

  return {
    category,
    subKey: data.subKey != null ? String(data.subKey) : null,
    service: data.service != null ? String(data.service) : null,
    summary: data.summary != null ? String(data.summary) : '',
    confidence,
    urgency,
    inferredDate,
    followups,
  };
}
