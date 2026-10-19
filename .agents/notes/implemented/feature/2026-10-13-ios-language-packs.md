# Agent Note: iOS 语言词库按需下载

Status: implemented

## Problem

iOS full 仍把日语词典和粤拼、注音、笔画词库打进键盘扩展，约 86 MB 附加数据；Android 已使用共享资源包的按需安装。

## Decision

主应用复用 host-api 的 resource-packs 接口，装入 App Group 的共享状态目录；只在用户添加语言或点下载时联网，显示大小、进度、取消、重试，对计费或受限网络先提示。共享层使用固定大小与 SHA-256 校验后原子发布，键盘只读取已发布资源，下次取得焦点重读可用方案。full/拼音的发布构建省略日语与附加语言词库，开发构建仍可完整暂存。日文独立版本继续带主词库。运行时据以放行瘦包的规则是 client-core 的 `on_demand_artifacts`：它的目标列表必须包含 `ios`，否则 host-api 按完整清单校验键盘扩展的 `EngineResources`，发布包一启动就以 `ExistingGeneration`（缺日文词典那三个文件）报「输入运行时准备失败」。

每次下载由 `IOSResourcePackDownload` 保存取消意图；主线程发布运行状态前先保存该对象。启动前取消不调用安装器，进入安装器但尚未登记的取消在首次进度时补发。共享 C ABI 在任务登记后、文件或网络 I/O 前同步发送已有 `download` / `import` 阶段的 0 字节进度，并立即检查取消标记，不增加协议字段。取消入口仅设置标记且不调用进度回调，Swift 用同一把锁串行化取消转发和结束标记；安装器和外部进度回调均在锁外运行。Store 等真实任务退出后才允许重试，每次新建下载对象，旧进度还需对象身份一致才能写状态。

## Alternatives considered

- 只从安装包删词库：立刻省空间，但用户无法添加语言，必须同时接上下载和键盘可用性。
- 在键盘扩展联网下载：操作更直接，但延长键盘进程寿命、要求完全访问且放大内存压力；下载交给主应用。
- Swift 另写下载和校验：平台实现灵活，但会重复 Android 与共享层已有资源锁和原子发布，复用 C ABI。
- 仅调用 `Task.cancel()` 或一次共享取消：接入简单，但 Swift Task 的取消不会自动中止阻塞 C ABI，且共享取消对尚未登记的任务无效。
- 只在后续进度补发取消：无需修改共享契约，但首次进度可能晚于阻塞网络读取，无法覆盖开始阶段；明确登记后、I/O 前的初始回调。

## Consequences

真机 Release `.app` 解压体积由约 340 MB 降至 254 MB；日语、粤拼、注音、笔画数据库均不内嵌。新增资源包单测 4 项通过，模拟器和真机原生构建通过，暂存脚本与本地 quick 通过。联网下载到系统键盘的最终真机验收另行记录，不以构建成功替代。最初落地时 `on_demand_artifacts` 只列 macOS 和 Android，本地和开发构建都完整暂存，所以没有一项验证走到瘦包的运行时校验；发布包装上后键盘无法启动，补上 `ios` 后由 `the_platform_shipping_rule_decides_whether_a_slim_bundle_prepares` 覆盖。验证瘦包要用 `MSIME_IOS_OMIT_ON_DEMAND=1` 暂存后装机，完整暂存的构建证明不了它。

缺词库的语言可以添加，但下载完成前不会切换键盘。App Group 与键盘扩展生命周期不同，取得焦点时刷新资源可用性。iOS 内嵌动态运行库继续随包，当前范围只拆词库。首次下载需要网络；取消和失败均保留重试入口。

取消回归用 `scripts/test-ios-resource-pack-cancellation.py` 编译真实 Store 和下载对象，以条件同步覆盖启动前、登记前和已登记三种取消时序，并逐次验证重试不会复用取消标记；带边界替身的 CLI 源从原生共享测试目标排除。Rust 回归通过真实 C ABI 在首次 `download` / `import` 回调重入取消，断言未创建资源目录且登记已释放。旧实现的启动前、登记前 Store 回归及 C ABI 导入回归均先失败，修复后通过。iOS 27 干净模拟器的 `IOSResourcePackTests` 6 项通过，包含真实桥接的首次回调取消和启动前取消；`MSIMEApp` 模拟器原生构建和本地 quick 通过。

## Related notes audit

检索现有 resource、dictionary、pack 和按需笔记：共享资源读写/发布边界相关，沿用实现；Android 语音资源导入部分重叠但本任务不涉及语音运行库；没有已有 iOS 词库下载决策。
