#!/usr/bin/env python3
"""Android 设置页直接复用共享文本首字策略。"""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "platforms/android/java/app/msime/android"
HOME = ANDROID / "home"
TEXT_POLICY = ANDROID / "TextPolicy.java"
UI = HOME / "Ui.java"
CALLERS = (HOME / "ExpressionPage.java", HOME / "LexiconPage.java")
TRIMMED_INITIAL_CALLERS = (HOME / "CommunityAdapter.java", HOME / "ProfilePage.java")


def main() -> int:
    errors = []
    text_policy = TEXT_POLICY.read_text(encoding="utf-8")
    ui = UI.read_text(encoding="utf-8")
    if "public static String initial(CharSequence value, String fallback)" not in text_policy:
        errors.append(f"{TEXT_POLICY}: 缺少共享文本首字策略")
    if "public static String initial(" in ui:
        errors.append(f"{UI}: 不应保留文本首字转发方法")
    if "public static String trimmedInitial(CharSequence value, String fallback)" not in text_policy:
        errors.append(f"{TEXT_POLICY}: 缺少去空白后的文本首字策略")
    if "trimmedInitial(" in ui:
        errors.append(f"{UI}: 不应保留去空白文本首字转发方法")
    for path in CALLERS:
        source = path.read_text(encoding="utf-8")
        if "Ui.initial(" in source:
            errors.append(f"{path}: 应直接调用 TextPolicy.initial")
        if "TextPolicy.initial(" not in source:
            errors.append(f"{path}: 未直接复用共享文本首字策略")
    for path in TRIMMED_INITIAL_CALLERS:
        source = path.read_text(encoding="utf-8")
        if "Ui.trimmedInitial(" in source:
            errors.append(f"{path}: 应直接调用 TextPolicy.trimmedInitial")
        if "TextPolicy.trimmedInitial(" not in source:
            errors.append(f"{path}: 未直接复用去空白文本首字策略")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android home components use the shared text initial policy directly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
