import { describe, when } from '../lib/chores.jsx';

export function ChoreCard({ c, isSpotlighted, onDone, onEdit }) {
  return (
    <div class={`card ${c.status} ${c.doneToday ? 'finished' : ''} ${isSpotlighted ? 'spotlight' : ''}`}>
      <div class="info" onClick={onEdit ? () => onEdit(c) : undefined}>
        <div class="name">{c.name}{isSpotlighted && <span class="spotlight-badge">✨ Spotlight</span>}</div>
        <div class="meta">{c.category && `${c.category} · `}{describe(c)} · {c.doneToday ? 'done today ✓' : when(c)}</div>
      </div>
      {onDone && <button class="done-btn" onClick={() => onDone(c)}>Done</button>}
    </div>
  );
}
