# Agent Note: 九键前页去重索引避免复制词面

Status: implemented

## Problem

`NineKeySession::refresh` 为过滤路径记录每个已接纳词的最佳排序键。旧实现用 `HashMap<String, RankKey>`，每个唯一词都复制一份 `String`；九键长输入会反复经过同一批前页候选，词面复制和哈希表节点成为刷新热路径上的额外存储。

## Decision

将索引改为基于固定 FNV-1a 哈希的 `LeadingMap`。哈希表键只保存 `u64`，值保存候选向量中的索引和排序键；查询命中后回到候选向量比较真实词面，再决定是否过滤。哈希碰撞用 `LeadingSlot::Many` 保存同一哈希下的多个候选索引，并逐个比较词面，因此哈希只用于定位，不承担正确性。最佳排序键变小时，追加新候选并更新槽位索引；排序键不变或更差时直接跳过。

生产路径、冻结参考路径和投影测试都使用相同的过滤边界。候选排序、覆盖长度、简拼交错、同词最终稳定去重以及公开结果字段保持不变。

## Historical audit

已检索 `proposed`、`implemented`、`rejected` 的 `leading`、`前页` 和 `push_ranked`。以下为部分重叠，其余命中属于路径链或最终排名：

- [排序表延迟预留](2026-10-10-nine-key-leading-map-storage.md)继续持有空表零申请和首次 `reserve(CANDIDATE_LIMIT)` 的决定，本片只改变表内键和值。
- [复制前支配过滤](2026-10-16-nine-key-dominated-row-projection.md)继续持有仅热页提前拒绝及同页不更新表的边界，本片从候选索引恢复同词查询。
- [领先表复用排名键与获胜行的否决](../../rejected/testing/2026-10-17-nine-key-ranked-leaders.md)尝试用领先表替换最终排名，126 形状中 10 个目标失败。本片保持原最终排名，仅减少表内词面所有权，不翻转该否决。

## Alternatives considered

- **继续使用 `HashMap<String, RankKey>`**：实现最简单，但每个唯一词都要拥有一份重复词面，且热路径申请数随词数增长。
- **只保存哈希和排序键、不核对词面**：能进一步减少存储，但哈希碰撞会把不同词错误地视为同词，不能接受。
- **全量线性扫描候选**：无需索引，但前页候选增长后查询会变成平方级；保留哈希定位并只在碰撞槽内比较词面。
- **使用通用哈希器**：可以复用标准构造，但索引只在一次刷新内存活，固定 FNV 使键计算和哈希表构造都不需要额外随机状态。

## Verification

合成 256 个唯一词的 `push_ranked` 申请次数从旧实现的 777 次降到 521 次。碰撞槽测试确认不同词和未命中词都能正确区分；随机排序对照、空结果、过滤投影和音节数量测试通过。

普通分配器下对 126 种形状做完整旧/新配对预算，所有形状通过：无最终过滤且长度至少 64 的形状比值低于 0.98，其余形状低于 1.05；36 个目标形状中位比为 0.761644–0.964269，90 个控制形状为 0.356303–0.994146；原始 [2646 对计时](../../../../docs/measurements/2026-10-19-nine-key-leading-index.csv)随代码保存（每形状 21 对，交替先后；三网格与两种最终过滤状态）。九键 81 例、两臂各 1791 键的旧/新各一次的延迟观察（并非完整 ABBA，未记录完整并发监测）中，修改版引擎端均值 6.75ms、p95 22.24ms，带模型均值 12.18ms、p95 46.58ms；对照版带模型 p95 为 55.58ms。该次命令将退出预算设为 1000ms，不能用它替代原 16ms 验收；两臂均未达到 16ms 目标。缺少完整 ABBA 与并发监测，不据此宣称整体无回退或稳定提速。

已运行：九键相关测试 241 passed、11 ignored；`cargo test --locked -p msime-engine -p msime-input-runtime --no-fail-fast --quiet`（引擎 2332 passed、45 ignored；golden 31 项、运行时 320 项均通过）；两 crate 全 targets Clippy、Rustfmt、笔记与差异检查、`bash scripts/verify-local.sh --quick` 通过；Linux 原生宿主 90 项 ctest、Android target/JNI/Java、WASM、macOS 与共享 Apple bridge 编译通过。Windows MinGW、HarmonyOS 真工程和 pipe-only 按环境跳过。改动不涉及文件读写、目录遍历、权限或 Android 资源，因此不需要设备验收。

## Consequences

刷新索引不再为每个唯一词复制词面，过滤路径可从候选向量恢复真实词面并保留碰撞安全性。索引槽位持有候选向量索引，因此候选被替换时必须同步更新槽位；该关系只在一次刷新内成立，不跨刷新或资源生命周期保存。九键端到端模型延迟仍高于历史 16ms 目标，后续优化不能把本片的局部收益当作整体目标已达成。

单次 `entry` 槽位查询的[后续实验](../../rejected/testing/2026-10-19-nine-key-leading-entry.md)未通过固定性能门槛；生产继续使用本篇的分开查找与更新路径。
