/**
 * Partner-app server layer: typed calls to the SERVI provider API + mapping
 * from wire shapes to the app's domain types (`src/data/types.ts`).
 *
 * Auth model: Firebase phone OTP → POST /api/provider/auth/firebase → a
 * provider-scoped 24h session JWT (scope='provider'). Everything else rides
 * `Authorization: Bearer` through the shared client (`src/lib/client.ts`).
 */
import { api } from '@/lib/client';
import { ApiError } from '@/lib/api';
import { DOCUMENTS, TRADES, findTrade } from '@/data/catalog';
import { isToday } from '@/data/time';
import type {
  Coverage,
  DayAvailability,
  EarningsSummary,
  Job,
  JobPhase,
  OnboardingDraft,
  PriceChange,
  PriceChangeType,
  RatingAggregate,
  Specialist,
  TradeKey,
  Weekday,
} from '@/data/types';

// ── Wire shapes ────────────────────────────────────────────────────────────

type WireProvider = {
  providerId: string;
  status: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  city: string | null;
  tier: string;
  onDuty: boolean;
  coverageZones: string[];
  coverageRadiusKm: number;
  acceptsAsap: boolean;
  rfc: string | null;
  createdAt: string | null;
};

type WireMe = {
  provider: WireProvider;
  trades: { tradeKey: string; skillKey: string | null }[];
  availability: { weekday: number; enabled: boolean; from: string; to: string }[];
  rating: { positivePct?: number; count?: number; display?: string };
  trustedBy: number;
};

type WireJob = {
  id: string;
  publicCode: string | null;
  offer: { id: string; expiresAt: string } | null;
  clientFirstName: string | null;
  category: string | null;
  serviceDescription: string | null;
  serviceAddress: string | null;
  serviceDateTime: string | null;
  serviceDate: string | null;
  isAsap: boolean;
  status: string | null;
  servicePhase: string | null;
  servicePhaseAt: string | null;
  phaseTimes: Partial<Record<JobPhase, string>>;
  priceChanges: { type: string; providerPesos: number | null; note: string | null; previewTotal: number | null; at: string }[];
  detailAnswers: unknown;
  paymentHeld: boolean;
  providerAmountCents: number | null;
  clientTotalCents: number | null;
  createdAt: string;
};

type WireEarnings = {
  summary: Omit<EarningsSummary, 'availableCents'>;
  jobs: {
    id: string;
    publicCode: string | null;
    status: string | null;
    providerAmountCents: number;
    earned: boolean;
  }[];
};

// ── Auth ───────────────────────────────────────────────────────────────────

export class NotAProviderError extends Error {
  constructor() {
    super('not_a_provider');
    this.name = 'NotAProviderError';
  }
}

export async function loginProvider(idToken: string): Promise<WireMe> {
  try {
    const res = await api.post<{ token: string; provider: WireProvider }>(
      '/api/provider/auth/firebase',
      { idToken },
      { anonymous: true },
    );
    await api.setToken(res.token);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'not_a_provider') throw new NotAProviderError();
    throw err;
  }
  return fetchProviderMe();
}

export async function fetchProviderMe(): Promise<WireMe> {
  return api.get<WireMe>('/api/provider/me');
}

export async function logoutProvider(): Promise<void> {
  try {
    await api.post('/api/provider/auth/logout');
  } catch {
    /* best-effort */
  }
  await api.clearToken();
}

// ── Mapping ────────────────────────────────────────────────────────────────

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function mapRating(r: WireMe['rating']): RatingAggregate {
  return {
    positivePct: r?.positivePct ?? 0,
    count: r?.count ?? 0,
    display: r?.display === 'score' ? 'score' : 'new',
  };
}

function mapProviderStatus(s: string): Specialist['status'] {
  const v = String(s || '').toLowerCase();
  if (v === 'verified' || v === 'active') return 'verified';
  if (v === 'review') return 'review';
  if (v === 'pending') return 'pending';
  if (v === 'removed' || v === 'rejected' || v === 'disabled') return 'removed';
  return 'paused';
}

