# Implementation Plan

This file is the active execution board for new changes, fixes, implementations, and plans.

## Current Objective

Auth USL redesign deployed. Next: QA sessions + design system overhaul.

## In Progress

- [ ] Deploy to Render (auto-deploys on push to main) and verify R2 upload endpoint works
- [x] QA order detail panel in admin — **audited 2026-04-07, all 5 checks pass** (see audit notes below)
- [ ] QA providers tab in admin
- [ ] QA custom-first booking flow on mobile

## Planned Next

- [ ] **QA Session 2 — Country Code UX** — Phone field: reorder country picker, dropdown trigger behavior, Mexico (+52) default pre-selected, test on iOS + Android
- [ ] **QA Session 3 — Design System Overhaul** — Augen.pro editorial minimalism style: typography scale, spacing, component tokens; update shared-styles.css and landing/booking panels
- [ ] **Manual user testing** — Full end-to-end on real iOS/Android devices: phone OTP, email magic link, Google OAuth, booking gate (both `email_required` + `phone_required` paths), account management
- [ ] Fix any bugs found during manual QA (batch fix after user reports)
- [ ] VirusTotal malware scanning on uploads (Phase 3A hardening)
- [ ] Admin order detail: web submission attachments visible in panel
- [ ] **Booking gate inline UI** — Frontend HTML in `index.html` step 3 needs inline email/phone collection + OTP entry (backend endpoints `add-email`/`add-phone` exist; only frontend UI is missing)
- [ ] **Playwright test suite update** — `tests/03-auth-otp.spec.js` test 3.3 expects name+email on same screen; new flow separates them; `injectFakeSession` needs `phone_verified`/`email_verified` in mock user

## Completed (Recent)

### 2026-04-11 — Auth USL Redesign (phone-first unified sign-up/login)

- ✅ **Unified identifier input** — single phone/email field, auto-detects @ for email mode, country picker hides on email entry
- ✅ **Single `renderOTPScreen(type, isLogin)`** — replaces 3 former OTP/signup screens; handles phone SMS + email magic link in one component
- ✅ **Name collection post-OTP** (`renderNameCollectionScreen`) — first + last name required after primary OTP, before secondary identifier
- ✅ **Optional secondary identifier** (`renderSecondaryIdentifierScreen`) — email skip → `servi_email_skipped=1`; phone skip → `servi_phone_skipped=1`
- ✅ **Cross-identifier recovery** — `POST /api/auth/resolve-identifier-mismatch` detects orphaned phone-only accounts; name-validation + phone OTP merge flow
- ✅ **Booking gate enforcement** — `POST /api/service-requests` returns 409 `email_required` / `phone_required` for users missing verified identifiers
- ✅ **7 backend endpoints added/modified:** `check-identifier` (+ `provider` field), `firebase` (accepts + returns `phone_verified`/`email_verified`/`first_identifier_type`), `me` GET + PATCH (+ verification flags), `add-email`, `add-phone`, `resolve-identifier-mismatch`, `service-requests` (+ gate)
- ✅ **7 localStorage keys:** `servi_user_session` (updated), `servi_email_skipped`, `servi_phone_skipped` (new), `servi_usl_state` (new), `servi_email_link_target`, `servi_recovery_mode`, `servi_pending_logout`
- ✅ **DB schema:** `phone_verified BOOLEAN`, `email_verified BOOLEAN`, `first_identifier_type VARCHAR(10)` added to `auth_users`; backfill SQL for existing phone and Google/email users
- ✅ **Code-Simplifier pass:** `normalizeEmail()` applied in `resolve-identifier-mismatch`; `_candidate_id` removed from public response
- Files: `frontend/shared/shared-auth.js` (full rewrite, ~950 lines), `backend/index.mjs`, `backend/db.pg.mjs`
- Spec: `docs/specs/2026-04-11-auth-usl-redesign.md`

### 2026-04-08 — Phase 2.5 (Auth stabilization + Playwright test suite)

- Fixed `account.html` delete account modal (no error feedback → now shows error message on failure)
- Fixed `account.html` i18n event name (`servi-lang-change` → `langchange`) — full EN translation was silently broken
- Extended `applyTranslations()` to cover input placeholders and success message spans
- Added 45 automated Playwright tests (`tests/`) covering landing, booking, auth modal structure, account page, session, and pages — all passing
- Test infrastructure: `playwright.config.js`, `tests/helpers.js` (fake session injection + Firebase SDK mock via route intercept)
- Auth bugs identified via plan-mode analysis: token not stored in `syncWithBackend`, stale session not cleared — fixes pending deployment

### 2026-04-07 — Phase 3 (3C + 3B + 3A)

**Phase 3C — Order detail side panel**

