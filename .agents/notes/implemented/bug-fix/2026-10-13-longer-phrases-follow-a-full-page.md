# Agent Note: 精确同音词够一页时补全词接在后面，门槛随宿主改页大小即时跟随

Status: implemented

## Problem

[补全词让位于一页精确同音词](2026-10-13-longer-phrases-yield-to-a-full-page.md)（#7596）让精确同音词够填一页时整组补全词都不并入，合并后有三处问题：

- **补全词整个丢了，不只是不进首页。** `longer_phrase_candidates` 根本不调用，往后翻也找不到。计数只看行数不看权重，冷僻同音词照样算进「填满一页」，所以 `zhong'guo`、`shi'de` 这类同音词多的输入里，「中国人民」「是的话」从候选里消失了；词库给某个读音多加几个冷僻同音词，原来能找到的补全词也会跟着不见。
- **宿主运行时改每页候选数，门槛不跟随。** `msime_client_set_candidate_page_size`（Fcitx5 的「9 个候选」菜单、没有偏好目录时 IBus 的每页候选数菜单）只走 `Runtime::set_page_size`，引擎不重建，`first_page_rows` 停在旧值，直到别的偏好变化触发重建。#7596 在 `apply_pending` 的注释里写了「今天也没有宿主入口写它」，这不对。
- **0 的处理九键和 26 键不一致。** 26 键每次请求经 `FirstPageRows::new` 把 0 当 1，九键把会话选项里的原始值直接交给 `QuanpinDictionary`。

## Decision

- 全长组里精确同音词（`canonical_pinyin` 等于键入切分的行）够填一页时，补全词按权重接在这一组末尾，不和同音词混排；不足一页时照旧按权重混排、首位仍归最重的精确行。首页仍全是同音词，补全词翻页还找得到。`LONGER_PHRASE_LIMIT = 3` 和 `LONGER_PHRASE_EXTRA_SYLLABLES = 3` 不变。
- `Runtime::set_page_size` 改了页大小后经 `InputEngine::set_first_page_rows` 把新值交给引擎（`host::Session` → `session::Session` → 26 键 `ImeSession` 与九键 `NineKeySession`），宿主菜单改每页条数即时影响补全词门槛，不必重建。页大小没变时不推。
- 「0 当 1」只在 `QuanpinDictionary::set_first_page_rows` 做一次，九键和 26 键都经过这里。它只清 `series_cache`（按旧门槛组装好的候选列表），不清 `cache`：后者是每个切分的查询结果，补全词是查完之后才并入的，与门槛无关。

## Alternatives considered

- **维持整组不并入，只修门槛跟随和 0。** 改动最小，首页目标也达成。但「中国人民」「是的话」这类补全词在同音词多的输入里彻底消失，用户没有任何办法再选到它们，这是 #7596 引入的回退，不是取舍。
- **够一页时补全词放到整个候选列表最后（所有分组之后）。** 离首页更远。但全长组之后是更短切分的单字和词（`zhong'guo` 之后是「中」「种」……），补全词排到几十个单字后面，几乎等于找不到；接在全长组末尾，同音词和补全词在相邻的几页里。
- **门槛按权重算（只数权重高于某个值的同音词）。** 能让冷僻同音词不算进「填满一页」。[原笔记](2026-10-13-longer-phrases-yield-to-a-full-page.md) 已经说明权重比例分不开 `fa'ban` 和 `ping'guo` 两类输入；补全词既然不再被丢掉，算多算少只影响它们排第一页还是第二页，没有必要再引入阈值。
- **宿主改页大小时重建引擎。** 和改偏好走同一条路，不加新接口。重建要重新打开词库、丢掉全部缓存，而这里只差一个整数；`set_rescoring_context` 已经是同样的「不重建、直接推给引擎」通路，照它做。

## Consequences

- **收益**：同音词多的输入恢复了补全词，首页仍然只有同音词；Linux 宿主菜单改每页条数后，补全词门槛立刻按新值判断；九键和 26 键对 0 的处理一致；改门槛不再白丢切分查询缓存。
- **代价与已知上限**：门槛只数本组的精确行，首页上的整句块、AI 位、云候选位和后插入的用户词不算在内，同音词差一两个填满一页时，补全词仍可能把最后一两个同音词挤到第二页。补全词接在末尾后，同音词很多的输入里它们可能在第二、三页，比混排时靠后。
- 原笔记的「改设置即生效」现在对运行时改页大小也成立。

## Verification

- `crates/engine/src/quanpin/dictionary/tests.rs`：`exact_rows_filling_a_page_put_the_longer_phrases_after_them`（原 `exact_rows_filling_a_page_drop_the_longer_phrases`）断言前六位是六个同音词、「企事业单位」紧接在第七位；`a_zero_first_page_rows_counts_as_one` 断言 `set_first_page_rows(0)` 记成 1。
- `crates/engine/src/session/tests.rs` 的 `first_page_rows_reaches_the_dictionary_through_the_session_options` 改为：每页 6 行时「企事业单位」排在「骑士」之后，每页 8 行时排第二。
- `crates/input-runtime/src/tests.rs` 新增 `a_page_size_change_reaches_the_engine_first_page_threshold`：`set_page_size(9)`、再 `set_page_size(9)`、再 `set_page_size(3)`，引擎收到 `[9, 3]`。
- 以上四个测试在撤掉对应修复时都会失败（补全词不出现、门槛未归一、引擎收到空列表）。
- `cargo test -p msime-engine -p msime-input-runtime -p msime-host-api` 全过；`cargo clippy` 对这三个 crate `-D warnings` 干净。
- 没有在装好的输入法里实际打字复核。
