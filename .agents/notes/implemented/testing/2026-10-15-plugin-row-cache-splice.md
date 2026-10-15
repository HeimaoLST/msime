# Agent Note: 插件缓存行直接插入候选列表

Status: implemented

## Problem

`InputSession::update_local_candidates` 每次重建本地候选时都会恢复同一份插件缓存行。恢复路径先克隆整个 `Vec<WordItem>`，再把这个临时向量移入 `local_candidates`；候选行的字符串仍然必须复制，但短命的行容器本身没有必要申请。

## Decision

保留缓存行的借用范围和 `WordItem` 的拥有型复制边界，直接把 `rows.iter().cloned()` 交给 `local_candidates.splice`。迭代器提供缓存行的准确长度提示，`splice` 直接扩容目标列表；候选去重、插件行顺序、预编辑串匹配和失效清理保持原逻辑。

已有的[插件指令回包固定文本槽位](2026-10-15-plugin-command-text-buffer.md)只负责回包过滤阶段的文本索引，本篇处理后续候选列表重建，两个决定分别保留。检索活跃的 proposed、implemented、rejected 笔记中的插件缓存、`plugin_rows` 与候选行复制；插件指令行架构笔记持有缓存失效与宿主协议边界，全拼热行缓存投影和会话展示行缓冲处理其他候选阶段，均不由本篇接管。

## Alternatives considered

- **继续克隆完整 `Vec<WordItem>` 再移入**：实现直接，但每次列表重建都申请一个只存在到 `splice` 完成的临时行容器。
- **把缓存行直接移入候选列表并从缓存中取走**：可以省下更多复制，但缓存必须在方向键、翻页和后续重建中继续可用，移走会破坏插件行缓存契约，重新复制回缓存也会增加状态复杂度。
- **改成共享引用或 `Arc<WordItem>`**：能避免行字段复制，但会改变候选行可独立修改和缓存生命周期的所有权边界，超出本次容器分配优化范围。

## Verification

新增 `cached_plugin_rows_do_not_allocate_a_temporary_row_vector` 分配回归，走真实 `/uuid` 查询、插件回包和本地候选刷新，覆盖 1、2、18 行各连续重建两次，比较全部候选字段与缓存行，并检查显示行修改后的缓存独立性。还原旧生产实现时单行刷新实际失败（4 次，目标 3 次）；恢复优化后各预算分别为 3、5、37 次，包含每行读法和词面复制，以及最终候选容器的一次申请。插件行相关 6 项引擎测试通过。

[Rust `Vec::splice` 文档](https://doc.rust-lang.org/std/vec/struct.Vec.html#method.splice)说明准确的迭代器长度下界可以避免额外临时向量；`rows.iter().cloned()` 沿用相邻插件回包插入路径已经使用的模式。

独立只读复核未发现阻断问题。完整引擎测试、Clippy、Rustfmt、差异检查和笔记门禁通过；quick 门禁退出 0，覆盖 Rust workspace、Android/wasm target、Android Java、macOS 原生宿主及 Apple bridge 编译。Linux 外壳和原生宿主因缺少 Docker 跳过，Windows 原生/交叉及 pipe-only 因缺少工具链跳过，HarmonyOS 真打包因缺少 hvigor 和所需产物/依赖跳过；macOS workspace 的桌面共享层因尚未生成原生资源 bundle 而跳过。没有运行真实宿主输入或设备验收，也未测量 CPU 时间、RSS 或完整输入延迟。

## Consequences

每次缓存插件行重建省去一次临时 `Vec<WordItem>` 申请；最终候选仍拥有独立行字段，缓存仍保留原有生命周期。插件行数量、目标容量不足时的扩容、重复文本去除和空结果兜底行为不变。本决定未改变插件回包、公开 API 或跨平台宿主契约。
