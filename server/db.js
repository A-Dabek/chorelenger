import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// SQLite cannot alter a CHECK constraint: rebuild chores when the old one lacks 'one_off'.
function migrateOneOff(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chores'").get();
  if (!row || row.sql.includes('one_off')) return;
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec(`
      BEGIN;
      CREATE TABLE chores_new (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL CHECK (type IN ('interval','flexible','calendar','one_off')),
        interval_n INTEGER,
        interval_unit TEXT CHECK (interval_unit IN ('day','week','month')),
        cal_month INTEGER,
        cal_day INTEGER,
        window_days INTEGER NOT NULL DEFAULT 0,
        start_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        icon TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO chores_new (id, name, category, type, interval_n, interval_unit, cal_month, cal_day,
        window_days, start_date, created_at, icon)
        SELECT id, name, category, type, interval_n, interval_unit, cal_month, cal_day,
        window_days, start_date, created_at, icon FROM chores;
      DROP TABLE chores;
      ALTER TABLE chores_new RENAME TO chores;
      COMMIT;
    `);
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* no open transaction */ }
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

export function openDb(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS chores (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK (type IN ('interval','flexible','calendar','one_off')),
      interval_n INTEGER,
      interval_unit TEXT CHECK (interval_unit IN ('day','week','month')),
      cal_month INTEGER,
      cal_day INTEGER,
      window_days INTEGER NOT NULL DEFAULT 0,
      start_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS completions (
      id INTEGER PRIMARY KEY,
      chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
      done_date TEXT NOT NULL,
      done_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_completions_chore ON completions(chore_id, done_date);
    CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(done_date);
    CREATE TABLE IF NOT EXISTS extra_completions (
      id INTEGER PRIMARY KEY,
      month TEXT NOT NULL,
      extra_id TEXT NOT NULL,
      done_date TEXT NOT NULL,
      done_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_extras_month ON extra_completions(month, extra_id);
    CREATE INDEX IF NOT EXISTS idx_extras_date ON extra_completions(done_date);
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS planned_items (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 1,
      location TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'calendar_sync', 'ics_import')),
      external_uid TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_planned_date ON planned_items(start_date, start_time);
    CREATE INDEX IF NOT EXISTS idx_planned_status ON planned_items(status);
    CREATE INDEX IF NOT EXISTS idx_planned_uid ON planned_items(external_uid);
  `);
  if (!db.prepare('PRAGMA table_info(chores)').all().some((c) => c.name === 'icon')) {
    db.exec("ALTER TABLE chores ADD COLUMN icon TEXT NOT NULL DEFAULT ''");
  }
  migrateOneOff(db);
  return db;
}
