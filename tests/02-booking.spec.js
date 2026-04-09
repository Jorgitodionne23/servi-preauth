// ─── Test Suite 2: Booking Flow ───────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { clearSession, injectFakeSession } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await clearSession(page);
});

test('2.1 Booking panel opens from hero CTA', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });
  await expect(page.locator('.booking-panel')).toBeVisible();
});

test('2.2 Step 1: Description textarea and category accordion visible', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });
  // Description is the primary UI on step 1
  await expect(page.locator('#booking-desc')).toBeVisible();
  // Category accordion toggle button visible
  const accordion = page.locator('.booking-panel button', { hasText: /categor/i });
  await expect(accordion).toBeVisible();
});

test('2.2b Expanding category accordion shows 6 categories', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  // Expand the category accordion
  const accordion = page.locator('.booking-panel button', { hasText: /categor/i });
  await accordion.click();
  await page.waitForTimeout(300);

  const cats = page.locator('.booking-cat');
  await expect(cats).toHaveCount(6);
});

test('2.3 Step 1: Can navigate to step 2 with description', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  await page.locator('#booking-desc').fill('Necesito un plomero para arreglar una fuga en el baño');
  // Continue button
  await page.locator('.booking-panel button', { hasText: /Continuar|Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 2: scheduling options
  await expect(page.locator('.radio-option').first()).toBeVisible();
});

test('2.4 Step 1: Empty description shows validation alert', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  let dialogAppeared = false;
  page.once('dialog', async dialog => {
    dialogAppeared = true;
    await dialog.dismiss();
  });
  await page.locator('.booking-panel button', { hasText: /Continuar|Continue/i }).click();
  await page.waitForTimeout(1000);

  expect(dialogAppeared).toBeTruthy();
  // Panel still visible (still on step 1)
  await expect(page.locator('#booking-desc')).toBeVisible();
});

test('2.5 Step 3 requires login (unauthenticated)', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  // Step 1: add description and continue
  await page.locator('#booking-desc').fill('Necesito limpieza de casa');
  await page.locator('.booking-panel button', { hasText: /Continuar|Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 2: continue (button says "¿Dónde?" / "Where?")
  await page.locator('.booking-panel .btn-primary').click();
  await page.waitForTimeout(1000);

  // Auth modal OR booking shows login prompt
  const hasModal = await page.locator('#auth-modal-global .modal-overlay').isVisible().catch(() => false);
  const panelText = await page.locator('.booking-panel').textContent().catch(() => '');
  const authRequired = hasModal || panelText.includes('sesión') || panelText.includes('sign in') || panelText.includes('login') || panelText.includes('Inicia');

  expect(authRequired).toBeTruthy();
});

test('2.6 Step 3 shows address input when logged in', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/');
  await page.waitForTimeout(800);

  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  // Step 1
  await page.locator('#booking-desc').fill('Test booking with auth');
  await page.locator('.booking-panel button', { hasText: /Continuar|Continue/i }).click();
  await page.waitForTimeout(500);

  // Step 2: continue (button says "¿Dónde?" / "Where?")
  await page.locator('.booking-panel .btn-primary').click();
  await page.waitForTimeout(1000);

  // Should NOT show auth modal
  const hasModal = await page.locator('#auth-modal-global .modal-overlay').isVisible().catch(() => false);
  expect(hasModal).toBeFalsy();

  // Address input visible
  await expect(page.locator('#booking-address')).toBeVisible();
});

test('2.7 Booking can be closed', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  const closeBtn = page.locator('.booking-panel button').first();
  await closeBtn.click();
  await page.waitForTimeout(500);

  const panelVisible = await page.locator('.booking-panel').isVisible().catch(() => false);
  expect(panelVisible).toBeFalsy();
});

test('2.8 Back button on step 2 goes to step 1', async ({ page }) => {
  await page.goto('/');
  await page.locator('.btn-primary--lg').first().click();
  await page.waitForSelector('.booking-panel', { timeout: 8000 });

  await page.locator('#booking-desc').fill('Test back navigation');
  await page.locator('.booking-panel button', { hasText: /Continuar|Continue/i }).click();
  await page.waitForTimeout(500);

  // Back button on step 2
  const backBtn = page.locator('.booking-panel button', { hasText: /volver|back/i });
  await expect(backBtn).toBeVisible();
  await backBtn.click();
  await page.waitForTimeout(300);

  // Back on step 1: description textarea visible again
  await expect(page.locator('#booking-desc')).toBeVisible();
});
