#!/usr/bin/env python3
"""Android 账号会话直接复用共享 JSON 字符串策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/account/AccountSessionProvider.java"
SMOKE = ROOT / "platforms/android/tests/settings/AccountSessionRoutingSmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    if "legacyAccessToken(Object value)" in source:
        print(f"{SOURCE}: 不应保留 legacyAccessToken 转发方法", file=sys.stderr)
        return 1
    if "legacyAccessToken(legacy.getJSONObject" in source:
        print(f"{SOURCE}: 不应继续通过领域方法读取旧会话令牌", file=sys.stderr)
        return 1
    if "AccountSessionProvider.legacyAccessToken" in smoke:
        print(f"{SMOKE}: 不应测试已移除的转发方法", file=sys.stderr)
        return 1
    if "JsonPolicy.strictStringOrEmpty" not in source or "JsonPolicy.strictStringOrEmpty" not in smoke:
        print(f"{SMOKE}: 缺少 JsonPolicy.strictStringOrEmpty 合同检查", file=sys.stderr)
        return 1
    print("Android 账号会话已复用共享 JSON 字符串策略")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
