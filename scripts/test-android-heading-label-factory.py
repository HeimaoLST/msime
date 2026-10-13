#!/usr/bin/env python3
"""检查 Android 标题文本是否复用共享无障碍标题工厂。"""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / "platforms/android/java/app/msime/android/home"
POLICY = ROOT / "platforms/android/java/app/msime/android/ViewPolicy.java"


def main() -> int:
    errors = []
    policy = POLICY.read_text(encoding="utf-8")
    required = (
        "public static TextView headingLabel(Context context, CharSequence text, float sizeSp,",
        "TextView view = label(context, text, sizeSp, color);",
        "public static TextView headingLabel(Context context, CharSequence text, int sizeSp,\n                                        int weight, int color)",
        "TextView view = newTextView(context, text);",
        "view.setAccessibilityHeading(true);",
    )
    for snippet in required:
        if snippet not in policy:
            errors.append(f"{POLICY}: 标题标签工厂缺少：{snippet}")

    consumers = (
        "InputDialog.java",
        "LoginSheet.java",
        "OnboardingActivity.java",
        "SettingsSheet.java",
        "SheetHeaderView.java",
        "StatisticsFragment.java",
    )
    for name in consumers:
        path = HOME / name
        source = path.read_text(encoding="utf-8")
        if "ViewPolicy.headingLabel(" not in source:
            errors.append(f"{path}: 未复用 ViewPolicy.headingLabel")

    allowed_direct = {"AboutPage.java"}
    for path in HOME.glob("*.java"):
        if path.name in allowed_direct:
            continue
        if "setAccessibilityHeading(true)" in path.read_text(encoding="utf-8"):
            errors.append(f"{path}: 不应直接设置 accessibility heading")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android heading labels use the shared accessibility factory")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
