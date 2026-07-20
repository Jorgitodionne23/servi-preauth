# Interop — Customer app ↔ Partner app ↔ SERVI backend

How the three sides line up: the two Expo prototypes (`native-app-reference` = customer,
`partner-app-reference` = specialist) and the real `backend/`. This is the production spec
for making either prototype real, and the contract that keeps them telling **one story**.

---

## 1. The two prototypes tell one story

Both apps ship **intentionally overlapping fixtures**. The logged-in specialist in the
partner app is **Pablo Méndez** (`prov-000117`), who is also the specialist shown on order
`SV-204701` in the customer app.

| Order | Customer app sees | Partner app sees | Why this pairing |
|---|---|---|---|
| `SV-204815` | `pending` — payment link sent, no specialist yet | **Offer**, payment *not yet held* | Admin matches a specialist before the client finishes authorizing. The offer card honestly says the hold isn't in place yet. |
| `SV-204766` | `confirmed` — card pre-authorized, unassigned | **Offer**, payment **held** | The hold exists, so the offer can promise a guaranteed payment. Exercises the opposite state of the same card. |
| `SV-204701` | `assigned` to Pablo Méndez, today 17:30 | **Today's accepted job** | The centerpiece. Check in on the partner side and you're firing exactly the events that drive the customer's live timeline. |

