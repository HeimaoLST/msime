#!/usr/bin/env python3
"""验证社区卡片和详情页共用评分文案策略。"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / "platforms/android/java/app/msime/android/home/CommunityAdapter.java"
SHEET = ROOT / "platforms/android/java/app/msime/android/home/CommunitySkinSheet.java"


def main() -> None:
    adapter = ADAPTER.read_text()
    sheet = SHEET.read_text()
    errors = []
    if "static String rating(CommunityCatalog.Item item)" not in adapter:
        errors.append(f"{ADAPTER}: 缺少共享评分文案方法")
    if "CommunityAdapter.rating(item)" not in sheet:
        errors.append(f"{SHEET}: 没有调用共享评分文案方法")
    if 'String.format(Locale.ROOT, "★ %.1f · %d 人"' in sheet:
        errors.append(f"{SHEET}: 仍保留重复的评分格式化逻辑")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Android community rating labels share the adapter policy")


if __name__ == "__main__":
    main()
