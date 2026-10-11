// Buckets execution rows into the three Today-screen bands.
// Pure: no DOM or fetch, so it can be unit-tested with node:test.
export const BANDS = ['today', 'week', 'month'];

/** 'today' = actionable now (overdue, due, done today, or due on/before today); 'week' = days 1-7; 'month' = days 8-31. */
export function bandOf(e) {
  if (e.status !== 'upcoming' || e.daysUntil <= 0) return 'today';
  if (e.daysUntil <= 7) return 'week';
  return 'month';
}

/** Splits rows into { today, week, month } arrays, preserving input order. */
export function splitBands(rows) {
  const out = { today: [], week: [], month: [] };
  for (const e of rows) out[bandOf(e)].push(e);
  return out;
}
