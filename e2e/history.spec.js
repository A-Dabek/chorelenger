import { test, expect } from '@playwright/test';
import { resetDatabase, login } from './test-helpers.js';

test.describe('History Log', () => {
  test.beforeEach(async ({ page }) => {
    resetDatabase();
    await login(page);
  });

  test('records and displays completed chores in monthly history', async ({ page }) => {
    // 1. Check History initially
    await page.click('nav button:has-text("History")');
    await expect(page.locator('h1')).toHaveText('History');
    await expect(page.locator('h2')).toHaveText('0 completions');

    // 2. Add and complete a chore
    await page.click('nav button:has-text("Chores")');
    await page.click('button:has-text("+ Add")');
    await page.fill('label:has-text("Name") input', 'Sweep balcony');
    await page.selectOption('label:has-text("Category") select', 'misc');
    await page.click('button:has-text("Save")');

    await page.click('nav button:has-text("Today")');
    await page.click('section[data-status="due"] .tile');
    await page.click('.sheet-done');

    // 3. Return to History tab
    await page.click('nav button:has-text("History")');
    await expect(page.locator('h2')).toHaveText('1 completion');
    await expect(page.locator('.card .name')).toHaveText('Sweep balcony');
    await expect(page.locator('.card .meta')).toContainText('home');
  });
});
