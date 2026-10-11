import { ChoreIcon, CATEGORIES } from '../lib/chores.jsx';

// Read-only glance item for the week/month bands. Not a button: completing early needs the Today band.
export function ChoreChip({ c, label, verbose, isSpotlighted }) {
  return (
    <div
      class={`chip ${c.status} ${isSpotlighted ? 'spotlight' : ''} ${verbose ? 'verbose' : ''}`}
      title={`${c.title} · ${c.due_date}`}
      data-chore={c.title}
    >
      <span class="chip-day">{label}</span>
      <ChoreIcon c={c} />
      {verbose && <span class="chip-name">{c.title}</span>}
      {CATEGORIES[c.category] && <span class="tile-cat">{CATEGORIES[c.category].emoji}</span>}
    </div>
  );
}
