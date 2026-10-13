# Agent Note: Android 备份页视图生命周期

Status: implemented

## Problem

`BackupPage` 的导出和恢复任务通过 `HostTask` 异步执行。视图销毁后，旧任务结果会被生命周期检查丢弃，但 `busy` 原先保持为真；页面重建后导出和恢复入口会永久禁用。

## Decision

在 `onDestroyView()` 清理行引用时同时重置 `busy`。旧任务仍可完成后台工作，但不会再写入新视图；重建后的页面可以重新操作。

## Alternatives considered

- 依赖旧回调恢复 `busy`：回调已绑定旧视图并会被丢弃，无法可靠恢复。
- 只在构建内容时重置：视图刚重建时仍可能短暂呈现错误的禁用状态，且清理动作的生命周期边界不明确。

## Verification

`python3 scripts/test-android-backup-view-lifecycle.py` 在修复前按预期失败，修复后通过；另运行 `git diff --check`。

## Consequences

离开备份页会放弃当前视图的忙碌 UI 状态；后台导出或恢复结果不再交给新视图，返回后可重新发起操作。
