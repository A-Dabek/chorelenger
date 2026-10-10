# Chorelenger

Personal chore tracker PWA. Fastify + `node:sqlite` backend, Preact + Vite frontend. See `.planning/PROJECT.md` for the vision.

## Status

Implemented:
- Single-user password auth (scrypt, session cookie, login throttle).
- Chores with three recurrence models (interval / flexible window / yearly calendar date), Today dashboard (overdue / due / upcoming), compact icon-grid Today screen (tap tile, confirm in sheet, undo; "Labels" toggle shows names; chore `icon` is an emoji or `img:file.svg` from `web/public/icons/`), monthly history, installable PWA shell.
- Monthly themed challenges with spotlighted chores, quick-tap extra counter buttons, objective monthly reward measurement (≥95% base execution + extra goal target), and milestone achievements.
- **Planned Items & Calendar Integration**:
  - One-off task tracking with date, time, location, notes, and 1-tap "Add to Google Calendar" web intent links.
  - Read-only calendar sync via private iCal feed URL polling (`webcal://` or `https://...basic.ics`) and drag-and-drop `.ics` file import.
  - Visual source differentiation (`📝 One-Off Task` vs `📅 Calendar Event`).
  - Dual confirmation lifecycles: "Done" for tasks vs "Acknowledge" for calendar reminders, with 6-second undo toast support.

Deferred: web push notifications.

## Develop (WSL)

```sh
npm install
npm run hash-password -- 'your-password'     # prints CHORELENGER_PASSWORD_HASH='...'
export CHORELENGER_PASSWORD_HASH='...'
npm run dev:server        # API on :3000 (data in ./data/chorelenger.db)
npm run dev:web           # Vite on :5173, proxies /api to :3000
npm test                  # Unit & API tests
npm run test:e2e          # Playwright E2E tests
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
