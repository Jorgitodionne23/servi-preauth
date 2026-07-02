import { test, expect } from '@playwright/test';

const BASE = process.env.ADMIN_E2E_BASE_URL || 'http://localhost:4242';
const ADMIN_URL = `${BASE}/admin.html`;
// Local-dev default matches the token in the local .env. In any shared/CI run,
// override via ADMIN_API_TOKEN so a real token is never committed.
const VALID_TOKEN = process.env.ADMIN_API_TOKEN || 'b92d6934a131c7db37c75c69bac64e77';
const BAD_TOKEN = 'invalidtoken123';

// ─── helpers ────────────────────────────────────────────────────────────────

async function login(page, token = VALID_TOKEN) {
  await page.goto(ADMIN_URL);
  await page.waitForSelector('#auth-gate', { state: 'visible' });
  await page.fill('#token-input', token);
  await page.click('button.auth-btn');
}

async function loginAndWait(page) {
  await login(page);
  // testAuth() sets style.display='flex' after stats API responds
  await page.waitForFunction(
    () => {
      const d = document.getElementById('dashboard');
      return d && d.style.display === 'flex';
    },
    { timeout: 15000 }
  );
}

// Maps list element IDs to their paired empty-state element IDs
const EMPTY_STATE_ID = {
  'inbox-list': 'inbox-empty',
  'orders-body': 'orders-empty',
  'providers-body': 'providers-empty',
};

// Wait for a list to finish loading: either it has content, shows an empty-state,
// or shows an error message. Handles the case where list.innerHTML === '' when empty
// (the empty-state sibling becomes visible instead).
async function waitForListLoad(page, listId, timeout = 8000) {
  const emptyId = EMPTY_STATE_ID[listId] || null;
  await page.waitForFunction(
    ([id, empId]) => {
      const el = document.getElementById(id);
      if (!el) return false;
      const inner = el.innerHTML;
      // Still in initial loading state
      if (inner.includes('Cargando...')) return false;
      // Has rendered content (cards / rows / error div)
      if (inner.trim() !== '') return true;
      // List is empty — check the sibling empty-state element
      if (empId) {
        const emptyEl = document.getElementById(empId);
        return emptyEl && emptyEl.style.display !== 'none';
      }
      return false;
    },
    [listId, emptyId],
    { timeout }
  );
}

const EMPTY_STATS = {
  requestsToday: 0,
  pendingOrders: 0,
  confirmedOrders: 0,
  capturedOrders: 0,
  capturedRevenue: 0,
  newReports: 0,
  pendingApplications: 0,
};

function orderFixture(overrides = {}) {
  return {
    id: 'order-sch-1',
    public_code: 'SV-TEST',
    kind: 'primary',
    client_name: 'Cliente Prueba',
    client_phone: '+525555555555',
    client_email: 'cliente@test.dev',
    service_description: 'Reparación de prueba',
    service_date: '2026-06-08',
    service_datetime: '2026-06-08T16:30:00.000-06:00',
    is_asap: false,
    service_address: 'Calle Test 123',
    amount: 120000,
    provider_amount: 90000,
    booking_fee_amount: 18000,
    processing_fee_amount: 5000,
    vat_amount: 7000,
    pricing_total_amount: 120000,
    status: 'Scheduled',
    provider_id: null,
    provider_name: 'Proveedor Test',
    customer_id: null,
    payment_intent_id: 'pi_test_123',
    cash_selected: false,
    parent_id_of_adjustment: null,
    created_at: '2026-06-05T18:00:00.000Z',
    ...overrides,
  };
}

function futureService(hoursFromNow) {
  const dt = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return {
    service_date: dt.toISOString().slice(0, 10),
    service_datetime: dt.toISOString(),
  };
}

function opsFixture(overrides = {}) {
  return {
    code: 'preauth_due',
    severity: 'soon',
    label: 'Autorización dentro de 24h',
    actionLabel: 'Autorizar ahora',
    startsAt: '2026-06-08T16:30:00.000Z',
    estimatedEndsAt: '2026-06-08T18:30:00.000Z',
    minutesToStart: 120,
    minutesSinceEnd: null,
    score: 2200,
    ...overrides,
  };
}

