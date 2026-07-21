/**
 * Offer-accept transaction for the partner app (extracted pure-ish helper so the
 * race behavior is unit-testable with an injected client — see providerOffers.test.mjs).
 *
 * Exactly one specialist can win an order:
 *   1. The offer flip requires status='offered' AND unexpired — a second accept, a
 *      decline-then-accept, or an expired offer all fall out here (→ offer_gone).
 *   2. The booking claim requires provider_id still empty — this also respects a
 *      concurrent manual admin assignment (→ already_assigned; the just-flipped
 *      offer is voided so it can't read as accepted).
 *   3. Every other open offer for the order is retired.
 *
 * `client` is a pg client (transaction-capable). The function owns BEGIN/COMMIT/
 * ROLLBACK; the caller owns connect/release.
 */
export async function acceptOfferTx(client, { orderId, providerId, providerName }) {
  try {
    await client.query('BEGIN');

    const { rows: offerRows } = await client.query(
      `UPDATE provider_offers
          SET status = 'accepted', responded_at = NOW()
        WHERE order_id = $1 AND provider_id = $2 AND status = 'offered' AND expires_at > NOW()
        RETURNING id`,
      [orderId, providerId]
    );
    if (!offerRows.length) {
      await client.query('ROLLBACK');
      return { error: 'offer_gone' };
    }

    const { rows: claimRows } = await client.query(
      `UPDATE all_bookings
          SET provider_id = $1, provider_name = $2
        WHERE id = $3 AND COALESCE(provider_id, '') = ''
        RETURNING id`,
      [providerId, providerName ?? null, orderId]
    );
    if (!claimRows.length) {
      // Someone else (or admin) got it — void the offer we just flipped.
      await client.query(
        `UPDATE provider_offers SET status = 'expired' WHERE order_id = $1 AND provider_id = $2`,
        [orderId, providerId]
      );
      await client.query('COMMIT');
      return { error: 'already_assigned' };
    }

    await client.query(
      `UPDATE provider_offers SET status = 'expired'
        WHERE order_id = $1 AND provider_id <> $2 AND status = 'offered'`,
      [orderId, providerId]
    );

    await client.query('COMMIT');
    return { ok: true, offerId: offerRows[0].id };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* connection-level failure */ }
    throw err;
  }
}
