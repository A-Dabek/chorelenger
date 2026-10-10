// Execution lifecycle: one concrete to-do instance with a due date.
// Invariant (also enforced by a partial unique index): at most one active execution per source_key.
import { firstDue, nextDue, addDays, diffDays } from './schedule.js';
import { nextOccurrence } from './calendar.js';

export class ExecError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const COLS = ['source_type', 'source_key', 'chore_id', 'title', 'icon', 'category', 'due_date', 'window_start',
  'overdue_after', 'start_time', 'end_time', 'is_all_day', 'location', 'notes', 'rrule', 'exdates', 'series_start',
  'status', 'done_date', 'done_at'];

const DEFAULTS = {
  source_key: null, chore_id: null, icon: '', category: '', window_start: null, overdue_after: null,
  start_time: null, end_time: null, is_all_day: 1, location: '', notes: '', rrule: null, exdates: '',
  series_start: null, status: 'active', done_date: null, done_at: null,
};

const depths = new WeakMap();

// Re-entrant transaction helper (inner calls join the outer transaction).
export function tx(db, fn) {
  const depth = depths.get(db) || 0;
  if (depth > 0) return fn();
  db.exec('BEGIN IMMEDIATE');
  depths.set(db, 1);
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* no open transaction */ }
    throw e;
  } finally {
    depths.set(db, 0);
  }
}

export const getExecution = (db, id) => db.prepare('SELECT * FROM executions WHERE id = ?').get(id);

export function insertExecution(db, e) {
  const row = { ...DEFAULTS, ...e };
  const params = Object.fromEntries(COLS.map((c) => [c, row[c] ?? null]));
  const r = db.prepare(`INSERT INTO executions (${COLS.join(', ')}) VALUES (${COLS.map((c) => `@${c}`).join(', ')})`).run(params);
  return getExecution(db, Number(r.lastInsertRowid));
}

/** Derived display state of an execution row. */
export function stateOf(row, today) {
  if (row.status === 'done') return 'done';
  const start = row.window_start || row.due_date;
  const end = row.overdue_after || row.due_date;
  if (today > end) return 'overdue';
  if (today >= start) return 'due';
  return 'upcoming';
}

export function presentExecution(row, today) {
  if (!row) return null;
  return {
    ...row,
    is_all_day: Boolean(row.is_all_day),
    recurring: Boolean(row.rrule),
    execStatus: row.status,
    status: stateOf(row, today),
    daysUntil: diffDays(row.due_date, today),
  };
}

const activeFor = (db, key) => db.prepare("SELECT * FROM executions WHERE source_key = ? AND status = 'active'").get(key);
const choreKey = (id) => `chore:${id}`;

function choreFields(chore) {
  return { title: chore.name, icon: chore.icon || '', category: chore.category || '' };
}

function dates(d) {
  return { due_date: d.dueDate, window_start: d.windowStart, overdue_after: d.overdueAfter };
}

/** Insert or update the single active execution for a chore. */
function upsertChoreActive(db, chore, d) {
  const existing = activeFor(db, choreKey(chore.id));
  const fields = { ...choreFields(chore), ...dates(d) };
  if (existing) {
    db.prepare(`UPDATE executions SET title=@title, icon=@icon, category=@category, due_date=@due_date,
      window_start=@window_start, overdue_after=@overdue_after WHERE id=@id`).run({ ...fields, id: existing.id });
    return getExecution(db, existing.id);
  }
  return insertExecution(db, {
    source_type: 'chore', source_key: choreKey(chore.id), chore_id: chore.id, ...fields,
  });
}

export function createForChore(db, chore, today) {
  return tx(db, () => upsertChoreActive(db, chore, firstDue(chore, today)));
}

/** After editing a chore: recompute its single active execution. */
export function refreshForChore(db, chore, today) {
  return tx(db, () => {
    const last = db.prepare(`SELECT done_date, due_date FROM executions WHERE source_key = ? AND status = 'done'
      ORDER BY done_date DESC, id DESC LIMIT 1`).get(choreKey(chore.id));
    const d = last
      ? nextDue(chore, { doneDate: last.done_date, dueDate: last.due_date, today })
      : firstDue(chore, today);
    if (!d) {
      db.prepare("DELETE FROM executions WHERE source_key = ? AND status = 'active'").run(choreKey(chore.id));
      return null;
    }
    return upsertChoreActive(db, chore, d);
  });
}

function successorOf(db, ex, today) {
  if (ex.source_type === 'chore') {
    const chore = db.prepare('SELECT * FROM chores WHERE id = ?').get(ex.chore_id);
    if (!chore) return null;
    const d = nextDue(chore, { doneDate: today, dueDate: ex.due_date, today });
    return d && {
      source_type: 'chore', source_key: ex.source_key, chore_id: chore.id, ...choreFields(chore), ...dates(d),
    };
  }
  if (ex.source_type === 'calendar' && ex.rrule) {
    const from = addDays(ex.due_date, 1) > today ? addDays(ex.due_date, 1) : today;
    const next = nextOccurrence({
      start_date: ex.series_start || ex.due_date, rrule: ex.rrule, exdates: ex.exdates,
    }, from);
    if (!next) return null;
    const copy = Object.fromEntries(COLS.map((c) => [c, ex[c]]));
    return { ...copy, due_date: next, window_start: null, overdue_after: null, status: 'active', done_date: null, done_at: null };
  }
  return null;
}

