# Agent Note: 资源 generation 发布拒绝覆盖

Status: implemented

## Problem

资源安装先检查目标 generation 是否存在，再把完整 staging 目录重命名到 generation。目标在检查后被创建时，普通 `renameat` 会覆盖它，违反“已有 generation 不覆盖”的安装语义。

## Decision

Linux、Android 和 Apple 使用目录句柄上的 `renameat` 与 `RENAME_NOREPLACE` 原子发布；目标已存在时返回 `AlreadyExists`，保留原 generation 和 staging。其他 Unix 保留现有 `renameat` 兼容路径。

## Alternatives considered

- 再做一次路径存在检查：检查和重命名之间仍有竞态。
- 先删除已有 generation：会破坏已验证的资源集，也无法恢复并发写入者的内容。

## Consequences

资源安装不会因发布竞态覆盖已存在的 generation；Linux、Android 和 macOS 都使用系统提供的 no-replace 原子操作，缓存命中和正常首次发布流程保持不变。

## Verification

`cargo test -p msime-client-core resources::tests:: --lib --locked`：29 passed（含 macOS no-replace 回归测试）。

`cargo fmt --all`、`cargo clippy -p msime-client-core --lib --locked -- -D warnings`、`cargo check -p msime-client-core --all-targets --locked` 和 `git diff --check` 通过。
