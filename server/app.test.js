import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { hashPassword } from './auth.js';

function setup() {
  return buildApp({
    db: openDb(':memory:'),
    passwordHash: hashPassword('hunter2hunter2'),
    now: () => new Date(2026, 5, 10, 12),
  });
}
const login = async (app) => {
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'hunter2hunter2' } });
  return { cookies: { cl_session: r.cookies[0].value }, res: r };
};

test('requires auth, rejects wrong password', async () => {
  const app = setup();
  assert.equal((await app.inject('/api/chores')).statusCode, 401);
  const bad = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'nope' } });
  assert.equal(bad.statusCode, 401);
});

test('throttles repeated bad logins', async () => {
  const app = setup();
  for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'x' } });
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'hunter2hunter2' } });
  assert.equal(r.statusCode, 429);
});

test('chore lifecycle: create, due, done, undo, delete', async () => {
  const app = setup();
  const { cookies } = await login(app);
  const create = await app.inject({ method: 'POST', url: '/api/chores', cookies,
    payload: { name: 'Vacuum', type: 'interval', interval_n: 1, interval_unit: 'week', start_date: '2026-06-01' } });
  assert.equal(create.statusCode, 201);
  const chore = create.json();
  assert.equal(chore.status, 'due'); // new chores are dated today or later, never in the past
  assert.equal(chore.dueDate, '2026-06-10');

  const done = (await app.inject({ method: 'POST', url: `/api/chores/${chore.id}/done`, cookies })).json();
  assert.equal(done.chore.status, 'upcoming');
  assert.equal(done.chore.dueDate, '2026-06-17');
  assert.equal(done.chore.doneToday, true);

  const hist = (await app.inject({ url: '/api/history?month=2026-06', cookies })).json();
  assert.equal(hist.total, 1);

  const undone = (await app.inject({ method: 'DELETE', url: `/api/completions/${done.completionId}`, cookies })).json();
  assert.equal(undone.status, 'due');
  assert.equal(undone.dueDate, '2026-06-10');

  assert.equal((await app.inject({ method: 'DELETE', url: `/api/chores/${chore.id}`, cookies })).statusCode, 200);
  assert.equal((await app.inject({ url: '/api/chores', cookies })).json().length, 0);
});

test('validation errors', async () => {
  const app = setup();
  const { cookies } = await login(app);
  const r = await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: { name: 'x', type: 'interval' } });
  assert.equal(r.statusCode, 400);
});

