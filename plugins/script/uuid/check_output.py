#!/usr/bin/env python3
"""按 RFC 9562 核对 uuid 插件的 msime-pack run 输出，由 scripts/test-script-plugins.sh 在 check_run.py 之后调用。

expected.jsonl 只能说明输出和上次提交的一样；这里从夹具里的随机数独立算一遍，说明它是对的：

- 参数为空时恰好 4 行，`/uuid` 依次是小写带连字符、大写带连字符、32 位小写、`{大写}`，`/guid` 把 GUID 写法挪到第一行，注释依次对应「小写」「大写」「无连字符」「GUID」；
- 四行是同一个值：随机数的前 16 字节，第 7 字节的高 4 位换成版本 4，第 9 字节的高 2 位换成变体 `10`；
- 参数不为空时没有任何行。

usage: check_output.py <fixture.jsonl> <granted.jsonl>
"""
import json
import sys
import uuid
from pathlib import Path

NOTES = {"lower": "小写", "upper": "大写", "compact": "无连字符", "braced": "GUID"}
ORDER = {"uuid": ["lower", "upper", "compact", "braced"], "guid": ["braced", "lower", "upper", "compact"]}


def read(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def expected_rows(event: dict) -> list[list[str]]:
    if event.get("argument", ""):
        return []
    raw = bytearray(bytes.fromhex(event.get("random", "00" * 64))[:16])
    raw[6] = (raw[6] & 0x0F) | 0x40
    raw[8] = (raw[8] & 0x3F) | 0x80
    value = uuid.UUID(bytes=bytes(raw))
    assert value.version == 4 and value.variant == uuid.RFC_4122
    forms = {
        "lower": str(value),
        "upper": str(value).upper(),
        "compact": value.hex,
        "braced": "{" + str(value).upper() + "}",
    }
    return [[forms[name], NOTES[name]] for name in ORDER[event["trigger"]]]


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        raise SystemExit(__doc__.strip().splitlines()[-1])
    events, outputs = read(Path(argv[0])), read(Path(argv[1]))
    problems = []
    if len(events) != len(outputs):
        problems.append(f"夹具有 {len(events)} 个事件，输出有 {len(outputs)} 行")
    for event, output in zip(events, outputs):
        if event["event"] != "command":
            continue
        want = expected_rows(event)
        if output.get("rows") != want:
            problems.append(f"seq {output['seq']}：期望 {want}，实际 {output.get('rows')}")
    for problem in problems:
        print(f"FAIL uuid (RFC 9562): {problem}")
    if not problems:
        print(f"ok uuid: {len(outputs)} events match RFC 9562 version 4")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
