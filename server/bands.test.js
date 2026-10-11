import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bandOf, splitBands } from '../web/src/lib/bands.js';

const row = (status, daysUntil, extra = {}) => ({ status, daysUntil, ...extra });

test('bandOf: overdue, due and done are always today', () => {
  assert.equal(bandOf(row('overdue', -3)), 'today');
  assert.equal(bandOf(row('due', 0)), 'today');
  assert.equal(bandOf(row('due', -2)), 'today');
  assert.equal(bandOf(row('done', 0)), 'today');
});

test('bandOf: upcoming boundaries — 1..7 days is week, 8..31 is month', () => {
  assert.equal(bandOf(row('upcoming', 1)), 'week');
  assert.equal(bandOf(row('upcoming', 7)), 'week');
  assert.equal(bandOf(row('upcoming', 8)), 'month');
  assert.equal(bandOf(row('upcoming', 31)), 'month');
});

test('splitBands keeps order within each band', () => {
  const a = row('upcoming', 2, { id: 'a' });
  const b = row('upcoming', 20, { id: 'b' });
  const c = row('upcoming', 5, { id: 'c' });
  const d = row('due', 0, { id: 'd' });
  const out = splitBands([a, b, c, d]);
  assert.deepEqual(out.today.map((x) => x.id), ['d']);
  assert.deepEqual(out.week.map((x) => x.id), ['a', 'c']);
  assert.deepEqual(out.month.map((x) => x.id), ['b']);
});
