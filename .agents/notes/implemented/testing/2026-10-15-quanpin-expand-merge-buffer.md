# Agent Note: 全拼首字母展开复用候选合并缓冲

Status: implemented

## Problem

首字母候选从 24 行扩展到完整列表时，`QuanpinDictionary::expand_initial_candidates` 为合并结果另建 `Vec<WordItem>`。会话反复分页时已有候选向量通常具备可复用容量，但这次外层存储仍被丢弃。

## Decision

在已有候选向量中移除受限首字母行，保留其它来源的相对位置，再在首个受限行位置插入完整展开行。只为最终增加的行使用 `reserve_exact`，让预热后的候选容量直接承接扩展；候选字段、顺序、缓存所有权和容量语义保持不变。

## Related notes audit

- [全拼词典行投影](../../implemented/testing/2026-10-14-quanpin-row-cache-projection.md)：部分重叠，约束展开行字段的拥有方式；本篇只处理会话结果向量。
- [候选行缓冲复用](../../implemented/testing/2026-10-08-session-candidate-buffer-reuse.md)：相关但归属会话刷新；本篇优化词典公开扩展入口自身的结果缓冲。
- [首字母展开解析投影](../../implemented/testing/2026-10-14-quanpin-resolution-cache-projection.md)：相关但只减少解析缓存复制，不改变合并容器。

## Alternatives considered

- **继续新建合并向量**：实现最直接且冷路径容量精确，但预热会话仍反复申请外层存储。
- **使用 `retain` 后直接追加到末尾**：可复用容量，但会改变首字母行在混合来源中的插入位置。
- **整体改变候选缓存所有权**：可避免行复制，但会越过词典与会话的所有权边界，影响缓存独立性。

## Verification

新增预留候选容量的回归在旧实现上先失败，优化后确认预热扩展少一次外层申请；原有 25/32/128 行分配投影、混合来源顺序、容量和缓存所有权测试继续通过。

## Consequences

预热会话少一次候选外层存储申请，混合来源行仍保持原位置；冷路径可能按最终长度精确扩容一次。原地移除依赖首个受限行位置在删除后仍有效；`retain` 必须只作用于扩展前的候选，不能误删新行。`reserve_exact` 只承诺当前向量容量，不改变词典缓存中的独立候选所有权。
