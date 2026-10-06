# AGENTS.md

Guidance for AI agents (and humans) working on Chorelenger.

## Project
Personal single-user chore tracker PWA. Vision and requirements: `.planning/PROJECT.md`.
Usage/deploy: `README.md`.

## Stack
- Backend: Fastify + built-in `node:sqlite` (no native deps), in `server/`.
- Frontend: Preact + Vite, in `web/` (build output `web/dist`, served by the backend).
- Auth: scrypt password hash from env, httpOnly session cookie, login throttling.
- Dev on WSL; production on Termux (Android) behind a Cloudflare Tunnel.

## Commands
- `npm test` — recurrence logic and API tests (must pass before finishing work).
- `npm run build` — build the frontend.
- `npm run dev:server` / `npm run dev:web` — dev servers.

## Conventions
- Keep Termux compatibility: no native/compiled dependencies.
- Recurrence logic lives in `server/schedule.js` as pure functions; add tests for any change.
- Mutating API requests must stay JSON-only and behind auth.
- Never commit secrets, `.env`, or `data/`.
- Out-of-scope items are listed in `.planning/PROJECT.md`; don't add them unasked.

## Documentation rule (MANDATORY)
Everything that happens in the project must be documented in `log.md`.

1. At the end of every session/task (and after any significant step), append an entry to `log.md`.
2. Entries are append-only, newest at the bottom, format:
   ```
   ## YYYY-MM-DD HH:MM — Short title
   - What was requested / why
   - What changed (files, decisions, commands that matter)
   - Verification (tests run, results) or "not verified"
   - Open issues / follow-ups
   ```
3. Record decisions and their rationale, failures and dead ends, deferred work, and deployment/operational events.
4. If behavior, setup, or env vars change, also update `README.md`; if requirements change, update `.planning/PROJECT.md`.
5. Do not rewrite or delete past log entries; correct them with a new entry.
