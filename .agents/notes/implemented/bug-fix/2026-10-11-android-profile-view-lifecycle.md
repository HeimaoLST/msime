# Agent Note: Android 个人资料页视图生命周期

Status: implemented

## Problem

`ProfilePage` 的头像、导出、删除和注销等异步操作结果绑定发起操作时的视图。视图销毁后，`HostTask` 会丢弃旧回调，但 `busy` 原先保持为真；旋转或重建页面后所有资料操作会永久禁用。

## Decision

在 `onDestroyView()` 推进已有的 `generation`、清理视图和头像选择会话时，同时重置 `busy`。旧任务可以完成后台工作，但不会再写入新视图；重建后的页面可以重新加载并操作。

## Alternatives considered

- 依赖旧回调恢复 `busy`：回调已被视图生命周期检查丢弃，无法可靠恢复。
- 只在 `reload()` 时清除：页面重建到重新加载之间仍会显示禁用状态。

## Verification

`python3 scripts/test-android-profile-view-lifecycle.py` 在修复前按预期失败，修复后通过；另运行 `git diff --check`。

## Consequences

离开个人资料页会放弃当前视图的忙碌 UI 状态；后台请求的结果不再交给新视图，返回后需要重新加载，必要时重复操作。
