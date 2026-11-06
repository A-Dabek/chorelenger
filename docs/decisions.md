# Decisions (ADRs)

Short records: context → decision → consequence. Rationale lives here only; code
comments state *what*, not *why*.

## 1. Native `SpeechRecognizer` for v1, not cloud STT

**Context.** v1 is a personal app that must work with no API key, no network
setup, and no cost.
**Decision.** Use the system `android.speech.SpeechRecognizer`.
**Consequence.** Zero per-use cost and no key management; accuracy and offline
support depend on the device's recognizer. The cloud path is not blocked — see
ADR 5.

## 2. Kotlin + Jetpack Compose + Material 3, single module

**Context.** One screen, one user, no need for build modularization.
**Decision.** Kotlin, Compose, Material 3, one `:app` module.
**Consequence.** Fast iteration and simple builds; splitting modules later is
mechanical if the app grows.

## 3. Room for persistence over DataStore/JSON files

**Context.** Notes are a list that is inserted and deleted by id, and the UI
wants to observe changes.
**Decision.** Room (SQLite) with a `Flow`-returning DAO.
**Consequence.** Reactive queries and safe deletes for free; adds KSP to the
build. `exportSchema = false` — migrations are hand-written and tested (ADR 11).

## 4. No DI framework; `AppContainer` service locator

**Context.** Two collaborators, one Activity. Hilt/Koin would be more
machinery than code.
**Decision.** A hand-written `AppContainer`, owned by `ChorelengerApp`.
**Consequence.** Trivial to read and to swap wholesale in tests; no generated
DI graph, at the cost of manual wiring.

## 5. `TranscriptionService` interface as a future-backend seam

**Context.** A cloud or on-device transcription backend is expected later.
**Decision.** The ViewModel depends on a `TranscriptionService` interface, not
on `SpeechRecognizer` directly.
**Consequence.** Swapping backends is one new implementation plus a container
change; the UI and ViewModel are untouched.

## 6. Min SDK 26; prefer online recognition by default

**Context.** minSdk 26 (Android 8.0) covers essentially all in-use personal
devices and gives `java.time` and modern Compose support. Forcing
`EXTRA_PREFER_OFFLINE = true` fails immediately on devices that lack the
offline language pack (observed on a `en-PL` device).
**Decision.** `minSdk = 26`; set `EXTRA_PREFER_OFFLINE = false` and use the
system's default recognizer (not `createOnDeviceSpeechRecognizer`). The
recognition language is fixed to Polish (`pl`) in
`NativeTranscriptionService.RECOGNITION_LANGUAGE`.
**Consequence.** Recognition works out of the box and may use the network;
`INTERNET` is already declared. Switching back to offline-only is a one-line
change once the model is guaranteed to be present.

## 7. No audio file retained in v1

**Context.** The recognizer streams audio; the note is the transcript.
**Decision.** Never write audio to disk.
**Consequence.** Nothing to store, clean up, or leak; no playback or re-transcribe
feature is possible without adding recording later.

## 8. Test strategy: integration-first (testing trophy)

**Context.** For an end-user app the behaviour lives in the wiring of real
components; unit tests that mock everything prove little.
**Decision.** Widest layer is integration (real Room + ViewModel + Compose),
substantial e2e on device, small unit layer for pure logic. Fake only the
Android boundaries (speech, alarms, notifications).
**Consequence.** Tests exercise near-real behaviour and survive refactors, at
the cost of a slower suite. Details in [testing.md](testing.md).

## 9. Local notifications, not push/FCM

**Context.** A personal offline app with no backend should not depend on a
message broker or Google Play services.
**Decision.** Post reminders with `NotificationManagerCompat` from an
`AlarmManager` broadcast.
**Consequence.** Everything works offline and without accounts. Remote push,
multi-device delivery, and server-side scheduling are out of scope.

## 10. Inexact `AlarmManager`, no exact-alarm permission

**Context.** Reminders are chores measured in hours; delivery drifting by a few
minutes is acceptable. Exact alarms add a permission, a settings detour, and
Play policy burden.
**Decision.** Use `setAndAllowWhileIdle(RTC_WAKEUP, …)` and do not request
`SCHEDULE_EXACT_ALARM`.
**Consequence.** Alarms survive Doze but may be delayed. Exact delivery remains a
documented follow-up if it ever matters. Alarms do not survive an explicit
force-stop; the overdue row remains visible so the user can act on it.

## 11. Nullable reminder columns on `Note` + real migration

