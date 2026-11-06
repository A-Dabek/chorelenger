# Architecture

Two screens, two Android seams, no framework. The app is small on purpose.

```
┌──────────────────────────────────────────────────────────────┐
│ UI (Compose)                                                 │
│  HomeScreen / NoteRow ──swipe──▶ ReminderScreen              │
│  pure function of NotesViewModel state                       │
└───────────────▲───────────────────────────────┬──────────────┘
                │ StateFlow                     │ events
┌───────────────┴───────────────────────────────▼──────────────┐
│ NotesViewModel                                               │
│  notes: StateFlow<List<Note>>      ← NoteDao                 │
│  voiceState: StateFlow<VoiceState> ← TranscriptionService    │
│  reminderDraft: StateFlow<ReminderDraft?>                    │
│  consumes Result → inserts Note → returns UI to Idle         │
└───────┬───────────────────────────┬──────────────────────────┘
        │                           │
┌───────▼──────────────┐   ┌────────▼─────────────────────────┐
│ data                 │   │ reminders                        │
│ NoteDao / AppDatabase│   │ ReminderActions                  │
│ Room (SQLite)        │   │  ├ ReminderScheduler (AlarmManager)│
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

1. User taps the record button. `HomeScreen` asks for the mic permission if
   needed, then calls `NotesViewModel.onRecordButtonTap()`.
2. The ViewModel toggles the seamed service: `start()` when not listening,
   `stop()` when listening.
3. `NativeTranscriptionService` drives `SpeechRecognizer` on the main thread
   and publishes to a single `StateFlow<VoiceState>`.
4. Partial results update `VoiceState.Listening(partial)`; the UI mirrors them.
5. A final result becomes `VoiceState.Result(text)`.
6. The ViewModel consumes the result, trims it, inserts a `Note`, and returns
   its state to `Idle`. The new note flows back through Room into the list.

## Data flow (one reminder)

1. The user swipes a row right. `NoteRow` asks the ViewModel for a
   `ReminderDraft`; the row snaps back because the dismiss callback always
   returns `false`.
2. `ReminderScreen` edits the hours and shows a live absolute due time.
3. Confirm computes `reminderAt = now + hours`, persists it, schedules an
   inexact `AlarmManager` wakeup, and closes the editor.
4. At the due time `ReminderAlarmReceiver` calls `ReminderActions.onAlarmFired`,
   which posts the notification once and records `reminderNotifiedAt`.
5. **Done** broadcasts to `ReminderActionReceiver` → delete the note and cancel
   both boundaries. **Snooze 24 h** resets `reminderAt`, clears the notified
   flag, reschedules, and cancels the notification.
6. `ReminderBootReceiver` re-arms every future reminder after reboot or app
   update; already-notified reminders are cancelled instead of re-delivered.

## Responsibilities

| Component | Owns |
|---|---|
| `HomeScreen` / `NoteRow` | Rendering, permissions, swipe entry, badges |
| `ReminderScreen` | Hours input, validation, due preview |
| `NotesViewModel` | UI state, draft state, insert/delete, reminder commands |
| `NoteDao` / `AppDatabase` | Durable storage, reminder-first ordering, migration |
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
Compose tree, `ReminderActions` — is exercised for real in tests. A future
backend (OpenRouter STT, an on-device model) implements `TranscriptionService`
and is swapped through `AppContainer`; nothing above it changes.
