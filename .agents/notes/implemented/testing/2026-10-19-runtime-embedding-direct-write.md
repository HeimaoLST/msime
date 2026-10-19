# Agent Note: 运行时接入 token 嵌入直接写入

Status: implemented

## Problem

默认 Runtime 九键仍超过 16ms。完整锁定资源的当前采样继续包含矩阵运算与二元评分热点，另从模型源码确认每个 token 的 embedding 临时 Vec 申请后立即复制析构。模型上游的直接写入原型通过逐位测试和完整 embedding 入口配对预算，主项目需要固定接入而不复制模型实现。

## Decision

两个 crate 清单、工作区和 fuzz 锁文件同时固定到上游 PR #77 的实际合并提交 `15caab4fdeb59c11f452b91884371cf30e2e5608`。Float 与 Quantized token 嵌入直接写入最终输入行，保持先乘 scale 再加 position、token 上界裁剪和位置饱和；没有新增缓存、常驻模型展开、unsafe 或公开接口。

## Existing decisions

已检索 embedding、token.row、嵌入、模型前向、query scratch、矩阵调度和反量化。[query scratch](../../implemented/testing/2026-10-17-runtime-query-scratch.md)和[前馈 scratch](../../implemented/testing/2026-10-16-runtime-feed-forward-scratch.md)部分重叠，分别继续持有 query 和每层前馈缓冲寿命；本片只删除进入前向前的 token 临时行。矩阵交错、临时反量化、attention scratch 与短句入口的负结果均保持，不重复实现。没有完全吸收、翻转或过时提案。

## Alternatives considered

- 在主项目复制模型的嵌入代码：可以立即改动，但会分叉模型数值和缓存契约，继续由上游持有实现。
- 只接入上游任务分支：便于提前测试，但来源会移动，最终 pin 必须使用实际合并提交。
- 继续保留临时行：代码最少，但局部完整入口的全部 16 形状已证明直接写入能覆盖开销，没有增加持有状态。

## Verification

[完整主项目记录](../../../../docs/measurements/2026-10-19-runtime-embedding-direct-write/README.md)保存全部质量报告、完整候选 dump、四轮延迟及资源/二进制哈希。[上游 PR #77](https://github.com/metasequoiaime/chinese-ime-lm/pull/77)保存实现、逐位测试和局部门槛原始记录。

上游当前工具链和 Rust 1.75.0 各通过 45 项库测试、15 项模型文件测试；真实模型 embedding 和完整前向逐位相同。完整 embedding 入口包含申请和析构，Float/i8 × 192/768 宽 × 1/4/12/64 行的 16 个形状各 21 对全部通过预设中位比 <0.95，最终中位比 0.403305–0.716282；正式通过轮 4 个每秒观察均无构建。上游完整模型旧新表不是配对实验，长形状部分变慢，不能证明完整模型收益或排除回退。

主项目全拼 60 例、九键 81 例的完整质量 JSON 和候选 dump 新旧逐字节相同，不修改质量基线。release engine 2345、golden 31、runtime 323 项通过，失败 0；engine 另有 49 项忽略。两 crate 全目标 Clippy `-D warnings`、全仓 fmt、fuzz 锁定 metadata 和 quick 通过。quick 覆盖工作区、Android/WASM、Android Java、Linux 外壳与原生宿主、macOS 原生宿主和共享 Apple bridge；缺少前置的阶段由脚本明确跳过，具体跳过项保留在 JSON。

独立复核确认四份质量报告、两份压缩候选、四轮完整输出及监测与哈希和笔记一致，无阻塞问题；复核未构建或计时。

全部本任务构建、测试和质量评测终态后，连续三次未观察到构建，再串行运行默认 Runtime 旧／新／新／旧。每轮每臂 1791 键、5 例预热、固定完整锁定资源及原 16ms 预算，二进制运行前后哈希相同。以下 p95 单位为 ms。

| 顺序 | 二进制 | engine p95 | model p95 | 超 16ms 键数 | 有构建观察 / 全部观察 |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | old | 12.90 | 27.61 | 362 / 1791 | 0 / 30 |
| 2 | new | 49.98 | 83.71 | 516 / 1791 | 6 / 54 |
| 3 | new | 36.22 | 60.93 | 523 / 1791 | 32 / 47 |
| 4 | old | 11.62 | 22.33 | 312 / 1791 | 9 / 27 |

四轮预算均失败。后三轮分别有 6/54、32/47、9/27 个观察包含外部构建；两个新版本进程的 engine 对照 p95 也升至 49.98/36.22ms，而两轮旧版为 12.90/11.62ms。此轮受干扰，不能用于判定完整 Runtime 收益或回退，也不能排除整体回退。

四轮是独立进程，没有保存跨进程逐键配对样本。每秒观察构建和 load 不能证明机器独占，不能据汇总分位数相减宣称优化的逐键收益；完整输出和监测保留，不按结果重跑挑选更快轮次。

## Consequences

每个 token 不再申请、读回和释放临时嵌入行，最终输入向量的数量、数值和寿命保持。主项目继续使用固定上游实现，不复制模型内核。局部完整入口门槛和数值等价支持接入，四轮端到端结果仅如实记录；这不是整体性能已改善的结论。

embedding 只占整体模型的一小段；九键 16ms 目标仍保持 active，后续继续定位和处理剩余热点。没有修改文件 I/O、目录遍历、权限或 Android 资源；以上是测试与构建覆盖，未把它们称为设备验收。