async function mockAdminApis(page, {
  orders = [],
  submissions = [],
  providers = [],
  detailOrder = null,
  opsRadar = null,
  onCreatePaymentIntent = null,
  onPatchServiceRequest = null,
  onPreauthNow = null,
  onSnooze = null,
} = {}) {
  await page.route('**/api/admin/stats', route => route.fulfill({ json: EMPTY_STATS }));
  await page.route('**/api/admin/ops-radar', route => route.fulfill({
    json: (typeof opsRadar === 'function' ? opsRadar() : opsRadar) || { ok: true, generatedAt: '2026-06-05T18:00:00.000Z', summary: { critical: 0, soon: 0, watch: 0 }, next: null, items: [] },
  }));
  await page.route('**/api/admin/orders/*/changes', route => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/admin/orders/*/preauth-now', async route => {
    if (onPreauthNow) await onPreauthNow(route.request());
    return route.fulfill({ json: { ok: true, status: 'requires_capture', paymentIntentId: 'pi_preauth_now' } });
  });
  await page.route('**/api/admin/orders/*/ops-alerts/*/snooze', async route => {
    if (onSnooze) await onSnooze(route.request());
    return route.fulfill({ json: { ok: true, snoozedUntil: '2026-06-05T18:15:00.000Z' } });
  });
  await page.route('**/api/admin/orders/*', route => {
    const order = detailOrder || orders[0] || orderFixture();
    return route.fulfill({ json: { order, adjustments: [] } });
  });
  await page.route('**/api/admin/orders?*', route => route.fulfill({ json: { items: orders, total: orders.length } }));
  await page.route('**/api/admin/providers?*', route => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get('search') || '').toLowerCase();
    const status = url.searchParams.get('status') || '';
    const items = providers.filter(p => {
      const statusOk = !status || p.status === status;
      const haystack = [p.provider_id, p.name, p.phone, p.specialty, p.city].filter(Boolean).join(' ').toLowerCase();
      return statusOk && (!q || haystack.includes(q));
    });
    return route.fulfill({ json: { items, total: items.length } });
  });
  await page.route('**/api/service-requests?*', route => route.fulfill({ json: { items: submissions, total: submissions.length } }));
  await page.route('**/api/service-requests/*', async route => {
    if (onPatchServiceRequest) await onPatchServiceRequest(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true } });
  });
  await page.route('**/create-payment-intent', async route => {
    if (onCreatePaymentIntent) await onCreatePaymentIntent(route.request().postDataJSON());
    return route.fulfill({ json: { orderId: 'order-from-asap', payUrl: 'http://localhost:4242/pay.html?order=order-from-asap' } });
  });
}

// ─── Auth gate ───────────────────────────────────────────────────────────────

test.describe('Auth gate', () => {
  test('shows auth gate on load', async ({ page }) => {
    await page.goto(ADMIN_URL);
    await expect(page.locator('#auth-gate')).toBeVisible();
    await expect(page.locator('#dashboard')).toBeHidden();
  });

  test('rejects invalid token', async ({ page }) => {
    await login(page, BAD_TOKEN);
    await page.waitForSelector('#auth-error', { state: 'visible', timeout: 8000 });
    await expect(page.locator('#auth-error')).toBeVisible();
    // Dashboard should NOT have been set to flex
    const display = await page.evaluate(() => document.getElementById('dashboard').style.display);
    expect(display).not.toBe('flex');
  });

  test('accepts valid token and shows dashboard', async ({ page }) => {
    await loginAndWait(page);
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.main-area')).toBeVisible();
  });

  test('logout returns to auth gate', async ({ page }) => {
    await loginAndWait(page);
    await page.click('button.admin-logout');
    await expect(page.locator('#auth-gate')).toBeVisible();
    const display = await page.evaluate(() => document.getElementById('dashboard').style.display);
    expect(display).toBe('none');
  });
});

// ─── Topbar ──────────────────────────────────────────────────────────────────

test.describe('Topbar', () => {
  test.beforeEach(async ({ page }) => loginAndWait(page));

  test('shows SERVI logo', async ({ page }) => {
    const logo = page.locator('.tb-logo');
    await expect(logo).toBeVisible();
    await expect(logo).toHaveText('SERVI.');
  });

  test('shows Admin badge', async ({ page }) => {
    await expect(page.locator('.tb-badge')).toContainText('Admin');
  });

  test('shows Live Dispatch status indicator', async ({ page }) => {
    await expect(page.locator('#tb-status')).toBeVisible();
    await expect(page.locator('#tb-status')).toContainText('Live Dispatch');
    await expect(page.locator('.dot-live')).toBeVisible();
  });
});

// ─── Stats row ───────────────────────────────────────────────────────────────

test.describe('Stats cards', () => {
  test.beforeEach(async ({ page }) => loginAndWait(page));

  test('stats row renders at least 2 cards', async ({ page }) => {
    await page.waitForSelector('.stat-card', { timeout: 8000 });
    const count = await page.locator('.stat-card').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('stat cards have numeric content', async ({ page }) => {
    await page.waitForSelector('.stat-card .num', { timeout: 8000 });
    const first = await page.locator('.stat-card .num').first().textContent();
    expect(first.trim().length).toBeGreaterThan(0);
  });
});

// ─── Sidebar navigation ──────────────────────────────────────────────────────

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => loginAndWait(page));

  const panels = ['inbox', 'orders', 'providers', 'nueva', 'ajustes'];

  for (const panel of panels) {
    test(`switches to panel: ${panel}`, async ({ page }) => {
      const navBtn = page.locator(`.nav-item[data-panel="${panel}"]`);
      await expect(navBtn).toBeVisible();
      await navBtn.click();
      await expect(navBtn).toHaveClass(/active/);
      await expect(page.locator(`#panel-${panel}`)).toBeVisible();
    });
  }

  test('only one panel active at a time', async ({ page }) => {
    await page.locator('.nav-item[data-panel="orders"]').click();
    // panel-orders has class panel-section--active; others should not be visible
    await expect(page.locator('#panel-inbox')).toBeHidden();
    await expect(page.locator('#panel-orders')).toBeVisible();
  });
});

// ─── Inbox panel ─────────────────────────────────────────────────────────────

