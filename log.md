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

## 2026-10-10 18:36 — Iteration 2: Motivation Subsystem, Monthly Challenges & Achievements
- What was requested / why: Implement the second iteration of Chorelenger introducing monthly challenges, thematic spotlighting, unlimited-count extra action buttons with instant logging/undo, objective monthly reward measurement (≥95% base execution and extra goal tracking), informational achievement badges, and Termux runtime flags.
- What changed:
  - `server/challenges.config.js`: Preset 12 monthly challenges with seasonal themes, spotlight categories, extra goal targets, and quick-tap extra button definitions.
  - `server/db.js`: Created `extra_completions` table with indices on month, extra_id, and done_date.
  - `server/motivation.js`: Implemented pure calculation functions for expected chore occurrences, monthly execution rates, reward qualification math, chore spotlight matching, and 9 milestone achievements.
  - `server/motivation.test.js`: Added 5 unit test suites validating recurrence math, edge cases, thresholds, and achievement unlocking.
  - `server/app.js` & `server/app.test.js`: Registered authenticated Fastify endpoints (`GET /api/challenge/current`, `POST /api/challenge/extra`, `DELETE /api/challenge/extra/:id`, `GET /api/motivation`) and added integration tests.
  - `web/src/main.jsx` & `web/src/style.css`: Added Today challenge banner with extra goal progress bar, quick-tap extra buttons with 6-second undo toast, spotlight chore badges, new Motivation tab with Monthly Reward cards and Achievements gallery, and client local date handling in History.
  - `package.json`: Updated `start` script with `--experimental-sqlite` for Node 22.5–22.12 on Termux.
- Verification: `npm test` 17 passing (unit and integration tests); `npm run build` bundled client assets successfully (0 errors).
- Open issues / follow-ups: Web push notifications deferred to Iteration 3.

## 2026-10-10 18:55 — Playwright E2E Black-Box Testing Setup
- What was requested / why: Set up Playwright end-to-end testing with black-box coverage across all critical user journeys.
- What changed:
  - Installed `@playwright/test` and Chromium browser binaries as dev dependencies.
  - `playwright.config.js`: Configured Playwright with in-process global setup / teardown serving the production web build against an isolated SQLite test database (`data/e2e-test.db`).
  - `e2e/test-helpers.js`: Created database reset and authentication test helpers.
  - `e2e/auth.spec.js`: Black-box tests for login screen visibility, invalid password error handling, and logout flow.
  - `e2e/chores.spec.js`: Black-box tests for chore creation (interval, flexible window, calendar yearly), editing, Today due status, one-tap done, 6-second undo toast, persistence across reload, and deletion.
  - `e2e/challenge-motivation.spec.js`: Black-box tests for monthly challenge banner, extra button click counter and undo, theme chore spotlighting, motivation reward cards, and unlocked/locked achievements.
  - `e2e/history.spec.js`: Black-box tests for monthly completion log display.
  - `package.json`: Added `test:e2e` script (`playwright test`).
  - `README.md` & `.gitignore`: Updated dev test commands and ignored Playwright report and artifact outputs.
- Verification: `npm run test:e2e` executed all 7 Playwright E2E tests in ~4.2s (all passing); `npm test` verified 17 unit and API tests pass; `npm run build` clean (0 errors).
- Open issues / follow-ups: None.

## 2026-10-10 19:41 — Iteration 3: Planned Items, Calendar Feed Sync & Google Calendar Intents
- What was requested / why: Implement planned items and calendar integration allowing users to capture one-off tasks with timeframes, generate 1-tap Google Calendar web intent links, sync external calendar events via private iCal feed URL polling (`webcal://` or `https://`), import `.ics` files, and utilize dual confirmation workflows ("Done" vs "Acknowledge") with 6-second undo toasts.
- What changed:
  - `server/calendar.js` & `server/calendar.test.js`: Built pure RFC 5545 parser and fetcher with line unfolding, timezone handling, and unit test suite.
  - `server/db.js`: Created `app_settings` and `planned_items` tables with date, status, and UID indices.
  - `server/app.js` & `server/app.test.js`: Added REST API routes (`/api/planned`, `/api/settings/calendar`, `/api/planned/import-ics`, `/api/planned/sync`, confirm/undo endpoints) and integration test suites.
  - `web/src/main.jsx` & `web/src/style.css`: Added Planned tab, visual source badges (`📝 One-Off Task` vs `📅 Calendar Event`), Google Calendar Web Intent link builder, dual confirmation actions, 6-second undo toast, and calendar sync settings with `.ics` dropzone.
  - `e2e/planned-items.spec.js`: Added Playwright E2E black-box test suite for planned task creation, Google Calendar link generation, iCal feed sync setup, .ics drag-and-drop, and confirmation/undo lifecycles.
  - `README.md` & `.planning/PROJECT.md`: Updated project requirements and status.
