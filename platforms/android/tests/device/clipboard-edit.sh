#!/usr/bin/env bash
set -euo pipefail
repo_root=$(cd "$(dirname "$0")/../../../.." && pwd)
cd "$repo_root"
android_sdk=${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}
adb="$android_sdk/platform-tools/adb"
serial=${1:-emulator-5580}
product=${2:-app.msime.android.pinyin}
case "$product" in
  app.msime.android) icon_preparation=HostIconPreparation; clipboard_preparation=ClipboardEditPreparation ;;
  app.msime.android.pinyin) icon_preparation=PinyinHostIconPreparation; clipboard_preparation=PinyinClipboardEditPreparation ;;
  *) echo "Only full and pinyin test editions are supported" >&2; exit 1 ;;
esac
[[ "$serial" == emulator-* ]] || { echo "Only the dedicated emulator is supported" >&2; exit 1; }
avd_name=$("$adb" -s "$serial" emu avd name | tr -d '\r' | head -1)
[[ "$avd_name" == msime-client-test || "$avd_name" == msime-client-test-api* ]] || { echo "Refusing a non-test AVD" >&2; exit 1; }
[[ $("$adb" -s "$serial" shell getprop sys.boot_completed | tr -d '\r') == 1 ]] || { echo "Test AVD has not booted" >&2; exit 1; }
api=$("$adb" -s "$serial" shell getprop ro.build.version.sdk | tr -d '\r')
active_instrumentation=$("$adb" -s "$serial" shell dumpsys activity processes)
if grep -q '^    Instrumentation #' <<< "$active_instrumentation"; then
  echo "Dedicated AVD is running another instrumentation; wait for it to finish" >&2
  exit 1
fi
bash platforms/android/tests/device/build-editor.sh
"$adb" -s "$serial" install --no-incremental -r target/android/editor-test.apk >/dev/null
original_ime=$("$adb" -s "$serial" shell settings get secure default_input_method | tr -d '\r')
restore_latin=false
icon_prepared=false
clipboard_prepared=false
instrument="app.msime.android.test/app.msime.android.test.$clipboard_preparation"
icons="app.msime.android.test/app.msime.android.test.$icon_preparation"
check() {
  local marker=$1 result
  shift
  result=$("$adb" -s "$serial" shell am instrument -w "$@")
  printf '%s\n' "$result"
  [[ "$result" == *"$marker"* ]]
}
cleanup() {
  local failed=0
  "$adb" -s "$serial" shell am force-stop "$product" || failed=1
  if [[ "$clipboard_prepared" == true ]]; then
    check MSIME_CLIPBOARD_PREPARATION_PASSED -e restore true "$instrument" || failed=1
  fi
  if [[ "$icon_prepared" == true ]]; then
    check MSIME_ICON_PREPARATION_PASSED -e restore true "$icons" || failed=1
  fi
  if [[ "$restore_latin" == true ]]; then "$adb" -s "$serial" shell pm enable com.android.inputmethod.latin >/dev/null || failed=1; fi
  if [[ "$original_ime" != null && -n "$original_ime" ]]; then
    "$adb" -s "$serial" shell ime enable "$original_ime" >/dev/null || failed=1
    "$adb" -s "$serial" shell ime set "$original_ime" >/dev/null || failed=1
  fi
  return "$failed"
}
trap cleanup EXIT
# API 28 的系统键盘可能在重绑时抢回焦点；只临时禁用原来启用的实例，并在退出时恢复。
if [[ "$api" == 28 ]] && ! "$adb" -s "$serial" shell pm list packages -d | tr -d '\r' | grep -qx 'package:com.android.inputmethod.latin'; then
  "$adb" -s "$serial" shell pm disable-user --user 0 com.android.inputmethod.latin >/dev/null
  restore_latin=true
fi
check MSIME_ICON_PREPARATION_PASSED "$icons"
icon_prepared=true
for style in CLASSIC FOREST; do
  check MSIME_ICON_PREPARATION_PASSED -e icon "$style" "$icons"
  clipboard_prepared=true
  check MSIME_CLIPBOARD_PREPARATION_PASSED "$instrument"
  "$adb" -s "$serial" shell am force-stop "$product"
  # 准备阶段已退出宿主进程，页面操作只附着到独立合成编辑器。
  check MSIME_DEVICE_SMOKE_PASSED -e product "$product" app.msime.android.test/app.msime.android.test.ClipboardEditDeviceSmoke
  "$adb" -s "$serial" shell am force-stop "$product"
  check MSIME_CLIPBOARD_PREPARATION_PASSED -e inspect true "$instrument"
  check MSIME_CLIPBOARD_PREPARATION_PASSED -e restore true "$instrument"
  clipboard_prepared=false
done
cleanup
trap - EXIT
echo "Dedicated Android AVD: classic and forest clipboard editing open, save, return, insert and cancel"
