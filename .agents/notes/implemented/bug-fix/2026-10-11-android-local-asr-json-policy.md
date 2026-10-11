# Agent Note: Android 本地语音复用共享转写文本策略

Status: implemented

## Problem

`LocalAsrPolicy.transcript` 已改为调用 `AiProviderResponse.boundedText`，但 Android 本地语音 JSON 契约脚本仍要求本地源码直接出现 `JsonPolicy.strictString`。实现与契约检查不一致，导致仓库 contracts 门禁失败。

## Decision

契约脚本改为检查 `AiProviderResponse.boundedText` 的共享实现、严格字符串入口以及本地策略的委托关系，同时拒绝在本地策略中重新出现长度和控制字符边界逻辑。保留 smoke 对非字符串、控制字符、非法 Unicode、Unicode 码点长度和边界长度的行为检查。

## Alternatives considered

- 恢复本地的 `JsonPolicy.strictString` 和边界判断：会重新复制共享策略，无法验证当前重构的委托关系。
- 只删除契约检查：会让本地策略失去共享实现的静态保护，未来可能再次出现重复边界逻辑。

## Consequences

共享转写文本策略继续统一处理本机、HTTP 和其它语音提供方；本地语音契约不会因为共享实现移除直接的 `JsonPolicy.strictString` 调用而误报。

## Verification

- `python3 scripts/test-android-local-asr-json-policy.py`
- `python3 scripts/test-android-shared-transcript-policy.py`
- `bash platforms/android/check-host.sh`
- `bash scripts/verify-local.sh --quick`（本改动相关检查通过；仓库已有的 Android feedback text policy 契约仍失败）
