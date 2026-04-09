// ─── Test Suite 3: Phone OTP Authentication ───────────────────────────────────
// Uses Firebase test phone +52 55 1202 5121 with OTP 232323.
// Requires appVerificationDisabledForTesting = true on auth object.
import { test, expect } from '@playwright/test';
import { TEST_PHONE, TEST_OTP, clearSession, firebaseTestModeScript } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await clearSession(page);
  // Inject Firebase test mode bypass before page load
  await page.addInitScript(firebaseTestModeScript());
});

test('3.1 Auth modal opens with correct structure', async ({ page }) => {
  await page.goto('/');
  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-modal-global .modal-overlay', { timeout: 8000 });

  await expect(page.locator('#google-auth-btn')).toBeVisible();
  await expect(page.locator('#auth-phone-number')).toBeVisible();
  await expect(page.locator('#auth-phone-name')).toBeVisible();
  await expect(page.locator('#send-otp-btn')).toBeVisible();

  // Step 2 (OTP input) should be hidden initially
  await expect(page.locator('#phone-step-2')).not.toBeVisible();
});

test('3.2 Phone OTP: Send code to test number', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000); // let Firebase initialize

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-phone-number', { timeout: 8000 });

  // Fill name and phone
  await page.locator('#auth-phone-name').fill('QA Test User');
  await page.locator('#auth-phone-number').fill(TEST_PHONE);

  // Click send code
  await page.locator('#send-otp-btn').click();

  // Should transition to OTP step (step-2 visible)
  await page.waitForSelector('#phone-step-2', { timeout: 15000, state: 'visible' });
  await expect(page.locator('#auth-otp')).toBeVisible();
  await expect(page.locator('#verify-otp-btn')).toBeVisible();
});

test('3.3 Phone OTP: Full sign-in with test credentials', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-phone-number', { timeout: 8000 });

  await page.locator('#auth-phone-name').fill('QA Test User');
  await page.locator('#auth-phone-number').fill(TEST_PHONE);
  await page.locator('#send-otp-btn').click();

  // Wait for OTP step
  await page.waitForSelector('#phone-step-2', { timeout: 15000, state: 'visible' });

  // Enter OTP
  await page.locator('#auth-otp').fill(TEST_OTP);
  await page.locator('#verify-otp-btn').click();

  // Should be logged in: auth modal closes, user menu appears in navbar
  await page.waitForSelector('.user-menu-trigger', { timeout: 10000 });
  await expect(page.locator('.user-menu-trigger')).toBeVisible();

  // Token should be stored in localStorage
  const session = await page.evaluate(() => {
    const raw = localStorage.getItem('servi_user_session');
    return raw ? JSON.parse(raw) : null;
  });
  expect(session).toBeTruthy();
  expect(session.token).toBeTruthy();
  expect(session.firebaseUid).toBeTruthy();
});

test('3.4 Phone OTP: Invalid code shows error', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(2000);

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-phone-number', { timeout: 8000 });

  await page.locator('#auth-phone-name').fill('QA Test User');
  await page.locator('#auth-phone-number').fill(TEST_PHONE);
  await page.locator('#send-otp-btn').click();
  await page.waitForSelector('#phone-step-2', { timeout: 15000, state: 'visible' });

  // Enter wrong OTP
  await page.locator('#auth-otp').fill('000000');

  let dialogMessage = '';
  page.once('dialog', async dialog => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await page.locator('#verify-otp-btn').click();
  await page.waitForTimeout(3000);

  // Should show error (via alert dialog or inline)
  expect(dialogMessage || '').not.toBe('');
  // Should still be in OTP step (not logged in)
  await expect(page.locator('#auth-otp')).toBeVisible();
});

test('3.5 Phone OTP: Logout clears session', async ({ page }) => {
  // First log in
  await page.goto('/');
  await page.addInitScript(firebaseTestModeScript());
  await page.waitForTimeout(2000);

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-phone-number', { timeout: 8000 });
  await page.locator('#auth-phone-name').fill('QA Test User');
  await page.locator('#auth-phone-number').fill(TEST_PHONE);
  await page.locator('#send-otp-btn').click();
  await page.waitForSelector('#phone-step-2', { timeout: 15000, state: 'visible' });
  await page.locator('#auth-otp').fill(TEST_OTP);
  await page.locator('#verify-otp-btn').click();
  await page.waitForSelector('.user-menu-trigger', { timeout: 10000 });

  // Now log out
  await page.locator('.user-menu-trigger').click();
  await page.waitForSelector('.user-menu-dropdown--open', { timeout: 3000 });
  await page.locator('.user-menu-item--danger').click();
  await page.waitForTimeout(1500);

  // Should show login/signup buttons
  await expect(page.locator('.nav-login-btn')).toBeVisible();

  // localStorage should be cleared
  const session = await page.evaluate(() => localStorage.getItem('servi_user_session'));
  expect(session).toBeNull();
});
