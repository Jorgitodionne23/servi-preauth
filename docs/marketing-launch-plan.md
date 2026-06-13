# SERVI — Marketing Launch Plan

**Status:** Draft (assets gated — see guardrails)
**Date:** 2026-06-12
**Owner:** [you fill in — founder/operator name]
**Target launch date:** [you fill in]

---

## 0. TL;DR & Guardrails

**Strategy in one line:** Generate concentrated demand in a tight West-CDMX footprint through zero-spend, founder-led organic channels; fulfill each request by manually sourcing and matching a provider (the way admin ops already work); grind toward the **first 25–50 completed paid bookings** as proof of product–market fit.

This is a **concierge / "do things that don't scale"** launch. We are not building a growth machine yet — we are hand-delivering the first cohort of great service experiences and letting word-of-mouth compound.

**Strategic choices locked for this launch window:**

| Dimension              | Choice                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| Budget posture         | **Zero-spend, founder-led organic.** No paid ads this window.                             |
| Marketplace sequencing | **Demand-first.** Drive customer requests; recruit/match providers reactively.            |
| Geography              | **West CDMX** — Santa Fe + Cuajimalpa core, plus Interlomas, Bosques de las Lomas, Lomas. |
| North-star metric      | **First completed paid bookings** (request → match → pre-auth → service → capture).       |

### ⛔ Hard guardrails (do not violate without explicit human approval)

Per `AGENT_PRODUCTION_READINESS.md` (Post-Readiness Marketing Gate), this document may **draft** assets but **nothing may be sent or spent** without sign-off. Specifically:

- **Allowed now:** writing copy, outreach drafts, ad drafts, lead criteria, checklists, landing-copy suggestions.
- **Requires explicit approval before doing:** contacting any lead; sending emails / DMs / SMS / WhatsApp messages; starting paid campaigns or spending money; scraping or uploading audiences/personal data; posting publicly; changing production DNS or deployment settings.

Every outreach script and ad below is **a draft held in reserve**. Treat "send" as a separate, human-approved step.

### Pre-flight blocker

Marketing depends on a working booking + payment loop. Before any outreach goes live, complete the **optional pre-launch manual click-throughs** from `docs/production-readiness-report.md §Recommended Pre-Launch Manual Click-Throughs`:

1. `pay.html` with Stripe Elements + test card `4242 4242 4242 4242`.
2. `book.html` saved-card 1-click confirm (3DS fallback).
3. A real end-to-end booking from `index.html` Smart Request → confirm → admin sees the request.

Do these on the **live domain** with a real (small) transaction once production Stripe keys are confirmed. No customer outreach until this passes.

---

## 1. Positioning & Messaging

**What SERVI is:** On-demand home services for West CDMX — request cleaning, repairs, maintenance, personal care, and errands, and get matched with a verified specialist. Think "Uber for home services," but local, vetted, and WhatsApp-simple.

**Core value proposition**

- **ES (default):** _"Servicios para tu hogar, a un mensaje de distancia. Pide limpieza, reparaciones, mantenimiento o un encargo — te conectamos con un especialista verificado."_
- **EN:** _"Home services, one message away. Request cleaning, repairs, maintenance, or an errand — we match you with a verified specialist."_

**Proof points / why trust us**

- **Verified specialists** ("SERVI Partners") — not a random marketplace; we vet who shows up.
- **No charge until the job is done right.** Your card is _pre-authorized_ (a hold, not a charge); we capture only after the service is completed. _(ES: "No se cobra hasta terminar. Tu tarjeta queda pre-autorizada, no cargada.")_
- **Cash option for your first service** if you'd rather not enter a card the first time.
- **Bilingual, local, human.** Spanish-first, real people, fast WhatsApp support.

**Objection handling**

