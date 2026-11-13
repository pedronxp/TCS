#!/usr/bin/env bash
# Exercise the actual minified, signed APK, including an in-place update.
set -euo pipefail
package=com.tcs.relatorioderisco
collect_evidence() {
  adb logcat -d -b crash > startup-crash.txt
  adb logcat -d > startup-log.txt
  adb exec-out screencap -p > startup-screen.png || true
  adb shell uiautomator dump /sdcard/startup-ui.xml >/dev/null 2>&1 || true
  adb pull /sdcard/startup-ui.xml startup-ui.xml >/dev/null 2>&1 || true
}
trap collect_evidence EXIT
# A successful -r install proves that the existing signing identity was preserved.
curl -fL 'https://expo.dev/artifacts/eas/gRl5In15FOt_dZhzV21VCcn0srolsyR-PiHGikK_U_c.apk' -o previous.apk
adb install previous.apk
adb install -r tcs.apk
adb logcat -c
for launch in 1 2; do
  adb shell am force-stop "$package"
  adb shell monkey -p "$package" -c android.intent.category.LAUNCHER 1
  sleep 30
  adb shell pidof "$package"
  adb shell dumpsys activity activities | grep -E "mResumedActivity.*$package"
done
collect_evidence
if grep -E 'FATAL EXCEPTION|Fatal signal|FATAL:|ReactNativeJS.*(Error:|Exception)' startup-crash.txt startup-log.txt; then
  echo 'APK startup failed: fatal native or JavaScript error.' >&2
  exit 1
fi
echo 'Signed release APK survived two launches and an in-place upgrade.'
