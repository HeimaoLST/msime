# Agent Note: 手写预览复用公共延迟定时器 Hook

Status: implemented

## Problem

`HandwritingPadPreview` 和 macOS 首次安装页自己注册 `setTimeout` 并在 effect 清理它。前者由页面阶段、识别等待时间和减少动态效果决定下一阶段，后者由安装进度、安装结果和完成页延迟决定交接；两套注册和卸载生命周期都与已有的 `useTimeout` 重复。

## Decision

手写预览和 macOS 首次安装页改用 `packages/ui/src/core/use-timeout.ts` 的 `useTimeout`。调用方仍决定阶段回调和延迟值：写字、识别等待、候选展示分别使用原有时长，减少动态效果时传 `null`；安装页只在进度达到 100 且已有安装结果时等待原有的 260 毫秒。公共 Hook 继续通过 `useLatestRef` 使用最新回调，并在延迟变化或组件卸载时清理定时器。

## Alternatives considered

- 保留局部 `useEffect` 和 `window.setTimeout`：改动最小，但会继续复制公共 Hook 已经固定的注册、最新回调和清理规则。
- 把手写动画阶段也抽进通用动画 Hook：可以隐藏更多代码，但会把笔画时长、候选展示和皮肤状态绑定到无关的共享 API，扩大这次只做生命周期复用的范围。
- 把自定义双拼校验、手写滑块保存和词库查询的定时器一并迁移：这些 effect 还依赖 `draft`、`value` 或 `dictionary` 变化来重启；现有 `useTimeout` 只按延迟值重启，直接迁移会改变防抖边界，因此留给[防抖回调生命周期笔记](./2026-10-15-shared-debounced-callback.md)的独立 API 扩展。

## Verification

新增 `useTimeout` 测试覆盖延迟执行、卸载清理和 `null` 停用；静态契约检查阻止手写预览和 macOS 安装页重新注册浏览器定时器。手写预览动画测试、macOS 安装页行为测试、HarmonyOS 手写设置回归测试和公共 Hook 测试通过。

## Consequences

手写预览和 macOS 安装页与其他 UI 延迟操作共享同一套定时器生命周期，回调更新不会引入旧闭包。阶段状态、动画时长、减少动态效果、识别等待设置、安装结果和完成页交接仍由组件维护；候选动画、SVG 笔画和安装进度行为不变。其他需要按多个状态字段重启的防抖逻辑不能仅凭表面相似改用当前 Hook。

## Existing notes audit

按 `useTimeout`、`setTimeout`、`HandwritingPadPreview` 和手写预览检索活跃笔记。手写预览的功能笔记[鸿蒙手写板预览](../feature/2026-10-12-harmony-handwriting-pad-preview.md)继续记录动画行为与测试，本篇只记录定时器生命周期复用；共享间隔 Hook 笔记记录的是 `useInterval` 及其调用方，未被本次决定取代。
