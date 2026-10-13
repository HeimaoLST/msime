#!/usr/bin/env python3
"""常用语存储直接复用共享 JSON 策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/dictionary/CommonPhrasesStore.java"
SMOKE = ROOT / "platforms/android/tests/dictionary/CommonPhrasesStoreSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    for method in ("strictBoolean", "strictString", "strictInteger"):
        if f"{method}(Object value)" in source:
            print(f"{SOURCE}: 不应保留 {method} 转发方法", file=sys.stderr)
            return 1
        if f"CommonPhrasesStore.{method}" in smoke:
            print(f"{SMOKE}: 不应继续通过存储类调用 {method}", file=sys.stderr)
            return 1
    if "import app.msime.android.JsonPolicy;" not in smoke:
        print(f"{SMOKE}: 应直接导入 JsonPolicy", file=sys.stderr)
        return 1
    for expression in ("JsonPolicy.strictBoolean", "JsonPolicy.strictString", "JsonPolicy.strictInteger"):
        if expression not in smoke:
            print(f"{SMOKE}: 缺少 {expression} 合同检查", file=sys.stderr)
            return 1
    print("Android common phrases use the shared JSON policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
