# SERVI Production Readiness Agent Brief

Use this file as the starting prompt/context for an overnight agentic loop on Ultracode/Fable.

## Recommended Launch Pattern

If using Claude Code:

```text
/model fable
/effort ultracode
```

Then start a goal-driven run:

```text
/goal Follow AGENT_PRODUCTION_READINESS.md and continue until docs/production-readiness-report.md says ready, npm run test:unit passes, node tests/preflight.mjs passes, npm run test:e2e passes, AGENT_PROGRESS.md has evidence for every acceptance criterion, and git branch --show-current is dev. Stop if blocked by credentials, destructive data changes, production deployment, or campaign sending approval.
```

Use `/workflows` to inspect active workflow progress if Ultracode starts dynamic workflows. Use `/loop` only for scheduled polling or as a backup. This repo also has `.claude/loop.md`, so a bare `/loop` will point back to this brief.

## Token And Usage Limit Strategy

Before starting the overnight run:

```text
/usage
/context
```

Use the highest-reasoning model/effort for diagnosis and orchestration, but do not spawn broad workflows until there is a concrete failing test or acceptance criterion to investigate. Prefer narrow workflow slices such as one flow, one file group, or one failing Playwright spec.

During the loop:

- Update `AGENT_PROGRESS.md` after every meaningful loop so work can resume even if the session hits a limit.
- Avoid pasting long logs into chat. Save reports to files and summarize the actionable failure.
- Use targeted tests first, then broad tests after the targeted failure passes.
- Use `/workflows` to monitor workflow token usage and stop runaway workflows.
- Run `/compact focus on current production-readiness status, modified files, failing tests, and next verification command` if context gets noisy.

If Claude Code hits an account usage limit:

- Do not start over from scratch.
- Wait until the limit resets.
- Resume from the same repo directory with `claude --continue` or `claude --resume`.
- The active `/goal` should carry over when the same session is resumed, but the turn count/timer/token-spend baseline resets.
- Read `AGENT_PROGRESS.md` and continue from the next unchecked criterion.

Do not rely on automatic restart after an account usage limit. Treat `AGENT_PROGRESS.md` and `docs/production-readiness-report.md` as the durable handoff.

## Mission

Make the SERVI webapp and admin dashboard production-ready on the `dev` branch.

Production-ready means the app can safely accept real users who create accounts, request services, complete the intended Stripe test-mode payment/preauth flow, and have those requests visible and actionable from `frontend/admin.html`.

## Hard Boundaries

- Work only on branch `dev`.
- Abort immediately if `git branch --show-current` is not exactly `dev`.
- Do not merge to `main`.
- Do not deploy to production.
- Do not use or expose production Stripe, Firebase, database, email, or admin credentials.
- Do not commit `.env`, logs, reports with secrets, screenshots with secrets, or generated browser traces containing tokens.
- Do not rewrite the architecture unless a failing production-readiness criterion cannot be fixed locally within the existing structure.
- Do not delete user data, run destructive migrations, or reset the dev database without explicit human approval.
- Use unique test data prefixes such as `agent-e2e-` and clean up test-only records when possible.

## Current Test/Browser Setup

- Playwright is already installed through `@playwright/test`.
- Chromium launches locally.
- Existing scripts:
  - `npm run test:unit`
  - `npm run test:e2e:install`
  - `npm run emulators:auth`
  - `npm run start:auth-emulator`
  - `npm run test:e2e`
- Existing E2E suites:
  - `tests/auth-e2e.spec.js`
  - `tests/admin-e2e.spec.js`
- Existing preflight:
  - `tests/preflight.mjs` checks Firebase Auth Emulator on `127.0.0.1:9099` and local backend on `localhost:4242`.

If Playwright browser launch fails, run:

```bash
npm run test:e2e:install
```

## Required Local Services

Run these in separate terminals or workflow processes:

```bash
npm run emulators:auth
```

```bash
npm run start:auth-emulator
```

Then verify:

```bash
node tests/preflight.mjs
```

For Stripe webhook behavior in local dev, use the Stripe CLI in test mode when validating payment/preauth webhooks:

```bash
npm run stripe:listen
```

or, when the backend is not already running:

