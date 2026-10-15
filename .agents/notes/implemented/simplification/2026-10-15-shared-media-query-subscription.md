# Agent Note: 共享媒体查询订阅生命周期

Status: implemented

## Problem

设置平台断点、设置页主题、候选预览主题、条件字体安装器和鸿蒙启动主题分别实现 `MediaQueryList` 的 `change` 监听、旧版 `addListener` 回退和卸载清理。五处的查询、字体集合与状态更新不同，但订阅生命周期相同，重复实现容易让旧宿主或卸载路径出现不一致。

## Decision

在 `packages/ui/src/core/media-query.ts` 提供 `subscribeMediaQuery(media, listener)`，接收已经创建的 `MediaQueryList`，优先注册 `addEventListener("change")`，否则使用 `addListener`，并返回对应的清理函数。通过 `@msime/ui` 导出后，`useSettingsPlatform`、`useSettingsTheme`、`useCandidatePreviewTheme`、`installConditionalFonts` 和鸿蒙 `followSystemTheme` 复用这个方法；它们继续各自决定查询字符串、初始匹配值、启用条件、字体集合和状态更新。

## Alternatives considered

- 三处继续各自注册监听：实现最直观，但会继续复制现代 API、旧版回退和清理配对。
- 抽出完整的媒体查询 React Hook：可以进一步减少调用方代码，但会把 `useSyncExternalStore` 的服务端快照、主题的文档属性更新和候选预览的初始深色回退绑定在同一个状态 API 中，改变现有调用方边界。
- 让共享方法接收查询字符串并自行调用 `matchMedia`：接口更短，但调用方还要读取同一个查询的 `matches`，会重复创建查询对象；接收现成的 `MediaQueryList` 保留原有对象和初始读取时序。

## Verification

新增测试覆盖现代 `addEventListener` 注册与清理、旧版 `addListener` 回退，以及五个调用方的静态复用契约；条件字体测试还覆盖旧版监听器的刷新和清理。候选预览测试 5 项、设置平台测试 3 项、主题相关测试 10 项、条件字体与公共订阅测试通过；类型检查、构建、lint、格式和 quick 门禁继续覆盖共享 UI。

## Consequences

媒体查询监听的注册与清理规则集中在一个小方法里，旧宿主回退行为由同一处维护。五个调用方的状态语义、服务端快照、文档主题属性、候选预览初始回退、条件字体安装顺序和鸿蒙启动流程保持独立；新的媒体查询消费者应复用该订阅方法，不要把状态管理扩回公共层。

## Existing notes audit

按 `matchMedia`、`MediaQueryList`、`addListener`、`prefers-color-scheme` 和媒体查询监听检索活跃笔记，没有同一订阅机制的既有决定。设置平台、主题、候选预览和鸿蒙启动主题的功能测试继续记录各自可见行为，本篇只记录监听生命周期的公共抽取。
