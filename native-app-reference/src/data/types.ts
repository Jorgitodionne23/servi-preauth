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

export type Specialist = {
  name: string;
  initials: string;
  rating: number;
  jobs: number;
  trade: Bilingual;
  trusted?: boolean;
};

export type Order = {
  id: string; // SV-NNNNNN public code
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
  price: {
    provider: number;
    bookingFee: number;
    processing: number;
    total: number;
    currency: 'MXN';
    confirmed: boolean; // false until SERVI confirms the price
  };
  specialist: Specialist | null;
  timeline: TimelineStep[];
  detailAnswers?: Record<string, string>;
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
};

export function loc(b: Bilingual | null | undefined, lang: Lang): string {
  if (!b) return '';
  return b[lang] ?? b.es;
}
