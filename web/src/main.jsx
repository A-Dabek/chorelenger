import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { api, AuthError } from './api.js';
import './style.css';

const UNITS = { day: 'day', week: 'week', month: 'month' };
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function describe(c) {
  if (c.type === 'calendar') return `every ${MONTHS[c.cal_month - 1]} ${c.cal_day}`;
  const every = `every ${c.interval_n > 1 ? c.interval_n + ' ' : ''}${UNITS[c.interval_unit]}${c.interval_n > 1 ? 's' : ''}`;
  return c.type === 'flexible' ? `~${every} (±${c.window_days}d)` : every;
}

function getGoogleCalendarUrl(item) {
  const text = encodeURIComponent(item.title);
  const details = encodeURIComponent(item.notes || '');
  const location = encodeURIComponent(item.location || '');
  const cleanDate = (item.start_date || '').replace(/-/g, '');
  let datesParam = '';
  if (item.is_all_day || !item.start_time) {
    const startDateObj = new Date(item.start_date + 'T00:00:00');
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endYear = endDateObj.getFullYear();
    const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
    const endDay = String(endDateObj.getDate()).padStart(2, '0');
    const endClean = `${endYear}${endMonth}${endDay}`;
    datesParam = `${cleanDate}/${endClean}`;
  } else {
    const startTimeClean = item.start_time.replace(/:/g, '') + '00';
    let endTimeClean = startTimeClean;
    if (item.end_time) {
      endTimeClean = item.end_time.replace(/:/g, '') + '00';
    } else {
      const [h, m] = item.start_time.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      endTimeClean = `${endH}${String(m).padStart(2, '0')}00`;
    }
    datesParam = `${cleanDate}T${startTimeClean}/${cleanDate}T${endTimeClean}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${datesParam}&details=${details}&location=${location}`;
}

function when(c) {
  const d = c.daysUntil;
  if (c.status === 'overdue') return <b>overdue {Math.abs(c.daysUntil)}d</b>;
  if (c.status === 'due') return <b>{d === 0 ? 'due today' : d > 0 ? `window open, ideal in ${d}d` : `due (${-d}d past ideal)`}</b>;
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}

function Login({ onLogin }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try { await api('POST', '/api/login', { password: pw }); onLogin(); } catch (x) { setErr(x.message); }
  };
  return (
    <main>
      <h1>Chorelenger</h1>
      <form onSubmit={submit}>
        <label>Password<input type="password" autoComplete="current-password" value={pw} onInput={(e) => setPw(e.target.value)} autoFocus /></label>
        {err && <div class="error">{err}</div>}
        <button>Log in</button>
      </form>
    </main>
  );
}

