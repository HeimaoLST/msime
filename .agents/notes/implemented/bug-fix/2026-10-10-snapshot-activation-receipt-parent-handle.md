# Agent Note: 词库快照激活回执绑定父目录句柄

Status: implemented

## Problem

Host API 写入词库快照激活回执时使用 `NamedTempFile::new_in` 和路径型 `persist`。回执目录如果是符号链接，或在临时文件创建后被替换，发布路径可能跟随目录外的目标。

## Decision

复用 `client-core` 的 `replace_private_file` 接口。Unix 实现先打开并绑定父目录，再在同一目录句柄上创建临时文件并 `renameat` 替换；其他平台沿用受保护的私有发布策略。

## Alternatives considered

- 只检查回执叶子：不能阻止父目录替换导致的路径重定向。
- 只调用 `reject_symlink`：检查和发布之间仍有竞态窗口。
- 在 Host API 中复制目录句柄逻辑：会分叉共享存储层的跨平台实现。

## Consequences

激活回执仍保持原子替换和固定内容；父目录被替换或是符号链接时操作失败，不会修改外部目录。

## Verification

- `cargo test -p msime-host-api activation_receipt --locked`（新增父目录回归测试及既有叶子测试均通过）
