# Agent Note: 快速短语空页延后缓冲

Status: implemented

## Problem

`crates/engine/src/local/quick_phrase.rs` 的 SQLite 快速短语查询在执行前按 `limit` 预留候选行。不存在匹配前缀、所有行因 NULL 被跳过或查询步进失败时，结果为空却仍付出整页容量分配。

## Decision

候选 `Vec` 改为空创建，首次通过 NULL 过滤后按原 `limit` `reserve_exact`。命中结果继续使用原容量；空页和数据库错误维持空结果或固定诊断，不改变 SQL 上限、排序和行字段。

## Alternatives considered

- 保留查询前预留：命中路径少一次容量判断，但空前缀页会为不会返回的结果分配空间。
- 按实际 SQLite 行数增长：可减少命中短页的容量，但会改变已有结果容量契约并引入多次扩容。

## Verification

新增命中容量与空前缀零容量断言；`cargo test -p msime-engine local::quick_phrase -- --nocapture`：7 项通过。随后运行 clippy、golden、fmt、diff 和 notes 校验，并在提交前运行 quick 门禁。

## Consequences

空快速短语页不再保留候选结果存储；首次有效行仍一次预留完整返回上限，因此现有命中结果的容量和顺序不变。读取错误路径不增加额外分配。
