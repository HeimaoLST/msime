# Agent Note: 账号底部面板的 Tab 焦点边界

Status: implemented

## Problem

`BottomSheet` 承载账号登录与昵称编辑，声明 `aria-modal="true"` 并在打开时移入焦点，却没有处理 Tab。面板末尾的输入框或按钮上按 Tab、首个控件上按 Shift+Tab，会进入背景页面，登录和昵称草稿仍留在模态面板中。

## Decision

在面板键盘入口沿用 `ActionSheet` 的首尾循环方式，按当前 DOM 重新取可参与 Tab 导航的控件，支持链接、输入框和按钮，排除禁用、隐藏、负 `tabIndex` 和 `inert` 控件。边界事件取消默认导航，内部导航交给浏览器；初始没有可用控件时聚焦面板容器，操作进行期间所有控件禁用时，Tab 也聚焦容器。面板记录自己最近聚焦的控件；它被禁用或移除而使焦点落在 `body` 时，由布局效果把焦点交给容器，避免下一次 Tab 从背景开始。主动移到其他页面控件时清除记录，不抢回该焦点。组合按键仍交给输入法，普通 Esc 沿用关闭禁用条件，关闭后沿用现有焦点恢复。

## Alternatives considered

- 改为原生 `dialog.showModal()` 可以由浏览器隔离背景交互，但会改变共享 WebView 面板的 DOM 和呈现生命周期；仓库已有 `ActionSheet` 的首尾导航方式，本次修复保持现有宿主与布局契约。
- 只循环关闭与末尾按钮可以少查询 DOM，但登录表单动态展开、有输入框和隐私链接，忙碌时关闭和保存按钮也会禁用，固定按钮引用无法表达当前的可用控件顺序。

## Consequences

账号登录与昵称面板在打开期间保有 Tab 焦点范围，忙碌和切换表单时仍能接续键盘操作。每次 Tab 查询当前 DOM，不缓存已失效的控件列表。焦点顺序遵循现有 DOM；没有引入正 `tabIndex` 排序或对 CSS 隐藏元素的通用探测。

## Testing

旧实现下，普通与严格模式的首尾边界、混合控件、全部禁用状态共 4 项回归失败；仅实现键盘循环时，移除聚焦控件的第 5 项回归仍失败。初始全部禁用的第 6 项回归也在修复前失败。修复后账号面板、账号页、验证码表单和昵称编辑器 4 个文件共 84 项用例通过，包含原有焦点恢复与组合 Esc；无头 Chromium 以真实 Tab 和 Shift+Tab 验证内部导航、边界循环和所有控件禁用时的容器焦点。前端类型检查与构建、改动文件 lint 与格式检查、笔记门禁和本地 quick 通过；未配置的原生构建阶段按门禁规则跳过。本次验证不能代表原生宿主设备验收。

## Related notes

检索 `BottomSheet`、账号面板和 Tab 焦点：[关闭后焦点恢复](../../implemented/bug-fix/2026-10-14-account-sheet-restore-focus.md) 持有卸载清理时序，[组合 Esc](../../implemented/bug-fix/2026-10-14-account-sheet-ime-escape.md) 持有输入法按键优先权，均保留原决定。[确认框 Tab 边界](../../implemented/bug-fix/2026-10-14-confirm-dialog-tab-focus.md) 使用固定两个按钮，与本次动态表单的导航对象不同。Google 登录与全平台设计笔记持有原生 OAuth 和视觉布局，不归并。

依据：[WAI-ARIA 模态对话框键盘约定](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。
