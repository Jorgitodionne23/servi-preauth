/**
 * Shared domain types for the SERVI native prototype.
 * These intentionally mirror the real product's vocabulary (order kinds,
 * statuses, request modes) so the reference is faithful and a future RN
 * engineer can map them 1:1 onto the backend.
 */
import type { FeatherName } from '@/components/ui/Icon';
import type { Lang } from '@/i18n/strings';

export type Bilingual = { es: string; en: string };

export type CategoryKey =
  | 'cleaning'
  | 'repair'
  | 'moving'
  | 'wellness'
  | 'suppliers'
  | 'custom';

export type Followup = {
  key: string;
  q: Bilingual;
  chips?: Bilingual[];
};

export type Subcategory = {
  key: string;
  label: Bilingual;
  icon: FeatherName;
  services: { es: string[]; en: string[] };
  keywords: string[];
  followups: Followup[];
};

export type Category = {
  key: CategoryKey;
  label: Bilingual;
  icon: FeatherName;
  blurb: Bilingual;
  subs: Subcategory[];
};

// ── Requests / orders ──────────────────────────────────────

export type RequestMode = 'text' | 'voice' | 'photos' | 'video';
export type Urgency = 'asap' | 'schedule';

/** Customer-facing order lifecycle (superset, mapped from backend statuses). */
export type OrderStatus =
  | 'pending' // payment link sent, awaiting card auth (kind=primary)
  | 'scheduled' // saved-card booking, hold deferred to ~24h before
  | 'blocked' // 5+ days out / visit with no saved card → needs saved card
  | 'confirmed' // card pre-authorized (hold placed), not charged
  | 'assigned' // specialist matched
  | 'in_progress' // service underway
  | 'completed' // service delivered, awaiting capture
  | 'captured' // payment captured (charged)
  | 'refunded' // captured then refunded
  | 'cancelled'; // order cancelled

/** Mirrors backend "order kinds" — used in the payment reference UI. */
export type OrderKind = 'primary' | 'book' | 'setup' | 'setup_required' | 'visit';

export type TimelineStep = {
  status: OrderStatus;
  at: string | null; // ISO; null = not yet reached
  note?: Bilingual;
};

/**
 * On-site milestones — the backend's `MILESTONE_EVENTS`, written by the
 * specialist via `POST /api/provider/checkin` and surfaced to the customer.
 * This is a SEPARATE track from `OrderStatus`/`TimelineStep` (the payment /
 * coordination track): the backend stores `service_phase` distinctly from
 * `status`, and so do we. The partner app renders the same four events.
 */
export type ServicePhase = 'en_route' | 'arrived' | 'started' | 'completed';
export const PHASE_ORDER: ServicePhase[] = ['en_route', 'arrived', 'started', 'completed'];

/**
 * The specialist as the CUSTOMER sees them. Mirrors what `GET /api/auth/orders`
 * returns: a MASKED name (`maskProviderName()` → "Pablo M."), never a full name
 * or contact — anti-disintermediation, enforced backend-side in ~8 routes. The
 * customer sees the relationship (did I use them, do I trust them), never
 * platform-wide reputation. `providerId` is the shared key with the partner
 * app's fixtures (e.g. prov-000117 = Pablo). The trade shown on the card is
 * derived from the order's category, not stored here — the orders route doesn't
 * return specialty.
 */
export type Specialist = {
  providerId: string;
  maskedName: string; // "Pablo M." — first name + last initial, never full
  initials: string;
  trusted: boolean; // this customer saved them (user_trusted_specialists)
  /**
   * Aggregate satisfaction, rolled up from thumbs ratings (service_ratings).
   * NOT stars — the backend only stores 👍/👎, so this is % positive over a
   * count, not a 5-point score. `display:'new'` hides the % below a cold-start
   * floor so a specialist with a couple of ratings can't show a misleading
   * "100%". Backend: GET /api/providers/:providerId/rating.
   */
  providerRating: RatingAggregate;
};

export type RatingAggregate = {
  positivePct: number; // 0–100, share of 👍 among all ratings
  count: number; // total ratings
  display: 'score' | 'new'; // 'new' → too few ratings to show a %
};