- Verification: `npm test` (24 passing unit & API tests); `npm run build` (client bundle built with 0 errors); `npm run test:e2e` (all 10 Playwright E2E tests passing).
- Open issues / follow-ups: Web push notifications deferred.

## 2026-10-10 20:15 — Fix Mobile View Layout Overflow & Planned Date Grouping
- What was requested / why: Fix mobile layout overflow in the Planned tab and fix date grouping where historical calendar events (e.g. from 8 years ago) were incorrectly grouped into "Today".
- What changed:
  - `web/src/main.jsx`: Corrected date grouping so "Today" strictly matches `start_date === todayStr`, added dedicated "Overdue" section for past pending items (`start_date < todayStr`), added date/time sorting per section, and separated date and time input rows in `PlannedItemForm` to prevent native mobile date/time picker crowding.
  - `web/src/style.css`: Added responsive styling with `@media (max-width: 520px)`, card stacking, flex wrapping on action buttons, word-break protections, and `overflow-x: hidden` to eliminate horizontal page overflow on small viewports.
  - `server/calendar.js`: Improved RFC 5545 date-time parsing for values with `VALUE=DATE:` or `VALUE=DATE-TIME:` prefixes, added URL whitespace trimming and redirect following in `fetchIcsFeed`, and provided clear error messaging when feed URLs return 404.
  - `server/calendar.test.js`: Updated unit test assertions for the enhanced 404 feed error message.
  - `e2e/planned-items.spec.js`: Added E2E tests verifying that past events from previous years are categorized into Overdue (not Today), and verifying mobile viewport rendering without horizontal page overflow.
- Verification: `npm test` (24/24 passing unit & API tests); `npm run build` (client bundle compiled cleanly in 57ms); `npm run test:e2e` (12/12 Playwright E2E tests passing).
- Open issues / follow-ups: None.

## 2026-10-10 20:30 — URL routing for main tabs
- What was requested / why: Main tabs shared one route; add real routes.
- What changed: `web/src/main.jsx` — dependency-free History API router (`useTabRoute`): `/`, `/planned`, `/chores`, `/motivation`, `/history`; nav pushes state, back/forward via `popstate`, unknown paths show Today. Server SPA fallback (`setNotFoundHandler`) already serves index.html for deep links.
- Verification: see below run of `npm run build` and `npm test`.
- Open issues / follow-ups: none.

## 2026-10-10 20:45 — Split web/src/main.jsx into modules
- What was requested / why: `main.jsx` was huge; split into separate files.
- What changed: `main.jsx` is now only the entry point (render + service worker). New: `App.jsx` (state, toast/undo, nav); `views/` (Today, Chores incl. ChoreForm, Planned incl. card/form, History, Motivation); `components/` (Login, ChoreCard, ChallengeBanner); `lib/` (dates.js, calendar.js, chores.jsx, router.js). Code moved verbatim, no behavior change.
- Verification: `npm run build` and `npm test` (results reported in session summary).
- Open issues / follow-ups: Playwright e2e not run.

## 2026-10-10 20:55 — Playwright e2e run after main.jsx split
- What was requested / why: user pointed out e2e should have been run after the refactor to catch regressions.
- What changed: nothing in code; ran `npm run build` then `npx playwright test`.
- Verification: Playwright 12/12 passed (6.5s); this also covers the earlier routing change. Unit/API tests 24/24 earlier.
- Open issues / follow-ups: Going forward, run `npm run test:e2e` in addition to `npm test` for any frontend change.

