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
