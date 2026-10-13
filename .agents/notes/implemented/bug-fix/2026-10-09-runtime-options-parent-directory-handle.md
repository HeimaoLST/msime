# Agent Note: 运行时配置发布绑定父目录句柄

Status: implemented

## Problem

运行时配置刷新先检查父目录，再用 `NamedTempFile::new_in(parent)` 和 `persist(path)` 按路径发布。检查完成后父目录被替换时，配置可能被写入另一棵目录；仅拒绝当时可见的符号链接不能消除这个竞态。

## Decision

刷新开始时打开并保存私有父目录句柄，配置读取通过该句柄打开普通文件，原有权限从已打开文件获取，刷新发布通过同一目录句柄的原子 `renameat` 完成。`client-core` 的共享文件锁模块新增目录句柄、相对读取和保留权限发布接口；非 Unix 保留路径实现。叶子配置符号链接仍按原语义跳过。

## Alternatives considered

- 在 `persist` 前再次检查父目录：检查与发布之间仍有替换窗口。
- 只在最终发布时打开父目录：读取和发布可能绑定到不同目录，且不能确认发布目录就是读取目录。
- 在 `host-api` 自己复制 `openat` 代码：会绕开 `client-core` 共享的私有文件边界，增加平台分叉。

## Consequences

Unix 配置刷新整个读写周期都绑定到刷新开始时确认的父目录；目录路径随后被替换时不会把配置写到外部目录。已有文件权限继续复制到新文件，刷新判定、词库准备和非 Unix 行为保持不变。

## Verification

- `cargo test -p msime-client-core storage::tests::private_file_publish_stays_in_an_open_directory_after_replacement --no-fail-fast`：1 passed。
- `cargo test -p msime-client-core --lib --locked --quiet`：1125 passed，1 ignored。
- `cargo test -p msime-host-api --lib --locked --quiet`：388 passed。
- `cargo clippy -p msime-client-core -p msime-host-api --all-targets --locked -- -D warnings`：通过。
- `cargo fmt --all`：通过。
- `bash scripts/verify-local.sh --quick`：通过（缺少工具链的阶段按门禁规则跳过）。
- `bash platforms/android/check-host.sh`：187 个 JVM smoke、55 个设备套件源码编译及策略检查通过。
