/**
 * Local mock fixtures — the ONLY data source for the prototype.
 * No network, no Firebase, no Stripe, no Neon. Everything below is invented
 * sample data that mirrors the real product's shapes (see ./types.ts).
 */
import { computePricing } from './pricing';
import { fromNow } from './time';
import type { Order, SavedAddress, Specialist, TimelineStep, User } from './types';

// ── Mock user (returning customer w/ saved card + consent) ─────────
export const mockUser: User = {
  id: 'usr_demo_001',
  firstName: 'Mariana',
  lastName: 'Reyes',
  phone: '+52 55 1234 5678',
  email: 'mariana@example.com',
  phoneVerified: true,
  emailVerified: true,
  firstIdentifierType: 'phone',
  isReturning: true,
  card: { brand: 'visa', last4: '4242', exp: '08/27', consentOnFile: true },
};

// ── Saved addresses (CDMX / Santa Fe — SERVI's service area) ───────
export const mockAddresses: SavedAddress[] = [
  {
    id: 'addr_1',
    label: 'Casa',
    line1: 'Av. Santa Fe 482, Piso 7',
    neighborhood: 'Santa Fe',
    city: 'Cuajimalpa, CDMX',
    isDefault: true,
  },
  {
    id: 'addr_2',
    label: 'Oficina',
    line1: 'Av. Vasco de Quiroga 3800',
    neighborhood: 'Lomas de Santa Fe',
    city: 'Cuajimalpa, CDMX',
    isDefault: false,
  },
];

// ── Specialists (masked, as the backend gives the customer: "Pablo M.") ──────
// prov-000117 (Pablo) is the SAME id the partner app fixtures use — the two apps
// show the same specialist on order SV-204701 from opposite sides.
const plumberPablo: Specialist = {
  providerId: 'prov-000117',
  maskedName: 'Pablo M.',
  initials: 'PM',
  trusted: true, // Mariana saved him (matches partner: jobsTogether 2, trustsYou true)
  providerRating: { positivePct: 96, count: 187, display: 'score' }, // matches partner mockSpecialist
};
const cleanerLucia: Specialist = {
  providerId: 'prov-000208',
  maskedName: 'Lucía O.',
  initials: 'LO',
  trusted: false,
  providerRating: { positivePct: 94, count: 402, display: 'score' },
};
const electricianRaul: Specialist = {
  providerId: 'prov-000091',
  maskedName: 'Raúl C.',
  initials: 'RC',
  trusted: false,
  providerRating: { positivePct: 98, count: 89, display: 'score' },
};

// ── Timeline helper ───────────────────────────────────────────────
function steps(reached: Order['status'][], times: Record<string, string | null>): TimelineStep[] {
  const order: Order['status'][] = [
    'pending',
    'confirmed',
    'assigned',
    'in_progress',
    'completed',
    'captured',
  ];
  return order.map((status) => ({
    status,
    at: reached.includes(status) ? (times[status] ?? fromNow(-1, 4, 0)) : null,
  }));
}

// Real pricing: centavos from computePricing (the port of backend/pricing.mjs).
// Unconfirmed orders (SERVI hasn't set the price yet) keep zeros and never call
// computePricing — that also avoids its throw on a zero/absent provider price.
const price = (providerPesos: number, confirmed = true): Order['price'] => {
  if (!confirmed || providerPesos <= 0) {
    return {
      providerAmountCents: 0,
      bookingFeeAmountCents: 0,
      processingFeeAmountCents: 0,
      vatAmountCents: 0,
      totalAmountCents: 0,
      confirmed: false,
    };
  }
  const p = computePricing(providerPesos);
  return {
    providerAmountCents: p.providerAmountCents,
    bookingFeeAmountCents: p.bookingFeeAmountCents,
    processingFeeAmountCents: p.processingFeeAmountCents,
    vatAmountCents: p.vatAmountCents,
    totalAmountCents: p.totalAmountCents,
    confirmed: true,
  };
};

