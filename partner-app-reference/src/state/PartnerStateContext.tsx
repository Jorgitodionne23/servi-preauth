/**
 * PartnerState — the specialist app's single store, backed by the SERVI
 * provider API.
 *
 * Auth: Firebase phone OTP → POST /api/provider/auth/firebase → provider-scoped
 * 24h session JWT (SecureStore). Jobs/offers poll GET /api/provider/jobs while
 * the app is foregrounded; mutations call the session-auth variants of the
 * existing provider routes (checkin / location / price-change) plus the new
 * accept/decline. Payout balances are deliberately absent — SERVI pays weekly
 * (Stripe Connect deferred), so earnings are read-only reporting.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState as RNAppState } from 'react-native';

import {
  NotAProviderError,
  acceptOfferRemote,
  availabilityToWire,
  checkinRemote,
  declineOfferRemote,
  fetchEarnings,
  fetchJobs,
  fetchProviderMe,
  locationRemote,
  loginProvider,
  logoutProvider,
  mapAvailability,
  mapCoverage,
  mapSpecialist,
  patchProviderMe,
  priceChangeRemote,
  submitOnboarding,
} from '@/api/partner';
import { api, onSessionExpired } from '@/lib/client';
import { firebaseSignOut, sendPhoneCode, type PhoneConfirmation } from '@/lib/firebasePhone';
import { computePricing } from '@/data/pricing';
import { isToday, weekStart, weekdayMon, now } from '@/data/time';
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

const EMPTY_EARNINGS: EarningsSummary = {
  availableCents: 0,
  pendingCents: 0,
  scheduledCents: 0,
  weekCents: 0,
  weekJobs: 0,
  monthCents: 0,
  monthJobs: 0,
  weekByDay: [0, 0, 0, 0, 0, 0, 0],
};

/** Payouts run weekly, handled by SERVI (Stripe Connect deferred). */
const DEFAULT_PAYOUT_ACCOUNT: PayoutAccount = {
  connectAccountId: null,
  status: 'not_started',
  bankName: null,
  last4: null,
  holderName: null,
  schedule: 'weekly',
  rfc: null,
};

const JOBS_POLL_MS = 45_000;

type PartnerState = {
  session: Session;
  sessionLoading: boolean;
  jobs: Job[];
  payouts: Payout[];
  payoutAccount: PayoutAccount;
  availability: DayAvailability[];
  coverage: Coverage;
  onboarding: OnboardingDraft;

  onDuty: boolean;
  toggleDuty: () => void;

  // ── session (Firebase phone OTP → provider session) ──
  beginPhoneAuth: (phoneE164: string) => Promise<void>;
  /** 'ok' signs in; 'not_a_provider' → route to onboarding. */
  confirmPhoneCode: (code: string) => Promise<'ok' | 'not_a_provider'>;
  signOut: () => void;
  submitApplication: () => void;
  applicationSubmitted: boolean;

  // ── onboarding draft ──
  patchOnboarding: (patch: Partial<OnboardingDraft>) => void;
  toggleOnboardingTrade: (key: TradeKey) => void;
  toggleOnboardingSkill: (key: string) => void;
  toggleOnboardingZone: (zone: string) => void;
  setDocument: (key: DocumentKey, status: DocumentStatus) => void;

  // ── jobs ──
  refreshJobs: () => Promise<void>;
  getJob: (id: string) => Job | undefined;
  offers: Job[];
  todayJobs: Job[];
  upcoming: Job[];
  history: Job[];
  activeJob: Job | undefined;

  acceptOffer: (id: string) => void;
  declineOffer: (id: string) => void;
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
};

const Ctx = createContext<PartnerState | null>(null);

