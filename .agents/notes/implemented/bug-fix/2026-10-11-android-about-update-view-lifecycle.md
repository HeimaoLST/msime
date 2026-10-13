# Agent Note: Android 关于页更新状态生命周期

Status: implemented

## Problem

`AboutPage` 把检查更新和下载结果限制在发起它的视图；离开页面时旧网络回调会因视图代际变化被丢弃。`onDestroyView()` 原本只取消下载线程，却保留 `CHECKING` 或 `DOWNLOADING` 状态。页面重建后按钮因此一直显示忙碌并禁用，而已经没有任务能把状态改回可重试。

## Decision

销毁视图时取消下载任务后，若状态仍是检查或下载中，就重置为 `IDLE` 并清除未完成的安装文件引用。完成或可安装状态不受影响，用户返回页面后仍可继续安装已经校验完成的 APK。

## Alternatives considered

- 依赖网络回调恢复状态：回调明确绑定旧视图，页面重建后会被安全丢弃，无法恢复。
- 保留 `CHECKING`/`DOWNLOADING` 并在新页面猜测任务状态：任务已被取消或不再可见，状态无法可靠判断。
- 每次重建都强制重新检查：会额外联网，且不解决下载中断后的状态语义；重置为空闲让用户明确重试。

## Verification

`python3 scripts/test-android-about-update-lifecycle.py` 在修复前按预期失败，修复后通过；另运行 `git diff --check`。

## Consequences

离开关于页会放弃进行中的检查或下载，返回页面后按钮恢复为可重试的「检查更新」。已经校验完成、等待用户安装的更新不会被清除。