## 2026-10-10 20:25 — Commit routing and main.jsx split
- Requested: commit the tab routing and the `main.jsx` split.
- Changed: committed `web/src/` (App, views, components, lib, router) and `log.md`.
- Verification: build, `npm test` (24/24) and Playwright (12/12) passed before the commit.
- Open issues: none.

## 2026-10-10 20:55 — Compact icon-only Today screen
- Requested: overhaul the main Today screen for mobile: icon-only tiles, verbose labels toggle, misclick protection.
- Changed: `chores.icon` column (guarded migration in `server/db.js`, trimmed/32-char limit in `server/app.js`, API test); `ChoreIcon`/`choreIcon` in `web/src/lib/chores.jsx` (emoji, `img:<file>` served from `/icons/<file>` i.e. `web/public/icons/`, fallback to category emoji then first letter); icon input + suggestions in Chores form; new `ChoreTile.jsx`, `DoneSheet.jsx`; `Today.jsx` rewritten as status-grouped grid (upcoming = next 7 days) with sticky verbose toggle (localStorage `chorelenger.verbose`); tap tile -> bottom sheet -> Done (Undo toast kept); done-today tiles disabled; one-line `ChallengeBanner`; slim icon nav; CSS in `style.css`.
- Verification: `npm test` 25 pass, `npm run build` ok, Playwright 14 pass (existing specs updated to tap tile + confirm; new `e2e/today-grid.spec.js` covers cancel/confirm, verbose persistence, 24 chores fit 390x844).
- Follow-ups: add image assets under `web/public/icons/` and set a chore icon to `img:name.svg`; the service worker cache may need a bump for new assets.

## 2026-10-10 21:30 — Predefined categories, one-off chores, db:reset
- Requested: fixed categories (cleaning, household, health, misc) with emoji visible on Today and Chores; one-off chore type with no due date; local script to wipe the dev DB.
- Changed: `CATEGORIES` + validation in `server/app.js` (default `misc`, 400 otherwise; legacy DB values untouched); category select, `CategoryBadge` (emoji + colour) in `ChoreCard`, small emoji corner on `ChoreTile`, CSS; new `one_off` type: `schedule.js` (status `finished` once done, null dates), guarded table-rebuild migration in `server/db.js` (CHECK extended, ids/completions preserved), `motivation.js` expects 1 per one-off, form/labels in web; `server/reset-db.js` + `npm run db:reset` (refuses with NODE_ENV=production); README and `.planning/PROJECT.md` updated. Existing tests/e2e switched to valid categories.
- Decisions: no DB constraint on category so old values stay valid; one-off finished = has any completion; spotlight matching on legacy categories like `dog` no longer matches new chores (name matching still works).
- Verification: `npm test` and `npm run build` pass; db:reset checked manually. Playwright e2e not run.
- Open issues: e2e specs updated but not executed.

## 2026-10-10 22:30 — Refine calendar events (past filter, recurrence, Today acknowledgement)
- Requested: sync only current/future events, never re-import past ones, acknowledge calendar events from Today instead of Planned; recurring events as a single repeating item.
- Changed: `server/calendar.js` parses RRULE/EXDATE/RECURRENCE-ID (overrides ignored), adds `nextOccurrence`/`resolveUpcoming`; `server/db.js` adds `rrule`/`exdates` columns; `server/app.js` shared `upsertCalendarEvents` for sync + import-ics (past one-off rows untouched; recurring row advancing resets to pending), `recurring` in API; web: no Acknowledge on Planned (🔁 marker), bottom "Calendar" section on Today, App reloads on tab change; e2e/tests/README updated.
- Decisions: unsupported RRULE parts fall back to DTSTART only; UTC `Z` times still treated as local (unchanged).
- Verification: `npm test` 35 pass; `npm run build` ok; e2e planned-items 6 pass. `today-grid.spec.js` "confirm sheet" fails also without my changes (icon expectation 'V' vs '📌'), pre-existing.
- Follow-up: previously imported recurring rows get rrule on next sync.
