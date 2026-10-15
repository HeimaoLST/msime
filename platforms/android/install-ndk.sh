#!/usr/bin/env bash
# 下载偶发损坏时有限重试；以固定版本和编译器都已落盘为准，不发布残缺的 NDK。
set -euo pipefail
android_sdk=${ANDROID_SDK_ROOT:-${ANDROID_HOME:?Set ANDROID_SDK_ROOT or ANDROID_HOME}}
version=28.2.13676358
ndk="$android_sdk/ndk/$version"
case $(uname -s) in
  Darwin) host=darwin-x86_64 ;;
  Linux) host=linux-x86_64 ;;
  *) echo "Unsupported NDK host" >&2; exit 1 ;;
esac
ready() {
  grep -qs '^Pkg.Revision = 28\.2\.13676358$' "$ndk/source.properties" \
    && [[ -x "$ndk/toolchains/llvm/prebuilt/$host/bin/clang" ]]
}
if ready; then exit 0; fi
for attempt in 1 2 3; do
  echo "Install Android NDK $version (attempt $attempt/3)"
  # sdkmanager 退出后 yes 会收到 SIGPIPE；只忽略 yes 的退出码，仍检查安装结果。
  if { yes || true; } | "$android_sdk/cmdline-tools/latest/bin/sdkmanager" --install "ndk;$version"; then
    if ready; then exit 0; fi
  fi
  if [[ "$attempt" != 3 ]]; then sleep 5; fi
done
echo "Android NDK $version is incomplete after three attempts" >&2
exit 1
