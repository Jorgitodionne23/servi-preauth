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

function roundUpToNearestFive(value) {
  return Math.ceil(value / 5) * 5;
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

  const alphaNumerator = alphaMax - alphaMin;
  const alphaDenominator = 1 + Math.pow(P / alphaP0, alphaGamma);
  const alphaValue = alphaMin + (alphaNumerator / alphaDenominator);

  const rawBookingFee = alphaValue * P + beta;
  const guardrailMax = Math.max(40, Math.min(399, 0.20 * P));
  const clampedBookingFee = Math.min(guardrailMax, Math.max(40, rawBookingFee));
  const bookingFeePesos = roundUpToNearestFive(clampedBookingFee);
  const bookingFeeCents = Math.round(bookingFeePesos * 100);

  const providerCents = Math.round(P * 100);
  const bookingFeePesosValue = bookingFeeCents / 100;

  const pEff = stripePercent * (1 + stripeFeeVatRate);
  const fEff = stripeFixed * (1 + stripeFeeVatRate);
  const grossUpDenominator = 1 - pEff * (1 + vatRate);
  if (grossUpDenominator <= 0) {
    throw new Error('Invalid Stripe fee configuration; denominator must be positive');
  }

  const processingFeeNumerator =
    pEff * P + pEff * (1 + vatRate) * bookingFeePesosValue + fEff;
  const processingFeePesosRaw = processingFeeNumerator / grossUpDenominator;
  const processingFeeCents = Math.ceil(processingFeePesosRaw * 100);

  const vatBaseCents = bookingFeeCents + processingFeeCents;
  const vatCents = Math.ceil(vatRate * vatBaseCents);

  const totalCents = providerCents + bookingFeeCents + processingFeeCents + vatCents;

  return {
    providerAmountCents: providerCents,
    bookingFeeAmountCents: bookingFeeCents,
    processingFeeAmountCents: processingFeeCents,
    vatAmountCents: vatCents,
    totalAmountCents: totalCents,
    components: {
      alphaValue,
      vatRate,
      stripePercent,
      stripeFixed,
      stripeFeeVatRate
    }
  };
}