test('challenge endpoints: current challenge, spotlighting, extra button tap and undo', async () => {
  const app = setup(); // date is 2026-06-10 (Month 6: Movement & Adventure)
  const { cookies } = await login(app);

  // Unauthenticated requests are rejected
  assert.equal((await app.inject('/api/challenge/current')).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/challenge/extra', payload: { extra_id: 'bike-ride' } })).statusCode, 401);

  // Create a chore that matches June theme (bike) and one that does not
  const c1 = (await app.inject({
    method: 'POST',
    url: '/api/chores',
    cookies,
    payload: { name: 'Bike maintenance', category: 'misc', type: 'interval', interval_n: 1, interval_unit: 'week', start_date: '2026-06-01' }
  })).json();

  const c2 = (await app.inject({
    method: 'POST',
    url: '/api/chores',
    cookies,
    payload: { name: 'Dust bookshelf', category: 'household', type: 'interval', interval_n: 1, interval_unit: 'month', start_date: '2026-06-01' }
  })).json();

  const curr = (await app.inject({ url: '/api/challenge/current', cookies })).json();
  assert.equal(curr.month, '2026-06');
  assert.equal(curr.challenge.id, 'movement-adventure');
  assert.deepEqual(curr.spotlightChoreIds, [c1.id]);
  assert.equal(curr.totalExtras, 0);

  // Log an extra button tap
  const tap1 = (await app.inject({
    method: 'POST',
    url: '/api/challenge/extra',
    cookies,
    payload: { extra_id: 'bike-ride' }
  })).json();
  assert.equal(tap1.extra_id, 'bike-ride');
  assert.equal(tap1.totalCount, 1);
  assert.ok(tap1.completionId > 0);

  // Log a second tap
  const tap2 = (await app.inject({
    method: 'POST',
    url: '/api/challenge/extra',
    cookies,
    payload: { extra_id: 'bike-ride' }
  })).json();
  assert.equal(tap2.totalCount, 2);

  const currAfter = (await app.inject({ url: '/api/challenge/current', cookies })).json();
  assert.equal(currAfter.totalExtras, 2);
  assert.equal(currAfter.extraCounts['bike-ride'], 2);

  // Undo tap2
  const undo = (await app.inject({
    method: 'DELETE',
    url: `/api/challenge/extra/${tap2.completionId}`,
    cookies
  })).json();
  assert.equal(undo.ok, true);

  const currAfterUndo = (await app.inject({ url: '/api/challenge/current', cookies })).json();
  assert.equal(currAfterUndo.totalExtras, 1);
  assert.equal(currAfterUndo.extraCounts['bike-ride'], 1);
});

test('motivation endpoint returns execution rate, reward status, and achievements', async () => {
  const app = setup();
  const { cookies } = await login(app);

  // Unauthenticated requests rejected
  assert.equal((await app.inject('/api/motivation')).statusCode, 401);

  // Add chore
  const chore = (await app.inject({
    method: 'POST',
    url: '/api/chores',
    cookies,
    payload: { name: 'Daily Meditation', category: 'health', type: 'interval', interval_n: 1, interval_unit: 'month', start_date: '2026-06-01' }
  })).json();

  // Mark done
  await app.inject({ method: 'POST', url: `/api/chores/${chore.id}/done`, cookies });

  const mot = (await app.inject({ url: '/api/motivation?month=2026-06', cookies })).json();
  assert.equal(mot.month, '2026-06');
  assert.equal(mot.reward.executionRate, 1.0);
  assert.equal(mot.reward.baseRewardAchieved, true);
  assert.equal(mot.reward.extraRewardAchieved, false);

  const firstStepAch = mot.achievements.find((a) => a.id === 'first-chore');
  assert.equal(firstStepAch.unlocked, true);
});

test('planned items CRUD, validation, and confirmation lifecycle', async () => {
  const app = setup();
  const { cookies } = await login(app);

  // Unauthenticated requests rejected
  assert.equal((await app.inject('/api/planned')).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: '/api/planned', payload: { title: 'Test' } })).statusCode, 401);

  // Validation error on missing title
  const invalid = await app.inject({ method: 'POST', url: '/api/planned', cookies, payload: { title: '' } });
  assert.equal(invalid.statusCode, 400);

  // Create one-off task
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/planned',
    cookies,
    payload: {
      title: 'Take package to post office',
      notes: 'Bring tracking slip',
      start_date: '2026-06-12',
      start_time: '14:00',
      end_time: '14:30',
      location: 'Central Post Office',
    },
  });
  assert.equal(createRes.statusCode, 201);
  const item = createRes.json();
  assert.equal(item.title, 'Take package to post office');
  assert.equal(item.source, 'manual');
  assert.equal(item.status, 'pending');
  assert.equal(item.is_all_day, false);
  assert.equal(item.completed_at, null);

  // List planned items
  const list = (await app.inject({ url: '/api/planned', cookies })).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, item.id);

  // Update item
  const updateRes = await app.inject({
    method: 'PUT',
    url: `/api/planned/${item.id}`,
    cookies,
    payload: {
      title: 'Take package to post office (Express)',
      start_date: '2026-06-12',
      start_time: '15:00',
    },
  });
  assert.equal(updateRes.statusCode, 200);
  assert.equal(updateRes.json().title, 'Take package to post office (Express)');
  assert.equal(updateRes.json().start_time, '15:00');

  // Confirm item (Done)
  const confirmRes = await app.inject({
    method: 'POST',
    url: `/api/planned/${item.id}/confirm`,
    cookies,
  });
  assert.equal(confirmRes.statusCode, 200);
  assert.equal(confirmRes.json().item.status, 'completed');
  assert.ok(confirmRes.json().item.completed_at);

  // Filter list by status
  const pendingList = (await app.inject({ url: '/api/planned?status=pending', cookies })).json();
  assert.equal(pendingList.length, 0);
  const completedList = (await app.inject({ url: '/api/planned?status=completed', cookies })).json();
  assert.equal(completedList.length, 1);

  // Undo confirmation
  const undoRes = await app.inject({
    method: 'DELETE',
    url: `/api/planned/${item.id}/confirm`,
    cookies,
  });
  assert.equal(undoRes.statusCode, 200);
  assert.equal(undoRes.json().item.status, 'pending');
  assert.equal(undoRes.json().item.completed_at, null);

  // Delete item
  const delRes = await app.inject({
    method: 'DELETE',
    url: `/api/planned/${item.id}`,
    cookies,
  });
  assert.equal(delRes.statusCode, 200);
  assert.equal((await app.inject({ url: '/api/planned', cookies })).json().length, 0);
});

