# Agent Note: iOS 键盘诊断日志记内存读数，内存警告在组字中把清引擎缓存推迟到组字结束

Status: implemented

## Problem

#6685：iPadOS 27.2 上键盘一加载就收到 `memory_warning`，随后进程消失、2–3 秒后换了新 pid，日志里从来没有 `focus_out`。日志只有事件名，看不出进程占了多少内存、离上限还有多远、是引擎还是界面占的，所以分不清是我们自己超限，还是低内存 iPad 上的全系统压力，也定不了该减哪一块。

#6706 加的内存警告处理里有一处与它自己的意图相悖：`session.resetCache()` 返回的快照被丢掉了。引擎的 `reset_cache` 末尾会为当前组字重查候选（`crates/engine/src/ime/mod.rs` 的 `refresh_candidates`），快照才是此后点选序号所对应的列表；唯一的另一个调用方「清除候选缓存」（`resetCandidateCache`）会把它画出来。

## Decision

诊断日志带进程内存读数：

- `SharedUI/core/DiagnosticLog.swift` 的 `DiagnosticLog.MemorySample` 读 `task_vm_info.phys_footprint`（系统判断扩展是否超限时用的数）和 `os_proc_available_memory()`（离上限的余量，与 `task_vm_info.limit_bytes_remaining` 同值），`fields` 写成 `mem=<MiB> avail=<MiB>`，向下取整到 MiB。按 iOS 27.0 SDK 的 `os/proc.h`，调用方「不是 App」或已经超出上限时这个函数返回 0，模拟器上也是 0；键盘扩展在真机上算不算「App」没有实测过。所以原始值为 0 时写成 `avail=-`（系统没给出余量），与余量不足 1 MiB 时取整得到的 `avail=0` 分开，0 不被读成「没有上限」或「已经超限」中的任何一种。日志仍只有固定事件名加数字，经 `sanitize` 截到 192 字节的可打印 ASCII。
- `KeyboardViewController` 的 `launchMemory` 紧挨在 `session` 上面声明，在建引擎会话之前读一次；紧跟 `session` 声明的 `sessionMemory` 在会话刚建好时读一次。Swift 按声明顺序初始化存储属性，这两个位置就是它们的意义：两者之差只有引擎会话，排在前面的皮肤背景视图和读 App Group 的键盘高度算进 `base`。挪动顺序会让 `base=`、`session=` 失去含义。
- 带读数的行：`keyboard_loaded … base= session= mem= avail=`（`mem` 在 `viewDidLoad` 开头读）、`keyboard_built`（`viewDidLoad` 末尾）、`keyboard_shown`（`viewDidAppear`，第一帧已画出，位图缓冲已分配）、`focus_in`、`preferences_applied`、`memory_warning`（释放前）、`memory_released`（释放后，带 `engine_cache=reset` 或 `engine_cache=deferred`）和推迟的那次清缓存之后的 `engine_cache_reset`。原有行的前缀不变，仓库里没有解析这些行的代码。
- `platforms/ios/README.md` 的诊断日志段和 App「诊断日志」页的说明同步写明记录内存读数。

内存警告处理没有组字时当场调用 `session.resetCache()` 并丢掉快照：这时引擎没有候选，候选条上的英文联想和手写结果不归引擎管，快照里没有要画的东西。组字中只把 `engineCacheResetPending` 置上，组字、候选条和引擎的列表都保持原样；`render` 看到组字结束（`hasComposition` 变成 false，上屏或取消都经过这里）时调用 `releaseDeferredEngineCache()` 补清一次，理由与空闲时相同。这样长句组字攒下的缓存不会一直留到下一次空闲时的警告。

`snapshotWorker` 和 `onlineCandidates` 仍是 `lazy`，内存警告处理照旧调用它们的 `stop()`、`cancel()`。

## 实测（2026-10-10，iOS 27.0 的 13 英寸 iPad Pro（M5）模拟器，`pad` idiom，冷进程，`phys_footprint`）

| 阶段 | 增量 |
|---|---|
| 测试宿主基线加 `session` 之前的存储属性（`base`） | 约 15 MiB |
| 建引擎会话（`base` → `session`） | 5–6 MiB |
| `session` 之后的存储属性与 `loadView` | 0–1 MiB |
| 建键盘界面（→ `keyboard_built`） | 7–8 MiB |
| 1032 pt 宽画第一帧（→ `keyboard_shown`） | 约 6 MiB |
| 合计到出现 | 约 19–20 MiB |

`base` 起初是第一个存储属性，排在皮肤背景视图和键盘高度之前；挪到紧挨 `session` 之后再冷跑三次，各段数字不变（15 → 21 → 21 → 28 → 34 MiB），前面那几个属性不到 1 MiB。另测：单独的会话打 `nihao` 再增 4.4 MiB，接着打 `zhonghuarenmingongheguo` 再增 6.5 MiB；没有组字时收到内存警告，`phys_footprint` 当场不变。测试宿主默认只声明 iPhone，在 iPad 模拟器上以兼容模式跑、idiom 是 `phone`，测 iPad 时在命令行加 `TARGETED_DEVICE_FAMILY=1,2`。

模拟器的数不是真机的数：模拟器上 `avail` 写成 `-`；真机包静态链接的 ML Kit 不在模拟器构建里；内存页和位图缓冲的记账方式也与设备不同。这张表只说明各段的比例，真正的上限和超限与否要等用户的下一份日志。

