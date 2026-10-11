#!/usr/bin/env python3
"""本地语音识别直接复用共享 JSON 类型策略。"""
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "platforms/android/java/app/msime/android/voice/LocalAsrPolicy.java"
RESPONSE = ROOT / "platforms/android/java/app/msime/android/AiProviderResponse.java"
RECOGNIZER = ROOT / "platforms/android/java/app/msime/android/voice/LocalAsrRecognizer.java"
SMOKE = ROOT / "platforms/android/tests/voice/LocalAsrPolicySmoke.java"


def main() -> int:
    source = SOURCE.read_text(encoding="utf-8")
    response = RESPONSE.read_text(encoding="utf-8")
    recognizer = RECOGNIZER.read_text(encoding="utf-8")
    smoke = SMOKE.read_text(encoding="utf-8")
    if "strictBoolean(Object value)" in source:
        print(f"{SOURCE}: 不应保留 strictBoolean 转发方法", file=sys.stderr)
        return 1
    if "strictText(Object value)" in source:
        print(f"{SOURCE}: 不应保留 strictText 转发方法", file=sys.stderr)
        return 1
    if "LocalAsrPolicy.strictText" in recognizer:
        print(f"{RECOGNIZER}: 不应继续通过策略类调用 strictText", file=sys.stderr)
        return 1
    if "getDeclaredMethod(\"strictBoolean\"" in smoke:
        print(f"{SMOKE}: 不应反射检查已移除的转发方法", file=sys.stderr)
        return 1
    if "getDeclaredMethod(\"strictText\"" in smoke:
        print(f"{SMOKE}: 不应反射检查已移除的字符串转发方法", file=sys.stderr)
        return 1
    if "JsonPolicy.strictBoolean" not in smoke:
        print(f"{SMOKE}: 缺少 JsonPolicy.strictBoolean 合同检查", file=sys.stderr)
        return 1
    if "static String boundedText(Object value, int maxCodePoints)" not in response:
        print(f"{RESPONSE}: 缺少共享转写文本边界方法", file=sys.stderr)
        return 1
    if "JsonPolicy.strictStringOrEmpty(value)" not in response:
        print(f"{RESPONSE}: 共享方法必须严格拒绝非字符串值", file=sys.stderr)
        return 1
    if "AiProviderResponse.boundedText(value, MAX_TRANSCRIPT)" not in source:
        print(f"{SOURCE}: 没有调用共享转写文本边界方法", file=sys.stderr)
        return 1
    if "TextPolicy.codePointLength(text) > MAX_TRANSCRIPT" in source:
        print(f"{SOURCE}: 仍保留重复的转写文本长度边界逻辑", file=sys.stderr)
        return 1
    if "TextPolicy.hasControlExceptWhitespace(text)" in source:
        print(f"{SOURCE}: 仍保留重复的转写文本控制字符边界逻辑", file=sys.stderr)
        return 1
    if "JsonPolicy.strictString" not in smoke:
        print(f"{SMOKE}: 缺少 JsonPolicy.strictString 行为检查", file=sys.stderr)
        return 1
    print("Android 本地语音识别已复用共享 JSON 类型策略")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
