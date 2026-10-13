# Agent Note: Android 社区词语/词库安装视图生命周期

Status: implemented

## Problem

`ExpressionPage` 和 `LexiconPage` 把社区安装中的资源 id 保存在 Fragment 字段 `installing`。安装任务通过 `HostTask` 绑定旧视图；视图销毁后旧回调会被生命周期检查丢弃，但集合原先保留为忙碌状态，页面重建后对应按钮会永久显示“添加中”并保持禁用。

## Decision

在两个页面的 `onDestroyView()` 中清空 `installing`。旧任务仍可完成其持久化工作，但不再把旧视图的忙碌状态带入新视图。

## Alternatives considered

- 依赖旧回调移除资源 id：回调可能已被旧视图检查丢弃，无法可靠恢复状态。
- 把安装状态放进 ViewModel：安装按钮状态属于当前视图，跨视图保留会复现同一类陈旧忙碌状态。

## Verification

`python3 scripts/test-android-expression-install-view-lifecycle.py` 和 `python3 scripts/test-android-lexicon-install-view-lifecycle.py` 在修复前按预期失败，加入清理后通过；另运行 `git diff --check`。

## Consequences

离开页面会重置当前视图的安装中显示；后台安装可能仍完成，返回页面后会从持久化数据重新读取已安装状态。
