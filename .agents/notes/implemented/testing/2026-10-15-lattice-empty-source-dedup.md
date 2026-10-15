# Agent Note: 无整句输出来源时跳过去重表

Status: implemented

## Problem

词网格合并在神经评分前按候选加路径总数建立HashSet。关闭字面整句且没有成功键盘排列时，合并不会选择任何行，但仍可能分配哈希桶并扫描全部已有候选。全拼/双拼允许关闭词网格而保持神经来源；单条路径不能重排，存在这条生产路径。

## Decision

候选去重表构造集中到私有助手，默认分支仍在截断之后按原边界、容量构造；神经分支先完成全部评分，确认关闭字面来源且无键盘排列时直接返回已完成的纠错结果，否则按原边界建立候选集合。保留所有模型评分与缓存状态、字面纠错源调用、候选字段/容量/顺序、来源过滤和尾部规则；不靠预先推断路径条数跳过模型。

## Historical audit

已按空来源、空去重表和延迟哈希构造检索活跃笔记，无同一决定。[空输出块延后分配](../../implemented/testing/2026-10-10-lattice-empty-block-buffers.md)只持有输出Vec；[短列表去重](../../implemented/testing/2026-10-08-lattice-merge-dedup.md)继续持有64条边界，本篇只免除不存在来源时的表；[神经字段移交](../../implemented/testing/2026-10-15-neural-lattice-row-ownership.md)保持栈选择与字段拥有；[神经借用排列](../../implemented/testing/2026-10-14-neural-lattice-borrowed-order.md)保持模型评分和成功排列契约。四篇部分重叠，不归档。

## Alternatives considered

- 单路径且关闭字面时立即返回：条件易判定，但让模型评分入口提前被跳过，不保留所有模型依次处理的契约；完整评分后判断来源更明确。
- 先检查候选是否真的有冲突再建表：可避免更多表，但重复扫描候选并改变大型列表查找成本，当前只处理必然不查询的空来源。

## Verification

冻结 `bacd58915259ecd9194b5a84ae40cdb0d0893036` 的完整合并入口，仅改名、可见性、移除注释及加入测试 lint 属性，沿用相同的行选择助手。旧生产在路径1、占位63、重复1、关闭字面、仅非键盘模型、emit0、冷状态、关闭纠错时新旧各166次申请；要求少一次的等式167对166真实失败。

改后6144组精确对照覆盖0/1/2/6/13/65条路径、0/62/63/64占位、无重复/全重复、字面开关、两种重复策略、emit0/1、无模型/仅非键盘/单键盘/混合双键盘、冷热上下文及纠错开关。逐项比较完整候选、外层容量、字面最佳、纠错结果及后续模型排列，544组恰少一次申请，其余申请次数完全一致；无来源时明确核对候选未改变且启用纠错仍返回结果。

首轮完整测试仅旧1446组借用排列预算失败：路径1、仅非键盘来源、64占位、冷状态，199对200；输出相同，其余2048项单测和31项黄金用例通过。该测试在原完整路径克隆和字段移交的独立精确预算上，仅增加原去重表存在且无来源时的一次申请，保留等式与冻结入口正文。

第二轮完整 `MSIME_NEURAL_MODEL_DIR=$PWD/target/neural-model cargo test -p msime-engine --no-fail-fast` 退出0：2049项单测通过、16项既有忽略，31项黄金用例及文档测试通过。最终Clippy全目标 `-- -D warnings`、fmt、差异检查及900篇笔记校验通过。独立审查机械核对冻结完整入口与基线一致，另跑6144组新对照及1446组旧完整合并对照通过，无阻断或其它问题。

本地 `bash scripts/verify-local.sh --quick` 退出0：契约检查、149项Windows本机可运行测试、Rust workspace、Android目标/Java宿主、WASM、macOS原生工程与共享Apple桥编译通过。Linux缺Docker、Windows交叉与pipe-only缺MinGW/交叉工程、HarmonyOS完整编译缺工具链及暂存资源、HarmonyOS设置bundle缺前端依赖而跳过；macOS桌面包缺产品bundle未参与workspace检查。未执行macOS ctest或设备/系统输入法验收。本片无生产文件读写或Android资源变化，不触发其模拟器强制门禁。

## Consequences

不存在句子来源且候选加路径数超过64时省一次哈希桶申请和候选扫描；仍然解码、纠错并按原顺序评分全部适用模型。默认分支的emit截断继续在边界计算之前。有来源时去重表在神经评分之后建立，逻辑峰值时机可能改变，不声称所有样本峰值或RSS/设备延迟降低。不能将这里的早返回挪到评分前。无公开API、依赖、unsafe、生产文件读写或Android资源变化。哈希表容量仍依照[Rust HashSet::with_capacity](https://doc.rust-lang.org/std/collections/struct.HashSet.html#method.with_capacity)。
