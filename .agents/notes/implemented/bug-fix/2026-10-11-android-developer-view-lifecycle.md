# Agent Note: Android 开发者页视图生命周期

Status: implemented

## Problem

`DeveloperPage` 的异步上传、导出、重置和本地设置写入结果绑定到旧视图代次。页面离开后旧回调会被丢弃，但 `busy` 原先保持为真，页面重建后所有操作永久禁用；MCP 上传确认状态和完整访问令牌也会跨越视图销毁继续留在 Fragment 实例中。

## Decision

在 `onDestroyView()` 推进代次并清空账号上下文后，重置 `busy` 和上传确认状态，同时清除 `freshToken`。旧任务仍可完成其后台工作，但回调不会写入新视图；用户回到页面时可以重新加载和操作，完整令牌必须重新生成。

## Alternatives considered

- 依赖旧回调恢复 `busy`：回调已被视图代次检查丢弃，无法可靠恢复。
- 只在 `reload()` 开始时清除 `busy`：页面重建期间仍可能显示禁用状态，且无法表达离开页面就丢弃令牌。
- 保留上传确认状态以便返回页面继续操作：确认界面属于旧视图，跨视图保留会让新视图显示陈旧的上传流程。
- 保留完整令牌以便返回页面继续分享：违反令牌只在生成页内存中保留的隐私边界。

## Verification

`python3 scripts/test-android-developer-view-lifecycle.py` 在修复前按预期失败，修复后通过；另运行 `git diff --check`。

## Consequences

离开开发者页会放弃当前视图的忙碌和上传确认 UI 状态并清除完整令牌；返回页面后需要重新加载，若要分享访问凭据必须重新生成令牌。
