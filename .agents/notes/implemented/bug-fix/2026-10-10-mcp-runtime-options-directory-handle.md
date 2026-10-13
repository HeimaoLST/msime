# Agent Note: MCP 运行时选项发布绑定父目录句柄

Status: implemented

## Problem

MCP 在 Linux 发布 `runtime-options.json` 时先通过路径读取文件，再用 `NamedTempFile::new_in(parent)` 和 `persist(path)` 替换目标。状态目录或其祖先被替换成符号链接后，两个路径操作都可能跟随链接，把运行时偏好读写到状态目录之外。

## Decision

复用 `client-core` 的私有文件目录句柄接口：读取调用 `open_private_file_in`，发布调用 `replace_private_file`。Unix 实现逐级打开父目录，并在同一个目录描述符上创建临时文件和 `renameat` 替换；非 Unix 保留临时文件发布，同时拒绝父目录符号链接。

## Alternatives considered

- 只在 MCP 里重复 `symlink_metadata`：检查与 `NamedTempFile` 创建之间仍有目录替换窗口。
- 只给 `runtime-options.json` 加 `O_NOFOLLOW`：只能保护叶子，不能绑定被替换的父目录。
- 只绑定读取、不绑定发布：读取安全后仍可能把新文档写到外部目录。

## Consequences

运行时选项的读取和原子发布使用同一套跨平台私有文件策略；父目录替换会让操作失败，不会把偏好写到外部目录。现有文档大小限制、JSON 合并和替换语义保持不变。

## Verification

- `cargo test -p msime-mcp-server preferences::tests::publishing_runtime_options_rejects_a_symlinked_parent --locked`（旧实现失败，修复后通过）
- `cargo fmt --all -- --check`
- `git diff --check`
