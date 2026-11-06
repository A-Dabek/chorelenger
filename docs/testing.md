# Testing

The suite is integration-first ("testing trophy"), not a pyramid: the widest
layer wires real components together, e2e covers full journeys, and pure unit
tests are the exception. Fake only the Android boundaries.

```
  static  (compiler, lint)          always on
  ┌─────┐
  │unit │  small       – pure logic only
  ├─────┤
  │ e2e │  substantial – full user journeys
  ├─────┤
  │intg.│  widest      – real components wired together
  └─────┘
```

## Layers

| Layer | Runs on | Real | Faked |
|---|---|---|---|
| Unit | JVM | pure functions | everything |
| Integration | JVM (Robolectric) | Room, ViewModel, Compose, `ReminderActions` | speech, alarms, notifications |
| E2E | device/emulator | Activity, Room, Compose, receivers | speech, alarms, notifications |

## What is tested where

- **Unit** — `VoiceError` error-code mapping (`VoiceErrorMappingTest`), note
  sanitization (`SanitizeNoteTextTest`), reminder time math/labels
  (`ReminderTimeTest`), and recurrence math/labels (`RecurrenceTest`): relative
  and absolute days/weeks/months, late-completion skipping, month-end clamping
  and drift, DST wall-clock preservation, descriptions, count and first-due
  validation.
- **Integration (Robolectric)** —
  - `NoteDaoTest`: insert, order, delete, `getById`, `allReminders`, one-time and
    periodic setters, advance, clear, active/periodic queries and ordering.
  - `AppDatabaseMigrationTest`: raw v1 → v3 and raw v2 → v3; existing notes and
    one-time reminders survive, recurrence columns are null.
  - `ReminderActionsTest`: real Room + fake scheduler/notifier + fake clock:
    one-time/periodic setters, alarm fires once, duplicate alarm ignored, stale
    alarm reschedules, boot reschedule, one-time Done deletes, absolute/relative
    periodic Done advances, missed occurrences skipped, snooze keeps recurrence,
    clear/delete cancel.
  - `AlarmReminderSchedulerTest` / `AndroidReminderNotifierTest`: ShadowAlarmManager
    and ShadowNotificationManager boundaries (channel, one-time/periodic title,
    subtext, actions, cancel).
  - `NotesViewModelTest`: result→insert, blank rejected, order, delete, button
    toggle, release, draft defaults, recurrence prefill, one-time/periodic
    confirm, validation, type switching, remove.
  - `HomeScreenTest`: record→note, delete→empty, partial text, newest-first,
    unavailable notice, tabs, swipe→type step, one-time hours flow, periodic
    creation→Repeats, recurrence label, periodic→one-time, one-time→periodic,
    remove repeat, invalid hours/count.
  - `DefaultAppContainerTest`: real wiring.
- **E2E (instrumented)** — `MainActivityE2ETest`: record→note→idle, delete,
  newest-first, network-error snackbar + retry, permission-denied message,
  notes surviving Activity recreation, one-time reminder journeys, periodic
  creation and tab persistence, periodic Done advancing, periodic Snooze,
  alarm broadcast→notification. `NoteDaoInstrumentedTest` mirrors the critical
  DAO path, including recurrence columns.

## The only fakes

The Android boundaries are replaced by deterministic doubles:

- `FakeTranscriptionService` drives `Listening`, `Result`, and `Error`.
- `FakeReminderScheduler` records scheduled trigger times and cancels.
- `FakeReminderNotifier` records shown notes and notification cancels.

Nothing else is mocked. Room, Compose, the ViewModel, and `ReminderActions` are
real in integration tests.

## How the Activity gets the fakes

`MainActivity` reads the container from `ChorelengerApp`. In instrumented tests
`TestContainerRule` sets a `TestAppContainer` (in-memory Room + fake speech,
scheduler, notifier) *before* the Activity-launching compose rule runs, via JUnit
rule ordering. The test container reports both permissions as granted, so E2E
never opens a system dialog (some OEM builds forbid programmatic grants). The
real permission flows are covered by the manual checklist.

## Commands

| Command | Runs |
|---|---|
| `./gradlew testDebugUnitTest` | Robolectric integration + Compose UI + unit |
| `./gradlew assembleDebug` | build gate |
| `./gradlew connectedDebugAndroidTest` | instrumented DAO + e2e (needs a device) |
| `scripts/run-android-tests.sh` | same instrumented tests through `adb`, bypassing UTP |

### Offline caveat (UTP)

`connectedDebugAndroidTest` is driven by AGP's Unified Test Platform (UTP),
whose runner artifacts may be absent from an offline Gradle cache. When the
task fails at `_internal-unified-test-platform-...`, either populate the cache
once with network, or run the same tests through `adb`:

```sh
scripts/run-android-tests.sh
```

That script builds/installs both APKs and invokes
`androidx.test.runner.AndroidJUnitRunner` directly with `adb shell am
instrument`; it runs the identical instrumented tests, bypassing UTP.

If the phone appears twice in `adb devices` (e.g. an IP entry and an mDNS
entry), disconnect the duplicate or pass `ANDROID_SERIAL=<serial>`; otherwise
installs collide with `INSTALL_FAILED_DUPLICATE_PACKAGE`.

## Manual smoke checklist (on device)

- [ ] First tap prompts for mic permission.
- [ ] Deny → clear message, no crash.
- [ ] Grant → tap, speak → live partial text → stop → note at top of list.
- [ ] Silence auto-stop produces a note without a second tap.
- [ ] Kill + reopen → notes still present.
- [ ] Delete → gone immediately and after restart.
- [ ] Airplane mode → error snackbar, retry works.
- [ ] Device without speech service → button disabled with explanation.
- [ ] Swipe a note right → wizard opens on the type step with 24 h default for
      one-time.
- [ ] Choose One-time, confirm → due label appears and the reminder sorts above
      ordinary notes.
- [ ] Wait until due → heads-up notification shows the note text and both
      actions.
- [ ] **Done** (one-time) → notification disappears and the row is deleted.
- [ ] **Snooze 24 h** → notification disappears; row shows a due time 24 h out.
- [ ] Swipe a note right → choose Periodic.
- [ ] Pick a first date/time in the future; set `2 days`; choose Absolute.
- [ ] Confirm → item disappears from Notes and appears in Repeats; no mic on
      the Repeats tab.
- [ ] Swipe the periodic row → editor opens with the current values; Cancel
      leaves it unchanged.
- [ ] Wait until due → notification title `Repeating reminder`, both actions.
- [ ] Done (periodic) → item remains in Repeats with the next due advanced by
      the interval.
- [ ] Snooze 24 h (periodic) → notification disappears; item due moves 24 h out.
- [ ] Absolute item missed several intervals → Done skips all missed
      occurrences and schedules the next future one.
- [ ] Relative item done late → next due is counted from the Done tap.
- [ ] Switch a periodic item to one-time → it returns to Notes.
- [ ] Remove repeat → item becomes an ordinary note in Notes.
- [ ] Reboot with a future periodic reminder → notification still fires.
- [ ] Deny `POST_NOTIFICATIONS` → periodic item is saved and visible in
      Repeats.
- [ ] Existing one-time reminder from the old version still appears in Notes and
      fires as before.
- [ ] Delete a periodic item → no future notification.
- [ ] Reminder became due while powered off → delivered once after boot, not
      duplicated on later boots.
- [ ] Device in Doze → reminder still arrives (may drift a few minutes).
- [ ] Swipe starting away from the screen edge does not trigger system back.