// ── Orders: one per lifecycle state, so the reference shows them all ──
export const mockOrders: Order[] = [
  // 1) PENDING — first-time card, payment link sent, awaiting authorization
  {
    id: 'SV-204815',
    categoryKey: 'repair',
    service: { es: 'Destape de lavabo o fregadero', en: 'Sink or drain unclogging' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    mode: 'photos',
    status: 'pending',
    kind: 'primary',
    urgency: 'asap',
    whenLabel: { es: 'Lo antes posible', en: 'As soon as possible' },
    scheduledAt: null,
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(0, 10, 20),
    price: price(450, false),
    specialist: null,
    timeline: steps(['pending'], { pending: fromNow(0, 10, 20) }),
    description: {
      es: 'El fregadero de la cocina no baja y ya se está desbordando. Adjunto fotos.',
      en: 'Kitchen sink won’t drain and it’s already overflowing. Photos attached.',
    },
    attachments: [{ kind: 'photo', count: 2 }],
    detailAnswers: [
      { q: { es: '¿Qué mueble?', en: 'Which fixture?' }, a: { es: 'Fregadero de cocina', en: 'Kitchen sink' } },
      { q: { es: '¿Se desborda?', en: 'Is it overflowing?' }, a: { es: 'Sí, activamente', en: 'Yes, actively' } },
    ],
    phaseTimes: {},
    locationSharedAt: null,
    leadTimeDays: 0,
  },

  // 2) SCHEDULED — saved-card booking, hold deferred to ~24h before
  {
    id: 'SV-204790',
    categoryKey: 'cleaning',
    service: { es: 'Limpieza semanal de departamento', en: 'Weekly apartment cleaning' },
    subLabel: { es: 'Limpieza del hogar', en: 'Home cleaning' },
    mode: 'text',
    status: 'scheduled',
    kind: 'book',
    urgency: 'schedule',
    whenLabel: { es: 'Sáb 27 jun · 10:00', en: 'Sat Jun 27 · 10:00' },
    scheduledAt: fromNow(4, 10, 0),
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(-1, 3, 0),
    price: price(600),
    specialist: null,
    timeline: steps([], {}),
    description: {
      es: 'Limpieza semanal de un departamento de 2 recámaras, incluye cocina y baños.',
      en: 'Weekly cleaning of a 2-bedroom apartment, including kitchen and bathrooms.',
    },
    attachments: [],
    detailAnswers: [
      { q: { es: '¿Cuántas recámaras?', en: 'How many bedrooms?' }, a: { es: '2', en: '2' } },
    ],
    phaseTimes: {},
    locationSharedAt: null,
    leadTimeDays: 5,
  },

  // 3) CONFIRMED — card pre-authorized (hold placed), not charged
  {
    id: 'SV-204766',
    categoryKey: 'repair',
    service: { es: 'Instalación de lámparas o luminarias', en: 'Light fixture installation' },
    subLabel: { es: 'Electricidad', en: 'Electrical' },
    mode: 'photos',
    status: 'confirmed',
    kind: 'book',
    urgency: 'schedule',
    whenLabel: { es: 'Mañana · 12:00', en: 'Tomorrow · 12:00' },
    scheduledAt: fromNow(1, 12, 0),
    addressLabel: 'Oficina · Lomas de Santa Fe',
    createdAt: fromNow(-2, 5, 30),
    price: price(520),
    specialist: null,
    timeline: steps(['confirmed'], { confirmed: fromNow(0, 12, 0) }),
    description: {
      es: 'Instalar 3 luminarias de techo en la oficina. Ya tengo las lámparas.',
      en: 'Install 3 ceiling light fixtures at the office. I already have the lamps.',
    },
    attachments: [{ kind: 'photo', count: 3 }],
    detailAnswers: [
      { q: { es: '¿Cuántas piezas?', en: 'How many pieces?' }, a: { es: '3', en: '3' } },
      { q: { es: '¿Tienes el material?', en: 'Do you have the materials?' }, a: { es: 'Sí, las lámparas', en: 'Yes, the lamps' } },
      { q: { es: 'Altura del techo', en: 'Ceiling height' }, a: { es: '3 metros', en: '3 meters' } },
    ],
    phaseTimes: {},
    locationSharedAt: null,
    leadTimeDays: 3,
  },

  // 4) ASSIGNED — specialist matched, hold in place
  {
    id: 'SV-204701',
    categoryKey: 'repair',
    service: { es: 'Reparación de fuga en WC', en: 'Toilet leak repair' },
    subLabel: { es: 'Plomería', en: 'Plumbing' },
    mode: 'voice',
    status: 'assigned',
    kind: 'book',
    urgency: 'schedule',
    whenLabel: { es: 'Hoy · 17:30', en: 'Today · 17:30' },
    scheduledAt: fromNow(0, 17, 30),
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(-1, 8, 0),
    price: price(480),
    specialist: plumberPablo,
    timeline: steps(['confirmed', 'assigned'], {
      confirmed: fromNow(-1, 14, 0),
      assigned: fromNow(0, 2, 0),
    }),
    description: {
      es: 'El WC tiene una fuga por la base cada vez que le jalo. Ya moja el piso.',
      en: 'The toilet leaks around the base every time I flush. It’s wetting the floor.',
    },
    attachments: [{ kind: 'voice', count: 1 }],
    detailAnswers: [
      { q: { es: '¿Dónde escurre?', en: 'Where is it leaking?' }, a: { es: 'En la base', en: 'At the base' } },
      { q: { es: '¿Desde cuándo?', en: 'Since when?' }, a: { es: '2 días', en: '2 days' } },
    ],
    // Not checked in yet — this is the demo starting point. Advance it from the
    // partner app's check-in, or the Account → Demo states "Avanzar fase" control.
    phaseTimes: {},
    locationSharedAt: null,
    leadTimeDays: 1,
  },

  // 5) IN PROGRESS — service underway
  {
    id: 'SV-204688',
    categoryKey: 'cleaning',
    service: { es: 'Limpieza profunda post fiesta', en: 'Post-party deep cleaning' },
    subLabel: { es: 'Limpieza profunda', en: 'Deep cleaning' },
    mode: 'text',
    status: 'in_progress',
    kind: 'book',
    urgency: 'asap',
    whenLabel: { es: 'En curso', en: 'In progress' },
    scheduledAt: fromNow(0, 11, 0),
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(0, 3, 0),
    price: price(900),
    specialist: cleanerLucia,
    timeline: steps(['confirmed', 'assigned', 'in_progress'], {
      confirmed: fromNow(0, 6, 0),
      assigned: fromNow(0, 8, 0),
      in_progress: fromNow(0, 11, 5),
    }),
    description: {
      es: 'Limpieza profunda después de una fiesta. Sala, cocina y 2 baños.',
      en: 'Deep cleaning after a party. Living room, kitchen and 2 bathrooms.',
    },
    attachments: [],
    detailAnswers: [],
    // Underway — the specialist has checked in through "started".
    phaseTimes: {
      en_route: fromNow(0, 10, 40),
      arrived: fromNow(0, 10, 58),
      started: fromNow(0, 11, 5),
    },
    locationSharedAt: fromNow(0, 10, 45),
    leadTimeDays: 0,
  },

  // 6) COMPLETED — delivered, awaiting capture
  {
    id: 'SV-204610',
    categoryKey: 'repair',
    service: { es: 'Cambio de apagadores y contactos', en: 'Outlet and switch replacement' },
    subLabel: { es: 'Electricidad', en: 'Electrical' },
    mode: 'text',
    status: 'completed',
    kind: 'book',
    urgency: 'schedule',
    whenLabel: { es: 'Ayer · 11:00', en: 'Yesterday · 11:00' },
    scheduledAt: fromNow(-1, 11, 0),
    addressLabel: 'Oficina · Lomas de Santa Fe',
    createdAt: fromNow(-3, 4, 0),
    price: price(540),
    specialist: electricianRaul,
    timeline: steps(['confirmed', 'assigned', 'in_progress', 'completed'], {
      confirmed: fromNow(-2, 11, 0),
      assigned: fromNow(-1, 2, 0),
      in_progress: fromNow(-1, 11, 0),
      completed: fromNow(-1, 12, 30),
    }),
    description: {
      es: 'Cambiar 4 apagadores y 2 contactos que ya no funcionan.',
      en: 'Replace 4 switches and 2 outlets that no longer work.',
    },
    attachments: [],
    detailAnswers: [],
    phaseTimes: {
      en_route: fromNow(-1, 10, 30),
      arrived: fromNow(-1, 10, 55),
      started: fromNow(-1, 11, 0),
      completed: fromNow(-1, 12, 30),
    },
    locationSharedAt: null,
    leadTimeDays: 2,
  },

  // 7) CAPTURED — paid (charged after completion)
  {
    id: 'SV-204502',
    categoryKey: 'wellness',
    service: { es: 'Masaje relajante a domicilio', en: 'In-home relaxation massage' },
    subLabel: { es: 'Masaje', en: 'Massage' },
    mode: 'text',
    status: 'captured',
    kind: 'book',
    urgency: 'schedule',
    whenLabel: { es: '18 jun · 19:00', en: 'Jun 18 · 19:00' },
    scheduledAt: fromNow(-5, 19, 0),
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(-8, 4, 0),
    price: price(750),
    specialist: { providerId: 'prov-000164', maskedName: 'Ana B.', initials: 'AB', trusted: false, providerRating: { positivePct: 97, count: 132, display: 'score' } },
    timeline: steps(['confirmed', 'assigned', 'in_progress', 'completed', 'captured'], {
      confirmed: fromNow(-6, 19, 0),
      assigned: fromNow(-5, 9, 0),
      in_progress: fromNow(-5, 19, 0),
      completed: fromNow(-5, 20, 0),
      captured: fromNow(-5, 20, 30),
    }),
    description: {
      es: 'Masaje relajante de cuerpo completo a domicilio, 60 minutos.',
      en: 'Full-body relaxation massage at home, 60 minutes.',
    },
    attachments: [],
    detailAnswers: [],
    phaseTimes: {
      en_route: fromNow(-5, 18, 30),
      arrived: fromNow(-5, 18, 55),
      started: fromNow(-5, 19, 0),
      completed: fromNow(-5, 20, 0),
    },
    locationSharedAt: null,
    leadTimeDays: 4,
  },

  // 8) REFUNDED — captured then refunded
  {
    id: 'SV-204455',
    categoryKey: 'moving',
    service: { es: 'Entrega exprés el mismo día', en: 'Same-day express delivery' },
    subLabel: { es: 'Entregas', en: 'Deliveries' },
    mode: 'text',
    status: 'refunded',
    kind: 'primary',
    urgency: 'asap',
    whenLabel: { es: '14 jun · 13:00', en: 'Jun 14 · 13:00' },
    scheduledAt: null,
    addressLabel: 'Oficina · Lomas de Santa Fe',
    createdAt: fromNow(-9, 6, 0),
    price: price(320),
    specialist: null,
    timeline: steps(['confirmed', 'assigned', 'in_progress', 'completed', 'captured'], {
      confirmed: fromNow(-9, 6, 30),
      assigned: fromNow(-9, 6, 45),
      in_progress: fromNow(-9, 7, 0),
      completed: fromNow(-9, 7, 40),
      captured: fromNow(-9, 8, 0),
    }),
    description: {
      es: 'Entrega exprés de un paquete el mismo día dentro de Santa Fe.',
      en: 'Same-day express delivery of a package within Santa Fe.',
    },
    attachments: [],
    detailAnswers: [],
    phaseTimes: {
      en_route: fromNow(-9, 7, 0),
      arrived: fromNow(-9, 7, 35),
      started: fromNow(-9, 7, 0),
      completed: fromNow(-9, 7, 40),
    },
    locationSharedAt: null,
    leadTimeDays: 0,
  },

  // 10) BLOCKED — booked 6 days out as a guest with no saved card → needs a
  // saved card before a hold can be placed (kind setup_required).
  {
    id: 'SV-204360',
    categoryKey: 'repair',
    service: { es: 'Visita de cotización a domicilio', en: 'On-site quote visit' },
    subLabel: { es: 'Visita', en: 'Visit' },
    mode: 'text',
    status: 'blocked',
    kind: 'setup_required',
    urgency: 'schedule',
    whenLabel: { es: '30 jun · 10:00', en: 'Jun 30 · 10:00' },
    scheduledAt: fromNow(7, 10, 0),
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(1, 2, 0),
    price: price(0, false),
    specialist: null,
    timeline: steps([], {}),
    description: {
      es: 'Necesito una visita para cotizar la remodelación de un baño.',
      en: 'I need an on-site visit to quote a bathroom remodel.',
    },
    attachments: [],
    detailAnswers: [],
    phaseTimes: {},
    locationSharedAt: null,
    leadTimeDays: 6,
  },

  // 9) CANCELLED — cancelled before service
  {
    id: 'SV-204399',
    categoryKey: 'repair',
    service: { es: 'Montaje de TV en muro', en: 'TV wall mounting' },
    subLabel: { es: 'Handyman', en: 'Handyman' },
    mode: 'text',
    status: 'cancelled',
    kind: 'book',
    urgency: 'schedule',
    whenLabel: { es: '12 jun · 16:00', en: 'Jun 12 · 16:00' },
    scheduledAt: fromNow(-11, 16, 0),
    addressLabel: 'Casa · Santa Fe',
    createdAt: fromNow(-13, 4, 0),
    price: price(380),
    specialist: null,
    timeline: steps([], {}),
    description: {
      es: 'Montar una TV de 55" en muro de tablaroca, con soporte incluido.',
      en: 'Mount a 55" TV on a drywall wall, bracket included.',
    },
    attachments: [],
    detailAnswers: [],
    phaseTimes: {},
    locationSharedAt: null,
    leadTimeDays: 2,
  },
];

/** The "active" order surfaced in the home dock = first non-terminal order. */
export const activeStatuses: Order['status'][] = [
  'pending',
  'scheduled',
  'confirmed',
  'assigned',
  'in_progress',
  'completed',
  'blocked',
];