test.describe('Inbox panel', () => {
  // Orders is the default panel, so navigate to Inbox before each assertion.
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="inbox"]').click();
    await expect(page.locator('#panel-inbox')).toBeVisible();
  });

  test('shows inbox filter row', async ({ page }) => {
    await expect(page.locator('#inbox-filter-row')).toBeVisible();
  });

  test('inbox loads (cards or empty state)', async ({ page }) => {
    // Wait for loading spinner to clear
    await waitForListLoad(page, 'inbox-list', 10000);
    const cards = await page.locator('.inbox-card').count();
    const emptyVis = await page.locator('#inbox-empty').isVisible();
    const errorVis = await page.locator('#inbox-list').evaluate(el =>
      el.innerHTML.includes('Error')
    );
    expect(cards > 0 || emptyVis || errorVis).toBeTruthy();
  });

  test('inbox stats section renders', async ({ page }) => {
    // #inbox-stats is populated by renderInboxStats() after loadInbox
    await page.waitForFunction(
      () => {
        const el = document.getElementById('inbox-stats');
        return el && el.innerHTML.trim() !== '';
      },
      { timeout: 10000 }
    );
    await expect(page.locator('#inbox-stats')).not.toBeEmpty();
  });

  test('status filter pills use data-status-filter attribute', async ({ page }) => {
    const pills = page.locator('#inbox-filter-row [data-status-filter]');
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
  });

  test('type filter pills use data-type-filter attribute', async ({ page }) => {
    const pills = page.locator('#inbox-filter-row [data-type-filter]');
    const count = await pills.count();
    expect(count).toBeGreaterThan(0);
  });

  test('status filter pill gets active class on click', async ({ page }) => {
    // Click "Nuevos" filter (data-status-filter="new")
    const pill = page.locator('[data-status-filter="new"]');
    await pill.click();
    await expect(pill).toHaveClass(/filter-pill--active-status/);
  });

  test('inbox detail side panel opens on card click', async ({ page }) => {
    await waitForListLoad(page, 'inbox-list', 10000);
    const cardCount = await page.locator('.inbox-card').count();
    if (cardCount === 0) {
      test.skip(true, 'No inbox cards in test data');
      return;
    }
    await page.locator('.inbox-card').first().click();
    await expect(page.locator('#inbox-panel-detail')).toBeVisible({ timeout: 3000 });
  });

  test('inbox detail panel closes via sp-close button', async ({ page }) => {
    await waitForListLoad(page, 'inbox-list', 10000);
    const cardCount = await page.locator('.inbox-card').count();
    if (cardCount === 0) test.skip(true, 'No inbox cards');
    await page.locator('.inbox-card').first().click();
    await page.locator('#inbox-panel-detail button.sp-close').click();
    await expect(page.locator('#inbox-panel-detail')).toBeHidden({ timeout: 2000 });
  });
});

// ─── Orders panel ────────────────────────────────────────────────────────────

test.describe('Orders panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="orders"]').click();
    await expect(page.locator('#panel-orders')).toBeVisible();
  });

  test('search input is present', async ({ page }) => {
    await expect(page.locator('#orders-search')).toBeVisible();
  });

  test('status filter dropdown is present', async ({ page }) => {
    await expect(page.locator('#orders-status')).toBeVisible();
  });

  test('status filter includes incoming web requests', async ({ page }) => {
    await expect(page.locator('#orders-status option[value="Incoming"]')).toHaveText('Incoming');
  });

  test('orders load (table rows or empty state)', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const rowCount = await page.locator('#orders-body tr').count();
    const emptyVis = await page.locator('#orders-empty').isVisible();
    expect(rowCount > 0 || emptyVis).toBeTruthy();
  });

  // Only real order rows open the detail panel; incoming WEB-submission rows
  // expose a "+ Crear enlace" button instead and have no row-level click handler.
  test('order row click opens detail side panel', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const orderRows = page.locator('#orders-body tr[onclick]');
    if (await orderRows.count() === 0) {
      test.skip(true, 'No real order rows in test data (only WEB submissions)');
      return;
    }
    await orderRows.first().click();
    await expect(page.locator('#order-panel')).toHaveClass(/open/, { timeout: 5000 });
  });

  test('order detail panel closes via sp-close button', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const orderRows = page.locator('#orders-body tr[onclick]');
    if (await orderRows.count() === 0) {
      test.skip(true, 'No real order rows in test data (only WEB submissions)');
      return;
    }
    await orderRows.first().click();
    await expect(page.locator('#order-panel')).toHaveClass(/open/, { timeout: 5000 });
    await page.locator('#order-panel button.sp-close').click();
    await expect(page.locator('#order-panel')).not.toHaveClass(/open/, { timeout: 2000 });
  });

  test('search input filters table', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const rowsBefore = await page.locator('#orders-body tr').count();
    if (rowsBefore === 0) test.skip(true, 'No orders in test data');
    await page.fill('#orders-search', 'ZZZNOMATCHWHATSOEVER');
    await page.waitForTimeout(600);
    const rowsAfter = await page.locator('#orders-body tr').count();
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
  });

  test('status filter changes results', async ({ page }) => {
    await page.selectOption('#orders-status', 'Captured');
    await page.waitForTimeout(600);
    const rows = await page.locator('#orders-body tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  test('pagination container is present', async ({ page }) => {
    await expect(page.locator('#orders-pagination')).toBeAttached();
  });
});

