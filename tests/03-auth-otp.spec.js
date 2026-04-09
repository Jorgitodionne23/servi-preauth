// ─── Test Suite 3: Phone OTP Authentication (Manual-Only) ─────────────────────
// These tests require real Firebase phone auth (SMS delivery).
// They cannot be automated without a real Firebase test phone number configured
// in the Firebase Console with appVerificationDisabledForTesting.
//
// USL flow: user enters phone on identifier screen → backend check-identifier →
// if new: signup branch; if existing: OTP screen directly.
//
// Run manually with: TEST_PHONE=+525512025121 TEST_OTP=232323
import { test, expect } from '@playwright/test';
import { TEST_PHONE, TEST_OTP, clearSession, firebaseTestModeScript } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await clearSession(page);
  await page.addInitScript(firebaseTestModeScript());
});

test('3.1 Auth modal opens with USL identifier screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-modal-global .modal-overlay', { timeout: 8000 });

  // USL screen: single identifier input + country code + Google button
  await expect(page.locator('#google-auth-btn')).toBeVisible();
  await expect(page.locator('#auth-identifier')).toBeVisible();
  await expect(page.locator('#auth-country-code')).toBeVisible();
  await expect(page.locator('#usl-continue-btn')).toBeVisible();

  // No password field
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('3.2 Phone OTP: existing user goes directly to OTP screen', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Mock check-identifier to say user exists
  await page.route('**/api/auth/check-identifier', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: true }) });
  });

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-identifier', { timeout: 8000 });

  // Enter phone digits (country code already selected as +52)
  await page.locator('#auth-identifier').fill('5512025121');
  await page.locator('#usl-continue-btn').click();

  // Should land on OTP screen with Send SMS button
  await page.waitForSelector('#send-otp-btn', { timeout: 8000 });
  await expect(page.locator('#send-otp-btn')).toBeVisible();
});

test('3.3 Phone OTP: new user goes to signup email collection', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  // Mock check-identifier to say user does NOT exist
  await page.route('**/api/auth/check-identifier', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: false }) });
  });

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-identifier', { timeout: 8000 });

  await page.locator('#auth-identifier').fill('5512025121');
  await page.locator('#usl-continue-btn').click();

  // Should land on signup screen asking for name + email
  await page.waitForSelector('#signup-name', { timeout: 8000 });
  await expect(page.locator('#signup-name')).toBeVisible();
  await expect(page.locator('#signup-email')).toBeVisible();
});

test('3.4 Signup: terms screen appears after collecting counterpart', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  await page.route('**/api/auth/check-identifier', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: false }) });
  });

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-identifier', { timeout: 8000 });
  await page.locator('#auth-identifier').fill('5512025121');
  await page.locator('#usl-continue-btn').click();

  await page.waitForSelector('#signup-name', { timeout: 8000 });
  await page.locator('#signup-name').fill('QA Tester');
  await page.locator('#signup-email').fill('qa@playwright.local');
  await page.locator('.btn-primary', { hasText: /Continuar|Continue/i }).click();

  // Terms screen
  await page.waitForSelector('#terms-check', { timeout: 5000 });
  await expect(page.locator('#terms-check')).toBeVisible();
});

test('3.5 Recovery: can\'t access phone flow visible for existing user', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1000);

  await page.route('**/api/auth/check-identifier', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: true }) });
  });

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-identifier', { timeout: 8000 });
  await page.locator('#auth-identifier').fill('5512025121');
  await page.locator('#usl-continue-btn').click();

  // OTP screen should have recovery link
  await page.waitForSelector('#send-otp-btn', { timeout: 8000 });
  const recoveryBtn = page.locator('button', { hasText: /teléfono|phone/i });
  await expect(recoveryBtn).toBeVisible();
  await recoveryBtn.click();

  // Recovery screen: asks for email
  await page.waitForSelector('#recovery-email', { timeout: 5000 });
  await expect(page.locator('#recovery-email')).toBeVisible();
});
