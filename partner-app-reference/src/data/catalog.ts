/**
 * Partner-side catalog: trades, tiers, verification documents, coverage zones.
 *
 * `TradeKey` values match the customer app's `CategoryKey` (see
 * `../../../native-app-reference/src/data/types.ts`) so a request created on the
 * client side routes to the right specialists with no translation layer.
 * SERVI's six customer-facing categories collapse to five partner trades —
 * `custom` exists for clients who can't classify their own problem, but a
 * specialist always belongs to a real trade.
 */
import type { DocumentKey, Trade, TradeKey, VerificationDoc, Tier, TierKey } from './types';

export const TRADES: Trade[] = [
  {
    key: 'cleaning',
    label: { es: 'Limpieza', en: 'Cleaning' },
    icon: 'wind',
    skills: [
      { es: 'Limpieza de hogar', en: 'Home cleaning' },
      { es: 'Limpieza profunda', en: 'Deep cleaning' },
      { es: 'Limpieza de oficina', en: 'Office cleaning' },
      { es: 'Lavado de alfombras y muebles', en: 'Carpet & upholstery washing' },
      { es: 'Limpieza de ventanas', en: 'Window cleaning' },
      { es: 'Jardinería', en: 'Gardening' },
    ],
  },
  {
    key: 'repair',
    label: { es: 'Armar, reparar y mantenimiento', en: 'Build, repair & maintenance' },
    icon: 'tool',
    skills: [
      { es: 'Plomería', en: 'Plumbing' },
      { es: 'Electricidad', en: 'Electrical' },
      { es: 'Carpintería', en: 'Carpentry' },
      { es: 'Pintura', en: 'Painting' },
      { es: 'Armado de muebles', en: 'Furniture assembly' },
      { es: 'Montaje en muro (TV, repisas)', en: 'Wall mounting (TV, shelves)' },
      { es: 'Impermeabilización', en: 'Waterproofing' },
      { es: 'Cerrajería', en: 'Locksmithing' },
      { es: 'Aire acondicionado', en: 'Air conditioning' },
    ],
  },
  {
    key: 'moving',
    label: { es: 'Mudanzas y entregas', en: 'Moving & deliveries' },
    icon: 'truck',
    skills: [
      { es: 'Mudanza local', en: 'Local moving' },
      { es: 'Carga y descarga', en: 'Loading & unloading' },
      { es: 'Entrega exprés', en: 'Express delivery' },
      { es: 'Retiro de escombro', en: 'Debris removal' },
    ],
  },
  {
    key: 'wellness',
    label: { es: 'Bienestar y cuidado personal', en: 'Wellness & personal care' },
    icon: 'heart',
    skills: [
      { es: 'Masaje a domicilio', en: 'In-home massage' },
      { es: 'Estilismo y barbería', en: 'Styling & barbering' },
      { es: 'Manicura y pedicura', en: 'Manicure & pedicure' },
      { es: 'Cuidado de adulto mayor', en: 'Elder care' },
      { es: 'Entrenamiento personal', en: 'Personal training' },
    ],
  },
  {
    key: 'suppliers',
    label: { es: 'Abastecimiento y compras', en: 'Supply & shopping' },
    icon: 'shopping-bag',
    skills: [
      { es: 'Súper y despensa', en: 'Groceries' },
      { es: 'Compra de materiales', en: 'Materials sourcing' },
      { es: 'Trámites y mandados', en: 'Errands & paperwork' },
    ],
  },
];

export function findTrade(key: TradeKey): Trade | undefined {
  return TRADES.find((t) => t.key === key);
}

/**
 * Tiers. Deliberately earned through *reliability*, not volume alone — a
 * specialist who takes 200 jobs and no-shows on 20 of them should not outrank
 * one who takes 60 and shows up for all of them. Perks are real operational
 * levers (offer priority, faster money), not badges.
 */
