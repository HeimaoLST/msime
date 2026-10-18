# Agent Note: iOS 隐藏工具栏时保持键盘高度稳定

Status: implemented

## Problem

触屏工具栏支持「隐藏」和可选工具全关后，iOS 键盘在空闲时把顶栏高度和下方间距设为零，开始组字时又恢复候选栏的高度。键盘扩展已经显示后改变 `keyboardHeight` 约束会触发 UIKit 重排，输入时表现为键盘上下抖动，用户还报告过输入法可能切回系统键盘。这个行为来自 [触屏工具栏工具全关时整行不显示](../feature/2026-10-17-touch-toolbar-empty-hides-row.md)；其余移动平台仍需要整行收起。

## Decision

iOS 继续隐藏工具栏的内容，但始终保留顶栏的高度和间距。`renderCandidateStrip` 只切换工具栏与候选内容的可见性，不再根据是否正在组字折叠 `candidateStrip`，`keyboardHeight` 约束也不随组字开始、候选变化或提交而改变。候选栏复用这块稳定的顶栏，按键位置在一次键盘会话内保持不动。Android 和 HarmonyOS 的整行收起逻辑不变。

## Alternatives considered

- **继续在组字开始和结束时调整高度**：保留隐藏模式下更矮的键盘，但这正是 iOS 抖动的触发条件，无法满足 issue #8544 的稳定性要求。
- **只在第一次组字后不再收起**：可以减少连续输入中的跳动，但第一次按键仍会触发系统键盘重排，唤起后的首次输入仍不稳定。
- **让候选栏覆盖零高度的顶栏**：可以保留紧凑高度，但需要让候选按钮越过 `UIStackView` 的布局边界并重做触摸路由，容易裁剪候选和按键命中区域；稳定保留已有顶栏布局风险更低。

## Consequences

隐藏工具栏时 iOS 键盘不再因为组字开始、结束而变高或变矮，候选栏和按键位置稳定，代价是隐藏模式仍保留一块空的顶栏高度。设置页说明这个 iOS 差异；工具栏内容和候选栏的显隐语义不变。

## Verification

`NineKeyKeyboardTests` 的隐藏工具栏和可选按钮全关场景断言顶栏高度、按键位置与 `keyboardHeight` 在空闲、组字和提交后相同；iPad mini (A17 Pro) iOS 模拟器上 `MSIMEClientTests` 的 `NineKeyKeyboardTests` 全套通过。`pnpm run verify-notes` 和 `bash scripts/verify-local.sh --quick` 通过；quick 按改动范围跳过了无关平台，Linux Docker 检查因本机没有 Docker 跳过。App 目标的独立构建还需要本机未准备的 `target/voice-runtime/ios/SherpaOnnxC.xcframework`，键盘测试目标不依赖该框架并已成功运行。

## Related notes

[触屏工具栏工具全关时整行不显示](../feature/2026-10-17-touch-toolbar-empty-hides-row.md) 仍记录 Android/HarmonyOS 的紧凑行为；本篇取代其中关于 iOS 组字时改变键盘高度的部分。
