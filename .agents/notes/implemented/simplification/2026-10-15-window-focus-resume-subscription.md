# Agent Note: 窗口焦点事件订阅复用公共清理

Status: implemented

## Problem

共享设置页、皮肤目录、键盘面板和设置窗口分别手写窗口 `focus`、`blur` 与文档 `visibilitychange` 的注册、可见性判断和卸载清理。多处实现容易在某个平台只清理一个事件，或把后台切回前台误当成刷新时机。

## Decision

在 `packages/ui/src/core/window-focus.ts` 提供同步的 `subscribeToWindowEvent`、`subscribeToWindowFocus`、`subscribeToWindowBlur`、`subscribeToWindowResume` 和 `subscribeToDocumentVisibilityChange`。调用方仍在自己的 `useEffect` 中决定首次读取、启用条件、异步代次失效和轮询；公共函数只拥有事件注册与对称清理。`subscribeToWindowResume` 只在文档状态为 `visible` 时转发恢复事件，并在没有 DOM 时返回空清理函数；失焦订阅只转发 `blur`，不替调用方决定状态如何清理。

通用窗口事件订阅按 `WindowEventMap` 保留内置事件类型并在无窗口时返回空清理函数，也透传 `addEventListener` 的选项（包括 `once`）；未知的宿主自定义事件按 `Event` 接收。窗口焦点、键盘面板的 `resize`/`keydown`、离窗保存的 `pagehide`、onboarding 的一次性 `popstate`、移动端返回 Hook 和桌面宿主的两个自定义事件都复用同一注册与清理入口。调用方仍保留事件处理和 effect 生命周期。

文档可见性订阅原样转发 `visibilitychange`，不在订阅时主动回调，也不选择显示或隐藏状态。恢复前台工具、离窗保存、移动设置恢复与剪贴板轮询共用这项清理契约。移动设置继续用前一次 `document.hidden` 判断真正恢复；剪贴板仍在异步宿主通知注册成功后停止轮询及可见性监听，注册失败或没有能力时保持轮询，卸载时重复清理同一订阅也安全。

## Alternatives considered

- 每个页面继续维护自己的事件 effect：调用方最直观，但多份注册和清理已经出现，新增页面还会复制可见性判断。
- 把首次刷新、代次递增和轮询也塞进一个 React hook：可以进一步减少 effect 代码，但会把不同页面的异步所有权和请求失效时机绑定在一起，无法保留现有生命周期边界。

## Verification

公共订阅测试覆盖内置与自定义窗口事件、`once` 选项、焦点、失焦事件、可见与隐藏转换、无 DOM 与重复清理后的无回调；移动返回监听测试确认 onboarding、移动端返回 Hook 和桌面宿主不再直接注册窗口事件。文档订阅、离窗保存、移动设置恢复、设置宿主订阅和剪贴板生命周期共五文件三十二项测试通过；面板拖动、设置页窗口离开和设置整页的 394 项测试，以及按键重复的 10 项测试通过，包含失焦后停止长按。相关调用方不再直接注册 `blur`。桌面和鸿蒙 TypeScript 检查、生产构建、lint、格式及笔记校验覆盖共享 UI；改动后 `packages/ui/src` 只保留公共工具本身的窗口事件注册。

## Consequences

窗口事件调用点与四处文档可见性订阅共享同一套事件清理，首次刷新、请求代次、后台轮询、按键重复和宿主启用条件仍由各页面控制。公共工具只覆盖同步 DOM 事件，不负责异步注册完成后的取消句柄；那部分契约仍由[窗口状态监听笔记](./2026-10-14-window-state-subscription.md)持有。本次只验证共享 UI 生命周期，不替代各平台原生窗口验收。

## Existing notes audit

按窗口焦点、`visibilitychange`、恢复前台、`subscribeToWindow`、`usePanelDrag`、`useFlushOnWindowLeave` 和 `trackAsyncSubscription` 检索活跃笔记。相关的[窗口状态监听清理](./2026-10-14-window-state-subscription.md)只记录异步宿主监听的晚到注册释放，[渲染值引用复用](./2026-10-14-render-value-ref-reuse.md)持有最新回调引用的维护机制，本篇记录同步 DOM 事件订阅；三者边界保持独立。
