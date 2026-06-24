/**
 * Pre-authorization model — pure reference logic mirroring CLAUDE.md's
 * "Booking Lead-Time Guardrails". Returns which concept applies so the review
 * screen can explain it accurately. NO Stripe, NO money — explanation only.
 *
 * Thresholds:
 *   - 5 days (120h): "saved card required" line.
 *   - 24 hours: "automatic pre-auth" line.
 *   - Visits (quote-to-price) always require a saved card.
 */
export type PaymentPlanKind =
  | 'immediate_link' // guest/no-card, <5 days: PaymentIntent now, pay on link
  | 'auto_preauth' // saved card, >24h away: hold deferred to ~24h before
  | 'immediate_confirm' // saved card, <24h/asap: confirm on the spot
  | 'needs_saved_card'; // 5+ days out (or visit) without a saved card → blocked

export type PaymentPlan = {
  kind: PaymentPlanKind;
  /** i18n string keys for the concept cards to render. */
  conceptKeys: (
    | 'hold'
    | 'link'
    | 'saved'
    | 'auto'
    | 'fiveday'
    | 'visit'
  )[];
};

export function computePaymentPlan(opts: {
  hasSavedCardWithConsent: boolean;
  leadDays: number;
  isAsap: boolean;
  isVisit: boolean;
}): PaymentPlan {
  const { hasSavedCardWithConsent, leadDays, isAsap, isVisit } = opts;
  const effectiveLead = isAsap ? 0 : leadDays;

  // Visits always require a saved card, at any lead time.
  if (isVisit && !hasSavedCardWithConsent) {
    return { kind: 'needs_saved_card', conceptKeys: ['visit', 'saved', 'hold'] };
  }

  if (hasSavedCardWithConsent) {
    // Anything more than ~24h out (>= 1 day) defers the hold to ~24h before.
    // Only same-day / asap (< 24h) confirms on the spot.
    if (effectiveLead >= 1) {
      return { kind: 'auto_preauth', conceptKeys: ['saved', 'auto', 'hold'] };
    }
    return { kind: 'immediate_confirm', conceptKeys: ['saved', 'hold'] };
  }

  // No saved card / guest
  if (effectiveLead >= 5) {
    return { kind: 'needs_saved_card', conceptKeys: ['fiveday', 'saved', 'hold'] };
  }
  return { kind: 'immediate_link', conceptKeys: ['link', 'hold'] };
}
