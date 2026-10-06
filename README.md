# Chorelenger

Personal chore tracker PWA. Fastify + `node:sqlite` backend, Preact + Vite frontend. See `.planning/PROJECT.md` for the vision.

## Status

Implemented (v0 slice): single-user password auth (scrypt, session cookie, login throttle), chores with
three recurrence models (interval / flexible window / yearly calendar date), Today dashboard
(overdue / due / upcoming), one-tap done with undo, monthly history, installable PWA shell.

Deferred: web push notifications, monthly themed challenges + extra buttons, achievements,
monthly reward measurement.

## Develop (WSL)

```sh
npm install
npm run hash-password -- 'your-password'     # prints CHORELENGER_PASSWORD_HASH='...'
export CHORELENGER_PASSWORD_HASH='...'
npm run dev:server        # API on :3000 (data in ./data/chorelenger.db)
npm run dev:web           # Vite on :5173, proxies /api to :3000
npm test
```

## Deploy (Termux)

Requires Node >= 22.5 (`pkg install nodejs`). On Node 22.5–22.12 start with `node --experimental-sqlite`.
There are no native dependencies, so nothing needs compiling on the phone.

Build the frontend on WSL (`npm run build`) and copy the repo including `web/dist` to the phone
(or build on the phone, Vite works there too), then `npm ci --omit=dev` and:

```sh
export CHORELENGER_PASSWORD_HASH='...'
export COOKIE_SECURE=1          # behind HTTPS (Cloudflare Tunnel)
export PORT=3000 HOST=127.0.0.1
node server/index.js
```

Point the Cloudflare Tunnel at `http://127.0.0.1:3000`. Keep alive with `termux-wake-lock` and
runit (`pkg install termux-services`) or your existing supervisor. Back up `data/chorelenger.db`.

| Env var | Meaning |
|---|---|
| `CHORELENGER_PASSWORD_HASH` | required, from `npm run hash-password` |
| `CHORELENGER_DB` | DB path (default `data/chorelenger.db`) |
| `COOKIE_SECURE` | `1` to mark the session cookie Secure (use behind HTTPS) |
| `PORT`, `HOST` | listen address (default `127.0.0.1:3000`) |
| `TZ` | timezone used to decide what "today" is |