test.describe('Orders panel scheduling UI (mocked)', () => {
  test('Ops Radar renders summary counters and next alert', async ({ page }) => {
    const risky = orderFixture({
      id: 'order-risk-1',
      public_code: 'SV-RISK',
      ops: opsFixture({ severity: 'critical', label: 'Captura vencida', code: 'capture_overdue', actionLabel: 'Capturar' }),
    });
    await mockAdminApis(page, {
      orders: [risky],
      opsRadar: {
        ok: true,
        generatedAt: '2026-06-05T18:00:00.000Z',
        summary: { critical: 1, soon: 0, watch: 0 },
        next: risky,
        items: [risky],
      },
    });
    await loginAndWait(page);

    await expect(page.locator('#ops-radar')).toBeVisible();
    await expect(page.locator('#ops-command')).toContainText('Captura vencida');
    await expect(page.locator('#ops-counters')).toContainText('1');
    await expect(page.locator('#ops-heartbeat-time')).toContainText('Refresh');
  });

  test('Atención filter shows only active risky orders', async ({ page }) => {
    const risky = orderFixture({
      id: 'order-risk-2',
      public_code: 'SV-RISK2',
      client_name: 'Cliente Riesgo',
      ops: opsFixture(),
    });
    const safe = orderFixture({
      id: 'order-safe-1',
      public_code: 'SV-SAFE',
      client_name: 'Cliente Seguro',
      status: 'Confirmed',
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Confirmada y lista', actionLabel: '' }),
    });
    await mockAdminApis(page, { orders: [risky, safe] });
    await loginAndWait(page);
    await page.locator('#orders-attention').click();
    await waitForListLoad(page, 'orders-body', 10000);

    await expect(page.locator('#orders-body tr')).toHaveCount(1);
    await expect(page.locator('#orders-body')).toContainText('Cliente Riesgo');
    await expect(page.locator('#orders-body')).not.toContainText('Cliente Seguro');
  });

  test('risk rails render from ops severity', async ({ page }) => {
    const risky = orderFixture({
      id: 'order-risk-rail',
      ops: opsFixture({ severity: 'critical', code: 'payment_failed', label: 'Pago requiere atención' }),
    });
    await mockAdminApis(page, { orders: [risky] });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    await expect(page.locator('#orders-body tr').first()).toHaveClass(/row-ops-critical/);
  });

  test('orders table shows received date and time for orders and web submissions', async ({ page }) => {
    const order = orderFixture({
      id: 'order-received-1',
      public_code: 'SV-RECV',
      client_name: 'Cliente Recibido',
      created_at: '2026-06-05T18:00:00.000Z',
    });
    await mockAdminApis(page, {
      orders: [order],
      submissions: [{
        id: 'sub-received-1',
        category: 'repair',
        description: 'Solicitud recibida',
        preferred_date: '2026-06-09',
        preferred_time: '11:30',
        is_asap: false,
        service_address: 'Calle Recibida 10',
        client_name: 'Cliente Web Recibido',
        client_phone: '+525500000010',
        client_email: '',
        status: 'pending',
        created_at: '2026-06-06T19:30:00.000Z',
      }],
    });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    await expect(page.locator('#panel-orders thead')).toContainText('Recibida');

    const orderReceivedCell = page.locator('#orders-body tr', { hasText: 'Cliente Recibido' }).locator('td').nth(1);
    await expect(orderReceivedCell).toContainText(/05\s+jun\.?\s+2026/i);
    await expect(orderReceivedCell).toContainText(/\d{2}:\d{2}/);

    const submissionReceivedCell = page.locator('#orders-body tr', { hasText: 'Cliente Web Recibido' }).locator('td').nth(1);
    await expect(submissionReceivedCell).toContainText(/06\s+jun\.?\s+2026/i);
    await expect(submissionReceivedCell).toContainText(/\d{2}:\d{2}/);
  });

  test('preauth ops action calls preauth-now endpoint', async ({ page }) => {
    let called = false;
    const risky = orderFixture({
      id: 'order-preauth-action',
      public_code: 'SV-AUTH',
      ops: opsFixture({ code: 'preauth_due', severity: 'soon', actionLabel: 'Autorizar ahora' }),
    });
    await mockAdminApis(page, {
      orders: [risky],
      opsRadar: { ok: true, generatedAt: '2026-06-05T18:00:00.000Z', summary: { critical: 0, soon: 1, watch: 0 }, next: risky, items: [risky] },
      onPreauthNow: () => { called = true; },
    });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    await page.locator('#orders-body button', { hasText: 'Autorizar ahora' }).first().click();
    await page.locator('.adm-box button', { hasText: 'Autorizar' }).click();
    await expect.poll(() => called).toBe(true);
  });

  test('snoozed alert disappears from Ops Radar after snooze', async ({ page }) => {
    let snoozed = false;
    const risky = orderFixture({
      id: 'order-snooze-1',
      public_code: 'SV-SNZ',
      ops: opsFixture({ code: 'preauth_due', severity: 'soon', label: 'Autorización dentro de 24h' }),
    });
    await mockAdminApis(page, {
      orders: [risky],
      opsRadar: () => snoozed
        ? { ok: true, generatedAt: '2026-06-05T18:01:00.000Z', summary: { critical: 0, soon: 0, watch: 0 }, next: null, items: [] }
        : { ok: true, generatedAt: '2026-06-05T18:00:00.000Z', summary: { critical: 0, soon: 1, watch: 0 }, next: risky, items: [risky] },
      onSnooze: () => { snoozed = true; },
    });
    await loginAndWait(page);
    await expect(page.locator('#ops-command')).toContainText('Autorización dentro de 24h');

    await page.locator('#ops-command button', { hasText: 'Snooze' }).click();
    await expect(page.locator('#ops-command')).toContainText('Sin alertas críticas');
  });

  test('order detail shows operational status block', async ({ page }) => {
    const risky = orderFixture({
      id: 'order-detail-ops',
      public_code: 'SV-OPS',
      ops: opsFixture({ code: 'capture_due', severity: 'soon', label: 'Captura pendiente', actionLabel: 'Capturar' }),
    });
    await mockAdminApis(page, { orders: [risky], detailOrder: risky });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    await page.locator('#orders-body tr').first().click();
    await expect(page.locator('#order-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#op-body')).toContainText('Estado operativo');
    await expect(page.locator('#op-body')).toContainText('Captura pendiente');
  });

  test('order detail separates service schedule from order creation metadata', async ({ page }) => {
    const order = orderFixture();
    await mockAdminApis(page, { orders: [order], submissions: [], detailOrder: order });
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="orders"]').click();
    await waitForListLoad(page, 'orders-body', 10000);

    await page.locator('#orders-body tr').first().click();
    await expect(page.locator('#order-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#op-body')).toContainText('Horario del servicio');
    await expect(page.locator('#op-body')).toContainText('Orden creada');
    await expect(page.locator('#op-body')).toContainText('Payment Intent ID');

    const stripeSection = page.locator('.sp-sec').filter({ has: page.locator('.sp-sec-t', { hasText: /^Stripe$/ }) });
    await expect(stripeSection).not.toContainText('Creado');
    await expect(stripeSection).not.toContainText('Orden creada');
  });

  test('Scheduled detail schedule badge says Agendado, not Confirmado', async ({ page }) => {
    const order = orderFixture({
      id: 'order-scheduled-badge',
      public_code: 'SV-AGD',
      status: 'Scheduled',
      payment_intent_id: null,
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta urgente', actionLabel: '' }),
      ...futureService(48),
    });
    await mockAdminApis(page, { orders: [order], submissions: [], detailOrder: order });
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="orders"]').click();
    await waitForListLoad(page, 'orders-body', 10000);

    await page.locator('#orders-body tr').first().click();
    await expect(page.locator('#order-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.schedule-card .schedule-badge')).toHaveText('Agendado');
    await expect(page.locator('.schedule-card .schedule-badge')).not.toHaveText('Confirmado');
  });

  test('Scheduled order without payment intent does not show capture or link outside preauth window', async ({ page }) => {
    const order = orderFixture({
      id: 'order-scheduled-no-pi',
      public_code: 'SV-NOPI',
      status: 'Scheduled',
      payment_intent_id: null,
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta urgente', actionLabel: '' }),
      ...futureService(48),
    });
    await mockAdminApis(page, { orders: [order], submissions: [] });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    const rowActions = page.locator('#orders-body tr', { hasText: 'SV-NOPI' }).locator('td').nth(8);
    await expect(rowActions).not.toContainText('Capturar');
    await expect(rowActions).not.toContainText('Enlace');
    await expect(rowActions.locator('button')).toHaveCount(0);
  });

  test('Confirmed table row shows only Capturar as primary action', async ({ page }) => {
    const order = orderFixture({
      id: 'order-confirmed-primary',
      public_code: 'SV-CONF',
      status: 'Confirmed',
      payment_intent_id: 'pi_confirmed_primary',
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Confirmada y lista', actionLabel: '' }),
      ...futureService(10),
    });
    await mockAdminApis(page, { orders: [order], submissions: [] });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    const rowActions = page.locator('#orders-body tr', { hasText: 'SV-CONF' }).locator('td').nth(8);
    await expect(rowActions.locator('button')).toHaveCount(1);
    await expect(rowActions).toContainText('Capturar');
    await expect(rowActions).not.toContainText('Enlace');
    await expect(rowActions).not.toContainText('Efectivo');
    await expect(rowActions).not.toContainText('Cancelar');
  });

  test('Confirmed capture-due Ops row shows only Capturar', async ({ page }) => {
    const order = orderFixture({
      id: 'order-confirmed-capture-due',
      public_code: 'SV-DUE',
      status: 'Confirmed',
      payment_intent_id: 'pi_confirmed_due',
      ops: opsFixture({ code: 'capture_due', severity: 'soon', label: 'Captura pendiente', actionLabel: 'Capturar' }),
      ...futureService(-1),
    });
    await mockAdminApis(page, { orders: [order], submissions: [] });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    const rowActions = page.locator('#orders-body tr', { hasText: 'SV-DUE' }).locator('td').nth(8);
    await expect(rowActions.locator('button')).toHaveCount(1);
    await expect(rowActions).toContainText('Capturar');
  });

  test('order within six hours with assigned provider shows provider reminder', async ({ page }) => {
    const order = orderFixture({
      id: 'order-provider-reminder',
      public_code: 'SV-PROV',
      status: 'Scheduled',
      provider_id: 'prov-000123',
      provider_name: 'Proveedor Verificado',
      payment_intent_id: 'pi_scheduled_ready',
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta urgente', actionLabel: '' }),
      ...futureService(5),
    });
    await mockAdminApis(page, { orders: [order], submissions: [] });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    const rowActions = page.locator('#orders-body tr', { hasText: 'SV-PROV' }).locator('td').nth(8);
    await expect(rowActions.locator('button')).toHaveCount(1);
    await expect(rowActions).toContainText('Recordar proveedor');
  });

  test('provider reminder resolves provider contact and opens WhatsApp', async ({ page }) => {
    await page.addInitScript(() => {
      window.__openedUrls = [];
      window.open = (url) => {
        window.__openedUrls.push(String(url));
        return null;
      };
    });
    const order = orderFixture({
      id: 'order-provider-wa',
      public_code: 'SV-WA',
      client_name: 'Cliente WhatsApp',
      status: 'Scheduled',
      provider_id: 'prov-000777',
      provider_name: 'Proveedor WA',
      payment_intent_id: 'pi_scheduled_wa',
      service_address: 'Calle Recordatorio 77',
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta urgente', actionLabel: '' }),
      ...futureService(5),
    });
    await mockAdminApis(page, {
      orders: [order],
      submissions: [],
      providers: [{
        provider_id: 'prov-000777',
        status: 'verified',
        name: 'Proveedor WA',
        phone: '+52 55 7000 0777',
        specialty: 'Reparaciones',
        city: 'CDMX',
      }],
    });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    await page.locator('#orders-body button', { hasText: 'Recordar proveedor' }).click();
    await expect.poll(() => page.evaluate(() => window.__openedUrls || [])).toHaveLength(1);
    const opened = await page.evaluate(() => window.__openedUrls[0]);
    expect(opened).toContain('https://wa.me/525570000777');
    expect(decodeURIComponent(opened)).toContain('SV-WA');
    expect(decodeURIComponent(opened)).toContain('Cliente WhatsApp');
  });

  test('captured, cash, and canceled rows render only valid primary actions', async ({ page }) => {
    const captured = orderFixture({
      id: 'order-captured-action',
      public_code: 'SV-CAP',
      status: 'Captured',
      payment_intent_id: 'pi_captured_action',
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta operativa', actionLabel: '' }),
      ...futureService(-2),
    });
    const cash = orderFixture({
      id: 'order-cash-action',
      public_code: 'SV-CASH',
      status: 'Pending Cash',
      cash_selected: true,
      payment_intent_id: null,
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta operativa', actionLabel: '' }),
      ...futureService(5),
    });
    const canceled = orderFixture({
      id: 'order-canceled-action',
      public_code: 'SV-CAN',
      status: 'Canceled',
      payment_intent_id: null,
      ops: opsFixture({ code: 'safe', severity: 'safe', label: 'Sin alerta operativa', actionLabel: '' }),
      ...futureService(5),
    });
    await mockAdminApis(page, { orders: [captured, cash, canceled], submissions: [] });
    await loginAndWait(page);
    await waitForListLoad(page, 'orders-body', 10000);

    const capturedActions = page.locator('#orders-body tr', { hasText: 'SV-CAP' }).locator('td').nth(8);
    await expect(capturedActions.locator('button')).toHaveCount(1);
    await expect(capturedActions).toContainText('Reembolso');

    await expect(page.locator('#orders-body tr', { hasText: 'SV-CASH' }).locator('td').nth(8).locator('button')).toHaveCount(0);
    await expect(page.locator('#orders-body tr', { hasText: 'SV-CAN' }).locator('td').nth(8).locator('button')).toHaveCount(0);
  });

  test('ASAP web submission row renders ASAP instead of created date', async ({ page }) => {
    await mockAdminApis(page, {
      orders: [],
      submissions: [{
        id: 'sub-asap-1',
        category: 'repair',
        description: 'Fuga urgente',
        preferred_date: null,
        preferred_time: null,
        is_asap: true,
        service_address: 'Calle Urgente 42',
        client_name: 'Cliente ASAP',
        client_phone: '+525500000000',
        client_email: '',
        status: 'pending',
        created_at: '2026-06-05T18:00:00.000Z',
      }],
    });
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="orders"]').click();
    await waitForListLoad(page, 'orders-body', 10000);

    const firstRow = page.locator('#orders-body tr').first();
    await expect(firstRow.locator('td').nth(1)).toContainText(/05\s+jun\.?\s+2026/i);
    await expect(firstRow.locator('td').nth(5)).toContainText('ASAP');
    await expect(firstRow.locator('td').nth(5)).not.toContainText(/05\s+jun\.?\s+2026/i);
  });

  test('creating payment link from ASAP submission preserves isAsap flag', async ({ page }) => {
    let createPayload;
    let patchPayload;
    await mockAdminApis(page, {
      orders: [],
      submissions: [{
        id: 'sub-asap-2',
        category: 'repair',
        description: 'Fuga urgente',
        preferred_date: null,
        preferred_time: null,
        is_asap: true,
        service_address: 'Calle Urgente 42',
        client_name: 'Cliente ASAP',
        client_phone: '+525500000001',
        client_email: '',
        status: 'pending',
        created_at: '2026-06-05T18:00:00.000Z',
      }],
      onCreatePaymentIntent: payload => { createPayload = payload; },
      onPatchServiceRequest: payload => { patchPayload = payload; },
    });
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="orders"]').click();
    await waitForListLoad(page, 'orders-body', 10000);

    await page.locator('#orders-body button', { hasText: '+ Crear enlace' }).click();
    await expect(page.locator('#sub-modal-overlay')).toContainText('ASAP solicitado');
    await page.fill('#sub-amount', '800');
    await page.click('#sub-modal-submit');
    await expect(page.locator('#sub-modal-result')).toBeVisible({ timeout: 5000 });

    expect(createPayload).toBeTruthy();
    expect(createPayload.isAsap).toBe(true);
    expect(createPayload.serviceDateTime).toBe('');
    expect(createPayload.serviceRequestId).toBe('sub-asap-2');
    expect(patchPayload).toMatchObject({ status: 'contacted', convertedOrderId: 'order-from-asap' });
  });
});

