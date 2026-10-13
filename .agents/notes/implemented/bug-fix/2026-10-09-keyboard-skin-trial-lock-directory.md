# Agent Note: 键盘皮肤试用锁绑定目录句柄

Status: implemented

## Problem

试用记录的锁文件虽然已经拒绝不可信路径，但锁成功后，记录读取、写入和删除仍通过状态目录路径重新解析。父目录在锁定后被替换时，锁与记录可能分别落在旧目录和替换目录，导致并发流程失去保护并写错状态。

## Decision

试用流程锁定时同时打开并保存父目录句柄，锁文件也相对于该句柄创建。试用记录的读取、原子发布和删除全部使用同一目录句柄，并为文件锁层补充相对句柄删除普通文件的接口。

## Alternatives considered

- 继续在每次操作前重新检查路径：无法消除目录替换发生在检查和打开之间的窗口。
- 只把记录读写改成安全路径打开：锁仍可能位于另一棵目录，跨进程互斥语义仍不成立。
- 仅保留路径锁并重复加锁：仍无法把后续记录操作绑定到取得锁时确认的目录。

## Consequences

试用开始、完成和崩溃恢复在同一个已锁定目录中读改写记录，目录替换不会把状态操作重定向到新目录。文件锁层新增的删除接口可供其它句柄绑定状态使用。

## Verification

`cargo test -p msime-client-core skin::keyboard_trial --locked`：7 passed。`cargo fmt --all`、`git diff --check` 和后续 client-core clippy、quick 门禁待本切片完成后运行。
