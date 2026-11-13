#!/usr/bin/env bash
# Exercise the actual minified, signed APK, including an in-place update.
set -euo pipefail
package=com.tcs.relatorioderisco
app_uid=''
collect_evidence() {
  adb logcat -d -b crash > startup-crash.txt
  adb logcat -d > startup-log.txt
  adb shell dumpsys activity activities > startup-activities.txt || true
  if [ -n "$app_uid" ]; then
    adb logcat -d --uid="$app_uid" > startup-app-log.txt
  fi
  adb exec-out screencap -p > startup-screen.png || true
  adb shell uiautomator dump /sdcard/startup-ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/startup-ui.xml startup-ui.xml >/dev/null 2>&1 || true
}
trap collect_evidence EXIT
# A successful -r install proves that the existing signing identity was preserved.
if [ -n "${PREVIOUS_APK_URL:-}" ]; then
  curl --proto '=https' --tlsv1.2 -fL "$PREVIOUS_APK_URL" -o previous.apk
  adb install previous.apk
fi
adb install -r "${APK_FILE:-tcs.apk}"
app_uid=$(adb shell cmd package list packages -U "$package" | sed -n 's/.*uid:\([0-9]*\).*/\1/p' | tr -d '\r')
test -n "$app_uid"
adb logcat -c
for launch in 1 2; do
  adb shell am force-stop "$package"
  adb shell monkey -p "$package" -c android.intent.category.LAUNCHER 1
  ready=false
  for attempt in $(seq 1 12); do
    sleep 5
    adb shell pidof "$package"
    adb shell rm -f /sdcard/startup-ui.xml
    rm -f startup-ui.xml
    timeout 15 adb shell uiautomator dump /sdcard/startup-ui.xml >/dev/null 2>&1 || true
    adb pull /sdcard/startup-ui.xml startup-ui.xml >/dev/null 2>&1 || true
    if grep -qE 'Continuar|ACESSAR SISTEMA|Entrar no sistema|Entrar no TCS' startup-ui.xml 2>/dev/null; then
      ready=true
      break
    fi
  done
  if [ "$ready" != true ]; then
    echo 'APK did not render its onboarding or authentication entry screen.' >&2
    exit 1
  fi
  # Keep observing after the first rendered frame to catch delayed startup crashes.
  sleep 20
  adb shell pidof "$package"
  adb shell dumpsys activity activities | grep -E "(mResumedActivity|topResumedActivity).*${package}"
done
collect_evidence
if grep -E 'FATAL EXCEPTION|Fatal signal|FATAL:|ReactNativeJS.*(Error:|Exception)' startup-app-log.txt; then
  echo 'APK startup failed: fatal native or JavaScript error.' >&2
  exit 1
fi
echo 'Signed release APK survived two launches.'
