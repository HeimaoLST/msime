# Agent Note: MCP 参数文件绑定父目录句柄

Status: implemented

## Problem

MCP 的 `call` 和 `prompt` 支持用 `@path` 从文件读取 JSON 参数，但原实现使用路径型 `open_private_file`。参数文件的父目录在检查后被替换成符号链接时，打开操作可能跟随新目录并读取状态目录之外的文件。

## Decision

改用 `client-core` 的 `open_private_file_in` 接口。Unix 实现逐级打开并绑定父目录，再通过目录句柄打开叶子文件；父目录被替换时读取失败，不会跟随符号链接。叶子文件仍由同一接口拒绝符号链接和多重硬链接。

## Alternatives considered

- 只在 MCP 中调用 `reject_symlink`：检查与打开之间仍有目录替换窗口。
- 只检查参数文件叶子：父目录替换仍可把读取导向外部目录。
- 直接在 MCP 中复制 `openat` 逻辑：会绕过共享存储层的跨平台策略。

## Consequences

`@path` 参数读取沿用共享私有文件策略；目录替换会变成明确的读取错误。文件大小、UTF-8 和 JSON 对象校验保持不变。

## Verification

- `cargo test -p msime-mcp-server argument_files_reject_a_symlinked_parent --locked`（旧实现失败，修复后通过）
