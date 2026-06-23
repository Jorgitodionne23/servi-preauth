import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = globalThis;
await import('../frontend/smart-request/catalog.js');
await import('../frontend/smart-request/heuristic.js');

const today = new Date('2026-06-09T12:00:00');

function parse(text) {
  return globalThis.ServiHeuristic.parse(text, {
    catalog: globalThis.SERVI_CATALOG,
    signals: globalThis.SERVI_HEURISTIC_SIGNALS,
    followups: globalThis.SERVI_FOLLOWUPS,
    genericFollowups: globalThis.SERVI_GENERIC_FOLLOWUPS,
    today,
  });
}

test('heuristic maps Spanish plumbing request', () => {
  const out = parse('tengo fuga en el lavabo');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'plumbing');
  assert.ok(out.confidence >= 0.6);
});

test('heuristic maps Spanish TV mounting request', () => {
  const out = parse('quiero montar una tele en la pared');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'handyman');
  assert.equal(out.service, 'TV wall mounting');
});

test('heuristic maps Spanish urgent lockout as ASAP', () => {
  const out = parse('se me quedaron las llaves adentro urgente');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'locksmith');
  assert.equal(out.service, 'Emergency home lockout');
  assert.equal(out.urgency, 'asap');
});

test('heuristic infers Spanish scheduled date', () => {
  const out = parse('limpieza profunda este sábado');
  assert.equal(out.category, 'cleaning');
  assert.equal(out.subKey, 'deep-cleaning');
  assert.equal(out.urgency, 'scheduled');
  assert.equal(out.inferredDate, '2026-06-13');
});

test('heuristic keeps English plumbing regression', () => {
  const out = parse('My kitchen sink is clogged and water is backing up, need a plumber today');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'plumbing');
  assert.equal(out.urgency, 'asap');
});

test('heuristic keeps English deep cleaning regression', () => {
  const out = parse('Deep clean for a 2-bedroom apartment this Saturday');
  assert.equal(out.category, 'cleaning');
  assert.equal(out.subKey, 'deep-cleaning');
  assert.equal(out.urgency, 'scheduled');
  assert.equal(out.inferredDate, '2026-06-13');
});

test('heuristic keeps English TV mounting regression', () => {
  const out = parse('Mount a 55 inch TV on the living room wall');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'handyman');
  assert.equal(out.service, 'TV wall mounting');
});

test('weak request stays low confidence and custom', () => {
  const out = parse('necesito ayuda con algo en casa');
  assert.equal(out.category, 'custom');
  assert.ok(out.confidence < 0.5);
  assert.equal(out.followups.some((f) => f.key === 'timing' || /when|cuando|fecha|semana/i.test(f.q)), false);
});

test('ambiguous close match asks for clarification without high confidence', () => {
  const out = parse('necesito instalar una lampara y una repisa en la pared');
  assert.equal(out.category, 'repair');
  assert.ok(out.confidence < 0.9);
  assert.equal(out.followups[0]?.key, 'service_clarification');
});

test('heuristic removes timing followups from matched services', () => {
  const out = parse('necesito cuidado de niños');
  assert.equal(out.subKey, 'child-care');
  assert.equal(out.followups.some((f) => f.key === 'when' || /when|cuando|fecha|semana/i.test(f.q)), false);
});