export function mapSpecialist(me: WireMe): Specialist {
  const p = me.provider;
  const name = (p.name || '').trim();
  const [firstName, ...rest] = name.split(/\s+/);
  const tradeKeys = [...new Set(me.trades.map((t) => t.tradeKey))].filter((k): k is TradeKey =>
    TRADES.some((tr) => tr.key === k),
  );
  const skillSet = new Set(me.trades.map((t) => t.skillKey).filter(Boolean));
  return {
    providerId: p.providerId,
    status: mapProviderStatus(p.status),
    firstName: firstName || '—',
    lastName: rest.join(' '),
    initials: `${(firstName || '?')[0] ?? ''}${(rest[0] || '')[0] ?? ''}`.toUpperCase(),
    phone: p.phone || '',
    email: p.email,
    specialty: { es: p.specialty || 'Especialista', en: p.specialty || 'Specialist' },
    city: p.city || 'CDMX',
    memberSince: p.createdAt || new Date().toISOString(),
    providerRating: mapRating(me.rating),
    completedJobs: 0, // refined from earnings once loaded
    reliability: 1,
    acceptance: 1,
    tier: (['nuevo', 'plata', 'oro', 'elite'].includes(p.tier) ? p.tier : 'nuevo') as Specialist['tier'],
    trades: tradeKeys.map((k) => {
      const trade = findTrade(k)!;
      return {
        ...trade,
        skills: skillSet.size
          ? trade.skills.filter((s) => skillSet.has(s.es) || skillSet.has(s.en))
          : trade.skills,
      };
    }),
    documents: DOCUMENTS.map((d) => ({ ...d, status: 'approved' as const })),
    trustedBy: me.trustedBy ?? 0,
  };
}

export function mapCoverage(me: WireMe): Coverage {
  return {
    zones: me.provider.coverageZones ?? [],
    radiusKm: me.provider.coverageRadiusKm ?? 10,
    acceptsAsap: me.provider.acceptsAsap !== false,
  };
}

export function mapAvailability(me: WireMe): DayAvailability[] {
  const byDay = new Map(me.availability.map((a) => [a.weekday, a]));
  return WEEKDAYS.map((day, i) => {
    const row = byDay.get(i);
    return {
      day,
      enabled: row ? row.enabled : i < 6,
      from: row?.from ?? '08:00',
      to: row?.to ?? '18:00',
    };
  });
}

const TRADE_HINTS: [TradeKey, RegExp][] = [
  ['cleaning', /limpi|clean|jardin|garden/i],
  ['repair', /plomer|plumb|electr|repar|repair|instalac|install|manten|carpint|pintur|paint|fuga|leak/i],
  ['moving', /mudanz|moving|flete/i],
  ['wellness', /bienestar|wellness|masaje|massage|cuidado|care|belleza|beauty/i],
  ['suppliers', /compra|shopping|abastec|supply|mandado|errand/i],
];

function mapTradeKey(raw: string | null): TradeKey {
  const s = String(raw || '');
  const exact = TRADES.find((t) => t.key === s);
  if (exact) return exact.key;
  for (const [key, rx] of TRADE_HINTS) if (rx.test(s)) return key;
  return 'repair';
}

function zoneOf(address: string | null): string {
  if (!address) return 'CDMX';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || 'CDMX';
}

function mapDetailAnswers(raw: unknown): Job['detailAnswers'] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        const q = (item as { q?: unknown }).q;
        const a = (item as { a?: unknown }).a;
        const qb = typeof q === 'string' ? { es: q, en: q } : (q as Job['detailAnswers'][0]['q'] | undefined);
        const ab = typeof a === 'string' ? { es: a, en: a } : (a as Job['detailAnswers'][0]['a'] | undefined);
        return qb && ab ? { q: qb, a: ab } : null;
      })
      .filter((x): x is Job['detailAnswers'][0] => x !== null);
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === 'string' && v)
      .map(([k, v]) => ({ q: { es: k, en: k }, a: { es: String(v), en: String(v) } }));
  }
  return [];
}

function mapPriceChanges(list: WireJob['priceChanges']): PriceChange[] {
  return (list || []).map((pc, i) => ({
    id: `pc_${i}_${pc.at}`,
    type: (['precio_corregido', 'horas_adicionales', 'servicio_adicional', 'materiales', 'otro'].includes(pc.type)
      ? pc.type
      : 'otro') as PriceChangeType,
    providerAmountCents: pc.providerPesos != null ? Math.round(pc.providerPesos * 100) : 0,
    note: pc.note,
    clientTotalCents: pc.previewTotal,
    status: 'requested',
    requestedAt: pc.at,
  }));
}

