// processing-fees.mjs
// Central configuration for Stripe processing fees based on payment method metadata.
// Values reflect common Stripe MX pricing as of 2024-01. Update them if your account uses
// different negotiated rates.

const MX_DOMESTIC_PERCENT = 0.036; // 3.6%
const MX_FIXED_FEE = 3; // MXN
const INTERNATIONAL_SURCHARGE = 0.005; // +0.5%
const CURRENCY_CONVERSION_SURCHARGE = 0.02; // +2% when conversion is required

const rulesBase = [
  {
    id: 'mx_domestic',
    label: 'Tarjeta nacional (MX)',
    match: { country: 'MX' },
    percent: MX_DOMESTIC_PERCENT,
    fixed: MX_FIXED_FEE,
  },
  {
    id: 'mx_domestic_debit',
    label: 'Tarjeta débito nacional (MX)',
    match: { country: 'MX', funding: 'debit' },
    percent: MX_DOMESTIC_PERCENT,
    fixed: MX_FIXED_FEE,
  },
  {
    id: 'mx_international_conversion',
    label: 'Tarjeta internacional (incluye conversión)',
    match: {},
    percent: MX_DOMESTIC_PERCENT + INTERNATIONAL_SURCHARGE + CURRENCY_CONVERSION_SURCHARGE,
    fixed: MX_FIXED_FEE,
  },
];

export const PROCESSING_FEE_RULES = rulesBase.slice();

const fallbackRule = PROCESSING_FEE_RULES.reduce((acc, rule) => {
  const score = rule.percent + rule.fixed / 100;
  const bestScore = acc.percent + acc.fixed / 100;
  return score > bestScore ? rule : acc;
}, PROCESSING_FEE_RULES[0]);

export const DEFAULT_PROCESSING_FEE_RULE_ID = fallbackRule.id;

function normalizeCardInfo(card = {}) {
  const brand = String(card.brand || '').toLowerCase();
  const funding = String(card.funding || '').toLowerCase();
  const country = String(card.country || '').toUpperCase();
  return { brand, funding, country };
}

function ruleMatches(rule, card) {
  const { match = {} } = rule;
  if (match.brand && String(match.brand).toLowerCase() !== card.brand) return false;
  if (match.funding && String(match.funding).toLowerCase() !== card.funding) return false;
  if (match.country) {
    const target = String(match.country).toUpperCase();
    if (target !== '*' && target !== card.country) return false;
  }
  return true;
}

export function resolveProcessingFeeRule(cardInfo = {}) {
  const normalized = normalizeCardInfo(cardInfo);
  for (const rule of PROCESSING_FEE_RULES) {
    if (ruleMatches(rule, normalized)) return rule;
  }
  return (
    PROCESSING_FEE_RULES.find((rule) => rule.id === DEFAULT_PROCESSING_FEE_RULE_ID) ||
    PROCESSING_FEE_RULES[0]
  );
}

export function serializeProcessingFeeRules() {
  return PROCESSING_FEE_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    match: rule.match,
    percent: rule.percent,
    fixed: rule.fixed,
  }));
}
