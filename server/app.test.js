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
  assert.equal(chore.status, 'overdue');

  const done = (await app.inject({ method: 'POST', url: `/api/chores/${chore.id}/done`, cookies })).json();
  assert.equal(done.chore.status, 'upcoming');
  assert.equal(done.chore.dueDate, '2026-06-17');
  assert.equal(done.chore.doneToday, true);

  const hist = (await app.inject({ url: '/api/history?month=2026-06', cookies })).json();
  assert.equal(hist.total, 1);

  const undone = (await app.inject({ method: 'DELETE', url: `/api/completions/${done.completionId}`, cookies })).json();
  assert.equal(undone.status, 'overdue');

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
    payload: { name: 'Bike maintenance', category: 'bike', type: 'interval', interval_n: 1, interval_unit: 'week', start_date: '2026-06-01' }
  })).json();

  const c2 = (await app.inject({
    method: 'POST',
    url: '/api/chores',
    cookies,
    payload: { name: 'Dust bookshelf', category: 'home', type: 'interval', interval_n: 1, interval_unit: 'month', start_date: '2026-06-01' }
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
  assert.equal(plannedList[0].source, 'ics_import');
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
