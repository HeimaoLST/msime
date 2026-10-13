# Agent Note: Android 剪贴板编辑页视图生命周期

Status: implemented

## Problem

`ClipboardEditPage` 的保存请求通过 `HostTask` 异步执行。视图销毁后，旧任务结果会被生命周期检查丢弃，但 `saving` 原先保持为真；页面重建后保存按钮永久禁用。

## Decision

在 `onDestroyView()` 清理编辑器视图引用时同时重置 `saving`，让重建后的编辑器可以重试保存。

## Alternatives considered

- 依赖旧回调恢复 `saving`：回调已绑定旧视图并会被丢弃，无法可靠恢复。
- 只在内容重建时重置：生命周期边界不清晰，且重建前仍会留下错误的忙碌状态。

## Verification

`python3 scripts/test-android-clipboard-edit-view-lifecycle.py` 在修复前按预期失败，修复后通过；另运行 `git diff --check`。

## Consequences

离开编辑页会放弃当前视图的保存 UI 状态；后台保存仍可能完成，返回页面后可重新发起保存。
