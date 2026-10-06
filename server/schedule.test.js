import test from 'node:test';
import assert from 'node:assert/strict';
import { schedule, addMonths } from './schedule.js';

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
