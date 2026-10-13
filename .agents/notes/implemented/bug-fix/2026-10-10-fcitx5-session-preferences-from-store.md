# Agent Note: Fcitx5 新会话以偏好存储为准，托盘的选择不再被 runtime options 改回

Status: implemented

## Problem

#6540 的排查里发现：Fcitx5 托盘上选的皮肤，切到另一个程序后又变回原来的。

状态栏（托盘）的选择只写偏好存储（`savePreference`，`FcitxEngine.cpp`）。runtime options 文件只有设置页保存（`sync_runtime_options`）、MCP 发布和首次准备时才重写，托盘选择不会碰它。`FcitxState::ensure()` 新建会话时却以 runtime options 里的 `preferences` 为底，只从存储取回方案、双拼方案、全半角和辅助码这几项（#618）。其余选择——主题菜单（`global_theme`、`custom_theme`）、候选窗明暗（`candidate_theme`）、候选布局（`candidate_layout`）、云候选、AI 候选、学习、翻译、标点、模式范围和其他开关——在下一个新会话都回到文件里的旧值。

这个错不会自己纠正。`ensure()` 记下的 `preferences_snapshot_` 就是刚从存储读到的那份，下一拍 `refreshPreferences()` 读到同一份存储，`snapshot != preferences_snapshot_` 不成立，不会把存储重新应用到会话上。主题还会写进 classicui：菜单已经把这次选择记成已见（`candidate_theme_selection_`），新会话的 `chosen` 为 false，但它的主题输入和 `candidate_theme_applied_` 不同，而 `Theme=msime` 又可替换，于是 `applyCandidatePanelTheme` 用文件里的旧主题重写 `theme.conf`。设置页只写了存储、还没发布 runtime options 的那一刻返回输入框，也是同样的结果。

宿主自己另存一份的几项还有第二层同样的问题。`ensure()` 在换成存储之前，就按 runtime options 的偏好算好了 `traditional_`、`chinese_punctuation_`、`paired_punctuation_`、`smart_punctuation_*`、`punctuation_lock_`、模式快捷键开关、`default_ime_mode`（`restoreInputMode` 也读 `ime_mode_scope`）、`navigation_` 和 `word_character_*`，之后只重算语音几项。所以只把 `preferences_` 换成存储还不够：托盘切的繁体、中文标点、成对标点、标点锁定和以词定字，在新会话里 `preferences_` 是对的，宿主的副本却仍是文件值，繁体转换、标点处理和菜单勾选都按这份副本走；下一拍同样因为快照相同而不重算。中文标点更直接：会话按存储建好以后，`syncSessionChinesePunctuation()` 又把文件里的值推回会话。成对标点则从「两边都是文件值」变成 Engine 用存储值、宿主副本和菜单勾选用文件值，第一次点菜单只是把 Engine 已有的值再发一遍。

还有两处单独的遗漏，问题相同：托盘的以词定字（`toggleWordCharacter`）只改了 `preferences_` 和本地快照，没改按键处理读的 `word_character_enabled_`；智能标点和重复标点回切中文走 `toggleTopLevelBoolean`，也没改 `smart_punctuation_`、`smart_punctuation_repeat_`。本地快照已经改好，下一拍读到的存储与它相同，不会重算，所以菜单勾掉之后，当前会话里仍然照旧以词定字、照旧替换标点，要等下一个新会话才生效（修正读取顺序之前，新会话也不生效，要等设置页重写 runtime options）。

隐私相关的开关后果更重：用户在托盘里关掉云候选或 AI 候选，换个程序打字时它们又按文件里的值打开。

`fcitx5-candidate-theme-priority` 原有的设置页返回用例只断言 `Theme == msime`，没有看写进去的是哪套颜色，所以 `publish_options=false` 那一轮画着 runtime options 里的旧主题也照样通过。

## Decision

