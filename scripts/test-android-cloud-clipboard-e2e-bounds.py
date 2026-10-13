#!/usr/bin/env python3
"""Android 的云剪贴板端到端驱动请求在 JNI 复制之前按共享上限拦下，Java 侧与 C++ 侧用同一个数。

`msime_client_cloud_clipboard_e2e` 自己拒绝超过 2 MiB 的请求（`crates/host-api/src/ffi/providers.rs` 的 `CLOUD_CLIPBOARD_E2E_REQUEST_LIMIT`）；JNI 适配要在 `GetByteArrayElements` 之前先查长度，否则一个超大的数组会先被整份复制一遍。
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
CPP = ROOT / "platforms/android/native/client_jni.cpp"
JAVA = ROOT / "platforms/android/java/app/msime/android/core/NativeClient.java"
FFI = ROOT / "crates/host-api/src/ffi/providers.rs"


def main() -> int:
    cpp = CPP.read_text(encoding="utf-8")
    java = JAVA.read_text(encoding="utf-8")
    ffi = FFI.read_text(encoding="utf-8")
    errors = []
    if "const CLOUD_CLIPBOARD_E2E_REQUEST_LIMIT: usize = 2 * 1024 * 1024;" not in ffi:
        errors.append(f"{FFI}: 共享驱动的请求上限变了，Android 的两处上限要跟着改")
    if "constexpr jsize kCloudClipboardE2eRequestLimit = 2 * 1024 * 1024;" not in cpp:
        errors.append(f"{CPP}: 缺少 kCloudClipboardE2eRequestLimit")
    marker = "Java_app_msime_android_NativeClient_cloudClipboardE2eRaw"
    start = cpp.find(marker)
    if start < 0:
        errors.append(f"{CPP}: 缺少 cloudClipboardE2eRaw 导出")
    else:
        body = cpp[start:cpp.find("\n}", start)]
        if "bounded_request(env, request, kCloudClipboardE2eRequestLimit" not in body:
            errors.append(f"{CPP}: cloudClipboardE2eRaw 必须在 JNI 复制之前按上限拦下")
    if "CLOUD_CLIPBOARD_E2E_REQUEST_LIMIT = 2 * 1024 * 1024;" not in java:
        errors.append(f"{JAVA}: 缺少 CLOUD_CLIPBOARD_E2E_REQUEST_LIMIT")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print("Android cloud clipboard e2e requests are bounded before JNI copies")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
