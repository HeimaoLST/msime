# Agent Note: macOS 接入 Vim 模式的无修饰 Esc

Status: proposed

## Problem

Windows 从 2026-10-09 起有 **Vim 模式**：`[input] vim_mode_apps` 列出的应用里，交给应用的无修饰 Esc 同时把水杉切到英文，Vim 用户可以立刻输入 `hjkl`。本仓 macOS 侧 **0 命中**：`grep -rni vim platforms/macos/` 为空，整个共享客户端也没有这个字段。

这份提案先把 Windows 的语义固定下来，再给出 macOS 的最小落点。**代码不在本改动里**：按[应用例外成为共享偏好](../../implemented/feature/2026-10-10-windows-input-mode-parity.md)的先例，macOS 加一个「应用名单」偏好等于改 `crates/client-core/src/preferences.rs` 的共享偏好契约、加宿主能力位、加共享设置页段落，并按平台决定标识语义。这超出「macOS 本机补一个小缺口」的规模，且 `vim_mode_apps` 现在只存在于 Windows 的 TSF 本地解析里，是否提升成共享偏好需要维护者先拍板。

### Windows 行为规格（v0.11.1，检出 `target/ref/msime-windows`）

| 项 | Windows 实现位置 | 确切语义 |
|---|---|---|
| 偏好字段 | `installer/default_config/config.default.toml` `[input] vim_mode_apps` | 字符串数组，出厂 `[]`（关闭）；升级合并保留用户写的值 |
| 名单存储 | 数据目录 `config.toml` 的 `[input]` | 可执行文件**基名**（不带路径），ASCII 大小写不敏感；终端里的 Vim 要填终端宿主 |
| 名单解析 | `windows/src/Key/VimMode.cpp` `ParseStringArray` | 单层字符串数组，可跨行、带 `#` 注释、单双引号、`\\` 与 `\"` 转义；数字、嵌套数组、缺逗号、未闭合、不支持的转义一律**整表拒绝**，半开的配置不会悄悄生效 |
| 读取与缓存 | `windows/src/Utils/FanyUtils.cpp` `ReadConfiguredVimMode` | 最多每秒轮询；文件 mtime 或大小变化才重读；读失败保留重试标记；用当前宿主进程名匹配，空进程名视为不启用 |
| Esc 触发条件 | `windows/src/Key/VimMode.h` `ShouldSwitchToEnglish` | `key == 0x1B && !eaten && !repeat && modifiers == 0 && !winDown && !compositionActive && !deferredKeysPending` |
| 修饰键范围 | `CaptureIpcModifiers` + `GetAsyncKeyState` | 只认 Shift / Ctrl / Alt / Win；带任一修饰键的 Esc 保持原行为 |
| 触发动作 | `windows/src/Key/KeyEventSink.cpp` `ApplyVimModeEscape` | 仅当**当前是中文**（`GetIMEMode` 为真）才切：`SetIMEMode(FALSE)` 加 `SetPunctuationMode(FALSE)`。不改系统输入法，只改水杉自己的中英文与标点态 |
| Esc 去向 | `OnTestKeyDown`（`KeyEventSink.cpp:983`）与 `OnKeyDown`（`:1050`）两处调用 | Esc 原样交给应用，切英文是搭车；`OnTestKeyDown` 那处保证 `TestKeyDown` 返回 FALSE、TSF 省略 `OnKeyDown` 的宿主也能切 |
| 组字中 | `eaten` / `compositionActive` 两个入参 | 组字或候选开着时一律不切：Esc 先按现有逻辑取消组字，**取消后重新按一次**才切英文 |
| 长按 | `IsAutoRepeat(lParam)` | 长按 Esc 的重复事件不触发切换 |
| 在飞按键 | `_HasDeferredKeyBarrier()` | 有排队/在飞的异步按键时不抢先切，避免改变队列里按键的含义 |
| 冲突与作用域 | `ime_mode_scope` / 标点锁定 | 切英文后沿用现有 compartment 通路；`scope = global` 时英文态会同步到别的应用；进入 insert 模式不自动回中文 |
| 设置界面 | `server/src/settings/native/` **没有任何 vim 控件** | 这个版本只能手改 `config.toml`，唯一说明是 `docs/vim-mode.md`；`server/src` 全目录无 `vim` 命中 |

### 为什么 macOS 不能照抄

- **标识不同。** Windows 匹配前台进程的可执行文件基名；macOS 输入法宿主在独立进程里，进程名永远是水杉自己，只有前台应用的 `bundleIdentifier`（`InputController.mm:6121` 的 `activateInputModeForApplication:`，存进 `AppearancePreferences._activeModeApplication`）。名单必须按平台分键，和 `app_input_mode_rules` 现在「macOS bundle id、Windows 进程基名」同款。
- **没有现成通路。** Windows 是 TSF DLL 自己把 `config.toml` 读成裸文本解析；macOS 宿主经 Rust 桥拿 `hostOptions[@"preferences"]`，字段必须先进 `crates/client-core/src/preferences.rs` 的 `Preferences`。全仓 `vim_mode` 只出现在 Windows 源码、Windows 测试、两份出厂模板和 `windows/CMakeLists.txt`，共享偏好契约里没有它。

## Proposal

按应用例外的整套做法补齐，分三层：

