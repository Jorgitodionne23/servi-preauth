/**
 * AppState — the prototype's single in-memory store.
 *
 * Holds the mock session, the in-progress request draft, orders, and saved
 * addresses. NO persistence, NO network: a real app would back these with the
 * SERVI API + a store like Zustand/Redux and AsyncStorage. Kept intentionally
 * small so the screens read clearly.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { activeStatuses, mockAddresses, mockOrders, mockUser } from '@/data/mockData';
import { matchText, detectUrgency } from '@/data/matcher';
import { findSub } from '@/data/catalog';
import { PHASE_ORDER } from '@/data/types';
import type {
  Order,
  RequestDraft,
  RequestMode,
  SavedAddress,
  Session,
} from '@/data/types';

function emptyDraft(): RequestDraft {
  return {
    mode: 'text',
    text: '',
    categoryKey: null,
    subKey: null,
    service: null,
    summary: null,
    confidence: 0,
    followups: [],
    answers: {},
    urgency: 'asap',
    date: null,
    time: null,
    leadDays: 0,
    addressId: null,
    addressText: '',
    source: 'manual',
    adminReview: false,
  };
}

type AppState = {
  session: Session;
  orders: Order[];
  addresses: SavedAddress[];
  draft: RequestDraft;

  // demo controls — prototype-only switches so a reviewer can exercise the
  // offline and error states the brief requires. A real app would derive these
  // from NetInfo + actual fetch failures.
  offline: boolean;
  forceError: boolean;
  toggleOffline: () => void;
  toggleForceError: () => void;

  // session
  signIn: () => void;
  signOut: () => void;

  // draft lifecycle
  resetDraft: () => void;
  /** Seed a draft from free text + run the mocked matcher. */
  startFromText: (text: string, mode?: RequestMode) => void;
  /** Seed a draft from a chosen catalog service. */
  startFromService: (categoryKey: string, subKey: string, serviceEs: string, serviceEn: string) => void;
  /** Seed an empty draft in a given capture mode (voice/photos/video). */
  startInMode: (mode: RequestMode) => void;
  patchDraft: (patch: Partial<RequestDraft>) => void;
  setAnswer: (key: string, value: string) => void;

  // submit → creates a pending order, returns its id
  submitRequest: () => string;

  // demo: advance an order's on-site milestone (en_route → arrived → started →
  // completed), mirroring a specialist check-in on the partner app. Lets a
  // reviewer watch the live timeline move without running both apps.
  advancePhase: (orderId: string) => void;

  // Add a post-service tip (centavos) to a captured order. Prototype-only — the
  // backend has no tip support yet (INTEROP.md "Needs building"). 100% goes to
  // the specialist.
  tipOrder: (orderId: string, cents: number) => void;

  // addresses
  addAddress: (a: Omit<SavedAddress, 'id'>) => SavedAddress;
  setDefaultAddress: (id: string) => void;

  // helpers
  getOrder: (id: string) => Order | undefined;
  activeOrder: Order | undefined;
};

const Ctx = createContext<AppState | null>(null);