export const TIERS: Tier[] = [
  {
    key: 'nuevo',
    label: { es: 'Nuevo', en: 'New' },
    minJobs: 0,
    minPositivePct: 0,
    perks: [
      { es: 'Depósito semanal cada lunes', en: 'Weekly deposit every Monday' },
      { es: 'Soporte por correo', en: 'Email support' },
    ],
  },
  {
    key: 'plata',
    label: { es: 'Plata', en: 'Silver' },
    minJobs: 25,
    minPositivePct: 90,
    perks: [
      { es: 'Retiro inmediato disponible', en: 'Instant cash out available' },
      { es: 'Ves los trabajos 5 min antes', en: 'See jobs 5 min earlier' },
    ],
  },
  {
    key: 'oro',
    label: { es: 'Oro', en: 'Gold' },
    minJobs: 100,
    minPositivePct: 93,
    perks: [
      { es: 'Prioridad en trabajos de tu zona', en: 'Priority on jobs in your area' },
      { es: 'Retiro inmediato sin comisión', en: 'Instant cash out with no fee' },
      { es: 'Soporte prioritario por WhatsApp', en: 'Priority WhatsApp support' },
    ],
  },
  {
    key: 'elite',
    label: { es: 'Élite', en: 'Elite' },
    minJobs: 250,
    minPositivePct: 96,
    perks: [
      { es: 'Primero en trabajos urgentes y grandes', en: 'First pick on urgent and large jobs' },
      { es: 'Depósito el mismo día, sin comisión', en: 'Same-day deposit, no fee' },
      { es: 'Perfil destacado con los clientes', en: 'Featured profile with clients' },
      { es: 'Gestor de cuenta asignado', en: 'Assigned account manager' },
    ],
  },
];

export function findTier(key: TierKey): Tier {
  return TIERS.find((t) => t.key === key) ?? TIERS[0];
}

/** The tier immediately above `key`, or null at the top. */
export function nextTier(key: TierKey): Tier | null {
  const i = TIERS.findIndex((t) => t.key === key);
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null;
}

/**
 * Verification documents. `certification` is the only optional one — it isn't
 * required to work, but it unlocks the trades where it legally matters
 * (electrical, gas, elder care) and shows on the client's specialist card.
 */
export const DOCUMENTS: Omit<VerificationDoc, 'status'>[] = [
  {
    key: 'id_front',
    label: { es: 'INE — frente', en: 'ID — front' },
    hint: { es: 'Credencial para votar, pasaporte o FM', en: 'Voter ID, passport or FM card' },
    required: true,
  },
  {
    key: 'id_back',
    label: { es: 'INE — reverso', en: 'ID — back' },
    hint: { es: 'Que se lea el código de barras', en: 'Barcode must be readable' },
    required: true,
  },
  {
    key: 'selfie',
    label: { es: 'Selfie con tu INE', en: 'Selfie with your ID' },
    hint: { es: 'Confirmamos que eres tú', en: 'Confirms it’s really you' },
    required: true,
  },
  {
    key: 'address_proof',
    label: { es: 'Comprobante de domicilio', en: 'Proof of address' },
    hint: { es: 'Luz, agua o predial, máximo 3 meses', en: 'Utility or property bill, max 3 months old' },
    required: true,
  },
  {
    key: 'certification',
    label: { es: 'Certificación del oficio', en: 'Trade certification' },
    hint: {
      es: 'Opcional — te desbloquea trabajos mejor pagados',
      en: 'Optional — unlocks better-paid jobs',
    },
    required: false,
  },
];

export function docMeta(key: DocumentKey) {
  return DOCUMENTS.find((d) => d.key === key) ?? DOCUMENTS[0];
}

/** SERVI's live service area — Santa Fe and the colonias around it. */
export const ZONES: string[] = [
  'Santa Fe',
  'Lomas de Santa Fe',
  'Contadero',
  'Cuajimalpa Centro',
  'El Yaqui',
  'Bosques de las Lomas',
  'Interlomas',
  'Vista Hermosa',
  'La Herradura',
  'Tecamachalco',
  'Lomas de Chapultepec',
  'Polanco',
];
