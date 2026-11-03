# Chorelenger v1 — Voice Notes (native Android)

Status: READY TO BUILD
Scope: first iteration, personal use, single user, single device.

---

## 1. Goal

A dead-simple Android app that turns spoken words into short-lived notes.

Primary use case: after a conversation, pick up the phone, tap one giant button,
say "wife told me to walk the dog in the evening", and get a note that can be
deleted when done.

### In scope (v1)
- One screen. Giant record button + list of notes.
- Tap to start listening, tap to stop. Speech is transcribed by the **native
  Android `SpeechRecognizer`** (no cloud, no API key, no OpenRouter in v1).
- Each transcript becomes a note. Live partial text shown while listening.
- Delete any note (per-row button).
- Notes persist across app restarts (local DB only).
- Extensive automated tests, integration-first (trophy): wide integration,
  substantial e2e, minimal unit.
- `/docs` describing architecture, decisions, structure, testing, dev setup.

### Explicitly out of scope (v1)
- OpenRouter / any network transcription. (Kept as a future plug-in point.)
- Editing notes, search, sort menus, tags, due dates, notifications.
- Accounts, sync, backup, export.
- Recording audio to a file (native recognizer streams; no file is kept).
- Release signing / Play Store. Debug APK side-load is enough.
- Dependency-injection framework (a tiny service locator is enough).

### Future direction (do not build now, but do not block)
- Chorelenger implies chores/reminders eventually: due dates + notifications,
  note editing, search. All standard Android UI, no exotic tech.
- A transcription backend switch (native vs OpenRouter STT vs on-device model).
  The `TranscriptionService` interface exists so this is a swap, not a rewrite.

---

## 2. Stack

Native Android, Kotlin, Jetpack Compose. Single Gradle module (`:app`).

| Concern | Choice |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose + Material 3 |
| Async/state | Kotlin coroutines + `StateFlow` |
| Persistence | Room (SQLite) |
| Speech | `android.speech.SpeechRecognizer` (system) |
| DI | none — a hand-written `AppContainer` service locator |
| Min SDK | 26 (Android 8.0) |
| Target/compile SDK | 35 (bump to latest stable at scaffold time) |
| JDK | 17 |

No Hilt/Koin, no Retrofit/OkHttp (no network in v1). Testability is provided by
constructor injection + a swappable application-level container (see §7.4).

### Version baseline

Use a Gradle **version catalog** (`gradle/libs.versions.toml`). Pin to a
known-good baseline and prefer the latest stable the installed SDK offers at
scaffold time:

| Dependency | Baseline |
|---|---|
| Android Gradle Plugin | 8.7.x |
| Kotlin | 2.0.x |
| Compose BOM | latest stable (e.g. 2024.09.x) |
| Compose Compiler | supplied by Kotlin 2.x plugin |
| Room | 2.6.x |
| Lifecycle / ViewModel Compose | 2.8.x |
| Activity Compose | 1.9.x |
| Core KTX | 1.13.x |
| JUnit 4 | 4.13.2 |
| kotlinx-coroutines-test | matching coroutines version |
| Robolectric | 4.13.x |
| androidx.test.ext:junit | 1.2.x |
| androidx.test:runner / core / rules | 1.6.x / 1.6.x / 1.6.x |
| Compose `ui-test-junit4` / `ui-test-manifest` | from Compose BOM |
| Room `room-testing` | matches Room |

> Scaffolder MUST re-check these against what the SDK Manager actually installs
> and bump to the latest stable rather than fighting a version mismatch.

---

## 3. Project layout

```
chorelenger/
├── settings.gradle.kts              # repos + :app
├── build.gradle.kts                 # root, plugin versions via catalog
├── gradle.properties
├── gradle/libs.versions.toml
├── gradle/wrapper/…                 # COMMIT the wrapper
├── gradlew, gradlew.bat             # COMMIT
├── local.properties                 # sdk.dir=…  → GITIGNORED
├── docs/                            # see §4
└── app/
    ├── build.gradle.kts
    ├── proguard-rules.pro
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   ├── res/…                # themes, strings, launcher icon
        │   └── java/dev/dombeg/chorelenger/
        │       ├── ChorelengerApp.kt        # Application; owns AppContainer
        │       ├── AppContainer.kt          # service locator (swappable)
        │       ├── MainActivity.kt
        │       ├── data/
        │       │   ├── Note.kt              # @Entity
        │       │   ├── NoteDao.kt
        │       │   └── AppDatabase.kt
        │       ├── speech/
        │       │   ├── TranscriptionService.kt   # interface (future swap point)
        │       │   ├── NativeTranscriptionService.kt  # SpeechRecognizer impl
        │       │   ├── VoiceState.kt             # sealed state
        │       │   └── VoiceError.kt             # enum + error-code mapping
        │       └── ui/
        │           ├── theme/…
        │           ├── HomeScreen.kt        # button + list
        │           ├── NoteRow.kt
        │           └── NotesViewModel.kt
        ├── test/java/dev/dombeg/chorelenger/…   # JVM unit + Robolectric
        └── androidTest/java/dev/dombeg/chorelenger/…  # instrumented
```