function ChoreCard({ c, isSpotlighted, onDone, onEdit }) {
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

function ChallengeBanner({ challengeData, onExtra }) {
  if (!challengeData || !challengeData.challenge) return null;
  const { challenge, totalExtras = 0, extraCounts = {} } = challengeData;
  const goal = challenge.extraGoal || 20;
  const pct = Math.min(100, Math.round((totalExtras / goal) * 100));

  return (
    <div class="challenge-banner">
      <div class="challenge-tag">Monthly Challenge</div>
      <div class="challenge-title">{challenge.title}</div>
      <div class="challenge-desc">{challenge.description}</div>
      <div class="challenge-progress">
        <div class="progress-header">
          <span>Extra Actions Goal</span>
          <span>{totalExtras} / {goal} ({pct}%)</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {challenge.extras?.length > 0 && (
        <div class="extra-buttons-section">
          <div class="extra-buttons-label">Quick Extras</div>
          <div class="extra-buttons-list">
            {challenge.extras.map((ex) => (
              <button key={ex.id} class="extra-btn" type="button" onClick={() => onExtra(ex)}>
                <span>{ex.icon}</span>
                <span>{ex.label}</span>
                <span class="extra-count">{extraCounts[ex.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Today({ chores, challengeData, onDone, onExtra }) {
  const spotlightIds = challengeData?.spotlightChoreIds || [];
  const show = (s) => chores.filter((c) => c.status === s && !c.doneToday);
  const doneToday = chores.filter((c) => c.doneToday);
  const sections = [['Overdue', show('overdue')], ['Due', show('due')], ['Upcoming', show('upcoming').slice(0, 5)], ['Done today', doneToday]];
  const empty = sections.every(([, l]) => !l.length);
  return (
    <>
      <ChallengeBanner challengeData={challengeData} onExtra={onExtra} />
      <h1>Today</h1>
      {empty && <div class="empty">No chores yet — add some in the Chores tab.</div>}
      {sections.map(([title, list]) => list.length > 0 && (
        <section key={title}>
          <h2>{title}</h2>
          {list.map((c) => (
            <ChoreCard
              key={c.id}
              c={c}
              isSpotlighted={spotlightIds.includes(c.id)}
              onDone={title === 'Done today' ? undefined : onDone}
            />
          ))}
        </section>
      ))}
    </>
  );
}

const blank = { name: '', category: '', type: 'interval', interval_n: 1, interval_unit: 'week', window_days: 7, cal_month: 1, cal_day: 1 };

function ChoreForm({ chore, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ ...blank, ...chore });
  const [err, setErr] = useState('');
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { name: f.name, category: f.category, type: f.type, start_date: f.start_date };
      if (f.type !== 'calendar') Object.assign(body, { interval_n: f.interval_n, interval_unit: f.interval_unit });
      if (f.type === 'flexible') body.window_days = f.window_days;
      if (f.type === 'calendar') Object.assign(body, { cal_month: f.cal_month, cal_day: f.cal_day });
      await (chore?.id ? api('PUT', `/api/chores/${chore.id}`, body) : api('POST', '/api/chores', body));
      onSave();
    } catch (x) { setErr(x.message); }
  };
  return (
    <form onSubmit={submit}>
      <h1>{chore?.id ? 'Edit chore' : 'New chore'}</h1>
      <label>Name<input value={f.name} onInput={set('name')} required maxLength={120} /></label>
      <label>Category<input value={f.category} onInput={set('category')} placeholder="home, health, dog…" /></label>
      <label>Repeats
        <select value={f.type} onChange={set('type')}>
          <option value="interval">Fixed interval (from last done)</option>
          <option value="flexible">Flexible window (~every, whenever)</option>
          <option value="calendar">Calendar date (yearly)</option>
        </select>
      </label>
      {f.type !== 'calendar' && (
        <div class="row">
          <label>Every<input type="number" min="1" value={f.interval_n} onInput={set('interval_n', true)} /></label>
          <label>Unit
            <select value={f.interval_unit} onChange={set('interval_unit')}>
              <option value="day">days</option><option value="week">weeks</option><option value="month">months</option>
            </select>
          </label>
        </div>
      )}
      {f.type === 'flexible' && <label>Window (± days around ideal date)<input type="number" min="0" value={f.window_days} onInput={set('window_days', true)} /></label>}
      {f.type === 'calendar' && (
        <div class="row">
          <label>Month<select value={f.cal_month} onChange={set('cal_month', true)}>{MONTHS.map((m, i) => <option value={i + 1}>{m}</option>)}</select></label>
          <label>Day<input type="number" min="1" max="31" value={f.cal_day} onInput={set('cal_day', true)} /></label>
        </div>
      )}
      <label>First due / start date<input type="date" value={f.start_date || ''} onInput={set('start_date')} /></label>
      {err && <div class="error">{err}</div>}
      <div class="row"><button>Save</button><button type="button" class="ghost" onClick={onCancel}>Cancel</button></div>
      {chore?.id && <button type="button" class="danger" onClick={() => confirm(`Delete "${chore.name}" and its history?`) && onDelete(chore)}>Delete</button>}
    </form>
  );
}

function Chores({ chores, reload }) {
  const [editing, setEditing] = useState(null);
  if (editing) {
    return <ChoreForm chore={editing === 'new' ? null : editing} onCancel={() => setEditing(null)}
      onSave={() => { setEditing(null); reload(); }}
      onDelete={async (c) => { await api('DELETE', `/api/chores/${c.id}`); setEditing(null); reload(); }} />;
  }
  return (
    <>
      <div class="top"><h1>Chores</h1><button onClick={() => setEditing('new')}>+ Add</button></div>
      {!chores.length && <div class="empty">Nothing here yet.</div>}
      {[...chores].sort((a, b) => a.name.localeCompare(b.name)).map((c) => <ChoreCard key={c.id} c={c} onEdit={setEditing} />)}
    </>
  );
}

function localToday() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function sortPlannedItems(list) {
  return [...list].sort((a, b) => (
    a.start_date.localeCompare(b.start_date) ||
    (a.start_time || '').localeCompare(b.start_time || '') ||
    a.title.localeCompare(b.title)
  ));
}

function PlannedItemCard({ item, onConfirm, onEdit }) {
  const isCalendar = item.source === 'calendar_sync' || item.source === 'ics_import';
  const isCompleted = item.status === 'completed';
  const isOverdue = !isCompleted && item.start_date < localToday();

  return (
    <div class={`planned-card ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
      <div class="info" onClick={onEdit ? () => onEdit(item) : undefined}>
        <div class="name">
          <span class={`source-badge ${isCalendar ? 'calendar' : 'manual'}`}>
            {isCalendar ? '📅 Calendar Event' : '📝 One-Off Task'}
          </span>
          {item.title}
        </div>
        <div class="meta">
          <b>{item.start_date}</b>
          {item.start_time && ` · ${item.start_time}${item.end_time ? ` - ${item.end_time}` : ''}`}
          {item.location && ` · 📍 ${item.location}`}
          {item.notes && ` · ${item.notes}`}
          {isOverdue && ' · Overdue'}
          {isCompleted && ` · ${isCalendar ? 'acknowledged ✓' : 'done ✓'}`}
        </div>
      </div>
      <div class="planned-actions">
        {!isCompleted && !isCalendar && (
          <a
            class="gcal-link"
            href={getGoogleCalendarUrl(item)}
            target="_blank"
            rel="noopener noreferrer"
            title="Add to Google Calendar"
          >
            📅 Google Cal
          </a>
        )}
        {!isCompleted && onConfirm && (
          <button class="done-btn" onClick={() => onConfirm(item)}>
            {isCalendar ? 'Acknowledge' : 'Done'}
          </button>
        )}
      </div>
    </div>
  );
}

function PlannedItemForm({ item, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(item || {
    title: '',
    start_date: localToday(),
    start_time: '',
    end_time: '',
    notes: '',
    location: '',
  });
  const [err, setErr] = useState('');

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: f.title,
        start_date: f.start_date || localToday(),
        start_time: f.start_time || null,
        end_time: f.end_time || null,
        notes: f.notes || '',
        location: f.location || '',
      };
      if (item?.id) {
        await api('PUT', `/api/planned/${item.id}`, payload);
      } else {
        await api('POST', '/api/planned', payload);
      }
      onSave();
    } catch (x) {
      setErr(x.message);
    }
  };

  return (
    <form onSubmit={submit}>
      <h2>{item?.id ? 'Edit Planned Item' : 'New One-Off Task'}</h2>
      <label>Title<input value={f.title || ''} onInput={set('title')} required autoFocus /></label>
      <label>Date<input type="date" value={f.start_date || ''} onInput={set('start_date')} required /></label>
      <div class="row">
        <label>Start time<input type="time" value={f.start_time || ''} onInput={set('start_time')} /></label>
        <label>End time<input type="time" value={f.end_time || ''} onInput={set('end_time')} /></label>
      </div>
      <label>Location<input value={f.location || ''} onInput={set('location')} placeholder="e.g. Office, City Post" /></label>
      <label>Notes<input value={f.notes || ''} onInput={set('notes')} placeholder="Details, checklist..." /></label>
      {err && <div class="error">{err}</div>}
      <div class="row">
        <button>Save</button>
        <button type="button" class="ghost" onClick={onCancel}>Cancel</button>
      </div>
      {item?.id && (
        <button
          type="button"
          class="danger"
          onClick={() => confirm(`Delete "${item.title}"?`) && onDelete(item)}
        >
          Delete
        </button>
      )}
    </form>
  );
}

function PlannedView({ onConfirm, toast }) {
  const [items, setItems] = useState([]);
  const [feedUrl, setFeedUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, settings] = await Promise.all([
        api('GET', '/api/planned'),
        api('GET', '/api/settings/calendar'),
      ]);
      setItems(list);
      setFeedUrl(settings.feedUrl || '');
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();
  }, [load, toast]);

  const handleConfirm = async (it) => {
    if (onConfirm) await onConfirm(it);
    load();
  };

  const saveFeedUrl = async (e) => {
    e.preventDefault();
    try {
      await api('PUT', '/api/settings/calendar', { feedUrl });
      setSyncStatus('Feed URL saved.');
      setShowSettings(false);
      load();
    } catch (err) {
      setSyncStatus(`Error saving: ${err.message}`);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    setSyncStatus('Syncing calendar feed…');
    try {
      const res = await api('POST', '/api/planned/sync', {});
      if (res.synced) {
        setSyncStatus(`Synced ${res.count} calendar events.`);
      } else {
        setSyncStatus(res.message || 'Sync not configured.');
      }
      load();
    } catch (err) {
      setSyncStatus(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const importIcsText = async (text) => {
    try {
      const res = await api('POST', '/api/planned/import-ics', { ics: text });
      setSyncStatus(`Imported ${res.importedCount} events from .ics file.`);
      load();
    } catch (err) {
      setSyncStatus(`Import failed: ${err.message}`);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => importIcsText(ev.target.result);
      reader.readAsText(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => importIcsText(ev.target.result);
      reader.readAsText(file);
    }
  };

  if (editing) {
    return (
      <PlannedItemForm
        item={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={() => {
          setEditing(null);
          load();
        }}
        onDelete={async (it) => {
          await api('DELETE', `/api/planned/${it.id}`);
          setEditing(null);
          load();
        }}
      />
    );
  }

  const todayStr = localToday();
  const in7DaysStr = addDays(todayStr, 7);

  const pendingItems = items.filter((it) => it.status === 'pending');
  const completedItems = items.filter((it) => it.status === 'completed');

  const overdueItems = sortPlannedItems(pendingItems.filter((it) => it.start_date < todayStr));
  const todayItems = sortPlannedItems(pendingItems.filter((it) => it.start_date === todayStr));
  const upcomingItems = sortPlannedItems(pendingItems.filter((it) => it.start_date > todayStr && it.start_date <= in7DaysStr));
  const laterItems = sortPlannedItems(pendingItems.filter((it) => it.start_date > in7DaysStr));
  const completedSorted = sortPlannedItems(completedItems);

  const sections = [
    ['Overdue', overdueItems],
    ['Today', todayItems],
    ['Upcoming (Next 7 Days)', upcomingItems],
    ['Later', laterItems],
    ['Completed & Acknowledged', completedSorted],
  ];

  return (
    <div class="planned-container">
      <div class="top">
        <h1>Planned Items & Calendar</h1>
        <button onClick={() => setEditing('new')}>+ Plan Item</button>
      </div>

      <div class="sync-bar">
        <div class="sync-info">
          <span>{feedUrl ? '🔗 Calendar feed linked' : 'No calendar feed linked'}</span>
          {syncStatus && <span>· {syncStatus}</span>}
        </div>
        <div class="sync-buttons">
          {feedUrl && (
            <button class="ghost" onClick={triggerSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync Feed'}
            </button>
          )}
          <button class="ghost" onClick={() => setShowSettings(!showSettings)}>
            {showSettings ? 'Close Settings' : 'Feed Settings'}
          </button>
        </div>
      </div>

      {showSettings && (
        <form class="settings-panel" onSubmit={saveFeedUrl}>
          <h2>iCal Feed Sync (Google Calendar / Apple)</h2>
          <label>
            Private iCal Feed URL (webcal:// or https://...basic.ics)
            <input
              type="text"
              value={feedUrl}
              onInput={(e) => setFeedUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            />
          </label>
          <div class="row">
            <button>Save Feed URL</button>
            <button type="button" class="ghost" onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div
        class={`dropzone ${dragOver ? 'dragover' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('ics-file-input')?.click()}
      >
        <span>Drop your <code>.ics</code> calendar file here, or click to upload</span>
        <input
          id="ics-file-input"
          type="file"
          accept=".ics,text/calendar"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>

      {items.length === 0 && (
        <div class="empty">No planned items or calendar events yet.</div>
      )}

      {sections.map(([title, list]) => list.length > 0 && (
        <section key={title}>
          <h2>{title} ({list.length})</h2>
          {list.map((it) => (
            <PlannedItemCard
              key={it.id}
              item={it}
              onConfirm={handleConfirm}
              onEdit={it.source === 'manual' ? setEditing : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function localMonth() {
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}`;
}

function History() {
  const [month, setMonth] = useState(localMonth());
  const [data, setData] = useState(null);
  useEffect(() => { api('GET', `/api/history?month=${month}`).then(setData).catch(() => {}); }, [month]);
  return (
    <>
      <h1>History</h1>
      <input type="month" value={month} onInput={(e) => e.target.value && setMonth(e.target.value)} />
      {data && <h2>{data.total} completion{data.total === 1 ? '' : 's'}</h2>}
      {data?.completions.map((x) => (
        <div class="card" key={x.completionId}><div class="info"><div class="name">{x.name}</div><div class="meta">{x.date}{x.category && ` · ${x.category}`}</div></div></div>
      ))}
    </>
  );
}

function MotivationView() {
  const [month, setMonth] = useState(localMonth());
  const [data, setData] = useState(null);

  useEffect(() => {
    api('GET', `/api/motivation?month=${month}`).then(setData).catch(() => {});
  }, [month]);

  if (!data) return <div class="empty">Loading motivation stats…</div>;

  const { reward, monthlyExecution, achievements = [] } = data;
  const execPct = Math.round((reward.executionRate || 0) * 100);

  return (
    <div class="motivation-container">
      <div class="top">
        <h1>Motivation & Rewards</h1>
        <input type="month" value={month} onInput={(e) => e.target.value && setMonth(e.target.value)} />
      </div>

      <div class="reward-card">
        <h2>Monthly Reward Status</h2>
        <div class="reward-grid">
          <div class="reward-item">
            <div class="reward-label">Base Reward (≥95%)</div>
            <div class="reward-val">{execPct}%</div>
            <div class="reward-label">{monthlyExecution.completed} / {monthlyExecution.expected} chores</div>
            <div class={`reward-status-pill ${reward.baseRewardAchieved ? 'achieved' : 'pending'}`}>
              {reward.baseRewardAchieved ? 'Achieved ✓' : 'In Progress'}
            </div>
          </div>
          <div class="reward-item">
            <div class="reward-label">Extra Goal</div>
            <div class="reward-val">{reward.extraCurrent} / {reward.extraGoal}</div>
            <div class="reward-label">Challenge Extras</div>
            <div class={`reward-status-pill ${reward.extraRewardAchieved ? 'achieved' : 'pending'}`}>
              {reward.extraRewardAchieved ? 'Achieved ✓' : 'In Progress'}
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2>Achievements ({achievements.filter((a) => a.unlocked).length} / {achievements.length})</h2>
        <div class="achievements-grid">
          {achievements.map((ach) => (
            <div key={ach.id} class={`achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`}>
              <div class="achievement-icon">{ach.icon || '🏆'}</div>
              <div class="achievement-name">{ach.name}</div>
              <div class="achievement-desc">{ach.desc}</div>
              {ach.unlocked ? (
                <div class="achievement-date">Unlocked {ach.unlockedAt}</div>
              ) : (
                <div class="achievement-date" style={{ color: 'var(--muted)' }}>Locked</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('today');
  const [chores, setChores] = useState([]);
  const [challengeData, setChallengeData] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [choresList, chal] = await Promise.all([
        api('GET', '/api/chores'),
        api('GET', '/api/challenge/current'),
      ]);
      setChores(choresList);
      setChallengeData(chal);
      setAuthed(true);
    } catch (e) {
      if (e instanceof AuthError) setAuthed(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const markDone = async (c) => {
    try {
      const r = await api('POST', `/api/chores/${c.id}/done`);
      setToast({ text: `${c.name} done ✓`, completionId: r.completionId });
      reload();
    } catch (e) { if (e instanceof AuthError) setAuthed(false); }
  };

  const logExtra = async (ex) => {
    try {
      const r = await api('POST', '/api/challenge/extra', { extra_id: ex.id });
      setToast({ text: `${ex.icon || ''} ${ex.label} logged (+1)`, extraCompletionId: r.completionId });
      reload();
    } catch (e) { if (e instanceof AuthError) setAuthed(false); }
  };

  const confirmPlanned = async (item) => {
    try {
      const isCalendar = item.source === 'calendar_sync' || item.source === 'ics_import';
      await api('POST', `/api/planned/${item.id}/confirm`);
      setToast({
        text: isCalendar ? `Acknowledged: ${item.title} ✓` : `${item.title} done ✓`,
        plannedId: item.id,
      });
      reload();
    } catch (e) { if (e instanceof AuthError) setAuthed(false); }
  };

  const undo = async () => {
    if (!toast) return;
    if (toast.completionId) {
      await api('DELETE', `/api/completions/${toast.completionId}`);
    } else if (toast.extraCompletionId) {
      await api('DELETE', `/api/challenge/extra/${toast.extraCompletionId}`);
    } else if (toast.plannedId) {
      await api('DELETE', `/api/planned/${toast.plannedId}/confirm`);
    }
    setToast(null);
    reload();
  };

  if (authed === null) return null;
  if (!authed) return <Login onLogin={() => { setAuthed(true); reload(); }} />;

  return (
    <>
      <main>
        {tab === 'today' && <Today chores={chores} challengeData={challengeData} onDone={markDone} onExtra={logExtra} />}
        {tab === 'planned' && <PlannedView onConfirm={confirmPlanned} toast={toast} />}
        {tab === 'chores' && <Chores chores={chores} reload={reload} />}
        {tab === 'motivation' && <MotivationView />}
        {tab === 'history' && <History />}
        {tab === 'history' && <p><button class="ghost" onClick={async () => { await api('POST', '/api/logout', {}); setAuthed(false); }}>Log out</button></p>}
      </main>
      {toast && <div class="toast"><span>{toast.text}</span><button onClick={undo}>Undo</button></div>}
      <nav>
        {[
          ['today', 'Today'],
          ['planned', 'Planned'],
          ['chores', 'Chores'],
          ['motivation', 'Motivation'],
          ['history', 'History'],
        ].map(([k, l]) => (
          <button key={k} class={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
    </>
  );
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
