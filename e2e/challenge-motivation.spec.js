import { test, expect } from '@playwright/test';
import { resetDatabase, login } from './test-helpers.js';

test.describe('Monthly Challenge, Extra Buttons & Motivation', () => {
  test.beforeEach(async ({ page }) => {
    resetDatabase();
    await login(page);
  });

  test('interacts with monthly challenge extra buttons, undoes, spotlights chores, and checks motivation achievements', async ({ page }) => {
    // 1. Verify Monthly Challenge Banner on Today tab
    const banner = page.locator('.challenge-banner');
    await expect(banner).toBeVisible();
    await expect(banner.locator('.challenge-tag')).toHaveText('Monthly Challenge');
    await expect(banner.locator('.challenge-title')).toBeVisible();

    // 2. Interact with Extra Action Buttons
    const extraButtons = banner.locator('.extra-btn');
    await expect(extraButtons.first()).toBeVisible();

    const firstBtn = extraButtons.first();
    const initialCountText = await firstBtn.locator('.extra-count').innerText();
    const initialCount = Number(initialCountText);

    // Tap extra button
    await firstBtn.click();

    // Verify toast appears
    await expect(page.locator('.toast')).toBeVisible();
    await expect(page.locator('.toast')).toContainText('logged (+1)');
    await expect(firstBtn.locator('.extra-count')).toHaveText(String(initialCount + 1));

    // Tap Undo on toast
    await page.click('.toast button:has-text("Undo")');
    await expect(firstBtn.locator('.extra-count')).toHaveText(String(initialCount));

    // Tap extra button again to keep +1
    await firstBtn.click();
    await expect(firstBtn.locator('.extra-count')).toHaveText(String(initialCount + 1));

    // 3. Add a chore matching the active challenge spotlight category
    // In October (month 10), spotlight categories include 'dog', 'outdoors', 'health'
    await page.click('nav button:has-text("Chores")');
    await page.click('button:has-text("+ Add")');
    await page.fill('label:has-text("Name") input', 'Walk the dog');
    await page.fill('label:has-text("Category") input', 'dog');
    await page.click('button:has-text("Save")');

    // Go to Today tab and verify Spotlight badge
    await page.click('nav button:has-text("Today")');
    const spotlightCard = page.locator('.card.spotlight');
    await expect(spotlightCard).toBeVisible();
    await expect(spotlightCard.locator('.spotlight-badge')).toHaveText('✨ Spotlight');

    // Mark chore as Done
    await spotlightCard.locator('button:has-text("Done")').click();
    await expect(page.locator('.toast')).toBeVisible();

    // 4. Navigate to Motivation Tab
    await page.click('nav button:has-text("Motivation")');
    await expect(page.locator('h1')).toHaveText('Motivation & Rewards');

    // Monthly Reward Status
    const rewardCard = page.locator('.reward-card');
    await expect(rewardCard).toBeVisible();
    await expect(rewardCard.locator('.reward-item').first()).toContainText('Base Reward');
    await expect(rewardCard.locator('.reward-item').nth(1)).toContainText('Extra Goal');
    await expect(rewardCard.locator('.reward-item').nth(1)).toContainText('1 /');

    // Achievements Gallery
    const achievementsGrid = page.locator('.achievements-grid');
    await expect(achievementsGrid).toBeVisible();

    // 'First Step' and 'Extra Effort' should be unlocked
    const firstStepBadge = achievementsGrid.locator('.achievement-card:has-text("First Step")');
    await expect(firstStepBadge).toHaveClass(/unlocked/);
    await expect(firstStepBadge.locator('.achievement-date')).toContainText('Unlocked');

    const extraEffortBadge = achievementsGrid.locator('.achievement-card:has-text("Extra Effort")');
    await expect(extraEffortBadge).toHaveClass(/unlocked/);
    await expect(extraEffortBadge.locator('.achievement-date')).toContainText('Unlocked');

    // Higher milestones should remain locked
    const centuryBadge = achievementsGrid.locator('.achievement-card:has-text("Century Club")');
    await expect(centuryBadge).toHaveClass(/locked/);
    await expect(centuryBadge.locator('.achievement-date')).toHaveText('Locked');
  });
});
