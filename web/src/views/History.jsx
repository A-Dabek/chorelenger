import { useState, useEffect, useCallback } from 'preact/hooks';
import { api } from '../api.js';
import { localMonth } from '../lib/dates.js';

export function History({ onUndo }) {
  const [month, setMonth] = useState(localMonth());
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => api('GET', `/api/history?month=${month}`).then(setData).catch(() => {}), [month]);
  useEffect(() => { load(); }, [load]);
  const undo = async (x) => {
    try {
      setErr('');
      await api('POST', `/api/executions/${x.executionId}/undo`);
      await load();
      if (onUndo) onUndo();
    } catch (e) { setErr(e.message); }
  };
  return (
    <>
      <h1>History</h1>
      <input type="month" value={month} onInput={(e) => e.target.value && setMonth(e.target.value)} />
      {data && <h2>{data.total} completion{data.total === 1 ? '' : 's'}</h2>}
      {err && <div class="error">{err}</div>}
      {data?.completions.map((x) => (
        <div class="card" key={x.executionId}>
          <div class="info"><div class="name">{x.name}</div><div class="meta">{x.date}{x.category && ` · ${x.category}`}</div></div>
          {x.canUndo && <button type="button" class="ghost history-undo" onClick={() => undo(x)}>Undo</button>}
        </div>
      ))}
    </>
  );
}