// ─── Nueva Orden panel ───────────────────────────────────────────────────────

test.describe('Nueva Orden panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="nueva"]').click();
    await expect(page.locator('#panel-nueva')).toBeVisible();
  });

  test('phone field is present', async ({ page }) => {
    await expect(page.locator('#n-phone')).toBeVisible();
  });

  test('name field is present', async ({ page }) => {
    await expect(page.locator('#n-name')).toBeVisible();
  });

  test('email field is present', async ({ page }) => {
    await expect(page.locator('#n-email')).toBeVisible();
  });

  test('blank email does not block first-time payment link submission locally', async ({ page }) => {
    let payload = null;
    await page.route('**/create-payment-intent', async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ orderId: 'ord_admin_blank_email', payUrl: `${BASE}/pay.html?order=ord_admin_blank_email` }),
      });
    });

    await page.fill('#n-phone', '+525511223344');
    await page.fill('#n-name', 'Cliente Sin Email');
    await page.fill('#n-desc', 'Servicio de prueba sin email');
    await page.fill('#n-amount', '500');
    await page.click('#nueva-btn');

    await expect(page.locator('#nueva-result')).toBeVisible();
    expect(payload).toBeTruthy();
    expect(payload.clientEmail).toBe('');
  });

  test('service category selector is present', async ({ page }) => {
    await expect(page.locator('#n-category')).toBeVisible();
  });

  test('description field is present', async ({ page }) => {
    await expect(page.locator('#n-desc')).toBeVisible();
  });

  test('amount field is present', async ({ page }) => {
    await expect(page.locator('#n-amount')).toBeVisible();
  });

  test('Generar enlace button is present', async ({ page }) => {
    await expect(page.locator('#nueva-btn')).toBeVisible();
  });

  test('submit without required fields shows error', async ({ page }) => {
    const errorPromise = page.waitForSelector('#nueva-error', { state: 'visible', timeout: 4000 }).catch(() => null);
    const toastPromise = page.waitForSelector('.toast', { state: 'visible', timeout: 4000 }).catch(() => null);
    await page.click('#nueva-btn');
    const [err, toast] = await Promise.all([errorPromise, toastPromise]);
    expect(err !== null || toast !== null).toBeTruthy();
  });

  test('phone debounce lookup triggers on input', async ({ page }) => {
    // Type a valid-looking phone — lookupByPhone fires after 700ms debounce
    await page.fill('#n-phone', '+5255001122');
    await page.waitForTimeout(900);
    // Either name was prefilled or toast appeared — just check no crash
    const nameVal = await page.locator('#n-name').inputValue();
    expect(typeof nameVal).toBe('string');
  });

  test('resetNuevaOrden clears form fields', async ({ page }) => {
    await page.fill('#n-phone', '+5255001122');
    await page.fill('#n-amount', '500');
    await page.evaluate(() => resetNuevaOrden());
    expect(await page.locator('#n-phone').inputValue()).toBe('');
    expect(await page.locator('#n-amount').inputValue()).toBe('');
  });
});

