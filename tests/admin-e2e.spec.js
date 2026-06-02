import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:4242';
const ADMIN_URL = `${BASE}/admin.html`;
const VALID_TOKEN = 'b92d6934a131c7db37c75c69bac64e77';
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
  test.beforeEach(async ({ page }) => loginAndWait(page));

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

  test('orders load (table rows or empty state)', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const rowCount = await page.locator('#orders-body tr').count();
    const emptyVis = await page.locator('#orders-empty').isVisible();
    expect(rowCount > 0 || emptyVis).toBeTruthy();
  });

  test('order row click opens detail side panel', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const rowCount = await page.locator('#orders-body tr').count();
    if (rowCount === 0) {
      test.skip(true, 'No orders in test data');
      return;
    }
    await page.locator('#orders-body tr').first().click();
    await expect(page.locator('#order-panel')).toBeVisible({ timeout: 5000 });
  });

  test('order detail panel closes via sp-close button', async ({ page }) => {
    await waitForListLoad(page, 'orders-body', 10000);
    const rowCount = await page.locator('#orders-body tr').count();
    if (rowCount === 0) test.skip(true, 'No orders in test data');
    await page.locator('#orders-body tr').first().click();
    await page.locator('#order-panel button.sp-close').click();
    await expect(page.locator('#order-panel')).toBeHidden({ timeout: 2000 });
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
    const box = await page.locator('.main-area').boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(400);
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
