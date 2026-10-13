#!/usr/bin/env python3
"""检查 Android 动态状态文本是否复用共享工厂。"""

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
HOME = ROOT / "platforms/android/java/app/msime/android/home"
POLICY = ROOT / "platforms/android/java/app/msime/android/ViewPolicy.java"


def main() -> int:
    errors = []
    policy = POLICY.read_text(encoding="utf-8")
    required = (
        "public static TextView liveStatus(Context context, int sizeSp, int color)",
        'TextView view = newTextView(context, "");',
        "style(view, sizeSp, 400, color);",
        "setPoliteLiveRegion(view);",
        "return view;",
    )
    for snippet in required:
        if snippet not in policy:
            errors.append(f"{POLICY}: 动态状态文本工厂缺少：{snippet}")

    consumers = {
        "SettingsSheet.java": "TextView status = ViewPolicy.liveStatus(context, 12, ThemeColorPolicy.subText(context));",
        "LoginSheet.java": "status = ViewPolicy.liveStatus(activity, 13, ThemeColorPolicy.subText(activity));",
    }
    for name, call in consumers.items():
        path = HOME / name
        source = path.read_text(encoding="utf-8")
        if call not in source:
            errors.append(f"{path}: 未复用 ViewPolicy.liveStatus")
        if "ViewPolicy.setPoliteLiveRegion(status);" in source:
            errors.append(f"{path}: 不应重复设置动态状态文本的 live region")

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android live status labels use the shared factory")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