export function PartnerStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'signed_out', specialist: null });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [payouts] = useState<Payout[]>([]);
  const [payoutAccount, setPayoutAccount] = useState<PayoutAccount>(DEFAULT_PAYOUT_ACCOUNT);
  const [availability, setAvailabilityState] = useState<DayAvailability[]>([]);
  const [coverage, setCoverageState] = useState<Coverage>({ zones: [], radiusKm: 10, acceptsAsap: true });
  const [onboarding, setOnboarding] = useState<OnboardingDraft>(emptyOnboarding);
  const [onDuty, setOnDuty] = useState(false);
  const [locationSharedFor, setLocationSharedFor] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary>(EMPTY_EARNINGS);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);

  const confirmationRef = useRef<PhoneConfirmation | null>(null);
  const jobsRef = useRef<Job[]>(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const applyMe = useCallback((me: Awaited<ReturnType<typeof fetchProviderMe>>) => {
    setSession({ status: 'authed', specialist: mapSpecialist(me) });
    setCoverageState(mapCoverage(me));
    setAvailabilityState(mapAvailability(me));
    setOnDuty(!!me.provider.onDuty);
    setPayoutAccount((a) => ({ ...a, rfc: me.provider.rfc, holderName: me.provider.name }));
  }, []);

  const refreshJobs = useCallback(async () => {
    try {
      setJobs(await fetchJobs());
    } catch {
      /* transient — next poll retries */
    }
  }, []);

  const refreshEarnings = useCallback(async () => {
    try {
      const { summary, completedJobs } = await fetchEarnings();
      setEarnings(summary);
      setSession((s) =>
        s.specialist ? { ...s, specialist: { ...s.specialist, completedJobs } } : s,
      );
    } catch {
      /* keep last known */
    }
  }, []);

  // Boot: restore persisted provider session.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await api.getToken();
        if (!token) return;
        const me = await fetchProviderMe();
        if (alive) applyMe(me);
      } catch {
        /* expired beyond grace — stay signed out */
      } finally {
        if (alive) setSessionLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [applyMe]);

  // Foreground polling for jobs/offers + earnings while authed.
  useEffect(() => {
    if (session.status !== 'authed') return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      const tick = () => {
        refreshJobs();
        refreshEarnings();
      };
      const tid = setTimeout(tick, 0);
      timer = setInterval(tick, JOBS_POLL_MS);
      cleanupFns.push(() => clearTimeout(tid));
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const cleanupFns: (() => void)[] = [];
    start();
    const sub = RNAppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });
    return () => {
      stop();
      sub.remove();
      cleanupFns.forEach((fn) => fn());
    };
  }, [session.status, refreshJobs, refreshEarnings]);

  useEffect(
    () =>
      onSessionExpired(() => {
        setSession({ status: 'signed_out', specialist: null });
        setJobs([]);
        setEarnings(EMPTY_EARNINGS);
      }),
    [],
  );

  // ── session ────────────────────────────────────────────────
  const beginPhoneAuth = useCallback(async (phoneE164: string) => {
    confirmationRef.current = await sendPhoneCode(phoneE164);
  }, []);

  const confirmPhoneCode = useCallback(
    async (code: string): Promise<'ok' | 'not_a_provider'> => {
      const confirmation = confirmationRef.current;
      if (!confirmation) throw new Error('no_pending_confirmation');
      const { idToken } = await confirmation.confirm(code);
      try {
        const me = await loginProvider(idToken);
        applyMe(me);
        setSessionLoading(false);
        confirmationRef.current = null;
        return 'ok';
      } catch (err) {
        if (err instanceof NotAProviderError) return 'not_a_provider';
        throw err;
      }
    },
    [applyMe],
  );

  const signOut = useCallback(() => {
    logoutProvider().catch(() => {});
    firebaseSignOut().catch(() => {});
    setSession({ status: 'signed_out', specialist: null });
    setJobs([]);
    setEarnings(EMPTY_EARNINGS);
  }, []);

  /** Submits the application to partner_applications (admin Inbox). */
  const submitApplication = useCallback(() => {
    setApplicationSubmitted(true);
    submitOnboarding(onboarding).catch(() => {});
  }, [onboarding]);

  const toggleDuty = useCallback(() => {
    setOnDuty((v) => {
      patchProviderMe({ onDuty: !v }).catch(() => setOnDuty(v));
      return !v;
    });
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

  // ── job mutations (optimistic local + server call) ─────────
  const patchJob = useCallback((id: string, patch: Partial<Job> | ((j: Job) => Partial<Job>)) => {
    setJobs((list) =>
      list.map((j) => (j.id === id ? { ...j, ...(typeof patch === 'function' ? patch(j) : patch) } : j)),
    );
  }, []);

  const serverIdOf = useCallback((id: string) => jobsRef.current.find((j) => j.id === id)?.serverId, []);

  /** POST /api/provider/jobs/:id/accept — race-safe; a lost race re-syncs the list. */
  const acceptOffer = useCallback(
    (id: string) => {
      patchJob(id, (j) => ({
        state: isToday(j.scheduledAt) || j.isAsap ? 'today' : 'scheduled',
        offerExpiresAt: null,
      }));
      const serverId = serverIdOf(id);
      if (!serverId) return;
      acceptOfferRemote(serverId)
        .then((outcome) => {
          if (outcome === 'gone') refreshJobs();
        })
        .catch(() => refreshJobs());
    },
    [patchJob, serverIdOf, refreshJobs],
  );

  /** POST /api/provider/jobs/:id/decline — SERVI re-routes it. */
  const declineOffer = useCallback(
    (id: string) => {
      const serverId = serverIdOf(id);
      setJobs((list) => list.filter((j) => j.id !== id));
      if (serverId) declineOfferRemote(serverId);
    },
    [serverIdOf],
  );

  /** POST /api/provider/checkin — drives the customer's live timeline. */
  const checkIn = useCallback(
    (id: string, phase: JobPhase) => {
      patchJob(id, (j) => ({
        state: phase === 'completed' ? 'completed' : 'active',
        phaseTimes: { ...j.phaseTimes, [phase]: new Date().toISOString() },
        completedAt: phase === 'completed' ? new Date().toISOString() : j.completedAt,
      }));
      const serverId = serverIdOf(id);
      if (serverId) checkinRemote(serverId, phase).catch(() => refreshJobs());
    },
    [patchJob, serverIdOf, refreshJobs],
  );

  /** POST /api/provider/location — one-shot GPS share, never continuous tracking. */
  const shareLocation = useCallback(
    (id: string) => {
      const serverId = serverIdOf(id);
      if (!serverId) return;
      (async () => {
        try {
          // Lazy import: expo-location is a native module, absent on web preview.
          const Location = await import('expo-location');
          const perm = await Location.requestForegroundPermissionsAsync();
          if (!perm.granted) return;
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          await locationRemote(serverId, pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? undefined);
          setLocationSharedFor(id);
        } catch {
          /* denied / unavailable — the button simply stays */
        }
      })();
    },
    [serverIdOf],
  );

  /** POST /api/provider/price-change — records a request; admin mints any charge. */
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
      const serverId = serverIdOf(id);
      if (serverId) priceChangeRemote(serverId, input).catch(() => {});
    },
    [patchJob, serverIdOf],
  );

  const completeJob = useCallback(
    (id: string) => checkIn(id, 'completed'),
    [checkIn],
  );

  /** v1: cancellation goes through SERVI support — local flag only (no provider
   *  self-cancel route; the admin reassigns and the next sync reflects it). */
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

  // ── money ──────────────────────────────────────────────────
  /** Instant cash-out ships with Stripe Connect; availableCents stays 0 until
   *  then, which keeps the button disabled without lying about balances. */
  const cashOut = useCallback(() => {}, []);

  const setPayoutSchedule = useCallback((schedule: PayoutAccount['schedule']) => {
    setPayoutAccount((a) => ({ ...a, schedule }));
  }, []);

  // ── settings ───────────────────────────────────────────────
  const setAvailability = useCallback((next: DayAvailability[]) => {
    setAvailabilityState(next);
    patchProviderMe({ availability: availabilityToWire(next) }).catch(() => {});
  }, []);

  const setCoverage = useCallback((next: Coverage) => {
    setCoverageState(next);
    patchProviderMe({
      coverageZones: next.zones,
      coverageRadiusKm: next.radiusKm,
      acceptsAsap: next.acceptsAsap,
    }).catch(() => {});
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

  const value = useMemo<PartnerState>(
    () => ({
      session, sessionLoading, jobs, payouts, payoutAccount, availability, coverage, onboarding,
      onDuty, toggleDuty,
      beginPhoneAuth, confirmPhoneCode, signOut, submitApplication, applicationSubmitted,
      patchOnboarding, toggleOnboardingTrade, toggleOnboardingSkill, toggleOnboardingZone, setDocument,
      refreshJobs, getJob, offers, todayJobs, upcoming, history, activeJob,
      acceptOffer, declineOffer, checkIn, shareLocation, locationSharedFor,
      requestPriceChange, completeJob, cancelJob,
      earnings, cashOut, setPayoutSchedule,
      setAvailability, setCoverage, toggleTradeSkill,
    }),
    [
      session, sessionLoading, jobs, payouts, payoutAccount, availability, coverage, onboarding,
      onDuty, toggleDuty,
      beginPhoneAuth, confirmPhoneCode, signOut, submitApplication, applicationSubmitted,
      patchOnboarding, toggleOnboardingTrade, toggleOnboardingSkill, toggleOnboardingZone, setDocument,
      refreshJobs, getJob, offers, todayJobs, upcoming, history, activeJob,
      acceptOffer, declineOffer, checkIn, shareLocation, locationSharedFor,
      requestPriceChange, completeJob, cancelJob,
      earnings, cashOut, setPayoutSchedule,
      setAvailability, setCoverage, toggleTradeSkill,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePartner(): PartnerState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePartner must be used within PartnerStateProvider');
  return ctx;
}

// Re-exported for screens that anchor "today" bucketing (kept from the prototype API).
export { isToday, weekStart, weekdayMon, now };
