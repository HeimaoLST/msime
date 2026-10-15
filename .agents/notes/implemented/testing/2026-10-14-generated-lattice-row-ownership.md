# Agent Note: 默认整句行转移路径字段所有权

Status: implemented

## Problem

无神经重排的默认整句输出为句子、读音、词列表及内层字符串深复制，随后立即释放原路径。默认只显示一条整句仍反复复制这些已经拥有的字段。

## Decision

默认生成分支消耗解码路径，将选中路径字段移动到最终 `WordItem`；`typed_pinyin` 仍按原接口拥有。小列表按已有候选和输出块线性去重；大列表保留候选借用集合，以 `decode_graph` 已先消除全部同句切分并稳定重排的契约保证路径批内唯一。[神经输出字段移交](2026-10-15-neural-lattice-row-ownership.md)接管神经分支；本篇默认分支策略保持。原输出块容量与分配时机、`emit` 截断位置、候选字段、次序、插入位置和纠错返回保持。

## Historical audit

已检索sentence_row、路径所有权、空输出与终点去重。[短列表去重](../../implemented/testing/2026-10-08-lattice-merge-dedup.md)、[空块延后分配](../../implemented/testing/2026-10-10-lattice-empty-block-buffers.md)、[终点句子去重](../../implemented/testing/2026-10-07-lattice-sentence-dedup.md)、[神经借用排列](../../implemented/testing/2026-10-14-neural-lattice-borrowed-order.md)部分重叠并互链。其它拼音查词、注音和模糊路径所有权记录属于其它入口，无重复或过时提案。

## Alternatives considered

- 只移动读音和词列表、句子仍复制：借用去重键容易维持，但保留每行句子复制；默认分支在解码后没有其它路径消费者，可完整移交。
- 为大批次先收集保留索引：可支持任意批内重复，但额外建立规划缓冲；生产输入已经由解码器去重，消耗其保证无需重复记录。
- 将所有句子输出改为共享字符串：多个来源可共享，但改变跨模块字段类型和引用计数，本分支没有第二个拥有消费者。

## Verification

冻结 `adb6100b435990ef8077e93736e112b787839988` 的完整合并及7个助手，只改名、可见性和移除注释。两条测试在旧生产上真实红灯：首条2词路径实际旧新均61次，未省下独立实测字段克隆的5次；字段指针与预留容量也被深复制改变。改后两项通过。

672组完整默认合并矩阵覆盖0、1、2、6、12、65、129条路径、`emit = 0/1/3/usize::MAX`、0/61/64/65个已有占位候选、0/1/全部重复及纠错开启/关闭，完整输出字段、顺序、外层容量、纠错返回和传给纠错源的字面最优均相同。加入同句的2词短语和3词单字切分，确认解码先消除重复再合并；夹具的beam改为n+1以容纳额外切分，避免65条目标在终列被提前剪到64条。每条实际输出路径都在区间外独立测量 `SentencePath::clone`，精确核对消除对应字段成本，2词/3词路径分别少5/6次，全部重复和空输出不新增分配。

指针侧表用三条带额外容量的合成路径，逐条核对句子、读音、词列表与内层字符串的原指针/容量直接交给候选。仅输出块1次和三行 `typed_pinyin` 各1次，共4次分配。

既有空块和神经借用排列回归首轮完整测试分别因默认生成额外少12次及6次而失败；两处现在把输出Generated匹配到区间外解码路径并独立测其字段克隆，加入原有空块/模型克隆精确预算。只消费助手的输入在计量外建立并在区间内释放，原来的 `remaining_bytes = 0` 不再是合法计量；它继续验证零分配、零请求峰值与零返回容量，日志直接按返回块容量计算存储，完整入口的计量仍包含路径建立/释放。

完整 `MSIME_NEURAL_MODEL_DIR=$PWD/target/neural-model cargo test -p msime-engine` 通过2044项单测（16项既有忽略）、31项黄金用例和文档测试，键盘/桌面模型资源按锁文件准备。`cargo clippy -p msime-engine --all-targets --locked -- -D warnings`、`cargo fmt --all --check`、`git diff --check` 与 `pnpm run verify-notes` 通过。独立审查核对冻结完整合并与7个助手，另跑两项专项测试通过，无实现阻断。

本地 `bash scripts/verify-local.sh --quick` 退出0；Rust workspace、Android目标/Java宿主、WASM、macOS原生宿主和共享Apple桥编译通过。HarmonyOS缺少构建环境、Linux缺Docker、Windows缺MinGW与已配置构建目录，相应阶段明确跳过；不将跳过算作平台设备验收。无生产文件读写或Android资源改动，不触发此类改动的模拟器强制门禁。

## Consequences

最终字段继承解码存储容量，词列表继承解码器按音节数预留的容量，可能大于旧 `clone` 的紧缩容量，少分配不保证留存字节减少；不为缩容重新分配。默认大列表依赖既有解码唯一契约，测试覆盖重复切分。无unsafe、依赖或公开API变化，无生产文件读写/Android资源改动。不把分配次数收益泛化为RSS或设备延迟。

消耗路径使用[Rust Vec拥有迭代器](https://doc.rust-lang.org/std/vec/struct.IntoIter.html)，不复制存储。大列表仅查已有候选集合，生产唯一入口先调用 `decode_graph` 的完整去重再三元重排，默认分支之后只截断，不生成新的重复路径；以后若接入其它来源必须维护这项契约。

[首次跨度行移交图边](2026-10-14-lattice-graph-row-ownership.md)只改变单次建图内部缓存，保留本篇查询缓存、键规划或解码后候选所有权职责。
