#!/usr/bin/env bash
# Local dev: run the SERVI backend + the Stripe webhook listener together.
#
# The Stripe CLI forwards TEST-mode events (payment_intent.amount_capturable_updated,
# .succeeded, etc.) to the local /webhook, so order statuses update locally exactly like
# they do on staging/prod. Ctrl-C stops both processes.
#
# One-time setup: the signing secret the listener uses must equal STRIPE_WEBHOOK_SECRET
# in .env. Print it with `npm run stripe:secret` and paste it in if they ever drift.
set -uo pipefail

PORT="${PORT:-4242}"

if ! command -v stripe >/dev/null 2>&1; then
  echo "✖ Stripe CLI not found. Install it with: brew install stripe/stripe-cli/stripe" >&2
  echo "  then run: stripe login" >&2
  exit 1
fi

# Stop the whole process group (listener + server) on exit / Ctrl-C.
trap 'kill 0' EXIT INT TERM

echo "▶ Stripe listener → http://localhost:${PORT}/webhook (test mode)"
stripe listen --forward-to "localhost:${PORT}/webhook" &

echo "▶ Backend       → http://localhost:${PORT}"
node backend/index.mjs
