import { useState } from 'preact/hooks';
import { api } from '../api.js';

export function Login({ onLogin }) {
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
