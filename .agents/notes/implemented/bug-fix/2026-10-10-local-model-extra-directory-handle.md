# Agent Note: 本地模型 extra 文件绑定 model 目录句柄

Status: implemented

## Problem

默认本地语音模型的嵌入 extra 和网络 extra 仍按 `model_dir` 路径写入。网络 extra 还会先把未校验的字节创建为可见文件，校验失败时留下 staging 文件。

## Decision

Unix 嵌入 extra 通过 model 目录句柄原子写入，网络 extra 在句柄绑定的临时文件中下载并先校验 SHA-256，再原子发布；校验失败由句柄写入辅助函数清理临时文件。非 Unix 保留原有实现。

## Alternatives considered

- 继续写最终路径后再校验：路径替换可重定向写入，失败时也会留下未校验文件。
- 只在写完后检查根目录：检查与发布之间仍有竞态。
- 只绑定网络 extra、保留嵌入 extra 路径写入：同一 staging 边界仍不一致。

## Consequences

extra 文件的字节在校验完成前不会出现在 model 目录；Unix 下嵌入和网络来源都固定到安装开始时打开的目录对象。

## Verification

- `cargo fmt --all`
- `cargo test -p msime-client-core voice::local_models::tests:: --lib --locked`
- `cargo clippy -p msime-client-core --lib --locked -- -D warnings`
- `cargo check -p msime-client-core --all-targets --locked`
