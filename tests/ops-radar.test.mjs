import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyOrderOps, serviceDurationHours } from '../backend/ops-radar.mjs';

const now = new Date('2026-06-05T18:00:00.000Z');

function order(overrides = {}) {
  return {
    id: 'ord_test_ops',
    amount: 120000,
    pricing_total_amount: 120000,
    category: 'repair',
    status: 'Scheduled',
    service_datetime: '2026-06-06T06:00:00.000Z',
    is_asap: false,
    payment_intent_id: null,
    cash_selected: false,
    ...overrides,
  };
}

test('category duration defaults are stable', () => {
  assert.equal(serviceDurationHours(order({ category: 'cleaning' })), 3);
  assert.equal(serviceDurationHours(order({ category: 'repair' })), 2);
  assert.equal(serviceDurationHours(order({ category: 'wellness' })), 1.5);
  assert.equal(serviceDurationHours(order({ category: 'moving' })), 1);
  assert.equal(serviceDurationHours(order({ category: 'suppliers' })), 1);
  assert.equal(serviceDurationHours(order({ category: 'unknown' })), 2);
});

test('future scheduled order outside 24h is safe', () => {
  const ops = classifyOrderOps(order({ service_datetime: '2026-06-07T20:00:00.000Z' }), { now });
  assert.equal(ops.code, 'safe');
});

test('scheduled order inside 24h without payment intent needs preauth', () => {
  const ops = classifyOrderOps(order({ service_datetime: '2026-06-06T04:00:00.000Z' }), { now });
  assert.equal(ops.code, 'preauth_due');
  assert.equal(ops.actionLabel, 'Autorizar ahora');
});

test('confirmed order 30 minutes before service is starting soon', () => {
  const ops = classifyOrderOps(order({
    status: 'Confirmed',
    payment_intent_id: 'pi_test',
    service_datetime: '2026-06-05T18:30:00.000Z',
  }), { now });
  assert.equal(ops.code, 'starting_soon');
});

test('confirmed order after estimated end is capture due', () => {
  const ops = classifyOrderOps(order({
    status: 'Confirmed',
    payment_intent_id: 'pi_test',
    service_datetime: '2026-06-05T15:30:00.000Z',
  }), { now });
  assert.equal(ops.code, 'capture_due');
});

test('confirmed order more than 2h after estimated end is capture overdue', () => {
  const ops = classifyOrderOps(order({
    status: 'Confirmed',
    payment_intent_id: 'pi_test',
    service_datetime: '2026-06-05T13:00:00.000Z',
  }), { now });
  assert.equal(ops.code, 'capture_overdue');
  assert.equal(ops.severity, 'critical');
});

test('ASAP order without datetime needs schedule', () => {
  const ops = classifyOrderOps(order({
    is_asap: true,
    service_datetime: null,
    service_date: null,
  }), { now });
  assert.equal(ops.code, 'needs_schedule');
});

test('declined order is payment failed even though normal flows treat it as terminal', () => {
  const ops = classifyOrderOps(order({ status: 'Declined' }), { now });
  assert.equal(ops.code, 'payment_failed');
  assert.equal(ops.severity, 'critical');
});

test('captured order is safe', () => {
  const ops = classifyOrderOps(order({ status: 'Captured', payment_intent_id: 'pi_test' }), { now });
  assert.equal(ops.code, 'safe');
});