- 存储有文件时（`msime_client_load_preferences` 返回的修订号大于 0），`ensure()` 以整份存储的 `preferences` 为底建会话，与 `refreshPreferences()` 每一拍和各个菜单动作（它们都把存储快照整份交给 `msime_client_update_preferences`）一致。之后照旧 `expireContextOverrides(stored)`、`applyContextOverrides`，私密上下文照旧关掉学习、云候选和 AI。
- 存储里还没有文件时（修订号 0），读到的只是版本缺省值，没有哪一项是状态栏选过的，仍以 runtime options 为底。方案、双拼方案、全半角、辅助码方案和辅助码包这几项沿用 #618 的规则，不论修订号都从存储取；有存储文件时它们已经在底里，这几行只是原样再写一遍。
- `ensure()` 先读存储、定下这次会话的那一份偏好（含上面两条规则和 `expireContextOverrides`），再一次性赋给 `preferences_`、套上 `applyContextOverrides`，宿主自存的各项都从这一份读。为此 `options_path_` 的赋值和失败保存重试的清理也挪到读存储之前，内容不变。`default_ime_mode` 仍然每个输入上下文只用一次，规则不变。读存储失败时整份仍用 runtime options，与原来一样。
- `toggleWordCharacter` 同时更新 `word_character_enabled_`，`toggleTopLevelBoolean` 改完偏好后按它重读两项智能标点，与繁体、标点等托盘动作直接改宿主副本的做法一致。
- 交给会话的这份偏好去掉 `custom_theme.keyboard.photo`。照片只给屏幕键盘用，Fcitx5 不画屏幕键盘；设置页发布 runtime options 时同样去掉它（`apps/desktop/src-tauri/src/lib.rs` 的 `sync_runtime_options`，`crates/mcp-server/src/preferences.rs` 同理）。存储文档上限是 1 MiB（`MAX_DOCUMENT_BYTES`），`msime_client_create` 的整份选项上限也是 1 MiB（`HOST_OPTIONS_DOCUMENT_LIMIT`），带着照片再加上路径等字段可能超限，会话就建不起来。`preferences_snapshot_` 仍保留原样，菜单与偏好刷新照旧以完整的存储文档比较和保存。

### IBus 宿主

IBus 宿主没有这个持久的回退。它的 `configured` 是引擎级的一份，菜单保存成功后 `configured["preferences"]` 换成存储里的偏好（`ClientEngine.cpp` 的菜单保存回调），新会话从 `configured` 建立；`configured` 只在 runtime options 文件内容变了时才被 `msime_ibus_configure` 整份替换。即使别的写入者改了文件、把旧偏好带了回来，有焦点时每一拍的存储读取也会把 `configured["preferences"]` 换回存储并调用 `apply_live_preferences`，这一步不以「与上次不同」为条件，所以最多旧一拍。这次不改 IBus。

## Alternatives considered

- **只补主题相关的几项（`global_theme`、`custom_theme`、`candidate_theme`、`candidate_layout`）** — 改动面最小，正好覆盖 #6540 报的皮肤问题，其余开关不受影响。不用它，是因为同一个回退还作用在二十来个托盘开关上，其中包括云候选和 AI 候选这种关掉后不该自己打开的项；只补主题等于明知同类问题还在而留着它。而且每加一个托盘动作都要记得再登记一次，漏一个就是同样的 bug。
- **按托盘实际会写的键列一张清单，只把清单里的键从存储取** — 比整份替换保守：runtime options 里有、存储里却不同的值（如果真有这种部署）仍然生效。不用它，是因为生产环境里 runtime options 的 `preferences` 要么是存储的副本（设置页的 `sync_runtime_options`、MCP 发布，以及带 `--cloud-candidates`/`--no-cloud-candidates` 的 `msime-linux-prepare` 都是先写存储再抄过去），要么是还没有存储文件时的缺省值（修订号 0，仍按文件走），文件比存储新的情形并不存在；清单还得跟托盘动作逐项同步，菜单、刷新和新会话三条路径会各有一套「以谁为准」。
- **换成存储之后，把宿主自存的各项再算一遍** — 改动只是在读存储的分支末尾补一段。不用它，是因为那样同一组字段要算两次，先按文件、再按存储，新加一项时两处都要记得写，漏写的一处就是这次的错；而且 `restoreInputMode` 的启动模式已经在第一次按文件定下，再算一次就得处理「每个上下文只定一次」的状态。先定下偏好、再统一读，只有一处。
- **托盘每次保存后也重写 runtime options** — 能让文件一直跟得上存储，IBus 和 Fcitx5 的建会话路径都不用改。不用它，是因为 runtime options 只能由一个写入者整份重写（还带着皮肤目录和 16 KiB 的上限，`LINUX_RUNTIME_OPTIONS_LIMIT`），插件在 Fcitx5 进程里改写它会和设置页、MCP 发布、升级刷新争同一个文件；而且建会话时本来就读了存储，用它比再维护一份副本简单。

## Consequences

