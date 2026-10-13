#!/usr/bin/env python3
"""语音贡献响应直接复用共享 JSON 字符串策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/voice/VoiceContributionApi.java"
SMOKE = ROOT / "platforms/android/tests/voice/VoiceContributionApiSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    if "strictString(Object value)" in source:
        print(f"{SOURCE}: 不应保留 strictString 转发方法", file=sys.stderr)
        return 1
    if "getDeclaredMethod" in smoke or "VoiceContributionApi.strictString" in smoke:
        print(f"{SMOKE}: 不应反射检查已移除的转发方法", file=sys.stderr)
        return 1
    if "JsonPolicy.strictString" not in smoke:
        print(f"{SMOKE}: 缺少 JsonPolicy.strictString 合同检查", file=sys.stderr)
        return 1
    print("Android voice contributions use the shared JSON string policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
