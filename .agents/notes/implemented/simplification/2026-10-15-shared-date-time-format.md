# Agent Note: 复用日期时间格式化

Status: implemented

## Problem

统计页、剪贴板历史和云剪贴板设备列表分别直接调用 `Date.toLocaleString`，无效日期处理和本地化参数分散在调用方，后续页面容易重复实现。

## Decision

在 `packages/ui/src/core/format-date.ts` 提供 `formatDateTime`。函数接受字符串、数字或 `Date`，可选透传 `Intl.LocalesArgument`，无效日期返回空字符串。调用方保留自己的业务回退：云设备解析失败显示原始字符串，剪贴板历史先判断旧时间戳，统计页继续使用 `zh-CN`。

## Alternatives considered

- 只在三个调用方各自统一写法：改动较小，但仍保留重复的日期构造和无效值判断。
- 强制所有调用方使用固定 `zh-CN`：会改变剪贴板和云设备当前跟随系统区域设置的行为，因此保留可选 locale。

## Verification

日期格式测试覆盖有效值、指定 locale 和无效值；相关 UI 测试、桌面/HarmonyOS TypeScript 检查、格式、差异检查、本地 quick 门禁及笔记校验通过。

## Consequences

公共函数只负责日期解析和格式化，不决定业务上的旧记录阈值或无效值回退。新增调用方可以复用同一日期时间格式化入口并明确自己的 locale 与错误显示策略。
