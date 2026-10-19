# 二元备忘指纹诊断

固定提交与资源见 `results.json`。本次只有计数，没有性能计时或生产修改；乘法散列未通过预设的完整键比较减少10%门槛。

## 复现

在固定基线的隔离worktree中将`recorder.diff.txt`应用到`crates/engine/src/lattice/decode.rs`，构建并运行；`RESOURCES`为按仓库锁验证过的完整资源目录，`TRACE`为本任务临时文件。记录器只选择第一个真实备忘对象，并断言其表不变，不记录词面或用户输入。

```sh
 git apply docs/measurements/2026-10-19-bigram-memo-fingerprint/recorder.diff.txt
 CARGO_BUILD_JOBS=4 cargo build --release --locked -p msime-input-runtime --example rerank_latency
 MSIME_FINGERPRINT_TRACE="$TRACE" target/release/examples/rerank_latency --resources "$RESOURCES" --set resources/eval/sentences-nine-key-v1.tsv --grid nine --budget-ms 16 --warmup 5
 git restore --source=HEAD -- crates/engine/src/lattice/decode.rs
 rustc --edition 2021 -O --crate-name fingerprint_diagnostic docs/measurements/2026-10-19-bigram-memo-fingerprint/diagnostic.rs.txt -o target/fingerprint-diagnostic
 target/fingerprint-diagnostic "$TRACE"
```

采集程序退出1来自预算超限，不是崩溃；采集运行没有可采用的延迟成绩。完成后确认生产文件与固定基线相同，删除临时键流。独立程序不读取n元表，用键低32位作合成分值并逐次核对位模式，检验缓存映射；结果不能代替真实n元评分、质量和设备验证。

## 结果与限制

两个散列使用相同完整键、缓存预算、Entry、容量增长和满容量未命中全清路径。完整流110796740次，两臂命中/未命中/全清为94315035/16481705/502。完整比较94740603→94735156，仅减少约0.00575%。即使不相等的假匹配减少约1.28%，也不代表完整访问提速。计数器本身改变运行成本，因此没有记录或比较耗时。

Eq计数只观察完整键比较，不测控制组探测；该集合不代表所有输入，不推及其他工具链或架构。没有更换混合常量、重测挑选结果、修改生产缓存或放宽16ms预算。
