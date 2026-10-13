#!/usr/bin/env python3
"""确保 Android 开发者页的云端操作不会把过期结果写回新页面。"""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/home/DeveloperPage.java"


def method_body(source: str, signature: str) -> str:
    start = source.index(signature)
    opening = source.index("{", start)
    depth = 0
    for index in range(opening, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[opening : index + 1]
    raise AssertionError(f"方法未闭合: {signature}")


def check_action(source: str, signature: str) -> None:
    body = method_body(source, signature)
    if "long request = ++generation;" not in body:
        raise AssertionError(f"{signature} 必须捕获操作代次")
    if "if (request != generation)" not in body:
        raise AssertionError(f"{signature} 必须丢弃过期操作回调")


def main() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    for signature in ("private void upload()", "private void confirmDelete()", "private void regenerate("):
        check_action(source, signature)
    print("Android developer cloud operations reject stale callbacks")


if __name__ == "__main__":
    main()
