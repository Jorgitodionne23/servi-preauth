/**
 * Local fixtures — the ONLY data source. No network, no Stripe, no Firebase.
 *
 * ── Interop with the customer prototype ──────────────────────────────────
 * The logged-in specialist here is **Pablo Méndez**, who is also the specialist
 * shown on order `SV-204701` in the customer prototype
 * (`../../../native-app-reference/src/data/mockData.ts`). Three job IDs are
 * shared deliberately, so you can open both apps side by side and see the same
 * order from both directions:
 *
 *   SV-204815  client: `pending`   (no specialist yet) ↔ partner: a live OFFER
 *   SV-204766  client: `confirmed` (hold placed, unassigned) ↔ partner: OFFER
 *   SV-204701  client: `assigned` to Pablo ↔ partner: today's accepted JOB
 *
 * Pablo's history uses IDs the customer app never shows, which is correct: the
 * customer prototype is one client's view (Mariana's), and Pablo works for many
 * clients. See ../../INTEROP.md for the full mapping table.
 *
 * Money is computed with the real `computePricing` port, not invented, so every
 * peso on screen is what the production backend would actually produce.
 */
import { computePricing } from './pricing';
import { DOCUMENTS, TRADES } from './catalog';
import { fromNow, nextPayoutDate } from './time';
import type {
  DayAvailability,
  Coverage,
  Job,
  Payout,
  PayoutAccount,
  Specialist,
  VerificationDoc,
} from './types';

// ── The logged-in specialist ──────────────────────────────────────
const docs = (approved: boolean): VerificationDoc[] =>
  DOCUMENTS.map((d) => ({
    ...d,
    status: approved ? (d.required ? 'approved' : 'approved') : 'missing',
  }));

export const mockSpecialist: Specialist = {
  providerId: 'prov-000117',
  status: 'verified',
  firstName: 'Pablo',
  lastName: 'Méndez',
  initials: 'PM',
  phone: '+52 55 4821 9930',
  email: 'pablo.mendez@example.com',
  specialty: { es: 'Plomero verificado', en: 'Verified plumber' },
  city: 'Cuajimalpa, CDMX',
  memberSince: '2025-03-14T00:00:00Z', // absolute join date — not relative to the demo clock
  providerRating: { positivePct: 96, count: 187, display: 'score' }, // same aggregate the customer app shows for Pablo
  completedJobs: 214,
  reliability: 0.98,
  acceptance: 0.86,
  tier: 'oro',
  trades: [
    {
      ...TRADES[1], // repair
      skills: [
        { es: 'Plomería', en: 'Plumbing' },
        { es: 'Electricidad', en: 'Electrical' },
        { es: 'Montaje en muro (TV, repisas)', en: 'Wall mounting (TV, shelves)' },
        { es: 'Armado de muebles', en: 'Furniture assembly' },
      ],
    },
  ],
  documents: docs(true),
  trustedBy: 34,
};

export const mockAvailability: DayAvailability[] = [
  { day: 'mon', enabled: true, from: '08:00', to: '18:00' },
  { day: 'tue', enabled: true, from: '08:00', to: '18:00' },
  { day: 'wed', enabled: true, from: '08:00', to: '18:00' },
  { day: 'thu', enabled: true, from: '08:00', to: '18:00' },
  { day: 'fri', enabled: true, from: '08:00', to: '20:00' },
  { day: 'sat', enabled: true, from: '09:00', to: '15:00' },
  { day: 'sun', enabled: false, from: '09:00', to: '14:00' },
];

export const mockCoverage: Coverage = {
  zones: ['Santa Fe', 'Lomas de Santa Fe', 'Contadero', 'Cuajimalpa Centro', 'El Yaqui'],
  radiusKm: 12,
  acceptsAsap: true,
};

export const mockPayoutAccount: PayoutAccount = {
  connectAccountId: 'acct_1PxDemoPartner',
  status: 'active',
  bankName: 'BBVA México',
  last4: '4417',
  holderName: 'Pablo Méndez Ruiz',
  schedule: 'weekly',
  rfc: 'MERP890412HN4',
};

// ── Job builder ───────────────────────────────────────────────────
/**
 * Builds a job from the specialist's quoted price, deriving the client-facing
 * total through the real pricing engine. `payoutCents` is always exactly the
 * quoted price — that invariant is the whole partner value proposition.
 */
