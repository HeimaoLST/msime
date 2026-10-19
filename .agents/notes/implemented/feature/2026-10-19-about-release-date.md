# Agent Note: 全平台关于页显示发布日期

Status: implemented

## Problem

六个平台的关于页只显示版本号，用户和维护者看不出手上的安装包是哪天发的。仓库里也没有任何地方记录发布日期：`platforms/<os>/version.txt` 只有版本号，tag 在构建之后才打，构建时拿不到。

## Decision

发布日期在构建时确定，格式固定为 `YYYY-MM-DD`，按以下顺序取第一个可用的来源：环境变量 `MSIME_RELEASE_DATE`；与 `version.txt` 同目录的 `platforms/<os>/release-date.txt`（只出现在源码包里，已加入 `.gitignore`）；构建所在源码树 `git log -1 --format=%cs` 的提交日期；都没有时不显示日期。前两种来源格式不对时构建直接失败，因为它们只由发版脚本写入，悄悄丢掉会发出一个没有日期的包；git 取不到或格式不对时只当作没有日期。发版工作流都从 main 上的发版合并提交构建，所以第三种来源就是发版当天，不需要任何人手工填写。

关于页统一显示为 `v0.53.0（2026-10-19 发布）`，各平台保留原有的前后缀（Android `版本 X（日期 发布） · Android`，iOS 把原来括号里的构建号挪到 `· 构建 N ·`）。反馈、更新检查、遥测和诊断里上报的 `app_version` 仍是纯版本号，服务端契约不变。

各平台的接入点：

- 共享设置界面（macOS、Linux 的 Tauri 设置应用和 HarmonyOS 网页设置）：`SettingsClient.readAppReleaseDate`，由 `use-app-release-date.ts` 校验后交给关于页、HarmonyOS 关于页头图和系统信息里的「应用版本」行。Tauri 由 `apps/desktop/src-tauri/build.rs` 写入 `MSIME_APP_RELEASE_DATE`（与输入变量名分开，避免 cargo 每次都重编），经 `app_release_date` 命令返回；git 只在顶层目录就是本源码树时使用，免得解压在别的仓库里的源码包读到那个仓库的日期。
- HarmonyOS：`entry/hvigorfile.ts` 把日期写进生成的 `BuildProfile.RELEASE_DATE`，`Settings.ets` 用桥方法 `appReleaseDate` 交给网页。
- Windows：`MSIME.Settings.vcxproj` 在编译前算出 `MSIME_WINDOWS_RELEASE_DATE`，只用在关于页的「当前版本」行。
- iOS：`scripts/stamp-release-date.sh` 作为 MSIMEApp 的构建后脚本，把 `MSIMEReleaseDate` 写进产物的 Info.plist；`project.yml` 与 `project.pbxproj` 同步，并显式关闭脚本沙盒，防止「更新到推荐设置」后 git 被挡住、日期悄悄消失。
- Android：`build.gradle.kts` 写入 `BuildConfig.RELEASE_DATE`，`AppVersionPolicy` 用反射读取，与 `AppEdition` 读 `EDITION` 的做法一致，`check-host.sh` 的 javac 直编路径因此不需要生成的 BuildConfig。
- Linux 打包：容器里的 git 读不到挂载的检出，`package-container.sh` 在宿主机算好日期后用 `-e MSIME_RELEASE_DATE` 传进去；`make-source-tarballs.sh` 把 `release-date.txt` 写进源码包和前端包，覆盖 Debian、RPM 与 Gentoo；AUR 包由 `render.py` 写入 `_releasedate` 并在 `build()` 里传入。

## Alternatives considered

- **在版本号 PR 里手工维护 `release-date.txt`**：所有构建方式都能直接读到，但写入的是计划发版日；发版推迟或忘了改，显示的日期就是错的，而且每次发版多一个人工步骤，因此不采用。源码包仍借用同名文件兜底，那是脚本在打包时写入的，不需要人记。
- **构建当天的日期**：实现最简单，但同一个提交在不同日子构建会得到不同结果，不可复现，开发构建也会显示一个与代码无关的日期，因此不采用。
- **`$Format:%cs$` 占位文件配合 `export-subst`**：只对 `git archive` 生效，GitHub 的 tag 压缩包和容器挂载路径都覆盖不到，仍要另外处理，因此不采用。
- **Nix 通过 flake 的 `lastModifiedDate` 传入**：可行，但要改 `flake.nix` 与 `default.nix` 的接口，本次先不做；Nix 构建按契约不显示日期。

## Consequences

开发构建显示的是最后一次提交的日期，不是发版日；只有从 main 发版提交构建的正式包，这个日期才等于发布日期。Nix 构建和不带 `.git` 又没传环境变量的构建不显示日期，关于页退回原来的样子。macOS 原生的 SupportWindowController 与外观偏好里的版本兜底文案没有加日期，它们只在设置应用起不来时使用，而 `docs/ARCHITECTURE.md` 已经冻结了这部分原生界面。

验证：`apps/desktop` 下 `npx tsc --noEmit` 与 `npx vitest run`（761 个文件、4614 项）、`apps/harmony` 类型检查、`bash platforms/harmony/tests/run.sh`、`python3 scripts/test-harmony-bridge-parity.py`、`python3 platforms/ios/tests/settings/ProjectConfigurationTests.py`（25 项）、`bash platforms/android/check-host.sh`（249 项 JVM 冒烟）、Linux 打包的三个 Python 校验，以及在 Studio 上经 rbuild 跑的 `cargo clippy -p msime-desktop --all-targets -- -D warnings` 和 `cargo test -p msime-desktop --lib`（255 项），`MSIME_RELEASE_DATE=2026-13-01` 时构建按预期失败。Windows 设置工程、iOS 完整 xcodebuild、HarmonyOS 完整 HAP 和 Android Gradle 构建交给 PR 上的平台 CI；Windows 的 git 兜底经 MSBuild `Exec` 走 cmd 批处理，格式串写成 `%25%25cs`，需在 CI 日志里核对 `MSIME_WINDOWS_RELEASE_DATE` 的实际值。
