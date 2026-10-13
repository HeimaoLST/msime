# Agent Note: MCP 偏好同步绑定运行时配置父目录句柄

Status: implemented

## Problem

MCP 偏好同步先通过父目录绑定入口读取 `runtime-options.json`，发布时却再次把完整路径交给 `replace_private_file`。运行期间父目录被替换时，读写可能不再指向同一棵目录。

## Decision

打开父目录句柄后，把文件名拆出并贯穿配置读取与原子写入；Unix 使用同一目录句柄的 `openat` 和 `renameat`，非 Unix 复用目录对象的安全路径实现。

## Alternatives considered

- 继续调用完整路径发布：父目录替换后读写对象可能分离。
- 发布前再次扫描符号链接：检查与发布之间仍有竞态。
- 在 MCP 服务内复制 `openat`：会绕开 `client-core` 的共享私有文件边界。

## Consequences

一次 MCP 偏好更新的 runtime-options 读取和发布绑定到同一个父目录；目录路径被替换时不会把新配置写到外部目录，原有大小限制、字段保留和错误回滚语义不变。

## Verification

- `cargo test -p msime-mcp-server --locked --quiet`：50 个单元测试、11 个 stdio 测试通过。
- `cargo clippy -p msime-client-core -p msime-mcp-server --all-targets --locked -- -D warnings`：通过。
- `cargo fmt --all` 和 `git diff --check`：通过。
