import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from './db.js';

function seedLegacy(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE chores (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK (type IN ('interval','flexible','calendar','one_off')),
      interval_n INTEGER, interval_unit TEXT, cal_month INTEGER, cal_day INTEGER,
      window_days INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')), icon TEXT NOT NULL DEFAULT '');
    CREATE TABLE completions (id INTEGER PRIMARY KEY, chore_id INTEGER NOT NULL, done_date TEXT NOT NULL,
      done_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE planned_items (id INTEGER PRIMARY KEY, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL, start_time TEXT, end_time TEXT, is_all_day INTEGER NOT NULL DEFAULT 1,
      location TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'manual', external_uid TEXT,
      status TEXT NOT NULL DEFAULT 'pending', completed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
      rrule TEXT, exdates TEXT NOT NULL DEFAULT '');
    INSERT INTO chores (id, name, type, interval_n, interval_unit, start_date) VALUES (1, 'Vacuum', 'interval', 1, 'week', '2026-01-01');
    INSERT INTO chores (id, name, type, start_date) VALUES (2, 'Once', 'one_off', '2026-01-01');
    INSERT INTO chores (id, name, type, start_date) VALUES (3, 'Done once', 'one_off', '2026-01-01');
    INSERT INTO completions (chore_id, done_date) VALUES (1, '2026-01-05'), (1, '2026-01-12'), (3, '2026-01-02');
    INSERT INTO planned_items (title, start_date, source) VALUES ('Dentist', '2026-02-01', 'manual');
    INSERT INTO planned_items (title, start_date, source, external_uid, rrule) VALUES ('Standup', '2026-02-02', 'calendar_sync', 'u1', 'FREQ=DAILY');
    INSERT INTO planned_items (title, start_date, source, external_uid, status, completed_at)
      VALUES ('Party', '2026-01-20', 'ics_import', 'u2', 'completed', '2026-01-20T10:00:00.000Z');
  `);
  db.close();
}

test('legacy DB migrates into executions once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cl-mig-'));
  const file = join(dir, 'legacy.db');
  try {
    seedLegacy(file);
    const db = openDb(file);
    const q = (sql) => db.prepare(sql).all();
    const active = q("SELECT * FROM executions WHERE status = 'active' ORDER BY id");
    assert.deepEqual(active.map((e) => e.title).sort(), ['Dentist', 'Once', 'Standup', 'Vacuum']);
    const vac = active.find((e) => e.title === 'Vacuum');
    assert.equal(vac.source_key, 'chore:1');
    assert.equal(vac.due_date, '2026-01-19');
    assert.equal(q("SELECT * FROM executions WHERE source_key = 'chore:1' AND status = 'done'").length, 2);
    assert.equal(q("SELECT * FROM executions WHERE source_key = 'chore:3'").length, 1);
    assert.equal(active.find((e) => e.title === 'Dentist').source_type, 'manual');
    const standup = active.find((e) => e.title === 'Standup');
    assert.equal(standup.source_key, 'cal:u1');
    assert.equal(standup.series_start, '2026-02-02');
    const party = q("SELECT * FROM executions WHERE source_key = 'cal:u2'")[0];
    assert.equal(party.status, 'done');
    assert.equal(party.done_date, '2026-01-20');
    assert.equal(q("SELECT anchor FROM chores WHERE id = 1")[0].anchor, 'done');
    const total = q('SELECT COUNT(*) AS n FROM executions')[0].n;
    db.close();

    const again = openDb(file);
    assert.equal(again.prepare('SELECT COUNT(*) AS n FROM executions').get().n, total);
    again.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
