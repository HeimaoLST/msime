# Agent Note: 常用词库集合锁绑定目录句柄

Status: implemented

## Problem

集合存储按路径打开 `index.json.lock`，随后按路径读取索引、集合文件、outbox 和 preexisting 状态，并按路径删除集合文件。集合目录在锁持有期间被替换时，锁和数据操作可能落在不同目录。

## Decision

锁操作先打开集合目录句柄，再通过句柄打开并独占索引锁。所有受锁保护的集合状态读取、原子写入和集合文件删除都接收同一目录句柄；Unix 回归测试在锁建立后替换目录，确认索引仍写入原目录对象。

## Alternatives considered

- 只检查集合目录是否仍存在：检查和读写之间仍有目录替换竞态。
- 只给索引文件绑定目录：集合文件和 outbox 仍可能解析到另一个目录。
- 每个文件操作重新打开目录：无法保证一次集合变更中的文件属于同一锁定目录。

## Consequences

集合变更的索引、集合词条和待发送状态都绑定到持锁时打开的目录；目录路径替换不会把写入或删除重定向到新目录。

## Verification

- `cargo test -p msime-client-core dictionary::collections --locked`
- `cargo clippy -p msime-client-core --all-targets --locked -- -D warnings`
- `cargo test -p msime-client-core --locked`（并发运行存在既有子进程并发测试偶发失败；定向测试通过）
- `npm run verify-notes`
- `git diff --check`
