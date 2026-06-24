/**
 * Local mock fixtures — the ONLY data source for the prototype.
 * No network, no Firebase, no Stripe, no Neon. Everything below is invented
 * sample data that mirrors the real product's shapes (see ./types.ts).
 */
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

// ── Specialists ───────────────────────────────────────────────────
const plumberPablo: Specialist = {
  name: 'Pablo Méndez',
  initials: 'PM',
  rating: 4.9,
  jobs: 214,
  trade: { es: 'Plomero verificado', en: 'Verified plumber' },
  trusted: true,
};
const cleanerLucia: Specialist = {
  name: 'Lucía Ortega',
  initials: 'LO',
  rating: 4.8,
  jobs: 388,
  trade: { es: 'Especialista en limpieza', en: 'Cleaning specialist' },
};
const electricianRaul: Specialist = {
  name: 'Raúl Cano',
  initials: 'RC',
  rating: 5.0,
  jobs: 96,
  trade: { es: 'Electricista verificado', en: 'Verified electrician' },
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
    at: reached.includes(status) ? (times[status] ?? '2026-06-22T10:00:00Z') : null,
  }));
}

const price = (provider: number, confirmed = true) => {
  const bookingFee = Math.round(provider * 0.18);
  const processing = Math.round((provider + bookingFee) * 0.046);
  return {
    provider,
    bookingFee,
    processing,
    total: provider + bookingFee + processing,
    currency: 'MXN' as const,
    confirmed,
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
    mode: 'text',
    status: 'pending',
    kind: 'primary',
    urgency: 'asap',
    whenLabel: { es: 'Lo antes posible', en: 'As soon as possible' },
    scheduledAt: null,
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-23T16:20:00Z',
    price: price(450, false),
    specialist: null,
    timeline: steps(['pending'], { pending: '2026-06-23T16:20:00Z' }),
    detailAnswers: { fixture: 'Sink', severity: 'Yes, actively' },
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
    scheduledAt: '2026-06-27T16:00:00Z',
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-22T09:00:00Z',
    price: price(600),
    specialist: null,
    timeline: steps([], {}),
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
    scheduledAt: '2026-06-24T18:00:00Z',
    addressLabel: 'Oficina · Lomas de Santa Fe',
    createdAt: '2026-06-21T11:30:00Z',
    price: price(520),
    specialist: null,
    timeline: steps(['confirmed'], { confirmed: '2026-06-23T18:00:00Z' }),
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
    scheduledAt: '2026-06-23T23:30:00Z',
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-22T14:00:00Z',
    price: price(480),
    specialist: plumberPablo,
    timeline: steps(['confirmed', 'assigned'], {
      confirmed: '2026-06-22T20:00:00Z',
      assigned: '2026-06-23T08:00:00Z',
    }),
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
    scheduledAt: '2026-06-23T17:00:00Z',
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-23T09:00:00Z',
    price: price(900),
    specialist: cleanerLucia,
    timeline: steps(['confirmed', 'assigned', 'in_progress'], {
      confirmed: '2026-06-23T12:00:00Z',
      assigned: '2026-06-23T14:00:00Z',
      in_progress: '2026-06-23T17:05:00Z',
    }),
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
    scheduledAt: '2026-06-22T17:00:00Z',
    addressLabel: 'Oficina · Lomas de Santa Fe',
    createdAt: '2026-06-20T10:00:00Z',
    price: price(540),
    specialist: electricianRaul,
    timeline: steps(['confirmed', 'assigned', 'in_progress', 'completed'], {
      confirmed: '2026-06-21T17:00:00Z',
      assigned: '2026-06-22T08:00:00Z',
      in_progress: '2026-06-22T17:00:00Z',
      completed: '2026-06-22T18:30:00Z',
    }),
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
    scheduledAt: '2026-06-19T01:00:00Z',
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-15T10:00:00Z',
    price: price(750),
    specialist: { name: 'Ana Belén', initials: 'AB', rating: 4.9, jobs: 142, trade: { es: 'Masajista certificada', en: 'Certified masseuse' } },
    timeline: steps(['confirmed', 'assigned', 'in_progress', 'completed', 'captured'], {
      confirmed: '2026-06-18T01:00:00Z',
      assigned: '2026-06-18T15:00:00Z',
      in_progress: '2026-06-19T01:00:00Z',
      completed: '2026-06-19T02:00:00Z',
      captured: '2026-06-19T02:30:00Z',
    }),
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
    createdAt: '2026-06-14T12:00:00Z',
    price: price(320),
    specialist: null,
    timeline: steps(['confirmed', 'assigned', 'in_progress', 'completed', 'captured'], {
      confirmed: '2026-06-14T12:30:00Z',
      assigned: '2026-06-14T12:45:00Z',
      in_progress: '2026-06-14T13:00:00Z',
      completed: '2026-06-14T13:40:00Z',
      captured: '2026-06-14T14:00:00Z',
    }),
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
    scheduledAt: '2026-06-30T16:00:00Z',
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-24T08:00:00Z',
    price: price(0, false),
    specialist: null,
    timeline: steps([], {}),
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
    scheduledAt: '2026-06-12T22:00:00Z',
    addressLabel: 'Casa · Santa Fe',
    createdAt: '2026-06-10T10:00:00Z',
    price: price(380),
    specialist: null,
    timeline: steps([], {}),
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
