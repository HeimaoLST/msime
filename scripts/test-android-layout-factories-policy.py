#!/usr/bin/env python3
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
JAVA=ROOT/"platforms/android/java"
UI=JAVA/"app/msime/android/home/Ui.java"
POLICY=JAVA/"app/msime/android/LayoutPolicy.java"
def main():
    errors=[]; ui=UI.read_text(encoding="utf-8")
    for name in ("column","row","weightWrap","wrap"):
        if f"public static" in ui and f" {name}(" in ui:
            errors.append(f"{UI}: 仍保留 {name} 转发")
    policy=POLICY.read_text(encoding="utf-8")
    for signature in ("matchWidthWrapParams()", "matchWidthWrapParams(Context context, int topMarginDp)",
                      "matchWidthHeightPx(int heightPixels)", "matchWidthHeightDp(Context context, int heightDp)",
                      "squareParams(Context context, float sizeDp)",
                      "squareFrameParams(Context context, float sizeDp)",
                      "squareFrameParamsPx(int size, int gravity)",
                      "rowGapParams(Context context, float gapDp)",
                      "divider(Context context, int color, boolean horizontal)",
                      "colorBand(Context context, int color, float heightDp)",
                      "sheetDragHandle(Context context)",
                      "roundedColumn(Context context, int color, float radiusDp)"):
        if signature not in policy:
            errors.append(f"{POLICY}: 缺少 {signature} 工厂")
    for p in JAVA.rglob("*.java"):
        s=p.read_text(encoding="utf-8")
        for name in ("column","row","weightWrap","wrap"):
            if f"Ui.{name}(" in s: errors.append(f"{p}: 仍调用 Ui.{name}")
        if "Ui.matchWidth" in s:
            errors.append(f"{p}: 仍调用 Ui.matchWidth")
        if "Ui.square" in s:
            errors.append(f"{p}: 仍调用 Ui.square")
        if "Ui.rowGapParams" in s:
            errors.append(f"{p}: 仍调用 Ui.rowGapParams")
        if "Ui.divider" in s:
            errors.append(f"{p}: 仍调用 Ui.divider")
        if "Ui.sheetSeparator" in s:
            errors.append(f"{p}: 仍调用 Ui.sheetSeparator")
        if "Ui.sheetDragHandle" in s:
            errors.append(f"{p}: 仍调用 Ui.sheetDragHandle")
        if "Ui.verticalCard" in s:
            errors.append(f"{p}: 仍调用 Ui.verticalCard")
    if errors: print("\n".join(errors),file=sys.stderr); return 1
    print("Android layout factories use LayoutPolicy directly")
    return 0
if __name__=="__main__": raise SystemExit(main())
