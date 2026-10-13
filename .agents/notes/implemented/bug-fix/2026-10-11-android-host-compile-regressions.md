# Agent Note: Android host 编译回归

Status: implemented

## Problem

最近的 Android UI 工厂重构把依赖 Material 层的 `ThemeColorPolicy` 和 `DrawablePolicy` 调用放进了 `ViewPolicy`。`check-host.sh` 编译的是不含 AndroidX/Material AAR 的纯宿主源，因此 `ViewPolicy` 无法解析这些类型。与此同时，`TextPolicy` 留下了一个没有绑定到声明的重复 Javadoc；`javac -Xlint:all -Werror` 将其视为错误。

## Decision

让 `ViewPolicy` 的圆角波纹只依赖 Android framework：从 `android.R.attr.textColorPrimary` 解析按压颜色，并在本类中构造圆角内容和 `RippleDrawable`。移除 `TextPolicy` 的悬空 Javadoc。这样保留现有调用方，同时恢复无 AAR host 检查的编译边界。

## Alternatives considered

- 只补一个 Material import：host 检查仍无法编译 `ThemeColorPolicy`，因为它依赖 AndroidX/Material AAR。
- 让 host 检查跳过 `ViewPolicy`：会失去通用交互策略的编译覆盖，掩盖同类边界回归。

## Verification

修复前 `ANDROID_SDK_ROOT=... bash platforms/android/check-host.sh` 在 `ViewPolicy` 找不到 `ThemeColorPolicy`；改为移除 Material/宿主层依赖后又暴露 `DrawablePolicy` 和悬空 Javadoc，最终修复后通过，运行了 202 个 Android JVM 冒烟、设备源编译和服务/资源检查。

## Consequences

通用 `ViewPolicy` 不再依赖 Material 颜色策略；主题按压色从 framework 的主文字色读取，缺失或资源异常时退回黑色。Material 层页面仍可通过调用方传入填充色保持现有外观。
