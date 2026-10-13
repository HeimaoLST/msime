#!/usr/bin/env python3
"""验证自定义皮肤库直接复用共享 JSON 字符串策略。"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LIBRARY = ROOT / "platforms/android/java/app/msime/android/dictionary/CustomSkinLibrary.java"
SMOKE = ROOT / "platforms/android/tests/dictionary/CustomSkinLibrarySmoke.java"


def main() -> None:
    library = LIBRARY.read_text()
    smoke = SMOKE.read_text()
    errors = []
    if "static String strictString(Object value)" in library:
        errors.append(f"{LIBRARY}: 仍保留 JSON 字符串转发方法")
    if "JsonPolicy.strictString" not in smoke:
        errors.append(f"{SMOKE}: 没有直接验证共享 JSON 字符串策略")
    if "CustomSkinLibrary.class" in smoke and 'getDeclaredMethod("strictString"' in smoke:
        errors.append(f"{SMOKE}: 仍通过皮肤库转发方法验证字符串策略")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Android custom skin library uses the shared JSON string policy")


if __name__ == "__main__":
    main()
