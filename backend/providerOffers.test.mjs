import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptOfferTx } from './providerOffers.mjs';

/**
 * Scripted fake pg client. Each non-BEGIN/COMMIT/ROLLBACK query pops the next
 * scripted result; the log records the exact statement order so tests can
 * assert the transaction shape (what committed, what rolled back, what ran).
 */
function fakeClient(results) {
  const log = [];
  const queue = [...results];
  return {
    log,
    async query(sql, params) {
      const kind = String(sql).trim().split(/\s+/)[0].toUpperCase();
      if (kind === 'BEGIN' || kind === 'COMMIT' || kind === 'ROLLBACK') {
        log.push(kind);
        return { rows: [] };
      }
      log.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next ?? { rows: [] };
    },
  };
}

const ARGS = { orderId: 'ord_1', providerId: 'prov-000117', providerName: 'Pablo Méndez' };

test('happy path: offer flips, booking claimed, sibling offers retired, COMMIT', async () => {
  const client = fakeClient([
    { rows: [{ id: 'offer_1' }] },   // offer → accepted
    { rows: [{ id: 'ord_1' }] },     // booking claimed
    { rows: [] },                    // siblings expired
  ]);
  const out = await acceptOfferTx(client, ARGS);
  assert.deepEqual(out, { ok: true, offerId: 'offer_1' });
  assert.equal(client.log[0], 'BEGIN');
  assert.equal(client.log.at(-1), 'COMMIT');
  // The claim must be guarded on an EMPTY provider_id (respects admin manual assignment).
  const claim = client.log[2];
  assert.match(claim.sql, /COALESCE\(provider_id, ''\) = ''/);
  assert.deepEqual(claim.params, ['prov-000117', 'Pablo Méndez', 'ord_1']);
});

test('second accept / expired / declined offer → offer_gone, ROLLBACK, no claim attempted', async () => {
  const client = fakeClient([
    { rows: [] },                    // offer flip matches nothing
  ]);
  const out = await acceptOfferTx(client, ARGS);
  assert.deepEqual(out, { error: 'offer_gone' });
  assert.equal(client.log.at(-1), 'ROLLBACK');
  // Only the offer-flip statement ran inside the tx.
  assert.equal(client.log.filter((e) => typeof e === 'object').length, 1);
});

test('offer flip requires offered status + future expiry (the race guard itself)', async () => {
  const client = fakeClient([{ rows: [{ id: 'offer_1' }] }, { rows: [{ id: 'ord_1' }] }, { rows: [] }]);
  await acceptOfferTx(client, ARGS);
  const flip = client.log[1];
  assert.match(flip.sql, /status = 'offered' AND expires_at > NOW\(\)/);
  assert.deepEqual(flip.params, ['ord_1', 'prov-000117']);
});

test('booking already assigned → offer voided, COMMIT (not rollback), already_assigned', async () => {
  const client = fakeClient([
    { rows: [{ id: 'offer_1' }] },   // offer flipped
    { rows: [] },                    // claim lost — provider_id already set
    { rows: [] },                    // void own offer
  ]);
  const out = await acceptOfferTx(client, ARGS);
  assert.deepEqual(out, { error: 'already_assigned' });
  // The void must persist — a rollback would leave the offer looking accepted.
  assert.equal(client.log.at(-1), 'COMMIT');
  const voided = client.log[3];
  assert.match(voided.sql, /SET status = 'expired'/);
  assert.deepEqual(voided.params, ['ord_1', 'prov-000117']);
});

test('mid-transaction error → ROLLBACK and rethrow', async () => {
  const boom = new Error('db down');
  const client = fakeClient([
    { rows: [{ id: 'offer_1' }] },
    boom,
  ]);
  await assert.rejects(() => acceptOfferTx(client, ARGS), /db down/);
  assert.equal(client.log.at(-1), 'ROLLBACK');
});

test('null providerName is passed through as null (never undefined into SQL)', async () => {
  const client = fakeClient([{ rows: [{ id: 'o' }] }, { rows: [{ id: 'ord_1' }] }, { rows: [] }]);
  await acceptOfferTx(client, { ...ARGS, providerName: null });
  assert.equal(client.log[2].params[1], null);
});