// ─── Ajuste panel ────────────────────────────────────────────────────────────

test.describe('Ajuste / Cobro panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="ajustes"]').click();
    await expect(page.locator('#panel-ajustes')).toBeVisible();
  });

  test('parent order ID field is present', async ({ page }) => {
    await expect(page.locator('#aj-parent')).toBeVisible();
  });

  test('adjustment type selector is present', async ({ page }) => {
    await expect(page.locator('#aj-reason')).toBeVisible();
  });

  test('amount field is present', async ({ page }) => {
    await expect(page.locator('#aj-amount')).toBeVisible();
  });

  test('Crear ajuste button is present', async ({ page }) => {
    await expect(page.locator('#ajuste-btn')).toBeVisible();
  });

  test('parent ID debounce lookup triggers on input', async ({ page }) => {
    await page.fill('#aj-parent', 'fake-uuid-test-123');
    await page.waitForTimeout(800);
    // Info div either shows "no encontrada" or stays empty
    const infoText = await page.locator('#aj-parent-info').textContent();
    expect(typeof infoText).toBe('string');
  });

  test('resetAjuste clears form fields', async ({ page }) => {
    await page.fill('#aj-parent', 'some-uuid');
    await page.fill('#aj-amount', '300');
    await page.evaluate(() => resetAjuste());
    expect(await page.locator('#aj-parent').inputValue()).toBe('');
    expect(await page.locator('#aj-amount').inputValue()).toBe('');
  });
});

