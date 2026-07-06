import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createAuthTokens, constantTimeEquals, isInvalidatedByCutoff } from './authTokens.mjs';

const SECRET = 'test-secret';
const TTL = 60 * 60; // 1h
const GRACE = 30 * 60; // 30min
const tokens = createAuthTokens({ secret: SECRET, ttlSecs: TTL, refreshGraceSecs: GRACE });

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function forgeToken({ header, payload, secret = SECRET }) {
  const h = b64url(header);
  const b = b64url(payload);
  const sig = createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${sig}`;
}

// ── sign / verify round-trip ──────────────────────────────────────────────────

test('signSessionToken → verifySessionToken round-trip preserves claims', () => {
  const token = tokens.signSessionToken({ user_id: 'u1', email: 'a@b.c' });
  const payload = tokens.verifySessionToken(token);
  assert.equal(payload.user_id, 'u1');
  assert.equal(payload.email, 'a@b.c');
  assert.ok(payload.jti, 'jti is set');
  assert.ok(payload.iat > 0, 'iat is set');
  assert.equal(payload.exp, payload.iat + TTL);
});

test('tampered signature is rejected', () => {
  const token = tokens.signSessionToken({ user_id: 'u1' });
  const [h, b, sig] = token.split('.');
  const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
  assert.equal(tokens.verifySessionToken(`${h}.${b}.${flipped}`), null);
});

test('tampered payload is rejected', () => {
  const token = tokens.signSessionToken({ user_id: 'u1' });
  const [h, , sig] = token.split('.');
  const evil = b64url({ user_id: 'admin', iat: 1, exp: 9999999999, jti: 'x' });
  assert.equal(tokens.verifySessionToken(`${h}.${evil}.${sig}`), null);
});

test('token signed with a different secret is rejected', () => {
  const other = createAuthTokens({ secret: 'other', ttlSecs: TTL, refreshGraceSecs: GRACE });
  assert.equal(tokens.verifySessionToken(other.signSessionToken({ user_id: 'u1' })), null);
});

test('expired token is rejected', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = forgeToken({
    header: { alg: 'HS256', typ: 'JWT' },
    payload: { user_id: 'u1', iat: now - 7200, exp: now - 3600, jti: 'j' },
  });
  assert.equal(tokens.verifySessionToken(token), null);
});

test('malformed tokens are rejected', () => {
  assert.equal(tokens.verifySessionToken(null), null);
  assert.equal(tokens.verifySessionToken(''), null);
  assert.equal(tokens.verifySessionToken('a.b'), null);
  assert.equal(tokens.verifySessionToken('not-a-jwt'), null);
});

// ── algorithm confusion ───────────────────────────────────────────────────────
// The header's alg claim is never read: verification is always HMAC-SHA256.

test('alg:none forgery is rejected', () => {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url({ alg: 'none', typ: 'JWT' });
  const b = b64url({ user_id: 'u1', iat: now, exp: now + TTL, jti: 'j' });
  assert.equal(tokens.verifySessionToken(`${h}.${b}.`), null);
  assert.equal(tokens.verifySessionToken(`${h}.${b}.anything`), null);
});

test('header alg swap does not change verification algorithm', () => {
  const now = Math.floor(Date.now() / 1000);
  // Correctly HMAC-signed but claiming RS256 — still verifies (alg ignored)…
  const good = forgeToken({
    header: { alg: 'RS256', typ: 'JWT' },
    payload: { user_id: 'u1', iat: now, exp: now + TTL, jti: 'j' },
  });
  assert.equal(tokens.verifySessionToken(good).user_id, 'u1');
  // …and an unsigned RS256-claiming token is rejected.
  const h = b64url({ alg: 'RS256', typ: 'JWT' });
  const b = b64url({ user_id: 'u1', iat: now, exp: now + TTL, jti: 'j' });
  assert.equal(tokens.verifySessionToken(`${h}.${b}.fakesig`), null);
});

// ── decodeForRefresh (grace window) ───────────────────────────────────────────

test('decodeForRefresh accepts a live token', () => {
  const token = tokens.signSessionToken({ user_id: 'u1' });
  const res = tokens.decodeForRefresh(token);
  assert.equal(res.error, undefined);
  assert.equal(res.payload.user_id, 'u1');
});

test('decodeForRefresh accepts a token expired within the grace window', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = forgeToken({
    header: { alg: 'HS256', typ: 'JWT' },
    payload: { user_id: 'u1', iat: now - TTL - 60, exp: now - 60, jti: 'j' },
  });
  assert.equal(tokens.decodeForRefresh(token).payload.user_id, 'u1');
});

test('decodeForRefresh rejects a token expired beyond the grace window', () => {
  const now = Math.floor(Date.now() / 1000);
  const token = forgeToken({
    header: { alg: 'HS256', typ: 'JWT' },
    payload: { user_id: 'u1', iat: now - TTL - GRACE - 120, exp: now - GRACE - 120, jti: 'j' },
  });
  assert.equal(tokens.decodeForRefresh(token).error, 'token_too_old');
});

test('decodeForRefresh rejects bad signatures and malformed tokens', () => {
  const token = tokens.signSessionToken({ user_id: 'u1' });
  const [h, b] = token.split('.');
  assert.equal(tokens.decodeForRefresh(`${h}.${b}.badsig`).error, 'invalid_signature');
  assert.equal(tokens.decodeForRefresh('x.y').error, 'invalid_token');
  assert.equal(tokens.decodeForRefresh('').error, 'no_token');
});

// ── constantTimeEquals ────────────────────────────────────────────────────────

test('constantTimeEquals compares correctly regardless of length', () => {
  assert.equal(constantTimeEquals('abc', 'abc'), true);
  assert.equal(constantTimeEquals('abc', 'abd'), false);
  assert.equal(constantTimeEquals('abc', 'abcd'), false); // different lengths
  assert.equal(constantTimeEquals('', 'abc'), false);
  assert.equal(constantTimeEquals(null, 'abc'), false);
  assert.equal(constantTimeEquals('abc', undefined), false);
});

// ── isInvalidatedByCutoff (user-level session invalidation) ───────────────────

test('no cutoff → token stays valid', () => {
  assert.equal(isInvalidatedByCutoff({ iat: 100, jti: 'a' }, null, null), false);
  assert.equal(isInvalidatedByCutoff({ iat: 100, jti: 'a' }, undefined, 'a'), false);
});

test('token issued before cutoff is invalidated', () => {
  const cutoff = new Date('2026-01-02T00:00:00Z');
  const iatBefore = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
  assert.equal(isInvalidatedByCutoff({ iat: iatBefore, jti: 'a' }, cutoff, 'other'), true);
});

test('exempt jti survives the cutoff', () => {
  const cutoff = new Date('2026-01-02T00:00:00Z');
  const iatBefore = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
  assert.equal(isInvalidatedByCutoff({ iat: iatBefore, jti: 'mine' }, cutoff, 'mine'), false);
});

test('token issued after cutoff stays valid', () => {
  const cutoff = new Date('2026-01-01T00:00:00Z');
  const iatAfter = Math.floor(new Date('2026-01-02T00:00:00Z').getTime() / 1000);
  assert.equal(isInvalidatedByCutoff({ iat: iatAfter, jti: 'a' }, cutoff, null), false);
});

test('string cutoff (pg driver may return text) is handled', () => {
  const iatBefore = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000);
  assert.equal(isInvalidatedByCutoff({ iat: iatBefore, jti: 'a' }, '2026-01-02T00:00:00Z', null), true);
});

// ── source-level regression guards (pattern from accountOrders.test.mjs) ─────

test('index.mjs uses hardened auth primitives', async () => {
  const src = await readFile(new URL('./index.mjs', import.meta.url), 'utf8');
  // No non-constant-time JWT signature comparison remains.
  assert.doesNotMatch(src, /signature !== expectedSignature|expectedSig !== parts\[2\]/);
  // verify-email is rate-limited.
  assert.match(src, /app\.get\('\/api\/auth\/verify-email', publicFormLimit/);
  // Account deletion requires step-up re-auth.
  assert.match(src, /app\.delete\('\/api\/auth\/me'[\s\S]{0,400}requireRecentAuth\(req, res, RECENT_AUTH_DESTRUCTIVE_SECS/);
  // Identifier changes set the user-level invalidation cutoff.
  assert.match(src, /sessions_invalidated_before = NOW\(\)/);
});

test('db schema migrates the session-invalidation columns', async () => {
  const src = await readFile(new URL('./db.pg.mjs', import.meta.url), 'utf8');
  assert.match(src, /ADD COLUMN IF NOT EXISTS sessions_invalidated_before TIMESTAMPTZ/);
  assert.match(src, /ADD COLUMN IF NOT EXISTS sessions_invalidated_exempt_jti TEXT/);
});

test('morphing-nav escapes user-supplied fields in nav HTML', async () => {
  const src = await readFile(new URL('../frontend/shared/morphing-nav.js', import.meta.url), 'utf8');
  assert.match(src, /site-drawer__user-name">\$\{esc\(/);
  assert.match(src, /site-drawer__user-contact">\$\{esc\(/);
  assert.match(src, /title="\$\{esc\(/);
});
