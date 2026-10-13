# Agent Note: macOS 空译文视图同步补丁撤销

Status: rejected — 原生 CI 仍有断言失败，按用户决定撤销并等待上游修复。

## Problem

空译文分支记录服务快照代次，却没有同步控制器视图，旧视图参与服务调度时可触发递归。提交 `c2ba7c8c8` 试图同步两者，但 macOS 原生测试仍失败，不能保留为已验证修复。

## Proposal

空与非空结果共用视图同步和服务调度收尾，只对非空结果调用释义 API；增加陈旧视图与不匹配缓存释义的回归断言。

## Alternatives considered

- 保留补丁并继续修正，能沿快照与视图代次不一致的路径继续定位；但原生 CI 暴露了快照复用与学习释义行为的断言失败，当前改动尚不完整。用户选择停止本分支上的补修，撤销该提交并等待上游。
- 撤销补丁并等待上游，能退出未经原生验证通过的宿主调整；代价是恢复撤销前的空结果分支，原先递归风险仍可能存在，不保证 CI 转绿。

## Verification

`38125429411` 的 macOS arm64 构建通过，测试在 `TestLearnedGlossRuntime` 的 `session.delivered.count == 0` 和 `TestApplyCandidateTranslationSnapshotsAreReused` 的查询/视图读取次数断言失败，不再是原先的 `SIGSEGV`。没有验证纯上游基线，不能将失败归因为上游。撤销只针对 `c2ba7c8c8`，保留 Linux 的 `dc0176e24` 兼容修复及此前共享释义合并。

## Risks

等待上游是当前维护选择，不是问题已解决的证据；恢复原分支后 macOS CI 仍可能失败。本机没有 Apple 工具链，不宣称撤销后 macOS 原生通过。

## Related notes

[按显示代次记账的后续提案](../../rejected/bug-fix/2026-10-11-macos-empty-gloss-display-generation.md) 在用户重新授权继续修复后提出，随后也随 macOS 宿主改动整体撤销；不恢复本篇被否决的统一视图发布方案。

[同代次释义合并](../../implemented/bug-fix/2026-10-11-generation-gloss-merge.md) 部分重叠：共享合并与空数组契约仍保留，本篇只否决后续 macOS 视图同步补丁。[Fcitx5 网络分发身份](../../implemented/bug-fix/2026-10-11-fcitx-online-dispatch-identity.md) 负责 Linux 分发与旧版依赖兼容，不受撤销影响。检索命中的在线释义保留、macOS 释义分隔和 Android 语音笔记不决定该视图同步顺序，不吸收它们。