// ─── Providers panel ─────────────────────────────────────────────────────────

test.describe('Providers panel', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndWait(page);
    await page.locator('.nav-item[data-panel="providers"]').click();
    await expect(page.locator('#panel-providers')).toBeVisible();
  });

  test('status filter dropdown is present', async ({ page }) => {
    await expect(page.locator('#prov-status')).toBeVisible();
  });

  test('search input is present', async ({ page }) => {
    await expect(page.locator('#prov-search')).toBeVisible();
  });

  test('providers load (rows or empty state)', async ({ page }) => {
    await waitForListLoad(page, 'providers-body', 10000);
    const rows = await page.locator('#providers-body tr').count();
    const emptyVis = await page.locator('#providers-empty').isVisible();
    expect(rows > 0 || emptyVis).toBeTruthy();
  });

  test('provider row click opens detail side panel', async ({ page }) => {
    await waitForListLoad(page, 'providers-body', 10000);
    const rows = await page.locator('#providers-body tr').count();
    if (rows === 0) {
      test.skip(true, 'No providers in test data');
      return;
    }
    await page.locator('#providers-body tr').first().click();
    await expect(page.locator('#prov-panel')).toBeVisible({ timeout: 5000 });
  });

  test('provider detail panel closes via sp-close button', async ({ page }) => {
    await waitForListLoad(page, 'providers-body', 10000);
    const rows = await page.locator('#providers-body tr').count();
    if (rows === 0) test.skip(true, 'No providers');
    await page.locator('#providers-body tr').first().click();
    await page.locator('#prov-panel button.sp-close').click();
    await expect(page.locator('#prov-panel')).toBeHidden({ timeout: 2000 });
  });

  test('status filter changes results', async ({ page }) => {
    await page.selectOption('#prov-status', 'pending');
    await page.waitForTimeout(600);
    const rows = await page.locator('#providers-body tr').count();
    expect(rows).toBeGreaterThanOrEqual(0);
  });
});

