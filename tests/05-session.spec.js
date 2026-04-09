// ─── Test Suite 5: Session & User Menu ───────────────────────────────────────
import { test, expect } from '@playwright/test';
import { clearSession, injectFakeSession } from './helpers.js';

test('5.1 Logged-in user sees user menu, not login buttons', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/');
  await page.waitForTimeout(1000);
  await expect(page.locator('.user-menu-trigger')).toBeVisible();
  await expect(page.locator('.nav-login-btn')).not.toBeVisible();
  await expect(page.locator('.nav-signup-btn')).not.toBeVisible();
});

test('5.2 User menu shows correct name', async ({ page }) => {
  await injectFakeSession(page, { name: 'Jorge Dionne' });
  await page.goto('/');
  await page.waitForTimeout(1000);
  await expect(page.locator('.user-menu-trigger')).toContainText('Jorge');
});

test('5.3 User menu dropdown opens and closes', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/');
  await page.waitForTimeout(1000);

  await page.locator('.user-menu-trigger').click();
  await expect(page.locator('#user-menu-dropdown')).toHaveClass(/user-menu-dropdown--open/);

  await page.mouse.click(100, 100);
  await page.waitForTimeout(300);
  await expect(page.locator('#user-menu-dropdown')).not.toHaveClass(/user-menu-dropdown--open/);
});

test('5.4 User menu has My Account link', async ({ page }) => {
  await injectFakeSession(page);
  await page.goto('/');
  await page.waitForTimeout(1000);

  await page.locator('.user-menu-trigger').click();
  const accountLink = page.locator('.user-menu-item[href="/account.html"]');
  await expect(accountLink).toBeVisible();
});

test('5.5 Session persists across page reloads', async ({ page }) => {
  await injectFakeSession(page, { name: 'Persistent User' });
  await page.goto('/');
  await page.waitForTimeout(1000);
  await expect(page.locator('.user-menu-trigger')).toBeVisible();

  await page.reload();
  await page.waitForTimeout(1000);
  await expect(page.locator('.user-menu-trigger')).toBeVisible();
});

test('5.6 Stale session (no token, no firebaseUid) is cleared', async ({ page }) => {
  // Inject stale pre-migration session (no token, no firebaseUid)
  await page.addInitScript(() => {
    try {
      localStorage.setItem('servi_user_session', JSON.stringify({
        user: { id: 'old-id', email: 'old@test.com', name: 'Old User', phone: null }
      }));
    } catch (e) {}
  });
  await page.goto('/');
  await page.waitForTimeout(1000);

  // Should show login buttons (stale session cleared)
  await expect(page.locator('.nav-login-btn')).toBeVisible();
});

test('5.7 Logout clears session and shows login buttons', async ({ page }) => {
  await injectFakeSession(page, { name: 'Logout Test' });
  await page.goto('/');
  await page.waitForTimeout(1000);
  await expect(page.locator('.user-menu-trigger')).toBeVisible();

  await page.locator('.user-menu-trigger').click();
  await page.waitForSelector('.user-menu-dropdown--open');
  await page.locator('.user-menu-item--danger').click();
  await page.waitForTimeout(1500);

  await expect(page.locator('.nav-login-btn')).toBeVisible();

  const session = await page.evaluate(() => localStorage.getItem('servi_user_session'));
  expect(session).toBeNull();
});
