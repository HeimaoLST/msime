# Agent Note: Linux 宿主拒绝剪贴板硬链接文件

Status: implemented

## Problem

Linux 宿主的剪贴板历史读取和旁路锁虽然拒绝了符号链接与特殊文件，却接受指向外部 inode 的硬链接。读取会把外部文件内容当作私有历史，硬链接锁会把不属于剪贴板的文件纳入锁协议。

## Decision

`ClipboardAtomicWrite.h` 打开剪贴板历史和锁后都检查句柄对应的是普通文件且 `st_nlink == 1`。硬链接正文因此不再被读取，硬链接锁也不会被用于同步；临时文件继续由 `mkstemp` 产生并通过原子 `rename` 发布。

## Alternatives considered

- 只保留 `O_NOFOLLOW`：能拒绝叶子符号链接，但硬链接不是路径别名，仍会打开外部 inode。
- 只在读取内容后比较路径元数据：路径可在检查与使用之间变化，且锁入口仍会接受外部 inode。
- 把剪贴板历史改成独立的目录句柄实现：能覆盖更大的父目录竞态，但会重复 client-core 已有的存储抽象；本切片先补齐现有 C++ 入口与 Rust 入口一致的叶子 inode 不变量。

## Consequences

攻击者放置的剪贴板历史硬链接不会泄露外部文件内容，硬链接锁不会改变无关文件的锁语义。正常的单链接历史和锁文件行为不变；父目录替换窗口仍由 `clipboard_directory_is_safe` 的既有边界处理，后续若要消除该窗口需要单独迁移到目录句柄。

## Verification

`platforms/linux/tests/clipboard/clipboard_atomic_write.cpp` 覆盖硬链接历史读取拒绝和硬链接锁拒绝，并确认两个外部目标保持存在。
