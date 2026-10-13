# Agent Note: emoji/catalog 空页延后缓冲

Status: implemented

## Problem

`read_emoji_catalog_slice` 在绑定查询参数后立即按分页 `limit` 预留 `EmojiCatalogItem` 结果。搜索无匹配、分页行全部因空文本或空分组被过滤、或读取在首行失败时，空结果仍占用整页容量。

## Decision

结果向量改为空创建，首次通过现有过滤并拥有文本的行才按原 `limit` `reserve_exact`。分页游标、`complete` 计算、去重、NULL/空字段过滤和错误语义保持不变。

## Alternatives considered

- 查询前保留分页容量：命中路径更直接，但空搜索页会为不会返回的项目分配空间。
- 按每个有效行逐步扩容：可减少短页容量，但会改变既有命中页容量契约并增加扩容次数。

## Verification

新增无匹配搜索页零容量断言；`cargo test -p msime-engine local::catalog -- --nocapture`：6 项通过。随后运行 clippy、golden、fmt、diff 和 notes 校验，并在提交前运行 quick 门禁。

## Consequences

空 catalog 页不再预留结果存储；首次有效行仍一次预留完整分页上限，命中结果的容量和输出顺序保持原行为。
