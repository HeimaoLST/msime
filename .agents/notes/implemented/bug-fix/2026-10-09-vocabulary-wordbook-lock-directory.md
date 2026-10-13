# Agent Note: 单词本库锁绑定目录句柄

Status: implemented

## Problem

单词本库原先按路径获取目录锁，但锁住后索引和单词本读写又重新解析库目录。库目录被替换时，锁与实际读写可能分别指向旧目录和替换目录，跨进程互斥因此失效，并可能把新内容写入错误位置。

## Decision

锁定单词本库时同时打开父目录句柄，锁文件、索引和每本单词本的读写、原子发布与删除都相对于该句柄执行。测试专用路径辅助函数限定在测试构建，避免生产构建保留死代码。

## Alternatives considered

- 每次操作前重复检查库目录：仍无法消除检查与打开之间的替换窗口。
- 只把索引读写改为句柄相对：单词本文件仍可能绕过锁指向新目录。
- 继续使用目录路径锁：锁文件本身可能与数据目录脱钩。

## Consequences

列表、读取、导入和删除在同一目录句柄下串行访问，目录替换不会重定向已经取得锁的操作。原子发布和崩溃顺序保持不变。

## Verification

`cargo test -p msime-client-core --locked`、`cargo clippy -p msime-client-core --all-targets --locked -- -D warnings`、`npm run verify-notes`、`bash scripts/verify-local.sh --quick` 和 `bash platforms/android/check-host.sh` 均通过。
