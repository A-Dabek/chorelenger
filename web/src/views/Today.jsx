import { useState } from 'preact/hooks';
import { ChallengeBanner } from '../components/ChallengeBanner.jsx';
import { ChoreTile } from '../components/ChoreTile.jsx';
import { ChoreChip } from '../components/ChoreChip.jsx';
import { DoneSheet } from '../components/DoneSheet.jsx';
import { splitBands } from '../lib/bands.js';

const KEY = 'chorelenger.verbose';

// Short day label for a band row: weekday for the week band, day of month for the month band.
function dayLabel(dateStr, band) {
  const d = new Date(dateStr + 'T00:00:00');
  return band === 'week'
    ? d.toLocaleDateString(undefined, { weekday: 'short' })
    : String(d.getDate());
}

export function Today({ executions = [], challengeData, onDone, onExtra }) {
  const [verbose, setVerbose] = useState(() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } });
  const [selected, setSelected] = useState(null);
  const toggle = () => {
    const v = !verbose;
    setVerbose(v);
    try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };
  const spotlightIds = challengeData?.spotlightChoreIds || [];
  const bands = splitBands(executions);
  const todayChores = bands.today.filter((e) => e.source_type === 'chore');
  const todayEvents = bands.today.filter((e) => e.source_type !== 'chore');
  const show = (s) => todayChores.filter((e) => e.status === s);
  const sections = [
    ['overdue', '⚠️', 'Overdue', show('overdue')],
    ['due', '⏰', 'Due', show('due')],
    ['done', '✓', 'Done today', show('done')],
  ];
  const upcomingBands = [
    ['week', 'This week', bands.week],
    ['month', 'This month', bands.month],
  ];
  const empty = executions.length === 0;
  const confirm = (e) => { setSelected(null); onDone(e); };
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
            {list.map((e) => (
              <ChoreTile key={e.id} c={e} verbose={verbose} isSpotlighted={spotlightIds.includes(e.chore_id)} onSelect={setSelected} />
            ))}
          </div>
        </section>
      ))}
      {todayEvents.length > 0 && (
        <section class="calendar-section" data-status="calendar">
          <h2>📅 Calendar</h2>
          {todayEvents.map((p) => {
            const done = p.status === 'done';
            return (
              <button
                key={p.id}
                type="button"
                class={`planned-card cal-item ${done ? 'completed' : ''} ${p.status === 'overdue' ? 'overdue' : ''}`}
                disabled={done}
                onClick={done ? undefined : () => onDone(p)}
              >
                <span class="info">
                  <span class="name">{p.title}{p.recurring && ' 🔁'}</span>
                  <span class="meta">
                    <b>{p.due_date}</b>
                    {p.start_time && ` · ${p.start_time}`}
                    {p.location && ` · 📍 ${p.location}`}
                  </span>
                </span>
                <span class="cal-ack">{done ? '✓' : p.source_type === 'calendar' ? 'Acknowledge' : 'Done'}</span>
              </button>
            );
          })}
        </section>
      )}
      {upcomingBands.map(([band, title, rows]) => rows.length > 0 && (
        <section key={band} class={`band band-${band}`} data-band={band}>
          <h2>{title} · {rows.length}</h2>
          <div class="chip-grid">
            {rows.filter((e) => e.source_type === 'chore').map((e) => (
              <ChoreChip
                key={e.id}
                c={e}
                label={dayLabel(e.due_date, band)}
                verbose={verbose}
                isSpotlighted={spotlightIds.includes(e.chore_id)}
              />
            ))}
          </div>
          {rows.filter((e) => e.source_type !== 'chore').map((e) => (
            <div key={e.id} class="event-row" data-kind="event">
              <span class="event-day">{dayLabel(e.due_date, band)}</span>
              <span class="event-name">{e.title}{e.recurring && ' 🔁'}</span>
              {e.start_time && <span class="event-time">{e.start_time}</span>}
            </div>
          ))}
        </section>
      ))}
      {selected && <DoneSheet c={selected} onDone={confirm} onCancel={() => setSelected(null)} />}
    </>
  );
}
