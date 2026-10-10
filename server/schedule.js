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
