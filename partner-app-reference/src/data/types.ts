/**
 * Partner-side domain types.
 *
 * Every type here is deliberately traceable to something that already exists on
 * the SERVI backend, so this prototype can become the production app without a
 * vocabulary rewrite. The mapping is documented inline and summarized in
 * `../../INTEROP.md`.
 *
 *   Specialist            → `providers` table (provider_id, status, specialty…)
 *   Job                   → `all_bookings` row, projected through the
 *                           provider-safe view in `GET /api/provider/order`
 *   JobPhase              → `order_lifecycle_events.event_type` MILESTONE_EVENTS
 *   PriceChangeType       → backend `PRICE_CHANGE_TYPES` set (exact values)
 *   PayoutAccount         → `providers.connect_account_id` (Stripe Connect)
 *
 * The critical privacy rule, inherited from the backend: a specialist never
 * sees the client's phone, email, full name, or the client's total price. The
 * backend enforces this in `maskProviderName()` + the hand-picked field list in
 * `GET /api/provider/order`. `Job` below mirrors that shape exactly — if a field
 * isn't on the backend's provider projection, it isn't here either.
 */
import type { FeatherName } from '@/components/ui/Icon';
import type { Lang } from '@/i18n/strings';

export type Bilingual = { es: string; en: string };

export function loc(b: Bilingual | null | undefined, lang: Lang): string {
  if (!b) return '';
  return b[lang] ?? b.es;
}

// ── Specialist (the logged-in user) ────────────────────────

/** Mirrors `providers.status`. `pending`/`review` gate access to job offers. */
export type ProviderStatus = 'pending' | 'review' | 'verified' | 'paused' | 'removed';

/** Verification artifacts SERVI collects during onboarding. */
export type DocumentKey = 'id_front' | 'id_back' | 'selfie' | 'address_proof' | 'certification';
export type DocumentStatus = 'missing' | 'uploaded' | 'in_review' | 'approved' | 'rejected';

export type VerificationDoc = {
  key: DocumentKey;
  label: Bilingual;
  hint: Bilingual;
  status: DocumentStatus;
  required: boolean;
};

/**
 * Trade the specialist is approved to work in. `categoryKey` matches the
 * customer app's `CategoryKey` so an offer routed by category lands correctly.
 */
export type TradeKey = 'cleaning' | 'repair' | 'moving' | 'wellness' | 'suppliers';

export type Trade = {
  key: TradeKey;
  label: Bilingual;
  icon: FeatherName;
  /** Sub-services within the trade the specialist opted into. */
  skills: Bilingual[];
};

/** A tier is earned, not bought. Drives offer priority + payout speed. */
export type TierKey = 'nuevo' | 'plata' | 'oro' | 'elite';

export type Tier = {
  key: TierKey;
  label: Bilingual;
  /** Completed jobs needed to reach this tier. */
  minJobs: number;
  /** Minimum satisfaction (% positive thumbs) to hold the tier. */
  minPositivePct: number;
  perks: Bilingual[];
};

/**
 * Aggregate satisfaction rolled up from thumbs ratings (service_ratings). NOT
 * stars — the backend only stores 👍/👎, so this is % positive over a count.
 * Shared shape with the customer app. `display:'new'` hides the % below a
 * cold-start floor. Backend: GET /api/providers/:providerId/rating.
 */
export type RatingAggregate = {
  positivePct: number; // 0–100
  count: number;
  display: 'score' | 'new';
};

