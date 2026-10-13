# Agent Note: 常用语锁绑定父目录句柄

Status: implemented

## Problem

常用语存储原先按路径获取 `CommonPhrases.json.lock`，随后按路径读取和写入 `CommonPhrases.json`。父目录被替换时，锁与文档可能落入不同目录，跨进程读改写保护失效，更新也可能发布到错误目录。

## Decision

锁定常用语父目录时保存目录句柄和锁文件，加载及所有修改操作统一把句柄传入读写流程。读取和原子发布都相对于已锁定目录句柄执行，移除旧的按路径临时文件写入分支。

## Alternatives considered

- 每次读写前重新检查父目录：仍无法消除检查与打开之间的目录替换窗口。
- 只给写入加句柄：读取快照仍可能来自替换目录，读改写结果依旧不一致。
- 只保留路径锁：锁文件与常用语文档仍可能脱钩。

## Consequences

常用语的所有读改写操作按同一父目录句柄串行执行，目录替换不会重定向已取得锁的状态操作；损坏文档、符号链接拒绝和原子发布语义不变。

## Verification

新增目录替换回归测试，先验证旧实现失败，再验证修复通过。`cargo test -p msime-client-core common_phrases --locked`、`cargo clippy -p msime-client-core --all-targets --locked -- -D warnings` 和并发跨进程测试均通过。
