# Agent Note: 本地语音 native 创建失败时释放录音器

Status: implemented

## Problem

本地语音识别先创建 `AudioRecord`，再创建 native speech session。native 创建可能因运行库或运行时错误抛出异常；旧代码的 `finally` 在这一步之后，导致录音器没有 `release()`。

## Decision

把 native session 创建和录音线程启动放进同一清理作用域，记录 session 是否有效以及录音线程是否启动。创建或启动失败时由调用线程释放录音器；线程已启动时仍由 capture 线程负责释放，native session 只在有效句柄时销毁。

## Alternatives considered

- 只在 native 创建失败后补一次 `release()`：无法覆盖录音线程启动失败，也容易让句柄销毁条件遗漏。
- 让 native 创建先于 `AudioRecord`：冷启动时会失去模型加载期间的录音，改变现有用户行为。

## Consequences

native session 创建、录音线程启动和录音器释放现在由同一作用域协调；已启动的 capture 线程仍保持原有的录音和释放路径。

## Verification

- `python3 scripts/test-android-local-asr-resource-lifecycle.py`
- `git diff --check`
- `bash platforms/android/check-host.sh`
- `bash scripts/verify-local.sh --quick`
