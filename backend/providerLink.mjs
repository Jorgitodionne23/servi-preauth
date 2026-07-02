// Expiry policy for provider capability links (provider.html?order=…&pt=…).
// The token is a bearer capability with no separate provider auth, so it must stop
// working once the job is over or the order is dead — a forwarded or leaked link
// must not grant indefinite access to check-ins, location shares, or price changes.

// Grace window after the scheduled service during which the link keeps working
// (late-running jobs, post-completion surcharge entry, reload of the timeline).
export const PROVIDER_LINK_GRACE_MS = 72 * 60 * 60 * 1000; // 72h

// Fallback lifetime from mint time when the order has no parseable service date
// (e.g. ASAP orders). Generous on purpose: breaking a legitimate link mid-job is
// worse than a stale one living a few extra days — admin can always rotate.
export const PROVIDER_LINK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

const DEAD_STATUSES = new Set(['Refunded', 'Declined']);
const CANCELED_RE = /^cancel/i;

/**
 * @param {object} row all_bookings row (status, service_datetime, service_date,
 *                     provider_link_created_at)
 * @param {Date} [now]
 * @returns {boolean} true if the provider link must no longer be honored
 */
export function providerLinkExpired(row, now = new Date()) {
  if (!row) return true;

  const status = String(row.status || '').trim();
  if (DEAD_STATUSES.has(status) || CANCELED_RE.test(status)) return true;

  const nowMs = now.getTime();

  // service_datetime is ISO-8601 with offset; service_date is date-only (YYYY-MM-DD,
  // parsed as UTC midnight — hours of slack are irrelevant against a 72h grace).
  const svcRaw = row.service_datetime || row.service_date || '';
  const svcMs = svcRaw ? new Date(svcRaw).getTime() : NaN;
  if (Number.isFinite(svcMs)) return nowMs > svcMs + PROVIDER_LINK_GRACE_MS;

  const createdRaw = row.provider_link_created_at || '';
  const createdMs = createdRaw ? new Date(createdRaw).getTime() : NaN;
  if (Number.isFinite(createdMs)) return nowMs > createdMs + PROVIDER_LINK_MAX_AGE_MS;

  // No dates at all — keep honoring the token; admin can rotate it manually.
  return false;
}
