# Agent Note: 资源 staging 文件写入绑定目录句柄

Status: implemented

## Problem

资源安装的 staging 目录创建已经绑定根目录句柄，但每个下载资源仍通过 `stage.path()` 创建文件。根路径在 staging 创建后被替换时，文件创建会解析到外部路径，导致资源字节写出受信任根目录。

## Decision

Unix 安装通过 staging 句柄打开每个资源文件，使用 `openat`、`O_NOFOLLOW` 和独占创建；非 Unix 保留路径实现。回归测试在 fetch 回调中替换根目录，确认资源仍发布到原 staging 对象。

## Alternatives considered

- 只再次检查根路径：检查和文件创建之间仍存在替换竞态。
- 只依赖文件名的 `O_NOFOLLOW`：被替换的 staging 祖先仍会把文件创建导向外部目录。

## Consequences

下载资源文件的创建绑定到已打开的 staging 目录，根路径替换不会改变写入对象；发布仍沿用已句柄化的代际 rename。

## Verification

- `cargo test -p msime-client-core resources::tests:: --lib`
- `cargo fmt --all`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
- `git diff --check`
- `npm run verify-notes`
