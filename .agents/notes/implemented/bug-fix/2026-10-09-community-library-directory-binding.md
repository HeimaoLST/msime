# Agent Note: 社区资源库绑定父目录句柄

Status: implemented

## Problem

`CommunityResourceLibraryStore` 先按路径打开 `.json.lock`，再按路径读取和发布 `CommunityLibrary.json`。Unix 上父目录在锁持有期间被换名并在原路径放入另一棵目录时，锁仍属于旧目录，读写却可能落到替换目录。

## Decision

锁对象现在同时保存已打开的父目录句柄；锁文件、库文件读取和 Unix 原子发布都相对同一个句柄完成。Windows 等无 `openat` 的平台继续使用同一抽象，持有锁期间由平台的打开句柄阻止根目录换名。

## Alternatives considered

- 每次操作前重新检查父目录或 canonicalize：检查和后续读写之间仍有竞态。
- 只把锁文件改成句柄相对打开：库文件仍可能按路径解析到另一棵目录，锁与数据仍不一致。
- 取消跨进程锁：会让多个设置进程的保存互相覆盖，破坏现有并发语义。

## Verification

新增父目录替换回归测试，确认保存结果留在持锁的原目录；社区资源库测试、client-core clippy、Rustfmt 和 diff check 通过。后续运行仓库 quick 门禁及 Android host 检查。

## Consequences

社区回复库的锁、读和写绑定同一目录 inode，目录替换不会把旧库内容发布到替换目录；正常保存、去重和容量限制保持不变。
