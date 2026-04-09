// ─── Test Suite 1: Landing Page ───────────────────────────────────────────────
import { test, expect } from '@playwright/test';
import { clearSession } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await clearSession(page);
});

test('1.1 Landing page loads with hero CTA', async ({ page }) => {
  await page.goto('/');
  // Navbar
  await expect(page.locator('#site-navbar')).toBeVisible();
  await expect(page.locator('#site-navbar .logo')).toContainText('SERVI');
  // Hero CTA button
  const cta = page.locator('.btn-primary--lg').first();
  await expect(cta).toBeVisible();
});

test('1.2 Service category cards are visible', async ({ page }) => {
  await page.goto('/');
  // Wait for categories section
  await page.waitForSelector('#services', { timeout: 10000 });
  const cards = page.locator('.card--clickable');
  await expect(cards).toHaveCount(6);
});

test('1.3 No email/password option in auth modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: /Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-modal-global .modal-overlay', { timeout: 5000 });
  // Should have Google button
  await expect(page.locator('#google-auth-btn')).toBeVisible();
  // Should NOT have email input
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  // Should have phone input
  await expect(page.locator('#auth-phone-number')).toBeVisible();
  // Should NOT have password input
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('1.4 Auth modal closes on overlay click', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: /Iniciar sesión|Log in/i }).first().click();
  await page.waitForSelector('#auth-modal-global .modal-overlay', { timeout: 5000 });
  await expect(page.locator('#auth-phone-number')).toBeVisible();
  // Click the overlay (outside the modal content)
  await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#auth-phone-number')).not.toBeVisible();
});

test('1.5 Language toggle switches ES→EN on landing', async ({ page }) => {
  await page.goto('/');
  // Default is Spanish
  const hero = page.locator('h1, .heading-xl').first();
  const spanishText = await hero.textContent();

  // Click EN
  await page.locator('.lang-btn', { hasText: 'EN' }).click();
  await page.waitForTimeout(500);
  const englishText = await hero.textContent();

  expect(spanishText).not.toBe(englishText);
  // Switch back
  await page.locator('.lang-btn', { hasText: 'ES' }).click();
  await page.waitForTimeout(500);
  const backToSpanish = await hero.textContent();
  expect(backToSpanish).toBe(spanishText);
});

test('1.6 Mobile hamburger menu opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const hamburger = page.locator('.hamburger');
  await expect(hamburger).toBeVisible();
  await hamburger.click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  // Close button
  await page.locator('#mobile-menu button').first().click();
  await expect(page.locator('#mobile-menu')).not.toBeVisible();
});

test('1.7 Footer is present with key links', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = page.locator('#footer, footer, .footer');
  await expect(footer.first()).toBeVisible();
});
