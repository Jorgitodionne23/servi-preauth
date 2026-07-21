/**
 * Customer-app server layer: typed calls to the SERVI backend + mapping from
 * the backend's wire shapes to the app's domain types (`src/data/types.ts`).
 *
 * Everything goes through the shared client (`src/lib/client.ts`) so Bearer
 * auth, refresh-on-401 and error typing are uniform. This file is per-app —
 * the partner app has its own `src/api/partner.ts`.
 */
import { api } from '@/lib/client';
import { webBaseUrl } from '@/lib/config';
import { catalog, findSub } from '@/data/catalog';
import { whenLabel } from '@/data/time';
import type {
  Bilingual,
  CategoryKey,
  Followup,
  Order,
  OrderStatus,
  RatingAggregate,
  SavedAddress,
  ServicePhase,
  User,
} from '@/data/types';

// ── Wire shapes (subset of what the backend returns) ───────────────────────

export type ServerUser = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  phone_verified?: boolean;
  email_verified?: boolean;
  phoneVerified?: boolean;
  emailVerified?: boolean;
};

export type ServerOrderItem = {
  id: string;
  source: 'order' | 'request';
  publicCode: string | null;
  kind?: string;
  status: string | null;
  category: string | null;
  description: string | null;
  serviceDate?: string | null;
  serviceDateTime?: string | null;
  preferredTime?: string | null;
  isAsap: boolean;
  address: string | null;
  providerId?: string | null;
  providerMaskedName?: string | null;
  servicePhase?: string | null;
  servicePhaseAt?: string | null;
  rating?: 'up' | 'down' | null;
  rated?: boolean;
  payable?: boolean;
  matchedService?: string | null;
  matchedSubKey?: string | null;
  createdAt: string;
  pricing?: {
    total: number | null;
    amount: number | null;
    providerAmount: number | null;
    bookingFee: number | null;
    processingFee: number | null;
    vat: number | null;
  };
};

export type ServerAddress = {
  id: string;
  label: string | null;
  street: string | null;
  line1?: string | null;
  neighborhood: string | null;
  city: string | null;
  is_default?: boolean;
  isDefault?: boolean;
};

export type ParseResult = {
  category: string;
  subKey: string | null;
  service: string | null;
  summary: string;
  confidence: number;
  urgency: string;
  followups: { q: string; key: string; chips?: string[] }[];
  understandingStatus: string;
};

// ── Auth ───────────────────────────────────────────────────────────────────

export async function loginWithFirebase(idToken: string, opts?: { name?: string }) {
  const res = await api.post<{ token: string; user: ServerUser }>(
    '/api/auth/firebase',
    {
      idToken,
      first_identifier_type: 'phone',
      signup_complete: true,
      terms_accepted: true,
      ...(opts?.name ? { name: opts.name } : {}),
    },
    { anonymous: true },
  );
  await api.setToken(res.token);
  return res.user;
}

export async function fetchMe(): Promise<ServerUser | null> {
  const res = await api.get<{ user: ServerUser }>('/api/auth/me');
  return res.user ?? null;
}

export async function updateName(name: string): Promise<void> {
  await api.patch('/api/auth/me', { name });
}

export async function logout(): Promise<void> {
  try {
    await api.post('/api/auth/logout');
  } catch {
    /* best-effort — the local token is cleared regardless */
  }
  await api.clearToken();
}

export function mapServerUser(u: ServerUser): User {
  const name = (u.name || '').trim();
  const [firstName, ...rest] = name.split(/\s+/);
  return {
    id: u.id,
    firstName: firstName || '—',
    lastName: rest.join(' '),
    phone: u.phone ?? null,
    email: u.email ?? null,
    phoneVerified: Boolean(u.phone_verified ?? u.phoneVerified),
    emailVerified: Boolean(u.email_verified ?? u.emailVerified),
    firstIdentifierType: 'phone',
    isReturning: false,
    card: null, // card state lives on the web payment surface (Stripe), not in-app
  };
}

// ── Orders ─────────────────────────────────────────────────────────────────

/** Statuses that count as "active" for the dock + Orders tab split. */
export const activeStatuses: OrderStatus[] = [
  'pending',
  'scheduled',
  'blocked',
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
];

const CATEGORY_HINTS: [CategoryKey, RegExp][] = [
  ['cleaning', /limpi|clean|jardin|garden/i],
  ['repair', /plomer|plumb|electr|repar|repair|instalac|install|manten|carpint|pintur|paint|fuga|leak/i],
  ['moving', /mudanz|moving|flete|cargar/i],
  ['wellness', /bienestar|wellness|masaje|massage|cuidado|care|belleza|beauty|estilis/i],
  ['suppliers', /compra|shopping|abastec|supply|mandado|errand|super/i],
];

export function mapCategory(raw: string | null | undefined): CategoryKey {
  const s = String(raw || '').trim();
  if (!s) return 'custom';
  const exact = catalog.find((c) => c.key === s);
  if (exact) return exact.key;
  for (const [key, rx] of CATEGORY_HINTS) if (rx.test(s)) return key;
  return 'custom';
}

