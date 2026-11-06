# Architecture

Two tabs, one full-screen wizard, two Android seams, no framework. The app is
small on purpose.

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Compose)                                                 │
│  HomeScreen ── NavigationBar: Notes | Repeats                │
│  NoteRow ──swipe──▶ ReminderScreen (type-aware wizard)       │
│  pure function of NotesViewModel state                       │
└───────────────▲───────────────────────────────┬──────────────┘
                │ StateFlow                     │ events
┌───────────────┴───────────────────────────────▼──────────────┐
│ NotesViewModel                                               │
│  notes: StateFlow<List<Note>>          ← observeActive()     │
│  periodicNotes: StateFlow<List<Note>>  ← observePeriodic()   │
│  voiceState: StateFlow<VoiceState>     ← TranscriptionService│
│  reminderDraft: StateFlow<ReminderDraft?>                    │
│  consumes Result → inserts Note → returns UI to Idle         │
└───────┬───────────────────────────┬──────────────────────────┘
        │                           │
┌───────▼──────────────┐   ┌────────▼─────────────────────────┐
│ data                 │   │ reminders                        │
│ NoteDao / AppDatabase│   │ ReminderActions                  │
│ Room (SQLite)        │   │  ├ Recurrence (pure math)        │
│ Recurrence enums     │   │  ├ ReminderScheduler (AlarmManager)│
└──────────────────────┘   │  └ ReminderNotifier (local notify)│
                           └────────▲─────────────────────────┘
                                    │ broadcasts
                           ┌────────┴─────────────────────────┐
                           │ ReminderAlarmReceiver            │
                           │ ReminderActionReceiver (Done/    │
                           │   Snooze)                        │
                           │ ReminderBootReceiver             │
                           └──────────────────────────────────┘

┌──────────────────────────────┐
│ speech                       │
│ TranscriptionService         │
│  └ NativeTranscriptionService│
│     (system SpeechRecognizer)│
└──────────────────────────────┘
```

## Data flow (one recording)

1. User taps the record button on the **Notes** tab. `HomeScreen` asks for the
   mic permission if needed, then calls `NotesViewModel.onRecordButtonTap()`.
2. The ViewModel toggles the seamed service: `start()` when not listening,
   `stop()` when listening.
3. `NativeTranscriptionService` drives `SpeechRecognizer` on the main thread
   and publishes to a single `StateFlow<VoiceState>`.
4. Partial results update `VoiceState.Listening(partial)`; the UI mirrors them.
5. A final result becomes `VoiceState.Result(text)`.
6. The ViewModel consumes the result, trims it, inserts a `Note`, and returns
   its state to `Idle`. The new note flows back through Room into the list.

## Data flow (one-time reminder)

1. The user swipes a row right. `NoteRow` asks the ViewModel for a
   `ReminderDraft`; the row snaps back because the dismiss callback always
   returns `false`.
2. `ReminderScreen` starts on the type step with `One-time` preselected for an
   existing one-time reminder. The one-time branch keeps the hours-from-now
   editor and shows a live absolute due time computed from **now**.
3. Confirm computes `reminderAt = now + hours`, clears any recurrence columns,
   persists it, schedules an inexact `AlarmManager` wakeup, and closes the
   editor. The row stays in **Notes**.
4. At the due time `ReminderAlarmReceiver` calls `ReminderActions.onAlarmFired`,
   which posts the notification once and records `reminderNotifiedAt`.
5. **Done** broadcasts to `ReminderActionReceiver` → delete the note and cancel
   both boundaries. **Snooze 24 h** resets `reminderAt`, clears the notified
   flag, reschedules, and cancels the notification.
6. `ReminderBootReceiver` re-arms every future reminder after reboot or app
   update; already-notified reminders are cancelled instead of re-delivered.

## Data flow (periodic reminder)

1. The wizard asks for a type. `Periodic` leads through first execution,
   interval (`DAYS`/`WEEKS`/`MONTHS`), and counting mode (`ABSOLUTE`/`RELATIVE`).
2. Confirm persists `reminderAt`, `recurrenceUnit`, `recurrenceCount`, and
   `recurrenceMode`, schedules the first alarm, and the item moves from
   **Notes** to **Repeats**.
3. At each due time the same alarm path posts a notification titled
   `Repeating reminder` with the recurrence description as subtext.
4. **Done** calls `ReminderActions.onDone`. For periodic items it computes the
   next due through the single pure `nextOccurrence` function, stores it,
   reschedules, and cancels the current notification. One-time Done still
   deletes the note.
5. **Snooze 24 h** advances the due time without touching recurrence fields.
6. `rescheduleAll` covers periodic items too: future dues are re-armed and
   already-notified overdue items are cancelled.

## The single recurrence decision point

`reminders/Recurrence.kt` owns the only place where the next occurrence is
calculated:

```
nextOccurrence(spec, previousDueAt, completedAt, zone)
  ABSOLUTE → previousDueAt + interval, repeated until > completedAt
  RELATIVE → completedAt + interval
  addUnits → java.time plusDays / plusWeeks / plusMonths in the local zone
```

Every other flow — editing, tabs, notifications, Done, Snooze, boot — is shared
between absolute and relative. Only the base time differs.

## Responsibilities

| Component | Owns |
|---|---|
| `HomeScreen` / `NoteRow` | Rendering, permissions, tabs, swipe entry, badges |
| `ReminderScreen` | Type-aware wizard: type, first execution, interval, mode |
| `NotesViewModel` | UI state, active/periodic flows, draft state, reminder commands |
| `NoteDao` / `AppDatabase` | Durable storage, tab queries, recurrence columns, migrations |
| `Recurrence` (data) | Enums and Room enum converters |
| `Recurrence` (reminders) | Pure next-occurrence math, validation, labels |
| `TranscriptionService` | Speech-to-text contract |
| `NativeTranscriptionService` | System recognizer plumbing + error mapping |
| `ReminderActions` | Set/clear/delete/snooze/done/alarm use-cases |
| `ReminderScheduler` | Alarm boundary |
| `AlarmReminderScheduler` | `AlarmManager.setAndAllowWhileIdle` |
| `ReminderNotifier` | Notification boundary |
| `AndroidReminderNotifier` | Channel, notification, Done/Snooze actions |
| Receivers | Thin `goAsync` adapters into `ReminderActions` |
| `AppContainer` | Wiring; the swap point for tests and future backends |

## The seams

`TranscriptionService`, `ReminderScheduler`, and `ReminderNotifier` are the only
non-testable external boundaries. Everything else — Room, the ViewModel, the
Compose tree, `ReminderActions`, recurrence math — is exercised for real in
tests. A future backend (OpenRouter STT, an on-device model) implements
`TranscriptionService` and is swapped through `AppContainer`; nothing above it
changes.
