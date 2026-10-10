import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { schedule, localDate } from './schedule.js';

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

const EXEC_COLS = `source_type, source_key, chore_id, title, icon, category, due_date, window_start, overdue_after,
  start_time, end_time, is_all_day, location, notes, rrule, exdates, series_start, status, done_date, done_at`;
const EXEC_PARAMS = EXEC_COLS.replace(/\s+/g, ' ').split(',').map((c) => `@${c.trim()}`).join(', ');

// One-time, idempotent copy of chores/completions/planned_items into executions (old tables stay untouched).
function migrateExecutions(db) {
  if (db.prepare("SELECT 1 FROM app_settings WHERE key = 'executions_migrated'").get()) return;
  const today = localDate();
  const blank = {
    source_key: null, chore_id: null, icon: '', category: '', window_start: null, overdue_after: null,
    start_time: null, end_time: null, is_all_day: 1, location: '', notes: '', rrule: null, exdates: '',
    series_start: null, status: 'active', done_date: null, done_at: null,
  };
  const insert = db.prepare(`INSERT OR IGNORE INTO executions (${EXEC_COLS}) VALUES (${EXEC_PARAMS})`);
  db.exec('BEGIN');
  try {
    for (const c of db.prepare('SELECT * FROM chores ORDER BY id').all()) {
      const base = {
        ...blank, source_type: 'chore', source_key: `chore:${c.id}`, chore_id: c.id,
        title: c.name, icon: c.icon || '', category: c.category || '',
      };
      const done = db.prepare('SELECT done_date, done_at FROM completions WHERE chore_id = ? ORDER BY done_date, id').all(c.id);
      for (const d of done) {
        insert.run({ ...base, due_date: d.done_date, status: 'done', done_date: d.done_date, done_at: d.done_at });
      }
      if (c.type === 'one_off') {
        if (!done.length) insert.run({ ...base, due_date: today });
        continue;
      }
      const s = schedule(c, done.length ? done[done.length - 1].done_date : null, today);
      insert.run({ ...base, due_date: s.dueDate, window_start: s.windowStart, overdue_after: s.overdueAfter });
    }
    for (const p of db.prepare('SELECT * FROM planned_items ORDER BY id').all()) {
      const isDone = p.status === 'completed';
      insert.run({
        ...blank,
        source_type: p.source === 'manual' ? 'manual' : 'calendar',
        source_key: p.source !== 'manual' && p.external_uid ? `cal:${p.external_uid}` : null,
        title: p.title, due_date: p.start_date, start_time: p.start_time, end_time: p.end_time,
        is_all_day: p.is_all_day, location: p.location, notes: p.notes,
        rrule: p.rrule || null, exdates: p.exdates || '', series_start: p.rrule ? p.start_date : null,
        status: isDone ? 'done' : 'active',
        done_date: isDone ? (p.completed_at || p.start_date).slice(0, 10) : null,
        done_at: isDone ? p.completed_at : null,
      });
    }
    db.exec(`INSERT INTO app_settings (key, value) VALUES ('executions_migrated', datetime('now'))`);
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* no open transaction */ }
    throw e;
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
    CREATE TABLE IF NOT EXISTS executions (
      id INTEGER PRIMARY KEY,
      source_type TEXT NOT NULL CHECK (source_type IN ('chore','calendar','manual')),
      source_key TEXT,
      chore_id INTEGER REFERENCES chores(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL,
      window_start TEXT,
      overdue_after TEXT,
      start_time TEXT,
      end_time TEXT,
      is_all_day INTEGER NOT NULL DEFAULT 1,
      location TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      rrule TEXT,
      exdates TEXT NOT NULL DEFAULT '',
      series_start TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
      done_date TEXT,
      done_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exec_one_active ON executions(source_key)
      WHERE status = 'active' AND source_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_exec_status_due ON executions(status, due_date);
    CREATE INDEX IF NOT EXISTS idx_exec_done ON executions(done_date);
  `);
  if (!db.prepare('PRAGMA table_info(chores)').all().some((c) => c.name === 'icon')) {
    db.exec("ALTER TABLE chores ADD COLUMN icon TEXT NOT NULL DEFAULT ''");
  }
  const plannedCols = db.prepare('PRAGMA table_info(planned_items)').all().map((c) => c.name);
  if (!plannedCols.includes('rrule')) db.exec('ALTER TABLE planned_items ADD COLUMN rrule TEXT');
  if (!plannedCols.includes('exdates')) db.exec("ALTER TABLE planned_items ADD COLUMN exdates TEXT NOT NULL DEFAULT ''");
  migrateOneOff(db);
  if (!db.prepare('PRAGMA table_info(chores)').all().some((c) => c.name === 'anchor')) {
    db.exec("ALTER TABLE chores ADD COLUMN anchor TEXT NOT NULL DEFAULT 'done'");
  }
  migrateExecutions(db);
  return db;
}
