#!/usr/bin/env python3
"""更新接口直接复用共享 JSON 字符串策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/account/UpdateApi.java"
SMOKE = ROOT / "platforms/android/tests/core/UpdateApiSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    if "strictString(Object value)" in source:
        print(f"{SOURCE}: 不应保留 strictString 转发方法", file=sys.stderr)
        return 1
    if "import app.msime.android.JsonPolicy;" not in smoke:
        print(f"{SMOKE}: 应直接导入 JsonPolicy", file=sys.stderr)
        return 1
    if 'UpdateApi.class.getDeclaredMethod("strictString"' in smoke:
        print(f"{SMOKE}: 不应反射检查已删除的转发方法", file=sys.stderr)
        return 1
    if "JsonPolicy.strictString" not in smoke:
        print(f"{SMOKE}: 缺少 JsonPolicy.strictString 合同检查", file=sys.stderr)
        return 1
    print("Android update JSON reads use the shared string policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
