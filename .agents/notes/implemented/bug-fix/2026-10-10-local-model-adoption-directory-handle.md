# Agent Note: 本地模型收编绑定来源与 staging 目录句柄

Status: implemented

## Problem

本地模型收编先检查来源文件，再用 `source.join(name)` 和 `pack_dir.join(name)` 改名、读取和回滚。来源目录或模型根在检查后被替换时，路径解析可能把资源文件导向替换目录；staging 来源记录也可能写到替换后的路径。

## Decision

Unix 收编在检查后打开来源、staging 和 staging/model 目录句柄。文件校验通过目录相对句柄完成，文件改名和失败回滚使用 `renameat`，来源记录和 manifest 使用目录相对原子写入。句柄打开后来源或模型根路径被替换，操作仍只作用于原目录对象。非 Unix 保留路径实现。

## Alternatives considered

- 再次检查来源和根路径：检查与改名之间仍有替换竞态。
- 只用 `O_NOFOLLOW` 打开文件：目录祖先被替换时仍可能进入外部目录。
- 只绑定 staging/model：来源文件校验和改名仍会重新解析来源路径。

## Consequences

收编不再依赖可替换的来源或 staging 路径完成移动、读取、回滚和完整性标记；符号链接来源继续映射为安全的归档错误。

## Verification

- `cargo fmt --all`
- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