App id / applicationId / namespace: **`dev.dombeg.chorelenger`**.
(Change here if a different id is wanted; nothing else depends on it.)
Root project name: `chorelenger`.

---

## 4. Documentation (`/docs`)

Docs capture **decisions, architecture, and how-to** — not a mirror of the code.
Source and tests are documentation of implementation detail; docs MUST NOT
re-list every class, field, or test. Keep them short, link to code paths.

| File | Contents |
|---|---|
| `docs/README.md` | 5-line what/why + index linking the others |
| `docs/architecture.md` | Layers, data flow, the `TranscriptionService` seam, one diagram, responsibilities |
| `docs/decisions.md` | ADR list (see below), one paragraph each: context → decision → consequence |
| `docs/structure.md` | Directory map + "what lives where" + naming conventions |
| `docs/testing.md` | Integration-first (trophy) strategy, how to run each suite, what is faked vs real |
| `docs/development.md` | WSL setup, wireless adb, build/run/deploy commands (from §9–§10) |

Rules to keep docs non-redundant:
- Decision rationale lives ONLY in `decisions.md`; code comments state *what*, not *why*.
- Run commands documented once in `development.md` / `testing.md`; the README links them.
- `architecture.md` explains the shape; it does not enumerate every composable.

### ADRs to record in `docs/decisions.md`
1. Native `SpeechRecognizer` for v1 instead of cloud/OpenRouter STT.
2. Kotlin + Jetpack Compose + Material 3, single module.
3. Room for persistence over DataStore/JSON files.
4. No DI framework; `AppContainer` service locator instead.
5. `TranscriptionService` interface as a future-backend seam.
6. Min SDK 26; `EXTRA_PREFER_OFFLINE = true` default.
7. No audio file retained in v1.
8. Test strategy: integration-first (testing trophy). Test real components; fake only the speech boundary; unit tests only for pure logic.

---

## 5. Data model

One table. Keep it minimal.

```
Note (table: notes)
  id        Long   PK, autoGenerate
  text      String   (the transcript, trimmed, non-empty)
  createdAt Long     (epoch millis, set on insert)
```

`NoteDao`:
- `@Query("SELECT * FROM notes ORDER BY createdAt DESC") fun observeAll(): Flow<List<Note>>`
- `@Insert suspend fun insert(note: Note): Long`
- `@Query("DELETE FROM notes WHERE id = :id") suspend fun deleteById(id: Long)`

Room exposed as a `Flow`; the ViewModel maps it straight into UI state.
`exportSchema = false` (personal app, no migration tooling needed in v1).

---

## 6. Permissions & manifest

Required:
- `android.permission.RECORD_AUDIO` — **runtime** permission.
- `android.permission.INTERNET` — declare now; some system recognizers use the
  network, and a future cloud backend will need it.

Package-visibility (Android 11+), inside `<manifest>`:

```
<queries>
  <intent><action android:name="android.speech.RecognitionService" /></intent>
</queries>
```

No `FOREGROUND_SERVICE`, no `POST_NOTIFICATIONS` in v1 (recognition is
foreground-only while the app is open).

---

## 7. Components

### 7.1 Transcription layer (native SpeechRecognizer)

Results are surfaced through a single `StateFlow<VoiceState>` so there is one
source of truth and the UI is a pure function of that state.

```
sealed interface VoiceState
  Idle
  Listening(partial: String)     // updates as partial results arrive
  Result(text: String)           // FINAL; VM consumes then resets to Idle
  Error(kind: VoiceError, message: String)

enum VoiceError
  NotAvailable        // no recognizer / service missing
  PermissionDenied
  NoMatch             // ERROR_NO_MATCH
  SpeechTimeout       // ERROR_SPEECH_TIMEOUT
  Busy                // ERROR_RECOGNIZER_BUSY
  Network             // ERROR_NETWORK / ERROR_NETWORK_TIMEOUT
  Audio               // ERROR_AUDIO
  Client              // ERROR_CLIENT
  Unknown

interface TranscriptionService
  val state: StateFlow<VoiceState>
  fun isAvailable(): Boolean
  fun start()          // begin listening
  fun stop()           // request end; recognizer returns final result
  fun cancel()         // abandon current utterance
  fun release()        // destroy recognizer; call from lifecycle
```

