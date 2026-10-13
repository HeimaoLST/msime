# Agent Note: 本地模型 tar 解包绑定 model 目录句柄

Status: implemented

## Problem

默认本地语音模型的 tar 解包在 staging/model 下按路径创建目录、写入普通文件、复制归档链接，并按路径检查模型文件。model 根路径在解包期间被替换时，这些操作会重新解析替换后的目录。

## Decision

Unix 解包使用已打开的 model 目录句柄。归档目录通过目录相对 `mkdirat` 创建，普通文件先写入句柄绑定的临时文件并原子发布，链接复制通过句柄打开源文件和目标目录，最终文件存在性检查也沿句柄遍历。非 Unix 保留原有路径实现。

## Alternatives considered

- 只检查 model_dir 是否仍是目录：检查与每次写入之间仍存在替换竞态。
- 只给叶文件加 `O_NOFOLLOW`：被替换的 model 祖先仍可把写入导向外部目录。
- 只绑定普通文件、不绑定链接复制和存在性检查：链接与最终校验仍会重新解析路径。

## Consequences

tar 解包的目录、文件、链接复制和完整性检查都固定在解包开始时打开的 model 目录对象；替换 staging 路径不会改变解包目标。输出文件在校验预算和写入完成前不会出现在目录项中。

## Verification

- `cargo fmt --all`
- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