function mapStatus(r: ServerOrderItem): OrderStatus {
  if (r.source === 'request') return 'pending';
  const s = String(r.status || '').trim().toLowerCase();
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('refund')) return 'refunded';
  if (s === 'captured') return 'captured';
  if (r.servicePhase === 'completed') return 'completed';
  if (r.servicePhase === 'started' || r.servicePhase === 'arrived' || r.servicePhase === 'en_route')
    return 'in_progress';
  if (r.providerId) return 'assigned';
  if (s === 'confirmed') return 'confirmed';
  if (s === 'scheduled') return 'scheduled';
  if (s === 'blocked' || s.startsWith('setup')) return 'blocked';
  return 'pending';
}

function initialsOf(masked: string): string {
  return masked
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const STATUS_SEQ: OrderStatus[] = ['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'captured'];

export function mapServerOrder(r: ServerOrderItem, trustedProviderIds: Set<string>): Order {
  const status = mapStatus(r);
  const category = mapCategory(r.category);
  const sub = r.matchedSubKey ? findSub(category, r.matchedSubKey) : null;
  const serviceLabel: Bilingual = r.matchedService
    ? { es: r.matchedService, en: r.matchedService }
    : sub
      ? { es: sub.services.es[0], en: sub.services.en[0] }
      : { es: r.category || 'Servicio', en: r.category || 'Service' };

  const iso = r.serviceDateTime || null;
  const when: Bilingual = r.isAsap
    ? { es: 'Lo antes posible', en: 'As soon as possible' }
    : iso
      ? { es: whenLabel(iso, 'es'), en: whenLabel(iso, 'en') }
      : { es: 'Por confirmar', en: 'To be confirmed' };

  const phaseTimes: Partial<Record<ServicePhase, string>> = {};
  if (r.servicePhase && r.servicePhaseAt) {
    phaseTimes[r.servicePhase as ServicePhase] = r.servicePhaseAt;
  }

  const reachedIdx = STATUS_SEQ.indexOf(
    status === 'cancelled' || status === 'refunded' || status === 'blocked' || status === 'scheduled'
      ? 'pending'
      : status,
  );
  const timeline = STATUS_SEQ.map((s, i) => ({
    status: s,
    at:
      i > reachedIdx
        ? null
        : s === 'pending'
          ? r.createdAt
          : s === 'in_progress'
            ? (phaseTimes.started ?? r.createdAt)
            : s === 'completed'
              ? (phaseTimes.completed ?? r.createdAt)
              : r.createdAt,
  }));

  const p = r.pricing;
  const leadMs = iso ? Date.parse(iso) - Date.parse(r.createdAt) : 0;

  return {
    id: r.publicCode || (r.source === 'request' ? `REQ-${r.id.slice(0, 6).toUpperCase()}` : r.id.slice(0, 10)),
    serverId: r.id,
    source: r.source,
    categoryKey: category,
    service: serviceLabel,
    subLabel: sub ? sub.label : { es: r.category || 'Servicio', en: r.category || 'Service' },
    mode: 'text',
    status,
    kind: (['primary', 'book', 'setup', 'setup_required'].includes(String(r.kind || '')) ? r.kind : 'primary') as Order['kind'],
    urgency: r.isAsap ? 'asap' : 'schedule',
    whenLabel: when,
    scheduledAt: iso,
    addressLabel: r.address || '—',
    createdAt: r.createdAt,
    price: {
      providerAmountCents: p?.providerAmount ?? 0,
      bookingFeeAmountCents: p?.bookingFee ?? 0,
      processingFeeAmountCents: p?.processingFee ?? 0,
      vatAmountCents: p?.vat ?? 0,
      totalAmountCents: p?.total ?? p?.amount ?? 0,
      confirmed: (p?.total ?? p?.amount) != null,
    },
    specialist:
      r.providerId && r.providerMaskedName
        ? {
            providerId: r.providerId,
            maskedName: r.providerMaskedName,
            initials: initialsOf(r.providerMaskedName),
            trusted: trustedProviderIds.has(r.providerId),
            providerRating: { positivePct: 0, count: 0, display: 'new' },
          }
        : null,
    timeline,
    description: { es: r.description || '', en: r.description || '' },
    attachments: [],
    detailAnswers: [],
    phaseTimes,
    locationSharedAt: null,
    rating: r.rating ?? null,
    payable: Boolean(r.payable),
    leadTimeDays: leadMs > 0 ? Math.round(leadMs / 86_400_000) : 0,
  };
}

export async function fetchOrders(): Promise<{ items: ServerOrderItem[] }> {
  const res = await api.get<{ orders: ServerOrderItem[] }>('/api/auth/orders');
  return { items: res.orders ?? [] };
}

export async function fetchTrustedProviderIds(): Promise<Set<string>> {
  try {
    const res = await api.get<{ specialists?: { providerId?: string; provider_id?: string }[] }>(
      '/api/auth/trusted-specialists',
    );
    const list = res.specialists ?? [];
    return new Set(list.map((s) => String(s.providerId ?? s.provider_id ?? '')).filter(Boolean));
  } catch {
    return new Set();
  }
}

export async function fetchLifecycle(serverId: string): Promise<Partial<Record<ServicePhase, string>>> {
  const res = await api.get<{ phaseTimes: Partial<Record<ServicePhase, string>> }>(
    `/api/auth/orders/${encodeURIComponent(serverId)}/lifecycle`,
  );
  return res.phaseTimes ?? {};
}

export async function fetchProviderRating(providerId: string): Promise<RatingAggregate> {
  const res = await api.get<{ positivePct?: number; count?: number; display?: string }>(
    `/api/auth/providers/${encodeURIComponent(providerId)}/rating`,
  );
  return {
    positivePct: res.positivePct ?? 0,
    count: res.count ?? 0,
    display: res.display === 'score' ? 'score' : 'new',
  };
}

export async function rateOrder(serverId: string, rating: 'up' | 'down', comment?: string) {
  return api.post<{ ok: boolean; promptTrust?: boolean }>(
    `/api/auth/orders/${encodeURIComponent(serverId)}/rating`,
    { rating, comment: comment || undefined },
  );
}

/** Mint a fresh 2h payment link for an owned payable order → absolute URL to open. */
export async function mintPaymentLink(serverId: string): Promise<string> {
  const res = await api.post<{ ok: boolean; flow: string; rt: string; orderId: string }>(
    `/api/auth/orders/${encodeURIComponent(serverId)}/payment-link`,
  );
  const page = res.flow === 'book' ? '/book.html' : '/pay.html';
  const q = encodeURIComponent(res.orderId);
  return `${webBaseUrl()}${page}?order=${q}&orderId=${q}&rt=${encodeURIComponent(res.rt)}&from=app`;
}

// ── Smart Request parse ────────────────────────────────────────────────────

export async function parseRequestText(text: string, lang: 'es' | 'en'): Promise<ParseResult | null> {
  try {
    return await api.post<ParseResult>('/api/parse-request', { text, lang }, { anonymous: true });
  } catch {
    return null; // heuristic fallback handles it
  }
}

export function parseFollowupsToApp(followups: ParseResult['followups']): Followup[] {
  return (followups || []).map((f, i) => ({
    key: f.key || `q_${i}`,
    q: { es: f.q, en: f.q },
    ...(f.chips?.length ? { chips: f.chips.map((c) => ({ es: c, en: c })) } : {}),
  }));
}

// ── Service request submission ─────────────────────────────────────────────

export type SubmitInput = {
  category: string;
  description: string;
  isAsap: boolean;
  preferredDate: string | null;
  preferredTime: string | null;
  serviceAddress: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string | null;
  lang: 'es' | 'en';
  attachments: string[];
  clientRequestId: string;
  matchedService: string | null;
  matchedSubKey: string | null;
  aiSummary: string | null;
  aiConfidence: number;
  aiSource: string;
  detailAnswers: Record<string, string>;
};

export async function submitServiceRequest(input: SubmitInput): Promise<{ id: string }> {
  // Deliberately the LEGACY contract (no `requestMode`): the app's builder already
  // resolved the request interactively, and the strict Smart Request understanding
  // gate is web-flow-shaped. All enrichment columns still persist.
  return api.post<{ id: string; status: string }>('/api/service-requests', input);
}

// ── Media uploads (R2) ─────────────────────────────────────────────────────

export async function uploadMedia(uri: string, name: string, mimeType: string): Promise<string> {
  const form = new FormData();
  // React Native FormData file part.
  form.append('file', { uri, name, type: mimeType } as unknown as Blob);
  const res = await api.post<{ url: string }>('/api/uploads', undefined, {
    anonymous: true,
    formData: form,
    timeoutMs: 120_000,
  });
  return res.url;
}

// ── Addresses ──────────────────────────────────────────────────────────────

function mapAddress(a: ServerAddress): SavedAddress {
  return {
    id: a.id,
    label: a.label || 'Dirección',
    line1: a.street || a.line1 || '',
    neighborhood: a.neighborhood || '',
    city: a.city || 'CDMX',
    isDefault: Boolean(a.is_default ?? a.isDefault),
  };
}

export async function fetchAddresses(): Promise<SavedAddress[]> {
  const res = await api.get<{ addresses: ServerAddress[] }>('/api/auth/addresses');
  return (res.addresses ?? []).map(mapAddress);
}

export async function createAddress(a: Omit<SavedAddress, 'id'>): Promise<SavedAddress | null> {
  try {
    const res = await api.post<{ address?: ServerAddress; id?: string }>('/api/auth/addresses', {
      label: a.label,
      street: a.line1,
      neighborhood: a.neighborhood,
      city: a.city,
      isDefault: a.isDefault,
    });
    if (res.address) return mapAddress(res.address);
    if (res.id) return { ...a, id: res.id };
    return null;
  } catch {
    return null;
  }
}

export async function setDefaultAddressRemote(id: string): Promise<void> {
  try {
    await api.patch(`/api/auth/addresses/${encodeURIComponent(id)}/default`);
  } catch {
    /* optimistic UI keeps the local flag; next fetch reconciles */
  }
}
