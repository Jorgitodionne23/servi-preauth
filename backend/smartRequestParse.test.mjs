import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMediaAnalysisSystemPrompt, buildParseSystemPrompt, buildParseUserPrompt, parseMediaModelResponse, parseModelResponse } from './smartRequestParse.mjs';

test('system prompt embeds the grounded catalog', () => {
  const p = buildParseSystemPrompt();
  assert.ok(p.includes('plumbing'));
  assert.ok(p.includes('Sink or drain unclogging'));
  assert.ok(p.includes('"category"'));
});

test('media prompt embeds strict unclear status contract', () => {
  const p = buildMediaAnalysisSystemPrompt();
  assert.ok(p.includes('"status"'));
  assert.ok(p.includes('unclear'));
  assert.ok(p.includes('Sink or drain unclogging'));
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
  assert.equal(out.understandingStatus, 'clarifying');
  assert.deepEqual(out.missingFields, ['fixture']);
  assert.equal(out.requiredFollowups[0].required, true);
});

test('parseModelResponse only marks a complete catalog match understood', () => {
  const out = parseModelResponse(JSON.stringify({
    category: 'repair', subKey: 'plumbing', service: 'Pipe leak repair',
    summary: 'Pipe is leaking', confidence: 0.91, urgency: 'flexible', followups: [],
  }));
  assert.equal(out.understandingStatus, 'understood');
  assert.deepEqual(out.missingFields, []);
});

test('parseModelResponse validates and exposes catalog candidates', () => {
  const out = parseModelResponse(JSON.stringify({
    category: 'repair', subKey: 'handyman', service: 'TV wall mounting',
    summary: 'Mount an item', confidence: 0.7, urgency: 'flexible', followups: [],
    candidateServices: ['TV wall mounting', 'Light fixture installation', 'Invented service'],
  }));
  assert.equal(out.understandingStatus, 'clarifying');
  assert.deepEqual(out.candidateServices.map((item) => item.service), ['TV wall mounting', 'Light fixture installation']);
});

test('custom model output remains unresolved until explicit guided confirmation', () => {
  const out = parseModelResponse(JSON.stringify({
    category: 'custom', service: 'Unusual home task', summary: 'Unusual task', confidence: 0.9,
    urgency: 'flexible', followups: [{ q: 'What result do you want?', key: 'goal' }],
  }));
  assert.equal(out.aiStatus, 'unclear');
  assert.equal(out.aiReason, 'off_catalog');
  assert.equal(out.understandingStatus, 'unresolved');
});

test('parseModelResponse extracts JSON embedded in prose/markdown', () => {
  const out = parseModelResponse('Sure!\n```json\n{"category":"cleaning","confidence":0.5,"urgency":"flexible"}\n```\nDone.');
  assert.equal(out.aiStatus, 'unclear');
  assert.equal(out.category, 'custom');
});

test('parseModelResponse normalizes bad values', () => {
  const out = parseModelResponse('{"category":"nonsense","confidence":5,"urgency":"whenever","inferredDate":"soon","followups":"nope"}');
  assert.equal(out.category, 'custom');
  assert.equal(out.aiStatus, 'unclear');
  assert.equal(out.confidence, 0.4);
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

test('parseModelResponse rejects non-catalog service for catalog category', () => {
  const out = parseModelResponse(JSON.stringify({
    category: 'repair',
    subKey: 'plumbing',
    service: 'Mystery plumbing visit',
    summary: 'Mystery issue',
    confidence: 0.95,
    urgency: 'flexible',
  }));
  assert.equal(out.aiStatus, 'unclear');
  assert.equal(out.category, 'custom');
  assert.equal(out.subKey, null);
  assert.equal(out.service, null);
  assert.equal(out.confidence, 0.4);
});

test('parseMediaModelResponse accepts high-confidence catalog-backed photo', () => {
  const out = parseMediaModelResponse(JSON.stringify({
    status: 'understood',
    category: 'repair',
    subKey: 'plumbing',
    service: 'Sink or drain unclogging',
    summary: 'Sink drain appears clogged',
    confidence: 0.86,
    evidence: ['standing water in sink', 'visible drain area'],
  }));
  assert.equal(out.aiStatus, 'understood');
  assert.equal(out.category, 'repair');
  assert.equal(out.subKey, 'plumbing');
  assert.equal(out.service, 'Sink or drain unclogging');
});

test('parseMediaModelResponse makes weak or unrelated photos unclear', () => {
  const out = parseMediaModelResponse(JSON.stringify({
    status: 'understood',
    category: 'repair',
    subKey: 'plumbing',
    service: 'Sink or drain unclogging',
    summary: 'Maybe a sink',
    confidence: 0.5,
    evidence: ['a white surface'],
  }));
  assert.equal(out.aiStatus, 'unclear');
  assert.equal(out.category, 'custom');
  assert.equal(out.service, null);
});

test('parseMediaModelResponse rejects invalid catalog output', () => {
  const out = parseMediaModelResponse(JSON.stringify({
    status: 'understood',
    category: 'repair',
    subKey: 'plumbing',
    service: 'Imaginary drain package',
    summary: 'Drain issue',
    confidence: 0.95,
    evidence: ['water near a sink'],
  }));
  assert.equal(out.aiStatus, 'unclear');
  assert.equal(out.aiReason, 'invalid_service');
});

test('parseModelResponse throws when no JSON present', () => {
  assert.throws(() => parseModelResponse('I could not help with that.'));
});
