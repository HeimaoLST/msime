# Agent Note: 本地模型 partial 发布改名绑定目录句柄

Status: implemented

## Problem

文件型模型安装下载完成后，仍通过路径 `rename` 把 partial 文件移进 staging。根路径在下载结束和发布前被替换时，路径解析可能从攻击者控制的树取文件或把文件移到外部树。

## Decision

Unix 平台保存 staging/model 和 partial 目录句柄，使用 `renameat` 完成 partial 到 staging 的移动及失败回滚；非 Unix 保留路径实现。回归测试在根路径替换后验证改名仍发生在原目录对象内。

## Alternatives considered

- 只在改名前重新检查根路径：检查与 `rename` 之间仍有竞态。
- 复制文件后删除 partial：复制期间仍需打开路径，且改变了续传安装的原子改名语义。

## Consequences

文件型安装的 partial 发布和失败回滚不再跟随替换后的根路径；归档解包和收编流程的路径型移动仍需单独审计。

## Verification

- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`（61 passed, 1 ignored）
- `cargo fmt --all`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
- `git diff --check`
