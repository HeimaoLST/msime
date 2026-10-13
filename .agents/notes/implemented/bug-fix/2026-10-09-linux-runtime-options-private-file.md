# Agent Note: Linux 运行时配置拒绝硬链接

Status: implemented

## Problem

Linux IBus 和 Fcitx5 重载运行时配置时，`RuntimeOptionsFile.h` 只检查普通文件，不检查文件是否是外部 inode 的硬链接。硬链接内容因此可以被当作宿主的私有运行时配置。

## Decision

运行时配置在已打开的句柄上必须是普通文件且 `st_nlink == 1`，与 Linux 剪贴板、面板恢复记录和 Rust 私有文件读取保持同一不变量；现有 `O_NOFOLLOW`、特殊文件拒绝和大小上限继续保留。

## Alternatives considered

- 只使用 `O_NOFOLLOW`：硬链接不会触发符号链接检查，仍会读到外部 inode。
- 读取后再检查路径：配置已经被解析，且路径检查与打开之间仍有竞态。

## Consequences

用户配置仍按原路径和大小限制读取，外部硬链接不再能注入运行时选项。父目录替换的路径竞态仍由现有安全路径策略覆盖，迁移到目录句柄属于独立工作。

## Verification

`platforms/linux/tests/core/first_run_guidance.cpp` 新增硬链接运行时配置拒绝用例；旧实现上的断言按预期失败，加入检查后通过。
