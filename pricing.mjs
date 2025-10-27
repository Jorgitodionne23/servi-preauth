// pricing.mjs — central pricing calculations for SERVI orders

const DEFAULTS = {
  alphaMax: 0.18,
  alphaMin: 0.08,
  alphaP0: 1200,
  alphaGamma: 1.2,
  beta: 9, // MXN
  vatRate: 0.16,
  stripePercent: 0.061,
  stripeFixed: 3, // MXN
  stripeFeeVatRate: 0.16
};

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundToNearestFive(value) {
  return Math.round(value / 5) * 5;
}

export function computePricing({
  providerPricePesos,
  alphaMax = DEFAULTS.alphaMax,
  alphaMin = DEFAULTS.alphaMin,
  alphaP0 = DEFAULTS.alphaP0,
  alphaGamma = DEFAULTS.alphaGamma,
  beta = DEFAULTS.beta,
  vatRate = DEFAULTS.vatRate,
  stripePercent = DEFAULTS.stripePercent,
  stripeFixed = DEFAULTS.stripeFixed,
  stripeFeeVatRate = DEFAULTS.stripeFeeVatRate
} = {}) {
  const P = toNumber(providerPricePesos, 0);
  if (P <= 0) {
    throw new Error('Provider price must be a positive number');
  }

  const urgencyMultiplier = 1;

  const alphaNumerator = alphaMax - alphaMin;
  const alphaDenominator = 1 + Math.pow(P / alphaP0, alphaGamma);
  const alphaValue = alphaMin + (alphaNumerator / alphaDenominator);

  const rawBookingFee = (alphaValue * P + beta) * urgencyMultiplier;
  const guardrailMax = Math.max(40, Math.min(399, 0.20 * P));
  const clampedBookingFee = Math.min(guardrailMax, Math.max(40, rawBookingFee));
  const bookingFeePesos = roundToNearestFive(clampedBookingFee);
  const bookingFeeCents = Math.round(bookingFeePesos * 100);

  const providerCents = Math.round(P * 100);
  const baseCents = providerCents + bookingFeeCents;
  const basePesos = baseCents / 100;

  const pEff = stripePercent * (1 + stripeFeeVatRate);
  const fEff = stripeFixed * (1 + stripeFeeVatRate);
  const grossUpDenominator = 1 - pEff * (1 + vatRate);
  if (grossUpDenominator <= 0) {
    throw new Error('Invalid Stripe fee configuration; denominator must be positive');
  }

  const processingFeePesos = (pEff * (1 + vatRate) * basePesos + fEff) / grossUpDenominator;
  const processingFeeCents = Math.round(processingFeePesos * 100);

  const vatBaseCents = baseCents + processingFeeCents;
  const vatPesos = vatRate * (vatBaseCents / 100);
  const vatCents = Math.round(vatPesos * 100);

  const totalCents = baseCents + processingFeeCents + vatCents;

  return {
    providerAmountCents: providerCents,
    bookingFeeAmountCents: bookingFeeCents,
    processingFeeAmountCents: processingFeeCents,
    vatAmountCents: vatCents,
    totalAmountCents: totalCents,
    components: {
      alphaValue,
      urgencyMultiplier,
      vatRate,
      stripePercent,
      stripeFixed: Math.round(stripeFixed * 100),
      stripeFeeVatRate
    }
  };
}
