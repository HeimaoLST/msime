#!/usr/bin/env python3
"""验证自定义键盘皮肤直接复用共享颜色策略。"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKIN = ROOT / "platforms/android/java/app/msime/android/dictionary/CustomKeyboardSkin.java"


def main() -> None:
    source = SKIN.read_text()
    errors = []
    if "private static String hex(int value)" in source:
        errors.append(f"{SKIN}: 仍保留重复的颜色格式化方法")
    if source.count("ColorPolicy.hexRgb(") < 7:
        errors.append(f"{SKIN}: 颜色字段没有统一调用共享颜色策略")
    if "String.format(Locale.ROOT, \"#%06X\"" in source:
        errors.append(f"{SKIN}: 仍直接格式化 RGB 颜色")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Android custom keyboard skins share the RGB color policy")


if __name__ == "__main__":
    main()
