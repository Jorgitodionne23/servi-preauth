# SERVI Partner — Specialist App Design Reference

A **high-fidelity, runnable specialist-app prototype** for [SERVI](../CLAUDE.md) — the
on-demand home-services platform for Santa Fe, Cuajimalpa de Morelos (CDMX). Built with
**Expo + React Native + TypeScript**, deliberately as the mirror of the customer prototype
in [`../native-app-reference`](../native-app-reference/README.md).

> ⚠️ **This is a design reference, not a product.** It uses **mocked data and local
> fixtures only**. It does **not** connect to Firebase, Stripe, Neon, Cloudflare R2, or any
> production SERVI service. It moves **no real money** and uploads **no real documents**.
> It is fully isolated from the web app in `../frontend` and `../backend` — it imports
> nothing from them and is imported by nothing.

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

### Testing without an Apple Developer account

You explicitly **do not need** the $99/yr Apple Developer Program for any of the following.
That membership is only required much later, to ship to TestFlight or the App Store.

| Method | Needs Apple account? | What it's good for |
|---|---|---|
| **Expo Go on your own iPhone/Android** | ❌ No | **The real "it's an app" test.** Install Expo Go from the App Store / Play Store, run `npx expo start`, scan the QR code. Runs on your actual phone with real touch, haptics and gestures. |
| **Web browser** | ❌ No | `npm run web`. Phone-width, still feels native (tab bar, sheets, safe areas). Best for fast iteration and for showing someone on a laptop. |
| **iOS Simulator** | ❌ No | `npx expo start` then press `i`. Needs Xcode (free from the Mac App Store) — a free Apple ID is enough, no paid membership. |
| **Android emulator** | ❌ No | Press `a`. Needs Android Studio. |
| **Hosted web build** | ❌ No | `npm run export:web` → deploy `dist/` to Cloudflare Pages (SERVI already uses it). Anyone opens the URL on their phone and can "Add to Home Screen" for a full-screen, app-like icon. Ideal for getting a real specialist to try it. |
| TestFlight / App Store | ✅ Yes | Only when you go to production. Not needed for this prototype. |

**Expo Go works here on purpose.** Every dependency is a standard Expo SDK module — there
are no custom native modules — so the app runs unmodified inside Expo Go. Keep it that way
while this stays a prototype; adding a library that requires a native build is what forces
you into the paid-account path early.

Serving the static export locally needs a clean-URL server (`npx serve dist`), not a plain
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

Three job IDs are shared between the two fixtures on purpose, so the same order can be seen
from both directions. Full mapping in **[INTEROP.md](../INTEROP.md)**.

The demo to run: open order **SV-204701** in both. Customer side shows it *assigned to
Pablo Méndez*. Specialist side is Pablo — tap **Voy en camino → Llegué → Empecé el
trabajo**, and you're driving exactly the events (`en_route`/`arrived`/`started`) that
populate the customer's live timeline.

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
| **Profile** | `app/(tabs)/profile.tsx` | Reliability-first stats, tier ladder with real perks, trades, availability, coverage, documents, payout account. Plus prototype demo controls. |
| **Why SERVI** | `app/why-servi.tsx` | The retention argument: a worked pricing example and an honest side-by-side against working independently. |
| **Onboarding** | `app/onboarding/*` | 6 steps — identity → trades & skills → coverage → verification documents → CLABE/RFC payout setup → review & submit → awaiting verification. |
| **Sign in** | `app/auth/{phone,otp}` | Phone + OTP only. Any 6 digits work. |
| **Help** | `app/help.tsx` | Safety callout, email support (matching the web app's `CONTACT_MODE='email'` stopgap), and the five questions specialists actually ask. |

### Demo controls

Bottom of **Profile**: simulate a new job offer, flip between verified / under-review, and
reset all data. They're fenced off in a dashed card and labelled as prototype-only.

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
  components/     partner-specific components + the shared UI kit in ui/
  data/           types, catalog, fixtures, the pricing port, the demo clock
  i18n/           bilingual strings (ES default) + context, with plural handling
  state/          PartnerStateContext — the single in-memory store
  theme/          shared tokens + typography, plus partner.ts extensions
```

`src/data/time.ts` pins the app to a **frozen demo clock** (`DEMO_NOW`, 2026-06-23) so it
tells the same story as the customer fixtures. Offer countdowns are the one exception —
they run on the real clock so the accept-or-lose-it pressure is genuine. A production build
deletes that file.

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

- Real auth, real Stripe Connect, real document upload, real push notifications, real maps.
- In-app messaging beyond the entry point (the masked-contact concept is shown, the thread isn't built).
- Multi-specialist / crew jobs.
- Admin tooling — that stays in `frontend/admin.html`.

The path from this prototype to production is in **[INTEROP.md](../INTEROP.md)**, including
which backend routes already exist (three of them do) and which need building.
