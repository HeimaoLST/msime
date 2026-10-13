# Agent Note: 云端词库快照队列锁绑定目录句柄

Status: implemented

## Problem

快照队列先按路径解析队列根目录，再按路径打开状态锁；状态读取和部分清理也再次解析路径。锁持有期间队列目录被替换时，锁、状态文件和清理操作可能落在不同目录，跨进程互斥和状态一致性会失效。

## Decision

状态锁通过已打开的私有目录句柄创建，状态 JSON 的读取、写入和终态清理都使用同一目录句柄。worker lease 同时保留目录句柄，后续操作可以继续确认队列根目录归属。增加 Unix 回归测试，在状态更新持锁期间替换目录，确认状态仍写入原目录对象。

## Alternatives considered

- 只在锁前后检查队列路径：检查和状态读写之间仍存在目录替换竞态。
- 只绑定状态文件：锁文件可能来自另一个目录对象，跨进程互斥仍不可靠。
- 每次操作重新 canonicalize 队列根目录：无法保持锁、读取和写入属于同一个目录。

## Consequences

快照队列状态更新使用同一个已打开目录对象完成锁定、读取和写入；队列路径被替换时不会把状态写入新目录或外部目标。目录元数据访问通过共享 `PrivateDirectory` 接口复用跨平台实现。

## Verification

- `cargo test -p msime-client-core cloud::snapshot_queue --locked`
- `cargo clippy -p msime-client-core --all-targets --locked -- -D warnings`
- `cargo test -p msime-client-core --locked`
- `npm run verify-notes`
- `git diff --check`
- `bash scripts/verify-local.sh --quick`
- `bash platforms/android/check-host.sh`
