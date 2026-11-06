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
  sanitization (`SanitizeNoteTextTest`), and reminder time math/labels
  (`ReminderTimeTest`): trigger math, bounds, remaining-hours rounding, future /
  near-future / overdue labels.
- **Integration (Robolectric)** —
  - `NoteDaoTest`: insert, order, delete, `getById`, `allReminders`, reminder
    setters, reminder-first ordering.
  - `AppDatabaseMigrationTest`: raw v1 database → `MIGRATION_1_2` → note survives,
    new columns are null.
  - `ReminderActionsTest`: real Room + fake scheduler/notifier + fake clock:
    alarm fires once, duplicate alarm ignored, stale alarm reschedules, boot
    reschedule, snooze, done, clear, delete.
  - `AlarmReminderSchedulerTest` / `AndroidReminderNotifierTest`: ShadowAlarmManager
    and ShadowNotificationManager boundaries (channel, title, big text, actions,
    cancel).
  - `NotesViewModelTest`: result→insert, blank rejected, order, delete, button
    toggle, release, reminder draft defaults, confirm, dismiss, remove.
  - `HomeScreenTest`: record→note, delete→empty, partial text, newest-first,
    unavailable notice, swipe→editor, confirm→badge, cancel, prefill, remove,
    delete cancellation, invalid hours.
  - `DefaultAppContainerTest`: real wiring.
- **E2E (instrumented)** — `MainActivityE2ETest`: record→note→idle, delete,
  newest-first, network-error snackbar + retry, permission-denied message,
  notes surviving Activity recreation, swipe→set reminder→badge, reminder
  surviving recreation, alarm broadcast→notification, Done broadcast→delete,
  Snooze broadcast→reschedule. `NoteDaoInstrumentedTest` mirrors the critical
  DAO path, including reminder columns.

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
- [ ] Swipe a note right → editor opens with 24 h; confirm → due label appears
      and the reminder sorts above ordinary notes.
- [ ] Wait until due → heads-up notification shows the note text and both
      actions.
- [ ] **Done** → notification disappears and the row is deleted.
- [ ] **Snooze 24 h** → notification disappears; row shows a due time 24 h out.
- [ ] Reboot with a future reminder → notification still fires.
- [ ] Reminder became due while powered off → delivered once after boot, not
      duplicated on later boots.
- [ ] Deny `POST_NOTIFICATIONS` → reminder is saved; the app explains that
      notifications are off; row/badge still correct.
- [ ] Delete a reminder → no notification later.
- [ ] Device in Doze → reminder still arrives (may drift a few minutes).
- [ ] Swipe starting away from the screen edge does not trigger system back.
