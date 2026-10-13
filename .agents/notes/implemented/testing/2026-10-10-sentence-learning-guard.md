# Agent Note: 本地生成候选跳过学习行克隆

Status: implemented

## Problem

本地模式的 `Generated`、`Fallback` 和其它句子候选不会写入拼音用户词典，但 `learn_candidate` 仍先克隆完整 `WordItem`，随后才由 `learn_sentence_candidate` 因本地模式直接返回。

## Decision

在克隆句子候选前复用统一的可学习条件检查；本地模式、专用英文、不支持主词典学习的方案和原生五笔行直接返回。真正可学习的普通拼音句子仍保留原有克隆和学习流程，`learn_sentence_candidate` 继续使用同一条件作为防线。

## Alternatives considered

- **继续先克隆再拒绝**：行为简单，但本地模式每次选择生成候选都会复制不会被读取的字段。
- **让学习函数接收候选索引并持有内部借用**：会扩大可变借用范围，影响现有频率和句子学习分支。
- **只在提交路径绕过 `learn_candidate`**：会让其它直接调用学习入口的路径保留同一浪费，且分散不可学习条件。

## Verification

新增临时英文生成候选选择回归，结果保持为 `he`、组合被清空且无诊断，分配不超过 3 次。`cargo test -p msime-engine`（1341 个单元测试、31 个 golden 测试）、Clippy、格式、notes 和差异检查均通过。

## Consequences

不可学习的句子候选不再创建完整临时行；可学习的普通拼音句子和原有学习条件保持不变。

相关决定：[临时模式提交借用候选行](2026-10-10-commit-row-borrow.md)、[不学习方案提交只复制词文本](2026-10-10-nonpinyin-commit-borrow.md)。
