#!/usr/bin/env python3
"""验证社区目录直接复用共享 JSON 字符串策略。"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "platforms/android/java/app/msime/android/community/CommunityCatalog.java"
SMOKE = ROOT / "platforms/android/tests/community/CommunityCatalogSmoke.java"


def main() -> None:
    catalog = CATALOG.read_text()
    smoke = SMOKE.read_text()
    errors = []
    if "static String strictString(Object value)" in catalog:
        errors.append(f"{CATALOG}: 仍保留 JSON 字符串转发方法")
    if "JsonPolicy.strictString" not in smoke:
        errors.append(f"{SMOKE}: 没有直接验证共享 JSON 字符串策略")
    if "CommunityCatalog.class.getDeclaredMethod(\"strictString\"" in smoke:
        errors.append(f"{SMOKE}: 仍通过目录类的转发方法验证字符串策略")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Android community catalogue uses the shared JSON string policy")


if __name__ == "__main__":
    main()
