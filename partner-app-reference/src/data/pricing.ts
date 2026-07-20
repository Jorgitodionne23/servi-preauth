/**
 * TypeScript port of `../../../backend/pricing.mjs` — kept numerically
 * IDENTICAL on purpose.
 *
 * Why port it instead of mocking numbers: the single most important thing this
 * app has to communicate to a specialist is *"what do I actually take home?"*.
 * If the prototype invents its own arithmetic, every earnings screen is a lie
 * and the design decisions built on top of it (how much to emphasize gross vs
 * net, whether the fee needs explaining) are made against fake data.
 *
 * The one fact that drives the whole partner value proposition:
 *
 *   providerAmountCents === Math.round(providerPricePesos * 100)
 *
 * The specialist keeps **100% of their quoted price**. SERVI's booking fee,
 * Stripe's processing fee and VAT are all added *on top* and paid by the
 * client. Nothing is deducted from the specialist. Every earnings surface in
 * this app is built to make that legible, because it is the strongest argument
 * against a specialist taking the job off-platform.
 *
 * Keep in sync with backend/pricing.mjs. If the alpha curve changes there,
 * change it here.
 */

const DEFAULTS = {
  alphaMax: 0.17,
  alphaMin: 0.075,
  alphaP0: 1200,
  alphaGamma: 1.2,
  beta: 9, // MXN
  vatRate: 0.16,
  stripePercent: 0.061,
  stripeFixed: 3, // MXN
  stripeFeeVatRate: 0.16,
} as const;

export const VISIT_PREAUTH_TOTAL_PESOS = 140;
export const VISIT_PREAUTH_PROVIDER_PESOS = 90;

export type Pricing = {
  /** What the specialist earns. Always exactly the quoted price. */
  providerAmountCents: number;
  /** SERVI's revenue — paid by the client, never deducted from the provider. */
  bookingFeeAmountCents: number;
  processingFeeAmountCents: number;
  vatAmountCents: number;
  /** What the client's card is pre-authorized for. */
  totalAmountCents: number;
};

function roundUpToNearestFive(value: number): number {
  return Math.ceil(value / 5) * 5;
}

export function computePricing(providerPricePesos: number): Pricing {
  const {
    alphaMax, alphaMin, alphaP0, alphaGamma, beta,
    vatRate, stripePercent, stripeFixed, stripeFeeVatRate,
  } = DEFAULTS;

  const P = Number(providerPricePesos);
  if (!Number.isFinite(P) || P <= 0) {
    throw new Error('Provider price must be a positive number');
  }

  const alphaValue = alphaMin + (alphaMax - alphaMin) / (1 + Math.pow(P / alphaP0, alphaGamma));

  const rawBookingFee = alphaValue * P + beta;
  const guardrailMax = Math.max(40, Math.min(500, 0.2 * P));
  const clampedBookingFee = Math.min(guardrailMax, Math.max(40, rawBookingFee));
  const bookingFeeCents = Math.round(roundUpToNearestFive(clampedBookingFee) * 100);

  const providerCents = Math.round(P * 100);
  const bookingFeePesos = bookingFeeCents / 100;

  const pEff = stripePercent * (1 + stripeFeeVatRate);
  const fEff = stripeFixed * (1 + stripeFeeVatRate);
  const grossUpDenominator = 1 - pEff * (1 + vatRate);

  const processingFeeNumerator = pEff * P + pEff * (1 + vatRate) * bookingFeePesos + fEff;
  const processingFeeCents = Math.ceil((processingFeeNumerator / grossUpDenominator) * 100);

  const vatCents = Math.ceil(vatRate * (bookingFeeCents + processingFeeCents));

  return {
    providerAmountCents: providerCents,
    bookingFeeAmountCents: bookingFeeCents,
    processingFeeAmountCents: processingFeeCents,
    vatAmountCents: vatCents,
    totalAmountCents: providerCents + bookingFeeCents + processingFeeCents + vatCents,
  };
}

/**
 * Fixed-price quote visit. Client pays $140; the specialist's share is $90.
 * Mirrors `computeVisitPreauthPricing` — visits are the one flow where the
 * provider amount is set by SERVI rather than quoted by the specialist.
 */
export function computeVisitPricing(): Pricing {
  const totalAmountCents = VISIT_PREAUTH_TOTAL_PESOS * 100;
  const providerAmountCents = VISIT_PREAUTH_PROVIDER_PESOS * 100;
  const nonProviderCents = totalAmountCents - providerAmountCents;

  const processingFeeAmountCents = Math.round(
    (DEFAULTS.stripePercent * (totalAmountCents / 100) + DEFAULTS.stripeFixed) * 100,
  );
  const baseBeforeVatCents = Math.max(0, Math.round(nonProviderCents / (1 + DEFAULTS.vatRate)));
  const vatAmountCents = Math.max(0, nonProviderCents - baseBeforeVatCents);
  const bookingFeeAmountCents =
    nonProviderCents - processingFeeAmountCents - vatAmountCents;

  return {
    providerAmountCents,
    bookingFeeAmountCents,
    processingFeeAmountCents,
    vatAmountCents,
    totalAmountCents,
  };
}

/**
 * The client-facing fee as a share of what the client pays. Used by the
 * "why SERVI" comparison — a specialist who understands that SERVI's cut is
 * ~12-18% *charged to the client* (not taken from them) has no economic
 * incentive to go direct.
 */
export function serviFeeShare(p: Pricing): number {
  return (p.totalAmountCents - p.providerAmountCents) / p.totalAmountCents;
}
