# Agent Note: 超级简拼空页延后结果缓冲

Status: implemented

## Problem

`crates/engine/src/local/jianpin.rs` 的 `read` 在执行数据库查询前按调用方 `limit` 预留候选行，即使合法的简拼在现有表中没有匹配行，或 SQLite 在第一步就失败，也会分配整页结果缓冲。正常命中仍需要相同的结果容量。

## Decision

把候选 `Vec` 改为首次通过完整键过滤后才按原 `limit` `reserve_exact`。空页和查询错误保持零容量，非空页继续保留原容量和行顺序；双拼的扫描上限和过滤规则不变。

## Verification

先新增空页容量回归测试并确认旧实现失败（实际容量 50、期望 0），再实现延后预留；`cargo test -p msime-engine local::jianpin -- --nocapture`：6 项通过。全拼命中测试断言返回容量仍为调用方 `limit`。

## Alternatives considered

- 保留查询前预留：命中路径少一次容量检查，但空页和首步错误会为不会返回的行分配内存。
- 按扫描上限预留：双拼过滤扫描上限可远高于返回上限，会扩大空页浪费。

## Consequences

空页不再保留候选行存储；首次有效行仍一次预留完整返回上限，因此命中结果的字段、顺序和容量契约不变。`limit` 仍由既有调用方限制，SQL 扫描范围和错误处理没有变化。
