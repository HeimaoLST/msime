#!/usr/bin/env bash
# 构建随桌面安装包分发的官方插件包（plugins/official-packs.json 登记的那些），放进 target/plugin-packs/<kind>/<id>/，布局和用户的插件目录相同。macOS、Windows、Linux 的打包都从这个目录取。
#
# 用法：scripts/build-official-plugins.sh [--check]
#
# 对每个登记的包：
# - script：用 scripts/build-script-plugins.sh 构建（确定的：strip、panic = "abort"、codegen-units = 1，见 plugins/script/.cargo/config.toml），包文件夹是 target/script-plugins/<id>/；
# - phrase_table：先跑生成器的 --check（plugins/phrase_table/tools/gen_*.py），包文件夹是登记的 source 下的 pack/。
# 然后 `msime-pack validate --builtin` 校验包文件夹（输出必须是 `ok <id> <kind> <version>`），复制到暂存目录；脚本包再用 `msime-pack hash --builtin` 算内容哈希，和锁里的 content_hash 比对，不一致就失败并打印两个值。授权绑定在这个哈希上：它变了，所有用户的授权都会作废，所以要在 PR 的 diff 里改锁，而不是悄悄发生。
#
# 不带 --check 时最后把暂存目录整个换成 target/plugin-packs（暂存目录里只有登记的包，别的东西不会混进安装包）；带 --check 时只核对，不动 target/plugin-packs，构建的中间产物照旧留在 target/script-plugins/ 下。
#
# 需要 rust-toolchain.toml 钉住的工具链加 wasm32-unknown-unknown 目标；msime-pack 用仓库工作区的默认产物目录（target/debug/msime-pack）。

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# 产物路径写死在 target/ 下，同 scripts/build-script-plugins.sh：环境里的 CARGO_TARGET_DIR 会让组装和比对用上别处的旧产物。
unset CARGO_TARGET_DIR
cd "$root"

check=0
case "$#:${1:-}" in
  0:) ;;
  1:--check) check=1 ;;
  *)
    echo "usage: scripts/build-official-plugins.sh [--check]" >&2
    exit 2
    ;;
esac

lock=plugins/official-packs.json
entries="$(python3 - "$lock" <<'PY'
import json
import re
import sys

document = json.load(open(sys.argv[1], encoding="utf-8"))
if document.get("format_version") != 1:
    raise SystemExit(f"{sys.argv[1]}: format_version 必须是 1")
seen = set()
for pack in document["packs"]:
    kind, ident, source = pack["kind"], pack["id"], pack["source"]
    if kind not in ("script", "phrase_table"):
        raise SystemExit(f"{sys.argv[1]}: {ident} 的 kind {kind} 不是 script 或 phrase_table")
    if (kind, ident) in seen or not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", ident):
        raise SystemExit(f"{sys.argv[1]}: {ident} 重复或不是合法的 id")
    seen.add((kind, ident))
    content_hash = pack.get("content_hash", "-")
    if kind == "script" and not re.fullmatch(r"[0-9a-f]{64}", content_hash):
        raise SystemExit(f"{sys.argv[1]}: 脚本包 {ident} 要锁 64 位小写十六进制的 content_hash")
    if kind != "script" and "content_hash" in pack:
        raise SystemExit(f"{sys.argv[1]}: {ident} 不是脚本包，没有授权要绑定，不锁 content_hash")
    print(kind, ident, source, content_hash)
PY
)"

cargo build --locked -p msime-pack-tool --bin msime-pack
pack_tool="$root/target/debug/msime-pack"

staging="$root/target/plugin-packs.staging"
rm -rf "$staging"
mkdir -p "$staging"
# 失败、中断和 --check 都不留下暂存目录；成功时它已经被换成 target/plugin-packs。
trap 'rm -rf "$staging"' EXIT

failed=0
while read -r kind id source locked; do
  [ -n "$kind" ] || continue
  echo "== $kind/$id"
  case "$kind" in
    script)
      bash scripts/build-script-plugins.sh "$id"
      folder="target/script-plugins/$id"
      ;;
    phrase_table)
      for generator in plugins/phrase_table/tools/gen_*.py; do
        python3 "$generator" --check
      done
      folder="$source/pack"
      ;;
  esac
  version="$(sed -n 's/^version = "\(.*\)"$/\1/p' "$folder/plugin.toml")"
  report="$("$pack_tool" validate --builtin "$folder" 2>&1)" || true
  if [ "$report" != "ok $id $kind $version" ]; then
    echo "FAIL: $folder: msime-pack validate --builtin 报告 $report"
    failed=1
    continue
  fi
  target="$staging/$kind/$id"
  mkdir -p "$target"
  # 只复制包里的普通文件（不带隐藏文件），validate 已经保证没有子文件夹。
  find "$folder" -maxdepth 1 -type f ! -name '.*' -exec cp {} "$target/" \;
  if [ "$kind" = script ]; then
    actual="$("$pack_tool" hash --builtin "$target")"
    if [ "$actual" != "$locked" ]; then
      echo "FAIL: $kind/$id 的内容哈希和 $lock 锁定的不一致"
      echo "  locked: $locked"
      echo "  built:  $actual"
      failed=1
      continue
    fi
    echo "$kind/$id content_hash $actual"
  fi
done <<<"$entries"

if [ "$failed" -ne 0 ]; then
  echo "official plugins: at least one check failed"
  exit 1
fi
if [ "$check" -eq 1 ]; then
  echo "official plugins: checked, target/plugin-packs left as it was"
  exit 0
fi
rm -rf target/plugin-packs
mv "$staging" target/plugin-packs
echo "official plugins: target/plugin-packs"