- Clicking any order row in admin.html opens a slide-in side panel
- Shows: customer info, service, pricing breakdown (provider/fees/VAT/total), Stripe PI ID, link to Stripe Dashboard, adjustments list, Capture/Cancel/Refund action buttons
- Panel auto-refreshes after capture/cancel/refund actions
- Files: `frontend/admin.html`

**Phase 3B — Providers tab + registro.html improvements**

- New "Proveedores" tab in admin dashboard (separate from Inbox)
- Shows all partner applications with search + status filter
- Click row → side panel with applicant details, status dropdown, admin notes textarea + save, WhatsApp contact button
- Partner applications removed from Inbox (now only in Providers tab)
- `registro.html`: "Otro" specialty with free-text input, multi-service checkboxes, coverage areas field
- Files: `frontend/admin.html`, `frontend/partners/registro.html`, `backend/index.mjs`, `backend/db.pg.mjs`
- DB: Added `services TEXT`, `coverage_areas TEXT` to `partner_applications`

**Phase 3A — Custom-first booking flow + R2 media capture**

- Step 1 redesigned: free-text description first, media capture (📷 photo / 🎥 video / 🎙 audio), collapsible category cards
- Mobile: uses `capture="environment"` for native camera/mic access
- Audio: MediaRecorder API with 2-min limit, real-time timer on button
- Video: 60-second limit enforced client-side via metadata read
- Upload endpoint: `POST /api/uploads` → validates type/size → stores in Cloudflare R2
- Admin order detail panel shows image thumbnails, video/audio links for attachments
- Category selection now optional (defaults to 'custom' if none selected)
- Files: `frontend/index.html`, `backend/index.mjs`, `backend/db.pg.mjs`
- DB: Added `attachments TEXT` to `service_requests`
- Packages added: `multer`, `@aws-sdk/client-s3`
- Env vars needed on Render: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`

## Bugs / Hotfix Queue

### Medium priority (from Auth USL implementation, 2026-04-11)

- [ ] **Booking gate — no inline UI** (`index.html`, medium) — Backend enforces `email_required`/`phone_required` at step 3 but `index.html` doesn't yet render the inline verification form. Confirm button silently fails. Expected: inline email/phone + OTP entry appears. Fix: add booking gate HTML+JS to step 3 panel (~2–3 hours)
- [ ] **Playwright test 3.3 regression** (`tests/03-auth-otp.spec.js`, low) — Test expects `#signup-name` and `#signup-email` on same screen; new flow separates them (name screen after OTP, email screen later). Expected: test passes. Fix: update assertions + add `phone_verified`/`email_verified` to `injectFakeSession` mock (~1 hour)
- [ ] **`resolve-identifier-mismatch` — no phone filter** (`backend/index.mjs`, medium) — Query returns first phone-only account by insertion order if multiple orphans exist. Could merge wrong account in edge case. Expected: filter by candidate phone. Current blocker: phone not known at this step in the flow — needs UX decision on whether to collect phone before calling this endpoint (~30 min to decide + implement)
- [ ] **Email magic link OTP UI** (`shared-auth.js`, low) — Email path shows "check your inbox" instead of 6-box code entry. Some users may expect a code. Currently working correctly per Firebase capability (email OTP codes not supported by Firebase natively) — document as intentional UX decision if confirmed

### Low priority (from Phase 3C audit, 2026-04-07)

- [ ] No HTML escaping on interpolated fields in order detail panel (low risk — admin-only)
- [ ] No `Escape` key handler to close side panels
- [ ] Attachments column exists on `service_requests` but not `all_bookings` — admin panel attachments section only renders for web intake orders, not Stripe payment orders

## User Feedback -> Product Changes

- [ ] Add validated learning and resulting changes here

## Blocked / Needs Decision

- [ ] VirusTotal API key (optional hardening for file uploads — skipped for MVP)

## Archived Baseline (Do Not Edit)

---

name: Implementation Plan — Phases 1, 2, 3 (Complete Roadmap)
description: Detailed step-by-step plan for quick wins, Firebase migration, and booking/provider redesign
type: project

---

# SERVI Production Readiness — Implementation Plan

## Project Status

- ✅ **Phase 1:** COMPLETE
- ✅ **Legal Pages:** LIVE (Google Doc embeds + tab/anchor behavior present)
- ✅ **Phase 2 Core Build:** IMPLEMENTED (Firebase auth + account features)
- 🔄 **Phase 2.5:** STABILIZATION / QA HARDENING (current priority)
- 📋 **Phase 3:** PLANNED (booking + provider redesign scope)

## Decision Snapshot