/** Mark an active execution done and generate its successor. Returns { done, next }. */
export function complete(db, id, today, doneAt = new Date().toISOString()) {
  return tx(db, () => {
    const ex = getExecution(db, id);
    if (!ex) throw new ExecError(404, 'not found');
    if (ex.status !== 'active') throw new ExecError(409, 'already done');
    db.prepare("UPDATE executions SET status='done', done_date=?, done_at=? WHERE id=?").run(today, doneAt, id);
    const succ = successorOf(db, ex, today);
    const next = succ ? insertExecution(db, succ) : null;
    return { done: getExecution(db, id), next };
  });
}

/** Undo a done execution: drop the active one of the same source and reactivate this one. */
export function undo(db, id) {
  return tx(db, () => {
    const ex = getExecution(db, id);
    if (!ex) throw new ExecError(404, 'not found');
    if (ex.status !== 'done') throw new ExecError(409, 'not done');
    if (ex.source_key) {
      const latest = db.prepare(`SELECT id FROM executions WHERE source_key = ? AND status = 'done'
        ORDER BY done_date DESC, id DESC LIMIT 1`).get(ex.source_key);
      if (latest.id !== id) throw new ExecError(409, 'only the latest completion can be undone');
      db.prepare("DELETE FROM executions WHERE source_key = ? AND status = 'active'").run(ex.source_key);
    }
    db.prepare("UPDATE executions SET status='active', done_date=NULL, done_at=NULL WHERE id=?").run(id);
    if (ex.chore_id) {
      const chore = db.prepare('SELECT * FROM chores WHERE id = ?').get(ex.chore_id);
      if (chore) {
        db.prepare('UPDATE executions SET title=@title, icon=@icon, category=@category WHERE id=@id')
          .run({ ...choreFields(chore), id });
      }
    }
    return getExecution(db, id);
  });
}

/** Active executions up to `to` (overdue ones always included) plus those done on `today`. */
export function listExecutions(db, { from, to, today }) {
  const active = db.prepare(`SELECT * FROM executions WHERE status = 'active'
    AND COALESCE(window_start, due_date) <= @to AND due_date >= @from
    ORDER BY due_date, CASE WHEN start_time IS NULL THEN 0 ELSE 1 END, start_time, id`)
    .all({ to: to || today, from: from || '0000-00-00' });
  const done = db.prepare("SELECT * FROM executions WHERE status = 'done' AND done_date = ? ORDER BY done_at, id").all(today);
  return [...active, ...done].map((r) => presentExecution(r, today));
}

/** Done executions of a month, newest first, flagged with whether Undo is allowed. */
export function historyForMonth(db, month) {
  return db.prepare(`SELECT e.*, (e.source_key IS NULL OR e.id = (
      SELECT d.id FROM executions d WHERE d.source_key = e.source_key AND d.status = 'done'
      ORDER BY d.done_date DESC, d.id DESC LIMIT 1)) AS can_undo
    FROM executions e WHERE e.status = 'done' AND substr(e.done_date, 1, 7) = ?
    ORDER BY e.done_date DESC, e.id DESC`).all(month);
}

/** Done chore executions in the legacy completions shape used by motivation.js. */
export function legacyCompletions(db) {
  return db.prepare(`SELECT id, chore_id, done_date, done_at FROM executions
    WHERE status = 'done' AND source_type = 'chore' AND chore_id IS NOT NULL`).all();
}

/**
 * Upserts calendar events as executions: one active execution per event UID, dated at its next
 * occurrence >= today. An occurrence that is already done is never recreated. Returns the touched count.
 * Events: { title, notes, start_date, start_time, end_time, is_all_day, location, external_uid, rrule, exdates }.
 */
export function syncCalendarExecutions(db, events, today) {
  return tx(db, () => {
    let count = 0;
    for (const ev of events) {
      const due = nextOccurrence(ev, today);
      if (!due) continue;
      const key = ev.external_uid ? `cal:${ev.external_uid}` : null;
      const fields = {
        title: ev.title, notes: ev.notes || '', due_date: due, start_time: ev.start_time || null,
        end_time: ev.end_time || null, is_all_day: ev.is_all_day ? 1 : 0, location: ev.location || '',
        rrule: ev.rrule || null,
        exdates: Array.isArray(ev.exdates) ? ev.exdates.join(',') : ev.exdates || '',
        series_start: ev.rrule ? ev.start_date : null,
      };
      if (key) {
        const doneSame = db.prepare("SELECT 1 FROM executions WHERE source_key = ? AND status = 'done' AND due_date = ?").get(key, due);
        if (doneSame) continue;
        const existing = activeFor(db, key);
        if (existing) {
          db.prepare(`UPDATE executions SET title=@title, notes=@notes, due_date=@due_date, start_time=@start_time,
            end_time=@end_time, is_all_day=@is_all_day, location=@location, rrule=@rrule, exdates=@exdates,
            series_start=@series_start WHERE id=@id`).run({ ...fields, id: existing.id });
          count++;
          continue;
        }
      }
      insertExecution(db, { ...fields, source_type: 'calendar', source_key: key });
      count++;
    }
    return count;
  });
}
