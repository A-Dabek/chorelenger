# Project Log

Append-only record of everything that happens in this project. See `AGENTS.md` for the format and rules.

## 2026-10-05 — Project initialized
- Project vision captured in `.planning/PROJECT.md` after an abandoned attempt with the GSD framework.
- Commit `3289fe5` "docs: initialize project".

## 2026-10-06 — First implementation slice
- Requested: start implementing the project, scope at my discretion. Dev on WSL, production on Termux.
- Decisions (chosen by user): Fastify + `node:sqlite` (no native build on Termux), Preact + Vite, password + session cookie auth, Cloudflare Tunnel (TLS at Cloudflare, plain HTTP locally).
- Changed:
  - `server/schedule.js`: recurrence (fixed interval, flexible window ± days, yearly date; month-end clamping).
  - `server/app.js`, `db.js`, `auth.js`, `index.js`, `hash-password.js`: chore CRUD, done/undo, monthly history, scrypt auth, 30-day cookie, login throttle after 5 failures, JSON-only mutations.
  - `web/`: login, Today dashboard, chore form, History, PWA manifest/icons/service worker.
  - `README.md`: WSL dev and Termux deploy instructions.
- Verification: `npm test` 10 passing; `npm run build` OK; real server smoke-tested via curl (login, create chore, static serving, 401 without session). UI not opened in a browser; not run on Termux.
- Deferred: web push, monthly challenges + extra buttons, achievements, monthly reward measurement.
- Known issues: History default month uses UTC date (can be off by one near midnight). Node 22.5–22.12 on Termux needs `--experimental-sqlite`, which the `start` script doesn't pass.

## 2026-10-06 20:36 — Added AGENTS.md and log.md
- Requested: document everything that happens, with instructions for agents to keep doing so.
- Changed: created `AGENTS.md` (project guide, commands, conventions, mandatory logging rule and entry format) and `log.md` (this file, backfilled with history above).
- Verification: docs only, no tests run.

## 2026-10-06 20:40 — Committed everything
- Requested: commit all work so far.
- Changed: added `.idea/` to `.gitignore`; committed the implementation slice, docs, `AGENTS.md` and `log.md`.
- Verification: not re-run (no code changes since the last `npm test`).
- Open issues: none new.
