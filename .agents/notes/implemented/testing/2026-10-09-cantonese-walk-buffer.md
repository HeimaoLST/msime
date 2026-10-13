# Agent Note: 粤语分段候选直接遍历

Status: implemented

## Problem

`cantonese::syllable::walk` 在每次递归时把当前起点的完整音节和尾部前缀收集到临时 `Vec`，再按结束位置排序。候选顺序本身由输入范围决定，短输入的临时向量只承担排序前的过渡存储。

## Decision

按可读片段的结束位置倒序直接遍历；同一范围内先递归完整音节，再递归尾部前缀。这样保留最长优先、完整音节优先和回溯顺序，同时不为候选片段建立堆容器。inventory 的最大音节长度仍由运行时数据决定，没有引入固定上限。

## Alternatives considered

使用固定大小的栈数组可以保留排序写法，但需要为 inventory 选择人为上限，或在超过上限时增加复杂回退。直接遍历只依赖现有结束位置边界，代码更简单，也覆盖任意长度的 inventory。

只减少候选 `Vec` 的预留容量仍会为每次递归创建临时堆状态，不能消除短输入的分配。

## Verification

新增直接调用 `walk` 的分配预算测试；旧路径产生 1 次候选片段分配，直接遍历后为 0 次。新增完整音节与同范围尾部前缀的顺序测试；粤语模块 25 项测试、`msime-engine` 全量 1360 项单测、31 项 golden、doc tests、Clippy、Rustfmt 和 `bash scripts/verify-local.sh --quick` 覆盖接入路径。

## Consequences

递归分段的短路径不再为当前候选片段分配向量，且保持原有结果顺序和前缀语义；每个候选结束位置都会直接查询一次 inventory。
