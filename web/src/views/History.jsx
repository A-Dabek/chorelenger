import { useState, useEffect } from 'preact/hooks';
import { api } from '../api.js';
import { localMonth } from '../lib/dates.js';

export function History() {
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
