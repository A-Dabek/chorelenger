import { useState, useEffect, useCallback } from 'preact/hooks';
import { api, AuthError } from './api.js';
import { useTabRoute } from './lib/router.js';
import { Login } from './components/Login.jsx';
import { Today } from './views/Today.jsx';
import { PlannedView } from './views/Planned.jsx';
import { Chores } from './views/Chores.jsx';
import { MotivationView } from './views/Motivation.jsx';
import { History } from './views/History.jsx';

export function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useTabRoute();
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
