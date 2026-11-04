# Testing

The suite is integration-first ("testing trophy"), not a pyramid: the widest
layer wires real components together, e2e covers full journeys, and pure unit
tests are the exception. Fake only the speech boundary.

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
| Integration | JVM (Robolectric) | Room, ViewModel, Compose | speech only |
| E2E | device/emulator | Activity, Room, Compose | speech only |

## What is tested where

- **Unit** — `VoiceError` error-code mapping (`VoiceErrorMappingTest`) and note
  sanitization (`SanitizeNoteTextTest`). No Android runtime needed for the
  mapping because the `ERROR_*` values are compile-time constants.
- **Integration (Robolectric)** — `NoteDaoTest` (insert, order, delete),
  `NotesViewModelTest` (result→insert, blank rejected, order, delete, button
  toggle, release), `HomeScreenTest` (record→note, delete→empty, partial text,
  newest-first, unavailable notice), `DefaultAppContainerTest` (real wiring).
- **E2E (instrumented)** — `MainActivityE2ETest`: record→note→idle, delete,
  newest-first, network-error snackbar + retry, permission-denied message,
  notes surviving Activity recreation. `NoteDaoInstrumentedTest` mirrors the
  critical DAO path on device.

## The only fake

The speech boundary (`TranscriptionService`) is replaced by
`FakeTranscriptionService`, which lets a test drive `Listening`, `Result`, and
`Error` deterministically. Nothing else is mocked.

## How the Activity gets the fake

`MainActivity` reads the container from `ChorelengerApp`. In instrumented tests
`TestContainerRule` sets a `TestAppContainer` (in-memory Room + fake speech)
*before* the Activity-launching compose rule runs, via JUnit rule ordering.
`GrantAudioPermissionRule` runs before both and grants `RECORD_AUDIO` with a
synchronous `pm grant`, so the system permission dialog never interrupts a test.

## Commands

| Command | Runs |
|---|---|
| `./gradlew testDebugUnitTest` | Robolectric integration + Compose UI + unit |
| `./gradlew connectedDebugAndroidTest` | instrumented DAO + e2e (needs a device) |
| `./gradlew assembleDebug` | build gate |

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