**Context.** A reminder is an ordinary note with a due time; a separate table
would add joins and lifecycle duplication.
**Decision.** Add nullable `reminderAt` and `reminderNotifiedAt` columns, bump
`AppDatabase` to version 2, and ship `MIGRATION_1_2`.
**Consequence.** One entity, one DAO, minimal code. Existing notes keep working;
`null` means "ordinary note". The migration is covered by a raw-v1 Robolectric
test.

## 12. Reminder rows sort first

**Context.** A due reminder is more urgent than a fresh note.
**Decision.** `observeAll()` orders reminders first by `reminderAt` ascending,
then ordinary notes newest-first.
**Consequence.** The list surfaces what needs action; overdue reminders sort at
the very top.

## 13. Swipe-right is the only reminder entry point

**Context.** This is a single-user personal app; the owner knows the gesture,
and the list UI deliberately avoids icons.
**Decision.** Use Material 3 `SwipeToDismissBox` with start-to-end enabled and a
dismiss callback that always returns `false`. No icon and no accessibility
custom action.
**Consequence.** The list stays clean and the row never disappears by accident.
The tradeoff is accepted explicitly: the gesture is not discoverable and
TalkBack users cannot reach the editor. A visible fallback remains out of scope.

## 14. Done deletes; Snooze is a fixed 24 hours

**Context.** Notes are short-lived and already deleted when done.
**Decision.** The notification's **Done** action deletes the note; **Snooze
24 h** measures 24 hours from the tap.
**Consequence.** No completed-reminder history and no per-reminder snooze
duration, keeping the model and UI small.

## 15. Three nullable recurrence columns on `Note` + migration 3

**Context.** A periodic reminder is still an ordinary note with a due time. A
separate recurrence table would add joins and lifecycle duplication.
**Decision.** Add nullable `recurrenceUnit`, `recurrenceCount`, and
`recurrenceMode` columns, bump `AppDatabase` to version 3, and ship
`MIGRATION_2_3`.
**Consequence.** One entity, one DAO, minimal code. Existing one-time reminders
and ordinary notes keep working with `NULL` recurrence columns. The migration is
covered by raw-v2 and raw-v1 Robolectric tests.

## 16. Absolute vs relative is one mode property

**Context.** The product asks for two ways to count the next occurrence, but
every field, action, table, and notification is otherwise identical.
**Decision.** Store only `recurrenceMode = ABSOLUTE | RELATIVE`; one pure
function chooses the base time (previous due vs Done tap).
**Consequence.** No separate recurrence structures or branches outside
`nextOccurrence`. Because there is no separate anchor column, a 24 h snooze
becomes the new previous due for absolute counting, shifting the chain by 24 h.

## 17. Absolute mode skips all past occurrences

**Context.** A recurring chore may be completed late or after several missed
intervals.
**Decision.** In `ABSOLUTE`, keep adding the interval to the previous due until
the result is strictly after the Done tap; schedule only that next future
occurrence.
**Consequence.** No catch-up notification burst and no completed-occurrence
history. Month-end dates clamp and drift (`Jan 31 → Feb 28 → Mar 28`); an anchor
column would be needed to preserve the original day-of-month.

## 18. Periodic Done advances; one-time Done deletes

**Context.** A recurring chore must survive a completion, while short-lived
notes should not.
**Decision.** `onDone` branches on `isPeriodic`: periodic items get the next
due and keep their note; one-time items are deleted.
**Consequence.** The notification action layer stays unaware of completion
semantics; `ReminderActions` is the only place that decides.

## 19. Repeats tab separates periodic items from the microphone list

**Context.** Periodic chores are a different mental model from quick notes and
should not be mixed with the record-first list.
**Decision.** Add a bottom Material 3 `NavigationBar` with **Notes** and
**Repeats**. Notes keeps the record button, ordinary notes, and one-time
reminders; Repeats shows periodic items by next due and has no microphone.
**Consequence.** No navigation dependency and no change to the recording flow.
A periodic item whose recurrence is removed returns to Notes as an ordinary
note.

## 20. One-time reminders keep the hours-from-now editor

**Context.** The existing one-time flow is simple and understood by the user.
**Decision.** Keep the numeric hours field, presets, bounds, and due preview
computed from **now** for one-time reminders. Only the periodic branch gains
date/time and recurrence steps.
**Consequence.** Existing behaviour and tests remain valid behind the new type
step; periodic scheduling gets richer input without complicating one-time
reminders.