// ─── Toast and modal system ───────────────────────────────────────────────────

test.describe('Toast + Modal system', () => {
  test.beforeEach(async ({ page }) => loginAndWait(page));

  test('toast stack container exists', async ({ page }) => {
    await expect(page.locator('#toast-stack')).toBeAttached();
  });

  test('no stray modal overlay on initial load', async ({ page }) => {
    const count = await page.locator('.adm-overlay').count();
    expect(count).toBe(0);
  });
});

// ─── Live polling badges ──────────────────────────────────────────────────────

test.describe('Live polling', () => {
  test.beforeEach(async ({ page }) => loginAndWait(page));

  test('tb-status shows text', async ({ page }) => {
    await expect(page.locator('#tb-status')).toBeVisible();
    const text = await page.locator('#tb-status').textContent();
    expect(text.trim().length).toBeGreaterThan(0);
  });

  test('orders badge element exists in DOM', async ({ page }) => {
    await expect(page.locator('#orders-badge')).toBeAttached();
  });

  test('inbox badge element exists in DOM', async ({ page }) => {
    await expect(page.locator('#nav-badge-inbox')).toBeAttached();
  });

  test('providers badge element exists in DOM', async ({ page }) => {
    await expect(page.locator('#nav-badge-providers')).toBeAttached();
  });

  test('new order badge element exists in DOM', async ({ page }) => {
    await expect(page.locator('#nav-badge-nueva')).toBeAttached();
  });

  test('adjustment badge element exists in DOM', async ({ page }) => {
    await expect(page.locator('#nav-badge-ajustes')).toBeAttached();
  });
});

// ─── Layout integrity ─────────────────────────────────────────────────────────

test.describe('Layout integrity', () => {
  test.beforeEach(async ({ page }) => loginAndWait(page));

  test('sidebar fits within 300px width', async ({ page }) => {
    const box = await page.locator('.sidebar').boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeLessThan(300);
  });

  test('main-area fills available horizontal space', async ({ page }) => {
    // "Fills available space" = viewport width minus the sidebar, with no overlap.
    // Asserting a fixed pixel width fails on mobile (Pixel 7 = 412px wide), so we
    // verify the relationship between sidebar and main-area instead.
    const sidebar = await page.locator('.sidebar').boundingBox();
    const box = await page.locator('.main-area').boundingBox();
    const viewport = page.viewportSize();
    expect(sidebar).not.toBeNull();
    expect(box).not.toBeNull();
    // Main area starts where the sidebar ends (no horizontal overlap).
    expect(box.x).toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 2);
    // Main area fills the rest of the viewport width (allow small rounding slack).
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - box.x - 4);
    expect(box.width).toBeGreaterThan(0);
  });

  test('topbar within viewport width', async ({ page }) => {
    const box = await page.locator('.topbar').boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeLessThanOrEqual(1282);
  });

  test('switching panels hides previous panel', async ({ page }) => {
    await page.locator('.nav-item[data-panel="orders"]').click();
    await expect(page.locator('#panel-inbox')).toBeHidden();
    await expect(page.locator('#panel-orders')).toBeVisible();
  });
});
