#!/usr/bin/env python3
"""词库集合直接复用共享 JSON 策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/dictionary/DictionaryCollectionsStore.java"
SMOKE = ROOT / "platforms/android/tests/dictionary/DictionaryCollectionsStoreSmoke.java"
STATS = ROOT / "platforms/android/java/app/msime/android/home/StatisticsFragment.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    stats = STATS.read_text(encoding="utf-8")
    for method in ("strictBoolean", "strictString", "strictInteger", "strictLong", "exportPage"):
        if method != "exportPage" and f"{method}(Object value)" in source:
            print(f"{SOURCE}: 不应保留 {method} 转发方法", file=sys.stderr)
            return 1
        if f"DictionaryCollectionsStore.{method}" in smoke:
            print(f"{SMOKE}: 不应继续通过存储类调用 {method}", file=sys.stderr)
            return 1
    if "DictionaryCollectionsStore.strictLong" in stats:
        print(f"{STATS}: 应直接调用 JsonPolicy.strictLong", file=sys.stderr)
        return 1
    if "import app.msime.android.JsonPolicy;" not in smoke:
        print(f"{SMOKE}: 应直接导入 JsonPolicy", file=sys.stderr)
        return 1
    for expression in ("JsonPolicy.strictBoolean", "JsonPolicy.strictString", "JsonPolicy.strictInteger", "JsonPolicy.strictLong"):
        if expression not in smoke:
            print(f"{SMOKE}: 缺少 {expression} 合同检查", file=sys.stderr)
            return 1
    print("Android dictionary collections use the shared JSON policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