export function mapJob(w: WireJob): Job {
  const status = String(w.status || '').trim().toLowerCase();
  const trade = mapTradeKey(w.category);
  const tradeMeta = findTrade(trade)!;
  const phaseTimes = w.phaseTimes || {};

  let state: Job['state'];
  if (w.offer) state = 'offered';
  else if (status.includes('cancel') || status.includes('refund')) state = 'cancelled';
  else if (status === 'captured') state = 'paid';
  else if (phaseTimes.completed || w.servicePhase === 'completed') state = 'completed';
  else if (w.servicePhase) state = 'active';
  else if (w.isAsap || isToday(w.serviceDateTime)) state = 'today';
  else state = 'scheduled';

  const clientFirst = (w.clientFirstName || 'Cliente').split(/\s+/)[0];

  return {
    id: w.publicCode || w.id.slice(0, 10),
    serverId: w.id,
    state,
    tradeKey: trade,
    service: w.serviceDescription
      ? { es: w.serviceDescription.split('\n')[0].slice(0, 80), en: w.serviceDescription.split('\n')[0].slice(0, 80) }
      : tradeMeta.label,
    subLabel: tradeMeta.label,
    description: { es: w.serviceDescription || '', en: w.serviceDescription || '' },
    detailAnswers: mapDetailAnswers(w.detailAnswers),
    attachments: [],
    client: {
      firstName: clientFirst,
      initials: (clientFirst[0] || 'C').toUpperCase(),
      jobsTogether: 0,
      trustsYou: false,
    },
    address: w.serviceAddress || '',
    zone: zoneOf(w.serviceAddress),
    distanceKm: 0,
    isAsap: !!w.isAsap,
    scheduledAt: w.serviceDateTime,
    estimatedMinutes: 60,
    payoutCents: w.providerAmountCents ?? 0,
    clientTotalCents: w.clientTotalCents ?? 0,
    paymentHeld: !!w.paymentHeld,
    phaseTimes,
    priceChanges: mapPriceChanges(w.priceChanges),
    offerExpiresAt: w.offer?.expiresAt ?? null,
    payoutId: null,
    completedAt: phaseTimes.completed ?? null,
  };
}

// ── Jobs ───────────────────────────────────────────────────────────────────

export async function fetchJobs(): Promise<Job[]> {
  const res = await api.get<{ offers: WireJob[]; jobs: WireJob[] }>('/api/provider/jobs');
  return [...(res.offers ?? []), ...(res.jobs ?? [])].map(mapJob);
}

export async function acceptOfferRemote(serverId: string): Promise<'ok' | 'gone'> {
  try {
    await api.post(`/api/provider/jobs/${encodeURIComponent(serverId)}/accept`);
    return 'ok';
  } catch (err) {
    if (err instanceof ApiError && (err.code === 'offer_gone' || err.code === 'already_assigned')) return 'gone';
    throw err;
  }
}

export async function declineOfferRemote(serverId: string): Promise<void> {
  try {
    await api.post(`/api/provider/jobs/${encodeURIComponent(serverId)}/decline`);
  } catch {
    /* already gone — the local removal stands */
  }
}

export async function checkinRemote(serverId: string, event: JobPhase): Promise<void> {
  await api.post('/api/provider/checkin', { order: serverId, event });
}

export async function locationRemote(serverId: string, lat: number, lng: number, accuracy?: number): Promise<void> {
  await api.post('/api/provider/location', { order: serverId, lat, lng, accuracy });
}

export async function priceChangeRemote(
  serverId: string,
  input: { type: PriceChangeType; pesos: number; note: string },
): Promise<{ total: number | null }> {
  const res = await api.post<{ ok: boolean; preview: { total: number } | null }>(
    '/api/provider/price-change',
    { order: serverId, amount: input.pesos, type: input.type, note: input.note },
  );
  return { total: res.preview?.total ?? null };
}

// ── Profile updates ────────────────────────────────────────────────────────

export async function patchProviderMe(patch: {
  onDuty?: boolean;
  acceptsAsap?: boolean;
  coverageZones?: string[];
  coverageRadiusKm?: number;
  availability?: { weekday: number; enabled: boolean; from: string; to: string }[];
}): Promise<void> {
  await api.patch('/api/provider/me', patch);
}

export function availabilityToWire(list: DayAvailability[]) {
  return list.map((a) => ({
    weekday: WEEKDAYS.indexOf(a.day),
    enabled: a.enabled,
    from: a.from,
    to: a.to,
  }));
}

// ── Earnings ───────────────────────────────────────────────────────────────

export async function fetchEarnings(): Promise<{ summary: EarningsSummary; completedJobs: number }> {
  const res = await api.get<WireEarnings>('/api/provider/earnings');
  return {
    summary: { availableCents: 0, ...res.summary }, // payouts handled by SERVI weekly (Connect deferred)
    completedJobs: (res.jobs ?? []).filter((j) => j.earned).length,
  };
}

// ── Onboarding ─────────────────────────────────────────────────────────────

export async function submitOnboarding(draft: OnboardingDraft): Promise<string | null> {
  try {
    const res = await api.post<{ ok: boolean; applicationId: string }>(
      '/api/provider/onboarding',
      {
        name: `${draft.firstName} ${draft.lastName}`.trim(),
        phone: draft.phone,
        email: draft.email || null,
        city: draft.city,
        specialty: draft.tradeKeys.map((k) => findTrade(k)?.label.es ?? k).join(', '),
        services: draft.skillKeys.join(', '),
        coverageAreas: draft.zones.join(', '),
        experience: [
          draft.acceptsAsap ? 'Acepta trabajos ASAP' : 'Solo agendados',
          `Radio: ${draft.radiusKm} km`,
          draft.rfc ? `RFC: ${draft.rfc}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      },
      { anonymous: true },
    );
    return res.applicationId;
  } catch {
    return null;
  }
}
