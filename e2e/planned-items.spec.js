import { test, expect } from '@playwright/test';
import { resetDatabase, login } from './test-helpers.js';

test.describe('Planned Items & Calendar Sync', () => {
  test.beforeEach(async ({ page }) => {
    resetDatabase();
    await login(page);
  });

  test('creates one-off task, generates Google Calendar link, confirms Done and undoes', async ({ page }) => {
    // Navigate to Planned tab
    await page.click('nav button:has-text("Planned")');
    await expect(page.locator('h1')).toHaveText('Planned Items & Calendar');
    await expect(page.locator('.empty')).toContainText('No planned items');

    // Click "+ Plan Item"
    await page.click('button:has-text("+ Plan Item")');
    await expect(page.locator('h2')).toHaveText('New One-Off Task');

    // Fill form for internal one-off task
    await page.fill('label:has-text("Title") input', 'Deliver package to post office');
    await page.fill('label:has-text("Location") input', 'Downtown Post Office');
    await page.fill('label:has-text("Notes") input', 'Bring parcel slip #4492');
    await page.click('button:has-text("Save")');

    // Check item card in Planned view
    const card = page.locator('.planned-card:has-text("Deliver package to post office")');
    await expect(card).toBeVisible();
    await expect(card.locator('.source-badge')).toHaveText('📝 One-Off Task');
    await expect(card.locator('.source-badge')).toHaveClass(/manual/);
    await expect(card.locator('.meta')).toContainText('Downtown Post Office');
    await expect(card.locator('.meta')).toContainText('Bring parcel slip #4492');

    // Check Google Calendar Web Intent link
    const gcalLink = card.locator('a.gcal-link');
    await expect(gcalLink).toBeVisible();
    await expect(gcalLink).toHaveText('📅 Google Cal');
    const href = await gcalLink.getAttribute('href');
    expect(href).toContain('calendar.google.com/calendar/render?action=TEMPLATE');
    expect(href).toContain('text=Deliver%20package%20to%20post%20office');
    expect(href).toContain('Downtown%20Post%20Office');

    // Confirm as Done
    await card.locator('button.done-btn:has-text("Done")').click();

    // Verify undo toast appears and item moves to Completed
    await expect(page.locator('.toast')).toContainText('Deliver package to post office done ✓');
    await expect(page.locator('section:has-text("Completed & Acknowledged") .planned-card')).toContainText('Deliver package to post office');

    // Undo confirmation
    await page.click('.toast button:has-text("Undo")');
    await expect(page.locator('section:has-text("Today") .planned-card')).toContainText('Deliver package to post office');
    await expect(page.locator('.planned-card:has-text("Deliver package to post office") button.done-btn')).toHaveText('Done');
  });

  test('configures calendar feed URL and imports .ics events without Planned-tab acknowledge', async ({ page }) => {
    await page.click('nav button:has-text("Planned")');

    // Open Feed Settings
    await page.click('button:has-text("Feed Settings")');
    await expect(page.locator('.settings-panel h2')).toContainText('iCal Feed Sync');

    await page.fill('.settings-panel input', 'webcal://calendar.google.com/calendar/ical/test/basic.ics');
    await page.click('.settings-panel button:has-text("Save Feed URL")');

    await expect(page.locator('.sync-info')).toContainText('Calendar feed linked');
    await expect(page.locator('button:has-text("Sync Feed")')).toBeVisible();

    // Import .ics file payload via file dropzone
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:e2e-doctor-app-99@google.com',
      'SUMMARY:Dentist Cleaning Appointment',
      'DESCRIPTION:Regular 6-month checkup.',
      'DTSTART;VALUE=DATE:20261015',
      'LOCATION:Dental Health Center',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    // Set file input payload
    await page.locator('#ics-file-input').setInputFiles({
      name: 'calendar.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from(icsContent),
    });

    // Verify imported calendar event appears with Calendar badge
    const calCard = page.locator('.planned-card:has-text("Dentist Cleaning Appointment")');
    await expect(calCard).toBeVisible();
    await expect(calCard.locator('.source-badge')).toHaveText('📅 Calendar Event');
    await expect(calCard.locator('.source-badge')).toHaveClass(/calendar/);
    await expect(calCard.locator('.meta')).toContainText('Dental Health Center');

    // Calendar events have no Acknowledge/Done button on the Planned tab and no Google Cal link
    await expect(calCard.locator('a.gcal-link')).not.toBeVisible();
    await expect(calCard.locator('button')).toHaveCount(0);

    // Acknowledge from the Today tab 'Calendar' section instead (event is in the future, so not listed yet)
    await page.click('nav button:has-text("Today")');
    await expect(page.locator('.calendar-section')).not.toBeVisible();
  });

  test('acknowledges due calendar event from Today with undo', async ({ page }) => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const todayCompact = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
    await page.click('nav button:has-text("Planned")');
    await page.locator('#ics-file-input').setInputFiles({
      name: 'today.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from([
        'BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:e2e-today@x', 'SUMMARY:Dentist Today',
        `DTSTART;VALUE=DATE:${todayCompact}`, 'END:VEVENT', 'END:VCALENDAR',
      ].join('\r\n')),
    });
    await expect(page.locator('.planned-card:has-text("Dentist Today")')).toBeVisible();

    await page.click('nav button:has-text("Today")');
    const item = page.locator('.calendar-section .cal-item:has-text("Dentist Today")');
    await expect(item).toBeVisible();
    await item.click();
    await expect(page.locator('.toast')).toContainText('Acknowledged: Dentist Today ✓');
    await expect(item).toBeDisabled();

    await page.click('.toast button:has-text("Undo")');
    await expect(item).toBeEnabled();
  });

  test('edits and deletes planned item', async ({ page }) => {
    await page.click('nav button:has-text("Planned")');

    // Create item
    await page.click('button:has-text("+ Plan Item")');
    await page.fill('label:has-text("Title") input', 'Initial Item');
    await page.click('button:has-text("Save")');

    // Edit item
    await page.click('.planned-card .info');
    await expect(page.locator('h2')).toHaveText('Edit Planned Item');
    await page.fill('label:has-text("Title") input', 'Updated Item Title');
    await page.click('button:has-text("Save")');

    await expect(page.locator('.planned-card .name')).toContainText('Updated Item Title');

    // Delete item
    await page.click('.planned-card .info');
    page.on('dialog', (dialog) => dialog.accept());
    await page.click('button:has-text("Delete")');

    await expect(page.locator('.empty')).toContainText('No planned items');
  });

  test('import skips past events and keeps upcoming ones', async ({ page }) => {
    await page.click('nav button:has-text("Planned")');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:historical-event-2018@google.com',
      'SUMMARY:Ancient Meeting from 2018',
      'DTSTART;VALUE=DATE:20180424',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:upcoming-event-2036@google.com',
      'SUMMARY:Upcoming Trip Next Week',
      'DTSTART;VALUE=DATE:20361015',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    await page.locator('#ics-file-input').setInputFiles({
      name: 'historical.ics',
      mimeType: 'text/calendar',
      buffer: Buffer.from(icsContent),
    });

    await expect(page.locator('.planned-card:has-text("Upcoming Trip Next Week")')).toBeVisible();
    await expect(page.locator('.planned-card:has-text("Ancient Meeting from 2018")')).toHaveCount(0);
  });

  test('mobile viewport renders Planned tab without horizontal overflow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('nav button:has-text("Planned")');

    // Create item with long text and notes
    await page.click('button:has-text("+ Plan Item")');
    await page.fill('label:has-text("Title") input', 'Very long planned task title that should wrap nicely on mobile screens');
    await page.fill('label:has-text("Location") input', 'A long location description with plenty of characters');
    await page.fill('label:has-text("Notes") input', 'Extra notes for this item to ensure that everything wraps and nothing overflows');
    await page.click('button:has-text("Save")');

    // Verify card is visible
    const card = page.locator('.planned-card');
    await expect(card).toBeVisible();

    // Verify no horizontal overflow on document or main container
    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isOverflowing).toBe(false);
  });
});
