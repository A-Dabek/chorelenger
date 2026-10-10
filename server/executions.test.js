import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.js';
import { buildApp } from './app.js';
import { hashPassword } from './auth.js';

function setup(date = new Date(2026, 5, 10, 12)) {
  const db = openDb(':memory:');
  const clock = { date };
  const app = buildApp({ db, passwordHash: hashPassword('hunter2hunter2'), now: () => clock.date });
  return { app, db, clock };
}
async function login(app) {
  const r = await app.inject({ method: 'POST', url: '/api/login', payload: { password: 'hunter2hunter2' } });
  return { cl_session: r.cookies[0].value };
}
const call = (app, cookies, method, url, payload) => app.inject({ method, url, cookies, payload });
const activeCount = (db, key) => db.prepare("SELECT COUNT(*) AS n FROM executions WHERE source_key = ? AND status = 'active'").get(key).n;
const weekly = { name: 'Vacuum', type: 'interval', interval_n: 1, interval_unit: 'week', start_date: '2026-06-01' };

test('chore create makes exactly one active execution dated today or later', async () => {
  const { app, db } = setup();
  const cookies = await login(app);
  const c = (await call(app, cookies, 'POST', '/api/chores', weekly)).json();
  assert.equal(activeCount(db, `chore:${c.id}`), 1);
  const future = (await call(app, cookies, 'POST', '/api/chores', { ...weekly, start_date: '2026-06-20' })).json();
  assert.equal(future.dueDate, '2026-06-20');
  assert.equal(future.status, 'upcoming');
  const once = (await call(app, cookies, 'POST', '/api/chores', { name: 'Once', type: 'one_off' })).json();
  const list = (await call(app, cookies, 'GET', '/api/executions')).json();
  assert.equal(list.find((e) => e.chore_id === once.id).due_date, '2026-06-10');
  assert.equal(list.find((e) => e.chore_id === c.id).status, 'due');
});

test('done generates the successor; undo replaces it; always one active', async () => {
  const { app, db } = setup();
  const cookies = await login(app);
  const c = (await call(app, cookies, 'POST', '/api/chores', weekly)).json();
  const first = db.prepare("SELECT id FROM executions WHERE source_key = ?").get(`chore:${c.id}`).id;
  const r = (await call(app, cookies, 'POST', `/api/executions/${first}/done`)).json();
  assert.equal(r.done.execStatus, 'done');
  assert.equal(r.done.done_date, '2026-06-10');
  assert.equal(r.next.due_date, '2026-06-17');
  assert.equal(activeCount(db, `chore:${c.id}`), 1);
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${first}/done`)).statusCode, 409);

  const u = await call(app, cookies, 'POST', `/api/executions/${first}/undo`);
  assert.equal(u.json().restored.execStatus, 'active');
  assert.equal(activeCount(db, `chore:${c.id}`), 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM executions WHERE chore_id = ?').get(c.id).n, 1);
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${first}/undo`)).statusCode, 409);
});

test('anchor due keeps cadence, anchor done shifts it', async () => {
  const { app, db } = setup();
  const cookies = await login(app);
  const monthly = { name: 'Rent', type: 'interval', interval_n: 1, interval_unit: 'month', start_date: '2026-06-10' };
  const a = (await call(app, cookies, 'POST', '/api/chores', { ...monthly, anchor: 'due' })).json();
  const b = (await call(app, cookies, 'POST', '/api/chores', { ...monthly, name: 'Filter' })).json();
  assert.equal((await call(app, cookies, 'POST', '/api/chores', { ...monthly, anchor: 'x' })).statusCode, 400);
  const idOf = (c) => db.prepare("SELECT id FROM executions WHERE source_key = ? AND status = 'active'").get(`chore:${c.id}`).id;
  const ea = idOf(a); const eb = idOf(b);
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${ea}/done`)).json().next.due_date, '2026-07-10');
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${eb}/done`)).json().next.due_date, '2026-07-10');
});

