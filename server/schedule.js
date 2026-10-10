// Pure date/recurrence logic. All dates are 'YYYY-MM-DD' strings (local calendar days).

const DAY = 86400000;

const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);

export const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY);
export const addDays = (s, n) => fmt(parse(s) + n * DAY);

export function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return clampDate(Math.floor(total / 12), (total % 12) + 1, d);
}

function clampDate(y, m, d) {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return fmt(Date.UTC(y, m - 1, Math.min(d, last)));
}

export function localDate(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addInterval(s, n, unit) {
  if (unit === 'day') return addDays(s, n);
  if (unit === 'week') return addDays(s, n * 7);
  if (unit === 'month') return addMonths(s, n);
  throw new Error(`bad unit ${unit}`);
}

/**
 * chore: { type: 'interval'|'flexible'|'calendar'|'one_off', interval_n, interval_unit,
 *          cal_month, cal_day, window_days, start_date }
 * lastDone: 'YYYY-MM-DD' | null
 * Returns { dueDate, windowStart, overdueAfter, status: 'overdue'|'due'|'upcoming'|'finished', daysUntil }
 * (one_off: dates are null; finished once it has any completion)
 */
export function schedule(chore, lastDone, today) {
  if (chore.type === 'one_off') {
    // No recurrence, no due date: open ('due') until it has been done once, then finished for good.
    return {
      dueDate: null, windowStart: null, overdueAfter: null, daysUntil: 0,
      status: lastDone ? 'finished' : 'due',
    };
  }
  let dueDate;
  let windowStart;
  let overdueAfter;

  if (chore.type === 'calendar') {
    const occ = (y) => clampDate(y, chore.cal_month, chore.cal_day);
    const year = Number(today.slice(0, 4));
    let o = occ(year) <= today ? occ(year) : occ(year - 1);
    if (o < chore.start_date) {
      o = occ(Number(chore.start_date.slice(0, 4)));
      if (o < chore.start_date) o = occ(Number(chore.start_date.slice(0, 4)) + 1);
    }
    const coveredByLast = lastDone && diffDays(o, lastDone) < 30;
    dueDate = coveredByLast ? occ(Number(o.slice(0, 4)) + 1) : o;
    windowStart = dueDate;
    overdueAfter = dueDate;
  } else {
    dueDate = lastDone
      ? addInterval(lastDone, chore.interval_n, chore.interval_unit)
      : chore.start_date;
    const w = chore.type === 'flexible' ? chore.window_days || 0 : 0;
    windowStart = addDays(dueDate, -w);
    overdueAfter = addDays(dueDate, w);
  }

  let status = 'upcoming';
  if (today > overdueAfter) status = 'overdue';
  else if (today >= windowStart) status = 'due';

  return { dueDate, windowStart, overdueAfter, status, daysUntil: diffDays(dueDate, today) };
}

const windowOf = (chore) => (chore.type === 'flexible' ? chore.window_days || 0 : 0);

function withWindow(chore, dueDate) {
  const w = windowOf(chore);
  return { dueDate, windowStart: addDays(dueDate, -w), overdueAfter: addDays(dueDate, w) };
}

function calendarOccurrence(chore, year) {
  return clampDate(year, chore.cal_month, chore.cal_day);
}

/**
 * First execution of a new chore; never earlier than today.
 * interval/flexible: start_date (or today if past); calendar: next occurrence; one_off: today.
 * Returns { dueDate, windowStart, overdueAfter }.
 */
export function firstDue(chore, today) {
  if (chore.type === 'one_off') return withWindow(chore, today);
  if (chore.type === 'calendar') {
    const from = chore.start_date > today ? chore.start_date : today;
    let y = Number(from.slice(0, 4));
    let o = calendarOccurrence(chore, y);
    if (o < from) o = calendarOccurrence(chore, y + 1);
    return withWindow(chore, o);
  }
  return withWindow(chore, chore.start_date > today ? chore.start_date : today);
}

/**
 * Successor of a completed execution, computed at click time.
 * chore.anchor: 'done' (default) = done date + interval; 'due' = previous due date + interval,
 * advanced until it is >= today. Calendar chores: next annual date. one_off: null.
 * Returns { dueDate, windowStart, overdueAfter } | null.
 */
export function nextDue(chore, { doneDate, dueDate, today }) {
  if (chore.type === 'one_off') return null;
  if (chore.type === 'calendar') {
    let y = Number(dueDate.slice(0, 4)) + 1;
    let o = calendarOccurrence(chore, y);
    while (o < today) o = calendarOccurrence(chore, ++y);
    return withWindow(chore, o);
  }
  if (chore.anchor === 'due') {
    let d = addInterval(dueDate, chore.interval_n, chore.interval_unit);
    let k = 1;
    while (d < today) d = addInterval(dueDate, chore.interval_n * ++k, chore.interval_unit);
    return withWindow(chore, d);
  }
  return withWindow(chore, addInterval(doneDate, chore.interval_n, chore.interval_unit));
}
