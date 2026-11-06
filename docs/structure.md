# Structure

```
chorelenger/
├── settings.gradle.kts        repos + :app
├── build.gradle.kts           root plugins
├── gradle.properties
├── gradle/libs.versions.toml  version catalog
├── gradle/wrapper/…           Gradle wrapper (committed)
├── gradlew, gradlew.bat       committed
├── local.properties           sdk.dir (gitignored)
├── docs/                      this documentation
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/
        ├── main/                       production code + resources
        ├── test/                       JVM: Robolectric + Compose + unit
        └── androidTest/                instrumented: Room + Compose e2e
```

## What lives where

| Path | Contents |
|---|---|
| `main/java/…/ChorelengerApp.kt` | `Application`; owns the container, creates the notification channel |
| `main/java/…/AppContainer.kt` | Service-locator interface (test/backend swap) |
| `main/java/…/DefaultAppContainer.kt` | Real Room + native speech + alarm/notification wiring |
| `main/java/…/MainActivity.kt` | Builds the ViewModel, sets content |
| `main/java/…/data/` | `Note`, `NoteDao`, `AppDatabase`, `MIGRATION_1_2` |
| `main/java/…/speech/` | `TranscriptionService`, native impl, `VoiceState`, `VoiceError` |
| `main/java/…/reminders/` | `ReminderActions`, scheduler/notifier seams and Android impls, intents, receivers, time math |
| `main/java/…/ui/` | `HomeScreen`, `NoteRow`, `ReminderScreen`, `NotesViewModel`, `TestTags`, theme |
| `main/res/` | Manifest-declared strings, theme, launcher icon, notification icon |
| `test/` | Robolectric integration + Compose UI + pure unit tests, fakes |
| `androidTest/` | Instrumented DAO test + `MainActivity` e2e journeys, fakes |

## Reminder files

| File | Role |
|---|---|
| `reminders/ReminderTime.kt` | Pure hours↔trigger math, labels, due-date formatting |
| `reminders/ReminderActions.kt` | set / clear / delete / alarm / done / snooze / reschedule |
| `reminders/ReminderScheduler.kt` | Alarm seam |
| `reminders/AlarmReminderScheduler.kt` | `AlarmManager` boundary |
| `reminders/ReminderNotifier.kt` | Notification seam |
| `reminders/AndroidReminderNotifier.kt` | Channel, notification builder, actions |
| `reminders/ReminderIntents.kt` | Actions, extras, request codes, PendingIntents |
| `reminders/ReminderAlarmReceiver.kt` | Due alarm → `onAlarmFired` |
| `reminders/ReminderActionReceiver.kt` | Done / Snooze → `onDone` / `onSnooze` |
| `reminders/ReminderBootReceiver.kt` | Boot / package replaced → `rescheduleAll` |
| `ui/ReminderScreen.kt` | Full-screen editor |

## Naming conventions

- Packages: `dev.dombeg.chorelenger.<layer>` — `data`, `speech`, `reminders`,
  `ui`.
- Composables: `PascalCase`, no `Composable`/`Screen` suffix beyond the file's
  own name (`HomeScreen`, `NoteRow`, `ReminderScreen`).
- ViewModel: `<Feature>ViewModel`; its state is exposed as `StateFlow`
  (`notes`, `voiceState`, `reminderDraft`).
- Room: entity `Note`, DAO `NoteDao`, database `AppDatabase`.
- Reminder use-cases live in `ReminderActions`; receivers stay thin.
- Test tags live in `ui/TestTags.kt` so both test source sets select the same
  nodes; never match on layout structure.
- Test doubles keep the real type name with a `Fake` prefix
  (`FakeTranscriptionService`, `FakeReminderScheduler`, `FakeReminderNotifier`).
