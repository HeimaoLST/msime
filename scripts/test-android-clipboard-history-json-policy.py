#!/usr/bin/env python3
"""剪贴板历史直接复用共享 JSON 类型策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "platforms/android/java/app/msime/android/clipboard/ClipboardHistoryPolicy.java"
STORE = ROOT / "platforms/android/java/app/msime/android/clipboard/ClipboardHistoryStore.java"
SMOKE = ROOT / "platforms/android/tests/dictionary/ClipboardHistoryPolicySmoke.java"


def main() -> int:
    policy = POLICY.read_text(encoding="utf-8")
    store = STORE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    for method in ("strictString", "strictBoolean"):
        if f"{method}(Object raw)" in policy:
            print(f"{POLICY}: 不应保留 {method} 转发方法", file=sys.stderr)
            return 1
        if f"ClipboardHistoryPolicy.{method}" in store:
            print(f"{STORE}: 不应继续通过剪贴板策略调用 {method}", file=sys.stderr)
            return 1
        if f"ClipboardHistoryPolicy.{method}" in smoke:
            print(f"{SMOKE}: 不应继续通过剪贴板策略检查 {method}", file=sys.stderr)
            return 1
        if f"JsonPolicy.{method}" not in store:
            print(f"{STORE}: 应直接调用 JsonPolicy.{method}", file=sys.stderr)
            return 1
        if f"JsonPolicy.{method}" not in smoke:
            print(f"{SMOKE}: 缺少 JsonPolicy.{method} 合同检查", file=sys.stderr)
            return 1
    if "import app.msime.android.JsonPolicy;" not in smoke:
        print(f"{SMOKE}: 应直接导入 JsonPolicy", file=sys.stderr)
        return 1
    print("Android 剪贴板历史已复用共享 JSON 类型策略")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
