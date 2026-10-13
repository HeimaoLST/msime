#!/usr/bin/env python3
"""隐私重启和其他 stop 路径必须取消未完成的图片提交。"""

from pathlib import Path


SOURCE = Path(__file__).resolve().parents[1] / "platforms/android/java/app/msime/android/core/MSIMEInputService.java"


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    start = source.index("    private void stop(boolean finish)")
    end = source.index("    private void schedulePersonalDictionarySynchronization", start)
    body = source[start:end]
    if "clipboardImageGeneration++;" not in body:
        raise SystemExit("stop() 必须失效后台图片提交，隐私模式重启不能让旧回调继续发送图片")
    print("Android stop paths invalidate pending clipboard image commits")


if __name__ == "__main__":
    main()
