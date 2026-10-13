# Agent Note: 候选皮肤同步状态锁绑定目录句柄

Status: implemented

## Problem

候选皮肤同步状态文件由桌面宿主、MCP 服务和原生宿主等多个进程共享。原实现只有进程内的 `SYNC_RUNS` 互斥，读取、远端操作和保存之间没有跨进程锁；并且保存按路径重新打开父目录。并发读改写会让后写进程覆盖前一个进程的状态，替换父目录也可能把状态发布到另一棵目录。

## Decision

新增状态锁：先拒绝状态路径中的不可信符号链接，在确认的父目录上打开目录句柄，再以 `<state-file>.lock` 建立独占锁。状态读取和原子发布都相对于这个已锁定的目录句柄执行。同步、发布、安装记录、取消发布和查询已同步包的流程统一持有该锁；同步运行对象复用同一个锁，避免中途重新按路径打开状态文件。

## Alternatives considered

- 继续依赖进程内互斥：无法协调 Tauri、MCP 和原生宿主之间的并发访问。
- 每次读写前重复检查路径：仍无法消除父目录替换发生在检查和打开之间的窗口。
- 仅给保存加锁：读取和远端操作仍会基于过期快照，后写者依旧可能丢失另一进程的字段更新。

## Consequences

同一状态文件的跨进程读改写按锁串行化，状态更新和锁文件所在目录保持一致。锁持有期间包含远端同步请求，会延长其他状态操作的等待时间，但保证了整个快照流程的正确性。

## Verification

`cargo test -p msime-client-core skin::candidate_sync --locked`：43 passed。`cargo clippy -p msime-client-core --all-targets --locked -- -D warnings`、`cargo fmt --all` 和 `git diff --check` 均通过。
