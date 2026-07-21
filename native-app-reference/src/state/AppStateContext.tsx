/**
 * AppState — the customer app's single store, backed by the SERVI backend.
 *
 * Session: Firebase phone OTP → POST /api/auth/firebase → 24h session JWT
 * (persisted in SecureStore via src/lib/session). Orders/addresses load from
 * /api/auth/* once signed in; the request draft stays local until submission
 * posts it to POST /api/service-requests (same pipeline as web + WhatsApp —
 * it lands in the admin inbox as a WEB-… row).
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

import {
  activeStatuses,
  createAddress,
  fetchAddresses,
  fetchLifecycle,
  fetchMe,
  fetchOrders,
  fetchProviderRating,
  fetchTrustedProviderIds,
  loginWithFirebase,
  logout as logoutRemote,
  mapServerUser,
  mapServerOrder,
  mintPaymentLink,
  parseFollowupsToApp,
  parseRequestText,
  rateOrder as rateOrderRemote,
  setDefaultAddressRemote,
  submitServiceRequest,
  updateName,
  uploadMedia,
} from '@/api/backend';
import { api, onSessionExpired } from '@/lib/client';
import { NetworkError } from '@/lib/api';
import { firebaseSignOut, sendPhoneCode, type PhoneConfirmation } from '@/lib/firebasePhone';
import { matchText, detectUrgency } from '@/data/matcher';
import { findSub } from '@/data/catalog';
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
    attachments: [],
  };
}

function makeRequestId(): string {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type AppState = {
  session: Session;
  sessionLoading: boolean;
  orders: Order[];
  ordersLoading: boolean;
  addresses: SavedAddress[];
  draft: RequestDraft;

  /** True after the last API call failed at the network level; cleared on success. */
  offline: boolean;

  // ── auth (Firebase phone OTP → SERVI session) ──
  /** Send the OTP SMS. Throws on failure (incl. 'firebase_unavailable' in Expo Go/web). */
  beginPhoneAuth: (phoneE164: string) => Promise<void>;
  /** Confirm the code; signs into SERVI. 'needs_name' → route to the name screen. */
  confirmPhoneCode: (code: string) => Promise<'ok' | 'needs_name'>;
  /** Complete signup with the user's name. */
  completeName: (firstName: string, lastName: string) => Promise<void>;
  signOut: () => void;

  // ── data refresh ──
  refreshOrders: () => Promise<Order[]>;
  /** Hydrate one order's live check-in timeline + specialist rating. */
  hydrateOrder: (id: string) => Promise<void>;
  /** Rate a captured order 👍/👎. */
  rateOrder: (id: string, rating: 'up' | 'down') => Promise<void>;
  /** Mint + return the web payment link for a payable order. */
  paymentLinkFor: (id: string) => Promise<string>;

  // ── draft lifecycle ──
  resetDraft: () => void;
  startFromText: (text: string, mode?: RequestMode) => void;
  startFromService: (categoryKey: string, subKey: string, serviceEs: string, serviceEn: string) => void;
  startInMode: (mode: RequestMode) => void;
  patchDraft: (patch: Partial<RequestDraft>) => void;
  setAnswer: (key: string, value: string) => void;
  /** AI parse state for the Build screen. */
  parsing: boolean;
  parseError: boolean;
  retryParse: () => void;
  /** Upload a captured file; appends its URL to draft.attachments. */
  attachMedia: (uri: string, name: string, mimeType: string) => Promise<boolean>;

  // submit → POST /api/service-requests; returns the app-side order id, or null on failure
  submitRequest: () => Promise<string | null>;

  // ── addresses ──
  addAddress: (a: Omit<SavedAddress, 'id'>) => SavedAddress;
  setDefaultAddress: (id: string) => void;

  // helpers
  getOrder: (id: string) => Order | undefined;
  activeOrder: Order | undefined;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ status: 'guest', user: null });
  const [sessionLoading, setSessionLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [draft, setDraft] = useState<RequestDraft>(emptyDraft);
  const [offline, setOffline] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(false);

  const confirmationRef = useRef<PhoneConfirmation | null>(null);
  const pendingPhoneRef = useRef<string | null>(null);
  const parseSeq = useRef(0);
  const clientRequestIdRef = useRef(makeRequestId());

  const noteResult = useCallback((err: unknown | null) => {
    if (err instanceof NetworkError) setOffline(true);
    else if (err === null) setOffline(false);
  }, []);

  // ── boot: restore persisted session ──
  const refreshOrders = useCallback(async (): Promise<Order[]> => {
    setOrdersLoading(true);
    try {
      const [{ items }, trusted] = await Promise.all([fetchOrders(), fetchTrustedProviderIds()]);
      const mapped = items.map((r) => mapServerOrder(r, trusted));
      setOrders(mapped);
      ordersRef.current = mapped;
      noteResult(null);
      return mapped;
    } catch (err) {
      noteResult(err);
      return ordersRef.current;
    } finally {
      setOrdersLoading(false);
    }
  }, [noteResult]);

  const loadAddresses = useCallback(async () => {
    try {
      setAddresses(await fetchAddresses());
      noteResult(null);
    } catch (err) {
      noteResult(err);
    }
  }, [noteResult]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = await api.getToken();
        if (!token) return;
        const u = await fetchMe();
        if (!alive || !u) return;
        setSession({ status: 'authed', user: mapServerUser(u) });
      } catch {
        /* token invalid/expired beyond grace — stay guest */
      } finally {
        if (alive) setSessionLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Load user data whenever we become authed (deferred a tick so the effect
  // body itself never sets state synchronously).
  useEffect(() => {
    if (session.status !== 'authed') return;
    const tid = setTimeout(() => {
      refreshOrders();
      loadAddresses();
    }, 0);
    return () => clearTimeout(tid);
  }, [session.status, refreshOrders, loadAddresses]);

  // Hard logout when a refresh ultimately fails server-side.
  useEffect(
    () =>
      onSessionExpired(() => {
        setSession({ status: 'guest', user: null });
        setOrders([]);
        setAddresses([]);
      }),
    [],
  );

  // ── auth ──
  const beginPhoneAuth = useCallback(async (phoneE164: string) => {
    confirmationRef.current = await sendPhoneCode(phoneE164);
    pendingPhoneRef.current = phoneE164;
  }, []);

  const confirmPhoneCode = useCallback(async (code: string): Promise<'ok' | 'needs_name'> => {
    const confirmation = confirmationRef.current;
    if (!confirmation) throw new Error('no_pending_confirmation');
    const { idToken } = await confirmation.confirm(code);
    const serverUser = await loginWithFirebase(idToken);
    const user = mapServerUser(serverUser);
    setSession({ status: 'authed', user });
    setSessionLoading(false);
    confirmationRef.current = null;
    return (serverUser.name || '').trim() ? 'ok' : 'needs_name';
  }, []);

  const completeName = useCallback(async (firstName: string, lastName: string) => {
    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    await updateName(name);
    setSession((s) =>
      s.user ? { ...s, user: { ...s.user, firstName: firstName.trim(), lastName: lastName.trim() } } : s,
    );
  }, []);

  const signOut = useCallback(() => {
    logoutRemote().catch(() => {});
    firebaseSignOut().catch(() => {});
    setSession({ status: 'guest', user: null });
    setOrders([]);
    setAddresses([]);
  }, []);

  // ── order hydration / actions ──
  const hydrateOrder = useCallback(async (id: string) => {
    const order = ordersRef.current.find((o) => o.id === id);
    if (!order || order.source !== 'order') return;
    try {
      const [phaseTimes, rating] = await Promise.all([
        fetchLifecycle(order.serverId),
        order.specialist ? fetchProviderRating(order.specialist.providerId) : Promise.resolve(null),
      ]);
      setOrders((list) =>
        list.map((o) =>
          o.id === id
            ? {
                ...o,
                phaseTimes: { ...o.phaseTimes, ...phaseTimes },
                specialist:
                  o.specialist && rating ? { ...o.specialist, providerRating: rating } : o.specialist,
              }
            : o,
        ),
      );
      noteResult(null);
    } catch (err) {
      noteResult(err);
    }
  }, [noteResult]);

  const rateOrder = useCallback(async (id: string, rating: 'up' | 'down') => {
    const order = ordersRef.current.find((o) => o.id === id);
    if (!order || order.source !== 'order') return;
    await rateOrderRemote(order.serverId, rating);
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, rating } : o)));
  }, []);

  const paymentLinkFor = useCallback(async (id: string) => {
    const order = ordersRef.current.find((o) => o.id === id);
    if (!order || order.source !== 'order') throw new Error('not_payable');
    return mintPaymentLink(order.serverId);
  }, []);

  // ── draft ──
  const resetDraft = useCallback(() => {
    setDraft(emptyDraft());
    setParseError(false);
    setParsing(false);
    clientRequestIdRef.current = makeRequestId();
  }, []);

  const runAiParse = useCallback((text: string, lang: 'es' | 'en' = 'es') => {
    const seq = ++parseSeq.current;
    setParsing(true);
    setParseError(false);
    parseRequestText(text, lang).then((result) => {
      if (seq !== parseSeq.current) return; // superseded by a newer draft
      setParsing(false);
      if (!result) return; // heuristic result stands
      setDraft((d) => {
        if (d.text !== text) return d;
        const sub = result.subKey ? findSub(result.category, result.subKey) : null;
        return {
          ...d,
          categoryKey: (result.category || d.categoryKey) as RequestDraft['categoryKey'],
          subKey: result.subKey ?? d.subKey,
          service: result.service
            ? { es: result.service, en: result.service }
            : sub
              ? { es: sub.services.es[0], en: sub.services.en[0] }
              : d.service,
          summary: result.summary ? { es: result.summary, en: result.summary } : d.summary,
          confidence: result.confidence || d.confidence,
          followups: result.followups?.length ? parseFollowupsToApp(result.followups) : d.followups,
          source: 'ai',
        };
      });
    });
  }, []);

  const startFromText = useCallback(
    (text: string, mode: RequestMode = 'text') => {
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
        source: 'heuristic',
      });
      runAiParse(text);
    },
    [runAiParse],
  );

  const retryParse = useCallback(() => {
    if (draft.text) runAiParse(draft.text);
    else setParseError(false);
  }, [draft.text, runAiParse]);

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
      // media modes resolve as custom until an admin (or the analyze pipeline) reviews them
      ...(mode === 'voice' || mode === 'photos'
        ? {
            categoryKey: 'custom' as RequestDraft['categoryKey'],
            subKey: 'custom',
            service: { es: 'Solicitud personalizada', en: 'Custom request' },
            summary: {
              es: mode === 'voice' ? 'Recibimos tu nota de voz.' : 'Recibimos tus fotos.',
              en: mode === 'voice' ? 'We received your voice note.' : 'We received your photos.',
            },
            confidence: 0.6,
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

  const attachMedia = useCallback(async (uri: string, name: string, mimeType: string) => {
    try {
      const url = await uploadMedia(uri, name, mimeType);
      setDraft((d) => ({ ...d, attachments: [...d.attachments, url] }));
      noteResult(null);
      return true;
    } catch (err) {
      noteResult(err);
      return false;
    }
  }, [noteResult]);

  // ── addresses ──
  const addAddress = useCallback<AppState['addAddress']>(
    (a) => {
      const tempId = `local_${Date.now()}`;
      const created: SavedAddress = { ...a, id: tempId };
      setAddresses((list) => {
        const next = created.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list;
        return [...next, created];
      });
      // Sync to the account address book; swap in the server id when it lands.
      createAddress(a).then((remote) => {
        if (!remote) return;
        setAddresses((list) => list.map((x) => (x.id === tempId ? remote : x)));
        setDraft((d) => (d.addressId === tempId ? { ...d, addressId: remote.id } : d));
      });
      return created;
    },
    [],
  );

  const setDefaultAddress = useCallback((id: string) => {
    setAddresses((list) => list.map((x) => ({ ...x, isDefault: x.id === id })));
    if (!id.startsWith('local_')) setDefaultAddressRemote(id);
  }, []);

  // ── submit ──
  const submitRequest = useCallback(async (): Promise<string | null> => {
    const user = session.user;
    const addr = addresses.find((a) => a.id === draft.addressId);
    const addressLabel = addr
      ? `${addr.line1}, ${addr.neighborhood}, ${addr.city}`
      : draft.addressText || '';

    // Fold follow-up answers into the description so admin always sees them.
    const answered = draft.followups
      .filter((f) => draft.answers[f.key])
      .map((f) => `${f.q.es}: ${draft.answers[f.key]}`);
    const description = [draft.text || draft.service?.es || 'Solicitud desde la app', ...answered]
      .filter(Boolean)
      .join('\n');

    try {
      const res = await submitServiceRequest({
        category: draft.categoryKey || 'custom',
        description,
        isAsap: draft.urgency === 'asap',
        preferredDate: draft.urgency === 'schedule' ? draft.date : null,
        preferredTime: draft.urgency === 'schedule' ? draft.time : null,
        serviceAddress: addressLabel,
        clientName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Cliente app',
        clientPhone: user?.phone || '',
        clientEmail: user?.email ?? null,
        lang: 'es',
        attachments: draft.attachments,
        clientRequestId: clientRequestIdRef.current,
        matchedService: draft.service?.es ?? null,
        matchedSubKey: draft.subKey,
        aiSummary: draft.summary?.es ?? null,
        aiConfidence: draft.confidence,
        aiSource: `app-${draft.mode}`,
        detailAnswers: draft.answers,
      });
      noteResult(null);
      clientRequestIdRef.current = makeRequestId();
      const list = await refreshOrders();
      const fresh = list.find((o) => o.serverId === res.id);
      return fresh?.id ?? `REQ-${res.id.slice(0, 6).toUpperCase()}`;
    } catch (err) {
      noteResult(err);
      return null;
    }
  }, [addresses, draft, session.user, refreshOrders, noteResult]);

  // Keep a ref of orders for the async helpers above.
  const ordersRef = useRef<Order[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const getOrder = useCallback((id: string) => orders.find((o) => o.id === id), [orders]);
  const activeOrder = useMemo(
    () => orders.find((o) => activeStatuses.includes(o.status)),
    [orders],
  );

  const value = useMemo<AppState>(
    () => ({
      session,
      sessionLoading,
      orders,
      ordersLoading,
      addresses,
      draft,
      offline,
      beginPhoneAuth,
      confirmPhoneCode,
      completeName,
      signOut,
      refreshOrders,
      hydrateOrder,
      rateOrder,
      paymentLinkFor,
      resetDraft,
      startFromText,
      startFromService,
      startInMode,
      patchDraft,
      setAnswer,
      parsing,
      parseError,
      retryParse,
      attachMedia,
      submitRequest,
      addAddress,
      setDefaultAddress,
      getOrder,
      activeOrder,
    }),
    [
      session,
      sessionLoading,
      orders,
      ordersLoading,
      addresses,
      draft,
      offline,
      beginPhoneAuth,
      confirmPhoneCode,
      completeName,
      signOut,
      refreshOrders,
      hydrateOrder,
      rateOrder,
      paymentLinkFor,
      resetDraft,
      startFromText,
      startFromService,
      startInMode,
      patchDraft,
      setAnswer,
      parsing,
      parseError,
      retryParse,
      attachMedia,
      submitRequest,
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
