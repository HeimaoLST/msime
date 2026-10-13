# Agent Note: 脚本插件的只读数据文件：`[script].data`、MSTB 有序表和三个查表 import

Status: rejected — 唯一的消费者拆字改成了内置模式（#7611），没有别的插件需要

## Problem

脚本插件 v3 设计（`provide_commands`，见 [插件指令行](../../implemented/architecture/2026-10-13-script-plugin-command-rows.md)）里的拆字反查插件 `/cz` 要按部件的拼音查两万多个字：kfcd/chaizi 简繁并集约 2 万字、拼音反查索引约 1.3 万个键，紧凑编码约 146 KB，再加 Unihan 的读音。这些数据放不进模块：模块上限 256 KiB，而进程内存总账按模块字节的 128 倍估算翻译后的大小（`limits::TRANSLATED_BYTES_PER_MODULE_BYTE`），编进模块的数据每 KiB 要占 128 KiB 的账，几百 KiB 的表一个就把 64 MiB 的总账吃掉大半。合集里最大的 traditional-glyph 只编进 124 KiB 的表，在总账里就约 16 MiB（[脚本插件合集](../../implemented/architecture/2026-10-12-script-plugin-collection.md)）。插件需要一种「随包分发、只读、按 1 倍记账、查找在宿主侧完成」的数据。

## Proposal

- **清单**：`[script].data = ["chaizi.tbl", "readings.tbl"]`，最多 4 个文件，文件名规则同模块；单个不超过 4 MiB、合计不超过 8 MiB（和单词本包的单文件上限一致）。`SCRIPT_KEYS` 加 `data`，旧客户端以未知键拒绝新包，失败方向是安全的。
- **MSTB v1**（宿主定义的有序表）：`"MSTB"`、`u32 version = 1`、`u32 count`、`u32 offsets[count + 1]`，然后是 blob；第 i 条是 `blob[offsets[i]..offsets[i+1]]`，内容为 `key 0x00 value`。key 是 1 到 64 字节、不含 NUL 的 UTF-8，严格按字节递增；value 不超过 4096 字节，任意字节；全部小端。导入时和后台加载时各校验一次，热路径不再检查。`msime-pack data build in.tsv out.tbl` 负责生成。
- **三个 import，都不需要能力**（它们给的是插件自己包里的东西，不涉及用户文本）：`data_seek(file, key, klen) -> i32` 返回第 `file` 个文件里第一个大于等于 key 的条目下标，范围 [0, count]，`file` 越界返回 `INVALID`；`data_key(file, index, dst, cap)`、`data_value(file, index, dst, cap)` 复制第 `index` 条的键和值，`index == count` 时 `ABSENT`，放不下 `LIMIT`，按 import 的字节数计 fuel。授权页那句「只能知道发生了什么事件」要改成「…以及读自己包里的数据」，插件详情写「自带数据 N KB」。
- **内容哈希**：在现有的 `sha256("msime-script\0" ‖ len ‖ plugin.toml ‖ len ‖ 模块)` 后面按清单顺序追加 `len ‖ data_i`。没有数据文件的旧包哈希一个字节都不变，已有授权继续有效；换了数据，授权作废。
- **内存总账**：`script_memory_bytes` 加上数据字节数，按 1 倍记，不走模块的 128 倍。数据随编译好的模块在后台编译线程上读入、校验，放进按哈希共享的进程级缓存（`host-api/src/scripts/process.rs`），多个会话只占一份。
- **前缀查询有界（审查意见 M4）**：「先列精确、再列前缀，同级常用字在前」意味着 `/czh` 这类短前缀要扫成百上千条才挑得出常用字，每条读键和值两次，按 100 000 的 `command` 上限只扫得了约 400 条，用掉一半以上就算失败、50 次里失败 3 次熔断。生成器要预先算好「前缀（不超过 3 个字母）→ 前 9 个字」写进表里，插件只查一次；夹具里放最坏的单字母前缀，`check_run.py` 断言 fuel 不超过 50 000。
- **组装与许可证**：`plugins/script/tools/assemble.py` 的 `EMBEDDED_DATA` 改成同样覆盖 `[script].data` 里的文件，新增 CC-BY-3.0 的 NOTICE 要求；生成器 `gen_chaizi.py --check`，锁文件 `resources/chaizi.lock.json`（提交号、raw URL、sha256、大小，格式同 `resources/wordbook.lock.json`）。

## Alternatives considered

- **数据直接编进模块（`include_bytes!`），合集现在的做法**。最强的理由是不需要任何新接口，生僻字插件和 traditional-glyph 已经这样做。不行：模块 256 KiB 的上限和 128 倍的记账倍数都是按「模块是代码」定的，数据编进去既放不下拆字的表，也会让总账按代码的膨胀上界去记一份根本不会被翻译的数据。
- **给插件一个通用的键值存储**。最强的理由是一种接口同时满足数据和状态。不行：可写的存储让插件在不同输入框、不同应用之间带着状态，等于给读到用户文本的插件开了一条持久化通道（不变量 I2），设计明确不加存储和时钟。
- **宿主内置拆字查询，插件只做界面**。最强的理由是查找在 Rust 里又快又省 fuel。不行：那就是一项内置功能，插件只剩一层皮，设计的取舍是「数据给插件、查找原语给宿主」。后来维护者确实选了内置，但做成了完整的内置本地模式，连插件都不要了（见下）。

## Acceptance criteria

- 没有数据文件的旧包内容哈希逐字节不变；表无序、键有 NUL、越界的偏移、超过大小上限时导入被拒；`data_seek` 在空表、首条之前、末条之后的返回值；fuel 按字节计；总账按 1 倍记。
- 拆字夹具里 `/czhuohuohuo` 出焱、`/cznvzi` 出好、`/czmuzi` 出李，最坏前缀 `/czh` 的 fuel 不超过 50 000。

## Risks

- 数据文件让内容哈希多出几段，授权绑定的东西变大，换一次数据就要重新授权。
- MSTB 是又一种宿主定义的格式，要在 client-core（导入）、host-api（加载）和 pack-tool（生成）三处保持一致。

## Rejection

拆字改成了六个平台都有的内置 C 模式（#7611，见 [内置拆字反查](../../implemented/feature/2026-10-13-builtin-chaizi-mode.md)），移动端本来就不运行脚本包，维护者因此不做拆字插件。v3 剩下的两个官方插件都不需要数据：uuid 只用随机数，latex-symbols 是短语表数据包。没有消费者的格式和 import 不做（YAGNI）。

以后真有插件要随包带大于模块能放下的只读数据时，从这一篇起步：哈希只在有数据时追加、数据按 1 倍记账、导入和加载各校验一次、前缀查询要预计算出上界，这几条的理由在上面都还成立。