| Objection                                   | Response                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| "I don't know who's coming to my house."    | Specialists are verified before matching; you get name/details before they arrive.                                         |
| "Is my card safe / will I get overcharged?" | Pre-authorization = a hold, not a charge. Final amount is captured only after the service, and you see the full breakdown. |
| "I'd rather not pay online."                | First-time customers can choose cash.                                                                                      |
| "How fast can someone come?"                | Request ASAP or schedule. We confirm match + timing over WhatsApp.                                                         |
| "What if it's a weird/custom request?"      | The **Personalizado** category exists for exactly that — "describe it and we'll find it."                                  |

**Tone:** Professional, warm, concise, Uber-caliber. Spanish-first. Never cartoonish. Lead with the outcome (a clean home, a fixed leak), not the app.

---

## 2. Target Audience & Beachhead

**Primary ICP (customer):** Time-constrained West-CDMX households and professionals — dual-income families, busy professionals, and condo/apartment residents in high-density towers who value convenience and will pay for a vetted specialist over hunting for one.

**Where they are (the beachhead):**

- **Core:** Santa Fe, Cuajimalpa de Morelos.
- **Adjacent (West CDMX expansion):** Interlomas, Bosques de las Lomas, Lomas de Chapultepec.

**Why this footprint:** Dense, affluent, vertical living (lots of `torres`/condos with shared administration), high concentration of the exact convenience-seeking customer, and a tight provider travel radius that keeps reactive fulfillment feasible for a single operator. Word-of-mouth compounds fast inside buildings and neighborhood groups.

**Secondary ICP (provider / SERVI Partner — recruited reactively):** Skilled independent workers already operating in West CDMX — cleaners, plumbers, electricians, handypeople, caretakers, errand-runners — who want steady, pre-qualified jobs without chasing clients or payment.

---

## 3. North-Star & Funnel Metrics

**North-star:** Number of **completed, paid, fulfilled** service requests in the launch window.

- **Launch-window target:** `[you fill in — recommend 25–50]` completed paid bookings in the first `[30/60]` days.
- A "completed paid booking" = request → provider matched → pre-auth placed (`requires_capture`) → service delivered → **payment captured**.

**Funnel to instrument (track weekly):**

| Stage             | Definition                                  | What to watch                               |
| ----------------- | ------------------------------------------- | ------------------------------------------- |
| Reach             | People who saw an outreach touch            | Channel that drives most qualified requests |
| Request           | Service request submitted (web or WhatsApp) | Request → match conversion                  |
| Matched           | Provider sourced & assigned                 | **Time-to-match** (target < `[X]` hrs)      |
| Pre-authorized    | Payment link paid, card held                | Link → pay conversion; link expiries        |
| Completed         | Service delivered                           | **Fulfillment rate** (matched → completed)  |
| Captured          | Payment captured post-service               | Captured revenue; capture failures          |
| Repeat / Referral | 2nd booking or referral made                | **Repeat rate**, referral coefficient       |

**Qualitative signal to capture every booking:** a one-line CSAT over WhatsApp ("¿Del 1 al 5, qué tan probable es que nos recomiendes?") and a short note on what went right/wrong. Early NPS-style feedback matters more than volume.

**Health guardrail:** if **fulfillment rate** (matched → completed) drops below `[you fill in — e.g. 90%]`, slow demand generation and shore up the provider bench before pushing more requests (see §7).

---

## 4. Phased Launch

### Phase 0 — Pre-launch readiness (before any outreach)

- [ ] Complete the live-domain payment click-throughs (§0 Pre-flight blocker).
- [ ] Confirm production Stripe **live** keys + webhook secret on Render (see readiness report §Deployment Risks).
- [ ] Set up **WhatsApp Business** on `new phone number` with: greeting message, away message, quick replies, labels (New / Matching / Awaiting payment / Scheduled / Completed), and a catalog/links to the site.
- [ ] Stand up a thin **on-call provider bench** — 1–2 trusted, verified providers per core category on speed-dial so reactive matching can actually deliver (see §7). _Demand-first ≠ zero supply; it means we don't mass-recruit ahead of demand._
- [ ] Create a free **Google Business Profile** for SERVI (West CDMX service area) — free local discovery + reviews surface.
- [ ] Reserve handles + set up **Instagram/TikTok** business profiles (content starts Phase 2).
- [ ] Build a simple **tracking sheet** (or use admin dashboard) for the §3 funnel.

