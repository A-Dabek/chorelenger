# Chorelenger

Chorelenger turns spoken words into short-lived notes. Tap one big button, say
something like "wife told me to walk the dog in the evening", and get a note you
delete when it's done. Native Android, offline, no accounts.

- [Architecture](architecture.md) — layers, data flow, the speech seam
- [Decisions](decisions.md) — ADRs and why each choice was made
- [Structure](structure.md) — where code lives and naming rules
- [Testing](testing.md) — integration-first strategy and how to run suites
- [Development](development.md) — WSL setup, build, run, deploy

## At a glance

| | |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose + Material 3 |
| Persistence | Room (SQLite) |
| Speech | system `SpeechRecognizer` (no cloud) |
| Module | single `:app` |
| Min / target SDK | 26 / 35 |
| JDK | 17 |
