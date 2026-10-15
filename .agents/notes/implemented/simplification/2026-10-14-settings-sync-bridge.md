# Agent Note: 复用设置同步宿主命令桥接

Status: implemented

## Problem

桌面和 Android/iOS 的 Tauri 设置宿主各自写一份 `SettingsSyncClient` 的四个命令转发。命令名、参数与返回类型相同，桌面另有同步范围说明和应用成功提示。

## Decision

在 `apps/desktop/src/core/settings-sync-host.ts` 提取 `createSettingsSyncClient`，只负责 `schema/load/upload/apply`。桌面工厂在返回对象中保留 `description/appliedMessage`；移动工厂继续组装账号及 iOS Apple 登录。

历史笔记审计：Windows 账号 host API、原生账号页与桌面云账号笔记持有原生协议和持久化边界，iOS 原生主题与键盘布局笔记持有同步字段规则，均独立保留；社区资源桥接笔记涉及相同宿主组装层但拥有另一组命令，独立保留。[设置同步页面代次](../../implemented/simplification/2026-10-13-ios-visible-request-generation.md)与[Windows 原生账号 API](../../implemented/architecture/2026-10-11-windows-settings-account-host-api.md)的边界保持不变。

## Alternatives considered

- 保留两份显式映射：平台文件能直接看到所有命令，但四个相同映射继续复制，后续改接口要同步两处。
- 把桌面文案做成公共工厂选项：调用处更短，但工厂因此持有界面差异；对象展开足以保留两项专属文案。

## Consequences

桌面与移动端四个方法通过同一工厂，命令、参数、返回值和错误传播不变；桌面专属同步范围说明和应用成功提示仍在桌面组装层。新增工厂测试固定四个命令的参数映射。定向类型检查、构建、lint、格式、笔记与 quick 门禁通过；全库格式检查仍报告一个未修改文件的既有问题。

复用范围仅为共享前端的 Tauri 转发；自动化测试不证明原生宿主的登录、持久化或装机行为。
