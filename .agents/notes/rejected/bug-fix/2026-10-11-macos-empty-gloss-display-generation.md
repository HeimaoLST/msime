# Agent Note: macOS 空译文以显示代次记账

Status: rejected — 用户完全退出 macOS 宿主改动，本提案随全部 macOS 改动一起撤销、宿主恢复上游。

## Problem

`applyCandidateTranslationResults` 的异步空结果分支按服务快照代次记账，但 `synchronizeCandidateServices` 按控制器显示视图代次判断是否重放。当显示视图落后一代且缓存不属于当前请求时，两者反复调用。撤销后基线 `b500f4944` 的 macOS CI `38128002623` 中 `shortcut`、`shortcut-translations` 均 `SIGSEGV`。

## Proposal

空结果不应用释义、不发布服务视图，也不使当前服务快照失效；只按仍在显示的 `_view` 代次记录本轮尝试，再继续既有服务调度。真实 transition 或非空释义应用仍负责更新显示视图。保留共享 `[]` 主动清理契约及已有显式关闭路径。

## Alternatives considered

- 空结果也发布服务视图，能直接对齐两个代次；但空回复并不是视图更新的授权，先前 `c2ba7c8c8` 还使空分支失效服务快照，原生 CI 在快照复用和学习释义交付断言失败，不能原样恢复。
- 空结果直接返回，完全避免再入；但离线无答案仍需要继续在线/设备翻译调度，不能截断已有回退链。
- 按显示代次记录空回复，保留视图与快照边界且无需新字段或接口；代价是必须用陈旧显示视图的原生测试证明不会重入，真实视图更新后仍应允许新代次处理。

## Acceptance criteria

先扩展现有原生卡片用例：服务代次为 3、显示代次为 2、不匹配缓存被筛成空结果；显示视图与 marked text 不变，释义应用次数不增加，服务调度一次。计数上限把递归变成确定性断言失败，并在 `shortcut-translations` 入口先运行该用例。

macOS 原生 CI 中该回归以及既有 `TestApplyCandidateTranslationSnapshotsAreReused`、`TestLearnedGlossRuntime`、嵌套卡片更新用例均通过，整个宿主套件无失败。源码接线检查、笔记与本地 quick 只作为补充，不能替代原生运行。

## Risks

本机没有 Apple 工具链，需要按用户授权向 PR 推送测试及修复以迭代原生 CI；测试提交预期失败，未取得原生绿灯前不标记修复完成。不会削弱旧断言，也不归因于未验证的上游故障。

## Related notes

[共享同代次释义合并](../../implemented/bug-fix/2026-10-11-generation-gloss-merge.md) 部分重叠：其合并、空数组主动清理与异步无答案契约仍保留。[撤销的空译文视图同步补丁](../../rejected/bug-fix/2026-10-11-macos-empty-gloss-view-sync.md) 保留旧方案理由，本篇改变空回复的显示视图边界，不能用旧方案原样恢复。检索命中的 Fcitx5 在线分发、在线释义交集保留和 macOS 释义分隔笔记不决定服务快照重入，均不吸收。
