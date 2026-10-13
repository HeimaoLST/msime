#!/usr/bin/env python3
"""云剪贴板直接复用共享 JSON 策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/account/CloudClipboardApi.java"
SMOKE = ROOT / "platforms/android/tests/core/CloudApiSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    for method in ("strictBoolean", "strictInteger", "strictString"):
        if f"{method}(Object value)" in source:
            print(f"{SOURCE}: 不应保留 {method} 转发方法", file=sys.stderr)
            return 1
    if "import app.msime.android.JsonPolicy;" not in smoke:
        print(f"{SMOKE}: 应直接导入 JsonPolicy", file=sys.stderr)
        return 1
    if "CloudClipboardApi.class.getDeclaredMethod" in smoke:
        print(f"{SMOKE}: 不应反射检查已删除的转发方法", file=sys.stderr)
        return 1
    for expression in (
        "JsonPolicy.strictBoolean",
        "JsonPolicy.strictInteger",
        "JsonPolicy.strictString",
    ):
        if expression not in smoke:
            print(f"{SMOKE}: 缺少 {expression} 合同检查", file=sys.stderr)
            return 1
    print("Android cloud clipboard JSON reads use the shared policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
