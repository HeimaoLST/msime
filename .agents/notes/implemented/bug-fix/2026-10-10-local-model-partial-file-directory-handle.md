# Agent Note: 本地模型 partial 文件读写绑定目录句柄

Status: implemented

## Problem

续传目录虽然通过根句柄创建，但 partial 文件仍通过路径元数据检查、打开、删除和重试。根路径被替换后，下载字节可能写进外部目录，且失败清理也可能跟随替换后的路径。

## Decision

引入跨平台 `PartialDirectory`，Unix 保存父目录和目录句柄；partial 文件使用相对句柄的 `openat`、`O_NOFOLLOW`、元数据校验和删除，续传完成或失败时也按句柄清理。非 Unix 保留路径实现。

## Alternatives considered

- 每次文件操作前重新检查根路径：检查和打开之间仍可被替换。
- 只给叶子文件加 `O_NOFOLLOW`：被替换的 partial 祖先仍会把新文件导向外部树。

## Consequences

partial 下载、摘要失败重试和清理都绑定到安装期间打开的目录对象；根路径替换不再改变续传文件的落点。staging 内其他解包写入仍由独立修复覆盖。

## Verification

- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`（60 passed, 1 ignored）
- `cargo fmt --all`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
- `git diff --check`