Pablo's remaining jobs (`SV-2047xx`, `SV-2046xx`, `SV-2045xx`) use IDs the customer app
never shows. That's correct, not an oversight: the customer prototype is **one client's**
view (Mariana's), and Pablo works for many clients.

### Pricing is now three-way identical

Both apps compute money with a **faithful port of `backend/pricing.mjs`** —
`native-app-reference/src/data/pricing.ts` and `partner-app-reference/src/data/pricing.ts`
are **byte-identical** to each other and numerically identical to the backend. All amounts
are **centavos**. The one invariant the whole product rests on:

```
providerAmountCents === Math.round(providerPricePesos * 100)
```

The specialist keeps 100% of their quoted price; SERVI's booking fee, Stripe's processing
fee and VAT are added *on top* and paid by the client. If the alpha curve ever changes in
`backend/pricing.mjs`, change **both** ports too. (The customer app's old rough `price()`
helper is gone.)

The customer breakdown mirrors what the live web app shows on `frontend/success.html`:
a single "Precio del servicio" line (provider + booking fee + VAT), a "Comisión por
procesamiento" line, and an "*IVA incluido" note — the booking fee is not itemized to the
customer. The partner app shows the itemized "you earn / SERVI fee / client pays" view.
Both agree on the two anchor numbers (provider amount, client total).

### Both apps share one frozen, timezone-fixed clock

`src/data/time.ts` is **byte-identical** in both apps and pins `DEMO_NOW` to 2026-06-23. All
wall-clock math is computed against a **fixed CDMX offset (UTC−6)** — matching
`backend/timezone.mjs`, which pins the server to `America/Mexico_City`. This is deliberate:
an earlier version used local-time `setHours`/`getHours`, so the two apps only agreed when
the reviewer's machine happened to be UTC-6. Now they produce identical instants and labels
on any machine (verified under `TZ=UTC`, `TZ=America/Mexico_City`, `TZ=Asia/Kolkata`). Offer
countdowns are the one exception — real clock, so the accept-or-lose-it pressure is genuine.

---

## 2. Vocabulary mapping

Every prototype type traces to something that already exists on the backend.

| Prototype type (`src/data/types.ts`) | Backend source of truth |
|---|---|
| `Specialist` (partner) | `providers` table — `provider_id`, `status`, `name`, `phone`, `email`, `specialty`, `city` |
| `Specialist` (customer) | the MASKED projection from `GET /api/auth/orders` — `providerId` + `maskProviderName()` only |
| `Specialist.providerId` | `providers.provider_id`, the `prov-NNNNNN` sequence |
| `Job` / `Order` | `all_bookings` row, projected per side (provider-safe vs owner-safe) |
| `Job.id` / `Order.id` | `all_bookings.public_code` — the same `SV-NNNNNN` both sides see |
| `ServicePhase` / `JobPhase` | `order_lifecycle_events.event_type` ∈ `MILESTONE_EVENTS` — **exact strings** `en_route \| arrived \| started \| completed` |
| `Order.phaseTimes` (customer) | the same milestone timestamps the specialist writes via `POST /api/provider/checkin` |
| `Job.paymentHeld` | derived from `all_bookings.status === 'Confirmed'` (hold placed) |
| `Specialist.providerRating` (both) | rolled up from `service_ratings` — % positive thumbs, NOT stars (see §3) |
| `PriceChangeType` | backend `PRICE_CHANGE_TYPES` set — **exact strings**, do not translate the keys |
| `MaskedClient` / masked `Specialist` | `maskProviderName()` + hand-picked field lists — first name + initial, no contact |
| `PayoutAccount.connectAccountId` | `providers.connect_account_id` (Stripe Connect) |
| `TradeKey` / `CategoryKey` | shared category vocabulary, no translation layer |
| `Job.client.trustsYou` / `Order.specialist.trusted` | `user_trusted_specialists` (user_id, provider_id, category) |

### The privacy rule, inherited by BOTH sides

The specialist never sees the client's phone, email, or full name. **Symmetrically, the
customer never sees the specialist's full name** — the customer app shows the masked
`maskProviderName()` form ("Pablo M."), which the backend already returns from
`GET /api/auth/orders` (both `providerName` and `providerMaskedName` are masked there). A
prototype that showed full names would become a live anti-disintermediation regression when
copied into production. If a field isn't on the backend's owner/provider projection, it
isn't in the type.

---

## 3. Backend routes: what exists, what's needed

### ✅ Already built

| Route | Used by | Notes |
|---|---|---|
| `GET /api/provider/order` | partner | Job detail hydration (token-gated) |
| `POST /api/provider/checkin` | partner | The milestone stepper (writes `service_phase`) |
| `POST /api/provider/location` | partner | One-shot location share |
| `POST /api/provider/price-change` | partner | Records the request, returns the `computePricing` preview |
| `GET /api/auth/orders` | customer | Orders + `policy` + `pricing` + `servicePhase` + masked provider |
| `POST\|GET /api/auth/orders/:id/rating` | customer | 👍/👎 rating (there is no star rating in this system) |
| `GET/POST/PATCH/DELETE /api/auth/trusted-specialists` | customer | Trusted-specialist CRUD with in-SERVI trust stats |
| **`GET /api/auth/providers/:providerId/rating`** | customer/partner | **NEW.** Aggregate satisfaction rolled up from `service_ratings` — `{ providerId, count, positivePct, display }`. % positive over a count (NOT stars); `display:'new'` below a cold-start floor of 5 ratings. Read-only, session-gated. |

### 🔨 Needs building

| Route | Purpose | Notes |
|---|---|---|
| `GET /api/auth/orders/:id/lifecycle` | **Customer live timeline.** Return the `order_lifecycle_events` for an owned order so the customer app's on-site `PhaseTimeline` reads real check-ins, not just the single `servicePhase` string. | The table already anticipates `channel='account'`; this is a customer-scoped read over columns that are already written. The customer prototype models `phaseTimes` locally in the meantime. |
| `POST /api/auth/orders/:id/tip` | **Tips.** Charge an optional post-service tip off-session (or a fresh PaymentIntent) and transfer **100% to the provider**. | Greenfield — no tip column/route today. Needs a `tips` table (or a fee-free adjustment child) and a partner-earnings surface so a tip shows up on the specialist side. The customer prototype models tips locally (`Order.tipCents`). |
| `POST /api/provider/auth/otp` + `/verify` | Provider phone OTP sign-in | Reuse the Firebase phone flow; issue a provider-scoped session JWT. |
| `GET /api/provider/me`, `PATCH /api/provider/me` | Specialist profile / trades / availability / coverage / duty | Aggregates `providers` + `service_ratings` + `user_trusted_specialists`; needs the columns/tables in §4. |
| `GET /api/provider/jobs`, `POST /api/provider/jobs/:id/accept\|/decline` | Offers, replacing the per-order token | Accept must be race-safe; sets `all_bookings.provider_id`. |
| `GET /api/provider/earnings`, `GET /api/provider/payouts`, `POST /api/provider/payouts/instant` | Money surfaces | Earnings derivable from `all_bookings` today; payouts need §4 + Stripe Connect. |
| `POST /api/provider/onboarding` | Self-serve recruitment | Feed the existing `partner_applications` table + admin Inbox. |

### The auth change that unblocks the partner app

Today the provider surface is authenticated by a **per-order token** (`pt` in the URL,
expiry in `backend/providerLink.mjs`). A real app needs a **provider session** — the same
HS256 JWT pattern the customer side uses (`POST /api/auth/firebase` → 24h token,
`revoked_sessions` for logout), scoped to `provider_id`. This **does not break** the
existing `provider.html` link flow — keep both.

---

## 4. Schema additions (partner app)

```sql
-- Provider auth + app state
ALTER TABLE providers ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS on_duty BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'nuevo';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS coverage_zones TEXT[];
ALTER TABLE providers ADD COLUMN IF NOT EXISTS coverage_radius_km INTEGER DEFAULT 10;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS accepts_asap BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS rfc TEXT;
CREATE INDEX IF NOT EXISTS idx_providers_firebase_uid ON providers(firebase_uid);

CREATE TABLE IF NOT EXISTS provider_trades (
  provider_id TEXT NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
  trade_key   TEXT NOT NULL,
  skill_key   TEXT,
  PRIMARY KEY (provider_id, trade_key, skill_key)
);

CREATE TABLE IF NOT EXISTS provider_availability (
  provider_id TEXT NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
  weekday     SMALLINT NOT NULL,   -- 0=Mon
  enabled     BOOLEAN NOT NULL DEFAULT true,
  from_time   TIME NOT NULL,
  to_time     TIME NOT NULL,
  PRIMARY KEY (provider_id, weekday)
);

CREATE TABLE IF NOT EXISTS provider_documents (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
  doc_key     TEXT NOT NULL,       -- id_front|id_back|selfie|address_proof|certification
  status      TEXT NOT NULL DEFAULT 'uploaded',
  file_url    TEXT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_offers (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES all_bookings(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'offered',  -- offered|accepted|declined|expired
  expires_at  TIMESTAMPTZ NOT NULL,
  responded_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_offers_open
  ON provider_offers(provider_id, status, expires_at);

CREATE TABLE IF NOT EXISTS provider_payouts (
  id              TEXT PRIMARY KEY,
  provider_id     TEXT NOT NULL REFERENCES providers(provider_id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL,
  fee_cents       INTEGER NOT NULL DEFAULT 0,
  instant         BOOLEAN NOT NULL DEFAULT false,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|in_transit|paid|failed
  stripe_payout_id TEXT,
  arrives_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_payout_items (
  payout_id TEXT NOT NULL REFERENCES provider_payouts(id) ON DELETE CASCADE,
  order_id  TEXT NOT NULL REFERENCES all_bookings(id),
  amount_cents INTEGER NOT NULL,
  PRIMARY KEY (payout_id, order_id)
);
```

---

## 5. Payouts — the one genuinely new system

Everything else is a new surface over data SERVI already has. Payouts are new capability,
and the reason to use **Stripe Connect** (`providers.connect_account_id` is already reserved
for this):

- **Express accounts** — Stripe hosts identity/bank onboarding (offloads KYC + Mexican
  banking). The CLABE/RFC step becomes a Connect onboarding handoff, not a form SERVI stores.
- **Separate charges and transfers** — SERVI keeps taking the full charge on the platform
  account (the existing pre-auth/capture flow is untouched), then transfers the provider
  amount after capture. Do *not* restructure into destination charges — that would disturb
  the working `manual_capture` model in `CLAUDE.md`.
- **Weekly automatic payouts**, Monday, free. Instant on demand at ~1.5% (waived at
  `oro`/`elite`, which is what makes the tier ladder mean something).
- **Trigger on capture** — provider money becomes `available` when the client's
  PaymentIntent is captured, already a webhook SERVI handles.
- **Approved adjustments ride along** with the parent job's payout.

---

## 6. Files that must stay byte-identical

The two prototypes share a design system and several data modules **by copy**, not by a
shared package (see the customer README for why a Metro/workspace extraction was rejected).
`scripts/check-app-sync.mjs` sha256-compares them and fails on drift — run
`npm run check:sync` from either app, and in CI. The guarded set:

```
src/theme/tokens.ts        src/theme/typography.ts        src/i18n/I18nContext.tsx
src/data/pricing.ts        src/data/time.ts
src/components/ui/*.tsx     (all 16: Badge, BottomSheet, Button, Card, Chip, Icon,
                             InfoCard, Input, LangToggle, Pressable, Rows, Screen,
                             SegmentedControl, ServiLogo, States, Text)
```

If you change any of these in one app, copy it to the other in the same commit. `theme/
partner.ts`, `theme/format.ts`, and each app's `strings.ts`, `types.ts`, `mockData.ts`, and
screens are intentionally per-app and NOT in the guarded set.

---

## 7. Suggested build order (partner app)

1. **Provider session auth** — nothing else is reachable without it.
2. **`GET /api/provider/me` + `/jobs`** — read-only app over existing data; ships alone as a
   schedule + history.
3. **Offers + accept/decline** — removes the admin from matching. Biggest operational win.
4. **Onboarding → `partner_applications`** — self-serve recruitment.
5. **Stripe Connect + payouts** — removes the admin from paying people.

Steps 1–3 are a meaningful product on their own and need no new money infrastructure.
