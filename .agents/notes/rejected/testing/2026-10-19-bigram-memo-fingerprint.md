# Agent Note: 二元备忘散列指纹诊断

Status: rejected — 完整访问流的键比较仅减少约0.00575%，低于预设10%门槛，保留生产恒等散列

## Problem

固定 `2cb3eb0a9f3799019d2859a5cf034d31b2f0fd45` 的二元备忘保留现有 HashMap、32768 条预算和全清策略。最近九键采样仍以 `BigramMemo::score` 为主要引擎热点。列内评分已按前词复用，不能再次删除。FNV 完整键直接作为 HashMap 散列值，尚无证据说明其桶位或七位指纹分布是否增加了完整键比较。

## Proposal

先仅采集固定公开九键 81 例、默认 Runtime 的第一个真实备忘对象的完整键访问流，包含五例预热；生产评分仍由原备忘返回。临时记录器不进入提交，受记录扰动的耗时不作性能成绩。记录完整流的数量和 SHA-256，只用该流复现同一 HashMap 容量、Entry 和全清顺序。

诊断用相同键类型在 Eq 中计数，独立比较原散列值与 `key.wrapping_mul(0x9e3779b97f4a7c15)`，不修改实际键或评分。两臂命中、未命中和清空次数必须相同，候选完整键比较数至少减少 10% 才进入性能原型。未通过即撤回临时代码，保存否决结果，不更换常量找结果。通过也仅说明候选值得计时，不意味着 CPU 更快。

## Historical audit

已检索活跃笔记中的 KeyHasher、散列器、乘法、指纹和高位分布，没有相同决定。[Entry 复用](../../implemented/testing/2026-10-17-lattice-bigram-memo-entry.md)部分相关，继续保持一次 Entry 与满容量命中不清空的语义。[直接映射](../../rejected/testing/2026-10-19-bigram-memo-direct-map.md)、[FIFO](../../rejected/testing/2026-10-19-bigram-memo-fifo.md)和[组相联](../../rejected/testing/2026-10-19-bigram-memo-set-associative.md)改变缓存组织或淘汰，本片不重试这些方案；[前词散列复用](../../rejected/testing/2026-10-15-lattice-bigram-prefix.md)改变键构造，本片保留完整 FNV。没有完全吸收或过时提案。

标准库 [HashMap](https://doc.rust-lang.org/std/collections/struct.HashMap.html) 和 [Hasher](https://doc.rust-lang.org/std/hash/trait.Hasher.html)说明自定义散列与相等键保持一致的契约；本机 hashbrown 0.16.1 的 `src/control/tag.rs` 提供高七位指纹的实现参考。本次只针对固定工具链的诊断，不推及其他架构或标准库版本。

## Alternatives considered

- 保留恒等散列：没有乘法开销，也没有新的常量和平台假设；除非比较次数与完整访问预算都证明候选收益，继续保留它。
- 使用 SipHash 或新增散列依赖：可以充分混合位，但增加多轮运算或依赖，不适合先验证一次乘法的窄假设。
- 再次替换缓存淘汰：可能减少真实查表，但已有负结果且改变缓存内容，本片保持逐键缓存状态。

## Acceptance criteria

完整流只来自仓库公开合成评测，禁止记录私人输入。采集后逐字恢复生产文件，验证 diff。原/候选比较次数全部保留；同样的命中、未命中和清空计数，候选比较至少减少 10% 才继续。否则只交付否决笔记及可审计诊断源码和结果，跑 notes、diff 和 quick 后独立 PR 合并；九键 16ms 目标保持未达。

## Risks

访问流反映固定集合，不能代表所有输入；Eq 计数改变调用成本，不能计时。指纹比较减少也可能被每次乘法抵消。若进入原型须事先固定完整访问和控制负载预算，并验证缓存、评分位模式、质量和端到端结果；诊断不得直接成为生产接入依据。

## Diagnostic outcome

完整记录首个真实备忘对象的110796740个键，轨迹886373920字节，SHA-256为`8418ce8a4f555dfe06631113c0a648e36abae74d283b9067e6050245dcb53258`。两臂均命中94315035、未命中16481705、全清502次，与既有同集合诊断一致；最高HashMap容量均57344，完整键对应的合成分值摘要相同。合成分值只用于检测缓存映射，不作为真实n元评分等价证明。

恒等散列完整键比较94740603次，其中不相等的指纹假匹配425568次；乘法候选分别94735156和420121次。完整比较仅减少5447次（约0.005749%），远低于预定10%。旧臂比较中真实命中占99.55%，不能把减少约1.28%的假匹配误写成完整查询提速。Eq计数不覆盖控制组探测或完整评分耗时，不据此否定其他查表优化，也不从比较数推断CPU收益。

[原始计数、身份与哈希](../../../../docs/measurements/2026-10-19-bigram-memo-fingerprint/results.json)、[独立诊断源码](../../../../docs/measurements/2026-10-19-bigram-memo-fingerprint/diagnostic.rs.txt)及[临时记录器差异](../../../../docs/measurements/2026-10-19-bigram-memo-fingerprint/recorder.diff.txt)全部保留。轨迹只来自公开合成集合，临时文件交付后删除。首个笔记写入因目录不存在而失败，在任何源码改动前误启动的构建已明确中止（143）；补齐笔记和记录器后重新构建退出0，实际采集来自该次二进制。

诊断采集程序按81例、每臂1791键、5例预热完成，退出1明确因为16ms预算超限；带记录器的耗时不作为基线或性能结果。采集后生产`decode.rs`逐字恢复固定基线，乘法未接入生产，后续CPU原型、质量对照、ABBA和设备验证均未运行。九键16ms目标仍未达到。

## Verification

独立复核已核对轨迹大小及 SHA-256、两份诊断源码身份、缓存布局、Entry 与清空顺序、首对象记录范围、原始计数和比例，以及生产文件相对固定基线无差异，无阻塞发现；复核只读，没有构建或计时。

`CI=true pnpm run verify-notes`、`git diff --cached --check` 和本地 `scripts/verify-local.sh --quick` 均退出 0。quick 覆盖仓库契约、1418 篇活跃笔记与 4 篇归档封印、Rust workspace 检查和共享 Apple bridge 构建；缺少原生 bundle 的 `msime-desktop` 跳过，actionlint 与各平台阶段按文档改动范围跳过。没有将这些检查称为完整功能、设备或性能验收。
