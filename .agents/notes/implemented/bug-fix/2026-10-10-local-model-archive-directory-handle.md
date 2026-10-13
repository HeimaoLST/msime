# Agent Note: 本地语音归档解包绑定目录句柄

Status: implemented

## Problem

本地语音模型归档解包在 staging/model 下按路径创建成员文件、设置权限、读取归档 partial，并写入 manifest。根目录或 staging 路径在句柄打开后被替换时，这些路径解析会重新跟随替换后的目录。

## Decision

Unix 解包打开并保留 staging/model 目录句柄。归档成员通过目录相对临时文件完成校验后原子发布，partial 通过 PartialDirectory 句柄读取，manifest 通过目录相对原子写入，成员只读权限通过已打开文件句柄设置。非 Unix 保留原有路径实现。归档输出校验失败时临时文件由句柄写入辅助函数清理。

## Alternatives considered

- 继续用 `pack_dir.join(...)` 并在写前检查根路径：检查和实际操作之间仍有替换竞态。
- 只给最终文件加 `O_NOFOLLOW`：被替换的 staging 祖先仍会把操作导向外部目录。
- 只把成员创建改成句柄：partial 读取、权限设置和 manifest 仍会重新解析路径。

## Consequences

归档解包的写入、读取、权限设置和完整性标记都绑定到已打开的目录或文件句柄；根路径替换不会把模型字节写到外部目录。归档成员在校验完成前不会出现在 staging 目录项中。

## Verification

- `cargo fmt --all`
- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`
