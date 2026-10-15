# Agent Note: 设置导航复用移动端返回监听

Status: implemented

## Problem

`useSettingsNavigation` 和桌面设置外壳分别注册和清理移动面板的 `popstate` 监听，而共享 UI 已有 `useMobilePopState` 负责同样的启用条件、最新回调和卸载生命周期。多套监听规则可能在新增页面时发生漂移。

## Decision

设置导航继续单独初始化第一条 WebView 历史记录，桌面设置外壳继续单独处理原生面板事件，但两者都把移动端返回事件交给 `useMobilePopState`。回调仍按 `msimeSettings` 和 `page` 校验状态，使用当前可用页面列表恢复页面并更新标签记忆；历史写入和页面选择边界不移动。

桌面设置外壳沿用从挂载起持续监听的时机，调用 `useMobilePopState(true, ...)`，不等待异步宿主能力返回。外壳回调按 `panel` 恢复面板，面板关闭与历史写入逻辑仍由外壳管理。

## Alternatives considered

- 保留设置导航与外壳的局部监听：可以把历史初始化与事件处理写在一个 effect 中，但会重复共享 hook 已经保证的最新回调和清理逻辑。
- 把历史初始化也放进 `useMobilePopState`：能进一步减少 effect，却会让一个只负责事件订阅的 hook 拥有设置导航的 history state 契约，其他页面无法复用。

## Verification

移动端 `popstate` 生命周期测试、设置导航复用契约和桌面设置外壳复用契约测试通过；设置导航与桌面外壳类型检查、共享 UI lint、格式和 quick 门禁通过。回调仍覆盖未知页面回退到 `input`、标签记忆更新、面板状态恢复和卸载清理。

## Consequences

设置导航、桌面设置外壳与其他移动页面共享同一监听生命周期，历史初始化仍由各自页面控制，桌面外壳的原生面板事件仍由自身控制。`useMobilePopState` 只负责事件订阅与最新回调，不改变 `msimeSettings` 状态格式或页面恢复策略。本次验证共享 UI 行为，不替代 Android、iOS 或 HarmonyOS 原生返回手势验收。

## Existing notes audit

按 `popstate`、`useMobilePopState`、移动端历史和返回手势检索活跃笔记。现有触屏社区、皮肤编辑器和标签返回笔记持有历史记录格式与页面层级决定，本篇只记录把设置导航和桌面设置外壳接入既有监听 hook，相关契约保持不变。
