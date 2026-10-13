# Agent Note: 普通本地模型文件安装的 manifest 绑定目录句柄

Status: implemented

## Problem

普通本地模型文件安装已经用 model 目录句柄移动 partial 文件，但最后写入安装完整标记的 manifest 仍通过 `pack_dir` 路径创建。staging 路径被替换时，最后一步会绕过前面的句柄边界。

## Decision

Unix 普通文件安装在已打开的 model 目录句柄下原子写入 manifest；非 Unix 保留路径实现。

## Alternatives considered

- 继续按路径写 manifest：完整性标记仍可能落到替换目录。
- 只在写之前重查 staging：检查与写入之间仍有竞态。

## Consequences

普通文件安装和归档安装现在都用同一目录句柄约束 manifest 的最后写入。

## Verification

- `cargo fmt --all`
- `cargo test -p msime-client-core voice::local_models::tests::installing_files_publishes_them_with_the_manifest_and_reports_progress --lib --locked`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
