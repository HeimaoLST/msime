# Agent Note: Android 候选栏读取外部候选皮肤配色

Status: implemented

## Problem

Android 的 `KeyboardSkin.themeRequest` 不传皮肤目录，候选栏也一直取触屏键盘的配色。共享 catalog 能解析皮肤包并不意味着 Android 会画出包的候选颜色。直接给现有主线程解析请求加目录，会把清单与资源校验放到输入线程。

## Decision

`CandidateSkinResolver` 在现有偏好工作线程上，通过共享 `resolveTheme` 从偏好目录下的 `skins/` 读取当前主题的浅、深两份候选配色。主线程仅消费与当前主题请求一致的不可变结果。只在共享解析器确认 `candidate_skin` 实际生效时覆盖候选栏，键盘仍按自己的配色绘制。包删除、文件损坏或不支持当前模式、横排时恢复现有候选栏。

相关笔记审计：[明暗槽位](../feature/2026-10-09-candidate-skin-light-dark-slots.md)部分重叠，沿用共享槽位规则；[启动候选配色](../bug-fix/2026-10-08-android-candidate-strip-startup-palette.md)部分重叠，保留实时偏好优先于旧副本的决定；Windows schema 对齐归原 PR 的笔记，本切片不修改并行工作区。

## Alternatives considered

- **在主线程的 `themeSkin` 加 `skins_directory`**：可直接复用键盘缓存，但包资源验证可能读取与解码图片，不能放到按键和候选绘制路径。
- **仅按清单修改时间缓存**：稳定包可以免去反复校验，但替换或删除资源而不改清单时仍会保留失效配色。先沿用每秒偏好重读，最多解析选中的两个槽位，不在 Java 复制资源依赖和安全规则。
- **把候选包颜色写入键盘配色**：现有候选按钮立即受益，但会同时改变触屏按键，混淆两套皮肤契约。

## Verification

`check-host.sh` 的 248 项 JVM 冒烟及 164 个设备套件源文件编译通过。`CandidateAppearanceSmoke` 覆盖共享契约的末尾透明度、选中填充与文字、编号、释义和原有字体回退；`CandidateSkinDeviceSmoke` 在 API 28、35 的独占模拟器上通过产品 JNI 读取合成私有目录，覆盖明暗槽位、横排限制、清单更新、资源删除和非法包回退，并在实际候选按钮取样验证颜色与键盘不被重染。原生完整版本 APK 的精简资源构建及完整资源构建均通过。

两版模拟器上的共享 Rust 设备测试分别通过 `client-base` 36 项、`client-core` 399 项、`client-providers` 222 项和 `client-services` 1072 项。完整资源 APK 在 API 28 的 `smoke.sh --core` 出现最终成功标记。精简资源包的首轮冒烟缺少笔画键面；完整资源重跑通过数字键盘全部用例，API 35 首轮逐键测量的同行坐标差 1 像素也未再复现。

API 35 默认冒烟首轮在 `NineKeyPanelDeviceSmoke` 继承英文状态后失败；用例通过真实语言键建立中文前置条件后，按原来的相邻顺序重跑英文纠错、九键面板、全拼分词和十四键均通过，理由归[九键展开面板笔记](../feature/2026-10-08-nine-key-expanded-panel.md)。剩余默认套件分段运行，除 `TextEditRecentClipboardDeviceSmoke` 的 `editor return shortcut` 外均通过，剪贴板保存生命周期也通过。对照包从 PR 原始提交 `5b781064c4` 恢复 Android 宿主源码，并排除新增解析类；它在同一套 `ClipboardImageDeviceSmoke` → `TextEditRecentClipboardDeviceSmoke` 顺序上复现相同失败。该断言的原因仍待独立处理，API 35 完整默认冒烟保留未通过状态。

编译机镜像的 `verify-local.sh --quick` 通过，包含 Android、Wasm、macOS 原生宿主与共享 Apple 桥；Linux、Windows 和 HarmonyOS 阶段因该机器的工具链条件跳过。本机另已完成 Windows x64 交叉链接和 Tauri 检查、Linux 设置壳构建与原生宿主的 90 项测试，但本机 quick 整体因磁盘耗尽失败，不能将那次运行记为通过。`verify-notes` 与 `git diff --check` 通过。

## Consequences

候选包的颜色能进入候选条与展开网格，键盘的既有外观不变。共享颜色使用 `#RRGGBBAA`，通过 `ColorPolicy.contractArgb` 转成 Android ARGB，不能交给普通 `parseHex`。

周期校验会增加偏好工作线程的 I/O，受共享解析器现有资源预算限制；本切片只接入候选配色，不提供九宫格、自由挂件和动画绘制，也不增加安装或社区入口，不能据此宣称全平台视觉兼容完成。
