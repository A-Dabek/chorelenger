import { ChoreIcon, when } from '../lib/chores.jsx';

export function DoneSheet({ c, onDone, onCancel }) {
  return (
    <div class="sheet-backdrop" onClick={onCancel}>
      <div class="sheet" role="dialog" aria-label={`Complete ${c.name}`} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <div class="sheet-icon"><ChoreIcon c={c} /></div>
          <div>
            <div class="sheet-name">{c.name}</div>
            <div class={`sheet-when ${c.status}`}>{when(c)}</div>
          </div>
        </div>
        <button type="button" class="sheet-done" onClick={() => onDone(c)}>Done ✓</button>
        <button type="button" class="ghost sheet-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