`NativeTranscriptionService` implementation notes:
- `SpeechRecognizer.createSpeechRecognizer(context)` **must** be created and
  interacted with on the **main thread**.
- `startListening` intent:
  - `RecognizerIntent.ACTION_RECOGNIZE_SPEECH`
  - `EXTRA_LANGUAGE_MODEL = LANGUAGE_MODEL_FREE_FORM`
  - `EXTRA_PARTIAL_RESULTS = true`, `EXTRA_MAX_RESULTS = 1`
  - `EXTRA_LANGUAGE = Locale.getDefault().toLanguageTag()`
  - `EXTRA_PREFER_OFFLINE = true` (API 23+; may reduce capability — revisit)
- `RecognitionListener`: `onReadyForSpeech`/`onBeginningOfSpeech` →
  `Listening("")`; `onPartialResults` → `Listening(partial)`; `onResults` →
  `Result(best)`; `onError(code)` → map to `VoiceError`; the rest no-op.
- `stop()` → `stopListening()` (still delivers `onResults`); `cancel()` → `cancel()`.
- `isAvailable()` → `SpeechRecognizer.isRecognitionAvailable(context)`.
- Optional API 31+: prefer on-device recognizer when available.

Error-code mapping (`int → VoiceError`) MUST be a pure top-level function so it
is unit-testable without the Android speech stack.

### 7.2 ViewModel (`NotesViewModel`)
- ctor: `(noteDao: NoteDao, transcription: TranscriptionService)` — plain
  constructor injection, no framework.
- `val notes: StateFlow<List<Note>>` from `dao.observeAll()`.
- `val voiceState: StateFlow<VoiceState>` from `transcription.state`.
- `onRecordButtonTap()` — Idle/Result/Error → `start()`; Listening → `stop()`.
- consumes `Result` → inserts a trimmed, non-empty `Note` → resets to Idle.
- `delete(id)`, `onCleared()` → `transcription.release()`.

### 7.3 UI (`HomeScreen`)
Single screen, Material 3, no navigation library in v1.

1. **Giant circular record button** (~200dp): Idle → mic + "Tap to speak";
   Listening → accent + subtle pulse + "Listening… tap to stop"; disabled when
   `isAvailable()` is false.
2. **Live partial text** below the button while listening.
3. **Notes list** — `LazyColumn`, newest first; each row = text, small timestamp,
   trailing delete `IconButton`.
4. **Empty state** hint when there are no notes.
5. **Error snackbar** with mapped message + Retry on `Error`.

Only standard Compose animation (pulse/alpha). No 3D or custom canvas effects.

### 7.4 Testability seam (`AppContainer`)
A hand-written service locator owned by `ChorelengerApp`:

```
interface AppContainer
  fun noteDao(): NoteDao
  fun transcriptionService(): TranscriptionService

class DefaultAppContainer(context): AppContainer   // real Room + native speech
```

`ChorelengerApp.container` is a `var` (or has a test setter) so instrumented
and Robolectric tests can swap in a fake container BEFORE the Activity launches.
`MainActivity` builds the ViewModel from `(application as ChorelengerApp).container`.

---

## 8. Build configuration

- `app/build.gradle.kts`: `com.android.application`, `org.jetbrains.kotlin.android`,
  Compose enabled, Kotlin 2.x Compose plugin.
- `compileSdk`/`targetSdk` = 35, `minSdk` = 26.
- Java/Kotlin toolchain pinned to JDK 17.
- `testOptions { unitTests { isIncludeAndroidResources = true } }` for Robolectric.
- `buildFeatures { compose = true }`. No `viewBinding`/`buildConfig` in v1.
- `local.properties` holds `sdk.dir` and is **gitignored**.
- `.gitignore`: `local.properties`, `.gradle/`, `build/`, `*.iml`, `.idea/`,
  `captures/`, `.cxx/`.
- `androidTestImplementation`: `ui-test-junit4`, `androidx.test.ext:junit`,
  `androidx.test:runner`, `room-testing`.
- `debugImplementation`: `ui-test-manifest`.
- `testImplementation`: JUnit4, `kotlinx-coroutines-test`, Robolectric,
  `androidx.test:core`, `room-testing`.

