# Agent Note: 本地模型 partial 目录创建绑定根目录句柄

Status: implemented

## Problem

可续传下载目录在根目录句柄打开后仍通过路径检查、删除和创建。根路径被替换成符号链接时，`.partial-<id>` 可能在外部目录创建，后续下载会把临时模型数据写出受信任根。

## Decision

Unix 平台通过已打开的模型根目录句柄打开或创建 partial 目录；非 Unix 保留路径实现。现有文件级防护和续传命名规则不变。

## Alternatives considered

- 继续每次检查路径：检查和目录创建之间仍有替换竞态。
- 只在 partial 文件打开时拒绝叶子符号链接：外部 partial 目录已经被创建，祖先路径仍可被重定向。

## Consequences

partial 目录的对象绑定到安装开始时打开的根目录，根路径替换不会改变下载暂存位置；后续 partial 文件读写仍需进一步句柄化以覆盖整个续传生命周期。

## Verification

- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`
- `cargo fmt --all`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
- `git diff --check`
