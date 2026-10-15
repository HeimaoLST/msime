# Agent Note: macOS 普通左右键编辑拼音光标

Status: implemented

## Problem

#7771 希望用普通左键回到拼音串中编辑。macOS 宿主把全拼、双拼的普通左右键发送成 `ConversionLeft` / `ConversionRight`，进入整句汉字改字，行内显示随之变成候选汉字，用户看到拼音失去编辑入口。

## Decision

macOS 普通左右键向引擎发送已有 `MoveLeft` / `MoveRight` 字母光标命令，保留现有 Ctrl 分段编辑策略。引擎的整句改字 API 与 Windows、Linux 路由保留；macOS 不再用普通左右键自动进入整句改字。

本决定部分取代[整句改字](../../implemented/feature/2026-10-10-sentence-conversion-edit.md)的 macOS 普通方向键入口，其引擎转换和其它平台决定保留。

## Alternatives considered

继续要求 Ctrl+左右编辑拼音能够保持三个桌面平台原有路由一致，但用户按 macOS 常见输入法的普通左右键就看不到字母光标，且无法自然配合候选展开导航，因此恢复普通字母光标入口。

## Verification

原生 `shortcut` 回归覆盖有候选和候选窗隐藏时发送字母光标命令且不上屏；现有 Ctrl 编辑测试维持原来的规则。编译与运行结果随 PR 记录。

历史笔记检索：整句改字笔记部分重叠，双方互链；展开网格笔记保留网格导航决定；组字光标笔记保留已有字母光标接口。

## Consequences

macOS 用户不能再用普通左右键进入汉字改字，这是为普通拼音编辑作出的入口取舍。候选网格打开后的方向键继续由网格状态处理。
