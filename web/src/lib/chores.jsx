import { MONTHS } from './dates.js';

const UNITS = { day: 'day', week: 'week', month: 'month' };

export function describe(c) {
  if (c.type === 'one_off') return 'One-off';
  if (c.type === 'calendar') return `every ${MONTHS[c.cal_month - 1]} ${c.cal_day}`;
  const every = `every ${c.interval_n > 1 ? c.interval_n + ' ' : ''}${UNITS[c.interval_unit]}${c.interval_n > 1 ? 's' : ''}`;
  return c.type === 'flexible' ? `~${every} (±${c.window_days}d)` : every;
}

export function when(c) {
  if (c.status === 'finished') return 'finished';
  if (c.type === 'one_off') return <b>open</b>;
  const d = c.daysUntil;
  if (c.status === 'overdue') return <b>overdue {Math.abs(c.daysUntil)}d</b>;
  if (c.status === 'due') return <b>{d === 0 ? 'due today' : d > 0 ? `window open, ideal in ${d}d` : `due (${-d}d past ideal)`}</b>;
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}

// Due text for an execution row (see GET /api/executions).
export function whenExec(e) {
  if (e.status === 'done') return 'done today';
  const d = e.daysUntil;
  if (e.status === 'overdue') return <b>overdue {Math.abs(d)}d</b>;
  if (e.status === 'due') {
    const flexible = e.window_start && e.window_start !== e.due_date;
    if (!flexible || d === 0) return <b>due today</b>;
    return <b>{d > 0 ? `window open, ideal in ${d}d` : `due (${-d}d past ideal)`}</b>;
  }
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}

export const CATEGORIES = {
  cleaning: { emoji: '🧹', label: 'Cleaning' },
  household: { emoji: '🏠', label: 'Household' },
  health: { emoji: '💪', label: 'Health' },
  misc: { emoji: '📌', label: 'Misc' },
};

export const ICON_SUGGESTIONS = ['🧹', '🧺', '🍳', '🗑️', '🪴', '🐕', '🐈', '🛏️', '🚿', '🪟', '🚗', '🚲', '💊', '💪', '🛒', '💰'];

// Icon is an emoji or `img:<file>` (served from /icons/<file>). Falls back to category emoji, then first letter.
export function choreIcon(c) {
  const icon = (c.icon || '').trim();
  if (icon) return icon;
  const cat = CATEGORIES[(c.category || '').trim()];
  if (cat) return cat.emoji;
  return (c.name || c.title || '?').trim().charAt(0).toUpperCase() || '?';
}

export function CategoryBadge({ category }) {
  if (!category) return null;
  const cat = CATEGORIES[category];
  if (!cat) return <span class="cat-badge cat-legacy">{category}</span>;
  return <span class={`cat-badge cat-${category}`}>{cat.emoji} {cat.label}</span>;
}

export function ChoreIcon({ c }) {
  const icon = choreIcon(c);
  if (icon.startsWith('img:')) {
    const file = icon.slice(4).replace(/[^\w.-]/g, '');
    return <img class="chore-img" src={`/icons/${file}`} alt="" />;
  }
  return <span class="chore-emoji">{icon}</span>;
}
