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
| `main/java/…/ChorelengerApp.kt` | `Application`; owns the container |
| `main/java/…/AppContainer.kt` | Service-locator interface (test/backend swap) |
| `main/java/…/DefaultAppContainer.kt` | Real Room + native speech wiring |
| `main/java/…/MainActivity.kt` | Builds the ViewModel, sets content |
| `main/java/…/data/` | `Note`, `NoteDao`, `AppDatabase` |
| `main/java/…/speech/` | `TranscriptionService`, native impl, `VoiceState`, `VoiceError` |
| `main/java/…/ui/` | `HomeScreen`, `NoteRow`, `NotesViewModel`, `TestTags`, theme |
| `main/res/` | Manifest-declared strings, theme, launcher icon |
| `test/` | Robolectric integration + Compose UI + pure unit tests |
| `androidTest/` | Instrumented DAO test + `MainActivity` e2e journeys |

## Naming conventions

- Packages: `dev.dombeg.chorelenger.<layer>` — `data`, `speech`, `ui`.
- Composables: `PascalCase`, no `Composable`/`Screen` suffix beyond the file's
  own name (`HomeScreen`, `NoteRow`).
- ViewModel: `<Feature>ViewModel`; its state is exposed as `StateFlow`
  (`notes`, `voiceState`).
- Room: entity `Note`, DAO `NoteDao`, database `AppDatabase`.
- Test tags live in `ui/TestTags.kt` so both test source sets select the same
  nodes; never match on layout structure.
- Test doubles keep the real type name with a `Fake` prefix
  (`FakeTranscriptionService`).