### Phase 1 — Warm-network soft launch (Week 1–2)

Goal: first **5–10** real bookings from people who already trust you.

- Personally reach out (1:1, not blast) to friends, family, neighbors, and your building/condo contacts in the footprint.
- Offer a "founding customer" experience: white-glove, you personally oversee the match and follow up after.
- Ask every satisfied Phase-1 customer for (a) a one-line testimonial and (b) one referral. This seeds Phase 3.

### Phase 2 — Neighborhood organic expansion (Week 2–6)

Goal: scale to the **North-star target** across the West-CDMX footprint via building admins and vecino groups.

- Approach **condo/building administrators and concierges** ("administración / conserjería") — they're the highest-leverage node in vertical CDMX. One building admin = dozens of warm households. Offer a building-resident perk.
- Introduce SERVI in **neighborhood WhatsApp & Facebook groups** (vecinos de Santa Fe / Interlomas / Bosques / Lomas) — value-first, not spammy (see §8 drafts; respect each group's rules).
- Publish organic **before/after** and "behind the scenes of a SERVI service" content on IG/TikTok.
- Activate **Google Business Profile** reviews from Phase-1 customers.

### Phase 3 — Referral flywheel + reactive supply scaling (Week 4+)

Goal: bookings increasingly sourced by word-of-mouth; provider bench grows to match.

- Turn on the **referral loop** (§8): give/get incentive, shared over WhatsApp.
- As specific categories/zones get demand-constrained, **recruit providers reactively** for exactly those gaps (don't over-recruit).
- Double down on whichever Phase-2 channel produced the cheapest qualified bookings.

---

## 5. Channels (Zero-Spend)

Ranked by expected leverage for a single founder in this footprint. Each has a concrete first action.

1. **Founder 1:1 WhatsApp outreach** — _First action:_ list 30 warm contacts in/near the footprint; message them personally (§8). Highest trust, lowest scale.
2. **Condo / building administrators & concierges** — _First action:_ identify 5 target towers in Santa Fe/Interlomas; pitch the administración a resident perk + a single point of contact. Highest leverage per touch.
3. **Neighborhood WhatsApp & Facebook groups (vecinos)** — _First action:_ join 3–5 groups per zone; read the rules; post value-first intro (§8).
4. **Referral loop** — _First action:_ finalize give/get terms; hand every happy customer a referral line (§8).
5. **Google Business Profile** — _First action:_ create + verify the profile; request reviews from Phase-1 customers. Free, compounding local SEO.
6. **Organic Instagram / TikTok** — _First action:_ post 3 before/after reels in week 1 of Phase 2; link in bio → request flow.
7. **Local micro-partnerships** — _First action:_ talk to 3 local nodes (real-estate brokers, gyms, cafés, building concierges) about cross-referrals. No money, just mutual value.

> **Held in reserve (not this window):** paid Meta/Google geo-ads, flyering at scale, influencer spend. Ad copy is drafted in §8 so it's ready the moment paid is approved — but **do not run it without sign-off**.

---

## 6. Weekly Operating Cadence

A single founder can't run channels, fulfillment, and analysis ad hoc. A light weekly rhythm keeps the launch disciplined:

- **Monday — Review:** Pull the §3 funnel numbers from the past week. Which channel drove the most _qualified_ requests? What's the matched→completed fulfillment rate? Any capture failures or unhappy customers to recover?
- **Mid-week — Supply check:** Is the on-call bench (§7) warm enough for expected demand? Recruit reactively only for categories/zones that are demand-constrained.
- **Throughout — Fulfill first:** Inbound requests and in-flight bookings always take priority over new outreach. A booking in progress beats a new lead.
- **Friday — Grow:** Do the week's _approved_ outreach for the active phase. Double down on the cheapest qualified-booking channel; drop what isn't working.
- **Every booking — Close the loop:** Capture payment promptly after service, request the 1–5 rating, and ask happy customers for a testimonial or referral.

Keep one source of truth (the tracking sheet or admin dashboard). If fulfillment rate dips below the §3 floor, the week's job is supply, not demand.

---

## 7. Demand-First Fulfillment Playbook

Because we drive demand before mass-recruiting supply, **fulfillment is the #1 risk.** A request we can't fill burns a first customer permanently. This playbook keeps the demand-first model honest.

**On-call provider bench (the safety net):**

- Maintain **1–2 verified providers per core category** (Limpieza, Armar/Reparar/Mantenimiento, Bienestar/Cuidado Personal, Abastecimiento/Compras) reachable on short notice within the footprint.
- These are not employees — they're trusted partners who get first dibs on incoming jobs. Keep the bench warm with steady flow.

**Per-request SLA (the matching loop):**

1. Request lands (web → admin dashboard `WEB-…` row, or direct WhatsApp).
2. Acknowledge the customer within **`[you fill in — e.g. 15 min]`** over WhatsApp: "Recibimos tu solicitud, estamos asignando a tu especialista."
3. Source/confirm a provider within **`[you fill in — e.g. 2 hrs]`** (bench first; reactive recruit if the bench can't cover).
4. Create the order + Stripe pre-auth payment link (admin dashboard / Apps Script); send link via WhatsApp.
5. Customer pays → card pre-authorized. Confirm date/time/specialist.
6. Service delivered → **capture** payment → request a 1–5 rating.

**Quality bar:** every Phase-0/1 provider is someone you'd trust in your own home. Verify ID + relevant skill/work history before they take a SERVI job. One bad early experience outweighs ten good ones.

**Escape hatches when no provider is available:**

- Be honest and fast: offer a **scheduled** slot instead of ASAP, or a near-term window.
- Never leave a request silent. A clear "we can do it tomorrow at 10" beats a no-show.
- Use the **first-time cash exception** to reduce friction if card entry is the blocker (not a fulfillment fix, but removes a different drop-off).

**Capacity throttle:** if inbound exceeds what the bench can fulfill at quality, **slow §5 channel activity** (especially group posts) until supply catches up. Protect fulfillment rate over raw volume.

---

## 8. Drafted Assets (Gated — do not send without approval)

> All copy below is **bilingual (ES default / EN)** and **a draft**. Fill bracketed slots. Nothing here is approved to send.

### 8.1 Warm-network 1:1 WhatsApp (Phase 1)

**ES:**

> Hola [Nombre] 👋 Estoy lanzando **SERVI**, servicios para el hogar en [zona] — limpieza, reparaciones, mantenimiento, cuidado personal y encargos, con especialistas verificados y todo coordinado por WhatsApp. Como eres de mis primeras personas, quiero darte un servicio impecable. ¿Hay algo en tu casa que te esté dando lata estos días? Yo me encargo de conseguirte al especialista. 🙌

**EN:**

> Hi [Name] 👋 I'm launching **SERVI** — home services in [area]: cleaning, repairs, maintenance, personal care, and errands, with verified specialists, all coordinated over WhatsApp. You're one of my first people, so I want to give you a flawless experience. Anything around the house that's been bugging you lately? I'll personally line up the specialist. 🙌

### 8.2 Building administrator / concierge pitch (Phase 2)

**ES:**

> Hola, soy [Nombre] de **SERVI**, una plataforma de servicios para el hogar aquí en [zona]. Conectamos a los residentes con especialistas verificados (limpieza, plomería, electricidad, mantenimiento, cuidado personal, encargos) — todo por WhatsApp, sin que se cobre nada hasta terminar el servicio. Me encantaría ofrecer a los residentes de [Torre/Edificio] un beneficio de bienvenida. ¿Tendría 10 minutos esta semana?

**EN:**

> Hi, I'm [Name] from **SERVI**, a home-services platform here in [area]. We connect residents with verified specialists (cleaning, plumbing, electrical, maintenance, personal care, errands) — all over WhatsApp, with nothing charged until the service is done. I'd love to offer [Tower/Building] residents a welcome perk. Could I get 10 minutes this week?

### 8.3 Neighborhood group intro (Phase 2 — value-first, respect group rules)

**ES:**

> ¡Hola vecinos! 👋 Para quienes andan corriendo: lancé **SERVI**, servicios para el hogar aquí en [zona] con especialistas verificados — limpieza, reparaciones, mantenimiento, cuidado personal y encargos. Se pide por WhatsApp y no se cobra hasta terminar. Si necesitan algo, con gusto les ayudo: [link]. Cualquier duda, por aquí estoy. 🙌

**EN:**

> Hi neighbors! 👋 For anyone short on time: I launched **SERVI**, home services here in [area] with verified specialists — cleaning, repairs, maintenance, personal care, errands. Request over WhatsApp, nothing charged until it's done. Happy to help if you need anything: [link]. Questions welcome. 🙌

### 8.4 Referral line (Phase 3)

**ES:**

> ¿Conoces a alguien que necesite una mano en casa? Por cada amig@ que refieras y haga su primer servicio, [tú recibes [beneficio] y tu amig@ recibe [beneficio]]. Solo comparte este link: [link de referido].

**EN:**

> Know someone who could use a hand at home? For every friend you refer who completes their first service, [you get [perk] and they get [perk]]. Just share this link: [referral link].

_Suggested give/get to finalize:_ `[you fill in — e.g. give MX$100 off / get MX$100 off first service]`. Keep it simple and WhatsApp-shareable.

### 8.5 Landing-copy suggestions (for `index.html` / Smart Request hero)

- **Hero headline (ES):** "Tu hogar, resuelto." — **(EN):** "Your home, handled."
- **Hero subhead (ES):** "Especialistas verificados para limpieza, reparaciones, mantenimiento, cuidado personal y encargos. Pídelo en un mensaje." — **(EN):** "Verified specialists for cleaning, repairs, maintenance, personal care, and errands. Request it in one message."
- **Trust strip:** "Verificados · No se cobra hasta terminar · Soporte por WhatsApp" / "Verified · Nothing charged until it's done · WhatsApp support."
- **Primary CTA:** "Solicita un servicio" / "Request a service."

> These are _suggestions_ — do not restyle payment pages, and follow the design system in `frontend/shared/`. Implement only if/when approved as a separate task.

### 8.6 Ad copy — HELD IN RESERVE (do not run; paid is not approved this window)

_Drafted so it's ready if paid is later approved._

- **Primary text (ES):** "Limpieza, reparaciones y más en [zona] — con especialistas verificados. Pídelo por WhatsApp. No se cobra hasta terminar." **CTA:** "Solicita ahora."
- **Primary text (EN):** "Cleaning, repairs, and more in [area] — with verified specialists. Request over WhatsApp. Nothing charged until it's done." **CTA:** "Request now."
- Geo-target: Santa Fe / Cuajimalpa / Interlomas / Bosques / Lomas. **Budget: $0 until explicitly approved.**

---

## 9. Lead Qualification Criteria

**Qualified early customer (prioritize):**

- Lives/works inside the West-CDMX footprint (fulfillable travel radius).
- Has a concrete, near-term need (not "maybe someday").
- Comfortable coordinating over WhatsApp.
- Reasonable expectations on timing/price; willing to pre-authorize a card **or** use the first-time cash option.
- Bonus: lives in a target tower/building (referral surface) or is well-connected locally.

**Disqualify / defer:** outside the footprint; needs a category we can't yet staff at quality; wants something out of scope or unsafe; expects free/below-cost work.

**Qualified early provider (recruit reactively for real gaps):**

- Operates within the footprint; reliable, reachable, punctual.
- Verifiable ID + relevant skill/experience for the category.
- Professional with customers; comfortable with the WhatsApp + pre-auth flow.
- Available on short notice for at least some windows.
- Recruit **only** for categories/zones with proven incoming demand — don't build idle supply.

---

## 10. Manual Launch Checklist (gated runbook)

> Each "send/publish/spend" line is a **human-approved** action. Drafting is done; execution is gated.

**Readiness (Phase 0):**

- [ ] Live-domain payment click-throughs pass (`pay.html`, `book.html`, full booking).
- [ ] Production Stripe live keys + webhook secret confirmed on Render.
- [ ] WhatsApp Business configured (greeting, quick replies, labels).
- [ ] On-call provider bench warm (≥1–2 verified per core category).
- [ ] Google Business Profile created + verified.
- [ ] Funnel tracking sheet/dashboard ready.

**Soft launch (Phase 1) — requires approval to send:**

- [ ] Warm-network list (30 contacts) compiled.
- [ ] **[APPROVAL] Send** 1:1 WhatsApp outreach (§8.1).
- [ ] First 5–10 bookings fulfilled white-glove.
- [ ] Testimonials + first referrals collected.

**Organic expansion (Phase 2) — requires approval to send/post:**

- [ ] 5 target buildings identified.
- [ ] **[APPROVAL] Send** building-admin pitches (§8.2).
- [ ] Neighborhood groups joined (rules read).
- [ ] **[APPROVAL] Post** value-first group intros (§8.3).
- [ ] **[APPROVAL] Publish** first IG/TikTok content.
- [ ] Google reviews requested from Phase-1 customers.

**Flywheel (Phase 3) — requires approval:**

- [ ] Referral give/get terms finalized.
- [ ] **[APPROVAL]** Referral loop activated.
- [ ] Reactive provider recruiting for demand-constrained categories only.

**Never without explicit approval:** contacting leads, scraping/uploading personal data, starting paid campaigns, spending money, posting publicly at scale, or changing production DNS/deployment.

---

## 11. Risks & Mitigations

| Risk                                                      | Likelihood | Impact | Mitigation                                                                                                             |
| --------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Fulfillment gap** (demand-first, no provider available) | High       | High   | On-call bench (§7); per-request SLA; capacity throttle; honest scheduling instead of no-shows.                         |
| **Quality miss on an early job**                          | Med        | High   | Strict provider verification; founder oversight of Phase-1/2 jobs; CSAT after every booking.                           |
| **Single-founder bandwidth**                              | High       | Med    | Phased rollout; throttle demand to capacity; lean on building admins (leverage per touch); templated WhatsApp replies. |
| **WhatsApp as the whole funnel is fragile**               | Med        | Med    | Mirror requests into the web flow + admin dashboard; keep Google Business Profile as a second discovery path.          |
| **Group posts read as spam → bans**                       | Med        | Med    | Value-first, follow each group's rules, lead with help not pitch, low frequency.                                       |
| **Payment friction on first card entry**                  | Med        | Med    | First-time cash exception; clear "pre-auth = hold, not charge" messaging.                                              |
| **Premature paid spend**                                  | Low        | High   | Hard gate: ad copy drafted but $0 until explicit approval.                                                             |
| **Expanding geography too fast**                          | Med        | Med    | Hold the West-CDMX footprint until fulfillment rate + repeat rate prove out.                                           |

---

## Appendix A — Source of truth & references

- **Marketing gate authority:** `AGENT_PRODUCTION_READINESS.md` → "Post-Readiness Marketing Gate."
- **Readiness sign-off:** `docs/production-readiness-report.md` (says **READY**; lists pre-launch click-throughs + deployment risks).
- **Product/positioning facts:** `CLAUDE.md` (categories, payment model, bilingual requirement, contact info).
- **Contact:** serv.clientserv@gmail.com · WhatsApp **+52 55 2511 2588** (`wa.me/525525112588`).
- **Service area:** West CDMX — Santa Fe, Cuajimalpa, Interlomas, Bosques de las Lomas, Lomas.

## Appendix B — Open decisions for the owner ([you fill in])

1. Target launch date and launch-window length (30 vs 60 days).
2. North-star numeric target (recommend 25–50 completed paid bookings).
3. Acknowledge-SLA and time-to-match targets (§3, §7).
4. Referral give/get incentive amounts (§8.4).
5. Fulfillment-rate floor that triggers the demand throttle (§3, §7).
