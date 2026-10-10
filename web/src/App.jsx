import { useState, useEffect, useCallback } from 'preact/hooks';
import { api, AuthError } from './api.js';
import { useTabRoute } from './lib/router.js';
import { Login } from './components/Login.jsx';
import { Today } from './views/Today.jsx';
import { PlannedView } from './views/Planned.jsx';
import { Chores } from './views/Chores.jsx';
import { MotivationView } from './views/Motivation.jsx';
import { History } from './views/History.jsx';
import { localToday, addDays } from './lib/dates.js';

const HORIZON_KEY = 'chorelenger.horizon';
export const HORIZONS = { today: ['Today', 0], week: ['Week', 7], month: ['Month', 31] };

export function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useTabRoute();
  const [chores, setChores] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [horizon, setHorizon] = useState(() => {
    try { const h = localStorage.getItem(HORIZON_KEY); return h in HORIZONS ? h : 'today'; } catch { return 'today'; }
  });
  const [challengeData, setChallengeData] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = useCallback(async () => {
    try {
      const to = addDays(localToday(), HORIZONS[horizon][1]);
      const [choresList, chal, execList] = await Promise.all([
        api('GET', '/api/chores'),
        api('GET', '/api/challenge/current'),
        api('GET', `/api/executions?to=${to}`),
      ]);
      setChores(choresList);
      setExecutions(execList);
      setChallengeData(chal);
      setAuthed(true);
    } catch (e) {
      if (e instanceof AuthError) setAuthed(false);
    }
  }, [horizon]);

  useEffect(() => { reload(); }, [reload, tab]);
  const changeHorizon = (h) => {
    setHorizon(h);
    try { localStorage.setItem(HORIZON_KEY, h); } catch { /* ignore */ }
  };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  // One tap = done on an execution (chore, calendar event or one-off). Undo goes through its id.
  const markDone = async (e) => {
    try {
      const title = e.title || e.name;
      const isCal = (e.source_type || e.source) === 'calendar';
      await api('POST', `/api/executions/${e.id}/done`);
      setToast({ text: isCal ? `Acknowledged: ${title} ✓` : `${title} done ✓`, executionId: e.id });
      reload();
    } catch (x) { if (x instanceof AuthError) setAuthed(false); }
  };

  const logExtra = async (ex) => {
    try {
      const r = await api('POST', '/api/challenge/extra', { extra_id: ex.id });
      setToast({ text: `${ex.icon || ''} ${ex.label} logged (+1)`, extraCompletionId: r.completionId });
      reload();
    } catch (e) { if (e instanceof AuthError) setAuthed(false); }
  };

  const undo = async () => {
    if (!toast) return;
    if (toast.executionId) {
      await api('POST', `/api/executions/${toast.executionId}/undo`);
    } else if (toast.extraCompletionId) {
      await api('DELETE', `/api/challenge/extra/${toast.extraCompletionId}`);
    }
    setToast(null);
    reload();
  };

  if (authed === null) return null;
  if (!authed) return <Login onLogin={() => { setAuthed(true); reload(); }} />;

  return (
    <>
      <main>
        {tab === 'today' && <Today executions={executions} horizon={horizon} onHorizon={changeHorizon} challengeData={challengeData} onDone={markDone} onExtra={logExtra} />}
        {tab === 'planned' && <PlannedView onConfirm={markDone} toast={toast} />}
        {tab === 'chores' && <Chores chores={chores} reload={reload} />}
        {tab === 'motivation' && <MotivationView />}
        {tab === 'history' && <History onUndo={reload} />}
        {tab === 'history' && <p><button class="ghost" onClick={async () => { await api('POST', '/api/logout', {}); setAuthed(false); }}>Log out</button></p>}
      </main>
      {toast && <div class="toast"><span>{toast.text}</span><button onClick={undo}>Undo</button></div>}
      <nav>
        {[
          ['today', 'Today', '🏠'],
          ['planned', 'Planned', '📅'],
          ['chores', 'Chores', '🧹'],
          ['motivation', 'Motivation', '🏆'],
          ['history', 'History', '📜'],
        ].map(([k, l, i]) => (
          <button key={k} class={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            <span class="nav-ico" aria-hidden="true">{i}</span><span class="nav-label">{l}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
