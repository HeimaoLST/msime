#!/usr/bin/env bash
# 把发布日期（YYYY-MM-DD）写进构建出的 MSIMEApp Info.plist 的 MSIMEReleaseDate 键，只给「关于」页显示用；反馈和统计上报的版本号仍是 CFBundleShortVersionString，不带日期。由 project.yml 里 MSIMEApp 的 postBuildScripts 调用，Xcode 本地构建和 CI 的 xcodebuild 都走这里。
#
# 来源按优先级：构建时的环境变量 MSIME_RELEASE_DATE；version.txt 旁的 release-date.txt（只出现在源码包里）；当前提交的日期 `git log -1 --format=%cs`（发布 workflow 从 main 上的发布合并提交构建，所以就是发布当天）。三者都没有时不写这个键，「关于」页照旧只显示版本号，不算错误。
set -euo pipefail

plist="${TARGET_BUILD_DIR:?}/${INFOPLIST_PATH:?}"
source_root="${SRCROOT:?}"
pattern='^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'

release_date=
if [[ -n "${MSIME_RELEASE_DATE:-}" ]]; then
  [[ "$MSIME_RELEASE_DATE" =~ $pattern ]] || { echo "error: MSIME_RELEASE_DATE must be YYYY-MM-DD, got '$MSIME_RELEASE_DATE'" >&2; exit 1; }
  release_date=$MSIME_RELEASE_DATE
elif [[ -f "$source_root/release-date.txt" ]]; then
  release_date=$(tr -d '[:space:]' < "$source_root/release-date.txt")
  [[ "$release_date" =~ $pattern ]] || { echo "error: $source_root/release-date.txt must hold YYYY-MM-DD, got '$release_date'" >&2; exit 1; }
else
  # 没有 git 或不在仓库里（例如解开的源码包）时取不到，按没有日期处理。
  release_date=$(git -C "$source_root" log -1 --format=%cs 2>/dev/null || true)
  [[ "$release_date" =~ $pattern ]] || release_date=
fi

# 用 plutil 而不是 PlistBuddy：PlistBuddy 会把 Xcode 生成的二进制 plist 改写成 XML。增量构建时 Info.plist 可能还留着上一次写入的值，这次取不到日期就把它删掉。
if [[ -n "$release_date" ]]; then
  plutil -replace MSIMEReleaseDate -string "$release_date" "$plist"
else
  plutil -remove MSIMEReleaseDate "$plist" >/dev/null 2>&1 || true
fi