function job(
  base: Omit<Job, 'payoutCents' | 'clientTotalCents' | 'priceChanges' | 'phaseTimes' | 'payoutId'> & {
    providerPesos: number;
    phaseTimes?: Job['phaseTimes'];
    priceChanges?: Job['priceChanges'];
    payoutId?: string | null;
  },
): Job {
  const { providerPesos, phaseTimes, priceChanges, payoutId, ...rest } = base;
  const p = computePricing(providerPesos);
  return {
    ...rest,
    payoutCents: p.providerAmountCents,
    clientTotalCents: p.totalAmountCents,
    phaseTimes: phaseTimes ?? {},
    priceChanges: priceChanges ?? [],
    payoutId: payoutId ?? null,
  };
}

/** Offer countdowns run on the REAL clock so the pressure feels real. */
const offerDeadline = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000).toISOString();

export const mockJobs: Job[] = [
  // ── OFFER ↔ customer app `SV-204815` (status: pending) ──────────
  // The client hasn't authorized their card yet, so this offer shows the
  // "payment not yet held" state. Realistic: admin matches a specialist before
  // the client finishes paying.
  job({
    id: 'SV-204815',
    state: 'offered',
    tradeKey: 'repair',
    service: { es: 'Destape de lavabo o fregadero', en: 'Sink or drain unclogging' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: {
      es: 'El fregadero de la cocina está tapado desde ayer. El agua no baja y ya intenté con destapacaños sin éxito.',
      en: 'The kitchen sink has been clogged since yesterday. Water won’t drain and I already tried drain cleaner with no luck.',
    },
    detailAnswers: [
      { q: { es: '¿Qué mueble?', en: 'Which fixture?' }, a: { es: 'Fregadero de cocina', en: 'Kitchen sink' } },
      { q: { es: '¿Se desborda?', en: 'Is it overflowing?' }, a: { es: 'Sí, activamente', en: 'Yes, actively' } },
    ],
    attachments: [{ kind: 'photo', count: 2 }],
    client: { firstName: 'Mariana', initials: 'M', jobsTogether: 0, trustsYou: false },
    address: 'Av. Santa Fe 482, Piso 7, Santa Fe',
    zone: 'Santa Fe',
    distanceKm: 2.4,
    isAsap: true,
    scheduledAt: null,
    estimatedMinutes: 60,
    providerPesos: 450,
    paymentHeld: false,
    offerExpiresAt: offerDeadline(9),
    completedAt: null,
  }),

  // ── OFFER ↔ customer app `SV-204766` (status: confirmed) ────────
  // Card already pre-authorized → the offer can promise a guaranteed payment.
  job({
    id: 'SV-204766',
    state: 'offered',
    tradeKey: 'repair',
    service: { es: 'Instalación de lámparas o luminarias', en: 'Light fixture installation' },
    subLabel: { es: 'Electricidad', en: 'Electrical' },
    description: {
      es: 'Necesito instalar 4 lámparas de techo en la oficina. Ya tengo las lámparas, falta el cableado y el montaje.',
      en: 'I need 4 ceiling lights installed in the office. I have the fixtures; wiring and mounting are missing.',
    },
    detailAnswers: [
      { q: { es: '¿Cuántas piezas?', en: 'How many pieces?' }, a: { es: '4 lámparas', en: '4 fixtures' } },
      { q: { es: '¿Ya tienes el material?', en: 'Do you have the materials?' }, a: { es: 'Sí', en: 'Yes' } },
      { q: { es: 'Altura del techo', en: 'Ceiling height' }, a: { es: '3 metros', en: '3 meters' } },
    ],
    attachments: [{ kind: 'photo', count: 3 }],
    client: { firstName: 'Mariana', initials: 'M', jobsTogether: 0, trustsYou: false },
    address: 'Av. Vasco de Quiroga 3800, Lomas de Santa Fe',
    zone: 'Lomas de Santa Fe',
    distanceKm: 4.1,
    isAsap: false,
    scheduledAt: fromNow(1, 12, 0),
    estimatedMinutes: 150,
    providerPesos: 520,
    paymentHeld: true,
    offerExpiresAt: offerDeadline(23),
    completedAt: null,
  }),

  // ── TODAY ↔ customer app `SV-204701` (status: assigned to Pablo) ─
  // The centerpiece of the two-app demo. Accepted, hold in place, happening
  // this evening. Check in from here and the customer app's timeline advances.
  job({
    id: 'SV-204701',
    state: 'today',
    tradeKey: 'repair',
    service: { es: 'Reparación de fuga en WC', en: 'Toilet leak repair' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: {
      es: 'Hay una fuga en la base del WC del baño principal. Escurre poco a poco y ya manchó el piso.',
      en: 'There’s a leak at the base of the toilet in the main bathroom. It drips slowly and has already stained the floor.',
    },
    detailAnswers: [
      { q: { es: '¿Dónde escurre?', en: 'Where is it leaking?' }, a: { es: 'En la base', en: 'At the base' } },
      { q: { es: '¿Desde cuándo?', en: 'Since when?' }, a: { es: '3 días', en: '3 days' } },
    ],
    attachments: [{ kind: 'voice', count: 1 }],
    client: { firstName: 'Mariana', initials: 'M', jobsTogether: 2, trustsYou: true },
    address: 'Av. Santa Fe 482, Piso 7, Santa Fe',
    zone: 'Santa Fe',
    distanceKm: 2.4,
    isAsap: false,
    scheduledAt: fromNow(0, 17, 30),
    estimatedMinutes: 90,
    providerPesos: 480,
    paymentHeld: true,
    offerExpiresAt: null,
    completedAt: null,
  }),

  // ── SCHEDULED — later this week, a different client ──────────────
  job({
    id: 'SV-204744',
    state: 'scheduled',
    tradeKey: 'repair',
    service: { es: 'Cambio de llaves y mezcladora', en: 'Faucet and mixer replacement' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: {
      es: 'Cambiar la mezcladora del lavabo del baño de visitas. Ya compré la pieza.',
      en: 'Replace the mixer tap on the guest bathroom sink. I already bought the part.',
    },
    detailAnswers: [
      { q: { es: '¿Ya tienes la pieza?', en: 'Do you have the part?' }, a: { es: 'Sí', en: 'Yes' } },
    ],
    attachments: [],
    client: { firstName: 'Diego', initials: 'D', jobsTogether: 1, trustsYou: false },
    address: 'Paseo de los Laureles 458, Bosques de las Lomas',
    zone: 'Bosques de las Lomas',
    distanceKm: 6.8,
    isAsap: false,
    scheduledAt: fromNow(2, 11, 0),
    estimatedMinutes: 75,
    providerPesos: 390,
    paymentHeld: false,
    offerExpiresAt: null,
    completedAt: null,
  }),

  // ── SCHEDULED — a big one, and a client who already trusts Pablo ──
  job({
    id: 'SV-204738',
    state: 'scheduled',
    tradeKey: 'repair',
    service: { es: 'Reparación de tubería en muro', en: 'In-wall pipe repair' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: {
      es: 'Hay humedad en el muro de la recámara. Sospecho una fuga en la tubería interna.',
      en: 'There’s damp on the bedroom wall. I suspect a leak in the internal pipework.',
    },
    detailAnswers: [
      { q: { es: '¿Hay humedad visible?', en: 'Visible damp?' }, a: { es: 'Sí, mancha grande', en: 'Yes, large stain' } },
      { q: { es: '¿Cortaron el agua?', en: 'Water shut off?' }, a: { es: 'No', en: 'No' } },
    ],
    attachments: [{ kind: 'photo', count: 4 }, { kind: 'video', count: 1 }],
    client: { firstName: 'Sofía', initials: 'S', jobsTogether: 4, trustsYou: true },
    address: 'Av. Club de Golf 12, Interlomas',
    zone: 'Interlomas',
    distanceKm: 9.2,
    isAsap: false,
    scheduledAt: fromNow(4, 9, 0),
    estimatedMinutes: 240,
    providerPesos: 1450,
    paymentHeld: false,
    offerExpiresAt: null,
    completedAt: null,
  }),

  // ── COMPLETED — done yesterday, SERVI still capturing → "pending" money ──
  job({
    id: 'SV-204655',
    state: 'completed',
    tradeKey: 'repair',
    service: { es: 'Destape de drenaje principal', en: 'Main drain unclogging' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: {
      es: 'El drenaje del patio se tapó y regresa agua al lavadero.',
      en: 'The yard drain clogged and water is backing up into the laundry sink.',
    },
    detailAnswers: [],
    attachments: [{ kind: 'photo', count: 1 }],
    client: { firstName: 'Rodrigo', initials: 'R', jobsTogether: 0, trustsYou: false },
    address: 'Cda. de Contadero 24, Contadero',
    zone: 'Contadero',
    distanceKm: 3.6,
    isAsap: false,
    scheduledAt: fromNow(-1, 10, 0),
    estimatedMinutes: 120,
    providerPesos: 620,
    paymentHeld: true,
    offerExpiresAt: null,
    completedAt: fromNow(-1, 12, 20),
    phaseTimes: {
      en_route: fromNow(-1, 9, 30),
      arrived: fromNow(-1, 9, 58),
      started: fromNow(-1, 10, 5),
      completed: fromNow(-1, 12, 20),
    },
    // An approved surcharge — the drain needed a machine and an extra hour.
    priceChanges: [
      {
        id: 'pc_204655_1',
        type: 'horas_adicionales',
        providerAmountCents: 25000,
        note: 'El tapón estaba a 8 metros. Requirió máquina y una hora extra.',
        clientTotalCents: computePricing(250).totalAmountCents,
        status: 'approved',
        requestedAt: fromNow(-1, 11, 40),
      },
    ],
  }),

  // ── PAID — settled in last Monday's deposit ──────────────────────
  job({
    id: 'SV-204590',
    state: 'paid',
    tradeKey: 'repair',
    service: { es: 'Instalación de calentador de agua', en: 'Water heater installation' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: {
      es: 'Instalar boiler nuevo de paso, ya está en casa.',
      en: 'Install a new tankless water heater, already on site.',
    },
    detailAnswers: [],
    attachments: [],
    client: { firstName: 'Sofía', initials: 'S', jobsTogether: 4, trustsYou: true },
    address: 'Av. Club de Golf 12, Interlomas',
    zone: 'Interlomas',
    distanceKm: 9.2,
    isAsap: false,
    scheduledAt: fromNow(-5, 9, 0),
    estimatedMinutes: 180,
    providerPesos: 1100,
    paymentHeld: true,
    offerExpiresAt: null,
    completedAt: fromNow(-5, 12, 10),
    phaseTimes: {
      en_route: fromNow(-5, 8, 20),
      arrived: fromNow(-5, 8, 55),
      started: fromNow(-5, 9, 5),
      completed: fromNow(-5, 12, 10),
    },
    payoutId: 'po_2026_0615',
  }),

  job({
    id: 'SV-204571',
    state: 'paid',
    tradeKey: 'repair',
    service: { es: 'Montaje de TV en muro', en: 'TV wall mounting' },
    subLabel: { es: 'Handyman', en: 'Handyman' },
    description: { es: 'Montar TV de 65" en muro de tablaroca.', en: 'Mount a 65" TV on a drywall wall.' },
    detailAnswers: [],
    attachments: [],
    client: { firstName: 'Emilio', initials: 'E', jobsTogether: 0, trustsYou: false },
    address: 'Prol. Paseo de la Reforma 1015, Santa Fe',
    zone: 'Santa Fe',
    distanceKm: 1.9,
    isAsap: false,
    scheduledAt: fromNow(-6, 16, 0),
    estimatedMinutes: 60,
    providerPesos: 380,
    paymentHeld: true,
    offerExpiresAt: null,
    completedAt: fromNow(-6, 17, 5),
    phaseTimes: {
      en_route: fromNow(-6, 15, 30),
      arrived: fromNow(-6, 15, 52),
      started: fromNow(-6, 16, 0),
      completed: fromNow(-6, 17, 5),
    },
    payoutId: 'po_2026_0615',
  }),

  job({
    id: 'SV-204533',
    state: 'paid',
    tradeKey: 'repair',
    service: { es: 'Reparación de fuga en cisterna', en: 'Cistern leak repair' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    description: { es: 'La cisterna pierde nivel durante la noche.', en: 'The cistern loses level overnight.' },
    detailAnswers: [],
    attachments: [],
    client: { firstName: 'Ana', initials: 'A', jobsTogether: 1, trustsYou: false },
    address: 'Camino a Santa Fe 1104, El Yaqui',
    zone: 'El Yaqui',
    distanceKm: 5.2,
    isAsap: false,
    scheduledAt: fromNow(-8, 11, 0),
    estimatedMinutes: 150,
    providerPesos: 840,
    paymentHeld: true,
    offerExpiresAt: null,
    completedAt: fromNow(-8, 13, 40),
    phaseTimes: {
      en_route: fromNow(-8, 10, 25),
      arrived: fromNow(-8, 10, 55),
      started: fromNow(-8, 11, 0),
      completed: fromNow(-8, 13, 40),
    },
    payoutId: 'po_2026_0608',
  }),

  // ── CANCELLED — client cancelled late; SERVI compensated the trip ──
  job({
    id: 'SV-204612',
    state: 'cancelled',
    tradeKey: 'repair',
    service: { es: 'Cambio de apagadores y contactos', en: 'Outlet and switch replacement' },
    subLabel: { es: 'Electricidad', en: 'Electrical' },
    description: { es: 'Cambiar 8 apagadores en departamento.', en: 'Replace 8 switches in an apartment.' },
    detailAnswers: [],
    attachments: [],
    client: { firstName: 'Luis', initials: 'L', jobsTogether: 0, trustsYou: false },
    address: 'Av. Santa Fe 170, Santa Fe',
    zone: 'Santa Fe',
    distanceKm: 2.1,
    isAsap: false,
    scheduledAt: fromNow(-3, 15, 0),
    estimatedMinutes: 120,
    providerPesos: 540,
    paymentHeld: true,
    offerExpiresAt: null,
    completedAt: null,
  }),
];

// ── Payouts ───────────────────────────────────────────────────────
export const mockPayouts: Payout[] = [
  {
    id: 'po_next',
    amountCents:
      mockJobs.find((j) => j.id === 'SV-204655')!.payoutCents + 25000, // job + approved surcharge
    jobIds: ['SV-204655'],
    status: 'pending',
    arrivesAt: nextPayoutDate(),
    createdAt: fromNow(-1, 12, 30),
    last4: '4417',
    feeCents: 0,
    instant: false,
  },
  {
    id: 'po_2026_0615',
    amountCents:
      mockJobs.find((j) => j.id === 'SV-204590')!.payoutCents +
      mockJobs.find((j) => j.id === 'SV-204571')!.payoutCents,
    jobIds: ['SV-204590', 'SV-204571'],
    status: 'paid',
    arrivesAt: fromNow(-2, 9, 0),
    createdAt: fromNow(-2, 6, 0),
    last4: '4417',
    feeCents: 0,
    instant: false,
  },
  {
    id: 'po_2026_0608',
    amountCents: mockJobs.find((j) => j.id === 'SV-204533')!.payoutCents,
    jobIds: ['SV-204533'],
    status: 'paid',
    arrivesAt: fromNow(-9, 9, 0),
    createdAt: fromNow(-9, 6, 0),
    last4: '4417',
    feeCents: 0,
    instant: false,
  },
  {
    id: 'po_2026_0603_instant',
    amountCents: 62000,
    jobIds: ['SV-204498'],
    status: 'paid',
    arrivesAt: fromNow(-14, 18, 20),
    createdAt: fromNow(-14, 18, 15),
    last4: '4417',
    feeCents: 1200,
    instant: true,
  },
];

/**
 * A brand-new specialist — used by the demo control that flips the app into
 * the "just applied, awaiting verification" state, which is what a real first
 * install looks like and is easy to forget to design for.
 */
export const mockPendingSpecialist: Specialist = {
  ...mockSpecialist,
  providerId: 'prov-000482',
  status: 'review',
  providerRating: { positivePct: 0, count: 0, display: 'new' }, // no ratings yet — cold start
  completedJobs: 0,
  reliability: 1,
  acceptance: 1,
  tier: 'nuevo',
  trustedBy: 0,
  memberSince: fromNow(0),
  documents: DOCUMENTS.map((d) => ({
    ...d,
    status: d.required ? 'in_review' : 'missing',
  })),
};
