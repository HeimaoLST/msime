# Agent Note: 词库快照激活绑定目录句柄

Status: implemented

## Problem

词库快照激活先按路径取得维护锁，随后仍用路径枚举并移动 user、cache 和 dictionaries 的内容。Unix 上锁持有期间若根目录被换名并在原路径放入另一棵目录，锁仍属于旧目录，激活却会改动替换后的路径目录。

## Decision

维护访问在取得共享或独占锁时同时打开并保存每个词库根目录句柄，锁文件也相对该句柄打开。激活为所有活动和 staged 根目录建立句柄，并通过 `openat`/`renameat`/`unlinkat` 相对句柄创建备份、枚举和移动条目；回滚与清理沿用这些句柄。路径被替换后，操作仍留在原 inode，替换目录不会被写入。

## Alternatives considered

- 每次操作前重新 `canonicalize` 或比较 inode：检查与后续移动之间仍有竞态，不能把锁和修改绑定在同一对象上。
- 只保留路径型维护锁：无法约束激活期间的根目录换名，继续暴露同一问题。
- 在激活时整棵复制而不是相对句柄移动：会改变现有的原子移动和回滚语义，并扩大磁盘与耗时成本。

## Verification

新增目录句柄在根目录替换后仍指向原 inode 的 client-core 回归测试，以及激活期间替换 live user 根目录的 host-api 回归测试。通过 client-core 全量测试、host-api 快照测试、clippy、Rustfmt 和差异检查；再运行仓库 quick 门禁与 Android host 检查。

## Consequences

激活的读写对象与维护锁保持一致，根目录换名不会把旧数据移动到替换目录或外部路径。替换根目录本身仍需由调用方恢复有效目录布局，激活不会把 staged 内容写入该替换路径。
