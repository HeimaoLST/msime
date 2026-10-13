# Agent Note: 背词进度锁绑定目录句柄

Status: implemented

## Problem

背词进度存储原先按路径获取锁，但锁持有期间的进度读取和原子写入会重新解析目录。目录被替换时，锁与实际文档可能落在不同目录，跨进程读改写保护失效，进度更新也可能发布到替换目录。

## Decision

锁定进度目录时保存目录句柄和锁文件，`load`、答题、设置、单本重置和全部重置统一把句柄传入读写流程。读取、原子发布都相对于已锁定目录句柄执行，移除按路径临时文件写入分支。

## Alternatives considered

- 每次读写前重复检查路径：仍无法消除目录替换发生在检查与打开之间的窗口。
- 只给写入加句柄：读取快照仍可能来自替换目录，读改写结果依旧不一致。
- 只保留路径锁：锁文件与进度文档仍可能脱钩。

## Consequences

背词进度的所有读改写操作按同一目录句柄串行执行，目录替换不会重定向已取得锁的状态操作；文档校验、原子发布和错误保留语义不变。

## Verification

`cargo test -p msime-client-core vocabulary::progress --locked`：22 passed。`cargo fmt --all`、`cargo clippy -p msime-client-core --all-targets --locked -- -D warnings`、`cargo test -p msime-client-core --locked`、`npm run verify-notes`、`bash scripts/verify-local.sh --quick` 和 `bash platforms/android/check-host.sh` 均通过后记录。
