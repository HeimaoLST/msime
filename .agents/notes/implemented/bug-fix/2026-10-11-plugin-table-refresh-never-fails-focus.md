# Agent Note: 聚焦时换插件表失败不让聚焦失败

Status: implemented

## Problem

`crates/host-api/src/lib.rs` 的 `refresh_plugin_tables` 在 `msime_client_focus(handle, true)` 里、`runtime.focus` 之前运行。指令表、`@` 名单和 K 模式短语表三个分支用 `?` 把 `Runtime::set_command_table` / `set_mention_entries` / `set_quick_phrase_table` 的错误往上抛：聚焦整个失败，戳也没记下，于是只要失败的条件还在，之后每次聚焦都再失败一次。辅助码表分支则报告后继续。

这三个 setter 的失败条件（逐层读到 `crates/engine/src/session/input.rs`）：

- `Runtime::advance` 的代次耗尽（`u64` 溢出），实际到不了，而且那时随后的 `runtime.focus` 也一样失败。
- Engine 先换表，再在对应模式打开时刷新列表，刷新的诊断变成错误。`/` 和 `@` 模式的查询从不返回诊断；K 模式会：`query_quick_phrases` 在主词库打不开或查询出错时返回 `QUICK_PHRASE_UNAVAILABLE` / `QUICK_PHRASE_QUERY_FAILED`。
- `Runtime::refresh` 取快照，`msime_engine::host::Session::snapshot` 不会返回错误。

所以今天真能触发的是：K 模式开着、数据库短语查不了、短语表在磁盘上变了、宿主没有先失焦就再次聚焦。测试复现出来的错误是 `engine action failed: Quick phrase database is unavailable.`。

## Decision

三个分支与辅助码表分支一样报告后继续：错误经 `diagnostics::report` 报告（类别 `command table view not refreshed`、`mention list view not refreshed`、`quick phrase view not refreshed`），戳照常更新，聚焦照常进行。`refresh_plugin_tables` 返回 `()`。

与辅助码表分支不同的一点：出错时新表仍记进 `self.options`。能出错的地方都在 Engine 换表之后，Engine 已经在用新表；如果 `options` 留着旧表而戳已更新，下一次偏好更新重建 Engine 时 `PluginTables::fill` 看戳没变、不重读文件，新 Engine 就从旧表开始，静悄悄地退回去。

`/` 和 `@` 两个分支今天并不会出错，也用同样的写法，是因为它们与短语表走同一个 `Result` 契约：Engine 的本地查询哪天给 `/` 或 `@` 模式加上诊断，聚焦也不会因此失败。

## Alternatives considered

- **只改短语表分支**：唯一今天能触发的就是它，改动最小。但三个分支调用同一形状的 setter，留下两个 `?` 等于把同一个坑留给下一次改 Engine 查询的人，而改成报告对今天的行为没有影响。
- **出错时保留旧表（与辅助码表分支完全一致）**：看上去最保守。但 Engine 已经换上新表，`options` 与 Engine 不一致，并在下一次重建时退回旧表，见上文。辅助码表的 setter 从不失败，那个分支的 `Err` 路径实际走不到，不构成反例。
- **出错时不更新戳，下次聚焦重试**：失败条件（K 模式开着、数据库查不了）还在时每次聚焦都会再报一次，诊断日志被刷屏，而重试换不来任何东西：表已经换上了。

## Consequences

K 模式开着、主词库短语查不了时换短语表，聚焦照常成功，新表立即生效，偏好更新后也不会退回旧表；诊断日志里多一行说明打开的列表没刷新。代价是诊断类别多了三个，以及 `/`、`@` 两个分支多了今天走不到的报告路径。

## Verification

`crates/host-api/src/tests.rs` 的 `a_phrase_table_that_cannot_refresh_the_open_list_does_not_fail_focus`：会话没有主词库文件 `msime-pinyin.db`，K 模式的数据库短语查询返回 `QUICK_PHRASE_UNAVAILABLE`。会话进入 K 模式输入 `dh`，换掉短语表后聚焦成功；随即按磁盘现状重新盖戳，与会话记下的戳相同，证明之后的聚焦不会再换一次表；取消后 K 模式候选是新表的行，偏好更新重建 Engine 后仍是新表。若刷新错误仍经 `?` 抛出，这次聚焦返回 `{"error":"engine action failed: Quick phrase database is unavailable.","ok":false}`。诊断行本身不在这个测试里断言：诊断出口是进程级的，只有 `plugin_failures_reach_the_registered_diagnostic_sink` 登记它。
