#!/usr/bin/env bash
#
# Run the instrumented test suite without AGP's Unified Test Platform (UTP).
#
# Use this when `./gradlew connectedDebugAndroidTest` cannot resolve UTP's
# runner artifacts (e.g. a fully offline Gradle cache). It builds and installs
# both APKs, then invokes the same AndroidJUnitRunner via `adb shell am`.
#
# Requires: a connected, unlocked device visible to `adb devices`.
set -euo pipefail

APP_ID="dev.dombeg.chorelenger"
TEST_ID="${APP_ID}.test"
RUNNER="${TEST_ID}/androidx.test.runner.AndroidJUnitRunner"
APP_APK="app/build/outputs/apk/debug/app-debug.apk"
TEST_APK="app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk"

ADB="${ADB:-adb}"
if ! command -v "$ADB" >/dev/null 2>&1; then
    if [ -n "${ANDROID_HOME:-}" ] && [ -x "$ANDROID_HOME/platform-tools/adb" ]; then
        ADB="$ANDROID_HOME/platform-tools/adb"
    else
        echo "error: adb not found (set ADB=... or ANDROID_HOME)" >&2
        exit 1
    fi
fi

if ! "$ADB" get-state >/dev/null 2>&1; then
    echo "error: no device. Connect the phone and check 'adb devices'." >&2
    exit 1
fi

echo "==> Building test APKs (offline)"
./gradlew --offline assembleDebug assembleDebugAndroidTest

echo "==> Installing"
"$ADB" install -r "$APP_APK"
"$ADB" install -r "$TEST_APK"

# Belt and braces: the tests also grant via UiAutomation, but this guarantees
# the runtime permission before the Activity composes.
"$ADB" shell pm grant "$APP_ID" android.permission.RECORD_AUDIO >/dev/null 2>&1 || true

echo "==> Running instrumented tests"
set +e
OUTPUT="$("$ADB" shell am instrument -w "$RUNNER" 2>&1)"
STATUS=$?
set -e
echo "$OUTPUT"

if echo "$OUTPUT" | grep -q 'FAILURES!!!' || echo "$OUTPUT" | grep -q 'INSTRUMENTATION_FAILED'; then
    echo "==> Instrumented tests FAILED" >&2
    exit 1
fi
if echo "$OUTPUT" | grep -q 'OK ('; then
    echo "==> Instrumented tests passed"
    exit 0
fi

echo "==> Could not determine result (am exit $STATUS)" >&2
exit 1
