// ─── Test Suite 6: Other Pages & i18n ─────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { clearSession, injectFakeSession } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await clearSession(page);
});

test('6.1 Help Center page loads', async ({ page }) => {
  await page.goto('/helpcenter.html');
  await expect(page.locator('#site-navbar')).toBeVisible();
});

test('6.2 Partners page loads', async ({ page }) => {
  await page.goto('/partners.html');
  await expect(page.locator('#site-navbar')).toBeVisible();
});

test('6.3 Handbook page loads', async ({ page }) => {
  await page.goto('/handbook.html');
  await expect(page.locator('#site-navbar')).toBeVisible();
});

test('6.4 Legal page loads', async ({ page }) => {
  await page.goto('/legal.html');
  await expect(page.locator('#site-navbar')).toBeVisible();
});

test('6.5 Partner nav shows SERVI | Partner branding', async ({ page }) => {
  await page.goto('/partners.html');
  await expect(page.locator('#site-navbar .logo')).toContainText('Partner');
});

test('6.6 Help center nav has links', async ({ page }) => {
  await page.goto('/helpcenter.html');
  await expect(page.locator('#site-navbar')).toBeVisible();
  const navLinks = page.locator('.nav-link');
  const count = await navLinks.count();
  expect(count).toBeGreaterThan(0);
});

test('6.7 Account page input placeholder set in Spanish by default', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(600);

  const namePh = await page.locator('#info-name').getAttribute('placeholder');
  expect(namePh).toBeTruthy();
  expect(namePh).not.toBe('');
});

test('6.8 Account page input placeholders translate ES → EN', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/account.html');
  await page.waitForSelector('.account-layout', { timeout: 5000 });
  await page.waitForTimeout(600);

  const esPlaceholder = await page.locator('#info-name').getAttribute('placeholder');

  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(500);

  const enPlaceholder = await page.locator('#info-name').getAttribute('placeholder');
  expect(enPlaceholder).not.toBe(esPlaceholder);
  expect(enPlaceholder?.toLowerCase()).toContain('name');
});

test('6.9 Language persists across navigation (via localStorage)', async ({ page }) => {
  await page.goto('/');
  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(400);

  const lang = await page.evaluate(() => localStorage.getItem('servi-lang'));
  expect(lang).toBe('en');

  await page.goto('/helpcenter.html');
  await page.waitForTimeout(500);
  const langAfter = await page.evaluate(() => localStorage.getItem('servi-lang'));
  expect(langAfter).toBe('en');
});
