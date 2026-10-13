#!/usr/bin/env python3
"""异步 IBus 回调在读取 Engine 状态前必须确认宿主状态仍然存在。"""

import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "platforms/linux/src/core/ClientEngine.cpp"
text = source.read_text()

for name in ("translation_complete", "online_complete", "clipboard_complete"):
    # Match the definition rather than the earlier callback declaration.
    match = re.search(rf"void {name}\([^;{{]+\)\s*\{{", text)
    if not match:
        raise SystemExit(f"missing callback {name}")
    body = text[match.end() :]
    # These callbacks are short enough that the next named callback marks the
    # boundary; this keeps the check independent of formatting.
    next_callback = re.search(r"\nvoid [a-z_]+\(", body)
    if next_callback:
        body = body[: next_callback.start()]
    state_read = body.find("state(engine)")
    guard = body.find("!self->state")
    if state_read < 0:
        raise SystemExit(f"{name}: callback does not read state")
    if guard < 0 or guard > state_read:
        raise SystemExit(
            f"{source}: {name} reads state(engine) before checking self->state"
        )

print("linux async state callbacks: all terminal callbacks guard destroyed state")
