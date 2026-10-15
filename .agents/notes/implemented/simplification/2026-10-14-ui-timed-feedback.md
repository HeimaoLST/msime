# Agent Note: UI 提示共用可重新计时的状态

Status: implemented

## Problem

`useTemporaryFlag`、`ToastProvider` 和 `EmojiPanel` 都独立维护提示状态、替换提示时取消旧计时器，以及卸载清理。布尔反馈、带动画标识的 toast 和文本通知的值不同，但计时器生命周期相同。表情面板还允许常驻错误，不能把所有通知改为自动消失。

## Decision

在 `packages/ui/src/core/use-timed-value.ts` 提供 `useTimedValue`，接收空状态值，返回当前值及更新方法。每次更新先取消旧计时器；传入毫秒数时到期恢复空状态，省略时保持新值。更新方法同步取消旧计时器并保存值及到期时间，计时器由提交后的 effect 创建和清理。到期时间从更新调用起算，StrictMode 重放沿用该时间；卸载后的更新不再提交，因此不会新建计时器。三个消费者统一接入，`useTemporaryFlag` 保留布尔接口，toast 保留动画 key，表情面板保留临时通知与常驻通知的选择。

## Historical notes

检索 `useTemporaryFlag`、`ToastProvider`、`toastMillis`、`noticeTimer` 和计时关键词后，[MCP 复制提示](../../implemented/bug-fix/2026-10-12-mcp-copy-feedback-lifetime.md)部分重叠：它约束复制结果代次和布尔反馈，不应重新接管这些业务流程。该笔记曾因单个页面无需任意值状态而放弃扩展接口；现在三个已有实现需要共享计时，通用状态位于布尔 hook 内部，MCP 仍使用原接口。

## Alternatives considered

- 只抽出可重启计时器：能保留各调用方的状态接口，但值更新与到期清空仍分散在三处，迟到更新的卸载检查也需要分别维护。
- 直接把 toast 和表情通知都改用 `useTemporaryFlag`：公共接口无需增加，但每个消费者仍要保存额外值，并组合布尔状态；表情面板的常驻错误还需要另一份状态。通用值 hook 能直接表达现有的三种值。

## Consequences

三种提示共用更新、重新计时和卸载清理实现，消费者仍定义值、文案、时长、动画标识及常驻通知。`useTemporaryFlag` 的现有调用方继续使用布尔接口。空状态须是稳定值；共享 hook 不处理宿主异步请求代次，调用方继续在接受结果前进行代次检查。

原 toast 回调在 provider 卸载后仍能创建新计时器，新增回归测试在旧实现上观察到 1 个残留计时器。把计时器建立放在已提交状态的 effect 中，使迟到调用不能建立计时器；这是本次抽取同时修复的生命周期缺口。

## Verification

`use-timed-value.test.tsx` 覆盖同值及异值更新、常驻值替换、显式清空、卸载和 StrictMode。`emoji-notice-lifetime.test.tsx` 操作实际表情面板，覆盖重复复制、常驻错误替换及客户端更换；新增 toast 用例覆盖动画重新挂载和卸载后的迟到回调，以及 StrictMode 子组件的 effect 与 layout effect 挂载通知。验证覆盖 jsdom 交互和共享前端构建，不据此声称原生设备验收。实际门禁结果记录在 PR 中。
