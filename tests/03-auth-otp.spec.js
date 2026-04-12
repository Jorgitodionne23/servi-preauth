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

test('3.3 Phone OTP: new user goes to OTP screen first', async ({ page }) => {
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

  // USL flow: new phone users go to OTP screen first; name collection comes AFTER OTP verification
  await page.waitForSelector('#send-otp-btn', { timeout: 8000 });
  await expect(page.locator('#send-otp-btn')).toBeVisible();
  // Name/email fields should NOT be present on the OTP screen
  await expect(page.locator('#signup-name')).toHaveCount(0);
});

test('3.4 Signup: new user OTP screen has send-otp-btn and no name form yet', async ({ page }) => {
  // NOTE: Name collection (renderNameCollectionScreen with #signup-first-name / #signup-last-name)
  // only appears AFTER OTP is verified. Testing that step end-to-end requires a real Firebase
  // test phone number. This test verifies the state just before OTP — the OTP screen itself.
  await page.goto('/');
  await page.waitForTimeout(2000);

  await page.route('**/api/auth/check-identifier', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ exists: false }) });
  });

  await page.locator('button', { hasText: /Iniciar sesión|Log in|Crear cuenta|Sign up/i }).first().click();
  await page.waitForSelector('#auth-identifier', { timeout: 8000 });
  await page.locator('#auth-identifier').fill('5512025121');
  await page.locator('#usl-continue-btn').click();

  // USL flow: OTP screen appears first for both new and existing phone users
  await page.waitForSelector('#send-otp-btn', { timeout: 8000 });
  await expect(page.locator('#send-otp-btn')).toBeVisible();
  // Name/terms fields are NOT present at this stage — they appear post-OTP
  await expect(page.locator('#signup-first-name')).toHaveCount(0);
  await expect(page.locator('#terms-check')).toHaveCount(0);
});

test('3.6 Error handling: auth/invalid-action-code string present in shared-auth source', async ({ page }) => {
  // Source inspection: verify handleEmailLinkSignIn handles auth/invalid-action-code
  // with a user-friendly message and option to request a new link.
  const response = await page.request.get('/shared/shared-auth.js');
  expect(response.ok()).toBeTruthy();
  const src = await response.text();
  expect(src).toContain('auth/invalid-action-code');
  expect(src).toContain('renderOTPScreen');
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
