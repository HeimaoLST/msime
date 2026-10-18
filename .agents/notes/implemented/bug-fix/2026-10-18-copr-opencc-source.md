# Agent Note: 发行版源码包提供 OpenCC 构建输入

Status: implemented

## Problem

OpenCC 数据在 `msime-dictionary` 仓按提交锁定，并由 `crates/client-base/build.rs` 在编译期下载或读取离线源目录。Linux 的 RPM 与 Debian 源码包构建强制 Cargo 离线，但 `make-source-tarballs.sh` 生成的既有 vendor tarball 没有包含 OpenCC 文件，Fedora COPR 因而在 `include_str!` 前准备数据失败。

## Decision

把 `scripts/fetch_opencc.py` 校验过的八个文件放入既有 vendor tarball 的 `opencc/` 目录。RPM 与 Debian 构建在调用 Cargo 前设置 `MSIME_OPENCC_SOURCE_DIR` 指向该目录，让构建脚本沿用同一份摘要校验逻辑。契约测试保证源码包生成器包含数据、两条离线构建路径都传入目录。

## Alternatives considered

- 让 COPR 构建时联网下载 OpenCC：最小改动，但构建农场网络不可用，也会破坏源码包可复现的离线契约。
- 把 OpenCC 作为单独的发布附件：能独立复用，但会增加发行版源码包的下载与渲染契约；既有 vendor tarball 已是离线构建依赖的集中载体，重复拆分没有收益。

## Consequences

源码 tarball 生成前会校验并收取锁定的 OpenCC 文件；RPM 与 Debian 的 Cargo 构建在无网络时从 `vendor/opencc` 完成 `client-base` 的构建输入准备，现有 OpenCC 下载器测试也覆盖了脚本接线。vendor tarball 体积增加约 1 MB；OpenCC 锁更新时必须重新生成该 tarball，构建脚本会按源码树锁文件重新校验并拒绝不匹配的数据。
