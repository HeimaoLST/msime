# Agent Note: 候选变换排列工作区复用

Status: implemented

## Problem

桌面 `Runtime::arrange_candidates` 在每次插件候选变换重放时都会新建隐藏标记、可用座位排序、最终排列和隐藏尾部四个 `Vec`。方向键、翻页和旁路刷新只重放已经记录的操作，候选数量与插件操作没有变化时，这些短命容器的容量可以跨刷新保留。

本决定只处理候选变换的排列工作区；[候选排列只遍历每条循环一次](2026-10-12-order-permutation-linear-cycles.md)负责 `apply_order` 的循环复杂度和访问标记，[候选变换架构](../architecture/2026-10-12-script-plugins-modify-commit-and-candidates.md)继续负责插件身份、运行时机和所有权边界。

## Decision

`PluginState` 持有 `ArrangementBuffers`，其中的四个工作区在 `arrange_candidates` 开头用 `mem::take` 暂时取出，清空并按当前候选数复用；排列构造完成后，无论恒等排列、非法排列保护返回还是实际交换路径，都把工作区放回 `PluginState`。实际候选字段仍由 `apply_candidate_order` 按原排列交换，`occurrences` 仍按已有规则更新。

工作区只保存座位下标和布尔标记，不保存候选文本或插件输出；插件操作、锁定行、隐藏尾部排序、恒等排列短路和候选身份比较规则保持不变。

## Alternatives considered

- **继续每次创建四个局部 `Vec`**：实现最简单，但每次重放都重复申请与候选数成正比的工作区；方向键和旁路刷新无法受益于上一轮容量。
- **把工作区改成固定栈数组**：小列表可以零分配，但候选数没有统一的小上限，超过数组容量仍需额外分支或复制；持久 `Vec` 能覆盖大小变化并沿用标准增长策略。
- **复用候选字段本身作为排列工作区**：能减少字段数量，但会在排列尚未验证完整前改写可见候选，并越过 `apply_candidate_order` 对平行字段和静态证据的同步边界。

## Verification

新增 `repeated_plugin_replays_reuse_arrangement_buffers`，先让真实候选变换运行一次预热，再连续重放同一组 128 行的重排和隐藏操作。旧实现两次各 18 次分配；复用工作区后两次各 9 次，测试固定断言该预算并保留候选注释路径。还原旧实现时测试按预期失败；恢复后通过。

## Consequences

连续候选变换重放不再为四个排列容器重复申请内存，首次遇到更大候选列表时仍按需增长。runtime 会保留最近一次排列工作区的容量，增加的内存只包含座位下标、排序键和布尔标记；候选文本、插件身份和并行候选字段的生命周期不变。本片没有改变 `apply_order` 的复杂度、插件调用时机或公开 API。