- Auth platform: **Firebase** (Email/Password, SMS OTP, Google)
- Booking direction: **Custom-first intake** — custom is the primary CTA, categories are secondary suggestions
- Provider management direction: **Separate admin tab** (not in Inbox) with full detail view
- Admin primary interface: **`admin.html`** — Google Sheets is legacy/backup, not a dependency
- Legal delivery: **Embedded docs in legal page** is live; keep anchor consistency for auth copy

---

## PHASE 1 (COMPLETED): Quick Wins

### Implemented Outcomes

- Report/suggestion flows now have improved success UX.
- Logged-in user prefill behavior was added where applicable.
- Navbar visual/ordering refinements were applied.
- Partner CTA differentiation was applied.
- Shared auth modal was propagated across public pages.

### Notes

- Treat Phase 1 as closed.
- Any additional tweaks here should be tracked as defects, not roadmap work.

---

## Legal & Compliance Checkpoint (Now QA, not blocker)

Legal is no longer a pre-Phase-2 blocker. Keep as ongoing QA:

1. Confirm legal tab/anchor targets used by auth copy remain correct.
2. Confirm legal content links still load correctly in production.
3. Confirm signup terms text and links match legal section names.

---

## PHASE 2 (IMPLEMENTED): Firebase Auth + Account Management

### Current Architecture (Live)

- Frontend auth uses Firebase.
- Backend sync endpoint: `POST /api/auth/firebase`.
- Account endpoints are live for:
  - Profile (`/api/auth/me`)
  - Password changes
  - Addresses CRUD
  - Payment methods management
- Account page exists: `frontend/account.html`.

### Removed from Plan (Outdated Items)

- ❌ Do not replace auth with `/api/auth/verify-token` flow.
- ❌ Do not remove existing auth/account endpoints as a migration task.
- ❌ Do not treat payment methods or account page as "future" features.
- ❌ Do not plan links to non-existent `profile.html` / `orders.html` pages.

---

## Phase 2.5 (Stabilization Sprint)

Goal: improve reliability/consistency of already-implemented auth/account flows.

1. **Session consistency QA**
   - Validate Firebase session state vs backend-authenticated requests.
   - Ensure navbar/account behavior is consistent after refresh/login/logout.
2. **Auth flow QA**
   - Validate email/password, phone OTP, Google across desktop/mobile.
   - Validate error handling and localized messages.
3. **Account page QA**
   - Validate profile edits, password changes, addresses CRUD, payment method actions.
4. **Legal/auth linkage QA**
   - Ensure terms/privacy links from auth UX are correct and stable.
5. **Observability**
   - Add/verify actionable logging around auth sync failures.
6. **End-to-end testing**
   - Full signup → login → booking → account management flow verified.

Estimated effort: **8-12 hours** (depends on defect count discovered during QA).

---

## PHASE 3 (PLANNED): Booking & Provider Redesign

Goal: evolve intake and provider operations without breaking payment/order infrastructure.

---

### 3A — Booking Flow Redesign (Custom-First)

#### Core Direction

The booking modal is **custom-first**, not category-first. Custom is the primary path. Categories are secondary suggestions for users who already know what they want.

#### Flow

1. Landing page CTA opens the booking modal with a **custom input** at the top:
   - Free text description
   - Optional image/video/voice upload
   - Messaging: _"Describe tu necesidad (con imágenes, video o voz) — nuestro sistema inteligente asignará al especialista correcto."_
2. Below the custom input, show **5 collapsible category cards** (like Uber Eats suggestions):
   - Each category card expands to show 5–10 service examples
   - Selecting a specific service triggers **dynamic detail questions** for that service type (not a static 5-step form)
3. After input (custom or category-based), collect:
   - Timing: "Lo antes posible" or schedule date/time
   - Address
   - Contact info (name + phone required; email optional)
4. Review + confirm → `POST /api/service-requests`
5. Confirmation: "¡Solicitud enviada! Te contactaremos pronto por WhatsApp."

#### Media Uploads

- Image/video/voice upload feeds into "AI diagnosis" claim
- Attachments (or transcripts) surface in admin dashboard order row
- Storage/security strategy must be decided before implementation

#### Impact

- Major redesign — affects `frontend/index.html` (booking modal), `backend/index.mjs` (service-request schema), `frontend/admin.html` (order detail view)
- Dynamic detail questions require a question config per service type
- Anti-abuse controls needed on richer intake forms

---

### 3B — Provider Onboarding Redesign

#### Core Direction

Provider applications are a distinct workflow from reports/suggestions. They get their **own "Providers" tab** in the admin dashboard — not merged into Inbox.

#### Admin Dashboard: Providers Tab

**List view:**

- Name, specialty, status badge (Pending / Verified / Suspended / Rejected), date applied
- Action buttons: View, Contact via WhatsApp, Approve, Reject