export type Specialist = {
  /** `providers.provider_id` — the `prov-NNNNNN` sequence. */
  providerId: string;
  status: ProviderStatus;
  firstName: string;
  lastName: string;
  initials: string;
  phone: string;
  email: string | null;
  /** `providers.specialty` */
  specialty: Bilingual;
  /** `providers.city` */
  city: string;
  memberSince: string; // ISO
  /** Aggregate satisfaction (% positive thumbs) — the same value the customer
   *  sees for this specialist. Replaces the old fabricated 5-star rating. */
  providerRating: RatingAggregate;
  completedJobs: number;
  /** % of accepted jobs actually completed — the metric SERVI polices hardest. */
  reliability: number; // 0–1
  /** % of offers accepted. Low acceptance quietly reduces offer volume. */
  acceptance: number; // 0–1
  tier: TierKey;
  trades: Trade[];
  documents: VerificationDoc[];
  /** How many clients saved this specialist as trusted — `user_trusted_specialists`. */
  trustedBy: number;
};

// ── Availability & coverage ────────────────────────────────

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type DayAvailability = {
  day: Weekday;
  enabled: boolean;
  from: string; // "08:00"
  to: string; // "18:00"
};

export type Coverage = {
  /** Colonias / zones inside CDMX the specialist serves. */
  zones: string[];
  /** Max travel radius in km from their base. */
  radiusKm: number;
  /** Whether they take same-day / ASAP work. */
  acceptsAsap: boolean;
};

// ── Jobs ───────────────────────────────────────────────────

/**
 * Provider-facing job state. This is NOT the payment status — a specialist must
 * never be shown, or made to reason about, Stripe state. It's derived:
 *
 *   offered    → admin proposed this job, awaiting accept/decline
 *   scheduled  → accepted, service date in the future
 *   today      → accepted, happening today
 *   active     → specialist has checked in (en_route or later, not completed)
 *   completed  → work finished, awaiting SERVI capture + payout
 *   paid       → captured and included in a payout
 *   cancelled  → cancelled by client or SERVI
 *   expired    → offer countdown ran out
 */
export type JobState =
  | 'offered'
  | 'scheduled'
  | 'today'
  | 'active'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'expired';

/** Backend `MILESTONE_EVENTS` — the exact strings `POST /api/provider/checkin` accepts. */
export type JobPhase = 'en_route' | 'arrived' | 'started' | 'completed';

export const PHASE_ORDER: JobPhase[] = ['en_route', 'arrived', 'started', 'completed'];

/** Backend `PRICE_CHANGE_TYPES` — exact values, do not translate the keys. */
export type PriceChangeType =
  | 'precio_corregido'
  | 'horas_adicionales'
  | 'servicio_adicional'
  | 'materiales'
  | 'otro';

export type PriceChangeStatus = 'requested' | 'approved' | 'rejected' | 'paid';

export type PriceChange = {
  id: string;
  type: PriceChangeType;
  /** Extra amount the specialist is asking for, in centavos. */
  providerAmountCents: number;
  note: string | null;
  /** Client-facing total for the surcharge, from `computePricing`. */
  clientTotalCents: number | null;
  status: PriceChangeStatus;
  requestedAt: string; // ISO
};

/**
 * The client, as the specialist is allowed to see them. Mirrors
 * `maskProviderName()` — first name only, no phone, no email. Contact happens
 * through SERVI, which is both a privacy feature and the platform's protection
 * against the job being taken off-platform.
 */
export type MaskedClient = {
  firstName: string;
  initials: string;
  /** Prior completed jobs between THIS specialist and THIS client. */
  jobsTogether: number;
  /** Client marked this specialist as trusted (`user_trusted_specialists`). */
  trustsYou: boolean;
};