---

## 9. WSL development environment setup

Command-line only; Android Studio not required.

1. **JDK 17** — install, set `JAVA_HOME`.
2. **Android command-line tools** — unzip to
   `$HOME/android-sdk/cmdline-tools/latest`; `export ANDROID_HOME=$HOME/android-sdk`
   and add `$ANDROID_HOME/platform-tools` to `PATH` (persist in shell rc).
3. **SDK packages** (`sdkmanager`): `platform-tools`, `platforms;android-35`,
   `build-tools;35.0.0`.
4. **Licenses:** `sdkmanager --licenses`.
5. **Gradle:** use the committed wrapper (`./gradlew`); no global install.
6. **Device (WSL2):** **wireless debugging**, not USB.
   - Phone: Developer options → Wireless debugging → Pair with code.
   - `adb pair <phone-ip>:<pair-port>` → enter code.
   - `adb connect <phone-ip>:<debug-port>`; `adb devices` confirms.
   - (USB passthrough needs `usbipd` on Windows; not worth it.)
   - If WSL2 NAT cannot reach the phone, enable mirrored networking.

### 9.1 Seeing the UI from WSL (Windows 11 + physical phone)

WSL2 cannot render Android natively; you mirror the phone into a WSLg window.

Primary path — **real phone + `scrcpy`**:
1. Ensure WSLg is available (Windows 11 default). GUI Linux apps open as windows.
2. `sudo apt install scrcpy adb` (or use the SDK `platform-tools` adb already on PATH).
3. Connect the phone over wireless adb (§9 item 6): `adb devices` must list it.
4. Run `scrcpy` → a live, interactive window of the phone appears. Use it for
   the manual checklist (§11.5). Latency is low enough for normal use.
5. Optional `scrcpy` flags: `-m 1024` (smaller window), `--stay-awake`,
   `--turn-screen-off` (mirror with the phone screen off).

Why the phone (not an emulator) here:
- Real Google speech service → `SpeechRecognizer` actually works. Many emulator
  images ship without it, which would make the core feature untestable.
- Real mic, real performance, no virtualization overhead.

