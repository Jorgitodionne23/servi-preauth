/**
 * Mocked Smart Request matcher.
 *
 * A purely local keyword heuristic that stands in for the web app's
 * `POST /api/parse-request` (Claude) + client heuristic fallback. NO network,
 * NO API key — it scores the user's text against catalog keywords and returns
 * the same shape the real parse returns (service, summary, confidence,
 * follow-ups). Good enough to make the prototype feel intelligent.
 */
import { catalog } from './catalog';
import type { Bilingual, Followup, RequestDraft } from './types';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export type MatchResult = {
  categoryKey: string;
  subKey: string;
  service: Bilingual;
  summary: Bilingual;
  confidence: number;
  followups: Followup[];
  source: RequestDraft['source'];
};

export function matchText(text: string): MatchResult {
  const t = norm(text);
  let best: { categoryKey: string; subKey: string; score: number } | null = null;

  for (const cat of catalog) {
    for (const sub of cat.subs) {
      let score = 0;
      for (const kw of sub.keywords) {
        if (t.includes(norm(kw))) score += kw.length > 5 ? 2 : 1;
      }
      if (!best || score > best.score) {
        best = { categoryKey: cat.key, subKey: sub.key, score };
      }
    }
  }

  // No signal → custom catch-all
  if (!best || best.score === 0) {
    return {
      categoryKey: 'custom',
      subKey: 'custom',
      service: { es: 'Solicitud personalizada', en: 'Custom request' },
      summary: {
        es: 'Lo revisamos y te conectamos con el especialista correcto.',
        en: "We'll review it and connect you with the right specialist.",
      },
      confidence: 0.4,
      followups: [
        {
          key: 'notes',
          q: { es: '¿Algo que debamos saber?', en: 'Anything we should know?' },
        },
      ],
      source: 'heuristic',
    };
  }

  const cat = catalog.find((c) => c.key === best!.categoryKey)!;
  const sub = cat.subs.find((s) => s.key === best!.subKey)!;
  // First example service is the canonical match; confidence scales with score.
  const confidence = Math.min(0.96, 0.55 + best.score * 0.08);

  return {
    categoryKey: cat.key,
    subKey: sub.key,
    service: { es: sub.services.es[0], en: sub.services.en[0] },
    summary: {
      es: `Entendí: ${sub.label.es.toLowerCase()} — ${sub.services.es[0].toLowerCase()}.`,
      en: `Got it: ${sub.label.en.toLowerCase()} — ${sub.services.en[0].toLowerCase()}.`,
    },
    confidence,
    followups: sub.followups,
    source: 'heuristic',
  };
}

/** Naive urgency hint from the text (mirrors "asap" detection). */
export function detectUrgency(text: string): 'asap' | 'schedule' {
  const t = norm(text);
  const asapTerms = ['urgent', 'urgente', 'ahora', 'hoy', 'asap', 'ya', 'emergencia', 'emergency', 'inundacion', 'fuga'];
  return asapTerms.some((w) => t.includes(w)) ? 'asap' : 'schedule';
}
