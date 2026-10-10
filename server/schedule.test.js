import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, addMonths, nextDue, firstDue } from './schedule.js';

const base = { interval_n: 1, interval_unit: 'day', window_days: 0, start_date: '2026-01-01' };

test('addMonths clamps end of month', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
});

test('interval: never done is due on start date', () => {
  const s = schedule({ ...base, type: 'interval', start_date: '2026-03-01' }, null, '2026-03-01');
  assert.equal(s.status, 'due');
  assert.equal(schedule({ ...base, type: 'interval', start_date: '2026-03-01' }, null, '2026-03-05').status, 'overdue');
});

test('interval: due N days after last completion', () => {
  const c = { ...base, type: 'interval', interval_n: 2, interval_unit: 'week' };
  assert.equal(schedule(c, '2026-05-01', '2026-05-10').status, 'upcoming');
  assert.equal(schedule(c, '2026-05-01', '2026-05-15').status, 'due');
  assert.equal(schedule(c, '2026-05-01', '2026-05-16').status, 'overdue');
});

test('flexible: window around ideal date', () => {
  const c = { ...base, type: 'flexible', interval_n: 2, interval_unit: 'month', window_days: 10 };
  const last = '2026-01-15'; // ideal 2026-03-15
  assert.equal(schedule(c, last, '2026-03-01').status, 'upcoming');
  assert.equal(schedule(c, last, '2026-03-06').status, 'due');
  assert.equal(schedule(c, last, '2026-03-25').status, 'due');
  assert.equal(schedule(c, last, '2026-03-26').status, 'overdue');
});

test('calendar: annual date', () => {
  const c = { type: 'calendar', cal_month: 6, cal_day: 15, start_date: '2025-01-01' };
  assert.equal(schedule(c, null, '2026-06-14').dueDate, '2025-06-15'); // missed last year -> overdue
  assert.equal(schedule(c, null, '2026-06-14').status, 'overdue');
  const done = schedule(c, '2026-06-01', '2026-06-14');
  assert.equal(done.dueDate, '2026-06-15');
  assert.equal(done.status, 'upcoming');
  assert.equal(schedule(c, '2026-06-15', '2026-06-16').dueDate, '2027-06-15');
  assert.equal(schedule(c, '2026-06-15', '2026-06-15').dueDate, '2027-06-15');
});

test('calendar: start date in future', () => {
  const c = { type: 'calendar', cal_month: 2, cal_day: 29, start_date: '2026-03-01' };
  assert.equal(schedule(c, null, '2026-03-01').dueDate, '2027-02-28');
});

test('one_off: open is due with no dates, done is finished', () => {
  const c = { type: 'one_off', start_date: '2026-03-01' };
  const open = schedule(c, null, '2026-09-01');
  assert.equal(open.status, 'due');
  assert.equal(open.dueDate, null);
  assert.equal(open.daysUntil, 0);
  assert.equal(schedule(c, '2026-09-01', '2026-09-02').status, 'finished');
});

test('firstDue: start_date or today, calendar next occurrence, one_off today', () => {
  const iv = { ...base, type: 'interval', start_date: '2026-03-01' };
  assert.equal(firstDue(iv, '2026-03-05').dueDate, '2026-03-05');
  assert.equal(firstDue(iv, '2026-02-01').dueDate, '2026-03-01');
  const fl = { ...base, type: 'flexible', window_days: 3, start_date: '2026-03-10' };
  const f = firstDue(fl, '2026-03-01');
  assert.deepEqual(f, { dueDate: '2026-03-10', windowStart: '2026-03-07', overdueAfter: '2026-03-13' });
  const cal = { type: 'calendar', cal_month: 4, cal_day: 1, start_date: '2026-01-01' };
  assert.equal(firstDue(cal, '2026-03-05').dueDate, '2026-04-01');
  assert.equal(firstDue(cal, '2026-04-02').dueDate, '2027-04-01');
  assert.equal(firstDue({ type: 'one_off', start_date: '2026-01-01' }, '2026-03-05').dueDate, '2026-03-05');
});

test('nextDue: anchor done adds interval to the done date', () => {
  const c = { ...base, type: 'interval', interval_n: 1, interval_unit: 'month', anchor: 'done' };
  assert.equal(nextDue(c, { doneDate: '2026-02-10', dueDate: '2026-01-31', today: '2026-02-10' }).dueDate, '2026-03-10');
  assert.equal(nextDue({ ...c, anchor: undefined }, { doneDate: '2026-02-10', dueDate: '2026-01-31', today: '2026-02-10' }).dueDate, '2026-03-10');
});

test('nextDue: anchor due keeps cadence and skips past dates; month-end clamps', () => {
  const c = { ...base, type: 'interval', interval_n: 1, interval_unit: 'month', anchor: 'due' };
  assert.equal(nextDue(c, { doneDate: '2026-02-10', dueDate: '2026-01-31', today: '2026-02-10' }).dueDate, '2026-02-28');
  assert.equal(nextDue(c, { doneDate: '2026-05-20', dueDate: '2026-01-31', today: '2026-05-20' }).dueDate, '2026-05-31');
  const w = { ...base, type: 'interval', interval_n: 1, interval_unit: 'week', anchor: 'due' };
  assert.equal(nextDue(w, { doneDate: '2026-01-02', dueDate: '2026-01-01', today: '2026-01-02' }).dueDate, '2026-01-08');
});

test('nextDue: flexible keeps window; calendar goes to next year; one_off ends', () => {
  const f = { ...base, type: 'flexible', window_days: 2, interval_n: 10, interval_unit: 'day' };
  assert.deepEqual(nextDue(f, { doneDate: '2026-01-01', dueDate: '2026-01-01', today: '2026-01-01' }),
    { dueDate: '2026-01-11', windowStart: '2026-01-09', overdueAfter: '2026-01-13' });
  const cal = { type: 'calendar', cal_month: 4, cal_day: 1, start_date: '2026-01-01' };
  assert.equal(nextDue(cal, { doneDate: '2026-03-20', dueDate: '2026-04-01', today: '2026-03-20' }).dueDate, '2027-04-01');
  assert.equal(nextDue(cal, { doneDate: '2029-03-20', dueDate: '2026-04-01', today: '2029-03-20' }).dueDate, '2029-04-01');
  assert.equal(nextDue({ type: 'one_off' }, { doneDate: '2026-01-01', dueDate: '2026-01-01', today: '2026-01-01' }), null);
});
