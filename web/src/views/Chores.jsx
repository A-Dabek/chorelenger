import { useState } from 'preact/hooks';
import { api } from '../api.js';
import { MONTHS } from '../lib/dates.js';
import { ChoreCard } from '../components/ChoreCard.jsx';
import { ICON_SUGGESTIONS } from '../lib/chores.jsx';

const blank = { name: '', category: '', icon: '', type: 'interval', interval_n: 1, interval_unit: 'week', window_days: 7, cal_month: 1, cal_day: 1 };

function ChoreForm({ chore, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ ...blank, ...chore });
  const [err, setErr] = useState('');
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const body = { name: f.name, category: f.category, icon: f.icon, type: f.type, start_date: f.start_date };
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
      <label>Icon (emoji or img:file.svg; blank = automatic)<input value={f.icon || ''} onInput={set('icon')} maxLength={32} /></label>
      <div class="icon-suggest">
        {ICON_SUGGESTIONS.map((e) => <button type="button" class="ghost" key={e} onClick={() => setF({ ...f, icon: e })}>{e}</button>)}
      </div>
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

export function Chores({ chores, reload }) {
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
