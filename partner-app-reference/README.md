# SERVI Partner — Specialist App (native)

The **SERVI specialist (Partner) app** for iOS/Android — the mirror of the customer app in
[`../native-app-reference`](../native-app-reference/README.md). Built with
**Expo + React Native + TypeScript** (expo-router).

> ✅ **Wired to the live backend.** Sign-in is Firebase phone OTP →
> `POST /api/provider/auth/firebase` (provider-scoped session JWT; only phones already
> registered in the `providers` table can sign in — everyone else is routed to the free
> application, which lands in the admin Inbox via `POST /api/provider/onboarding`). Jobs
> and offers poll `GET /api/provider/jobs`; accept/decline, check-ins, one-shot location
> share (expo-location) and price-change requests all hit the production routes. The
> legacy per-order `provider.html?pt=…` link keeps working unchanged.
>
> **Deferred to a later release:** Stripe Connect payouts — earnings are read-only
> (derived from captured orders) and instant cash-out stays disabled; SERVI pays weekly by
> hand as today. Push notifications (foreground polling for now), real document upload
> during onboarding, in-app job cancellation (goes through SERVI support).

## Production setup & release

1. **Firebase config files**: register iOS `mx.servi.partner` and Android
   `mx.servi.partner` apps on Firebase project `servi-bec91`; download
   `GoogleService-Info.plist` / `google-services.json` into this folder (gitignored).
2. **API target**: `EXPO_PUBLIC_API_URL` per profile in [eas.json](eas.json).
3. **Build**: `eas build --profile development|preview|production` (Expo Go can no longer
   run this app — @react-native-firebase and expo-location are native modules).
4. **Store prerequisites** (external): Apple Developer Program + ASC record and Play
   Console record for `mx.servi.partner`; a Firebase test phone number registered as a
   test provider on staging for App Review.
5. **Provider phone hygiene**: first login matches by E.164 phone against
   `providers.phone` — audit that column before launch (see `../INTEROP.md`).

---

## Why this exists

Today, SERVI specialists **have no accounts**. A provider is a row in the `providers`
table, and the only thing they ever touch is a per-order tokenized link
(`frontend/provider.html?pt=…`) that an admin generates by hand. They can't see their
schedule, can't see what they've earned, can't be paid without manual work, and have no
reason to feel attached to the platform.

This prototype designs the app that fixes that: a specialist signs up, gets verified,
receives job offers, works them, and manages their own money — **including payouts** —
without an admin in the loop.

It's also the answer to the platform's central commercial risk. A specialist and a client
who meet through SERVI can always agree to skip it next time. The app's response is not
enforcement, it's a value proposition made legible on every screen: guaranteed payment,
100% of your quoted price, clients you didn't have to find, and someone who backs you up
when something goes wrong. See [`src/app/why-servi.tsx`](src/app/why-servi.tsx).

---

## Run it

Prereqs: Node 18+ and npm (developed against Node 22.17).

```bash
cd partner-app-reference
npm install
npx expo start
```

### Testing without an Apple Developer / Google Play account

⚠️ **Expo Go no longer works here.** This app now depends on `@react-native-firebase/{app,auth}`
and `expo-location` — native modules Expo Go doesn't ship with. Phone sign-in will fail with
`firebase_unavailable` inside Expo Go. You need a **development build** instead, and neither
platform requires a paid account for that:

```bash
npx expo prebuild --clean
npx expo run:ios        # or: npx expo run:android
```

| Method | Needs a paid dev account? | Notes |
|---|---|---|
| **Android emulator or a sideloaded APK** | ❌ No | `eas build --profile development --platform android` → install the `.apk` on any emulator or real Android phone. No Play Console needed. |
| **iOS Simulator** | ❌ No | `npx expo run:ios` — free Apple ID is enough. Phone auth works via a **Firebase Console test phone number** (fixed OTP, no real SMS — see `../docs/AUTH_STAGING_SMOKE_TEST.md`). |
| **A real iPhone, via free Apple ID** | ❌ No (~7-day signing) | `npx expo run:ios --device`, sideloaded from Xcode with a free "Personal Team". Fine for solo testing. |
| **TestFlight / handing an `.ipa` to another tester's iPhone** | ✅ Yes | First real point requiring the $99/yr Apple Developer Program. |
| **Web browser** (`npm run web`) | ❌ No | Fast for UI iteration, but phone sign-in and location share don't work in a browser — use it for layout/flow review only, not a full login test. |

Serving a static web export locally needs a clean-URL server (`npx serve dist`), not a plain
directory server, or client-side routing will 404 on refresh.

---

## Recommended way to review it

Run **both apps side by side** — customer on the left, specialist on the right:

```bash
# terminal 1
cd native-app-reference && npx expo start --web --port 8081

# terminal 2
cd partner-app-reference && npx expo start --web --port 8082
```

Both apps talk to the same live backend, so this is now a real end-to-end demo, not a shared
fixture: submit a request from the customer app → find it in `admin.html`'s Inbox → offer it
to a test specialist → accept it in the partner app → tap **Voy en camino → Llegué → Empecé
el trabajo**, and watch those check-ins tick the customer's live timeline
(`GET /api/auth/orders/:id/lifecycle`) in the other window in real time.

---

## What you can click through

Spanish is the default; toggle ES/EN from the pill in any header.

