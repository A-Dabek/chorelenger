import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { localDate } from './schedule.js';
import {
  ExecError, tx, getExecution, insertExecution, presentExecution, createForChore, refreshForChore,
  complete, undo, listExecutions, historyForMonth, legacyCompletions, syncCalendarExecutions,
} from './executions.js';
import { getChallengeForMonth } from './challenges.config.js';
import {
  getSpotlightChoreIds,
  calculateMonthlyExecution,
  calculateRewardStatus,
  evaluateAchievements,
} from './motivation.js';
import { parseIcs, fetchIcsFeed } from './calendar.js';
import {
  verifyPassword, createSession, checkSession, destroySession, createThrottle,
} from './auth.js';

const COOKIE = 'cl_session';
const UNITS = ['day', 'week', 'month'];
const ANCHORS = ['done', 'due'];
export const CATEGORIES = ['cleaning', 'household', 'health', 'misc'];

function validatePlannedItem(body, today) {
  const b = body || {};
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title || title.length > 200) return { error: 'title is required (max 200 chars)' };

  const start_date = /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') ? b.start_date : today;
  const start_time = typeof b.start_time === 'string' && /^\d{2}:\d{2}$/.test(b.start_time.trim()) ? b.start_time.trim() : null;
  const end_time = typeof b.end_time === 'string' && /^\d{2}:\d{2}$/.test(b.end_time.trim()) ? b.end_time.trim() : null;
  const is_all_day = b.is_all_day !== undefined ? (b.is_all_day ? 1 : 0) : (start_time ? 0 : 1);
  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 1000) : '';
  const location = typeof b.location === 'string' ? b.location.trim().slice(0, 200) : '';

  return {
    value: {
      title,
      start_date,
      start_time,
      end_time,
      is_all_day,
      notes,
      location,
    },
  };
}

// Legacy planned-item shape, now backed by calendar/manual executions.
function presentPlanned(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    start_date: row.due_date,
    start_time: row.start_time,
    end_time: row.end_time,
    is_all_day: Boolean(row.is_all_day),
    location: row.location,
    source: row.source_type,
    external_uid: row.source_key && row.source_key.startsWith('cal:') ? row.source_key.slice(4) : null,
    status: row.status === 'done' ? 'completed' : 'pending',
    completed_at: row.done_at,
    rrule: row.rrule,
    exdates: row.exdates,
    recurring: Boolean(row.rrule),
    created_at: row.created_at,
  };
}

