# Agent Note: Linux 面板恢复状态拒绝硬链接

Status: implemented

## Problem

Linux 面板恢复记录读取 `panel-restore.json` 时只拒绝符号链接和特殊文件，旁路锁也只使用 `O_NOFOLLOW`。外部文件的硬链接因此可以被解析为恢复状态，外部 inode 也可以被纳入面板接管的锁协议。

## Decision

`read_panel_restore` 和 `record_panel_takeover` 在已打开的文件句柄上都要求普通文件且 `st_nlink == 1`。锁在 `flock` 前完成检查并在失败时关闭，读取路径保持现有大小上限和无跟随语义。

## Alternatives considered

- 只依赖 `symlink_status` 和 `O_NOFOLLOW`：硬链接不是符号链接，仍会接受外部 inode。
- 在解析 JSON 后检查路径：外部内容已经进入恢复状态，而且检查与打开之间仍存在竞态。
- 仅保护恢复记录、不保护锁：攻击者仍可让面板写入流程等待或共享无关文件的锁。

## Consequences

硬链接恢复记录不会影响 Linux 面板恢复设置，硬链接锁不会改变无关文件的锁语义；正常的单链接记录和锁文件继续工作。父目录替换的路径竞态仍属于后续目录句柄迁移的独立工作。

## Verification

`platforms/linux/tests/candidate/panel_restore_record.cpp` 覆盖硬链接记录读取拒绝和硬链接锁拒绝，并确认外部目标保持存在；旧实现上的记录断言按预期失败。