| Area | Route | What it shows |
|---|---|---|
| **Today** | `app/(tabs)/index.tsx` | On/off-duty toggle, live job offers with draining countdowns, today's schedule, today's earnings. The verification gate replaces offers entirely when unverified. |
| **Jobs** | `app/(tabs)/jobs.tsx` | Available / Scheduled / History. |
| **Job detail** | `app/job/[id]/index.tsx` | Payment-guarantee card, milestone check-in stepper, masked client, one-shot location share, full money breakdown, adjustments. Offers show a reduced version with the address withheld. |
| **Price adjustment** | `app/job/[id]/price-change.tsx` | Ask for more money mid-job with a live client-facing preview. Records a *request* — SERVI charges the client; the specialist never negotiates or handles cash. |
| **Completion** | `app/job/[id]/complete.tsx` | Evidence photos (framed as protection *for* the specialist), notes, a private client rating, and the payout summary. |
| **Earnings** | `app/(tabs)/earnings.tsx` | Dark "ledger" hero, instant cash-out, next deposit, three money buckets, week chart, per-job breakdown showing what the client paid next to what you earned. |
| **Deposits** | `app/earnings/payouts.tsx` | Payout history, each expandable to the jobs it covered. |
| **Profile** | `app/(tabs)/profile.tsx` | Reliability-first stats, tier ladder with real perks, trades, availability, coverage, documents, payout account. |
| **Why SERVI** | `app/why-servi.tsx` | The retention argument: a worked pricing example and an honest side-by-side against working independently. |
| **Onboarding** | `app/onboarding/*` | 6 steps — identity → trades & skills → coverage → verification documents → CLABE/RFC payout setup → review & submit → awaiting verification. Submits to `POST /api/provider/onboarding` → lands in the admin Inbox as a `partner_applications` row. |
| **Sign in** | `app/auth/{phone,otp}` | Firebase phone OTP → `POST /api/provider/auth/firebase`. A phone not yet in the `providers` table is routed to onboarding above. |
| **Help** | `app/help.tsx` | Safety callout, email support (matching the web app's `CONTACT_MODE='email'` stopgap), and the five questions specialists actually ask. |

---

## The money is real math, not invented numbers

[`src/data/pricing.ts`](src/data/pricing.ts) is a **line-by-line TypeScript port of
[`../backend/pricing.mjs`](../backend/pricing.mjs)** — the same alpha curve, the same
Stripe gross-up, the same VAT. Every peso on every screen is what the production backend
would actually produce.

This matters because of one invariant the whole app is built on:

```
providerAmountCents === Math.round(providerPricePesos * 100)
```

**The specialist keeps 100% of their quoted price.** SERVI's booking fee, Stripe's
processing fee and VAT are all added *on top* and paid by the client. Nothing is deducted
from the specialist. If the alpha curve ever changes in `backend/pricing.mjs`, change it
here too.

Worked example, straight from the engine: a **$480** job → the client's card is
pre-authorized for **$628.43**, and the specialist earns **$480.00**.

---

## Design notes

Same design system as the customer app — same tokens, radii, motion, fonts (Outfit +
Plus Jakarta Sans) — so a specialist and a client are visibly on the same platform. What
changes is register: this is a work tool, not a storefront.

- **Duty state** gets a full card, not a settings row. Off duty means zero income; it's the
  highest-consequence control in the app.
- **Money goes dark.** The earnings hero borrows SERVI's existing dark payment pages
  (`frontend/pay.html`, `book.html`), so money surfaces feel like the same institution on
  both sides of the marketplace.
- **One tappable action at a time** in the check-in stepper. Someone doing this one-handed
  in a doorway holding a toolbag should never have to choose between four buttons.
- **Offers lead with what you earn**, then distance, duration, and time — a job should be
  decidable in about three seconds without opening anything.
- **Reliability outranks rating** on the profile. Rating is what clients think of you;
  reliability is what SERVI dispatches on. Leading with the metric that actually drives
  income is the honest choice.
- **Three money buckets are never summed** into one "balance". Available, processing and
  scheduled answer different questions, and a blended number is how marketplaces end up
  showing people money they can't touch.

---

## Project structure

```
src/
  app/            expo-router routes (see table above)
  api/            partner.ts — backend wire types + mapping (fetchJobs, acceptOfferRemote, ...)
  components/     partner-specific components + the shared UI kit in ui/
  data/           types, catalog, pricing port, time.ts (real clock, CDMX-fixed formatting)
  lib/            config.ts, session.ts, api.ts, firebasePhone.ts, client.ts — networking layer
  i18n/           bilingual strings (ES default) + context, with plural handling
  state/          PartnerStateContext — server-backed store (polls GET /api/provider/jobs)
  theme/          shared tokens + typography, plus partner.ts extensions
```

`src/data/time.ts` runs on the real device clock; all formatting (week/month boundaries,
"today", CDMX hour labels) is fixed to `America/Mexico_City` to match the CDMX-pinned
backend, regardless of the device's actual timezone.

---

## Verification

```bash
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm run export:web       # static export to dist/
```

All three pass clean as of the last commit. 28 routes export.

---

## What is deliberately NOT here

- Stripe Connect payouts (earnings are read-only; instant cash-out and the payout-account
  screen stay disabled), real document upload validation during onboarding, push
  notifications (foreground polling instead), real maps.
- In-app messaging beyond the entry point (the masked-contact concept is shown, the thread isn't built).
- Multi-specialist / crew jobs.
- Admin tooling — that stays in `frontend/admin.html`.

The path from this prototype to production is in **[INTEROP.md](../INTEROP.md)**, including
which backend routes already exist (three of them do) and which need building.
