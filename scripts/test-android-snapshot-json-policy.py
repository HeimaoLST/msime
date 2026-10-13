#!/usr/bin/env python3
"""词库快照工作器直接复用共享 JSON 策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/dictionary/DictionarySnapshotWorker.java"
SMOKE = ROOT / "platforms/android/tests/dictionary/DictionarySnapshotQueueSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    for method in ("strictBoolean", "strictString"):
        if f"{method}(Object value)" in source:
            print(f"{SOURCE}: 不应保留 {method} 转发方法", file=sys.stderr)
            return 1
        if f'DictionarySnapshotWorker.class.getDeclaredMethod(\n            "{method}"' in smoke:
            print(f"{SMOKE}: 不应反射检查已删除的 {method} 转发方法", file=sys.stderr)
            return 1
    if "import app.msime.android.JsonPolicy;" not in smoke:
        print(f"{SMOKE}: 应直接导入 JsonPolicy", file=sys.stderr)
        return 1
    if "JsonPolicy.strictBoolean" not in smoke or "JsonPolicy.strictString" not in smoke:
        print(f"{SMOKE}: 缺少共享 JSON 策略合同检查", file=sys.stderr)
        return 1
    print("Android snapshot worker uses the shared JSON policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
