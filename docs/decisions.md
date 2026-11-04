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
build. `exportSchema = false` — no migration tooling in v1.

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
system's default recognizer (not `createOnDeviceSpeechRecognizer`).
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
speech boundary.
**Consequence.** Tests exercise near-real behaviour and survive refactors, at
the cost of a slower suite. Details in [testing.md](testing.md).
