#!/usr/bin/env python3
"""Android UI callers use DimensionPolicy directly for dp conversion."""
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / "platforms/android/java"
UI = JAVA / "app/msime/android/home/Ui.java"

def main() -> int:
    errors=[]
    ui=UI.read_text(encoding="utf-8")
    if "public static int dp(" in ui:
        errors.append(f"{UI}: 仍保留 dp 转发方法")
    for path in JAVA.rglob("*.java"):
        source=path.read_text(encoding="utf-8")
        if "Ui.dp(" in source:
            errors.append(f"{path}: 仍调用已删除的 Ui.dp")
    if errors:
        print("\n".join(errors), file=sys.stderr); return 1
    print("Android UI uses DimensionPolicy.pixels directly"); return 0
if __name__ == "__main__": raise SystemExit(main())
