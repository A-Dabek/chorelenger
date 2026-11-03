# Architecture

Three layers, one screen, one seam. The app is small on purpose.

```
┌─────────────────────────────────────────────────────────────┐
│ UI (Compose)                                                 │
│  HomeScreen / NoteRow                                        │
│  pure function of NotesViewModel state                       │
└───────────────▲──────────────────────────────┬──────────────┘
                │ StateFlow                    │ events
┌───────────────┴──────────────────────────────▼──────────────┐
│ NotesViewModel                                               │
│  notes: StateFlow<List<Note>>   ← NoteDao                    │
│  voiceState: StateFlow<VoiceState> ← TranscriptionService    │
│  consumes Result → inserts Note → returns UI to Idle         │
└───────┬──────────────────────────────────────┬──────────────┘
        │                                      │
┌───────▼──────────────┐        ┌──────────────▼──────────────┐
│ data                 │        │ speech                      │
│ NoteDao / AppDatabase│        │ TranscriptionService         │
│ Room (SQLite)        │        │  └ NativeTranscriptionService│
└──────────────────────┘        │     (system SpeechRecognizer)│
                                └─────────────────────────────┘
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

## Responsibilities

| Component | Owns |
|---|---|
| `HomeScreen` / `NoteRow` | Rendering, permission request, button toggle |
| `NotesViewModel` | UI state, consuming results, insert/delete |
| `NoteDao` / `AppDatabase` | Durable storage |
| `TranscriptionService` | Speech-to-text contract |
| `NativeTranscriptionService` | System recognizer plumbing + error mapping |
| `AppContainer` | Wiring; the swap point for tests and future backends |

## The seam

`TranscriptionService` is the only non-testable external boundary. Everything
else — Room, the ViewModel, the Compose tree — is exercised for real in tests.
A future backend (OpenRouter STT, an on-device model) implements the same
interface and is swapped through `AppContainer`; nothing above it changes.
