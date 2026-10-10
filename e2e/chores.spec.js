import { test, expect } from '@playwright/test';
import { resetDatabase, login } from './test-helpers.js';

test.describe('Chore Lifecycle & Execution', () => {
  test.beforeEach(async ({ page }) => {
    resetDatabase();
    await login(page);
  });

  test('creates, edits, executes, undoes, and deletes chores', async ({ page }) => {
    // 1. Initial empty state
    await expect(page.locator('.empty')).toContainText('No chores yet');

    // 2. Navigate to Chores tab and add a new chore
    await page.click('nav button:has-text("Chores")');
    await expect(page.locator('h1')).toHaveText('Chores');
    await page.click('button:has-text("+ Add")');

    await expect(page.locator('h1')).toHaveText('New chore');
    await page.fill('label:has-text("Name") input', 'Water house plants');
    await page.fill('label:has-text("Category") input', 'plants');
    await page.selectOption('label:has-text("Repeats") select', 'interval');
    await page.fill('label:has-text("Every") input', '2');
    await page.selectOption('label:has-text("Unit") select', 'day');
    await page.click('button:has-text("Save")');

    // Verify chore appears in list
    await expect(page.locator('.card .name')).toHaveText('Water house plants');
    await expect(page.locator('.card .meta')).toContainText('plants');
    await expect(page.locator('.card .meta')).toContainText('every 2 days');

    // 3. Edit chore
    await page.click('.card .info');
    await expect(page.locator('h1')).toHaveText('Edit chore');
    await page.fill('label:has-text("Name") input', 'Water indoor plants');
    await page.click('button:has-text("Save")');

    await expect(page.locator('.card .name')).toHaveText('Water indoor plants');

    // 4. Go to Today tab and complete chore
    await page.click('nav button:has-text("Today")');
    await expect(page.locator('section[data-status="due"] .tile')).toHaveAttribute('aria-label', 'Water indoor plants');

    // Click "Done"
    await page.click('section[data-status="due"] .tile');
    await page.click('.sheet-done');

    // Toast should show and chore moves to Done today
    await expect(page.locator('.toast')).toContainText('Water indoor plants done ✓');
    await expect(page.locator('section[data-status="done"] .tile')).toHaveAttribute('aria-label', 'Water indoor plants');

    // 5. Click "Undo" on toast
    await page.click('.toast button:has-text("Undo")');
    await expect(page.locator('section[data-status="due"] .tile')).toHaveAttribute('aria-label', 'Water indoor plants');

    // 6. Complete chore again and verify persistence across reload
    await page.click('section[data-status="due"] .tile');
    await page.click('.sheet-done');
    await expect(page.locator('section[data-status="done"] .tile')).toHaveAttribute('aria-label', 'Water indoor plants');

    await page.reload();
    await expect(page.locator('section[data-status="done"] .tile')).toHaveAttribute('aria-label', 'Water indoor plants');

    // 7. Delete chore
    await page.click('nav button:has-text("Chores")');
    await page.click('.card .info');
    page.on('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("Delete")');

    await expect(page.locator('.empty')).toContainText('Nothing here yet.');
  });

  test('creates flexible window and calendar recurring chores', async ({ page }) => {
    await page.click('nav button:has-text("Chores")');

    // 1. Create flexible window chore
    await page.click('button:has-text("+ Add")');
    await page.fill('label:has-text("Name") input', 'Vacuum carpets');
    await page.fill('label:has-text("Category") input', 'home');
    await page.selectOption('label:has-text("Repeats") select', 'flexible');
    await page.fill('label:has-text("Every") input', '1');
    await page.selectOption('label:has-text("Unit") select', 'week');
    await page.fill('label:has-text("Window") input', '2');
    await page.click('button:has-text("Save")');

    // 2. Create calendar yearly chore
    await page.click('button:has-text("+ Add")');
    await page.fill('label:has-text("Name") input', 'Annual HVAC Filter');
    await page.fill('label:has-text("Category") input', 'maintenance');
    await page.selectOption('label:has-text("Repeats") select', 'calendar');
    await page.selectOption('label:has-text("Month") select', '10');
    await page.fill('label:has-text("Day") input', '15');
    await page.click('button:has-text("Save")');

    // Verify both chores rendered in Chores list
    await expect(page.locator('.card:has-text("Vacuum carpets")')).toContainText('~every week (±2d)');
    await expect(page.locator('.card:has-text("Annual HVAC Filter")')).toContainText('every Oct 15');
  });
});
