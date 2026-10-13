#!/usr/bin/env python3
"""候选释义布尔值直接复用共享 JSON 策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/candidate/CandidateGlossPolicy.java"
SMOKE = ROOT / "platforms/android/tests/candidate/CandidateGlossModelSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    if "strictBoolean(Object value)" in source:
        print(f"{SOURCE}: 不应保留 strictBoolean 转发方法", file=sys.stderr)
        return 1
    if "CandidateGlossPolicy.strictBoolean" in smoke:
        print(f"{SMOKE}: 不应继续通过候选策略调用 strictBoolean", file=sys.stderr)
        return 1
    if "JsonPolicy.strictBoolean" not in smoke:
        print(f"{SMOKE}: 缺少 JsonPolicy.strictBoolean 合同检查", file=sys.stderr)
        return 1
    print("Android candidate glosses use the shared JSON boolean policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
