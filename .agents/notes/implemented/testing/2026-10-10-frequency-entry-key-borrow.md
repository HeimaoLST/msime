# Agent Note: 频率排名借用条目 key

Status: implemented

## Problem

`InputSession::adjust_candidate_frequency` 已直接借用候选排名，但仍把选中行的 `pinyin`、完整 `canonical_pinyin` 或已构造的上下文 key 复制为新的 `String`。`RankingRequest` 只借用 `entry_key`，这份复制不会被修改或转移所有权。

## Decision

按原有分支直接返回候选字段或上下文的 `&str`，把借用的 key 传给排名器；保留上下文字符串本身的构造，因为它可能由辅助码、临时英文或位置上下文生成。

## Alternatives considered

- **继续复制 key**：代码简单，但每次触发频率学习都会为排名请求多分配一个字符串。
- **把 key 放进共享引用计数存储**：会改变候选和请求的所有权模型，影响范围超过一次借用。
- **重构 `RankingRequest` 让 key 拥有所有权**：与排名器只读使用的接口不匹配，反而扩大分配责任。

## Verification

新增回归测试，确认非首位频率学习使用已有条目 key 时分配不超过 410 次；单独运行时为 408/409 次，全量测试顺序下为 410 次，旧实现的对应基线更高。目标测试、完整 `msime-engine` 测试、Clippy、格式检查、笔记校验、差异检查和 quick 门禁覆盖提交。

## Consequences

频率排名的条目 key 不再重复分配；pinyin、五笔、临时 jianpin、上下文回退和混合五笔的 key 选择规则保持不变。
