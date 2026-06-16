# Environments & Stripe-Mode Isolation

SERVI runs two backend deployments. They must stay **fully isolated** — separate databases and
matching Stripe key modes. This document is the source of truth for that topology. (No `render.yaml`
blueprint is committed: the Render services are configured manually in the dashboard, and a blueprint
could clash with them. Configure the env vars below by hand and keep this doc in sync.)

## Services

| Role | Render service | Branch | `STRIPE_SECRET_KEY` | `NODE_ENV` | `DATABASE_URL` |
|------|----------------|--------|---------------------|------------|----------------|
| **Production** | `servi-preauth` (`servi-preauth.onrender.com`) | `main` | `sk_live_…` | `production` | **its own** Neon DB |
| **Staging** | `servi-staging` | `dev` | `sk_test_…` | not `production` | **its own, separate** Neon DB |

### Hard rules

1. **Each service has its OWN `DATABASE_URL`.** Staging and production must **never** share a Neon
   database. A shared DB means a live-key cron can pick up a test-mode order (or vice versa) and fail
   with `No such paymentmethod … a similar object exists in test mode, but a live mode key was used`.
   That cross-contamination is the exact failure this isolation prevents.
2. **Key mode must match the role.** Production = `sk_live_`; staging = `sk_test_`. The backend
   **refuses to start** if `NODE_ENV=production` with a test key (see
   `backend/index.mjs`, just after the `STRIPE_SECRET_KEY` presence check). On boot it logs
   `[startup] Stripe mode: LIVE|TEST` — verify it in the Render logs after each deploy.
3. A new/empty Neon DB self-initializes on first boot — `backend/db.pg.mjs` runs
   `CREATE TABLE IF NOT EXISTS …` and the `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` migrations.

## The hourly preauth cron

`.github/workflows/preauth-cron.yml` runs hourly and **targets production only** (the
`PREAUTH_ENDPOINT` default is `servi-preauth.onrender.com`).

- To exercise the cron against **staging**, use **Run workflow** (workflow_dispatch) and set the
  `endpoint` input to the staging base URL (e.g. `https://servi-staging.onrender.com`). Leave it
  blank for the normal production run.
- `force=true` bypasses **only** the 24h window bounds (handy for testing); all eligibility filters
  still apply.
- The dispatch uses `STAGING_ADMIN_API_TOKEN` when the endpoint is `https://servi-staging.onrender.com`;
  otherwise it uses `ADMIN_API_TOKEN`. If the staging secret is missing or does not match Render's
  staging `ADMIN_API_TOKEN`, the override will 401.

## Defense-in-depth (in code, independent of the topology above)

Even with separate DBs, the backend stamps and filters by Stripe mode so a cross-mode order can never
be silently processed:

- **Stamp:** every order is written with `all_bookings.stripe_livemode` = the backend's own key mode
  at creation time. `NULL` = legacy rows created before this column existed.
- **Filter:** the preauth cron only selects rows where `stripe_livemode` matches the running backend's
  mode (or is `NULL`).
- **Skip-not-Decline:** if a cross-mode payment method still reaches Stripe, the cron logs it,
  reports `skipped: 'mode_mismatch'`, and leaves the order `Scheduled` — it is **not** marked
  `Declined` and no customer retry webhook fires.
