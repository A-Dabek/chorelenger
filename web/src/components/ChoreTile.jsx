import { ChoreIcon, CATEGORIES, when } from '../lib/chores.jsx';

export function ChoreTile({ c, verbose, isSpotlighted, onSelect }) {
  const inert = c.doneToday;
  return (
    <button
      type="button"
      class={`tile ${c.status} ${inert ? 'finished' : ''} ${isSpotlighted ? 'spotlight' : ''} ${verbose ? 'verbose' : ''}`}
      aria-label={c.name}
      title={c.name}
      disabled={inert}
      onClick={inert ? undefined : () => onSelect(c)}
    >
      <ChoreIcon c={c} />
      {verbose && <span class="tile-name">{c.name}</span>}
      {verbose && <span class="tile-when">{inert ? 'done today' : when(c)}</span>}
      {CATEGORIES[c.category] && <span class="tile-cat">{CATEGORIES[c.category].emoji}</span>}
      {inert && <span class="tile-badge">✓</span>}
      {isSpotlighted && !inert && <span class="tile-badge spot">✨</span>}
    </button>
  );
}