## Alternatives considered

- **内存警告时照「清除候选缓存」那样把快照画出来** — 最直接守住「候选条就是引擎的列表」，组字中也能把引擎缓存清掉。但它在内存最紧的时候重查一遍词图、重置候选条的翻页和滚动，候选在手指下跳一次，`render` 末尾还会重新安排在线候选请求，与警告处理里刚做的 `onlineCandidates.cancel()` 相抵。组字中的缓存多半正是这次组字要用的行，清掉马上又查回来，省不下多少。
- **组字中收到警告就不清，也不补清** — 本篇最初的写法。实测清缓存当场只省 1.4 MiB 左右，但长句组字能让引擎多占 6.5 MiB；警告恰好落在组字中时，这些缓存会一直留到下一次空闲时的警告，而在被结束之前未必还有下一次。组字结束时补清一次只多一个标志位，没有重画和重查的代价。
- **组字中照旧清缓存、丢掉快照（#6706 的写法）** — 实测在全拼（`nihao`、`woxiangqubeijingkankan`、`nimingtianyoukongma`、`nihoa` 等）和九键（含 18 位长串）上清缓存前后前 20 个候选完全一样，所以实际很少出错。但一致只是重查碰巧排出同样的结果：九键在按键之间沿用上次的切分种子（#6681），缓存、种子和个人模型的状态任一处让重查结果不同，候选条就和引擎对不上，点一下选中另一个词。用一个条件把这种可能整个去掉，比依赖重查的确定性更稳。
- **把 `snapshotWorker` 改成可选存储，内存警告时不去创建它** — triage 的建议。`DictionarySnapshotWorker` 的构造只存几个引用、取一次 App Group 路径，几百字节；它在紧接着的 `viewDidAppear` 里本来就会被创建。省下的量测不出来，不值得为它加一层可选包装。`onlineCandidates` 更是在 `viewWillAppear` 里就被 `cancel()` 创建出来，同样不改。
- **在 `viewDidLoad` 第一行读基线，不加存储属性** — 改动最少。但那时引擎会话（存储属性）已经建好，基线里就含了引擎，分不出引擎和 UIKit 本身的开销；而日志在 `configureDiagnosticLog` 之前写不出去，读数只能先存起来，所以用最早初始化的存储属性。

## Consequences

- **收益**：用户开着诊断日志再遇到一次闪退，日志就能说明进程占了多少、是引擎、界面还是第一帧占的。真机上 `avail` 是数字时，它接近 0 说明自身快到上限，还很大说明是系统整体压力；它是 `-` 时说明扩展拿不到余量（或已超限），这时只能拿 `mem` 和 JetsamEvent 里的上限对照，不能单凭这一项下结论。`memory_released` 的 `engine_cache=` 和 `engine_cache_reset` 一行说明每次警告后引擎缓存是什么时候清的。内存警告不再可能让候选条和引擎的列表脱节，也不在组字中重查词图。
- **代价与已知上限**：组字中收到内存警告时，引擎缓存要等这次组字结束才清；用户一直不上屏也不取消，就一直不清。`memory_released` 是释放后立刻读的，malloc 未必已经把页还给系统，它偏高，只能看趋势。模拟器上的启动占用回归测试（`KeyboardMemoryTests.testKeyboardLaunchFootprintIsLoggedPerStage`，上限 60 MiB）只拦突然翻倍那种回归。真机日志显示自身超限且某一段明显偏大时，按那一段去减（引擎会话、隐藏布局懒加载、`KeyboardSkinBackgroundView` 的位图缓冲），并重访这篇。

## Verification

- `MSIMEKeyboardTests/KeyboardMemoryTests`：读数字段的取整、`avail=-` 与 `avail=0` 的区分、最长一行不被截断；组字中收到内存警告后读音和候选条不变，选词上屏（推迟的清缓存在这时补上）后接着打字照常；没有组字时收到警告后照常组字；开着诊断日志先空闲时警告一次、组字中再警告一次、上屏，日志里依次是 `engine_cache=reset`、`engine_cache=deferred` 和上屏后的一行 `engine_cache_reset`，`memory_warning`、`memory_released`、`engine_cache_reset` 都带读数；开着诊断日志建、画、显示一次键盘，`keyboard_loaded`、`keyboard_built`、`keyboard_shown`、`focus_in` 各行带上读数，并打印各段增量。
- 区分新旧行为的只有看日志的那一条：组字中警告后读音和候选条不变那一条在 #6706 的写法上同样通过（控制器没有能让候选条和引擎分叉的注入点，实测重查也排出同样的列表），它守的是组字不被打断，证明不了旧问题。去掉 `render` 里补清的那一行，看日志的那一条失败。
- 测 iPad 冷进程：`xcodebuild test -project platforms/ios/MSIMEClient.xcodeproj -scheme MSIMEClientTests -destination "platform=iOS Simulator,id=<iPad 设备>" -derivedDataPath target/ios/derived-tests CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=YES TARGETED_DEVICE_FAMILY=1,2 -only-testing:MSIMEKeyboardTests/KeyboardMemoryTests/testKeyboardLaunchFootprintIsLoggedPerStage`，看输出里的 `keyboard launch footprint` 一行。