let orderSeq = 204900;

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'authed', user: mockUser });
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [addresses, setAddresses] = useState<SavedAddress[]>(mockAddresses);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [offline, setOffline] = useState(false);
  const [forceError, setForceError] = useState(false);

  const toggleOffline = useCallback(() => setOffline((v) => !v), []);
  const toggleForceError = useCallback(() => setForceError((v) => !v), []);

  const signIn = useCallback(() => setSession({ status: 'authed', user: mockUser }), []);
  const signOut = useCallback(() => setSession({ status: 'guest', user: null }), []);

  const resetDraft = useCallback(() => setDraft(emptyDraft()), []);

  const startFromText = useCallback((text: string, mode: RequestMode = 'text') => {
    const m = matchText(text);
    setDraft({
      ...emptyDraft(),
      mode,
      text,
      categoryKey: m.categoryKey as RequestDraft['categoryKey'],
      subKey: m.subKey,
      service: m.service,
      summary: m.summary,
      confidence: m.confidence,
      followups: m.followups,
      urgency: detectUrgency(text),
      source: mode === 'text' ? 'heuristic' : `${mode === 'voice' ? 'voice' : 'photo'}-ai`,
    });
  }, []);

  const startFromService = useCallback(
    (categoryKey: string, subKey: string, serviceEs: string, serviceEn: string) => {
      const sub = findSub(categoryKey, subKey);
      setDraft({
        ...emptyDraft(),
        mode: 'text',
        categoryKey: categoryKey as RequestDraft['categoryKey'],
        subKey,
        service: { es: serviceEs, en: serviceEn },
        summary: sub ? { es: sub.label.es, en: sub.label.en } : null,
        confidence: 1,
        followups: sub?.followups ?? [],
        urgency: 'schedule',
        source: 'manual',
      });
    },
    [],
  );

  const startInMode = useCallback((mode: RequestMode) => {
    setDraft({
      ...emptyDraft(),
      mode,
      adminReview: mode === 'video',
      // voice/photos get a representative inferred match so Build looks alive
      ...(mode === 'voice' || mode === 'photos'
        ? {
            categoryKey: 'repair' as RequestDraft['categoryKey'],
            subKey: 'plumbing',
            service: { es: 'Destape de lavabo o fregadero', en: 'Sink or drain unclogging' },
            summary: {
              es: mode === 'voice' ? 'Entendí tu nota de voz.' : 'Leí tus fotos.',
              en: mode === 'voice' ? 'Understood your voice note.' : 'Read your photos.',
            },
            confidence: 0.82,
            source: (mode === 'voice' ? 'voice-ai' : 'photo-ai') as RequestDraft['source'],
          }
        : {}),
    });
  }, []);

  const patchDraft = useCallback((patch: Partial<RequestDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const setAnswer = useCallback((key: string, value: string) => {
    setDraft((d) => {
      const answers = { ...d.answers };
      if (answers[key] === value) delete answers[key];
      else answers[key] = value;
      return { ...d, answers };
    });
  }, []);

  const addAddress = useCallback<AppState['addAddress']>((a) => {
    const created: SavedAddress = { ...a, id: `addr_${Date.now()}` };
    setAddresses((list) => {
      const next = created.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list;
      return [...next, created];
    });
    return created;
  }, []);

  const setDefaultAddress = useCallback((id: string) => {
    setAddresses((list) => list.map((x) => ({ ...x, isDefault: x.id === id })));
  }, []);

  const submitRequest = useCallback((): string => {
    const id = `SV-${orderSeq++}`;
    const addr = addresses.find((a) => a.id === draft.addressId);
    const addressLabel = addr ? `${addr.label} · ${addr.neighborhood}` : draft.addressText || 'Santa Fe';
    const whenLabel =
      draft.urgency === 'asap'
        ? { es: 'Lo antes posible', en: 'As soon as possible' }
        : { es: `${draft.date ?? 'Programado'} · ${draft.time ?? ''}`.trim(), en: `${draft.date ?? 'Scheduled'} · ${draft.time ?? ''}`.trim() };

    const newOrder: Order = {
      id,
      categoryKey: (draft.categoryKey ?? 'custom') as Order['categoryKey'],
      service: draft.service ?? { es: 'Solicitud personalizada', en: 'Custom request' },
      subLabel: draft.summary ?? { es: 'Personalizado', en: 'Custom' },
      mode: draft.mode,
      status: 'pending',
      kind: 'primary',
      urgency: draft.urgency,
      whenLabel,
      scheduledAt: null,
      addressLabel,
      createdAt: new Date().toISOString(),
      price: {
        providerAmountCents: 0,
        bookingFeeAmountCents: 0,
        processingFeeAmountCents: 0,
        vatAmountCents: 0,
        totalAmountCents: 0,
        confirmed: false,
      },
      specialist: null,
      timeline: [
        { status: 'pending', at: new Date().toISOString() },
        { status: 'confirmed', at: null },
        { status: 'assigned', at: null },
        { status: 'in_progress', at: null },
        { status: 'completed', at: null },
        { status: 'captured', at: null },
      ],
      description: draft.text
        ? { es: draft.text, en: draft.text } // the client's own words don't translate
        : { es: 'Solicitud sin descripción', en: 'Request without description' },
      attachments:
        draft.mode === 'voice'
          ? [{ kind: 'voice', count: 1 }]
          : draft.mode === 'video'
            ? [{ kind: 'video', count: 1 }]
            : draft.mode === 'photos'
              ? [{ kind: 'photo', count: 1 }]
              : [],
      detailAnswers: draft.followups
        .filter((f) => draft.answers[f.key])
        .map((f) => ({ q: f.q, a: { es: draft.answers[f.key], en: draft.answers[f.key] } })),
      phaseTimes: {},
      locationSharedAt: null,
      leadTimeDays: draft.urgency === 'asap' ? 0 : draft.leadDays,
    };
    setOrders((list) => [newOrder, ...list]);
    return id;
  }, [addresses, draft]);

  const advancePhase = useCallback((orderId: string) => {
    setOrders((list) =>
      list.map((o) => {
        if (o.id !== orderId) return o;
        const next = PHASE_ORDER.find((p) => !o.phaseTimes[p]);
        if (!next) return o; // already completed all milestones
        const at = new Date().toISOString();
        const phaseTimes = { ...o.phaseTimes, [next]: at };
        // The payment/coordination status is separate from the on-site phase
        // (as in the backend), but nudge it forward so the demo reads coherently.
        let status = o.status;
        if (next === 'started') status = 'in_progress';
        if (next === 'completed') status = 'completed';
        const timeline = o.timeline.map((s) => (s.status === status && !s.at ? { ...s, at } : s));
        return { ...o, phaseTimes, status, timeline };
      }),
    );
  }, []);

  const tipOrder = useCallback((orderId: string, cents: number) => {
    setOrders((list) => list.map((o) => (o.id === orderId ? { ...o, tipCents: cents } : o)));
  }, []);

  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);
  const activeOrder = useMemo(
    () => orders.find((o) => activeStatuses.includes(o.status)),
    [orders],
  );

  const value = useMemo<AppState>(
    () => ({
      session,
      orders,
      addresses,
      draft,
      offline,
      forceError,
      toggleOffline,
      toggleForceError,
      signIn,
      signOut,
      resetDraft,
      startFromText,
      startFromService,
      startInMode,
      patchDraft,
      setAnswer,
      submitRequest,
      advancePhase,
      tipOrder,
      addAddress,
      setDefaultAddress,
      getOrder,
      activeOrder,
    }),
    [
      session,
      orders,
      addresses,
      draft,
      offline,
      forceError,
      toggleOffline,
      toggleForceError,
      signIn,
      signOut,
      resetDraft,
      startFromText,
      startFromService,
      startInMode,
      patchDraft,
      setAnswer,
      submitRequest,
      advancePhase,
      tipOrder,
      addAddress,
      setDefaultAddress,
      getOrder,
      activeOrder,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppStateProvider');
  return ctx;
}
