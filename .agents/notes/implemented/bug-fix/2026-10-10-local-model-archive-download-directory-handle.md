# Agent Note: 本地模型主归档下载绑定 staging 句柄

Status: implemented

## Problem

默认本地语音模型安装把 tar 归档按 staging 路径写入，随后又按路径重新打开读取和删除。staging 路径被替换时，下载字节可能写入替换目录，解包也可能读取错误对象。

## Decision

Unix 安装通过已打开的 staging 目录句柄原子写入归档，下载完成后从同一目录句柄打开只读归档文件，解包完成后按句柄删除归档。非 Unix 保留路径实现。

## Alternatives considered

- 下载后重新检查 staging 路径：检查与读取、删除之间仍有替换竞态。
- 只把输出目录句柄化：归档输入仍可能被替换后重新解析。
- 保留归档文件路径并依赖 `O_NOFOLLOW`：被替换的父目录仍可重定向路径。

## Consequences

主 tar 归档的下载、读取和清理都绑定同一个 staging 目录对象，归档内容与 tar 解包目标不会因 staging 路径替换而漂移。

## Verification

- `cargo fmt --all`
- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
