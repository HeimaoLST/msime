# 默认 Runtime 接入嵌入直接写入的验证

模型实现来自 [chinese-ime-lm PR #77](https://github.com/metasequoiaime/chinese-ime-lm/pull/77)，固定实际合并提交 `15caab4fdeb59c11f452b91884371cf30e2e5608`。主仓库只更新两份清单和两份锁文件。

## 数据

- `results.json` 保存旧新模型 pin、二进制和资源身份、质量报告与候选 dump 的哈希、四轮延迟及每秒构建观察。
- `quality-{old,new}-{quanpin,nine}.json` 是全拼 60 例和九键 81 例的完整质量报告。
- `candidates-{quanpin,nine}.jsonl.gz` 是完整候选 dump。旧新未压缩字节完全相同，各保存一份，gzip 时间戳固定为零；两臂独立哈希记录在 `results.json`。
- `latency-{1-old,2-new,3-new,4-old}.txt` 保留四轮完整延迟输出，只将本机资源目录替换为 `<verified-resources>`。输入均来自已提交的合成评测集。

上游的逐位测试、16 种嵌入形状配对原始记录及完整模型旧新表保存在 [上游测量目录](https://github.com/metasequoiaime/chinese-ime-lm/tree/15caab4fdeb59c11f452b91884371cf30e2e5608/docs/measurements/2026-10-19-embedding-direct-write)。上游完整模型表不是配对比较，部分长形状更慢；该表不能证明完整模型收益或排除回退。

## 复现

在 `results.json` 对应旧、新主仓库提交分别构建并保留二进制，使用相同 Rust 工具链、模型和完整锁定资源。不要用当前 checkout 的已覆盖产物冒充旧二进制。

```sh
env -u MSIME_EVAL_RESOURCES CARGO_BUILD_JOBS=4 cargo build --release --locked -p msime-input-runtime --example convert_eval --example rerank_latency
target/release/examples/convert_eval --resources "$verified_resources" --set resources/eval/sentences-v1.tsv --dump quanpin.jsonl
target/release/examples/convert_eval --resources "$verified_resources" --set resources/eval/sentences-nine-key-v1.tsv --grid nine --dump nine.jsonl
target/release/examples/rerank_latency --resources "$verified_resources" --set resources/eval/sentences-nine-key-v1.tsv --grid nine --budget-ms 16
```

完成本任务全部构建、测试和质量运行后，观察到连续三次无构建，再串行执行旧／新／新／旧。每个进程用相同 81 例、每臂 1791 键、5 例预热；进程内部按例交替 engine/model 两臂。运行前后核对二进制哈希，每秒只观察系统 load 和 `cargo`、`rustc`、`clang`、`clang++` 进程名。

四轮之间没有保存逐键配对样本，不能从汇总分位数相减推断优化的逐键收益。无构建观察不等于机器独占。16ms 失败是保留的结果，不重跑挑选更快一轮。