**Detail view (per provider):**

- **Overview:** Name, phone, specialty, coverage areas, join date, rating/stats
- **Documents:** ID, certification, insurance, background check — each with upload status and verification toggle
- **Orders:** All orders completed by this provider (customer, service, amount, rating)
- **Notes:** Admin interview notes, reason for status, timestamp

**WhatsApp contact:** Pre-built message template in detail view — admin clicks to open WhatsApp.

#### Partner Registration Form Improvements

- **Specialty field:** Add "Otro" option that opens a free-text input
- **Services offered:** Allow user to add multiple services (not just one)
- **Coverage areas:** Add input for neighborhoods/areas within their city
- **City field:** Remains

#### File Impact

- `frontend/admin.html` — new Providers tab, list view, detail view
- `frontend/partners/registro.html` — multi-service, coverage areas, "Otro" specialty
- `backend/index.mjs` — provider CRUD endpoints if needed
- `backend/db.pg.mjs` — possible schema changes (services array, coverage, documents status)

---

### 3C — Admin Dashboard: Orders Tab Enhancements

- Clicking an order row opens a **full detail panel** (not just action buttons):
  - Customer info, service description, all attachments (images/video/transcript if Phase 3A done)
  - Pricing breakdown, PI status, consent audit
  - Action buttons: Capture, Cancel, Refund, View in Stripe
- All-bookings rows that came from web intake (WEB-...) are visually distinct

---

## Constraints (Must Preserve Across All Phases)

1. Existing preauth payment flows (`pay.html`, `book.html`, `success.html`, `save.html`)
2. Existing admin order capture/cancel/refund behavior
3. Existing backend payment orchestration and webhook reliability
4. Google Sheets integration code stays in place but is not a new-feature dependency

---

## Status Vocabulary Standard (Use Consistently)

- Reports/Suggestions: `new` → `reviewed` → `resolved`
- Partner applications: `pending` → `reviewed` → `verified` / `rejected`
- Provider (Phase 3): `pending` → `verified` / `rejected` / `suspended`

Avoid reintroducing stale values like `in_review` or `contacted` unless code is explicitly updated.

---

## Risks / Open Design Decisions

1. Attachment storage strategy and retention policy (Phase 3A blocker)
2. Anti-abuse controls for richer intake forms
3. Dynamic question config per service type — data structure decision needed
4. Whether `providers` table expands with `suspended` status now or deferred
5. Scope of document upload/verification in provider detail view (MVP vs full)

---

## Updated Timeline

| Phase     | Scope                                  | Est. Time   |
| --------- | -------------------------------------- | ----------- |
| Phase 1   | Quick wins                             | Complete    |
| Phase 2   | Firebase + account core                | Complete    |
| Phase 2.5 | Stabilization + QA hardening           | 8–12 hours  |
| Phase 3A  | Booking flow redesign (custom-first)   | 12–18 hours |
| Phase 3B  | Provider admin tab + registration form | 10–15 hours |
| Phase 3C  | Orders tab detail panel                | 4–6 hours   |

---

## Recommended Execution Order

1. **Phase 2.5 first** — stabilize implemented auth/account behavior.
2. **Phase 3C** — order detail panel (low-risk, high admin value, no schema changes).
3. **Phase 3B** — provider tab (schema decisions isolated, no booking flow risk).
4. **Phase 3A** — booking redesign last (largest scope, depends on storage decision).

---

## File Scope by Stage

### Phase 2.5 (Stabilization)

- `frontend/shared/shared-auth.js`
- `frontend/shared/shared-nav.js`
- `frontend/account.html`
- `frontend/index.html` (booking prefill/session behaviors)
- `backend/index.mjs` (auth/account consistency, logging)

### Phase 3A (Booking Redesign)

- `frontend/index.html` (booking modal — custom-first redesign)
- `backend/index.mjs` (service-request schema updates, attachment handling)
- `backend/db.pg.mjs` (schema changes for attachments if approved)
- `frontend/admin.html` (order row detail view with attachments)

### Phase 3B (Provider Redesign)

- `frontend/partners/registro.html` (multi-service, coverage areas, "Otro" specialty)
- `frontend/admin.html` (new Providers tab, list + detail views)
- `backend/index.mjs` (provider CRUD endpoints if needed)
- `backend/db.pg.mjs` (providers table schema updates)

### Phase 3C (Orders Detail Panel)

- `frontend/admin.html` (order row click → detail panel)

---

## Next Step

Choose one:

1. Start **Phase 2.5 stabilization** checklist and execute fixes.
2. Lock **Phase 3A spec** (storage decision, question config structure, anti-abuse approach) before implementation.
3. Start **Phase 3B** (provider tab) — no external dependencies, can begin now.
