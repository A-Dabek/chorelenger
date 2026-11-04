#!/usr/bin/env bash
#
# Run the instrumented test suite without AGP's Unified Test Platform (UTP).
#
# Use this when `./gradlew connectedDebugAndroidTest` cannot resolve UTP's
# runner artifacts (e.g. a fully offline Gradle cache), or when UTP's install
# step is confused by duplicate adb connections to the same phone. It builds
# and installs both APKs, grants the mic permission from the host, then invokes
# the same AndroidJUnitRunner via `adb shell am`.
#
# Requires exactly one connected device, or set ANDROID_SERIAL explicitly.
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

mapfile -t DEVICES < <("$ADB" devices | awk 'NR > 1 && $2 == "device" { print $1 }')
if [ -n "${ANDROID_SERIAL:-}" ]; then
    SERIAL="$ANDROID_SERIAL"
elif [ "${#DEVICES[@]}" -eq 1 ]; then
    SERIAL="${DEVICES[0]}"
else
    echo "error: expected one device, found ${#DEVICES[@]}: ${DEVICES[*]:-none}" >&2
    echo "hint: 'adb disconnect <duplicate>', or set ANDROID_SERIAL=<serial>" >&2
    exit 1
fi
ADB_CMD=("$ADB" -s "$SERIAL")

echo "==> Using device: $SERIAL"
echo "==> Building test APKs (offline)"
./gradlew --offline assembleDebug assembleDebugAndroidTest

echo "==> Installing"
"${ADB_CMD[@]}" install -r -t "$APP_APK"
"${ADB_CMD[@]}" install -r -t "$TEST_APK"

echo "==> Running instrumented tests"
set +e
OUTPUT="$("${ADB_CMD[@]}" shell am instrument -w "$RUNNER" 2>&1)"
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