test('calendar settings and sync endpoints', async () => {
  const app = setup();
  const { cookies } = await login(app);

  // Get settings initial
  const initSettings = (await app.inject({ url: '/api/settings/calendar', cookies })).json();
  assert.equal(initSettings.feedUrl, '');

  // Update settings
  const putSettings = await app.inject({
    method: 'PUT',
    url: '/api/settings/calendar',
    cookies,
    payload: { feedUrl: 'https://example.com/calendar.ics' },
  });
  assert.equal(putSettings.statusCode, 200);
  assert.equal(putSettings.json().feedUrl, 'https://example.com/calendar.ics');

  // Import ICS payload
  const icsPayload = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:import-event-1@google.com',
    'SUMMARY:Doctor Appointment',
    'DESCRIPTION:Annual checkup',
    'DTSTART;VALUE=DATE:20260615',
    'LOCATION:City Hospital',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const importRes = await app.inject({
    method: 'POST',
    url: '/api/planned/import-ics',
    cookies,
    payload: { ics: icsPayload },
  });
  assert.equal(importRes.statusCode, 200);
  assert.equal(importRes.json().importedCount, 1);

  const plannedList = (await app.inject({ url: '/api/planned', cookies })).json();
  assert.equal(plannedList.length, 1);
  assert.equal(plannedList[0].title, 'Doctor Appointment');
  assert.equal(plannedList[0].source, 'calendar');
  assert.equal(plannedList[0].external_uid, 'import-event-1@google.com');

  // Idempotent re-import updates rather than duplicates
  const reimportRes = await app.inject({
    method: 'POST',
    url: '/api/planned/import-ics',
    cookies,
    payload: { ics: icsPayload },
  });
  assert.equal(reimportRes.statusCode, 200);
  assert.equal(reimportRes.json().importedCount, 1);
  const afterReimport = (await app.inject({ url: '/api/planned', cookies })).json();
  assert.equal(afterReimport.length, 1);
});

test('sync skips past events and advances recurring series', async () => {
  let clock = new Date(2026, 5, 10, 12); // 2026-06-10
  const app = buildApp({ db: openDb(':memory:'), passwordHash: hashPassword('hunter2hunter2'), now: () => clock });
  const { cookies } = await login(app);
  await app.inject({ method: 'PUT', url: '/api/settings/calendar', cookies, payload: { feedUrl: 'https://example.com/c.ics' } });
  const ev = (uid, title, start, extra = []) => [
    'BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART;VALUE=DATE:${start}`, ...extra, 'END:VEVENT',
  ];
  const body = ['BEGIN:VCALENDAR',
    ...ev('past@x', 'Past', '20260601'),
    ...ev('future@x', 'Future', '20260612'),
    ...ev('series@x', 'Series', '20200101', ['RRULE:FREQ=WEEKLY;BYDAY=MO']),
    ...ev('ended@x', 'Ended', '20200101', ['RRULE:FREQ=DAILY;COUNT=3']),
    'END:VCALENDAR'].join('\r\n');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => body });
  const sync = async () => (await app.inject({ method: 'POST', url: '/api/planned/sync', cookies, payload: {} })).json();
  const list = async (q = '') => (await app.inject({ url: `/api/planned${q}`, cookies })).json();
  try {
    assert.equal((await sync()).count, 2);
    let items = await list('?status=pending');
    assert.deepEqual(items.map((i) => [i.title, i.start_date, i.recurring]), [['Future', '2026-06-12', false], ['Series', '2026-06-15', true]]);

    const series = items.find((i) => i.title === 'Series');
    await app.inject({ method: 'POST', url: `/api/planned/${series.id}/confirm`, cookies });
    // same day re-sync: nothing advances, stays acknowledged
    await sync();
    assert.equal((await list('?status=completed')).length, 1);

    // later: Future is past and untouched, series advances and returns to pending
    clock = new Date(2026, 5, 16, 12);
    assert.equal((await sync()).count, 1);
    items = await list('?status=pending');
    assert.equal(items.length, 2);
    const s2 = items.find((i) => i.title === 'Series');
    assert.equal(s2.start_date, '2026-06-22');
    assert.equal(s2.status, 'pending');
    assert.equal(items.find((i) => i.title === 'Future').start_date, '2026-06-12');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('category: predefined list, default misc, invalid rejected', async () => {
  const app = setup();
  const { cookies } = await login(app);
  const base = { name: 'Cat test', type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-06-01' };
  for (const category of ['cleaning', 'household', 'health', 'misc']) {
    const r = await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: { ...base, category } });
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().category, category);
  }
  const d = await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: base });
  assert.equal(d.json().category, 'misc');
  const bad = await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: { ...base, category: 'dog' } });
  assert.equal(bad.statusCode, 400);
  const put = await app.inject({ method: 'PUT', url: `/api/chores/${d.json().id}`, cookies, payload: { ...base, category: 'bogus' } });
  assert.equal(put.statusCode, 400);
});

