import test from 'node:test';
import assert from 'node:assert/strict';
import {
  providerLinkExpired,
  PROVIDER_LINK_GRACE_MS,
  PROVIDER_LINK_MAX_AGE_MS,
} from './providerLink.mjs';

const NOW = new Date('2026-07-02T12:00:00Z');
const hoursAgo = (h) => new Date(NOW.getTime() - h * 60 * 60 * 1000).toISOString();
const hoursAhead = (h) => new Date(NOW.getTime() + h * 60 * 60 * 1000).toISOString();

test('link is valid before and during the service', () => {
  assert.equal(providerLinkExpired({ status: 'Confirmed', service_datetime: hoursAhead(20) }, NOW), false);
  assert.equal(providerLinkExpired({ status: 'Confirmed', service_datetime: hoursAgo(2) }, NOW), false);
});

test('link stays valid through the 72h post-service grace window', () => {
  assert.equal(providerLinkExpired({ status: 'Captured', service_datetime: hoursAgo(71) }, NOW), false);
  assert.equal(providerLinkExpired({ status: 'Captured', service_datetime: hoursAgo(73) }, NOW), true);
});

test('link dies immediately on dead orders regardless of dates', () => {
  for (const status of ['Refunded', 'Declined', 'Canceled', 'Cancelled', 'canceled (auto)']) {
    assert.equal(
      providerLinkExpired({ status, service_datetime: hoursAhead(24) }, NOW),
      true,
      `status=${status} should expire the link`
    );
  }
});

test('date-only service_date is honored with the same grace window', () => {
  assert.equal(providerLinkExpired({ status: 'Scheduled', service_date: '2026-07-04' }, NOW), false);
  assert.equal(providerLinkExpired({ status: 'Captured', service_date: '2026-06-20' }, NOW), true);
});

test('falls back to mint-time max age when the order has no service date', () => {
  const freshMint = { status: 'New', provider_link_created_at: hoursAgo(24) };
  const staleMint = {
    status: 'New',
    provider_link_created_at: new Date(NOW.getTime() - PROVIDER_LINK_MAX_AGE_MS - 1000).toISOString(),
  };
  assert.equal(providerLinkExpired(freshMint, NOW), false);
  assert.equal(providerLinkExpired(staleMint, NOW), true);
});

test('unparseable dates fall through instead of expiring healthy orders', () => {
  assert.equal(
    providerLinkExpired({ status: 'Confirmed', service_datetime: 'por confirmar', provider_link_created_at: hoursAgo(1) }, NOW),
    false
  );
});

test('missing row expires; missing dates keep the token honored', () => {
  assert.equal(providerLinkExpired(null, NOW), true);
  assert.equal(providerLinkExpired({ status: 'New' }, NOW), false);
});

test('grace and max-age constants stay sane relative to each other', () => {
  assert.ok(PROVIDER_LINK_GRACE_MS < PROVIDER_LINK_MAX_AGE_MS);
});
