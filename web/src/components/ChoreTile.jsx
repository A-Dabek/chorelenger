import { ChoreIcon, CATEGORIES, whenExec } from '../lib/chores.jsx';

export function ChoreTile({ c, verbose, isSpotlighted, onSelect }) {
  const inert = c.status === 'done';
  return (
    <button
      type="button"
      class={`tile ${c.status} ${inert ? 'finished' : ''} ${isSpotlighted ? 'spotlight' : ''} ${verbose ? 'verbose' : ''}`}
      aria-label={c.title}
      title={c.title}
      disabled={inert}
      onClick={inert ? undefined : () => onSelect(c)}
    >
      <ChoreIcon c={c} />
      {verbose && <span class="tile-name">{c.title}</span>}
      {verbose && <span class="tile-when">{whenExec(c)}</span>}
      {CATEGORIES[c.category] && <span class="tile-cat">{CATEGORIES[c.category].emoji}</span>}
      {inert && <span class="tile-badge">✓</span>}
      {isSpotlighted && !inert && <span class="tile-badge spot">✨</span>}
    </button>
  );
}
