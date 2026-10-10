import { openDb } from '../server/db.js';

export const TEST_PASSWORD = 'testpassword123';
const TEST_DB_PATH = './data/e2e-test.db';

export function resetDatabase() {
  const db = openDb(TEST_DB_PATH);
  try {
    db.exec(`
      DELETE FROM completions;
      DELETE FROM extra_completions;
      DELETE FROM chores;
      DELETE FROM planned_items;
      DELETE FROM app_settings;
      DELETE FROM sessions;
    `);
  } finally {
    db.close();
  }
}

export async function login(page, password = TEST_PASSWORD) {
  await page.goto('/');
  await page.fill('input[type="password"]', password);
  await page.click('button:has-text("Log in")');
  await page.waitForSelector('nav button');
}
