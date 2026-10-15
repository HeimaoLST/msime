# Agent Note: 合法音节纠错生成复用编辑缓冲

Status: implemented

## Problem

`pinyin::typos::compute_typos` 为每个交换、邻键替换、删除和插入变体分别调用 `letters.to_vec()`，插入还可能扩容。首次 `syllable_typos` 查询会同步为全部 421 个合法音节建立表，大量最终被过滤掉的编辑仍产生短命字节向量。

## Decision

每次 `compute_typos` 创建一个容量为原字节长度加一的编辑缓冲，循环中清空并复制原字节后执行原来的编辑。保持遍历顺序、UTF-8 校验、合法性、别名规范化、去重和稳定类型排序，不改变进程级缓存和输出所有权。

## Related notes audit

- [双拼的纠错整句](../../implemented/feature/2026-10-09-shuangpin-typo-sentence.md)：相关背景，但实现与表不同；本篇只改全拼合法音节变体的编辑存储，不改共用邻键函数、双拼变体或纠错开关。
- [纠错搜索边的延迟缓冲](../../implemented/testing/2026-10-10-typo-edge-lazy-buffers.md)：无关，负责网格边规划，不负责合法音节纠错表初始化。
- 未发现持有 `compute_typos` 编辑存储决定的旧笔记或过时提案。

## Alternatives considered

- **逐变体创建向量**：编辑逻辑直接，每次都有独立原输入，但非法变体也申请临时存储，插入路径又会扩容。
- **按最长合法音节建立栈数组**：正常建表输入最多六字节，可以完全取消编辑堆存储；但私有生成器当前也接受任意 UTF-8 字符串，硬上限需要新增拒绝或动态回退。先用一个向量保留原输入契约和循环结构。
- **逐次撤销编辑**：可以省去原字节的重复复制，但四种编辑的撤销规则不同，容易让后续变体继承前一次修改；清空并恢复原字节保留独立编辑语义。

## Verification

冻结旧生成器，与全部 421 个合法音节及 9 种合成边界输入逐项比较完整 `Vec<SyllableTypo>`，文本、类型和顺序相等。边界包括空输入、单字节输入、未知拼写、大写、分隔符、中文、emoji、NUL 和超过合法音节上限的长输入。短输入的原分配保持；其他每项都比旧实现少分配。

计量前初始化合法音节集合，计量内仅借用输入并返回独立拥有的结果。红阶段旧/新都为 107,871 次，分配下降断言按预期失败；复用后同一完整测试为 107,871 → 3,499 次。单独统计实际建表的 421 个音节生成，为 103,359 → 3,479 次，减少 99,880 次分配（约 96.6%）。此统计不含外层 HashMap 和首次合法音节集合初始化。

完整引擎测试 2,078 项通过、19 项忽略，golden 31 项通过。fmt、Clippy、笔记检查及 `git diff --check` 通过。只读审查通过。

`bash scripts/verify-local.sh --quick` 通过：Rust workspace、Android/wasm 目标、Android 宿主检查、Linux 公共组件和原生宿主（87 项测试）、macOS 原生宿主与 Apple bridge 构建，以及本机可运行的 Windows 原生测试（149 项）。Windows 完整交叉构建和 HarmonyOS 真打包因缺少环境跳过；未做设备安装验收。

## Consequences

每个多字节输入只创建一个临时编辑缓冲，所有编辑恢复原字节后复用容量，插入不扩容。输出向量、规范拼写字符串、重复变体处理、稳定排序及静态表的保留容量保持原状，没有新增进程常驻工作区。

收益只作用于首次全拼合法音节纠错表初始化；热查询本来借用静态表，本次不宣称 CPU、端到端延迟、RSS 或热按键速度变化。保留一个原字节长度加一的临时堆缓冲，仍逐编辑复制原字节；按最长合法音节用栈缓冲或撤销编辑是独立取舍。

依据 [Vec::clear](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.clear) 保留容量，使用 [Vec::with_capacity](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.with_capacity) 为插入预留空间，并由分配对照验证实际收益。
