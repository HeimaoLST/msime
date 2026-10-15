# Agent Note: 首次设置复用移动端返回监听

Status: implemented

## Problem

首次设置流程在 HarmonyOS 手机分支自己注册和清理 `popstate` 监听，而共享 UI 已有 `useMobilePopState` 负责相同的启用条件、最新回调和卸载生命周期。两套主监听规则可能在流程变更时发生漂移。

## Decision

首次设置流程把处理自身历史记录的主 `popstate` 回调交给 `useMobilePopState(harmonyPhone, ...)`。回调继续按 `onboardingHistoryEntry` 恢复页面深度，并在回退历史期间由 `rewinding` 拦截迟到事件；`rewindHistory` 为等待 `history.go(-depth)` 完成而注册的一次性监听仍保留在流程内，因为它拥有独立的 Promise 完成契约。

## Alternatives considered

- 保留流程的主监听：实现改动最小，但会继续复制共享 hook 已保证的移动端启用、最新回调和清理生命周期。
- 扩展 `useMobilePopState` 支持一次性监听和历史跳转完成：可以进一步减少流程代码，但会把 `history.go` 的完成时序和 Promise 所有权塞进通用订阅 hook，扩大其跨页面契约。
- 抽出通用历史状态 Hook：可以同时封装页面深度和监听，但设置导航、社区详情和首次设置的历史字段不同，会把不相容的记录格式绑定在一起。

## Verification

移动端返回监听、首次设置页面和静态复用契约测试共 32 项通过；类型检查、构建、lint、改动文件格式、笔记校验和 quick 门禁覆盖本片。静态契约确认主流程不再直接注册 `popstate`，同时保留回退历史所需的一次性监听。

## Consequences

首次设置的主返回监听与设置导航、社区详情等移动页面共享同一生命周期，页面恢复、深度计数和回退历史的行为保持不变。流程仍保留一个只服务于 `history.go(-depth)` 完成通知的局部监听；`useMobilePopState` 不承担首次设置的历史记录格式或跳转 Promise。

## Existing notes audit

按 `popstate`、`useMobilePopState`、移动端历史和返回手势检索活跃笔记。[设置导航复用移动端返回监听](2026-10-15-settings-navigation-popstate.md)记录同一订阅 Hook 在设置导航中的接入；社区图库、皮肤编辑器和标签返回笔记分别持有自己的历史记录格式。本篇只补充首次设置的主监听迁移，未改变这些页面的记录契约。
