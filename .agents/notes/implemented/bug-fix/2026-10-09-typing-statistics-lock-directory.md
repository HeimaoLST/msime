# Agent Note: 输入统计锁绑定目录句柄

Status: implemented

## Problem

输入统计原先按路径获取锁，但锁持有期间的统计文件读取和原子写入会重新解析目录。目录被替换时，锁与实际文档可能落在不同目录，跨进程读改写保护失效，统计更新也可能写入替换目录。

## Decision

锁定统计目录时保存目录句柄和锁文件，加载、记录、选择、按键、语音、皮肤、效率、摘要、设置和重置操作统一把句柄传入读写流程。读取和原子发布都相对于已锁定目录句柄执行，移除旧的按路径临时文件分支。

## Alternatives considered

- 每次读写前重复检查路径：仍无法消除检查与打开之间的目录替换窗口。
- 只给写入加句柄：读取快照仍可能来自替换目录，读改写结果依旧不一致。
- 只保留路径锁：锁文件与统计文档仍可能脱钩。

## Consequences

输入统计的所有读改写操作按同一目录句柄串行执行，目录替换不会重定向已取得锁的状态操作；文档校验、原子发布和错误保留语义不变。

## Verification

新增目录替换回归测试；`cargo test -p msime-client-core typing_statistics --locked`：73 passed。`cargo fmt --all` 和 `cargo clippy -p msime-client-core --all-targets --locked -- -D warnings` 均通过。
