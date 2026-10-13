#!/usr/bin/env python3
"""鸿蒙宿主删光标前的文字只能经 `KeyboardSession.deleteEditorBackwardSync`，它调的是 `deleteForwardSync`。

鸿蒙输入法框架的方向命名与 Android 相反：`deleteForward` 删光标之前，`deleteBackward` 删光标之后。按 Android 的直觉写 `deleteBackwardSync` 的退格在光标位于末尾时什么也不删、照样报告成功，这个宿主的退格因此一直不能用。本检查拒绝在宿主源码里直接调用 `deleteBackward` / `deleteBackwardSync`，并确认那一个出口仍然调用 `deleteForwardSync`。
"""

from pathlib import Path
import re
import sys


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    sources = root / "platforms/harmony/entry/src/main/ets"
    failures = []
    for path in sorted(sources.rglob("*")):
        if path.suffix not in (".ets", ".ts"):
            continue
        text = path.read_text(encoding="utf-8")
        for number, line in enumerate(text.splitlines(), start=1):
            code = line.split("//", 1)[0]
            if re.search(r"\.deleteBackward(Sync)?\s*\(", code):
                failures.append(f"{path.relative_to(root)}:{number}: 直接调用了 deleteBackward，它删的是光标之后的文字")
    session = (sources / "keyboard/KeyboardSession.ets").read_text(encoding="utf-8")
    start = session.index("private deleteEditorBackwardSync(")
    body = session[start : session.index("\n  }\n", start)]
    if "deleteForwardSync(count)" not in body:
        failures.append("KeyboardSession.deleteEditorBackwardSync 不再调用 deleteForwardSync")
    for failure in failures:
        print(failure, file=sys.stderr)
    if failures:
        return 1
    print("harmony delete direction: deletes before the caret through deleteForwardSync")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
