/**
 * Money formatting for the customer prototype. Mirrors the two formatters in
 * `partner-app-reference/src/theme/partner.ts` (which the customer app doesn't
 * import — that file carries partner-only tokens). Kept tiny and identical on
 * purpose so both apps render pesos the same way; if one changes, change both.
 *
 * All amounts are centavos (integer), matching `data/pricing.ts` and the
 * backend's `*_amount` columns. MXN only.
 */

/** Formats centavos → "$1,234.50" (optionally "$1,234.50 MXN"). */
export function money(cents: number, opts?: { withCurrency?: boolean; sign?: boolean }): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const body = (abs / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = neg ? '−' : opts?.sign ? '+' : '';
  return `${sign}$${body}${opts?.withCurrency ? ' MXN' : ''}`;
}

/** Compact money for dense rows: "$1,234" (no cents). */
export function moneyShort(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString('es-MX')}`;
}
