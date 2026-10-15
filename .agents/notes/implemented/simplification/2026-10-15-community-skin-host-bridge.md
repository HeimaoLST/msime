# Agent Note: 复用社区皮肤宿主操作桥接

Status: implemented

## Problem

Android/iOS 的 Tauri 宿主和 HarmonyOS 宿主分别实现 `CommunitySkinClient` 的列表、详情、下载、评分、发布、下架、分类、试用和举报九个方法。方法返回值与操作参数相同，重复代码容易让两个宿主的 UI 契约漂移；差异只在 Tauri 命令和 HarmonyOS 原生请求的封装，以及 `mine`、举报类型等传输字段映射。

## Decision

在 `packages/ui/src/community/community-skin-client.ts` 提取纯操作工厂 `createCommunitySkinClient`。工厂接收带操作名和参数的泛型请求函数，负责构造 `CommunitySkinClient` 的九个方法和返回类型。Tauri 与 HarmonyOS 各自保留 transport mapping：Tauri 映射命令与 `community_report` 的 `kind: "skins"`，HarmonyOS 映射 `community_operation` 并把 `mine` 转为 `scope`。社区页面、试用生命周期和账号权限判断不移动。

历史笔记审计：社区 gallery adapter、社区资源 bridge、社区发布与安装生命周期笔记分别约束页面操作组合、另一组资源命令和异步代次；本次只统一社区皮肤 host operation，不改变这些边界。

## Alternatives considered

- 保留两个完整客户端：每个平台能直接阅读协议，但九个 UI 方法继续复制，新增操作需同步修改两处。
- 让两个宿主共享 Tauri 命令映射：可减少一份代码，但 HarmonyOS 使用不同的原生请求协议，且会把 Tauri transport 泄漏到平台无关层。
- 把社区皮肤页面和宿主客户端一起合并：能进一步减少重复，但会混合 UI 生命周期、试用状态和 transport，超出本次桥接范围。

## Consequences

两个宿主通过同一工厂提供九个客户端方法；命令/请求字段、返回类型、错误传播和 `mine`、举报映射保持现状。新增工厂契约测试，相关社区页面测试、桌面/HarmonyOS 类型检查、桌面构建、格式和差异检查通过；改动范围 lint、笔记和 quick 门禁作为提交前验证。

自动化验证覆盖共享 UI 与 host mapping，不替代 HarmonyOS 原生设置应用或 Android/iOS 输入法设备验收。
