#!/usr/bin/env python3
"""Android 持久化存储复用共享的原子文件写入策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
FILE_POLICY = ROOT / "platforms/android/java/app/msime/android/FilePolicy.java"
FEEDBACK = ROOT / "platforms/android/java/app/msime/android/KeyboardFeedbackStore.java"
SETTINGS = ROOT / "platforms/android/java/app/msime/android/settings/AndroidLocalSettings.java"


def main() -> int:
    policy = FILE_POLICY.read_text(encoding="utf-8")
    errors = []
    if "public static void writeAtomically(Path file, byte[] content)" not in policy:
        errors.append(f"{FILE_POLICY}: 缺少共享原子写入方法")
    if "StandardCopyOption.ATOMIC_MOVE" not in policy:
        errors.append(f"{FILE_POLICY}: 原子替换策略未保留")
    for source in (FEEDBACK, SETTINGS):
        text = source.read_text(encoding="utf-8")
        if text.count("FilePolicy.writeAtomically(") != 1:
            errors.append(f"{source}: 没有调用共享原子写入方法")
        if "Files.move(temporary" in text or "Files.createTempFile(parent" in text:
            errors.append(f"{source}: 仍保留重复的临时文件替换流程")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android stores share the atomic file write policy")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
