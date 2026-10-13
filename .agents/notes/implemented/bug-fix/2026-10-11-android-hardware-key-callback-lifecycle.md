# Agent Note: Android 实体键盘显示回调生命周期

Status: implemented

## Problem

`MSIMEInputService.noteHardwareTyping()` 在实体键盘按键后把 `requestShowSelf(0)` 放入主线程队列。编辑器切换或输入服务销毁时，队列中的旧回调仍可执行；如果新编辑器已经建立组词，它会把旧编辑器的显示请求带到新会话，造成输入法窗口在错误的生命周期边界被拉起。

## Decision

捕获当前 `engineStartGeneration`，回调执行前必须仍处于同一代输入会话。`onStartInput`、`onFinishInput` 和 `onDestroy` 已推进该代数，因此旧回调会在编辑器切换或服务销毁后直接丢弃。

## Alternatives considered

- 仅检查 `hasEngineComposition()`：新编辑器也可能已经开始组词，不能识别回调属于哪个会话。
- 只在 `onDestroy` 移除回调：无法覆盖编辑器切换，且该回调原本没有可移除的独立字段。
- 增加固定延迟或同步等待：不能消除已排队回调的代际混淆，还会增加输入响应延迟。

## Verification

`python3 scripts/test-android-input-session-callback-lifecycle.py` 通过；该门禁在修复前按预期失败，修复后通过。另运行 `git diff --check`。

## Consequences

跨编辑器或服务销毁边界的旧实体键盘显示请求会被丢弃；同一输入会话内的正常显示请求行为不变。