function validateChore(body, today) {
  const b = body || {};
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > 120) return { error: 'name is required (max 120 chars)' };
  const category = b.category === undefined || b.category === null || b.category === '' ? 'misc' : b.category;
  if (!CATEGORIES.includes(category)) return { error: `category must be one of: ${CATEGORIES.join(', ')}` };
  const icon = typeof b.icon === 'string' ? b.icon.trim().slice(0, 32) : '';
  const type = b.type;
  const start_date = /^\d{4}-\d{2}-\d{2}$/.test(b.start_date || '') ? b.start_date : today;
  const anchor = b.anchor === undefined || b.anchor === null || b.anchor === '' ? 'done' : b.anchor;
  if (!ANCHORS.includes(anchor)) return { error: 'anchor must be done or due' };
  const out = {
    name, category, icon, type, start_date, anchor,
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
  } else if (type !== 'one_off') {
    return { error: 'type must be interval, flexible, calendar or one_off' };
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

  const lastDoneStmt = db.prepare("SELECT MAX(done_date) AS d, COUNT(*) AS n FROM executions WHERE source_key = ? AND status = 'done'");
  const activeStmt = db.prepare("SELECT * FROM executions WHERE source_key = ? AND status = 'active'");

  // Chore view for the management tab; due dates come from the chore's single active execution.
  function present(chore, t = today()) {
    const key = `chore:${chore.id}`;
    const { d: lastDone, n: totalDone } = lastDoneStmt.get(key);
    const active = activeStmt.get(key);
    const base = { ...chore, lastDone: lastDone || null, doneToday: lastDone === t, totalDone };
    if (chore.type === 'one_off') {
      return {
        ...base, dueDate: null, windowStart: null, overdueAfter: null, daysUntil: 0,
        status: active ? 'due' : 'finished', finished: !active, executionId: active ? active.id : null,
      };
    }
    const e = active ? presentExecution(active, t) : null;
    return {
      ...base,
      dueDate: e ? e.due_date : null,
      windowStart: e ? e.window_start || e.due_date : null,
      overdueAfter: e ? e.overdue_after || e.due_date : null,
      daysUntil: e ? e.daysUntil : 0,
      status: e ? e.status : 'upcoming',
      finished: false,
      executionId: e ? e.id : null,
    };
  }

  function execError(reply, e) {
    if (e instanceof ExecError) return reply.code(e.code).send({ error: e.message });
    throw e;
  }

  app.get('/api/chores', async () => {
    const t = today();
    const rank = { overdue: 0, due: 1, upcoming: 2, finished: 3 };
    return db.prepare('SELECT * FROM chores ORDER BY name').all()
      .map((c) => present(c, t))
      .sort((a, b) => rank[a.status] - rank[b.status] || (a.dueDate || '').localeCompare(b.dueDate || ''));
  });

  app.post('/api/chores', async (req, reply) => {
    const { value, error } = validateChore(req.body, today());
    if (error) return reply.code(400).send({ error });
    const id = tx(db, () => {
      const r = db.prepare(`INSERT INTO chores
        (name, category, icon, type, interval_n, interval_unit, cal_month, cal_day, window_days, start_date, anchor)
        VALUES (@name, @category, @icon, @type, @interval_n, @interval_unit, @cal_month, @cal_day, @window_days, @start_date, @anchor)`).run(value);
      const chore = db.prepare('SELECT * FROM chores WHERE id = ?').get(r.lastInsertRowid);
      createForChore(db, chore, today());
      return chore.id;
    });
    reply.code(201);
    return present(db.prepare('SELECT * FROM chores WHERE id = ?').get(id));
  });

  const getChore = (id) => db.prepare('SELECT * FROM chores WHERE id = ?').get(id);

  app.put('/api/chores/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getChore(id)) return reply.code(404).send({ error: 'not found' });
    const { value, error } = validateChore(req.body, today());
    if (error) return reply.code(400).send({ error });
    tx(db, () => {
      db.prepare(`UPDATE chores SET name=@name, category=@category, icon=@icon, type=@type, interval_n=@interval_n,
        interval_unit=@interval_unit, cal_month=@cal_month, cal_day=@cal_day, window_days=@window_days,
        start_date=@start_date, anchor=@anchor WHERE id=@id`).run({ ...value, id });
      refreshForChore(db, getChore(id), today());
    });
    return present(getChore(id));
  });

  app.delete('/api/chores/:id', async (req, reply) => {
    const r = db.prepare('DELETE FROM chores WHERE id = ?').run(Number(req.params.id));
    if (!r.changes) return reply.code(404).send({ error: 'not found' });
    return { ok: true };
  });

  // ----- Executions -----
  app.get('/api/executions', async (req, reply) => {
    const { from, to } = req.query || {};
    const isDate = (v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!isDate(from) || !isDate(to)) return reply.code(400).send({ error: 'from/to must be YYYY-MM-DD' });
    return listExecutions(db, { from, to, today: today() });
  });

  app.post('/api/executions/:id/done', async (req, reply) => {
    try {
      const t = today();
      const { done, next } = complete(db, Number(req.params.id), t);
      return { done: presentExecution(done, t), next: presentExecution(next, t) };
    } catch (e) { return execError(reply, e); }
  });

  app.post('/api/executions/:id/undo', async (req, reply) => {
    try {
      return { restored: presentExecution(undo(db, Number(req.params.id)), today()) };
    } catch (e) { return execError(reply, e); }
  });

  app.post('/api/executions', async (req, reply) => {
    const { value, error } = validatePlannedItem(req.body, today());
    if (error) return reply.code(400).send({ error });
    const { start_date, ...rest } = value;
    reply.code(201);
    return presentExecution(insertExecution(db, { ...rest, source_type: 'manual', due_date: start_date }), today());
  });

  app.put('/api/executions/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const ex = getExecution(db, id);
    if (!ex) return reply.code(404).send({ error: 'not found' });
    if (ex.source_type === 'chore') return reply.code(400).send({ error: 'edit the chore instead' });
    const { value, error } = validatePlannedItem(req.body, today());
    if (error) return reply.code(400).send({ error });
    const { start_date, ...rest } = value;
    db.prepare(`UPDATE executions SET title=@title, notes=@notes, due_date=@due_date, start_time=@start_time,
      end_time=@end_time, is_all_day=@is_all_day, location=@location WHERE id=@id`).run({ ...rest, due_date: start_date, id });
    return presentExecution(getExecution(db, id), today());
  });

  app.delete('/api/executions/:id', async (req, reply) => {
    const ex = getExecution(db, Number(req.params.id));
    if (!ex) return reply.code(404).send({ error: 'not found' });
    if (ex.source_type === 'chore') return reply.code(400).send({ error: 'delete the chore instead' });
    db.prepare('DELETE FROM executions WHERE id = ?').run(ex.id);
    return { ok: true };
  });

  // Legacy aliases kept for the existing UI: one tap = done, DELETE completion = undo.
  app.post('/api/chores/:id/done', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getChore(id)) return reply.code(404).send({ error: 'not found' });
    const active = activeStmt.get(`chore:${id}`);
    if (!active) return reply.code(409).send({ error: 'nothing to do' });
    const { done } = complete(db, active.id, today());
    return { completionId: done.id, executionId: done.id, chore: present(getChore(id)) };
  });

  app.delete('/api/completions/:id', async (req, reply) => {
    const row = getExecution(db, Number(req.params.id));
    if (!row || row.status !== 'done' || !row.chore_id) return reply.code(404).send({ error: 'not found' });
    try {
      undo(db, row.id);
    } catch (e) { return execError(reply, e); }
    return present(getChore(row.chore_id));
  });

  // Done executions for a month: /api/history?month=YYYY-MM
  app.get('/api/history', async (req, reply) => {
    const month = req.query.month || today().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return reply.code(400).send({ error: 'month must be YYYY-MM' });
    const rows = historyForMonth(db, month).map((e) => ({
      completionId: e.id,
      executionId: e.id,
      choreId: e.chore_id,
      sourceType: e.source_type,
      name: e.title,
      icon: e.icon,
      category: e.category,
      date: e.done_date,
      canUndo: Boolean(e.can_undo),
    }));
    return { month, total: rows.length, completions: rows };
  });

  // Current challenge, spotlighted chores and extra button counts
  app.get('/api/challenge/current', async (req) => {
    const m = req.query.month || today().slice(0, 7);
    const challenge = getChallengeForMonth(m);
    const chores = db.prepare('SELECT * FROM chores').all();
    const spotlightChoreIds = getSpotlightChoreIds(chores, challenge);

    const rows = db.prepare('SELECT extra_id, COUNT(*) AS count FROM extra_completions WHERE month = ? GROUP BY extra_id').all(m);
    const extraCounts = {};
    let totalExtras = 0;
    for (const r of rows) {
      extraCounts[r.extra_id] = r.count;
      totalExtras += r.count;
    }

    return {
      month: m,
      challenge,
      spotlightChoreIds,
      extraCounts,
      totalExtras,
      extraGoalMet: totalExtras >= challenge.extraGoal,
    };
  });

  // Single-tap logging of an extra button completion
  app.post('/api/challenge/extra', async (req, reply) => {
    const extraId = req.body && typeof req.body.extra_id === 'string' ? req.body.extra_id.trim() : '';
    if (!extraId) return reply.code(400).send({ error: 'extra_id is required' });
    const m = req.body && typeof req.body.month === 'string' && /^\d{4}-\d{2}$/.test(req.body.month)
      ? req.body.month
      : today().slice(0, 7);
    const dDate = today();
    const r = db.prepare('INSERT INTO extra_completions (month, extra_id, done_date) VALUES (?, ?, ?)').run(m, extraId, dDate);
    const count = db.prepare('SELECT COUNT(*) AS n FROM extra_completions WHERE month = ? AND extra_id = ?').get(m, extraId).n;
    return {
      completionId: Number(r.lastInsertRowid),
      extra_id: extraId,
      totalCount: count,
    };
  });

  // Undo an extra completion
  app.delete('/api/challenge/extra/:id', async (req, reply) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT id FROM extra_completions WHERE id = ?').get(id);
    if (!row) return reply.code(404).send({ error: 'not found' });
    db.prepare('DELETE FROM extra_completions WHERE id = ?').run(id);
    return { ok: true };
  });

  // Motivation metrics: reward qualification and achievements
  app.get('/api/motivation', async (req, reply) => {
    const m = req.query.month || today().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return reply.code(400).send({ error: 'month must be YYYY-MM' });
    const challenge = getChallengeForMonth(m);
    const chores = db.prepare('SELECT * FROM chores').all();
    const completions = legacyCompletions(db);
    const extraCompletions = db.prepare('SELECT * FROM extra_completions').all();

    const distinctMonthsSet = new Set();
    distinctMonthsSet.add(m);
    for (const c of completions) {
      if (c.done_date) distinctMonthsSet.add(c.done_date.slice(0, 7));
    }
    for (const ch of chores) {
      if (ch.start_date) distinctMonthsSet.add(ch.start_date.slice(0, 7));
    }
    const distinctMonths = Array.from(distinctMonthsSet).sort();
    const monthlyRates = distinctMonths.map((mon) => calculateMonthlyExecution(chores, completions, mon));

    const currentMonthlyExec = calculateMonthlyExecution(chores, completions, m);
    const totalExtrasRow = db.prepare('SELECT COUNT(*) AS n FROM extra_completions WHERE month = ?').get(m);
    const totalExtras = totalExtrasRow ? totalExtrasRow.n : 0;

    const reward = calculateRewardStatus({
      executionRate: currentMonthlyExec.executionRate,
      totalExtras,
      extraGoal: challenge.extraGoal,
    });

    const achievements = evaluateAchievements({
      chores,
      completions,
      extraCompletions,
      monthlyRates,
    });

    return {
      month: m,
      reward,
      monthlyExecution: currentMonthlyExec,
      achievements,
    };
  });

  // Planned items: compatibility layer over calendar/manual executions.
  const getPlanned = (id) => {
    const row = getExecution(db, id);
    return row && row.source_type !== 'chore' ? row : null;
  };

  app.get('/api/planned', async (req) => {
    const { status, from_date, to_date } = req.query || {};
    let query = "SELECT * FROM executions WHERE source_type IN ('calendar','manual')";
    const params = {};
    if (status === 'pending' || status === 'completed') {
      query += ' AND status = @status';
      params.status = status === 'pending' ? 'active' : 'done';
    }
    if (from_date && /^\d{4}-\d{2}-\d{2}$/.test(from_date)) {
      query += ' AND due_date >= @from_date';
      params.from_date = from_date;
    }
    if (to_date && /^\d{4}-\d{2}-\d{2}$/.test(to_date)) {
      query += ' AND due_date <= @to_date';
      params.to_date = to_date;
    }
    query += ' ORDER BY due_date ASC, CASE WHEN start_time IS NULL THEN 0 ELSE 1 END, start_time ASC, id ASC';
    return db.prepare(query).all(params).map(presentPlanned);
  });

  app.post('/api/planned', async (req, reply) => {
    const { value, error } = validatePlannedItem(req.body, today());
    if (error) return reply.code(400).send({ error });
    const { start_date, ...rest } = value;
    reply.code(201);
    return presentPlanned(insertExecution(db, { ...rest, source_type: 'manual', due_date: start_date }));
  });

  app.put('/api/planned/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getPlanned(id)) return reply.code(404).send({ error: 'not found' });
    const { value, error } = validatePlannedItem(req.body, today());
    if (error) return reply.code(400).send({ error });
    const { start_date, ...rest } = value;
    db.prepare(`UPDATE executions SET title=@title, notes=@notes, due_date=@due_date, start_time=@start_time,
      end_time=@end_time, is_all_day=@is_all_day, location=@location WHERE id=@id`).run({ ...rest, due_date: start_date, id });
    return presentPlanned(getExecution(db, id));
  });

  app.delete('/api/planned/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getPlanned(id)) return reply.code(404).send({ error: 'not found' });
    db.prepare('DELETE FROM executions WHERE id = ?').run(id);
    return { ok: true };
  });

  app.post('/api/planned/:id/confirm', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getPlanned(id)) return reply.code(404).send({ error: 'not found' });
    try {
      const { done, next } = complete(db, id, today());
      return { ok: true, item: presentPlanned(done), next: presentPlanned(next) };
    } catch (e) { return execError(reply, e); }
  });

  app.delete('/api/planned/:id/confirm', async (req, reply) => {
    const id = Number(req.params.id);
    if (!getPlanned(id)) return reply.code(404).send({ error: 'not found' });
    try {
      return { ok: true, item: presentPlanned(undo(db, id)) };
    } catch (e) { return execError(reply, e); }
  });

  app.get('/api/settings/calendar', async () => {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'calendar_feed_url'").get();
    return { feedUrl: row ? row.value : '' };
  });

  app.put('/api/settings/calendar', async (req, reply) => {
    const feedUrl = req.body && typeof req.body.feedUrl === 'string' ? req.body.feedUrl.trim() : null;
    if (feedUrl === null) return reply.code(400).send({ error: 'feedUrl must be a string' });
    db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES ('calendar_feed_url', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(feedUrl);
    return { feedUrl };
  });

  app.post('/api/planned/import-ics', async (req, reply) => {
    const ics = req.body && typeof req.body.ics === 'string' ? req.body.ics : '';
    if (!ics.trim()) return reply.code(400).send({ error: 'ics text payload is required' });
    const events = parseIcs(ics);
    const importedCount = syncCalendarExecutions(db, events, today());
    return { ok: true, importedCount, eventsCount: events.length };
  });

  app.post('/api/planned/sync', async (req, reply) => {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'calendar_feed_url'").get();
    const feedUrl = row ? row.value.trim() : '';
    if (!feedUrl) {
      return { synced: false, message: 'No calendar feed URL configured' };
    }

    let icsText = '';
    try {
      icsText = await fetchIcsFeed(feedUrl);
    } catch (err) {
      return reply.code(502).send({ synced: false, error: err.message });
    }

    const events = parseIcs(icsText);
    const syncedCount = syncCalendarExecutions(db, events, today());

    return { ok: true, synced: true, count: syncedCount, eventsCount: events.length };
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
