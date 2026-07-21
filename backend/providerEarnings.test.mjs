import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarizeProviderEarnings,
  cdmxWeekStartMs,
  cdmxMonthStartMs,
  jobRefTime,
} from './providerEarnings.mjs';

// Tuesday 2026-06-23 10:00 CDMX (16:00 UTC) — same anchor the app prototypes used.
const NOW = Date.parse('2026-06-23T16:00:00Z');

const row = (over = {}) => ({
  status: 'Captured',
  provider_amount: 50_000, // $500 MXN
  service_datetime: '2026-06-23T15:00:00Z',
  service_phase: null,
  created_at: '2026-06-20T12:00:00Z',
  ...over,
});

test('week starts Monday 00:00 CDMX regardless of machine timezone', () => {
  // Monday 2026-06-22 00:00 CDMX == 2026-06-22T06:00:00Z
  assert.equal(cdmxWeekStartMs(NOW), Date.parse('2026-06-22T06:00:00Z'));
  assert.equal(cdmxMonthStartMs(NOW), Date.parse('2026-06-01T06:00:00Z'));
});

test('captured jobs this week land in weekCents and the right weekday bucket', () => {
  const s = summarizeProviderEarnings([row()], NOW);
  assert.equal(s.weekCents, 50_000);
  assert.equal(s.weekJobs, 1);
  // 2026-06-23T15:00Z = Tuesday 09:00 CDMX → index 1 (Mon = 0)
  assert.deepEqual(s.weekByDay, [0, 50_000, 0, 0, 0, 0, 0]);
});

test('captured last week counts for the month but not the week', () => {
  const s = summarizeProviderEarnings([row({ service_datetime: '2026-06-18T15:00:00Z' })], NOW);
  assert.equal(s.weekCents, 0);
  assert.equal(s.monthCents, 50_000);
  assert.equal(s.monthJobs, 1);
});

test('Sunday night CDMX vs Monday morning UTC does not leak across the week edge', () => {
  // 2026-06-22T05:00:00Z is Monday in UTC but Sunday 23:00 CDMX → previous week.
  const s = summarizeProviderEarnings([row({ service_datetime: '2026-06-22T05:00:00Z' })], NOW);
  assert.equal(s.weekCents, 0);
  // One hour later it's Monday 00:00 CDMX → this week.
  const s2 = summarizeProviderEarnings([row({ service_datetime: '2026-06-22T06:00:00Z' })], NOW);
  assert.equal(s2.weekCents, 50_000);
});

test('completed-on-site but uncaptured money is pending, never earned', () => {
  const s = summarizeProviderEarnings(
    [row({ status: 'Confirmed', service_phase: 'completed' })],
    NOW
  );
  assert.equal(s.pendingCents, 50_000);
  assert.equal(s.weekCents, 0);
  assert.equal(s.monthCents, 0);
});

test('upcoming held/scheduled work is scheduledCents; dead statuses count nowhere', () => {
  const s = summarizeProviderEarnings(
    [
      row({ status: 'Scheduled' }),
      row({ status: 'Confirmed' }),
      row({ status: 'Canceled' }),
      row({ status: 'Refunded' }),
    ],
    NOW
  );
  assert.equal(s.scheduledCents, 100_000);
  assert.equal(s.weekCents, 0);
  assert.equal(s.pendingCents, 0);
});

test('status matching is case/whitespace tolerant (admin vs Apps Script casing)', () => {
  const s = summarizeProviderEarnings([row({ status: ' captured ' })], NOW);
  assert.equal(s.weekCents, 50_000);
});

test('jobRefTime falls back service_datetime → created_at → now', () => {
  assert.equal(jobRefTime(row(), NOW), Date.parse('2026-06-23T15:00:00Z'));
  assert.equal(
    jobRefTime(row({ service_datetime: null }), NOW),
    Date.parse('2026-06-20T12:00:00Z')
  );
  assert.equal(jobRefTime(row({ service_datetime: 'por confirmar', created_at: null }), NOW), NOW);
});

test('null provider_amount treated as zero, not NaN', () => {
  const s = summarizeProviderEarnings([row({ provider_amount: null })], NOW);
  assert.equal(s.weekCents, 0);
  assert.equal(s.weekJobs, 1);
});
