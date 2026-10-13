#!/usr/bin/env python3
"""社区回复库直接复用共享 JSON 字符串策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/voice/CommunityReplyLibrary.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    if "String string(Object value)" in source:
        print(f"{SOURCE}: 不应保留 string 转发方法", file=sys.stderr)
        return 1
    if "string(item.get(" in source or "string(content.get(" in source:
        print(f"{SOURCE}: 不应继续通过本地方法读取 JSON 字符串", file=sys.stderr)
        return 1
    if source.count("JsonPolicy.strictString") < 4:
        print(f"{SOURCE}: 社区回复字段应直接调用 JsonPolicy.strictString", file=sys.stderr)
        return 1
    print("Android community replies use the shared JSON string policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
