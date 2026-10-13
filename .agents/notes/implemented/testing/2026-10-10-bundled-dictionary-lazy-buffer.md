# Agent Note: 个人词典空页延后缓冲

Status: implemented

## Problem

`dictionary_table_entries` 为个人词典分页读取在 SQL 游标开始前按 `limit` 预留 `DictionaryTablePage.entries`。当查询代码对应的表存在但没有匹配行时，空页仍占用整页结果容量。

## Decision

结果向量改为空创建，首次成功读取并通过现有字段转换的行才按原 `limit` `reserve_exact`。分页上限、`has_more`、排序、journal 合并和错误语义保持不变。

## Alternatives considered

- 查询前保留分页容量：命中路径少一次容量判断，但空页会为不会返回的词条分配空间。
- 逐行扩容：减少短页容量但改变已有命中容量契约并引入更多扩容次数。

## Verification

新增 `nx` 空页容量回归测试；先在旧实现上运行，断言从实际容量 100 与期望 0 的差异确认测试有效，再恢复实现。相关测试通过，随后运行 clippy、golden、fmt、diff、notes 和 quick 门禁。

## Consequences

个人词典空页不再预留结果存储；首次有效行仍一次预留完整分页上限，命中页的容量和输出行为保持原样。
