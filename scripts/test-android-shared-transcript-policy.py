#!/usr/bin/env python3
"""验证各语音提供方共用转写文本边界策略。"""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RESPONSE = ROOT / "platforms/android/java/app/msime/android/AiProviderResponse.java"
HTTP = ROOT / "platforms/android/java/app/msime/android/voice/HttpAsrPolicy.java"
DOUBAO = ROOT / "platforms/android/java/app/msime/android/voice/DoubaoAsrPolicy.java"


def main() -> None:
    response = RESPONSE.read_text()
    http = HTTP.read_text()
    doubao = DOUBAO.read_text()
    errors = []
    if "static String boundedText(Object value, int maxCodePoints)" not in response:
        errors.append(f"{RESPONSE}: 缺少共享转写文本边界方法")
    if "AiProviderResponse.boundedText(value, MAX_TRANSCRIPT)" not in http:
        errors.append(f"{HTTP}: 没有调用共享转写文本边界方法")
    # 豆包可以直接调用共享边界方法，也可以整段委托给 HTTP 识别的 strictText（它内部就是同一个边界方法）。
    doubao_shared = (
        "AiProviderResponse.boundedText(value, HttpAsrPolicy.MAX_TRANSCRIPT)",
        "return HttpAsrPolicy.strictText(value);",
    )
    if not any(call in doubao for call in doubao_shared):
        errors.append(f"{DOUBAO}: 没有调用共享转写文本边界方法")
    if "TextPolicy.codePointLength(text) <= MAX_TRANSCRIPT" in http:
        errors.append(f"{HTTP}: 仍保留重复的转写文本边界逻辑")
    if "text.length() <= HttpAsrPolicy.MAX_TRANSCRIPT" in doubao:
        errors.append(f"{DOUBAO}: 仍保留重复的转写文本边界逻辑")
    if errors:
        for error in errors:
            print(error)
        raise SystemExit(1)
    print("Android ASR providers share the bounded transcript policy")


if __name__ == "__main__":
    main()
