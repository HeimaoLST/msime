# Agent Note: Android 反馈页视图生命周期

Status: implemented

## Problem

`FeedbackPage` 的提交请求结果绑定发起操作时的视图。视图销毁后，`AboutPage.network()` 会丢弃旧回调，但 `sending` 原先保持为真，重建页面后提交按钮永久禁用。

## Decision

保存提交请求的 `Future`，在 `onDestroyView()` 中中断并清除它，同时重置 `sending`。回调完成时先清除当前任务引用；旧视图的结果仍由 `AboutPage.network()` 的视图检查丢弃。

## Alternatives considered

- 依赖旧回调恢复 `sending`：回调已被旧视图检查丢弃，无法可靠恢复。
- 只重置 `sending` 而不取消请求：旧网络请求可能继续消耗资源并在用户重试时造成重复提交。

## Verification

`python3 scripts/test-android-feedback-view-lifecycle.py` 在修复前按预期失败，修复后通过；另运行 `git diff --check`。

## Consequences

离开反馈页会取消当前视图发起的提交；如果底层网络库已无法中断，服务端可能仍收到该请求，返回页面后需要确认提交状态再重试。