test('chore icon: saved, trimmed, limited, defaults to empty', async () => {
  const app = setup();
  const { cookies } = await login(app);
  const base = { name: 'Walk dog', type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-06-01' };
  const a = (await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: { ...base, icon: '  🐕  ' } })).json();
  assert.equal(a.icon, '🐕');
  const b = (await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: base })).json();
  assert.equal(b.icon, '');
  const c = (await app.inject({ method: 'PUT', url: `/api/chores/${b.id}`, cookies, payload: { ...base, icon: 'x'.repeat(100) } })).json();
  assert.equal(c.icon.length, 32);
  const list = (await app.inject({ url: '/api/chores', cookies })).json();
  assert.ok(list.every((x) => typeof x.icon === 'string'));
});

test('one-off chore: create, due, done finishes, undo reopens, history keeps it', async () => {
  const app = setup();
  const { cookies } = await login(app);
  const c = (await app.inject({ method: 'POST', url: '/api/chores', cookies, payload: { name: 'Fix lamp', type: 'one_off', category: 'household' } })).json();
  assert.equal(c.type, 'one_off');
  assert.equal(c.status, 'due');
  assert.equal(c.dueDate, null);
  assert.equal(c.finished, false);
  const done = (await app.inject({ method: 'POST', url: `/api/chores/${c.id}/done`, cookies })).json();
  assert.equal(done.chore.status, 'finished');
  assert.equal(done.chore.finished, true);
  const list = (await app.inject({ url: '/api/chores', cookies })).json();
  assert.equal(list.find((x) => x.id === c.id).status, 'finished');
  const month = '2026-06';
  const hist = (await app.inject({ url: `/api/history?month=${month}`, cookies })).json();
  assert.ok(hist.completions.some((x) => x.choreId === c.id));
  const undone = (await app.inject({ method: 'DELETE', url: `/api/completions/${done.completionId}`, cookies })).json();
  assert.equal(undone.status, 'due');
  assert.equal(undone.finished, false);
});

test('migration: old chores table gains one_off and keeps rows and completions', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const file = join(mkdtempSync(join(tmpdir(), 'cl-mig-')), 'old.db');
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE chores (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL CHECK (type IN ('interval','flexible','calendar')), interval_n INTEGER,
      interval_unit TEXT CHECK (interval_unit IN ('day','week','month')), cal_month INTEGER, cal_day INTEGER,
      window_days INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE completions (id INTEGER PRIMARY KEY, chore_id INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
      done_date TEXT NOT NULL, done_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO chores (id, name, category, type, interval_n, interval_unit, start_date) VALUES (7, 'Old', 'dog', 'interval', 1, 'week', '2026-01-01');
    INSERT INTO completions (chore_id, done_date) VALUES (7, '2026-01-02');
  `);
  old.close();
  const db = openDb(file);
  const chore = db.prepare('SELECT * FROM chores WHERE id = 7').get();
  assert.equal(chore.category, 'dog');
  assert.equal(chore.icon, '');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM completions WHERE chore_id = 7').get().n, 1);
  db.prepare("INSERT INTO chores (name, type, start_date) VALUES ('x', 'one_off', '2026-01-01')").run();
  db.close();
  openDb(file).close();
});