- **收益**：托盘上的每一项选择在换程序、新建会话后都保持；设置页只写了存储时返回输入框画的也是存储里的主题。新会话的偏好与每一拍、菜单动作用的是同一份，Fcitx5 与 IBus 在这件事上行为一致。
- **代价**：存储有文件时，runtime options 里的 `preferences` 对 Fcitx5 新会话不再起作用。`msime_client_prepare_host` 准备状态目录时就写下第一份偏好文件，所以装好之后存储总是有文件的，只改 runtime options、不改存储的做法从此不生效。这种做法只在测试夹具里有：`native.cpp` 主流程的初始偏好与翻译、注音几段，以及 `daemon.py` 的页码用例，都改成像设置页那样先写存储、再写文件（`settingsPageSaves`、`publish()`）。主流程里「焦点回来新建会话仍是纵向」的断言原本断言的正是旧行为（存储里已是热加载的横向），改为断言新会话保留存储里的横向，再从托盘切回纵向，旧候选页保留布局快照的断言不变。
- **已知上限**：键盘照片之外，存储文档的其余部分本身就受 1 MiB 上限约束，正常偏好远小于它；如果将来存储里再加入大字段，需要在这里一并去掉。
- **重访信号**：如果 runtime options 将来承载存储里没有的偏好，或者有了比存储更新的写入者，就要回到按键清单的做法。

## Verification

`platforms/linux/fcitx5/tests/native.cpp::candidateThemePriority`（`ctest -R '^fcitx5-candidate-theme-priority$'`，真实 classicui、真实 Host API 与偏好存储）新增三段断言：

- 设置页返回的两轮里，新会话写出的 `theme.conf` 与存储里 ink、paper 两套主题先前写出的文件按字节相同。
- 托盘主题菜单选 ink 后，另一个新会话的 `preferences_["global_theme"]` 是 ink，主题菜单勾选 ink，`theme.conf` 不变；再在托盘切候选布局、候选窗明暗和云候选，第三个新会话里这四项都保持，`theme.conf` 也不变。
- 同一个托盘窗口里再切繁体、中文标点、成对标点、智能标点、以词定字和标点锁定：当前会话的宿主副本立即跟上；第三个新会话里 `traditional_`、`chinese_punctuation_`、交给会话的中文标点（`session_chinese_punctuation_`）、`paired_punctuation_`、`smart_punctuation_`、`word_character_enabled_`、`punctuation_lock_` 都是托盘选的值，繁体、中文标点、成对标点、智能标点四个菜单项的勾选也一致。
- 存储里带一张合成的 1x1 PNG 键盘照片时，新会话的 `preferences_` 和交给 `msime_client_create` 的选项里没有它，`preferences_snapshot_` 里有。

修复前在同一个门禁镜像（`Dockerfile.build-gate`，Debian bookworm）里分别跑出三处失败：设置页返回一轮停在「设置页保存后的新会话按存储里的主题写主题文件」；去掉这条后停在「新会话的偏好是托盘选的 ink」；再去掉主题断言后停在云候选那一项。第二轮补上宿主副本的断言后，用只换了存储底、没调整读取顺序的那一版（另补上以词定字和智能标点那几行，免得先停在当前会话那条）再跑：停在「新会话的繁体输出和菜单勾选跟随托盘的选择」；去掉这条后停在「新会话的中文标点、交给会话的标点和菜单勾选跟随托盘的选择」。更早一轮测试还没有智能标点这一项、引擎也没补以词定字那一行时，停在「托盘的繁体、标点和以词定字选择在当前会话生效」；智能标点那一行没有单独跑过修复前的红灯。修复后两项主题测试都通过，`bash platforms/linux/build-container.sh` 全部 79 项通过。

需要已验证词库的 Fcitx5 验收（`fcitx5-native-context`、`fcitx5-native-ai`、`fcitx5-local-mode-shortcuts`、`fcitx5-daemon-frontend`、`fcitx5-page-number-visibility`、`fcitx5-gtk-editor`，`Dockerfile.fcitx5` 镜像，词库由 `install_resources` 按锁取回）全部通过。改夹具之前，前三项停在「initial voice context reads the hold-to-lock preference」，页码用例停在「Hidden page/preedit left an auxiliary line」，都是只改了 runtime options 的偏好没有进存储。这几项不在 PR 的 CI 里，只在 Mac Studio 上用 `rbuild` 跑过，第二轮改完后在最终的代码上又跑了一遍。
