import test from 'node:test';
import assert from 'node:assert/strict';
import { buildParseSystemPrompt, buildParseUserPrompt, parseModelResponse } from './smartRequestParse.mjs';

test('system prompt embeds the grounded catalog', () => {
  const p = buildParseSystemPrompt();
  assert.ok(p.includes('plumbing'));
  assert.ok(p.includes('Sink or drain unclogging'));
  assert.ok(p.includes('"category"'));
});

test('user prompt carries text, language, and today', () => {
  const today = new Date('2026-06-08T12:00:00Z');
  const p = buildParseUserPrompt('My sink is clogged', 'es', today);
  assert.ok(p.includes('My sink is clogged'));
  assert.ok(p.includes('Spanish'));
  assert.ok(p.includes('2026-06-08'));
  assert.ok(buildParseUserPrompt('x', 'en', today).includes('English'));
});

test('parseModelResponse parses clean JSON', () => {
  const out = parseModelResponse('{"category":"repair","subKey":"plumbing","service":"Sink or drain unclogging","summary":"Clogged sink","confidence":0.9,"urgency":"asap","inferredDate":null,"followups":[{"q":"Which fixture?","key":"fixture","chips":["Sink","Toilet"]}]}');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'plumbing');
  assert.equal(out.confidence, 0.9);
  assert.equal(out.followups.length, 1);
});

test('parseModelResponse extracts JSON embedded in prose/markdown', () => {
  const out = parseModelResponse('Sure!\n```json\n{"category":"cleaning","confidence":0.5,"urgency":"flexible"}\n```\nDone.');
  assert.equal(out.category, 'cleaning');
});

test('parseModelResponse normalizes bad values', () => {
  const out = parseModelResponse('{"category":"nonsense","confidence":5,"urgency":"whenever","inferredDate":"soon","followups":"nope"}');
  assert.equal(out.category, 'custom');
  assert.equal(out.confidence, 1);
  assert.equal(out.urgency, 'flexible');
  assert.equal(out.inferredDate, null);
  assert.deepEqual(out.followups, []);
});

test('parseModelResponse caps followups at 3', () => {
  const f = JSON.stringify({ category: 'repair', confidence: 0.8, urgency: 'asap', followups: [1, 2, 3, 4, 5].map((n) => ({ q: 'q' + n, key: 'k' + n })) });
  assert.equal(parseModelResponse(f).followups.length, 3);
});

test('parseModelResponse removes date and timing followups', () => {
  const out = parseModelResponse(JSON.stringify({
    category: 'repair',
    confidence: 0.8,
    urgency: 'flexible',
    followups: [
      { q: 'Roughly when do you need it?', key: 'timing', chips: ['ASAP', 'This week'] },
      { q: 'Which fixture is affected?', key: 'fixture', chips: ['Sink', 'Toilet'] },
    ],
  }));
  assert.deepEqual(out.followups, [{ q: 'Which fixture is affected?', key: 'fixture', chips: ['Sink', 'Toilet'] }]);
});

test('parseModelResponse throws when no JSON present', () => {
  assert.throws(() => parseModelResponse('I could not help with that.'));
});