test('late done: anchor due vs done differ', async () => {
  const { app, db, clock } = setup();
  const cookies = await login(app);
  const w = { name: 'W', type: 'interval', interval_n: 1, interval_unit: 'week', start_date: '2026-06-10' };
  const a = (await call(app, cookies, 'POST', '/api/chores', { ...w, anchor: 'due' })).json();
  const b = (await call(app, cookies, 'POST', '/api/chores', { ...w, name: 'W2' })).json();
  clock.date = new Date(2026, 5, 13, 12);
  const idOf = (c) => db.prepare("SELECT id FROM executions WHERE source_key = ? AND status = 'active'").get(`chore:${c.id}`).id;
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${idOf(a)}/done`)).json().next.due_date, '2026-06-17');
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${idOf(b)}/done`)).json().next.due_date, '2026-06-20');
});

test('one-off: no successor, undo upserts it back', async () => {
  const { app, db } = setup();
  const cookies = await login(app);
  const c = (await call(app, cookies, 'POST', '/api/chores', { name: 'Once', type: 'one_off' })).json();
  const id = c.executionId;
  const r = (await call(app, cookies, 'POST', `/api/executions/${id}/done`)).json();
  assert.equal(r.next, null);
  assert.equal(activeCount(db, `chore:${c.id}`), 0);
  const chores = (await call(app, cookies, 'GET', '/api/chores')).json();
  assert.equal(chores[0].finished, true);
  await call(app, cookies, 'POST', `/api/executions/${id}/undo`);
  assert.equal(activeCount(db, `chore:${c.id}`), 1);
});

test('undo of a non-latest done execution is rejected (409)', async () => {
  const { app, db, clock } = setup();
  const cookies = await login(app);
  const c = (await call(app, cookies, 'POST', '/api/chores', { name: 'D', type: 'interval', interval_n: 1, interval_unit: 'day', start_date: '2026-06-10' })).json();
  const first = c.executionId;
  const r1 = (await call(app, cookies, 'POST', `/api/executions/${first}/done`)).json();
  clock.date = new Date(2026, 5, 11, 12);
  await call(app, cookies, 'POST', `/api/executions/${r1.next.id}/done`);
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${first}/undo`)).statusCode, 409);
  assert.equal(activeCount(db, `chore:${c.id}`), 1);
});

test('edit chore recomputes the active execution; delete removes executions; history lists done', async () => {
  const { app, db } = setup();
  const cookies = await login(app);
  const c = (await call(app, cookies, 'POST', '/api/chores', weekly)).json();
  const put = (await call(app, cookies, 'PUT', `/api/chores/${c.id}`, { ...weekly, name: 'Mop', start_date: '2026-06-25' })).json();
  assert.equal(put.dueDate, '2026-06-25');
  assert.equal(activeCount(db, `chore:${c.id}`), 1);
  assert.equal(db.prepare('SELECT title FROM executions WHERE chore_id = ?').get(c.id).title, 'Mop');
  await call(app, cookies, 'POST', `/api/executions/${put.executionId}/done`);
  const hist = (await call(app, cookies, 'GET', '/api/history?month=2026-06')).json();
  assert.equal(hist.total, 1);
  assert.equal(hist.completions[0].canUndo, true);
  await call(app, cookies, 'DELETE', `/api/chores/${c.id}`);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM executions').get().n, 0);
});

test('manual executions: create, edit, done (no successor), undo, delete', async () => {
  const { app } = setup();
  const cookies = await login(app);
  const m = (await call(app, cookies, 'POST', '/api/executions', { title: 'Dentist', start_date: '2026-06-12' })).json();
  assert.equal(m.source_type, 'manual');
  assert.equal(m.status, 'upcoming');
  const e = (await call(app, cookies, 'PUT', `/api/executions/${m.id}`, { title: 'Dentist 2', start_date: '2026-06-10' })).json();
  assert.equal(e.title, 'Dentist 2');
  const d = (await call(app, cookies, 'POST', `/api/executions/${m.id}/done`)).json();
  assert.equal(d.next, null);
  const list = (await call(app, cookies, 'GET', '/api/executions')).json();
  assert.equal(list.find((x) => x.id === m.id).status, 'done');
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${m.id}/undo`)).statusCode, 200);
  assert.equal((await call(app, cookies, 'DELETE', `/api/executions/${m.id}`)).statusCode, 200);
});

