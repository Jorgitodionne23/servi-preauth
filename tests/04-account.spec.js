// ─── Test Suite 4: Account Page ───────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { clearSession, injectFakeSession } from './helpers.js';

test('4.1 Account page redirects unauthenticated user to home', async ({ page }) => {
  await clearSession(page);
  await page.goto('/account.html');
  await page.waitForURL(/\/(index\.html)?$/, { timeout: 6000 });
  expect(page.url()).toMatch(/\/(index\.html)?$/);
});

test('4.2 Account page loads for authenticated user', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);
  await expect(page.locator('.account-layout')).toBeVisible();
  await expect(page.locator('#section-info')).toBeVisible();
});

test('4.3 Account page sidebar has all 5 nav items', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('#sidebar', { timeout: 5000 });
  await page.waitForTimeout(800);
  const navItems = page.locator('.account-sidebar-item');
  await expect(navItems).toHaveCount(5);
});

test('4.4 Account page sidebar navigation switches sections', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-sidebar-item', { timeout: 5000 });
  await page.waitForTimeout(800);

  await page.locator('.account-sidebar-item').nth(2).click();
  await page.waitForTimeout(300);
  await expect(page.locator('#section-addresses')).toHaveClass(/active/);
  await expect(page.locator('#section-info')).not.toHaveClass(/active/);

  await page.locator('.account-sidebar-item').first().click();
  await page.waitForTimeout(300);
  await expect(page.locator('#section-info')).toHaveClass(/active/);
});

test('4.5 Language toggle translates account page (ES → EN)', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  const titleEl = page.locator('#title-info');
  const spanishTitle = await titleEl.textContent();
  expect(spanishTitle?.trim()).toBeTruthy();

  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(500);

  const englishTitle = await titleEl.textContent();
  expect(englishTitle?.trim()).not.toBe(spanishTitle?.trim());
  expect(englishTitle?.toLowerCase()).toContain('personal');

  const firstNavItem = await page.locator('.account-sidebar-item').first().textContent();
  expect(firstNavItem?.toLowerCase()).toContain('personal');
});

test('4.6 Language toggle translates delete section', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  await page.locator('.account-sidebar-item').last().click();
  await page.waitForTimeout(300);

  const deleteBtn = page.locator('#delete-btn');
  const spanishDeleteText = await deleteBtn.textContent();
  expect(spanishDeleteText?.trim()).toBeTruthy();

  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(500);

  const englishDeleteText = await deleteBtn.textContent();
  expect(englishDeleteText?.trim()).not.toBe(spanishDeleteText?.trim());
  expect(englishDeleteText?.toLowerCase()).toContain('delete');
});

test('4.7 Delete account: modal opens with correct content', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  await page.locator('.account-sidebar-item').last().click();
  await page.waitForTimeout(300);
  await page.locator('#delete-btn').click();

  await expect(page.locator('.confirm-overlay')).toBeVisible();
  await expect(page.locator('.confirm-box h3')).toBeVisible();
  await expect(page.locator('#delete-confirm-input')).toBeVisible();
  await expect(page.locator('.confirm-ok')).toBeVisible();
  await expect(page.locator('.confirm-cancel')).toBeVisible();
});

test('4.8 Delete account: wrong text → input turns red, modal stays open', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  await page.locator('.account-sidebar-item').last().click();
  await page.waitForTimeout(300);
  await page.locator('#delete-btn').click();
  await page.waitForSelector('.confirm-overlay');

  await page.locator('#delete-confirm-input').fill('WRONG');
  await page.locator('.confirm-ok').click();
  await page.waitForTimeout(500);

  await expect(page.locator('.confirm-overlay')).toBeVisible();
  const borderColor = await page.locator('#delete-confirm-input').evaluate(
    el => getComputedStyle(el).borderColor
  );
  expect(borderColor).toContain('220');
});

test('4.9 Delete account: cancel button closes modal', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  await page.locator('.account-sidebar-item').last().click();
  await page.waitForTimeout(300);
  await page.locator('#delete-btn').click();
  await page.waitForSelector('.confirm-overlay');

  await page.locator('.confirm-cancel').click();
  await page.waitForTimeout(300);
  await expect(page.locator('.confirm-overlay')).not.toBeVisible();
});

test('4.10 Delete account modal translates to EN', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(400);

  await page.locator('.account-sidebar-item').last().click();
  await page.waitForTimeout(300);
  await page.locator('#delete-btn').click();
  await page.waitForSelector('.confirm-overlay');

  const bodyText = await page.locator('.confirm-box p').textContent();
  expect(bodyText?.toLowerCase()).toContain('delete');

  const confirmBtnText = await page.locator('.confirm-ok').textContent();
  expect(confirmBtnText?.toLowerCase()).toContain('confirm');

  const placeholder = await page.locator('#delete-confirm-input').getAttribute('placeholder');
  expect(placeholder).toBe('DELETE');
});

test('4.11 Add address: form validation - street required', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  await page.locator('.account-sidebar-item').nth(2).click();
  await page.waitForTimeout(300);

  await page.locator('#add-addr-btn').click();
  await page.waitForTimeout(300);
  await page.locator('#addr-save-btn').click();
  await page.waitForTimeout(500);

  const errorEl = page.locator('#addr-error');
  await expect(errorEl).toBeVisible();
  const errorText = await errorEl.textContent();
  expect(errorText?.trim()).toBeTruthy();
});

test('4.12 Mobile: account page shows tab bar, not sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  const sidebarVisible = await page.locator('.account-sidebar').isVisible();
  expect(sidebarVisible).toBeFalsy();

  await expect(page.locator('#mobile-tabs')).toBeVisible();
  const tabs = page.locator('.mobile-tab');
  await expect(tabs).toHaveCount(5);
});

test('4.13 Account page input placeholder translates (ES → EN)', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(500);

  const esPlaceholder = await page.locator('#info-name').getAttribute('placeholder');

  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(500);

  const enPlaceholder = await page.locator('#info-name').getAttribute('placeholder');
  expect(enPlaceholder).not.toBe(esPlaceholder);
  expect(enPlaceholder?.toLowerCase()).toContain('name');
});

test('4.14 account.html Security section has no change-password form', async ({ page }) => {
  // Fetch account.html source and verify Security section exists but has no password inputs
  const response = await page.request.get('/account.html');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();

  // No password inputs anywhere on this page (Firebase-only auth)
  expect(html).not.toContain('type="password"');

  // Security section exists and describes Firebase-only auth
  expect(html).toContain('id="section-security"');
  const lowerHtml = html.toLowerCase();
  const hasFirebaseAuthMention = lowerHtml.includes('teléfono') || lowerHtml.includes('google') || lowerHtml.includes('phone');
  expect(hasFirebaseAuthMention).toBeTruthy();
});
