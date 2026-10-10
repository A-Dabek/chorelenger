import { useState } from 'preact/hooks';
import { ChallengeBanner } from '../components/ChallengeBanner.jsx';
import { ChoreTile } from '../components/ChoreTile.jsx';
import { DoneSheet } from '../components/DoneSheet.jsx';

const KEY = 'chorelenger.verbose';
const UPCOMING_DAYS = 7;

export function Today({ chores, challengeData, onDone, onExtra }) {
  const [verbose, setVerbose] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [selected, setSelected] = useState(null);
  const toggle = () => {
    const v = !verbose;
    setVerbose(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };
  const spotlightIds = challengeData?.spotlightChoreIds || [];
  const show = (s) => chores.filter((c) => c.status === s && !c.doneToday);
  const sections = [
    ['overdue', '⚠️', 'Overdue', show('overdue')],
    ['due', '⏰', 'Due', show('due')],
    ['upcoming', '📅', 'Upcoming', show('upcoming').filter((c) => c.daysUntil <= UPCOMING_DAYS)],
    ['done', '✓', 'Done today', chores.filter((c) => c.doneToday)],
  ];
  const empty = sections.every(([, , , l]) => !l.length);
  const confirm = (c) => { setSelected(null); onDone(c); };
  return (
    <>
      <div class="topbar">
        <h1>Today</h1>
        <button type="button" class={`ghost verbose-toggle ${verbose ? 'on' : ''}`} aria-pressed={verbose} aria-label="Toggle labels" onClick={toggle}>
          {verbose ? '🏷️ Labels on' : '🏷️ Labels'}
        </button>
      </div>
      <ChallengeBanner challengeData={challengeData} onExtra={onExtra} />
      {empty && <div class="empty">No chores yet — add some in the Chores tab.</div>}
      {sections.map(([key, glyph, title, list]) => list.length > 0 && (
        <section key={key} class={`group ${key}`} data-status={key}>
          <div class="strip" title={title} aria-label={title}>{glyph}</div>
          <div class={`grid ${verbose ? 'verbose' : ''}`}>
            {list.map((c) => (
              <ChoreTile key={c.id} c={c} verbose={verbose} isSpotlighted={spotlightIds.includes(c.id)} onSelect={setSelected} />
            ))}
          </div>
        </section>
      ))}
      {selected && <DoneSheet c={selected} onDone={confirm} onCancel={() => setSelected(null)} />}
    </>
  );
}
