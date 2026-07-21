/**
 * Time helpers. Shared byte-identical with
 * `../../../partner-app-reference/src/data/time.ts` (see INTEROP.md, checked by
 * `scripts/check-app-sync.mjs`).
 *
 * WHY CDMX-FIXED MATH: SERVI operates in a single timezone and the backend pins
 * `process.env.TZ` to `America/Mexico_City` (see `backend/timezone.mjs`). Every
 * wall-clock calculation below is done against a fixed CDMX offset, so the apps
 * produce identical output on any machine regardless of the device timezone.
 * CDMX has been UTC-6 year-round with no DST since 2022.
 *
 * (The prototypes ran on a frozen DEMO_NOW clock so the two apps could review
 * the same fixture orders side-by-side; production uses the real clock.)
 */

export function now(): Date {
  return new Date();
}

const DAY_MS = 86_400_000;
/** CDMX is UTC-6 year-round (no DST since 2022). */
const CDMX_OFFSET_MIN = -360;

type Parts = { year: number; month: number; day: number; hour: number; minute: number; dow: number };

/** Wall-clock parts of an instant, expressed in CDMX — timezone-independent. */
function cdmxParts(input: string | Date): Parts {
  const ms = (typeof input === 'string' ? new Date(input) : input).getTime();
  // Shift so the UTC getters read the CDMX wall clock (CDMX = UTC − 6h).
  const s = new Date(ms + CDMX_OFFSET_MIN * 60_000);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth(),
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
}

/** Build the instant for a CDMX wall-clock date/time (inverse of cdmxParts). */
function cdmxInstant(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(Date.UTC(year, month, day, hour, minute) - CDMX_OFFSET_MIN * 60_000).toISOString();
}

/** Days from now. With an hour, pins to that CDMX wall-clock time. */
export function fromNow(days: number, hour?: number, minute = 0): string {
  const base = new Date(now().getTime() + days * DAY_MS);
  if (hour == null) return base.toISOString();
  const p = cdmxParts(base);
  return cdmxInstant(p.year, p.month, p.day, hour, minute);
}

export function isSameDay(a: Date, b: Date): boolean {
  const pa = cdmxParts(a);
  const pb = cdmxParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return isSameDay(new Date(iso), now());
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function clockTime(iso: string): string {
  const p = cdmxParts(iso);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** "Hoy · 17:30" / "Today · 17:30" — the label used on every job card. */
export function whenLabel(iso: string | null, lang: 'es' | 'en'): string {
  if (!iso) return lang === 'es' ? 'Lo antes posible' : 'As soon as possible';
  const p = cdmxParts(iso);
  const n = cdmxParts(now());
  const time = clockTime(iso);
  const dayDiff = Math.round(
    (Date.UTC(p.year, p.month, p.day) - Date.UTC(n.year, n.month, n.day)) / DAY_MS,
  );
  if (dayDiff === 0) return `${lang === 'es' ? 'Hoy' : 'Today'} · ${time}`;
  if (dayDiff === 1) return `${lang === 'es' ? 'Mañana' : 'Tomorrow'} · ${time}`;
  if (dayDiff === -1) return `${lang === 'es' ? 'Ayer' : 'Yesterday'} · ${time}`;
  const dow = lang === 'es' ? DAYS_ES[p.dow] : DAYS_EN[p.dow];
  const mon = lang === 'es' ? MONTHS_ES[p.month] : MONTHS_EN[p.month];
  return lang === 'es'
    ? `${dow} ${p.day} ${mon} · ${time}`
    : `${dow} ${mon} ${p.day} · ${time}`;
}

/** "23 jun" / "Jun 23" — compact date, no time. */
export function dateLabel(iso: string, lang: 'es' | 'en'): string {
  const p = cdmxParts(iso);
  const mon = lang === 'es' ? MONTHS_ES[p.month] : MONTHS_EN[p.month];
  return lang === 'es' ? `${p.day} ${mon}` : `${mon} ${p.day}`;
}

/** "junio 2026" / "June 2026" — used by the monthly earnings header. */
export function monthLabel(d: Date, lang: 'es' | 'en'): string {
  const es = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const en = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p = cdmxParts(d);
  return `${(lang === 'es' ? es : en)[p.month]} ${p.year}`;
}

/** CDMX hour-of-day (0–23) of an instant — for time-of-day greetings. */
export function hourCDMX(input: string | Date): number {
  return cdmxParts(input).hour;
}

/** CDMX weekday index with Monday = 0 — for week strips and per-day bucketing. */
export function weekdayMon(input: string | Date): number {
  return (cdmxParts(input).dow + 6) % 7;
}

/** Minutes → "2 h 30 min" / "45 min". */
export function duration(minutes: number, lang: 'es' | 'en'): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hUnit = lang === 'es' ? 'h' : 'h';
  const mUnit = 'min';
  if (h && m) return `${h} ${hUnit} ${m} ${mUnit}`;
  if (h) return `${h} ${hUnit}`;
  return `${m} ${mUnit}`;
}

/** Seconds → "9:58" for the offer countdown. */
export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The Monday of the current week (CDMX 00:00) — anchors the earnings week strip. */
export function weekStart(): Date {
  const p = cdmxParts(now());
  const dow = (p.dow + 6) % 7; // Mon = 0
  return new Date(cdmxInstant(p.year, p.month, p.day - dow, 0, 0));
}

/** Next Monday 09:00 CDMX — when the standard weekly payout lands. */
export function nextPayoutDate(): string {
  const p = cdmxParts(weekStart());
  return cdmxInstant(p.year, p.month, p.day + 7, 9, 0);
}

/** First instant of the current CDMX month — for monthly earnings bucketing. */
export function monthStart(): Date {
  const p = cdmxParts(now());
  return new Date(cdmxInstant(p.year, p.month, 1, 0, 0));
}
