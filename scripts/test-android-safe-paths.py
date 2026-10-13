#!/usr/bin/env python3
"""Android 语音文件读取直接复用共享的安全路径策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
COMMUNITY = ROOT / "platforms/android/java/app/msime/android/voice/CommunityReplyLibrary.java"
VOICE = ROOT / "platforms/android/java/app/msime/android/voice/VoiceResultStore.java"


def check(source: Path, required_calls: int) -> list[str]:
    text = source.read_text(encoding="utf-8")
    errors = []
    if "private static void rejectSymlinkComponents" in text:
        errors.append("仍保留 rejectSymlinkComponents 私有转发方法")
    direct_calls = text.count("SafePaths.rejectSymlinkComponents(")
    if direct_calls < required_calls:
        errors.append(f"SafePaths.rejectSymlinkComponents 直接调用不足 {required_calls} 处")
    return errors


def main() -> int:
    errors = []
    for source, required_calls in ((COMMUNITY, 1), (VOICE, 2)):
        errors.extend(f"{source}: {error}" for error in check(source, required_calls))
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android voice libraries reuse SafePaths directly")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
