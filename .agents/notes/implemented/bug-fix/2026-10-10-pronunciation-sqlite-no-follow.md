# Agent Note: 英语发音词典拒绝链接路径

Status: implemented

## Problem

`crates/engine/src/host/glosses.rs::english_phonetics` 读取宿主传入的 `en-phonetic.db` 时直接调用 `Connection::open_with_flags`。只读标志不会阻止 SQLite 跟随符号链接或打开指向同一 inode 的硬链接，攻击者可以把发音数据库路径重定向到资源目录之外的文件。

## Decision

复用 `crate::paths::sqlite_path_no_follow`，先拒绝不受信任的父级符号链接和非单硬链接文件，再把解析后的父目录与原始叶名交给带 `SQLITE_OPEN_NOFOLLOW` 的只读连接。错误继续映射为已有的 `PRONUNCIATION_UNAVAILABLE`，不改变宿主 API 契约。

## Alternatives considered

- 只增加 `SQLITE_OPEN_NOFOLLOW`：无法覆盖打开前的父级路径检查，也无法拒绝硬链接，不能复用已经验证过的路径策略。
- 在发音入口复制一份符号链接和硬链接检查：会与其它 SQLite 读取入口分叉，后续平台修复容易遗漏，因此统一调用共享 helper。

## Consequences

- 发音数据库仍然是只读、不会创建文件；无效路径继续返回原有的 unavailable 诊断。
- 受信任的系统路径别名由共享 helper 按平台规则处理，其它父级符号链接和硬链接数据库会被拒绝。

## Verification

- 回归测试 `host::tests::english_phonetics_rejects_a_linked_database` 和 `host::tests::english_phonetics_rejects_a_hard_linked_database` 覆盖符号链接与硬链接，修复后通过。
- `cargo test -p msime-engine --lib host::tests::english_phonetics`
- `cargo clippy -p msime-engine --all-targets -- -D warnings`
- `cargo fmt --all -- --check`
- `git diff --check`
- `bash scripts/verify-local.sh --quick`（通过；按环境跳过未配置的 Windows、Linux Docker、Wasm 和 Harmony 阶段）
- Android 专用 AVD smoke 已尝试；当前 worktree 没有已验证资源目录，故 `target/android/msime-android.apk` 尚未生成，smoke 在安装前停止，未声称设备验收通过。
