# Agent Note: 插件导入 staging 写入绑定目录句柄

Status: implemented

## Problem

插件导入创建 staging 目录后，成员文件仍通过 staging 路径创建。若 staging 的父目录条目在复制或解压期间被替换，路径解析可能把文件写到另一个目录；同时，普通的原子重命名会覆盖此前已经写入的同名成员。

## Decision

Unix 导入在创建 staging 后立即打开目录句柄，并把它沿着目录复制、压缩包解包和成员写入调用链传递。成员先写入同一目录句柄下的临时文件，再用目录句柄执行原子发布；发布使用 no-replace 语义，重复成员仍按原规则拒绝。非 Unix 保留路径实现。

## Alternatives considered

- 只在写入前再次检查 staging 路径：检查与创建之间仍有竞态。
- 继续使用普通 `renameat`：同名成员会被后写入者覆盖，破坏重复文件校验。
- 只绑定 staging 的父目录：父目录句柄不能阻止 staging 条目本身被替换。

## Consequences

插件成员写入始终绑定到 import 开始时创建的 staging 目录，不会跟随父目录替换；重复文件在 Unix 和非 Unix 路径上都继续返回导入校验错误。

## Verification

`cargo test -p msime-client-core plugins::import::tests::member_write_stays_in_open_staging_directory_after_replacement --lib --locked`：1 passed。

`cargo test -p msime-client-core plugins::tests:: --lib --locked`：50 passed。

`cargo fmt --all`、`cargo clippy -p msime-client-core --lib --locked -- -D warnings`、`cargo check -p msime-client-core --all-targets --locked` 和 `git diff --check` 均通过。
