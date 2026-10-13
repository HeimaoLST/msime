# Agent Note: 音节图遍历借用临时路径读音

Status: implemented

## Problem

`enumerate_complete_segmentations` 在遍历音节图时为临时路径复制每个音节，到达完整路径后又克隆字符串作为返回结果。音节图的边已经持有静态读音，临时路径的字符串所有权没有用途。

## Decision

临时路径保存 `&'static str`，到达完整路径后才转换为输出需要的 `String`。保持深度优先遍历、边顺序、路径数量上限和 `Vec<Vec<String>>` 返回类型不变。

## Alternatives considered

让输出也借用静态读音可以进一步减少复制，但会改变全拼查询和导入规范化调用方的所有权契约，扩大这个切片；这里只调整临时遍历状态。

## Verification

合成输入 `xian` 的枚举从 10 次分配降到 7 次，两条路径仍为 `xian` 与 `xi'an`。现有顺序、截断上限和无结果测试，以及引擎全量测试、golden、Clippy、格式、笔记校验与 quick 门禁通过。

## Consequences

结果字符串和临时路径向量仍然需要分配，测试统计不包括建图。旧笔记检索只命中替代切分键去重，它处理返回结果之后的键集合，与本切片的遍历路径所有权无重叠。