Emulator fallback (only if a phone isn't on hand):
- Best: run the AVD in **Windows** (Android Studio) and point WSL's adb at it:
  `ADB_SERVER_SOCKET=tcp:<windows-host-ip>:5037 adb devices`, then `scrcpy`.
- In-WSL emulator: `.wslconfig` → `[wsl2] nestedVirtualization=true` → `wsl --shutdown`;
  confirm `/dev/kvm`; use a **`google_apis`** system image; run with
  `-gpu swiftshader_indirect` (slow, occasionally flaky).
- Emulator images without `google_apis` lack `SpeechRecognizer` → core feature
  can't be exercised; do not use them for manual testing.

No-device option: Robolectric + screenshot tests (Roborazzi) can render Compose
screens to PNGs during `./gradlew testDebugUnitTest` for quick UI eyeballing.
Optional, not required for v1.

---

## 10. Deploy

- Iterate on device: `./gradlew installDebug`.
- Artifact: `./gradlew assembleDebug` →
  `app/build/outputs/apk/debug/app-debug.apk` → `adb install -r …` or transfer.
- Debug build only. Release signing deferred.

---

## 11. Testing strategy — integration-first ("testing trophy")

Not a classic pyramid. For an end-user app, behavior lives in the wiring of real
components (Room + ViewModel + Compose + the Android framework); unit tests that
double everything prove little. So: integration is the widest layer, e2e is
substantial, unit is small.

Shape (widest = most tests):

```
  static  (compiler, lint)                 always on
  ┌─────┐
  │unit │  small       – pure logic only
  ├─────┤
  │ e2e │  substantial – full user journeys
  ├─────┤
  │intg.│  widest      – real components wired together
  └─────┘
```

Principles:
- Run against real Android components wherever possible (real Room, real
  ViewModel, real Compose). Fake ONLY the non-testable external boundary: the
  system speech service (`TranscriptionService`).
- Unit tests are the exception, reserved for pure logic an integration/e2e test
  would cover awkwardly (e.g. error-code mapping). Never re-assert in a unit test
  what an integration test already proves.
- Happy paths first at every layer; edge cases fill the gaps.

### 11.1 Integration tests (widest layer)
Real wiring; only speech faked. Run under Robolectric in `testDebugUnitTest`, and
mirror the critical ones as instrumented `androidTest`.
- Room `NoteDao` (in-memory DB): insert → observe newest-first → delete; multiple
  inserts keep order.
- `NotesViewModel` + real `NoteDao`: `Result` inserts exactly one trimmed note
  (empty/whitespace → none); `delete(id)` removes it; notes-flow ordering.
- `NotesViewModel` + fake `TranscriptionService`: button toggle Idle→start,
  Listening→stop; consuming `Result` resets state to Idle.
- Compose UI with the real composables (Robolectric): record→note appears,
  delete→row gone + empty state, two notes ordered.
- `DefaultAppContainer`: returns a working DAO + a `TranscriptionService` whose
  availability check does not crash.

### 11.2 E2E tests (substantial; instrumented on device/emulator)
Launch the real `MainActivity` with a test `AppContainer` (real ViewModel, real
Room, real Compose tree; only speech faked). Cover complete journeys:
1. Record → note appears → button back to Idle.
2. Delete → row gone → empty state.
3. Multiple notes → newest first.
4. `Error(Network)` → snackbar → retry re-invokes the service.
5. Permission denied → message, no crash.
6. Recognizer unavailable → button disabled + explanation.
7. Activity recreation (rotation / process death) → notes + state survive.
Selectors: stable test tags / content descriptions on the record and delete
buttons. Espresso-free — Compose semantics only.

### 11.3 Unit tests (small)
Pure, fast, framework-free logic only:
- `VoiceError` mapping: each `SpeechRecognizer.ERROR_*` → expected enum.
- Small pure helpers (e.g. note-text sanitization: trim, reject blank).
Keep these minimal; if a behavior can be checked in an integration test, it
belongs there.

### 11.4 Commands
- `./gradlew testDebugUnitTest` — Robolectric integration + UI + unit.
- `./gradlew connectedDebugAndroidTest` — instrumented integration + e2e.
- `./gradlew assembleDebug` — build gate.
- Optional Jacoco coverage later; not required for v1.

### 11.5 Manual smoke checklist (on device)
- [ ] First tap prompts for mic permission.
- [ ] Deny → clear message, no crash.
- [ ] Grant → tap, speak → live partial text → stop → note at top of list.
- [ ] Silence auto-stop produces a note without a second tap.
- [ ] Kill + reopen → notes still present.
- [ ] Delete → gone immediately and after restart.
- [ ] Airplane mode → error snackbar, retry works.
- [ ] Device without speech service → button disabled with explanation.

---

## 12. Milestones (build order)

1. **Scaffold** — Gradle project, version catalog, manifest, Compose "hello";
   builds and installs over wireless adb. Write `docs/development.md` + README.
2. **Data** — `Note`, `NoteDao`, `AppDatabase`, `AppContainer`, `ChorelengerApp`.
   Add Room DAO integration test. Write `docs/structure.md`, `decisions.md` (ADRs 3,4).
3. **Speech** — `TranscriptionService` interface, `NativeTranscriptionService`,
   `VoiceState`/`VoiceError` + pure error mapping. Add the error-mapping unit test.
   Record ADRs 1,5,6,7.
4. **UI** — `HomeScreen`, `NoteRow`, `NotesViewModel`; wire container.
   Add integration tests (ViewModel + Room + Compose) and e2e happy paths.
5. **Polish** — pulse animation, timestamps, permission flow, background cancel;
   negative-path UI tests.
6. **Docs + full test pass** — finish `architecture.md`, `testing.md`; run §11.4
   and the §11.5 checklist green.

Each milestone ends with a working, installable app and its tests passing.

---

## 13. Open questions / defaults

| Item | Default chosen | Change if |
|---|---|---|
| Application id | `dev.dombeg.chorelenger` | you want a different id |
| Min SDK | 26 | you need older devices |
| Storage | Room | — |
| `EXTRA_PREFER_OFFLINE` | `true` | accuracy suffers → `false` |
| Delete confirmation | none | accidental deletes → add undo |
| UI tests runtime | Robolectric first, instrumented too | — |

---

## 14. Definition of done (v1)

- App installs via `./gradlew installDebug`.
- Tap the giant button, speak, and the sentence appears as a note.
- Notes persist across restarts; deletable individually.
- `./gradlew testDebugUnitTest` passes (Robolectric integration + UI + minimal unit).
- `./gradlew connectedDebugAndroidTest` passes on a connected device (Room +
  Compose e2e happy paths).
- Manual checklist (§11.5) fully green.
- `/docs` contains README, architecture, decisions (ADRs), structure, testing,
  development — concise and non-redundant with code/tests.
- No network calls, no API keys, no OpenRouter.
