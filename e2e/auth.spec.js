import { test, expect } from '@playwright/test';
import { resetDatabase, TEST_PASSWORD, login } from './test-helpers.js';

test.describe('Authentication & Session Management', () => {
  test.beforeEach(async () => {
    resetDatabase();
  });

  test('displays login screen when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('Chorelenger');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Log in")')).toBeVisible();
  });

  test('rejects incorrect password with error message', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Log in")');

    await expect(page.locator('.error')).toBeVisible();
    await expect(page.locator('.error')).toContainText('wrong password');
  });

  test('logs in successfully and can log out from History tab', async ({ page }) => {
    await login(page, TEST_PASSWORD);

    // Verify main app layout and tabs are visible
    await expect(page.locator('h1')).toHaveText('Today');
    await expect(page.locator('nav button:has-text("Today")')).toHaveClass(/active/);

    // Navigate to History tab and log out
    await page.click('nav button:has-text("History")');
    await expect(page.locator('h1')).toHaveText('History');

    const logoutBtn = page.locator('button:has-text("Log out")');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify redirected back to login screen
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Log in")')).toBeVisible();
  });
});
