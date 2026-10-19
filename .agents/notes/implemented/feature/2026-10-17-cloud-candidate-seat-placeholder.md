# Agent Note: 云候选固定席位

Status: implemented

## Problem

云候选在网络回包到达前不出现在候选列表。回包随后插入第二席，会把用户正在看的本地候选整体后移，数字键或空格可能选中另一行。

## Decision

共享 Engine 在允许云候选的组字中预留一个 `CandidateSource::CloudPending` 行，固定在云候选席位。云回包仍由在线批处理写入 `CloudSuggestion`，它替换同一席位；没有结果时占位保留到组字结束。关闭云候选时立即移除占位。Android、iOS 和 HarmonyOS 隐藏该内部占位行，等真实云候选返回后再显示，避免把 `☁`、加载符号或云字样放进移动端候选栏；Runtime、插件锁定规则和各宿主候选呈现都把该来源当作在线占位行处理，禁止学习、改字和候选管理。

`HostSession::apply_pending` 在新建 Session 后、交给 Runtime 前恢复 `cloud_candidates`。该开关不在 `EngineOptions` 内，新引擎默认关闭；空闲应用偏好、组字结束后应用偏好和仅资源变化触发的重建都必须恢复。重建前选用最新请求的偏好，没有待应用快照时用已应用偏好，与同一引擎的其他选项保持一致。重建本身已经使旧候选身份失效，不再通过 Runtime setter 补调或额外推进代次。

## Alternatives considered

- **只在宿主候选栏末尾画加载图标**：改动小，但候选数字位置仍会在回包时移动，无法解决误选。
- **为云候选预留多个空席**：能覆盖多条回答，但云协议只有一个云候选席位；多余空席会挤掉本地词并造成分页跳动。
- **只在回包后冻结当前高亮**：高亮不动仍不能保证数字键对应的文本不变，且各宿主的候选身份映射会分叉。

- **替换后再调用 Runtime setter**：复用宿主初次创建时的配置路径，但替换已发布默认关闭的引擎，再补调会多走一次身份失效和快照刷新；在发布前配置新 Session 可直接获得完整状态。

## Consequences

Android、iOS 和 HarmonyOS 在云请求期间不显示占位行，真实云候选返回后才出现在候选栏；三个移动宿主都把触控、硬件数字键、候选维护操作和展开面板的显示序号重新映射回 Engine 原始索引，避免隐藏占位行后错选。共享占位行仍会增加一个候选席位并参与页数计算，云请求失败时仍会占位到组字变化。来源值追加为 15，保留已有候选来源的 ABI 数字。

验证包括 `cargo test -p msime-engine --lib session::tests::cloud_answer_replaces_its_fixed_pending_seat`、`cargo test -p msime-input-runtime --lib --no-default-features`（318 项）和 `cargo check -p msime-host-api --lib`。

重建回归使用合成拼音词库，经公开 Host API 验证下一次组字中的 `CloudPending` 与偏好一致，分别覆盖空闲更新、延迟到上屏完成的更新和无偏好请求时的资源重建，并同时覆盖开启和关闭。资源用例只注入已存在的 `resources_pending` 标记，不改变磁盘资源格式；三项用例在修复前均因开启状态丢失而失败。延迟用例在上屏后不重复同步偏好，避免重复 setter 掩盖重建问题。

本轮 `cargo test -p msime-host-api --locked` 有 864 项通过、3 项既有忽略；clippy（`--all-targets --locked -- -D warnings`）、Rust 格式检查和笔记门禁通过。`bash scripts/verify-local.sh --quick` 通过：157 项 Windows 可移植测试、Rust 工作区、Android 目标与 Java 宿主、两种 WASM 配置、Linux 设置外壳与原生宿主（90 项测试）、full/五笔版安装隔离、macOS 原生宿主和 Apple 桥接层构建；MinGW 交叉构建和 HarmonyOS 真打包因前置环境不足跳过。未进行系统输入框或设备装机验收。
