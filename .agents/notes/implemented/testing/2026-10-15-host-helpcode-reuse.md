# Agent Note: 宿主辅助码快照复用注释结果

Status: implemented

## Problem

宿主快照在辅助码隐藏时先由 `InputSession::candidate_annotations` 为每个候选计算辅助码，再由 `host::Session::snapshot` 重新计算同一辅助码以判断是否应显示纠错提示。结果字段不变，但隐藏辅助码的每次快照重复生成临时字符串。

## Decision

把显示辅助码的布尔值传入唯一的候选注释构造路径，在隐藏辅助码时直接把辅助码结果转换为原有 `corrected_from`，让宿主只接收一次计算结果。保留本地模式、英文候选、生成候选、五笔反查和空码行为；用真实宿主快照测试锁定字段相等及分配预算。

## Alternatives considered

- **保留两次计算**：改动最小，但隐藏辅助码的热快照仍重复分配。
- **在宿主层缓存辅助码**：可跨快照复用，但增加缓存失效和所有权边界，本片不需要常驻状态。
- **让 `InputSession` 直接知道宿主显示设置**：状态耦合到引擎内部，破坏现有选项边界；只给快照构造传一次布尔值即可。

## Verification

- 回归测试在旧实现上以 36 次分配失败；只移除宿主重复计算时为 34 次，进一步跳过隐藏路径的无用计算后为 32 次；隐藏辅助码结果与既有宿主行为测试保持。
- 宿主测试 107 项通过；完整 `cargo test -p msime-engine` 为 2081 项通过、19 项忽略，golden 31 项通过。
- `cargo fmt --all -- --check` 与 `cargo clippy -p msime-engine --all-targets -- -D warnings` 通过。
- `bash scripts/verify-local.sh --quick` 退出码为 0：契约检查、Rust workspace、Android 目标及 JVM 冒烟、wasm 检查、Linux 公共组件与原生宿主（87 项测试）、Windows 当前主机测试、macOS 原生宿主及共享 Apple bridge 通过；Windows MinGW 交叉阶段、HarmonyOS 真打包、macOS 公共桌面组件按环境跳过。

## Consequences

隐藏辅助码时，`Session::snapshot_with_helpcode_visibility` 把显示设置传到唯一的候选注释构造器。隐藏显示时直接回退到原纠错提示，不生成无用辅助码；可见显示仍只生成一次，宿主不再重新计算；可见辅助码、生成候选补码、本地模式和五笔反查保持原路径。公开 `Session::snapshot()` 继续使用原有可见行为，只有宿主快照传入真实显示设置。

这次只减少隐藏辅助码快照的临时字符串生成，不引入跨快照缓存，也不改变候选排序、过滤、快照字段或持久化格式。分配收益取决于候选中实际需要辅助码的行数。
