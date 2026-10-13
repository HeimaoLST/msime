# Agent Note: 皮肤文件夹导入复制绑定 staging 目录句柄

Status: implemented

## Problem

皮肤文件夹导入在创建 staging 后，递归复制普通文件仍按目标路径创建文件。staging 或其子目录条目被替换时，路径解析可能把导入内容写入另一个目录；复制失败时的路径清理也可能解析到被替换的条目。

## Decision

Unix 导入用 skin root 目录句柄创建 staging，并为每个递归子目录打开句柄。普通文件通过 `openat`、`O_EXCL` 和 `O_NOFOLLOW` 在对应句柄下创建；失败清理由已打开的父目录执行。非 Unix 保留路径实现。

## Alternatives considered

- 复制前重复检查 staging 路径：检查与创建之间仍有竞态。
- 只给最终文件加 `NOFOLLOW`：无法防止 staging 或中间目录被替换。
- 继续用 `remove_dir_all` 清理：目录条目替换后可能跟随错误路径。

## Consequences

皮肤导入复制的每个 Unix 写入都绑定到本次导入创建的 staging 目录对象，源文件读取和原有预算、格式校验保持不变。

## Verification

`cargo test -p msime-client-core skin::folder_import::tests:: --lib --locked`：15 passed。

`cargo test -p msime-client-core skin::candidate_community::tests:: --lib --locked`：54 passed。

`cargo fmt --all` 和 `cargo clippy -p msime-client-core --lib --locked -- -D warnings` 通过。
