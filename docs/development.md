# Development

Command-line only; Android Studio is not required. Dev runs in **WSL2** (Linux);
the phone is the test device.

## 1. Prerequisites

1. **JDK 17** — install and point `JAVA_HOME` at it.
2. **Android command-line tools** — unzip to
   `$HOME/android-sdk/cmdline-tools/latest`, then set:
   ```sh
   export ANDROID_HOME=$HOME/android-sdk
   export PATH=$ANDROID_HOME/platform-tools:$PATH
   ```
3. **SDK packages** — `sdkmanager`:
   ```sh
   sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
   sdkmanager --licenses
   ```
4. **Gradle** — use the committed wrapper (`./gradlew`); no global install.

> The `gradle/wrapper/gradle-wrapper.jar` binary is not authored in-repo by the
> scaffolder. Generate it once on a machine that can reach the network:
> ```sh
> gradle wrapper --gradle-version 8.10.2
> ```
> `gradlew`, `gradlew.bat`, and `gradle/wrapper/gradle-wrapper.properties` are
> committed; only the jar is produced by that command.

## 2. Device (WSL2): wireless debugging

USB passthrough needs `usbipd`; wireless is simpler.

1. Phone: Developer options → Wireless debugging → *Pair device with pairing code*.
2. `adb pair <phone-ip>:<pair-port>` → enter the code.
3. `adb connect <phone-ip>:<debug-port>` → `adb devices` confirms.

If WSL2 NAT cannot reach the phone, enable mirrored networking in `.wslconfig`.

## 3. Seeing the UI from WSL

WSL2 cannot render Android; mirror the phone into a WSLg window with `scrcpy`
(real device, so the Google speech service is present):

```sh
scrcpy                 # interactive mirror
scrcpy -m 1024 --stay-awake --turn-screen-off
```

An emulator is a fallback only, and it must use a `google_apis` image or
`SpeechRecognizer` will be missing.

## 4. Build, run, deploy

```sh
./gradlew installDebug                       # build + install on the connected device
./gradlew assembleDebug                      # APK only
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Tests are documented in [testing.md](testing.md):

```sh
./gradlew testDebugUnitTest                  # Robolectric integration + UI + unit
./gradlew connectedDebugAndroidTest          # instrumented e2e (needs a device)
```

Debug builds only; release signing is deferred.
