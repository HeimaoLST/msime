# Agent Note: 离线释义未命中不构造 JSON 行

Status: implemented

## Problem

`msime_client_candidate_gloss_request` 在未命中时也执行 `then_some(json!(…))` 的参数构造，JSON 对象随后丢弃；输出 `Vec<Value>` 还按完整候选数预留。法语词典未安装的合成真实 C ABI 调用，4,096 行为 86,052 次申请、4,135,208 请求字节，回复仍只有空释义数组。

## Decision

非空释义才调用 JSON 构造，并按最终非空释义数预留输出。保留全部请求/响应上限校验、来源过滤、繁体重查、顺序、代次和回复格式。复用现有生命周期集成测试的线程局部分配器到 `tests/support/allocations.rs`，增加请求字节计数，生产库不带计数器。

## Existing decisions

检索 `candidate_gloss_request`、离线释义、繁体重查及分配计数：[生命周期核心](../../implemented/architecture/2026-10-11-desktop-lifecycle-core.md)的零分配测试只与计数器复用部分重叠，原有按键与音效决定不变；[移动端来源过滤](../../implemented/bug-fix/2026-10-14-mobile-candidate-gloss-source-filter.md)和[Windows 离线释义](../../implemented/feature/2026-10-10-windows-gloss-columns-and-account-glosses.md)持有宿主规则，与本篇输出存储不同。没有同一机制的活跃笔记，不吸收或归档。

## Alternatives considered

- 只把 `then_some` 改为惰性 `then`，最小改动即可省掉未命中的 JSON；但空回复仍保留完整输出向量，4,096 行为 131,072 字节申请。
- 输出从空向量逐条增长，不需要提前扫描释义；但全命中请求会重复扩容和搬移 `Value`。按非空条数预留只增加一次元数据扫描，命中列表仍一次预留。

## Verification

真实 C ABI 分配预算在固定基线 `24c64a68ef80376494934d221b39f04422f2f2b1` 失败、当前实现通过。缺失法语词典的 1/8/32/1,024/4,096 行合成请求，均回复 `{generation:7,translations:[]}`；计数窗口包括完整 C ABI，输入 JSON 构造和回复解析/释放在窗口之外。预热后空请求为 20 次、2,472 字节；单独计数同文的 `traditional_to_simplified_characters` 排除转换成本（14 字节 ASCII 每行 16 次、142 请求字节）。余下预算允许每行输入字符串、容器扩容及固定余量，并以每行 192 字节加 8,192 固定字节约束缓冲；输入解析、转换和公共回复并未变成零分配。

| 行数 | 原申请次数 | 当前申请次数 | 原请求字节 | 当前请求字节 |
| --- | ---: | ---: | ---: | ---: |
| 1 | 47 | 42 | 3,545 | 2,852 |
| 8 | 195 | 162 | 10,416 | 4,872 |
| 32 | 701 | 572 | 34,632 | 12,456 |
| 1,024 | 21,538 | 17,441 | 1,035,560 | 325,928 |
| 4,096 | 86,052 | 69,667 | 4,135,208 | 1,296,680 |

字节是 64 位宿主累计申请请求，不是 RSS、峰值或设备内存。共享计数器继续只记录当前线程，增加字节累计不改变原生命周期测试的申请次数窗口，生产库不带它。

机械提取固定基线与当前的 JSON 回复构造段，使用同一已编译 `serde_json`，以 `rustc -O` 在同一程序做九轮交替配对；0/8/32/1,024/4,096 行、零/一/四分之一/全部命中去重后共 17 组，逐组核对完整 `Value` 相等。候选和释义批次克隆不计时，计时包括 JSON 构造及输入/输出回收，排除输入解析、查询、繁体重查、文件访问、C ABI 包装和字符串序列化。每轮迭代 `clamp(65_536 / max(行数, 32), 16, 512)` 次（整数除法）。4,096 行零命中的各轮平均单次耗时中位数为 456,945→45,875 ns，配对旧/新中位比 10.007；四分之一命中为 650,302→340,198 ns。全命中配对中位比约 0.991–1.012，提前计数的扫描仍有代价；这些结果不代表完整输入或设备延迟，也不设置机器间计时门禁。

完整 Host API 首轮 622 项通过、2 项忽略，唯一失败是 `host_capability_boundary_describes_each_platform` 仍把 Linux 的 `candidate_window_scale` 断言为 false。固定基线单独运行也在同一行失败；已有字号缩放提交 `51732e26e` 的能力位和 client-core 测试均为 true，因此顺带更新过时的边界断言和注释，不改平台能力行为。修正后 `cargo test -p msime-host-api --locked` 全部通过：623 项单元测试、13 项集成测试和文档测试，2 项原有忽略用例。`cargo clippy -p msime-host-api --locked --all-targets -- -D warnings` 通过。独立审查未发现阻断问题，并复跑 C ABI 分配回归、生命周期分配、释义和平台能力断言。

`bash scripts/verify-local.sh --quick` 通过，实际覆盖契约检查、Rust workspace、Android target 与宿主 JVM 冒烟、Wasm、原生 macOS 宿主和共享 Apple 桥接编译。Linux 因无 Docker、Windows 因无 MinGW、HarmonyOS 因缺工具链及分发资源跳过；缺少 app bundle 的桌面宿主目标按门禁规则跳过。这里没有宣称设备验收。格式检查、差异检查和笔记校验通过。

## Consequences

提前计数增加一次释义长度扫描；稠密命中场景需配对测量。该片测量时繁简转换的规范化查找每个字符也分配临时 `Vec`，独立排除其成本，本篇不改变该算法；后续去除端点申请见[共享前缀查找](../../implemented/simplification/2026-10-14-chinese-prefix-noalloc.md)。测试使用合成输入和临时空目录，不使用真实词库或输入。
