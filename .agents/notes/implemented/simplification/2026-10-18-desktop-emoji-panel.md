# Agent Note: 桌面表情与剪贴板适配器移出启动入口

Status: implemented

## Problem

独立表情窗口、独立剪贴板窗口和设置页内面板共用 `DesktopEmojiPanel`，但组件写在 `main.tsx`，同时隐式读取入口持有的默认客户端。粘贴能力查询、关闭窗口标签与异步结果的生命周期因此不能在不执行整个启动入口的情况下复用和验证。

## Decision

组件位于 `apps/desktop/src/input/desktop-emoji-panel.tsx`。`client` 由调用方显式传入，入口负责选择独立窗口的 `panelClients.emoji` 或设置页内的客户端；关闭回调仍可由设置页覆盖，独立窗口仍按初始页选择 `emoji-panel` 或 `clipboard-panel` 标签。

能力查询、查询失败回退、挂载有效标记与客户端替换规则保持原样。只在宿主支持粘贴且客户端提供剪贴板对象时注入 `paste_clipboard_text`；没有新增能力时保留客户端原有动作。不把 Tauri 命令放进 `packages/ui`，不改变共享面板的剪贴板读取、订阅、复制、提示或页面状态。

## Existing notes audit

检索 `DesktopEmojiPanel`、`supports_clipboard_paste`、表情外壳与桌面面板装配。

- [表情面板订阅](../../implemented/simplification/2026-10-14-emoji-clipboard-subscription.md)部分重叠：它持有共享面板的读取与订阅生命周期，继续保留；本项只整理桌面外壳的能力适配。
- [面板宿主模块](../../implemented/simplification/2026-10-17-panel-host-module.md)部分重叠：它持有宿主能力与主题投影，继续保留；剪贴板粘贴是独立命令，未并入通用宿主能力查询。

## Alternatives considered

- **保留入口内组件**：不增加文件，也不需要改客户端参数。但它让三个入口继续依赖启动模块的隐式默认值，无法直接验证适配器，因此不采用。
- **下沉到共享 UI 包**：所有表情面板都能直接取得桌面能力。但 Tauri 查询与窗口标签属于桌面外壳，其他宿主通过已有 `EmojiPanelClient` 提供动作即可，因此不采用。

## Verification

三个调用点使用同一个独立组件。真实面板测试覆盖查询等待、支持与拒绝、浏览器与失败回退、复制和粘贴分离、两种窗口标签、自定义关闭、客户端替换与卸载后的迟到回答。另执行类型检查、构建、相关回归、笔记校验、quick 与 CI，实际结果记录在 PR。

## Consequences

入口减少一份桌面适配实现，组件可以直接复用与测试；代价是新增一个桌面模块，调用方必须显式提供客户端。显式客户端参数漏传会导致入口类型检查失败；异步能力查询若改变依赖或取消语义，可能把旧客户端的回答应用到新面板。保留原 effect 结构并用可控 Promise 验证这些边界。本次只验证共享桌面组件，不代表原生宿主装机验收。
