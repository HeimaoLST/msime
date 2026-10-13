# Agent Note: Android LayoutPolicy host 编译边界

Status: implemented

## Problem

`LayoutPolicy` 作为非 Material 的共享布局策略被大量 core/settings 源引用，但 `sheetDragHandle()` 直接导入 `BottomSheetDragHandleView`。`check-host.sh` 刻意排除 AndroidX/Material AAR，导致整个宿主策略编译失败。

## Decision

保留 `LayoutPolicy.sheetDragHandle(Context)` 的统一入口和 Material 构建时的实际控件，改用反射按类名创建 `BottomSheetDragHandleView`；没有 Material AAR 的 host/JVM 环境回退普通 `View`，两种环境都继续设置相同的布局参数。

## Alternatives considered

- 让 host 检查跳过 `LayoutPolicy`：会失去大量共享布局策略的编译覆盖。
- 把拖动条调用散回四个面板：破坏已建立的统一工厂边界，并容易再次产生实现差异。
- 在纯策略层直接依赖 Material AAR：与 `check-host.sh` 的无 AAR 编译契约冲突。

## Verification

修复前 `bash platforms/android/check-host.sh` 在数百处 `LayoutPolicy` 引用处失败；修复后通过 Android JVM 冒烟、设备源编译和服务/API/资源检查，另运行 `git diff --check`。

## Consequences

Material APK 仍使用真实拖动条；无 AAR 的 host 检查使用轻量回退视图，只验证共享策略的编译与布局参数契约。
