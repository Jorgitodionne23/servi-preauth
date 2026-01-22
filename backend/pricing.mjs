// pricing.mjs — central pricing calculations for SERVI orders

const DEFAULTS = {
  alphaMax: 0.17,
  alphaMin: 0.075,
  alphaP0: 1200,
  alphaGamma: 1.2,
  beta: 9, // MXN
  vatRate: 0.16,
  stripePercent: 0.061,
  stripeFixed: 3, // MXN
  stripeFeeVatRate: 0.16
};

export const VISIT_PREAUTH_TOTAL_PESOS = 140;
export const VISIT_PREAUTH_PROVIDER_PESOS = 90;

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
  stripeFixed = DEFAULTS.stripeFixed,
  stripeFeeVatRate = DEFAULTS.stripeFeeVatRate
} = {}) {
  // Fixed at worst-case percent so payment method does not change pricing
  const stripePercent = DEFAULTS.stripePercent;
  const P = toNumber(providerPricePesos, 0);
  if (P <= 0) {
    throw new Error('Provider price must be a positive number');
  }

  const alphaNumerator = alphaMax - alphaMin;
  const alphaDenominator = 1 + Math.pow(P / alphaP0, alphaGamma);
  const alphaValue = alphaMin + (alphaNumerator / alphaDenominator);

  const rawBookingFee = alphaValue * P + beta;
  const guardrailMax = Math.max(40, Math.min(500, 0.20 * P));
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

// Fixed-price visit preauthorization (customer pays $140, internal split uses provider=90)
export function computeVisitPreauthPricing({
  totalPesos = VISIT_PREAUTH_TOTAL_PESOS,
  providerPesos = VISIT_PREAUTH_PROVIDER_PESOS,
  vatRate = DEFAULTS.vatRate,
  stripePercent = DEFAULTS.stripePercent,
  stripeFixed = DEFAULTS.stripeFixed
} = {}) {
  const totalAmountCents = Math.round(toNumber(totalPesos, 0) * 100);
  const providerAmountCents = Math.round(toNumber(providerPesos, 0) * 100);
  if (totalAmountCents <= 0) {
    throw new Error('Visit preauth total must be a positive number');
  }
  if (providerAmountCents <= 0 || providerAmountCents >= totalAmountCents) {
    throw new Error('Visit provider amount must be positive and below total');
  }

  const nonProviderCents = totalAmountCents - providerAmountCents;
  const processingFeeAmountCents = Math.round(
    (stripePercent * (totalAmountCents / 100) + stripeFixed) * 100
  );

  // Split remaining into booking + VAT on (booking + processing)
  const baseBeforeVatCents = Math.max(
    0,
    Math.round(nonProviderCents / (1 + vatRate))
  );
  let bookingFeeAmountCents = Math.max(
    0,
    baseBeforeVatCents - processingFeeAmountCents
  );
  let vatAmountCents = Math.max(0, nonProviderCents - baseBeforeVatCents);

  // Tuck any rounding residue into booking fee
  const residue =
    nonProviderCents -
    (processingFeeAmountCents + bookingFeeAmountCents + vatAmountCents);
  if (residue !== 0) {
    bookingFeeAmountCents = Math.max(0, bookingFeeAmountCents + residue);
  }

  const totalCheck =
    providerAmountCents +
    bookingFeeAmountCents +
    processingFeeAmountCents +
    vatAmountCents;
  if (totalCheck !== totalAmountCents) {
    const finalResidue = totalAmountCents - totalCheck;
    bookingFeeAmountCents = Math.max(
      0,
      bookingFeeAmountCents + finalResidue
    );
  }

  return {
    providerAmountCents,
    bookingFeeAmountCents,
    processingFeeAmountCents,
    vatAmountCents,
    totalAmountCents,
    components: {
      vatRate,
      stripePercent,
      stripeFixed,
      stripeFeeVatRate: DEFAULTS.stripeFeeVatRate,
      visitPreauth: true,
      visitProviderPesos: providerPesos,
      visitTotalPesos: totalPesos
    }
  };
}
