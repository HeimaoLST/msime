# Agent Note: 词网格首次查询结果转移到图边

Status: implemented

## Problem

`build_graph` 将每个唯一跨度的完整查询结果存到临时缓存，再复制词面和读音到图边；没有重复的跨度也为两份字符串分配。重复跨度只需要已经生成的图边字段，超出上限和空词面行不参与图。

## Decision

跨度缓存改为首个图边区间的位置和原预留提示。首次查询消耗拥有行，将非空词面和显式读音移交图边；空读音继续按跨度生成。重复跨度从之前列的区间复制图边字段并替换终点，不重查字典。借用跨度键、查询顺序/次数、原行上限先截断后过滤、边顺序、评分、图外层和每列容量保持。索引只在当前建图内部有效，不增加公开API、unsafe或依赖。

## Historical audit

按 `build_graph`、`span_cache`、图边与所有权检索活跃笔记，无同一建图缓存决定。[跨度缓存借用查询键](../../implemented/testing/2026-10-10-pinyin-lattice-span-key-borrow.md)保留字典跨调用拥有缓存；[跨度直接规划键](../../implemented/testing/2026-10-10-pinyin-lattice-span-key-plan.md)保留SQL与规范化职责；[默认整句字段所有权](../../implemented/testing/2026-10-14-generated-lattice-row-ownership.md)处于解码之后，三者不改变本片内部建图缓存。

## Alternatives considered

- 预先统计各跨度使用次数，到最后一次时移走缓存行：能保留原查询行缓存，但增加一轮全跨度哈希/计数与中间状态，首次图边仍复制。
- 图边持有共享字符串：重复跨度可以共用内容，但扩大图边字段类型和后续解码契约，引入引用计数；当前图边已有拥有字段可直接使用。

## Verification

冻结 `103ff01badf5e18d169bf3a65a41f82632af8850` 的完整旧 `build_graph`，只改函数名、可见性和移除注释。旧生产上两条测试真实失败：单个空音节首行实际11次分配而少一次预算需要10次，首次字段指针及128/96预留容量也被克隆改变。生产改后两项通过。

640组矩阵包含空列表、单个空音节、单音节、唯一、多次重复、交替重复、内部空音节与Unicode跨度，最大词长0/1/3/9，限额0/1/2/5/无界，四类结果含空页、空词面、显式/空读音和负/零/普通/最大整型权重。逐边核对内容、终点、评分位级值与typo标志，核对图外层与每列容量、查询顺序/次数及每个跨度只查一次，并对照完整普通和纠错解码。收益在区间外按实际保留的唯一跨度有效行字段独立计算；重复跨度若原需非空隐式读音，额外少一次临时拼接。字段转移侧表使用带128/96预留容量的行，验证首次边保留原指针/容量，重复边有独立所有权且终点改变；该三音节样本严格13次分配。

冷计量在区间内创建图、查询结果、记录查询次序的列表和临时缓存，区间外仅借用合成输入；两侧最低signed字节差均为0。`a'ba'ca`、最大词长3、限额5的合成样本如下；返回字节包含图与查询记录，不是图独占字段容量或RSS。

| 查询行 | 分配次数：旧→新 | Rust逻辑请求峰值：旧→新 | 返回存储：旧→新 |
| --- | --- | --- | --- |
| 四行显式读音 | 134→86 | 5369→3869 | 2981→3245 |
| 混合读音及空词面 | 110→86 | 5062→3694 | 2870→3068 |
| 隐式读音及空词面 | 98→80 | 5020→3694 | 2870→3068 |
| 空页 | 20→20 | 857→921 | 521→521 |

完整 `MSIME_NEURAL_MODEL_DIR=$PWD/target/neural-model cargo test -p msime-engine` 退出0：2046项单测通过、16项既有忽略，31项黄金用例及文档测试通过。模型资源按锁文件准备。Clippy首轮只指出测试的 `len() > 0` 写法，改为 `!is_empty()` 后 `cargo clippy -p msime-engine --all-targets --locked -- -D warnings` 退出0，专项重跑仍通过。`cargo fmt --all --check`、`git diff --check` 与 `pnpm run verify-notes` 通过。独立审查机械核对冻结正文匹配基线，另跑两项专项与640矩阵通过，无阻断。

本地 `bash scripts/verify-local.sh --quick` 退出0：Rust workspace、Android目标/Java宿主、WASM、macOS原生宿主及共享Apple桥通过。本机可运行的149项Windows测试及HarmonyOS设置页bundle通过。HarmonyOS完整ArkTS构建、Linux宿主和Windows原生/pipe-only编译因本地环境缺失跳过，不算设备验收。

## Consequences

重复跨度只指向更早的列，同一列不同终点跨度长度不同，不可能为同一键；图只追加不删除，索引不随Vec扩容失效。首次显式字段转移减少复制，重复隐式读音复用已生成键，字典调用次数保持。原始字符串容量可能超过旧克隆容量，合成返回存储因此上升；缓存值由Vec头变为四个usize，空页样本峰值增加64字节。不声称全部样本总堆占用、RSS或设备延迟降低。无生产文件读写或Android资源改动，不触发对应设备强制门禁。依照[Rust slice安全拆分](https://doc.rust-lang.org/std/primitive.slice.html#method.split_at_mut)及[拥有迭代器](https://doc.rust-lang.org/std/vec/struct.IntoIter.html)操作。
