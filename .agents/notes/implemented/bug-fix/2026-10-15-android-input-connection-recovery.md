# Agent Note: Android 输入连接失败后自动重建会话

Status: implemented

## Problem

Android 输入服务把共享运行时返回的解析失败、JNI 链接失败或编辑器拒写统一送入 `fail`。原实现销毁当前 Engine 会话后永久退到“仅直接输入”，同一个编辑器不会再次建立会话；一次短暂的输入连接故障因此会持续到用户切换输入框或重启输入法。#7837 报告了连续输入期间反复出现“输入连接失败”，但没有提供可确认的设备现场或异常类别，不能把本地故障当作现场根因。

## Decision

在仍有当前 `session`、编辑器 `connection` 和可重建的 `runtimeOptionsForSnapshot` 时，`fail` 在同一输入会话内自动排队一次 Engine 重建。重建沿用输入会话代次围栏和已有的实时偏好读取、个人词库同步及资源校验；恢复期间键盘显示“输入连接恢复中”，编辑器仍可收到直接输入。重建失败或同一输入会话再次失败时，保留原来的“输入连接失败：仅直接输入”降级。

自动恢复只允许一次，避免损坏的运行时选项或持续拒写导致无限重启。换输入框在 `onStartInput` 重置次数；没有编辑器、没有会话或没有运行时选项时不尝试重建。

## Alternatives considered

- 每次失败都无限重建：能够掩盖配置损坏并在输入服务中形成重启循环，不能采用。
- 只显示失败并等待用户切换输入框：保留了原故障窗口，无法恢复一次性的 JNI、编辑器连接或共享会话失步。
- 直接调用 `restartInput`：它由系统重新选择输入连接，不能保证当前编辑器仍在，也绕过现有 Engine 启动代次和实时偏好契约；复用 `scheduleEngineStartup` 的围栏更明确。

## Verification

- 新增 `InputFailureRecoveryPolicySmoke`，覆盖首次恢复、单次上限、缺会话、缺编辑器连接和缺运行时选项五种边界。
- 运行 Android host contract 检查；在 API 28 `emulator-5566` 安装原生 APK，并单独运行 `InputFailureCategoryDeviceSmoke`，确认安装产品包含恢复策略且首次失败只重试一次。完整 `smoke.sh emulator-5566 --core` 在 `LengthFilter(30)` 合成输入框阶段失败（输入法树停在 `n`，随后记录 `editor_rejected`），因此不能把整套核心冒烟记为通过；未使用 API 35 设备。
- 诊断仍只写固定 `input_failure_*` 类别，不记录异常原文、输入、路径或凭据。

## Consequences

一次可恢复的输入连接失败会短暂重建共享会话，期间直接输入仍可用；如果运行时配置或编辑器持续拒绝，至多尝试一次后保持原有降级行为。该修复改善恢复能力，但没有设备现场证据证明它就是 vivo Android 11 的原始根因，因此 PR 使用 `Refs #7837`，不自动关闭 issue。
