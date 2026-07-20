/**
 * PartnerState — the prototype's single in-memory store.
 *
 * No persistence, no network. Every mutation below corresponds to a real
 * backend call in production; the mapping is written on each action so this
 * file doubles as the integration spec:
 *
 *   acceptOffer      → POST /api/provider/accept        (to build)
 *   declineOffer     → POST /api/provider/decline       (to build)
 *   checkIn          → POST /api/provider/checkin       ✅ exists today
 *   shareLocation    → POST /api/provider/location      ✅ exists today
 *   requestPriceChange → POST /api/provider/price-change ✅ exists today
 *   completeJob      → POST /api/provider/checkin { event: 'completed' } ✅
 *   cashOut          → Stripe Connect instant payout    (to build)
 *
 * The three ✅ routes already exist in `backend/index.mjs`, token-gated per
 * order. The production partner app swaps that per-order token for a real
 * provider session — see ../../INTEROP.md.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { computePricing } from '@/data/pricing';
import {
  mockAvailability,
  mockCoverage,
  mockJobs,
  mockPayoutAccount,
  mockPayouts,
  mockPendingSpecialist,
  mockSpecialist,
} from '@/data/mockData';
import { DEMO_NOW, isToday, weekStart, weekdayMon } from '@/data/time';
import type {
  Coverage,
  DayAvailability,
  DocumentKey,
  DocumentStatus,
  EarningsSummary,
  Job,
  JobPhase,
  OnboardingDraft,
  Payout,
  PayoutAccount,
  PriceChangeType,
  Session,
  Specialist,
  TradeKey,
} from '@/data/types';

function emptyOnboarding(): OnboardingDraft {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    city: 'Cuajimalpa, CDMX',
    tradeKeys: [],
    skillKeys: [],
    zones: [],
    radiusKm: 10,
    acceptsAsap: true,
    documents: {
      id_front: 'missing',
      id_back: 'missing',
      selfie: 'missing',
      address_proof: 'missing',
      certification: 'missing',
    },
    bankHolder: '',
    clabe: '',
    rfc: '',
    acceptedTerms: false,
  };
}

type PartnerState = {
  session: Session;
  jobs: Job[];
  payouts: Payout[];
  payoutAccount: PayoutAccount;
  availability: DayAvailability[];
  coverage: Coverage;
  onboarding: OnboardingDraft;

  /** On/off shift. Off duty means no new offers — the single most consequential
   *  control in the app, which is why it lives in the Today header. */
  onDuty: boolean;
  toggleDuty: () => void;

  // ── session ──
  signIn: () => void;
  signOut: () => void;
  submitApplication: () => void;

  // ── onboarding draft ──
  patchOnboarding: (patch: Partial<OnboardingDraft>) => void;
  toggleOnboardingTrade: (key: TradeKey) => void;
  toggleOnboardingSkill: (key: string) => void;
  toggleOnboardingZone: (zone: string) => void;
  setDocument: (key: DocumentKey, status: DocumentStatus) => void;

  // ── jobs ──
  getJob: (id: string) => Job | undefined;
  offers: Job[];
  todayJobs: Job[];
  upcoming: Job[];
  history: Job[];
  activeJob: Job | undefined;

  acceptOffer: (id: string) => void;
  declineOffer: (id: string) => void;
  /** Advance the on-site milestone. Mirrors POST /api/provider/checkin. */
  checkIn: (id: string, phase: JobPhase) => void;
  shareLocation: (id: string) => void;
  locationSharedFor: string | null;
  requestPriceChange: (
    id: string,
    input: { type: PriceChangeType; pesos: number; note: string },
  ) => void;
  completeJob: (id: string) => void;
  cancelJob: (id: string) => void;

  // ── money ──
  earnings: EarningsSummary;
  cashOut: () => void;
  setPayoutSchedule: (schedule: PayoutAccount['schedule']) => void;

  // ── settings ──
  setAvailability: (next: DayAvailability[]) => void;
  setCoverage: (next: Coverage) => void;
  toggleTradeSkill: (skillEs: string) => void;

  // ── demo controls ──
  simulateOffer: () => void;
  setVerificationState: (status: Specialist['status']) => void;
  resetDemo: () => void;
};

const Ctx = createContext<PartnerState | null>(null);

/** Instant cash-out fee: 1.5%, min $10. Gold+ tiers get it free (see catalog). */
const INSTANT_FEE_RATE = 0.015;
const INSTANT_FEE_MIN_CENTS = 1000;

let simSeq = 900;