export type Job = {
  /** `all_bookings.public_code` — the SV-NNNNNN the client also sees. */
  id: string;
  /** Backend row id (`all_bookings.id`) — what the provider API routes take. */
  serverId: string;
  state: JobState;
  tradeKey: TradeKey;
  service: Bilingual;
  subLabel: Bilingual;
  /** `all_bookings.service_description` — what the client wrote/said. */
  description: Bilingual;
  /** Follow-up answers from the request flow (`detail_answers`). */
  detailAnswers: { q: Bilingual; a: Bilingual }[];
  /** Attachments the client added (photo/voice/video). Count only in mock. */
  attachments: { kind: 'photo' | 'voice' | 'video'; count: number }[];

  client: MaskedClient;

  /** Full address, revealed on accept. Before accepting, only `zone` shows. */
  address: string;
  zone: string;
  /** Straight-line distance from the specialist's base, km. */
  distanceKm: number;

  isAsap: boolean;
  scheduledAt: string | null; // ISO
  /** Expected duration in minutes — sets the specialist's day planning. */
  estimatedMinutes: number;

  /** What the specialist earns. 100% of the quoted price. */
  payoutCents: number;
  /** What the client's card is held for. Shown for transparency, read-only. */
  clientTotalCents: number;
  /**
   * Whether SERVI has already pre-authorized the client's card for this job.
   *
   * This is the ONLY payment-system fact the specialist is shown, and it's
   * shown because it answers their real question: "am I definitely getting
   * paid for this?" Derived on the backend from `all_bookings.status` being
   * `Confirmed` (hold placed). Per the 24h/5-day model in ../../../CLAUDE.md,
   * a job booked well in advance is legitimately not held yet — the UI says so
   * plainly rather than implying a guarantee that doesn't exist yet.
   */
  paymentHeld: boolean;

  /** Milestone timestamps, mirrors `phaseTimes` from GET /api/provider/order. */
  phaseTimes: Partial<Record<JobPhase, string>>;
  priceChanges: PriceChange[];

  /** Offers only: unix ms deadline to accept before it's re-routed. */
  offerExpiresAt: string | null;

  /** Set once SERVI captures + settles. Links the job to a payout. */
  payoutId: string | null;
  completedAt: string | null;
};

// ── Earnings & payouts ─────────────────────────────────────

export type PayoutStatus = 'pending' | 'in_transit' | 'paid' | 'failed';

export type Payout = {
  id: string;
  /** Total sent to the specialist's bank, centavos. */
  amountCents: number;
  jobIds: string[];
  status: PayoutStatus;
  /** ISO — when it lands / landed in the bank. */
  arrivesAt: string;
  createdAt: string;
  /** CLABE last 4 the money went to. */
  last4: string;
  /** Instant payouts carry a fee; standard weekly ones are free. */
  feeCents: number;
  instant: boolean;
};

/**
 * Stripe Connect payout destination. `connectAccountId` maps to
 * `providers.connect_account_id`. In production this is set up through a
 * Stripe Connect onboarding link — the prototype represents the states without
 * touching Stripe.
 */
export type PayoutAccount = {
  connectAccountId: string | null;
  status: 'not_started' | 'pending' | 'restricted' | 'active';
  bankName: string | null;
  /** CLABE (18-digit Mexican interbank account) — last 4 only. */
  last4: string | null;
  holderName: string | null;
  /** Weekly automatic payout, or manual on-demand. */
  schedule: 'weekly' | 'manual';
  /** RFC for tax receipts (CFDI). Optional until a revenue threshold. */
  rfc: string | null;
};

export type EarningsSummary = {
  /** Cleared and payable now. */
  availableCents: number;
  /** Completed but SERVI hasn't captured the client's card yet. */
  pendingCents: number;
  /** Accepted future jobs — money the specialist can count on. */
  scheduledCents: number;
  weekCents: number;
  weekJobs: number;
  monthCents: number;
  monthJobs: number;
  /** Per-day totals for the current week, Mon→Sun, centavos. */
  weekByDay: number[];
};

// ── Session ────────────────────────────────────────────────

export type SessionStatus = 'signed_out' | 'onboarding' | 'authed';

export type Session = {
  status: SessionStatus;
  specialist: Specialist | null;
};

/** The in-progress application a new specialist is filling out. */
export type OnboardingDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  tradeKeys: TradeKey[];
  skillKeys: string[];
  zones: string[];
  radiusKm: number;
  acceptsAsap: boolean;
  documents: Record<DocumentKey, DocumentStatus>;
  bankHolder: string;
  clabe: string;
  rfc: string;
  acceptedTerms: boolean;
};
