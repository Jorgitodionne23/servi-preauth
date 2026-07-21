/**
 * Earnings summary for the partner app — pure math over the provider's own
 * all_bookings rows (see providerEarnings.test.mjs).
 *
 * Buckets follow the partner app's three questions:
 *   pendingCents   — service completed on site but the client's PI not yet captured
 *   scheduledCents — booked/held work that hasn't happened yet
 *   week/month     — captured (earned) money, bucketed on the CDMX wall clock
 *
 * All amounts are centavos; `provider_amount` is the specialist's 100%.
 * Payout balances deliberately absent — payouts are handled by SERVI weekly
 * (Stripe Connect deferred), so the app reports earned/pending/upcoming only.
 */

/** CDMX is UTC-6 year-round (no DST since 2022) — matches backend/timezone.mjs. */
const CDMX_OFFSET_MS = -6 * 3600_000;

const UPCOMING_STATUSES = new Set(['scheduled', 'confirmed', 'pending']);

function statusOf(row) {
  return String(row.status || '').trim().toLowerCase();
}

function cents(row) {
  return row.provider_amount ?? 0;
}

/** Best reference instant for bucketing a job: service time, else creation time. */
export function jobRefTime(row, nowMs) {
  const dt = row.service_datetime ? Date.parse(row.service_datetime) : NaN;
  if (Number.isFinite(dt)) return dt;
  const cd = row.created_at ? new Date(row.created_at).getTime() : NaN;
  return Number.isFinite(cd) ? cd : nowMs;
}

/** Monday 00:00 CDMX of the week containing nowMs, as a UTC ms timestamp. */
export function cdmxWeekStartMs(nowMs) {
  const local = new Date(nowMs + CDMX_OFFSET_MS);
  const dow = (local.getUTCDay() + 6) % 7; // Mon = 0
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - dow) - CDMX_OFFSET_MS;
}

/** First instant of the CDMX month containing nowMs, as a UTC ms timestamp. */
export function cdmxMonthStartMs(nowMs) {
  const local = new Date(nowMs + CDMX_OFFSET_MS);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - CDMX_OFFSET_MS;
}

export function summarizeProviderEarnings(rows, nowMs = Date.now()) {
  const weekStartMs = cdmxWeekStartMs(nowMs);
  const monthStartMs = cdmxMonthStartMs(nowMs);

  const captured = rows.filter((r) => statusOf(r) === 'captured');
  const pendingCapture = rows.filter((r) => statusOf(r) !== 'captured' && r.service_phase === 'completed');
  const upcoming = rows.filter((r) => UPCOMING_STATUSES.has(statusOf(r)) && r.service_phase !== 'completed');

  const sum = (list) => list.reduce((s, r) => s + cents(r), 0);
  const weekCaptured = captured.filter((r) => jobRefTime(r, nowMs) >= weekStartMs);
  const monthCaptured = captured.filter((r) => jobRefTime(r, nowMs) >= monthStartMs);

  const weekByDay = Array.from({ length: 7 }, () => 0);
  for (const r of weekCaptured) {
    const d = new Date(jobRefTime(r, nowMs) + CDMX_OFFSET_MS);
    weekByDay[(d.getUTCDay() + 6) % 7] += cents(r);
  }

  return {
    pendingCents: sum(pendingCapture),
    scheduledCents: sum(upcoming),
    weekCents: sum(weekCaptured),
    weekJobs: weekCaptured.length,
    monthCents: sum(monthCaptured),
    monthJobs: monthCaptured.length,
    weekByDay,
  };
}
