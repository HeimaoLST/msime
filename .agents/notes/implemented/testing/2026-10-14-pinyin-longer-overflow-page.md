# Agent Note: 拼音长词续接只读取一次溢出表

Status: implemented

## Problem

`quanpin_table` 把超过七音节的键统一映射到 `tbl_others_<initial>`，`query_longer_phrases` 却按每个追加音节数查询。七音节输入和 `extra_syllables=3` 会重复读取相同 SQL 页三次，随后复制、聚合和按值去重；空页也重复创建表名和 SQL。满页预留把重复页面算进后续容量，过大追加音节数还会导致无意义遍历或容量溢出。

## Decision

从共享的 `MAXIMUM_NUMBERED_SYLLABLES` 推出不同页面数：剩余编号表数加一个溢出桶，再与调用方的 `extra_syllables` 取最小值。只遍历这些页面，保留编号表到溢出表的原顺序，按实际不同页面数计算后续预留。首个满页接管、短页按实际行数扩容、每表 SQL 限额、前缀、完整音节检查、首次词值去重、稳定排序和最终截断保持原规则。溢出页仍包含所有匹配长度，不额外筛掉超过追加音节数的词条。

## Existing decisions

检索 `query_longer_phrases`、`tbl_others`、溢出表和长词续接，没有同一页面去重决定。[按页预留](../../implemented/testing/2026-10-10-pinyin-longer-rows-reserve.md)与[首个满页复用](../../implemented/testing/2026-10-11-pinyin-longer-first-page.md)持有容量和首个页面接管，本篇保留其策略，只把页面计数收窄为真实不同表；按页预留篇就地补上后续链接。[精确聚合页复用](../../implemented/testing/2026-10-10-pinyin-aggregate-page-reuse.md)的表规划属于另一入口，保持不变。其他词网格/模糊/行投影笔记无关。

## Alternatives considered

- 继续重复查询后去重：实现最短，能保留原输出，但 SQLite 读取、行字符串、临时页和去重成本都重复。
- 用哈希集合记已查表名：对任意命名映射都适用，但当前合同只有连续编号表和一个共享溢出桶，集合增加每次查询的存储和哈希成本。
- 到溢出表后直接 `break`：能减少 SQL 页，但若容量预算仍用原始 `extra_syllables`，密集页继续按不存在的页面预留；提前算不同页数同时约束循环和预算。
- 给溢出 SQL 加音节数条件：可以按调用方追加数精确过滤，但会改变现有溢出桶候选集及排序，是独立行为决定，不用于这次重复读取优化。

## Verification

固定 `e35a30f5cf5a38557f5790321916a5e16c64c927` 的完整旧查询，只改方法名和移除注释。真实 SQLite 内存库包含三至十音节、Unicode 词面、同权、负/宽权重与跨表同值。输出对照覆盖输入两至九音节、追加 0/1/2/3/8、限额 0/1/2/8/32/100/`usize::MAX`，逐字段与顺序相同，返回容量不增加。显式检查七音节表的首次同值优先于溢出页高权行；进入溢出桶一次仍能返回超过追加音节数的词条，保持原规则。

五项新测试在旧生产上三项真实失败：空溢出页追加数 1 的申请为 5 次，追加数 3 为 11 次；12 行满页的聚合容量为 36；六音节输入、追加数 `usize::MAX`、limit1 触发 `capacity overflow`。改后五项均通过。完整编号表路径的空页、短页、密集页、有限/无界上限申请次数与旧实现相等。

预热真实 SQLite 查询，固定七音节输入和追加数 3，线程本地计数器度量 Rust 逻辑请求字节。两侧最小净值均为 0，字段与顺序相同：

| 每页限额 / 返回行数 | 申请次数（旧→新） | 峰值字节（旧→新） | 返回存储字节（旧→新） | 容量（旧→新） |
| --- | --- | --- | --- | --- |
| 12 / 12 | 87→30 | 4,158→1,272 | 2,451→1,107 | 36→12 |
| 100 / 96 | 602→201 | 37,592→14,582 | 19,683→8,931 | 288→96 |
| `usize::MAX` / 96 | 617→206 | 37,592→16,150 | 19,683→8,931 | 288→96 |

- `cargo test -p msime-engine --locked`：1,992 项单测通过、15 项忽略；31 项 golden 通过，文档测试 0 项。
- `cargo clippy -p msime-engine --locked --all-targets -- -D warnings`：通过。
- `cargo fmt --all -- --check`、`git diff --check`、`pnpm run verify-notes`：通过，851 篇活跃笔记与 2 篇归档封印完成校验。
- 独立只读复核无阻断或重要问题，另行运行五项新增测试通过，核对页数边界、SQL 限额、首次值去重、稳定排序、溢出长度与测量归因。

- `CARGO_BUILD_JOBS=6 bash scripts/verify-local.sh --quick`：退出 0。Windows 本机可执行 149 项通过（2 项主机差异排除、64 项需 Windows 构建、1 项非测试），仓库契约/actionlint、Rust workspace、Android/wasm 目标、Android Java、macOS 原生配置/编译与 shared Apple bridge 编译通过。macOS workspace 的桌面包因原生资源 bundle 未预生成跳过；Harmony 设置页因依赖尚未安装跳过，真 ArkTS 构建缺少 hvigor/资源/依赖；Linux 外壳与原生宿主缺 Docker；Windows 本机/交叉编译和 pipe-only 缺对应工具链。未做设备或真实输入法链路验收。

## Consequences

重复溢出页不再创建表名/SQL、读取和复制行、占用聚合容量、参加去重与排序；空页同样少做重复工作。编号表路径继续保留原分配预算，不引入集合、依赖或公开 API。尚未量化发布构建的完整输入路径 CPU 时间，最终拥有型结果仍需分配。

减少了同一表重复观察数据库的次数；每张不同表仍单次读取，不新增快照或跨表事务保证。收益属于查库页规划和聚合，Rust 请求字节不含 SQLite C 堆、RSS，也不能替代真实宿主输入延迟。
