# Agent Note: 九键表情边界只检查音节完整性

Status: implemented

## Problem

`NineKeySession::expressive_candidates` 把 `splits_into_syllables_at` 作为 emoji、颜文字和符号查询的接受条件。校验只消费能否切成完整音节的布尔结果，却为每个合法片段调用 `cut_one_piece_min_segments`，建立音节字符串和结果向量。已锁定音节与手动分词会让一次编码校验包含多个片段。

## Decision

复用 `is_complete_pinyin_input` 的同一套最少音节 DP，只检查路径是否存在。每个片段仍由 `str::get` 检查边界，空片段继续接受；先拒绝片段中的撇号，因为旧单片切分不接受撇号，而公开完整性接口接受撇号分段。不改变调用方、分组、查询和候选物化。

## Existing decisions

已在活跃 proposed、implemented、rejected 笔记中检索 `splits_into_syllables_at`、表情边界、完整性、`is_complete_pinyin_input` 和最短切分。[最短切分 DP 栈缓冲](../../implemented/testing/2026-10-09-pinyin-min-cut-buffer.md)与本片部分重叠，持有共享算法和 64 字节回退规则，本片把已有布尔入口接入九键接受条件。[普通边界借用](../../implemented/testing/2026-10-17-nine-key-expressive-boundary-borrow.md)、[双拼边界直接扫描](../../implemented/testing/2026-10-17-nine-key-shuangpin-boundary-scan.md)和[延后边界物化](../../implemented/testing/2026-10-17-nine-key-expressive-boundary-materialization.md)处理边界向量的生成和所有权，与本次音节结果物化无关，继续保留。表情和符号候选功能笔记继续持有候选顺序、锚定与筛选规则；不改变它们。

## Alternatives considered

- **继续生成完整切分**：直接沿用旧接口，语义最直观；但校验丢弃全部音节结果，重复支付这些分配。
- **新增单片完整性公开接口**：可以省去撇号保护并直接复用 DP；但现有完整性接口加显式保护即可保持旧契约，无需扩大模块接口。
- **另写布尔 DP**：只需维护可达性，可能减少计算；但会建立第二套音节合法性和字节边界规则，本次复用已有算法。

## Verification

旧实现上的零分配回归按预期失败：`nihao` 校验产生 3 次分配，目标为 0。优化后 `nihao`、带 3 字节边界的 `meiguo`、带两个边界的 `xiangjiao` 分别从 3、4、6 次分配降为 0；64 字节重复音节从 33 次降为 0，66 字节从 35 次降为 1，保留长片段 DP 回退。实际 `zhengfu` 符号查询从 10 次降为 6 次，完整 `SymbolRow` 逐字段相同。

冻结旧函数矩阵覆盖全部合法音节及七类后缀，以及空串、撇号、大小写、多字节、64/66/67 字节输入；边界覆盖零、末尾、重复、逆序、超界、`usize::MAX` 和逐字节位置。专项 15 项、完整引擎 2301 项（40 项既有忽略）、golden 31 项与 runtime 320 项通过。两 crate 全目标 Clippy `-D warnings`、Rustfmt、差异检查、笔记校验通过。独立只读复核未发现问题。

`CARGO_BUILD_JOBS=4 MSIME_BUILD_JOBS=4 bash scripts/verify-local.sh --quick` 退出 0，覆盖仓库契约、Rust workspace、Android/WASM、Android Java、macOS 原生宿主和共享 Apple bridge；Windows 本机测试 157 项通过，2 项按宿主差异排除。Linux Docker、完整 Windows 交叉、HarmonyOS 真工程及 pipe-only 缺少前置条件而跳过，未声明设备或系统输入法框架验收。

## Consequences

短合法片段不再为校验结果创建音节字符串和结果向量，仍执行同一套最少音节 DP。超过 64 字节的片段保留一次 DP 堆表分配，没有输入长度限制，也不增加会话缓存。显式撇号保护保留旧单片编码契约；空片段和非法字节边界继续由原有循环与 `str::get` 处理。局部分配减少不能证明设备端到端延迟预算达标。
