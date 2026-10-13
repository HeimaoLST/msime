#!/usr/bin/env python3
"""Android 品牌标记和快捷键复用同一套颜色回退策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
MARK = ROOT / "platforms/android/java/app/msime/android/keyboard/KeyboardBrandMark.java"
BUTTON = ROOT / "platforms/android/java/app/msime/android/keyboard/KeyboardBrandButton.java"


def main() -> int:
    mark = MARK.read_text(encoding="utf-8")
    button = BUTTON.read_text(encoding="utf-8")
    errors = []
    if mark.count("static int colorOrWhite(IntSupplier accent)") != 1:
        errors.append(f"{MARK}: 缺少唯一的 colorOrWhite 共享方法")
    if mark.count("int color = colorOrWhite(accent);") != 1:
        errors.append(f"{MARK}: 绘制路径没有调用共享颜色回退方法")
    if button.count("KeyboardBrandMark.colorOrWhite(accent)") != 1:
        errors.append(f"{BUTTON}: 绘制路径没有调用共享颜色回退方法")
    if mark.count("accent.getAsInt()") + button.count("accent.getAsInt()") != 1:
        errors.append("品牌组件不应各自实现颜色供应器读取")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android brand components share the color fallback policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
