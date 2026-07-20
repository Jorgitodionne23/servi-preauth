/**
 * Partner-side theme extensions.
 *
 * The SERVI Partner app deliberately shares the *same* design system as the
 * customer app (`../../native-app-reference/src/theme/tokens.ts`) — same
 * surfaces, radii, motion, fonts — so a specialist and a client are visibly on
 * the same platform. What changes is the *emotional register*: the customer app
 * is calm and spacious; the partner app is a work tool. It needs three things
 * the customer app never does:
 *
 *   1. A **duty state** (on/off shift) that must be legible at a glance.
 *   2. **Money** typography — earnings are the reason the app exists.
 *   3. A **phase** color ramp for the on-site milestone flow that maps 1:1 to
 *      the backend's `order_lifecycle_events.event_type` values.
 *
 * Everything else is imported unchanged from `./tokens`.
 */
import { colors } from './tokens';

/** Duty (shift) state colors. Off-duty is deliberately gray, not red — being
 *  off shift is normal, not an error. */
export const duty = {
  onBg: colors.successTint,
  onInk: colors.successInk,
  onDot: colors.success,
  offBg: colors.surface,
  offInk: colors.textSecondary,
  offDot: colors.textMuted,
} as const;

/**
 * Milestone ramp for the on-site flow. Keys match the backend's
 * `MILESTONE_EVENTS` set exactly (`en_route|arrived|started|completed`) so a
 * production build can drive this straight from `POST /api/provider/checkin`.
 */
export const phaseTone = {
  en_route: { bg: colors.accentTint, ink: colors.accentInk, dot: colors.accentDeep },
  arrived: { bg: colors.accentTint, ink: colors.accentInk, dot: colors.accentDeep },
  started: { bg: colors.warningTint, ink: colors.warningInk, dot: colors.warning },
  completed: { bg: colors.successTint, ink: colors.successInk, dot: colors.success },
} as const;

/** Dark "ledger" surface used by the earnings hero + payout receipts. It echoes
 *  the web app's dark payment pages, which are also money surfaces. */
export const ledger = {
  bg: '#101213',
  bgSoft: '#1d2123',
  border: 'rgba(255,255,255,0.10)',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.62)',
  accent: '#7fc4cf',
  positive: '#5fd39a',
} as const;

/** Formats centavos → "$1,234.50 MXN"-style. Partner-side money is always MXN. */
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
