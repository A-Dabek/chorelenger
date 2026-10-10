import { useState } from 'preact/hooks';
import { ChallengeBanner } from '../components/ChallengeBanner.jsx';
import { ChoreTile } from '../components/ChoreTile.jsx';
import { DoneSheet } from '../components/DoneSheet.jsx';
import { localToday } from '../lib/dates.js';

const KEY = 'chorelenger.verbose';
const UPCOMING_DAYS = 7;
const dayOf = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function Today({ chores, planned = [], challengeData, onDone, onExtra, onAcknowledge }) {
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
  const todayStr = localToday();
  const isCal = (p) => p.source !== 'manual';
  const calPending = planned.filter((p) => isCal(p) && p.status === 'pending' && p.start_date <= todayStr);
  const calDone = planned.filter((p) => isCal(p) && p.status === 'completed' && p.completed_at && dayOf(p.completed_at) === todayStr);
  const empty = sections.every(([, , , l]) => !l.length) && !calPending.length && !calDone.length;
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
      {(calPending.length > 0 || calDone.length > 0) && (
        <section class="calendar-section" data-status="calendar">
          <h2>📅 Calendar</h2>
          {[...calPending, ...calDone].map((p) => {
            const done = p.status === 'completed';
            return (
              <button
                key={p.id}
                type="button"
                class={`planned-card cal-item ${done ? 'completed' : ''} ${!done && p.start_date < todayStr ? 'overdue' : ''}`}
                disabled={done}
                onClick={done ? undefined : () => onAcknowledge(p)}
              >
                <span class="info">
                  <span class="name">{p.title}{p.recurring && ' 🔁'}</span>
                  <span class="meta">
                    <b>{p.start_date}</b>
                    {p.start_time && ` · ${p.start_time}`}
                    {p.location && ` · 📍 ${p.location}`}
                  </span>
                </span>
                <span class="cal-ack">{done ? '✓' : 'Acknowledge'}</span>
              </button>
            );
          })}
        </section>
      )}
      {selected && <DoneSheet c={selected} onDone={confirm} onCancel={() => setSelected(null)} />}
    </>
  );
}
