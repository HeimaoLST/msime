#!/usr/bin/env python3
"""云 API 不重复定义共享 JSON 布尔策略。"""
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/account/CloudApi.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    if "strictTrue(Object value)" in source:
        print(f"{SOURCE}: 不应保留 strictTrue 转发方法", file=sys.stderr)
        return 1
    if re.search(r"(?<![.\w])strictTrue\(map\.opt\(", source):
        print(f"{SOURCE}: 不应继续通过本地 strictTrue 读取提供商标志", file=sys.stderr)
        return 1
    if source.count("JsonPolicy.strictTrue(map.opt(") < 4:
        print(f"{SOURCE}: 提供商标志应直接调用 JsonPolicy.strictTrue", file=sys.stderr)
        return 1
    print("Android 云 API 未重复定义共享 JSON 布尔策略")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
