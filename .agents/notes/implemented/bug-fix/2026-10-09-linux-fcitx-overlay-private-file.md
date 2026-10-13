# Agent Note: Linux Fcitx 装饰图拒绝硬链接

Status: implemented

## Problem

Fcitx5 候选主题的装饰图暂存器在读取皮肤资源时拒绝符号链接和特殊文件，却接受指向外部 inode 的硬链接。外部文件内容因此可以被当作皮肤资源读入并发布到候选主题目录。

## Decision

`stage_fcitx_overlay` 在已打开的源文件句柄上要求普通文件且 `st_nlink == 1`，再进行大小限制、PNG 解析和缩放；目标主题的原子写入流程保持不变。

## Alternatives considered

- 只检查 `is_regular_file` 和 `O_NOFOLLOW`：硬链接不是符号链接，仍会读取外部 inode。
- 在读完后检查路径：外部内容已经进入主题发布流程，且检查与打开之间仍有竞态。

## Consequences

皮肤资源必须是私有单硬链接文件，外部硬链接不会被复制进 Fcitx 主题；正常资源和现有大小、格式限制不变。主题目录自身的父路径竞态仍由候选原子写入器单独处理。

## Verification

`platforms/linux/tests/candidate/candidate_fcitx_overlay_scale.cpp` 新增硬链接源资源拒绝用例；旧实现上的断言按预期失败，加入检查后通过。