```bash
npm run dev
```

## Loop Protocol

Each loop must follow this order:

1. Confirm branch and working tree.
2. Read the relevant code and tests before changing anything.
3. Convert any unverified production requirement into a repeatable test or an explicit manual smoke-test checklist item.
4. Run the narrowest relevant test and capture the failure.
5. Make the smallest targeted fix.
6. Re-run the failing test.
7. Run the broader suite once the narrow test passes.
8. Update `AGENT_PROGRESS.md` with commands, results, decisions, and remaining risks.

Do not keep making random changes after repeated failures. If the same failure survives two targeted fix attempts, isolate the minimal reproduction, document the blocker in `AGENT_PROGRESS.md`, and move to the next independent criterion.

## Required Verification Commands

Run these before declaring readiness:

```bash
git branch --show-current
npm install
npm run test:unit
node tests/preflight.mjs
npm run test:e2e
```

Also run targeted E2E checks while iterating:

```bash
npx playwright test tests/auth-e2e.spec.js --project=chromium-desktop
npx playwright test tests/admin-e2e.spec.js --project=chromium-desktop
npx playwright test tests/admin-e2e.spec.js --project=chromium-mobile
```

If a build script is added or already exists later, it must be included in the final verification.

## Production Readiness Acceptance Criteria

All of these must be either automated by tests or covered by a documented smoke-test result:

- Visitor can open the webapp without console-breaking runtime errors.
- Visitor can browse/select a service path.
- User can create an account using the supported auth flows.
- User can log in, refresh, and remain authenticated when expected.
- User can log out and protected user state is cleared.
- User can submit a service request with required details.
- Invalid service request input shows clear validation errors.
- Duplicate/resume behavior does not create duplicate requests.
- Stripe test-mode preauth/payment flow works for the intended service request path.
- Stripe webhook updates the dev backend state as expected.
- User-facing order/request state is visible after submission.
- Admin auth gate protects `frontend/admin.html`.
- Invalid admin token is rejected.
- Valid admin access shows the dashboard.
- Admin can see incoming web requests/orders.
- Admin can open request/order details.
- Admin can create or manage the expected payment/preauth action from the dashboard.
- Admin can update or act on request/order status where the product requires it.
- Admin dashboard works on desktop and mobile Playwright projects without layout-breaking overlap.
- Unauthenticated callers cannot access protected backend APIs.
- Browser console has no uncaught errors in the core tested flows.
- No secrets are exposed in frontend code, logs, reports, or committed files.

## Files To Treat As Core Surface

- `frontend/admin.html`
- `frontend/service.html`
- `frontend/account.html`
- `frontend/shared/shared-auth.js`
- `frontend/shared/shared-active-order.js`
- `backend/index.mjs`
- `backend/*.mjs`
- `tests/auth-e2e.spec.js`
- `tests/admin-e2e.spec.js`
- `tests/preflight.mjs`
- `playwright.config.js`
- `package.json`

## Progress Ledger Requirements

Maintain `AGENT_PROGRESS.md` continuously. Each update must include:

- Current branch.
- Current objective.
- Commands run.
- Pass/fail result.
- Files changed.
- Root cause for each fixed issue.
- Remaining risks or blockers.
- Next planned loop.

## Final Readiness Report

Before stopping, create or update `docs/production-readiness-report.md` with:

- Final test command results.
- E2E flows proven.
- Manual smoke checks performed.
- Known gaps.
- External services checked.
- Deployment risks.
- Recommendation: ready or not ready to promote from `dev` to `main`.

Do not mark the project ready unless all required verification commands pass and every acceptance criterion has evidence.

## Post-Readiness Marketing Gate

Only after the final readiness report says `ready`, you may draft marketing assets. Do not send emails, DMs, ads, SMS, WhatsApp messages, or spend money without explicit human approval.

Allowed post-readiness output:

- `docs/marketing-launch-plan.md`
- landing page copy suggestions
- outreach email drafts
- ad copy drafts
- lead qualification criteria
- manual launch checklist

Not allowed without approval:

- contacting leads
- scraping personal data
- uploading audiences
- starting paid campaigns
- posting publicly
- changing production DNS or deployment settings
