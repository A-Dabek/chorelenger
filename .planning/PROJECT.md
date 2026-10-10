# Chorelenger

## What This Is

A mobile-first progressive web app for one person — me — that reminds, tracks, and motivates me to do chores of every kind: cleaning the house, replacing filters, yearly doctor appointments, taking care of the dog, going out for a bike. It tracks what needs doing and when, lets me tap it done, and layers a motivation system on top: monthly themed challenges, unlimited-count "extra" buttons, informational achievements, and a measured monthly reward.

## Core Value

I always know what needs doing and when — and actually doing it feels worthwhile. If everything else fails, reliably tracking recurring chores and marking them done must work.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Chores have names, categories, and can be created/edited/deleted
- [ ] A chore can recur by fixed interval (every N days/weeks/months), by calendar date (annual/specific date), or as a flexible window ("every ~2 months, whenever")
- [ ] A dashboard shows what's due today / overdue / upcoming
- [ ] Marking a regular chore done is a single tap (no effort rating, no required note)
- [ ] Completion history is recorded per chore and per month
- [ ] Configurable push notifications per chore, plus a due-today dashboard view
- [ ] Monthly themed challenges (e.g. "Month of the Pets") spotlight related chores and grant bonus credit during the month
- [ ] Active challenges add unlimited-count "extra" buttons (e.g. "Pet dog") that can be tapped any time and increment a counter for the theme
- [ ] Extra buttons exist only during their themed month and disappear afterwards
- [ ] Informational achievements are awarded for patterns (e.g. "cleaned the house 3 months in a row, no skips")
- [ ] Monthly reward measurement: base reward when execution ≥ 95% for the month; extra reward when extra executions of the monthly goal reach a threshold
- [ ] The app only measures whether a reward was achieved — real-life rewarding is done by me
- [ ] Project is a PWA (installable, mobile-first) backed by a Node.js + SQLite API
- [ ] Data persists in SQLite on the self-hosted backend
- [ ] Single-user authentication protects the app because it is reachable over the internet
- [ ] App is self-hosted on Termux (Android) and reachable internet-wide
- [ ] Planned items & calendar integration: capture one-off tasks with Google Calendar web intent link generation, read-only iCal feed sync/polling, .ics drop import, and dual confirmation lifecycles (Done vs Acknowledge)

### Out of Scope

- Multi-user, accounts for others, sharing, or social features — personal, single-user app
- Native app-store builds — PWA only
- In-app reward redemption or real-life budget tracking — app measures achievement; I reward myself
- Effort/quality ratings on regular chores — completion is intentionally frictionless (tap only)
- Configurable reward/achievement thresholds in v1 — fixed sensible defaults; configurability deferred
- "Flat" chore types beyond the three recurrence models (interval, calendar date, flexible window)
- Two-way background OAuth2 calendar write sync (web intent provides instant 1-tap push without credential or token maintenance)

## Context

- Personal project for a single user (me). No team, no other users, no monetization.
- The motivation design is the differentiator: achievements are pure informational dopamine hits; rewards are the dedication mechanism, measured objectively by the app.
- Chores intentionally include positive/leisure activities too (bike rides, playing with the dog), not only obligations.
- Self-hosting reality: Termux on Android runs the Node.js backend and SQLite; the phone is the server. Background process survival, doze/battery behavior, and restart resilience are real operational concerns.
- Internet-wide access means HTTPS and authentication are required, not optional — this is the main security surface.

## Constraints

- **Tech stack**: Node.js backend (Express/Fastify) + SQLite database + PWA frontend — chosen for Termux compatibility and a single language across the stack.
- **Hosting**: Self-hosted on Termux on Android, exposed to the internet — requires a secure tunnel/reverse proxy and TLS.
- **Security**: Single-user auth is mandatory because the app is internet-reachable.
- **Platform**: PWA only — no native/App Store distribution.
- **Notifications**: Web push via service worker (VAPID) over HTTPS; iOS PWA push support is limited, primary target is Android.
- **Configuration**: Reward thresholds fixed for v1 (e.g. base at ≥ 95% execution); no settings UI for them yet.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Platform: PWA | No app-store friction, installable on phone, same code on any device | — Pending |
| Backend: Node.js + SQLite | Runs in Termux; one language for API and app | — Pending |
| Self-host on Termux, internet-wide | Always available from anywhere; keeps data private and owned | — Pending |
| Recurrence: mixed (interval / calendar date / flexible window) | Real chores don't fit one model | — Pending |
| Chore completion: tap only | Frictionless tracking; effort is inferred elsewhere | — Pending |
| Challenge effect: spotlight + bonus | Reinforces themes without complicating core tracking | — Pending |
| Extras: theme-time only, unlimited count | Temporary thematic buttons avoid permanent UI clutter | — Pending |
| Achievements: informational only | Pure motivation, no mechanism attached | — Pending |
| Rewards: app measures only, fixed thresholds | Keeps scope small; I handle real-life reward | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Business Context check (if present) — customer, revenue model, success metric still accurate?
4. Audit Out of Scope — reasons still valid?
5. Update Context with current state (users, feedback, metrics)

---
*Last updated: 2026-10-05 after initialization*
