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
if [ "${CHECK_TRAINING:-false}" = true ]; then
  tap_label() {
    local label="$1" coordinates
    coordinates=$(python3 - "$label" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

for node in ET.parse("startup-ui.xml").iter("node"):
    if sys.argv[1].casefold() in (node.get("text", "").casefold(), node.get("content-desc", "").casefold()):
        x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.get("bounds", "")))
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)
    [ -n "$coordinates" ] || return 1
    read -r x y <<< "$coordinates"
    adb shell input tap "$x" "$y"
  }
  dump_ui() {
    adb shell uiautomator dump /sdcard/startup-ui.xml >/dev/null
    adb pull /sdcard/startup-ui.xml startup-ui.xml >/dev/null
  }
  dump_ui
  if tap_label 'Pular apresentação'; then
    sleep 3
    dump_ui
  fi
  grep -qi 'ACESSAR SISTEMA' startup-ui.xml
  adb exec-out screencap -p > startup-welcome.png
  if ! tap_label 'Sala de treinamento'; then
    adb shell input swipe 160 520 160 220 350
    dump_ui
    tap_label 'Sala de treinamento'
  fi
  sleep 3
  dump_ui
  grep -qi 'Seu nome' startup-ui.xml
  grep -qi 'Código da turma' startup-ui.xml
  adb exec-out screencap -p > startup-training.png
  echo 'Training form opened without signing in.'
fi
collect_evidence
if grep -E 'FATAL EXCEPTION|Fatal signal|FATAL:|ReactNativeJS.*(Error:|Exception)' startup-app-log.txt; then
  echo 'APK startup failed: fatal native or JavaScript error.' >&2
  exit 1
fi
echo 'Signed release APK survived two launches.'
