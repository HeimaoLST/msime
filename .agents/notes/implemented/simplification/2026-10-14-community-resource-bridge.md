# Agent Note: 复用社区资源宿主 bridge

Status: implemented

## Problem

桌面和 Android/iOS Tauri 宿主分别实现了社区词包与回复模板的 `CommunityResourceClient`。七个共同命令和举报类型映射完全重复，移动端另有回复模板键盘的两个能力，桌面必须继续隐藏它们。

## Decision

提取一个公共 `createCommunityResourceClient` 工厂，统一共享命令、参数和举报后端 kind 映射；通过显式 `includeReplyActions` 选项只在移动端附加 `storeReply` 与 `removeReply`。桌面和移动宿主保留各自工厂作为平台组装边界，其他服务不移动。

历史笔记审计：Windows 社区 API 笔记记录原生命令和进程边界，本次不改变；社区资源代次笔记记录页面生命周期，本次不改变；两者均独立保留。

## Alternatives considered

- 保留两个宿主对象：平台边界清楚，但共同命令和参数继续漂移。
- 让移动和桌面共用完整客户端：会让桌面暴露回复键盘专属能力，改变页面能力判断；因此只通过选项附加两个方法。
- 把整个 `createMobileHostServices` 合并：会移动账号、皮肤和平台动作等独立差异，超出 bridge 复用范围。

## Consequences

桌面和移动宿主通过同一个工厂转发七个共同命令及举报 kind 映射；移动端用 `includeReplyActions` 显式附加回复键盘的两个方法，桌面仍没有这两个属性。平台工厂仍保留，账号、皮肤和系统动作没有移动。

公共工厂、桌面宿主、移动宿主和宿主工厂测试连同社区页面回归共 72 个文件、277 项通过。桌面构建、HarmonyOS 类型检查、lint、格式、笔记门禁、diff 检查和 quick 通过；lint 仅有未修改文件的既有告警。本次验证覆盖共享前端与 Tauri service mapping，不作为原生宿主装机验收。

工厂只统一命令转发，不改变资源页面代次、权限判断或原生命令契约；测试固定了桌面隐藏回复方法和移动端启用方法。
