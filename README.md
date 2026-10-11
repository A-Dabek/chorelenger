# Chorelenger

Personal chore tracker PWA. Fastify + `node:sqlite` backend, Preact + Vite frontend. See `.planning/PROJECT.md` for the vision.

## Status

Implemented:
- Single-user password auth (scrypt, session cookie, login throttle).
- Chores with three recurrence models (interval / flexible window / yearly calendar date), Today dashboard (overdue / due, plus read-only week and month bands), compact icon-grid Today screen (tap tile, confirm in sheet, undo; "Labels" toggle shows names; chore `icon` is an emoji or `img:file.svg` from `web/public/icons/`), monthly history, installable PWA shell.
- Monthly themed challenges with spotlighted chores, quick-tap extra counter buttons, objective monthly reward measurement (≥95% base execution + extra goal target), and milestone achievements.
- **Planned Items & Calendar Integration**:
  - One-off task tracking with date, time, location, notes, and 1-tap "Add to Google Calendar" web intent links.
  - Read-only calendar sync via private iCal feed URL polling (`webcal://` or `https://...basic.ics`) and drag-and-drop `.ics` file import.
  - Visual source differentiation (`📝 One-Off Task` vs `📅 Calendar Event`).
  - Manual tasks are marked "Done" on the Planned tab; calendar events are acknowledged from the "Calendar" section at the bottom of Today (6-second undo toast).
  - Sync only imports events dated today or later and never touches past rows again; recurring events (RRULE: DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, COUNT, UNTIL, BYDAY, EXDATE) are one item showing the next occurrence, which returns to pending when it advances.

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
The server has no native dependencies. The frontend build (Vite/rolldown/lightningcss) runs on the phone
and uses the Android prebuilds from the lockfile.

On the phone, after cloning the repo:

```sh
cp .env.example .env            # fill in CHORELENGER_PASSWORD_HASH (see below)
./prod.sh
```

`prod.sh` runs `npm ci`, `npm run build` (fails if `web/dist/index.html` is missing), `npm prune --omit=dev`,
backs up the DB to `backup/chorelenger-YYYYmmdd-HHMM.db`, then starts the server in the foreground on
`127.0.0.1:3002`. Use `SKIP_BUILD=1 ./prod.sh` to restart without reinstalling or rebuilding.
Generate the password hash with `npm run hash-password -- '<password>'` (run it after `npm ci`, or on WSL).

Cloudflare Tunnel: map `chorelenger.bombos.online` to `http://127.0.0.1:3002`.
Port 3000 is bombos2 and 3001 is mem-alice. Keep alive with `termux-wake-lock` and
runit (`pkg install termux-services`), tmux, or `nohup ./prod.sh > chorelenger.log 2>&1 &`.
Back up `data/` before deploying a new version.

| Env var | Meaning |
|---|---|
| `CHORELENGER_PASSWORD_HASH` | required, from `npm run hash-password` |
| `CHORELENGER_DB` | DB path (default `data/chorelenger.db`) |
| `COOKIE_SECURE` | `1` to mark the session cookie Secure (default `1` in `prod.sh`) |
| `PORT`, `HOST` | listen address (`prod.sh` default `127.0.0.1:3002`; server default `127.0.0.1:3000`) |
| `TZ` | timezone used to decide what "today" is |
| `ENV_FILE`, `SKIP_BUILD` | `prod.sh` only: alternate env file; skip install/build/prune |

`.env.example` lists these values. `prod.sh` sources `.env`; the server itself does not read `.env`.

### Chores: categories and one-offs

Categories are fixed: 🧹 `cleaning`, 🏠 `household`, 💪 `health`, 📌 `misc` (default). Older chores with other
free-text categories keep showing as plain text until re-saved with a valid category.
A *one-off* chore has no recurrence and no due date: it stays "due" in Today until done, then is finished
permanently (visible greyed in the Chores list and in history; Undo reopens it).

### Executions (what the Today page shows)

An *execution* is one concrete to-do with a due date. Every chore has exactly one active execution
(always dated today or later), and so does every calendar event UID; manual one-off items are executions too.
Done moves the execution to History and generates the next one. Undo (History tab, or the toast) restores it and
replaces the successor; only the latest done execution of a source can be undone (otherwise 409).
Chores have a *Next due is counted from* setting (`anchor`): `done` (default, done date + interval) or `due`
(previous due date + interval, strictly periodic). The Today page shows today in full plus read-only "This week" (days 1–7) and "This month" (days 8–31) bands, so upcoming items are always visible on one screen.

API: `GET /api/executions?from=&to=`, `POST /api/executions/:id/done` → `{done, next}`,
`POST /api/executions/:id/undo` → `{restored}`, `POST|PUT|DELETE /api/executions[/:id]` (manual/calendar rows),
`GET /api/history?month=`. `/api/planned*`, `POST /api/chores/:id/done` and `DELETE /api/completions/:id` remain as
thin compatibility aliases. `completions` and `planned_items` are no longer written; they are migrated once into
`executions` at startup (idempotent) and kept for rollback.

**Before deploying this version, back up `data/`** (e.g. `cp -r data data.bak`).

### Resetting the dev database

`npm run db:reset` deletes the DB file (`CHORELENGER_DB` or `data/chorelenger.db`, plus `-wal`/`-shm`).
It refuses to run when `NODE_ENV=production`. Stop the server first.