export function PartnerStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({
    status: 'authed',
    specialist: mockSpecialist,
  });
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [payouts, setPayouts] = useState<Payout[]>(mockPayouts);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount>(mockPayoutAccount);
  const [availability, setAvailability] = useState<DayAvailability[]>(mockAvailability);
  const [coverage, setCoverage] = useState<Coverage>(mockCoverage);
  const [onboarding, setOnboarding] = useState<OnboardingDraft>(emptyOnboarding);
  const [onDuty, setOnDuty] = useState(true);
  const [locationSharedFor, setLocationSharedFor] = useState<string | null>(null);

  const toggleDuty = useCallback(() => setOnDuty((v) => !v), []);

  // ── session ────────────────────────────────────────────────
  const signIn = useCallback(
    () => setSession({ status: 'authed', specialist: mockSpecialist }),
    [],
  );
  const signOut = useCallback(() => setSession({ status: 'signed_out', specialist: null }), []);

  /** Submitting the application creates a `review`-status provider. They can
   *  explore the app but receive no offers until SERVI verifies them. */
  const submitApplication = useCallback(() => {
    setSession({ status: 'authed', specialist: mockPendingSpecialist });
    setJobs([]);
    setPayouts([]);
  }, []);

  // ── onboarding ─────────────────────────────────────────────
  const patchOnboarding = useCallback((patch: Partial<OnboardingDraft>) => {
    setOnboarding((d) => ({ ...d, ...patch }));
  }, []);

  const toggleOnboardingTrade = useCallback((key: TradeKey) => {
    setOnboarding((d) => ({
      ...d,
      tradeKeys: d.tradeKeys.includes(key)
        ? d.tradeKeys.filter((k) => k !== key)
        : [...d.tradeKeys, key],
    }));
  }, []);

  const toggleOnboardingSkill = useCallback((key: string) => {
    setOnboarding((d) => ({
      ...d,
      skillKeys: d.skillKeys.includes(key)
        ? d.skillKeys.filter((k) => k !== key)
        : [...d.skillKeys, key],
    }));
  }, []);

  const toggleOnboardingZone = useCallback((zone: string) => {
    setOnboarding((d) => ({
      ...d,
      zones: d.zones.includes(zone) ? d.zones.filter((z) => z !== zone) : [...d.zones, zone],
    }));
  }, []);

  const setDocument = useCallback((key: DocumentKey, status: DocumentStatus) => {
    setOnboarding((d) => ({ ...d, documents: { ...d.documents, [key]: status } }));
  }, []);

  // ── job mutations ──────────────────────────────────────────
  const patchJob = useCallback((id: string, patch: Partial<Job> | ((j: Job) => Partial<Job>)) => {
    setJobs((list) =>
      list.map((j) => (j.id === id ? { ...j, ...(typeof patch === 'function' ? patch(j) : patch) } : j)),
    );
  }, []);

  /** POST /api/provider/accept — the offer becomes a committed job and the
   *  full address is revealed. Today's jobs go straight to `today`. */
  const acceptOffer = useCallback(
    (id: string) => {
      patchJob(id, (j) => ({
        state: isToday(j.scheduledAt) || j.isAsap ? 'today' : 'scheduled',
        offerExpiresAt: null,
      }));
    },
    [patchJob],
  );

  /** POST /api/provider/decline — SERVI re-routes it to another specialist.
   *  We drop it from the list entirely; the specialist shouldn't keep staring
   *  at work they turned down. */
  const declineOffer = useCallback((id: string) => {
    setJobs((list) => list.filter((j) => j.id !== id));
  }, []);

  /**
   * POST /api/provider/checkin { order, pt, event }
   * Records the milestone and flips the job to `active` on first check-in.
   * The customer app's timeline is driven by exactly these events.
   */
  const checkIn = useCallback(
    (id: string, phase: JobPhase) => {
      patchJob(id, (j) => ({
        state: phase === 'completed' ? 'completed' : 'active',
        phaseTimes: { ...j.phaseTimes, [phase]: new Date().toISOString() },
        completedAt: phase === 'completed' ? new Date().toISOString() : j.completedAt,
      }));
    },
    [patchJob],
  );

  /** POST /api/provider/location — one-shot share, never continuous tracking. */
  const shareLocation = useCallback((id: string) => setLocationSharedFor(id), []);

  /**
   * POST /api/provider/price-change — records the request and returns the
   * client-facing preview from `computePricing`. It does NOT move money: an
   * admin turns it into a chargeable adjustment. That separation is why a
   * specialist can never quietly inflate a job.
   */
  const requestPriceChange = useCallback(
    (id: string, input: { type: PriceChangeType; pesos: number; note: string }) => {
      const preview = input.pesos > 0 ? computePricing(input.pesos) : null;
      patchJob(id, (j) => ({
        priceChanges: [
          ...j.priceChanges,
          {
            id: `pc_${id}_${j.priceChanges.length + 1}`,
            type: input.type,
            providerAmountCents: Math.round(input.pesos * 100),
            note: input.note.trim() || null,
            clientTotalCents: preview ? preview.totalAmountCents : null,
            status: 'requested' as const,
            requestedAt: new Date().toISOString(),
          },
        ],
      }));
    },
    [patchJob],
  );

  const completeJob = useCallback((id: string) => {
    patchJob(id, (j) => ({
      state: 'completed',
      completedAt: new Date().toISOString(),
      phaseTimes: { ...j.phaseTimes, completed: j.phaseTimes.completed ?? new Date().toISOString() },
    }));
  }, [patchJob]);

  const cancelJob = useCallback((id: string) => patchJob(id, { state: 'cancelled' }), [patchJob]);

  // ── derived job lists ──────────────────────────────────────
  const getJob = useCallback((id: string) => jobs.find((j) => j.id === id), [jobs]);

  const offers = useMemo(() => jobs.filter((j) => j.state === 'offered'), [jobs]);

  const activeJob = useMemo(() => jobs.find((j) => j.state === 'active'), [jobs]);

  const todayJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.state === 'today' || j.state === 'active')
        .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')),
    [jobs],
  );

  const upcoming = useMemo(
    () =>
      jobs
        .filter((j) => j.state === 'scheduled' || j.state === 'today' || j.state === 'active')
        .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '')),
    [jobs],
  );

  const history = useMemo(
    () =>
      jobs
        .filter((j) => j.state === 'completed' || j.state === 'paid' || j.state === 'cancelled')
        .sort((a, b) => (b.completedAt ?? b.scheduledAt ?? '').localeCompare(a.completedAt ?? a.scheduledAt ?? '')),
    [jobs],
  );

  // ── earnings ───────────────────────────────────────────────
  /**
   * Three money buckets, deliberately distinct because they answer three
   * different questions a specialist actually asks:
   *   available  — "can I take this money out right now?"
   *   pending    — "did the job I finished yesterday count?"
   *   scheduled  — "what am I going to make this week?"
   * Approved surcharges count toward earnings; requested ones never do —
   * showing money that might not arrive is how you lose someone's trust.
   */
  const earnings = useMemo<EarningsSummary>(() => {
    const earned = (j: Job) =>
      j.payoutCents +
      j.priceChanges
        .filter((pc) => pc.status === 'approved' || pc.status === 'paid')
        .reduce((sum, pc) => sum + pc.providerAmountCents, 0);

    const pendingCents = jobs
      .filter((j) => j.state === 'completed')
      .reduce((s, j) => s + earned(j), 0);

    const scheduledCents = jobs
      .filter((j) => j.state === 'scheduled' || j.state === 'today' || j.state === 'active')
      .reduce((s, j) => s + earned(j), 0);

    const availableCents = payouts
      .filter((p) => p.status === 'pending')
      .reduce((s, p) => s + p.amountCents, 0);

    const ws = weekStart().getTime();
    const weekJobsList = jobs.filter(
      (j) => j.completedAt && new Date(j.completedAt).getTime() >= ws,
    );
    const monthStart = new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), 1).getTime();
    const monthJobsList = jobs.filter(
      (j) => j.completedAt && new Date(j.completedAt).getTime() >= monthStart,
    );

    const weekByDay = Array.from({ length: 7 }, () => 0);
    for (const j of weekJobsList) {
      const idx = weekdayMon(j.completedAt!); // Mon = 0, CDMX-fixed
      weekByDay[idx] += earned(j);
    }

    return {
      availableCents,
      pendingCents,
      scheduledCents,
      weekCents: weekJobsList.reduce((s, j) => s + earned(j), 0),
      weekJobs: weekJobsList.length,
      monthCents: monthJobsList.reduce((s, j) => s + earned(j), 0),
      monthJobs: monthJobsList.length,
      weekByDay,
    };
  }, [jobs, payouts]);

  /** Instant payout — collapses every pending payout into one immediate
   *  transfer, minus the instant fee (waived for oro/elite). */
  const cashOut = useCallback(() => {
    setPayouts((list) => {
      const pending = list.filter((p) => p.status === 'pending');
      if (!pending.length) return list;
      const gross = pending.reduce((s, p) => s + p.amountCents, 0);
      const tier = session.specialist?.tier;
      const waived = tier === 'oro' || tier === 'elite';
      const fee = waived
        ? 0
        : Math.max(INSTANT_FEE_MIN_CENTS, Math.round(gross * INSTANT_FEE_RATE));
      const instant: Payout = {
        id: `po_instant_${simSeq++}`,
        amountCents: gross - fee,
        jobIds: pending.flatMap((p) => p.jobIds),
        status: 'in_transit',
        arrivesAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        createdAt: new Date().toISOString(),
        last4: payoutAccount.last4 ?? '0000',
        feeCents: fee,
        instant: true,
      };
      return [instant, ...list.filter((p) => p.status !== 'pending')];
    });
  }, [payoutAccount.last4, session.specialist?.tier]);

  const setPayoutSchedule = useCallback((schedule: PayoutAccount['schedule']) => {
    setPayoutAccount((a) => ({ ...a, schedule }));
  }, []);

  const toggleTradeSkill = useCallback((skillEs: string) => {
    setSession((s) => {
      if (!s.specialist) return s;
      const trades = s.specialist.trades.map((t) => ({
        ...t,
        skills: t.skills.some((sk) => sk.es === skillEs)
          ? t.skills.filter((sk) => sk.es !== skillEs)
          : t.skills,
      }));
      return { ...s, specialist: { ...s.specialist, trades } };
    });
  }, []);

  // ── demo controls ──────────────────────────────────────────
  /** Injects a fresh offer so a reviewer can exercise accept/decline without
   *  reloading. Uses the real pricing engine like every other job. */
  const simulateOffer = useCallback(() => {
    const pesos = 300 + Math.round((simSeq % 7) * 85);
    const p = computePricing(pesos);
    const id = `SV-2049${simSeq++}`;
    setJobs((list) => [
      {
        id,
        state: 'offered',
        tradeKey: 'repair',
        service: { es: 'Fuga en llave de lavabo', en: 'Leaking sink faucet' },
        subLabel: { es: 'Plomería', en: 'Plumbing' },
        description: {
          es: 'La llave del lavabo gotea constantemente y ya no cierra bien.',
          en: 'The sink faucet drips constantly and no longer shuts off properly.',
        },
        detailAnswers: [
          { q: { es: '¿Gotea o escurre?', en: 'Drip or flow?' }, a: { es: 'Gotea', en: 'Drip' } },
        ],
        attachments: [{ kind: 'photo', count: 1 }],
        client: { firstName: 'Nuevo', initials: 'N', jobsTogether: 0, trustsYou: false },
        address: 'Av. Santa Fe 94, Santa Fe',
        zone: 'Santa Fe',
        distanceKm: 1.4,
        isAsap: true,
        scheduledAt: null,
        estimatedMinutes: 45,
        payoutCents: p.providerAmountCents,
        clientTotalCents: p.totalAmountCents,
        // Simulated ASAP offers are same-day, so the hold is already in place.
        paymentHeld: true,
        phaseTimes: {},
        priceChanges: [],
        offerExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
        payoutId: null,
        completedAt: null,
      },
      ...list,
    ]);
  }, []);

  const setVerificationState = useCallback((status: Specialist['status']) => {
    setSession((s) => (s.specialist ? { ...s, specialist: { ...s.specialist, status } } : s));
  }, []);

  const resetDemo = useCallback(() => {
    setSession({ status: 'authed', specialist: mockSpecialist });
    setJobs(mockJobs);
    setPayouts(mockPayouts);
    setPayoutAccount(mockPayoutAccount);
    setAvailability(mockAvailability);
    setCoverage(mockCoverage);
    setOnboarding(emptyOnboarding());
    setOnDuty(true);
    setLocationSharedFor(null);
  }, []);

  const value = useMemo<PartnerState>(
    () => ({
      session, jobs, payouts, payoutAccount, availability, coverage, onboarding,
      onDuty, toggleDuty,
      signIn, signOut, submitApplication,
      patchOnboarding, toggleOnboardingTrade, toggleOnboardingSkill, toggleOnboardingZone, setDocument,
      getJob, offers, todayJobs, upcoming, history, activeJob,
      acceptOffer, declineOffer, checkIn, shareLocation, locationSharedFor,
      requestPriceChange, completeJob, cancelJob,
      earnings, cashOut, setPayoutSchedule,
      setAvailability, setCoverage, toggleTradeSkill,
      simulateOffer, setVerificationState, resetDemo,
    }),
    [
      session, jobs, payouts, payoutAccount, availability, coverage, onboarding,
      onDuty, toggleDuty,
      signIn, signOut, submitApplication,
      patchOnboarding, toggleOnboardingTrade, toggleOnboardingSkill, toggleOnboardingZone, setDocument,
      getJob, offers, todayJobs, upcoming, history, activeJob,
      acceptOffer, declineOffer, checkIn, shareLocation, locationSharedFor,
      requestPriceChange, completeJob, cancelJob,
      earnings, cashOut, setPayoutSchedule,
      toggleTradeSkill,
      simulateOffer, setVerificationState, resetDemo,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePartner(): PartnerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePartner must be used within PartnerStateProvider');
  return ctx;
}