1. **共享偏好。** `Preferences` 新增 `vim_mode_apps: Vec<String>`（空表不写进文档，旧版本照常读），校验沿用 `valid_app_input_mode_rules` 的口径：每项非空、UTF-8 ≤ 64 字节、两侧无空白、无控制字符和 `\` `/`，按 ASCII 不分大小写去重，上限先用同一档 32，超限整份拒绝。`host_surface.rs` 在 `app_input_mode_rules`（`:170`）旁加同名能力位，`capabilities_for_platform`（`:528`）里先只给 macOS，Windows 继续读它自己的 TSF 本地键。
2. **macOS 宿主。** `AppearancePreferences.mm` 在 `SharedOverrideProperties()`、`SettingProbes()`、`-applySharedInputPreferences:`（`:2024`）和 `-sharedPreferencesByMerging:`（`:1277`）里接上 `vim_mode_apps`，并新增 `-vimModeEnabledForApplication:`（按 `_activeModeApplication` 的 bundle id 查，规范化与 `InputModeRuleKeyForIdentifier` 一致）。`InputController.mm` 在 `handleKeyEvent:client:`（`:6066`）里、`switch (event.keyCode)` 的 `case 53`（`:6694`）之前判定：仅当 Esc 不会被引擎吃掉、非长按、无 Shift/Ctrl/Option/Command、名单命中、当前非英文、且没有组字（`editing_text` / `candidates` / `phrase_prefix` 三项全空）时调用 `setEnglishInputMode:YES`。判定写成纯函数放进新 `platforms/macos/src/core/VimMode.h`（镜像 Windows 的 `VimMode::ShouldSwitchToEnglish`），配 `platforms/macos/tests/core/VimModeTest.cpp` 的 CTest（不依赖窗口）。标点不需要额外处理：`setEnglishInputMode:`（`:4141`）已经按模式和 `punctuation_lock` 同步标点，等价于 Windows 的 `SetPunctuationMode(FALSE)`。
3. **设置界面与 MCP。** 共享设置页新增一个名单段落，复用 `app-input-mode-rules.ts` 的 `normalizeAppInputModeRuleId`、`appInputModeRuleProblem` 和 `pickApplication` / `applicationNames` 契约，只是没有模式下拉；挂进 `packages/ui/src/settings/pages/input-page.tsx`（`:369` 的应用例外段旁）和 `preferences-model.ts`（`:111` 附近）。MCP 的 `crates/mcp-server/src/preferences.rs` 同 `app_input_mode_rules` 读写。

Windows 是否把这把键从 TSF 裸解析迁进共享文档，留给维护者：迁则两边一份名单，不迁则 macOS 用共享键、Windows 用 `config.toml`，用户要维护两张表。

## Alternatives considered

- **macOS 本地 `NSUserDefaults` 键，不碰共享契约。** 最强的理由是改动最小、只动 macOS、不经过跨平台评审，Windows 那份现在也是本地键，看起来对称。不用它的原因是它会造出第二套「应用名单」：共享设置页看不到也改不了，Windows 写在 `config.toml`、macOS 写在本机默认值，用户要在两处维护两张表，两边的说法会很快不一致。[应用例外成为共享偏好](../../implemented/feature/2026-10-10-windows-input-mode-parity.md) 已经因为同一理由否掉过「规则只放 Windows 本地」，这里沿用同一判断。
- **照抄 Windows 的 exe 基名匹配。** 逻辑可以逐行移植，但 macOS 上进程基名恒为水杉自己的输入法宿主，配了也永远不匹配，等于功能没做。
- **复用应用例外表：有 `app_input_mode_rules` 的应用按 Esc 就切英文。** 最省事，零新偏好、零新 UI。语义不同：应用例外决定「进入应用时的起始模式」，Vim 模式是「离开输入时切回英文」，把两者绑死会让只想固定起始模式的人也被改掉行为；而 Vim 用户要的正是同一个应用里中文和 normal 模式来回切换。
- **先只落 macOS 提案，Windows 完全不动。** 可行，也是本提案的默认范围；代价是长期保留两份名单/两种键，等维护者决定要不要把 Windows 一起迁进共享文档。

## Acceptance criteria

- 名单命中的应用里，无组字、无修饰键、非长按的 Esc 让 `_appearance.englishMode` 变为 YES，且 Esc 仍到达应用；切英文后再打中文需要用户自己切回或按既有中英文快捷键。
- 未在名单、带任一修饰键、长按、组字或候选开着时按 Esc：行为与今天逐键一致（组字中的第一次 Esc 仍只取消组字）。
- 名单为空、键缺失、类型非法、超出上限：一律不触发，不报错，不影响别的偏好。
- 名单可在共享设置页和 macOS 原生设置窗口增删；写进 `preferences.json` 后 MCP 可读写（若采纳 MCP 一项）。
- 测试：`platforms/macos/tests/core/VimModeTest.cpp` 覆盖纯 Esc 策略与名单匹配（先失败后通过）；`crates/client-core` 的 `Preferences` 校验与序列化单测；`packages/ui` 的名单段落单测。

## Risks

- **插桩点顺序。** Esc 同时是取消组字的键。判定必须在「这次 Esc 会交给应用」成立之后，否则组字中的 Esc 会既丢组字又切模式。Windows 用 `eaten` + `compositionActive` 两个入参分开表达，macOS 要用同一份组字判据，不能只看一个字段。
- **`setEnglishInputMode:` 的副作用。** 它会取消正在编辑的组字（`commits_on_blur` 方案除外），所以在有组字时宁可不调用；这也是触发条件里必须先排除组字的原因。
- **大小写与规范化。** 共享设置页按用户键入的文字写标识，精确下标会让 `com.apple.terminal` 这类规则永远不命中；查询和去重都要走 `InputModeRuleKeyForIdentifier` 同款 ASCII 不分大小写规范化。
- **契约变更的跨平台影响。** 新增字段必须 `skip_serializing_if` 缺省、旧版本忽略；新版本写空的键不能清掉别的设备已有的名单，合并策略沿用应用例外。真正落地前需要维护者确认标识语义、上限和是否同批迁 Windows。
