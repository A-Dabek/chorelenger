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

function ChoreCard({ c, onDone, onEdit }) {
  return (
    <div class={`card ${c.status} ${c.doneToday ? 'finished' : ''}`}>
      <div class="info" onClick={onEdit ? () => onEdit(c) : undefined}>
        <div class="name">{c.name}</div>
        <div class="meta">{c.category && `${c.category} · `}{describe(c)} · {c.doneToday ? 'done today ✓' : when(c)}</div>
      </div>
      {onDone && <button class="done-btn" onClick={() => onDone(c)}>Done</button>}
    </div>
  );
}

function Today({ chores, onDone }) {
  const show = (s) => chores.filter((c) => c.status === s && !c.doneToday);
  const doneToday = chores.filter((c) => c.doneToday);
  const sections = [['Overdue', show('overdue')], ['Due', show('due')], ['Upcoming', show('upcoming').slice(0, 5)], ['Done today', doneToday]];
  const empty = sections.every(([, l]) => !l.length);
  return (
    <>
      <h1>Today</h1>
      {empty && <div class="empty">No chores yet — add some in the Chores tab.</div>}
      {sections.map(([title, list]) => list.length > 0 && (
        <section key={title}>
          <h2>{title}</h2>
          {list.map((c) => <ChoreCard key={c.id} c={c} onDone={title === 'Done today' ? undefined : onDone} />)}
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

function History() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
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

function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('today');
  const [chores, setChores] = useState([]);
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    try { setChores(await api('GET', '/api/chores')); setAuthed(true); }
    catch (e) { if (e instanceof AuthError) setAuthed(false); }
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
  const undo = async () => { await api('DELETE', `/api/completions/${toast.completionId}`); setToast(null); reload(); };

  if (authed === null) return null;
  if (!authed) return <Login onLogin={() => { setAuthed(true); reload(); }} />;

  return (
    <>
      <main>
        {tab === 'today' && <Today chores={chores} onDone={markDone} />}
        {tab === 'chores' && <Chores chores={chores} reload={reload} />}
        {tab === 'history' && <History />}
        {tab === 'history' && <p><button class="ghost" onClick={async () => { await api('POST', '/api/logout', {}); setAuthed(false); }}>Log out</button></p>}
      </main>
      {toast && <div class="toast"><span>{toast.text}</span><button onClick={undo}>Undo</button></div>}
      <nav>
        {[['today', 'Today'], ['chores', 'Chores'], ['history', 'History']].map(([k, l]) => (
          <button key={k} class={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
    </>
  );
}

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
