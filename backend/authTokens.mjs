// Pure session-token helpers, extracted from index.mjs so they can be unit-tested
// without booting the server (index.mjs starts Express and requires env on import).
// No DB access here — revocation/cutoff lookups stay in index.mjs.
import { randomUUID, createHash, createHmac, timingSafeEqual } from 'crypto';

// Timing-safe string comparison for secrets (admin tokens, provider link tokens,
// poll-token hashes, JWT signatures). Hash both sides first so inputs of different
// lengths are compared in constant time without leaking length via an early return.
export function constantTimeEquals(a, b) {
  if (!a || !b) return false;
  const aHash = createHash('sha256').update(String(a), 'utf8').digest();
  const bHash = createHash('sha256').update(String(b), 'utf8').digest();
  return timingSafeEqual(aHash, bHash);
}

// User-level session invalidation: a token is dead if it was issued before the
// account's sessions_invalidated_before cutoff — unless it is the exempt jti
// (the session that performed the identifier change and just passed re-auth).
export function isInvalidatedByCutoff(payload, cutoff, exemptJti) {
  if (!cutoff) return false;
  const cutoffMs = cutoff instanceof Date ? cutoff.getTime() : new Date(cutoff).getTime();
  if (!Number.isFinite(cutoffMs)) return false;
  if (exemptJti && payload?.jti === exemptJti) return false;
  const iatMs = (Number(payload?.iat) || 0) * 1000;
  return iatMs < cutoffMs;
}

export function createAuthTokens({ secret, ttlSecs, refreshGraceSecs }) {
  if (!secret) throw new Error('createAuthTokens: secret is required');

  function sign(header, body) {
    return createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  }

  function signSessionToken(payload) {
    const now = Math.floor(Date.now() / 1000);
    const jti = randomUUID();
    const fullPayload = { ...payload, iat: now, exp: now + ttlSecs, jti };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    return `${header}.${body}.${sign(header, body)}`;
  }

  // Signature + expiry only. The header's alg claim is deliberately ignored —
  // verification is always HMAC-SHA256, so alg:none / RS256-swap forgeries fail.
  function verifySessionToken(token) {
    if (!token) return null;
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    if (!constantTimeEquals(signature, sign(header, body))) return null;
    try {
      const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
      return payload;
    } catch (e) { return null; }
  }

  // Refresh-path decode: same signature check, but accepts tokens expired by up to
  // refreshGraceSecs. Returns { payload } or { error } (maps to a 401 error code).
  function decodeForRefresh(token) {
    if (!token) return { error: 'no_token' };
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return { error: 'invalid_token' };
    if (!constantTimeEquals(parts[2], sign(parts[0], parts[1]))) return { error: 'invalid_signature' };
    let payload;
    try {
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch (e) {
      return { error: 'invalid_token' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp + refreshGraceSecs < now) return { error: 'token_too_old' };
    return { payload };
  }

  return { signSessionToken, verifySessionToken, decodeForRefresh };
}