export type Order = {
  id: string; // SV-NNNNNN public code (or REQ-… while still an intake request)
  /** Backend row id (all_bookings.id / service_requests.id) — used for API calls. */
  serverId: string;
  /** 'order' = real booking; 'request' = intake not yet converted by admin. */
  source: 'order' | 'request';
  /** This user's 👍/👎 on the order (service_ratings), if any. */
  rating?: 'up' | 'down' | null;
  /** Whether the customer can open a payment link right now (backend policy). */
  payable?: boolean;
  categoryKey: CategoryKey;
  service: Bilingual;
  subLabel: Bilingual;
  mode: RequestMode;
  status: OrderStatus;
  kind: OrderKind;
  urgency: Urgency;
  whenLabel: Bilingual;
  scheduledAt: string | null; // ISO or null (asap)
  addressLabel: string;
  createdAt: string; // ISO
  // Centavos throughout, matching data/pricing.ts (the port of backend/pricing.mjs)
  // and the backend's `*_amount` columns. The provider keeps 100% of their quoted
  // price — booking fee + processing + VAT are added on top and paid by the client.
  price: {
    providerAmountCents: number; // = round(providerPesos * 100)
    bookingFeeAmountCents: number; // SERVI's fee, on top, paid by the client
    processingFeeAmountCents: number;
    vatAmountCents: number;
    totalAmountCents: number; // what the client's card is held for
    confirmed: boolean; // false until SERVI confirms the price (numbers stay 0)
  };
  specialist: Specialist | null;
  timeline: TimelineStep[];
  // What the client wrote/said, and any attachments — the specialist sees these
  // on their side; the customer sees the same thing on theirs.
  description: Bilingual;
  attachments: { kind: 'photo' | 'voice' | 'video'; count: number }[];
  // Follow-up Q&A from the request flow (bilingual, so it renders in the client's
  // language on either app). Backend: `detail_answers` on the service request.
  detailAnswers: { q: Bilingual; a: Bilingual }[];
  // On-site check-in track — SEPARATE from `status`/`timeline`. ISO per reached
  // milestone; mirrors `phaseTimes` from `GET /api/provider/order`.
  phaseTimes: Partial<Record<ServicePhase, string>>;
  // One-shot location share timestamp. NEVER continuous tracking.
  locationSharedAt: string | null;
  // Optional post-service tip, in centavos. 100% goes to the specialist (a tip
  // is added on top, never skimmed). Prototype-only — the backend has no tip
  // support yet (see INTEROP.md "Needs building").
  tipCents?: number;
  leadTimeDays: number; // days between booking and service (drives pre-auth model)
};

// ── User / addresses / payment ─────────────────────────────

export type SavedAddress = {
  id: string;
  label: string; // "Casa", "Oficina"
  line1: string;
  neighborhood: string; // colonia
  city: string;
  isDefault: boolean;
};

export type SavedCard = {
  brand: 'visa' | 'mastercard' | 'amex';
  last4: string;
  exp: string; // MM/YY
  consentOnFile: boolean; // off-session mandate recorded
};

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  firstIdentifierType: 'phone' | 'email';
  isReturning: boolean; // has prior service activity
  card: SavedCard | null;
};

export type Session = {
  status: 'guest' | 'authed';
  user: User | null;
};

/** The in-progress request a user is composing in the builder. */
export type RequestDraft = {
  mode: RequestMode;
  text: string;
  categoryKey: CategoryKey | null;
  subKey: string | null;
  service: Bilingual | null;
  summary: Bilingual | null;
  confidence: number; // 0..1
  followups: Followup[];
  answers: Record<string, string>;
  urgency: Urgency;
  date: string | null; // human label (Hoy / Mañana / +5 días)
  time: string | null; // HH:MM
  leadDays: number; // days until service (drives the pre-auth model)
  addressId: string | null;
  addressText: string;
  source: 'ai' | 'heuristic' | 'voice-ai' | 'photo-ai' | 'video-review' | 'manual';
  adminReview: boolean; // video mode
  /** Uploaded attachment URLs (R2, via POST /api/uploads). */
  attachments: string[];
};

export function loc(b: Bilingual | null | undefined, lang: Lang): string {
  if (!b) return '';
  return b[lang] ?? b.es;
}
