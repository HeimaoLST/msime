# Agent Note: 神经重排复用路径缓冲

Status: implemented

## Problem

神经模型重排先按顺序克隆整条 `SentencePath` 到临时 `Vec`，再覆盖输入切片；每次整句候选重排都会额外分配路径数组和其中的字符串、词列表副本。

## Decision

复用通用的原地排列函数，直接按 `rerank_order` 对输入路径切片做环交换，保持路径内容、稳定顺序和尾部未评分路径完全不变。

## Alternatives considered

继续构造重排后的 `Vec<SentencePath>` 会复制路径字符串和词列表；为路径单独维护索引映射会让重排后的切片仍需一次复制。复用已有排列函数只改变存储方式，不改变评分或顺序。

## Verification

新增回归测试，在旧实现上会记录临时路径数组的分配，在原地实现上重排不产生分配；同时验证候选顺序和输入容量保持不变。神经重排测试、引擎完整单元测试、Clippy、Rustfmt、差异检查和 quick 门禁覆盖实现。

## Consequences

神经重排不再为整条路径数组及其深层内容创建临时副本；路径切片本身仍由调用方拥有，模型评分和候选顺序不变。[排列循环线性遍历](../../implemented/testing/2026-10-12-order-permutation-linear-cycles.md)补充访问标记：128 行以内零分配，大非恒等排列为标记申请一次布尔缓冲，不复制路径内容。

[神经评分单位修正](../../implemented/bug-fix/2026-10-14-neural-lattice-score-units.md)独立修正混合分数的自然对数契约，沿用本篇的原地排列、稳定顺序与尾部保留规则。

[神经评分栈缓冲](2026-10-14-neural-rerank-score-buffers.md)将最多12条的评分中间存储移到栈上，并只对已评分前缀应用排列；本篇决定继续保留。

[神经合并借用排列](2026-10-14-neural-lattice-borrowed-order.md)移除每个键盘重排器的完整路径深复制，评分、去重和输出块规则继续沿用本篇约束。
