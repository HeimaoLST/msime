# Agent Note: 页内确认框的 Tab 焦点边界

Status: implemented

## Problem

`useConfirm` 打开后把焦点放到确认或取消按钮，但只处理 Esc。确认按钮上的 Tab 和取消按钮上的 Shift+Tab 会离开对话框，用户能在仍等待确认时操作背景页面，与 `aria-modal="true"` 的声明不一致。

## Decision

`useConfirm` 沿用 `ActionSheet` 的边界导航方式：取消按钮上的 Shift+Tab 转到确认按钮，确认按钮上的 Tab 转到取消按钮，取消这些边界事件的浏览器默认导航。两个按钮之间继续使用浏览器默认导航；初始焦点、Esc、鼠标操作、Promise 结算和关闭后的焦点恢复保持既有行为。

## Alternatives considered

- 改用原生 `dialog.showModal()` 可以由浏览器隔离背景交互，但需要改变现有 DOM 和 WebView 弹层生命周期。当前确认框只有两个固定按钮，边界处理与仓库现有面板一致，修复不需要引入另一种弹层机制。
- 抽取通用焦点约束工具可以供多个弹层复用，但 `ActionSheet` 处理动态、可禁用的按钮列表，确认框只有两个固定按钮。为两个引用建立通用层会增加本次修复范围，暂不抽取。

## Consequences

打开期间，用户按 Tab 无法进入背景页面，确认请求和安全默认焦点保持不变。边界处理依赖当前的两个固定按钮；将来增加控件时需同时扩展导航和回归用例。此修复约束键盘 Tab 导航，不改变程序主动调用 `focus()` 的行为。

## Testing

普通与破坏性确认框的边界回归在旧实现上均失败。修复后，两个边界循环焦点，内部导航不取消默认行为，Tab 不结算请求，Esc 关闭后返回开启按钮；确认及相关社区、账号组件共 5 个测试文件、19 项用例通过。前端类型检查和构建、改动文件 lint 与格式检查、笔记门禁及本地 quick 均通过；quick 中未配置的 Linux 容器与 HarmonyOS 原生阶段跳过。jsdom 检查事件默认行为和焦点转移，不能代表六个平台原生宿主的装机验收。

## Related notes

按 `useConfirm`、`ActionSheet`、确认框和 Tab 焦点检索活跃笔记，无持有共享确认框键盘边界的记录。账号面板焦点恢复笔记管理关闭与卸载时序，与本次打开期间的 Tab 边界无关；平台设置和聊天键盘笔记管理原生布局、输入焦点与面板可见性，也不归并。

依据：[WAI-ARIA 模态对话框键盘约定](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。
