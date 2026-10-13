#!/usr/bin/env python3
"""检查 Android 单行文本是否复用共享标签工厂。"""

from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / "platforms/android/java/app/msime/android/home"
POLICY = ROOT / "platforms/android/java/app/msime/android/ViewPolicy.java"


def main() -> int:
    errors = []
    policy = POLICY.read_text(encoding="utf-8")
    required = (
        "public static TextView singleLineLabel(Context context, CharSequence text, int sizeSp,\n                                           int weight, int color)",
        "TextView view = newTextView(context, text);",
        "public static TextView centeredSingleLineLabel(Context context, CharSequence text, int sizeSp,\n                                                   int weight, int color)",
        "setSingleLine(view);",
    )
    for snippet in required:
        if snippet not in policy:
            errors.append(f"{POLICY}: 单行标签工厂缺少：{snippet}")

    consumers = {
        "AiSkinPage.java": ("ViewPolicy.singleLineLabel(", 2),
        "LexiconPage.java": ("ViewPolicy.centeredSingleLineLabel(", 1),
        "SegmentedControl.java": ("ViewPolicy.centeredSingleLineLabel(", 1),
    }
    duplicated = re.compile(
        r"ViewPolicy\.(?:styledLabel|centeredLabel)\([^;]{0,300};\s*ViewPolicy\.setSingleLine\(",
        re.DOTALL,
    )
    for name, (factory, minimum) in consumers.items():
        path = HOME / name
        source = path.read_text(encoding="utf-8")
        if source.count(factory) < minimum:
            errors.append(f"{path}: 至少 {minimum} 处文本未复用 {factory.removesuffix('(')}")
        if duplicated.search(source):
            errors.append(f"{path}: 仍在标签构造后重复设置单行")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android single-line labels use the shared factories")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