test('executions list: horizon filters upcoming; auth and JSON required', async () => {
  const { app } = setup();
  const cookies = await login(app);
  assert.equal((await app.inject('/api/executions')).statusCode, 401);
  await call(app, cookies, 'POST', '/api/chores', { ...weekly, start_date: '2026-06-14' });
  await call(app, cookies, 'POST', '/api/chores', { ...weekly, name: 'Far', start_date: '2026-07-20' });
  assert.equal((await call(app, cookies, 'GET', '/api/executions')).json().length, 0);
  assert.equal((await call(app, cookies, 'GET', '/api/executions?to=2026-06-17')).json().length, 1);
  assert.equal((await call(app, cookies, 'GET', '/api/executions?to=2026-07-31')).json().length, 2);
});

const ics = (events) => ['BEGIN:VCALENDAR', ...events.flatMap(([uid, title, start, extra = []]) =>
  ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART;VALUE=DATE:${start}`, ...extra, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const importIcs = (app, cookies, text) => call(app, cookies, 'POST', '/api/planned/import-ics', { ics: text });

test('calendar sync: repeated import never duplicates; done does not recreate the same occurrence', async () => {
  const { app, db, clock } = setup();
  const cookies = await login(app);
  const text = ics([['a@x', 'Standup', '20260601', ['RRULE:FREQ=WEEKLY;BYDAY=MO']], ['b@x', 'Party', '20260612']]);
  await importIcs(app, cookies, text);
  await importIcs(app, cookies, text);
  assert.equal(activeCount(db, 'cal:a@x'), 1);
  assert.equal(activeCount(db, 'cal:b@x'), 1);
  const standup = db.prepare("SELECT * FROM executions WHERE source_key = 'cal:a@x'").get();
  assert.equal(standup.due_date, '2026-06-15');
  assert.equal(standup.series_start, '2026-06-01');

  const r = (await call(app, cookies, 'POST', `/api/executions/${standup.id}/done`)).json();
  assert.equal(r.next.due_date, '2026-06-22');
  await importIcs(app, cookies, text);
  assert.equal(activeCount(db, 'cal:a@x'), 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM executions WHERE source_key = 'cal:a@x'").get().n, 2);

  // one-off event done: no successor, re-sync does not bring it back
  const party = db.prepare("SELECT id FROM executions WHERE source_key = 'cal:b@x'").get().id;
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${party}/done`)).json().next, null);
  await importIcs(app, cookies, text);
  assert.equal(activeCount(db, 'cal:b@x'), 0);

  // undo of the series execution replaces the successor
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${standup.id}/undo`)).statusCode, 200);
  assert.equal(activeCount(db, 'cal:a@x'), 1);
  assert.equal(db.prepare("SELECT due_date FROM executions WHERE source_key = 'cal:a@x' AND status = 'active'").get().due_date, '2026-06-15');
  assert.ok(clock);
});

test('calendar series that ended: no successor, undo upserts it back', async () => {
  const { app, db } = setup();
  const cookies = await login(app);
  await importIcs(app, cookies, ics([['e@x', 'Ends', '20260609', ['RRULE:FREQ=DAILY;COUNT=2']]]));
  const ex = db.prepare("SELECT * FROM executions WHERE source_key = 'cal:e@x'").get();
  assert.equal(ex.due_date, '2026-06-10');
  assert.equal((await call(app, cookies, 'POST', `/api/executions/${ex.id}/done`)).json().next, null);
  assert.equal(activeCount(db, 'cal:e@x'), 0);
  await call(app, cookies, 'POST', `/api/executions/${ex.id}/undo`);
  assert.equal(activeCount(db, 'cal:e@x'), 1);
});
