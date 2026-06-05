const DEFAULT_DURATION_HOURS = 2;

const CATEGORY_DURATION_HOURS = [
  { keys: ['clean', 'limpieza'], hours: 3 },
  { keys: ['repair', 'repar', 'plumb', 'electric', 'handyman', 'jardin', 'garden'], hours: 2 },
  { keys: ['wellness', 'bienestar', 'massage', 'cuidado', 'trainer'], hours: 1.5 },
  { keys: ['moving', 'delivery', 'move', 'mudanza', 'entrega', 'errand'], hours: 1 },
  { keys: ['supplier', 'suppliers', 'supply', 'proveedor', 'insumo', 'pharmacy', 'catering'], hours: 1 },
];

const SEVERITY_WEIGHT = {
  critical: 3000,
  soon: 2000,
  watch: 1000,
  safe: 0,
};

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isAsap(row) {
  const raw = row?.is_asap ?? row?.isAsap;
  return raw === true || String(raw || '').toLowerCase() === 'true';
}

function isSettledStatus(status) {
  const s = normalizeStatus(status);
  return s.startsWith('captured')
    || s.startsWith('cancel')
    || s === 'refunded'
    || s === 'pending cash';
}

function isPaymentFailedStatus(status) {
  const s = normalizeStatus(status);
  return s.includes('declined')
    || s.includes('failed')
    || s.includes('requires_action')
    || s.includes('authentication_required')
    || s.includes('payment update')
    || s.includes('update payment');
}

export function serviceDurationHours(row = {}) {
  const category = String(row.category || row.booking_type || row.service_description || '').toLowerCase();
  const match = CATEGORY_DURATION_HOURS.find((rule) => rule.keys.some((key) => category.includes(key)));
  return match?.hours || DEFAULT_DURATION_HOURS;
}

export function serviceStartMs(row = {}) {
  if (row.service_datetime) {
    const t = new Date(row.service_datetime).getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (row.service_date) {
    const [y, m, d] = String(row.service_date).split('-').map(Number);
    if (y && m && d) return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  }
  return null;
}

function buildOps({
  row,
  code,
  severity,
  label,
  actionLabel,
  startsAt,
  estimatedEndsAt,
  minutesToStart,
  minutesSinceEnd,
  nowMs,
}) {
  const amountCents = Number(row.pricing_total_amount || row.amount || 0);
  const urgency = Number.isFinite(minutesToStart)
    ? Math.max(0, 1440 - Math.abs(minutesToStart))
    : Number.isFinite(minutesSinceEnd)
      ? Math.max(0, 720 - Math.abs(minutesSinceEnd))
      : 0;
  const exposure = Math.min(500, Math.round(amountCents / 1000));
  const score = (SEVERITY_WEIGHT[severity] || 0) + urgency + exposure;
  return {
    code,
    severity,
    label,
    actionLabel,
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    estimatedEndsAt: estimatedEndsAt ? new Date(estimatedEndsAt).toISOString() : null,
    minutesToStart: Number.isFinite(minutesToStart) ? Math.round(minutesToStart) : null,
    minutesSinceEnd: Number.isFinite(minutesSinceEnd) ? Math.round(minutesSinceEnd) : null,
    score,
    computedAt: new Date(nowMs).toISOString(),
  };
}

export function classifyOrderOps(row = {}, { now = new Date() } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const status = normalizeStatus(row.status);
  const startsAt = serviceStartMs(row);
  const durationMs = serviceDurationHours(row) * 60 * 60 * 1000;
  const estimatedEndsAt = startsAt ? startsAt + durationMs : null;
  const minutesToStart = startsAt ? (startsAt - safeNowMs) / 60_000 : Infinity;
  const minutesSinceEnd = estimatedEndsAt ? (safeNowMs - estimatedEndsAt) / 60_000 : null;
  const hasExactTime = Boolean(row.service_datetime);
  const hasPaymentIntent = Boolean(row.payment_intent_id) && !String(row.payment_intent_id).startsWith('seti_');
  const isConfirmed = status === 'confirmed';
  const isScheduled = status === 'scheduled';

  if (isPaymentFailedStatus(status)) {
    return buildOps({
      row,
      code: 'payment_failed',
      severity: 'critical',
      label: 'Pago requiere atención',
      actionLabel: 'Enviar enlace',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if (isSettledStatus(status) || row.cash_selected) {
    return buildOps({
      row,
      code: 'safe',
      severity: 'safe',
      label: 'Sin alerta operativa',
      actionLabel: '',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if (isAsap(row) && !hasExactTime) {
    return buildOps({
      row,
      code: 'needs_schedule',
      severity: 'watch',
      label: 'ASAP pendiente de agendar',
      actionLabel: 'Agendar',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if (!hasExactTime) {
    return buildOps({
      row,
      code: 'needs_schedule',
      severity: 'watch',
      label: 'Falta hora confirmada',
      actionLabel: 'Agendar',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if ((isConfirmed || isScheduled) && estimatedEndsAt && safeNowMs > estimatedEndsAt) {
    const overdue = minutesSinceEnd >= 120;
    return buildOps({
      row,
      code: overdue ? 'capture_overdue' : 'capture_due',
      severity: overdue ? 'critical' : 'soon',
      label: overdue ? 'Captura vencida' : 'Captura pendiente',
      actionLabel: 'Capturar',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if (startsAt && safeNowMs >= startsAt && estimatedEndsAt && safeNowMs <= estimatedEndsAt) {
    return buildOps({
      row,
      code: 'in_progress',
      severity: 'soon',
      label: 'Servicio en curso',
      actionLabel: 'Monitorear',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if (minutesToStart >= 0 && minutesToStart <= 120) {
    return buildOps({
      row,
      code: 'starting_soon',
      severity: 'critical',
      label: 'Servicio por iniciar',
      actionLabel: isConfirmed ? 'Revisar' : 'Autorizar ahora',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  if (minutesToStart >= 0 && minutesToStart <= 1440 && !isConfirmed && !hasPaymentIntent && !row.cash_selected) {
    return buildOps({
      row,
      code: 'preauth_due',
      severity: 'soon',
      label: 'Autorización dentro de 24h',
      actionLabel: 'Autorizar ahora',
      startsAt,
      estimatedEndsAt,
      minutesToStart,
      minutesSinceEnd,
      nowMs: safeNowMs,
    });
  }

  return buildOps({
    row,
    code: 'safe',
    severity: 'safe',
    label: isConfirmed ? 'Confirmada y lista' : 'Sin alerta urgente',
    actionLabel: '',
    startsAt,
    estimatedEndsAt,
    minutesToStart,
    minutesSinceEnd,
    nowMs: safeNowMs,
  });
}

export function summarizeOps(items = []) {
  return items.reduce((acc, item) => {
    const severity = item?.ops?.severity || item?.severity || 'safe';
    if (severity === 'critical') acc.critical += 1;
    else if (severity === 'soon') acc.soon += 1;
    else if (severity === 'watch') acc.watch += 1;
    return acc;
  }, { critical: 0, soon: 0, watch: 0 });
}

export function sortOpsItems(a, b) {
  const aScore = Number(a?.ops?.score ?? a?.score ?? 0);
  const bScore = Number(b?.ops?.score ?? b?.score ?? 0);
  if (bScore !== aScore) return bScore - aScore;
  const aStart = Date.parse(a?.ops?.startsAt || a?.startsAt || '') || Number.MAX_SAFE_INTEGER;
  const bStart = Date.parse(b?.ops?.startsAt || b?.startsAt || '') || Number.MAX_SAFE_INTEGER;
  return aStart - bStart;
}
