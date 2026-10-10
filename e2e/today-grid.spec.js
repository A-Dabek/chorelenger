import { test, expect } from '@playwright/test';
import { login, resetDatabase } from './test-helpers.js';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Today compact icon grid', () => {
  test.beforeEach(async ({ page }) => {
    resetDatabase();
    await login(page);
  });

  async function addChore(page, name, icon = '') {
    await page.click('nav button:has-text("Chores")');
    await page.click('button:has-text("+ Add")');
    await page.fill('label:has-text("Name") input', name);
    if (icon) await page.fill('label:has-text("Icon") input', icon);
    await page.click('button:has-text("Save")');
  }

  test('confirm sheet: cancel does nothing, Done completes; done tile is inert; verbose persists', async ({ page }) => {
    await addChore(page, 'Walk dog', '🐕');
    await addChore(page, 'Vacuum');
    await page.click('nav button:has-text("Today")');

    await expect(page.locator('.tile[aria-label="Walk dog"] .chore-emoji')).toHaveText('🐕');
    await expect(page.locator('.tile[aria-label="Vacuum"] .chore-emoji')).toHaveText('V');

    await page.click('.tile[aria-label="Walk dog"]');
    await expect(page.locator('.sheet')).toBeVisible();
    await page.click('.sheet-cancel');
    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('section[data-status="done"]')).toHaveCount(0);

    await page.click('.tile[aria-label="Walk dog"]');
    await page.click('.sheet-done');
    await expect(page.locator('.toast')).toContainText('Walk dog done ✓');
    await expect(page.locator('section[data-status="done"] .tile[aria-label="Walk dog"]')).toBeDisabled();

    await expect(page.locator('.tile-name')).toHaveCount(0);
    await page.click('.verbose-toggle');
    await expect(page.locator('.tile-name').first()).toBeVisible();
    await page.reload();
    await expect(page.locator('.tile-name').first()).toBeVisible();
  });

  test('24 chores fit on one 390x844 screen without overflow', async ({ page }) => {
    for (let i = 1; i <= 24; i++) await addChore(page, `Chore ${i}`);
    await page.click('nav button:has-text("Today")');
    await expect(page.locator('.tile')).toHaveCount(24);
    const m = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
      sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
    }));
    expect(m.sw).toBeLessThanOrEqual(m.cw);
    expect(m.sh).toBeLessThanOrEqual(m.ch);
  });
});
