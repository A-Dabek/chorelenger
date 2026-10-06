import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { schedule, localDate } from './schedule.js';
import {
  verifyPassword, createSession, checkSession, destroySession, createThrottle,
} from './auth.js';

const COOKIE = 'cl_session';
const UNITS = ['day', 'week', 'month'];

function validateChore(body, today) {
  const b = body || {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 120) return { error: 'name is required (max 120 chars)' };
  const category = typeof b.category === 'string' ? b.category.trim().slice(0, 60) : '';
  const type = b.type;
  const start_date = /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') ? b.start_date : today;
  const out = {
    name, category, type, start_date,
    interval_n: null, interval_unit: null, cal_month: null, cal_day: null, window_days: 0,
  };
  if (type === 'interval' || type === 'flexible') {
    if (!Number.isInteger(b.interval_n) || b.interval_n < 1 || b.interval_n > 1000) {
      return { error: 'interval_n must be an integer >= 1' };
    }
    if (!UNITS.includes(b.interval_unit)) return { error: 'interval_unit must be day, week or month' };
    out.interval_n = b.interval_n;
    out.interval_unit = b.interval_unit;
    if (type === 'flexible') {
      const w = b.window_days ?? 0;
      if (!Number.isInteger(w) || w < 0 || w > 365) return { error: 'window_days must be 0-365' };
      out.window_days = w;
    }
  } else if (type === 'calendar') {
    if (!Number.isInteger(b.cal_month) || b.cal_month < 1 || b.cal_month > 12) return { error: 'cal_month must be 1-12' };
    if (!Number.isInteger(b.cal_day) || b.cal_day < 1 || b.cal_day > 31) return { error: 'cal_day must be 1-31' };
    out.cal_month = b.cal_month;
    out.cal_day = b.cal_day;
  } else {
    return { error: 'type must be interval, flexible or calendar' };
  }
  return { value: out };
}

export function buildApp({ db, passwordHash, secureCookies = false, webDir, now = () => new Date(), logger = false }) {
  const app = Fastify({ logger, trustProxy: true });
  const throttle = createThrottle();
  const today = () => localDate(now());

  app.register(cookie);

  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'same-origin');
    const path = req.url.split('?')[0];
    if (!path.startsWith('/api/') || path === '/api/login' || path === '/api/health') return;
    if (!checkSession(db, req.cookies[COOKIE])) {
      return reply.code(401).send({ error: 'unauthorized' });
    }
  });

  // CSRF defence in depth (cookie is SameSite=Strict too): mutations must be JSON.
  app.addHook('preValidation', async (req, reply) => {
    if (req.method !== 'GET' && req.url.startsWith('/api/') && req.body !== undefined &&
        !String(req.headers['content-type'] || '').startsWith('application/json')) {
      return reply.code(415).send({ error: 'json required' });
    }
  });

  app.get('/api/health', async () => ({ ok: true }));

  app.post('/api/login', async (req, reply) => {
    const key = req.ip;
    if (throttle.blocked(key)) return reply.code(429).send({ error: 'too many attempts, try later' });
    const pw = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    if (!verifyPassword(pw, passwordHash)) {
      throttle.fail(key);
      return reply.code(401).send({ error: 'wrong password' });
    }
    throttle.reset(key);
    reply.setCookie(COOKIE, createSession(db), {
      httpOnly: true, sameSite: 'strict', secure: secureCookies, path: '/', maxAge: 30 * 24 * 3600,
    });
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    destroySession(db, req.cookies[COOKIE]);
    reply.clearCookie(COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/api/session', async () => ({ ok: true }));

  const lastDoneStmt = db.prepare('SELECT MAX(done_date) AS d FROM completions WHERE chore_id = ?');
  const countStmt = db.prepare('SELECT COUNT(*) AS n FROM completions WHERE chore_id = ?');

  function present(chore, t = today()) {
    const lastDone = lastDoneStmt.get(chore.id).d || null;
    return {
      ...chore,
      lastDone,
      doneToday: lastDone === t,
      totalDone: countStmt.get(chore.id).n,
      ...schedule(chore, lastDone, t),
    };
  }

  app.get('/api/chores', async () => {
    const t = today();
    const rank = { overdue: 0, due: 1, upcoming: 2 };
    return db.prepare('SELECT * FROM chores ORDER BY name').all()
      .map((c) => present(c, t))
      .sort((a, b) => rank[a.status] - rank[b.status] || a.dueDate.localeCompare(b.dueDate));
  });

  app.post('/api/chores', async (req, reply) => {
    const { value, error } = validateChore(req.body, today());
    if (error) return reply.code(400).send({ error });
    const r = db.prepare(`INSERT INTO chores
      (name, category, type, interval_n, interval_unit, cal_month, cal_day, window_days, start_date)
      VALUES (@name, @category, @type, @interval_n, @interval_unit, @cal_month, @cal_day, @window_days, @start_date)`).run(value);
    reply.code(201);
    return present(db.prepare('SELECT * FROM chores WHERE id = ?').get(r.lastInsertRowid));
  });

  const getChore = (id) => db.prepare('SELECT * FROM chores WHERE id = ?').get(id);

  app.put('/api/chores/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getChore(id)) return reply.code(404).send({ error: 'not found' });
    const { value, error } = validateChore(req.body, today());
    if (error) return reply.code(400).send({ error });
    db.prepare(`UPDATE chores SET name=@name, category=@category, type=@type, interval_n=@interval_n,
      interval_unit=@interval_unit, cal_month=@cal_month, cal_day=@cal_day, window_days=@window_days,
      start_date=@start_date WHERE id=@id`).run({ ...value, id });
    return present(getChore(id));
  });

  app.delete('/api/chores/:id', async (req, reply) => {
    const r = db.prepare('DELETE FROM chores WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  });

  // One tap = done. Returns the updated chore plus the completion id so the UI can offer undo.
  app.post('/api/chores/:id/done', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getChore(id)) return reply.code(404).send({ error: 'not found' });
    const r = db.prepare('INSERT INTO completions (chore_id, done_date) VALUES (?, ?)').run(id, today());
    return { completionId: Number(r.lastInsertRowid), chore: present(getChore(id)) };
  });

  app.delete('/api/completions/:id', async (req, reply) => {
    const row = db.prepare('SELECT chore_id FROM completions WHERE id = ?').get(Number(req.params.id));
    if (!row) return reply.code(404).send({ error: 'not found' });
    db.prepare('DELETE FROM completions WHERE id = ?').run(Number(req.params.id));
    return present(getChore(row.chore_id));
  });

  // Completions per chore for a month: /api/history?month=YYYY-MM
  app.get('/api/history', async (req, reply) => {
    const month = req.query.month || today().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'month must be YYYY-MM' });
    const rows = db.prepare(`SELECT c.id AS completionId, c.chore_id AS choreId, ch.name, ch.category, c.done_date AS date
      FROM completions c JOIN chores ch ON ch.id = c.chore_id
      WHERE substr(c.done_date, 1, 7) = ? ORDER BY c.done_date DESC, c.id DESC`).all(month);
    return { month, total: rows.length, completions: rows };
  });

  if (webDir && existsSync(webDir)) {
    app.register(fastifyStatic, { root: webDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}
