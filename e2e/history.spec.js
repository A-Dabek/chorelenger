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
    await expect(page.locator('.card .meta')).toContainText('misc');
  });
});

test.describe('Executions: horizon and undo', () => {
  test.beforeEach(async ({ page }) => {
    resetDatabase();
    await login(page);
  });

  async function addChore(page, name, startDate) {
    await page.click('nav button:has-text("Chores")');
    await page.click('button:has-text("+ Add")');
    await page.fill('label:has-text("Name") input', name);
    if (startDate) await page.fill('label:has-text("First due") input', startDate);
    await page.click('button:has-text("Save")');
  }
  const isoIn = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  test('Today screen shows week and month bands at once; upcoming items are read-only', async ({ page }) => {
    await addChore(page, 'Soon', isoIn(3));
    await addChore(page, 'Later', isoIn(20));
    await page.click('nav button:has-text("Today")');
    await expect(page.locator('.horizon')).toHaveCount(0);
    await expect(page.locator('.tile')).toHaveCount(0);
    await expect(page.locator('section[data-band="week"] .chip[data-chore="Soon"]')).toBeVisible();
    await expect(page.locator('section[data-band="month"] .chip[data-chore="Later"]')).toBeVisible();
    await expect(page.locator('.chip[data-chore="Soon"]')).toBeVisible();
    await page.click('.chip[data-chore="Soon"]');
    await expect(page.locator('.sheet')).toHaveCount(0);
  });

  test('done then Undo from History restores the chore as the only active execution', async ({ page }) => {
    await addChore(page, 'Mop floor');
    await page.click('nav button:has-text("Today")');
    await page.click('section[data-status="due"] .tile');
    await page.click('.sheet-done');
    await expect(page.locator('section[data-status="done"] .tile')).toHaveCount(1);

    await page.click('nav button:has-text("History")');
    await expect(page.locator('h2')).toHaveText('1 completion');
    await page.click('.history-undo');
    await expect(page.locator('h2')).toHaveText('0 completions');

    await page.click('nav button:has-text("Today")');
    await expect(page.locator('section[data-status="due"] .tile[aria-label="Mop floor"]')).toHaveCount(1);
    await expect(page.locator('section[data-status="done"]')).toHaveCount(0);
  });
});
