# Agent Note: 九键前页索引用单次槽位查询接纳候选

Status: rejected — 首次完整15形状中6个目标全部未达0.98门槛，生产入列恢复基线；外部构建干扰下不能声称稳定收益。

## Problem

固定 `8f011cb59c7eb5efcdd172c411804e6bb05f4f82` 的正式九键逐键采样中，`push_ranked` 有 275 个自身样本。每次接纳新词先 `get`，再 `get_mut`，最后 `insert`；改善同词则先 `get` 再 `get_mut`。词面哈希只算一次，但相同哈希表槽位重复定位。采样有外部构建，只用于找工作量，不作延迟成绩。

## Proposal

首次候选仍按 `CANDIDATE_LIMIT` 预留；`push_ranked` 使用 `HashMap::entry` 一次取得槽位。已有槽仍比较真实词面和完整排名键，严格改善才追加并更新下标，碰撞新词加入原槽；空槽直接写入。保持所有行字段、容器容量、插入顺序、碰撞安全、支配过滤和最终排序。

## Historical audit

[前页词面索引](../../implemented/testing/2026-10-19-nine-key-leading-index.md)持有哈希、槽位及候选下标的所有权决定，本片只合并表查询；[延迟预留](../../implemented/testing/2026-10-10-nine-key-leading-map-storage.md)继续持有首次预留规则。[排名前置过滤](../../implemented/testing/2026-10-16-nine-key-dominated-row-projection.md)不变。[领先表替代最终排名的负结果](../../rejected/testing/2026-10-17-nine-key-ranked-leaders.md)不重试。检索活跃树未发现相同单次槽位查询决定，其余命中为独立的排序或词库页策略，无待清理提案。

标准库的 [entry](https://doc.rust-lang.org/std/collections/struct.HashMap.html#method.entry)及本仓 `SyllablePrior::from_weights` 是既有原位更新范式；不新增依赖、IO或宿主行为。

## Alternatives considered

- 保留分开查找：分支直观，但接纳路径重复定位同一槽位。
- 使用裸桶或不比较真实词面：能进一步减少接口开销，但增加不安全或破坏碰撞正确性，现有标准接口已能表达需要的操作。

## Acceptance criteria

冻结本提交的完整 `push_ranked`。对三种网格、排名选项、唯一/等键/改善/更差/混合行、扩容和人工碰撞槽逐项比较所有候选字段、容量和索引。正式修改前先运行配对性能红测试。普通分配器 release 的完整入列调用（输入副本与初始表在计时外，丢弃行析构在计时内）固定 16/128/512 词 × unique/improve/equal/worse/mixed，共15形状，各40对交替先后，旧批次校准至少2ms；unique/improve 为目标，要求中位比 <0.98，其余 <1.05。首次完整计时若失败，不挑格或放宽门槛接入。红测试只证明现状没有相对自身收益，不作为候选成绩。再以冻结完整刷新对照跨网格行为；全量相关测试、fmt、Clippy、notes、quick、质量 JSON 与16ms九键ABBA后审查交付。

## Risks

编译器布局和 entry 分派可能抵消重复查询收益，必须保留完整性能失败。首次预留必须在 entry 之前，避免先分配小表再扩容。局部收益不代表整体九键16ms达标。

## Rejection evidence

### 未改生产的红测试

退出码 `101`，26.11 秒，47 次观测，47 次见外部构建命令；峰值 rustc/cargo/clang 为 0/1/4，load_1m 最大 52.7856。`cargo` 存在不保证正在编译，监测未检查其它 CPU 工作。每形状完整40对，无丢弃、挑格或重测。保留[全部600对计时](../../../../docs/measurements/2026-10-19-nine-key-leading-entry-red.csv)和[逐次进程计数](../../../../docs/measurements/2026-10-19-nine-key-leading-entry-red-monitor.json)。

```text
ENTRY_SUMMARY width=16 mode=unique iterations=4096 median=1.068151 p10=0.990228 p90=1.169013 threshold=0.98
ENTRY_SUMMARY width=16 mode=improve iterations=4096 median=1.009415 p10=0.975139 p90=1.035160 threshold=0.98
ENTRY_SUMMARY width=16 mode=equal iterations=1024 median=1.015278 p10=0.892264 p90=1.118026 threshold=1.05
ENTRY_SUMMARY width=16 mode=worse iterations=1024 median=1.017462 p10=0.892133 p90=1.140447 threshold=1.05
ENTRY_SUMMARY width=16 mode=mixed iterations=2048 median=0.987072 p10=0.858975 p90=1.196441 threshold=1.05
ENTRY_SUMMARY width=128 mode=unique iterations=512 median=1.132534 p10=1.049964 p90=1.218914 threshold=0.98
ENTRY_SUMMARY width=128 mode=improve iterations=512 median=1.026381 p10=0.895386 p90=1.206834 threshold=0.98
ENTRY_SUMMARY width=128 mode=equal iterations=256 median=0.980683 p10=0.667514 p90=1.311643 threshold=1.05
ENTRY_SUMMARY width=128 mode=worse iterations=256 median=0.980908 p10=0.856353 p90=1.220434 threshold=1.05
ENTRY_SUMMARY width=128 mode=mixed iterations=256 median=1.029449 p10=0.789583 p90=1.273586 threshold=1.05
ENTRY_SUMMARY width=512 mode=unique iterations=128 median=1.117588 p10=0.803634 p90=1.424343 threshold=0.98
ENTRY_SUMMARY width=512 mode=improve iterations=128 median=1.032740 p10=0.550954 p90=1.431731 threshold=0.98
ENTRY_SUMMARY width=512 mode=equal iterations=64 median=0.997527 p10=0.243802 p90=4.024194 threshold=1.05
ENTRY_SUMMARY width=512 mode=worse iterations=64 median=0.933273 p10=0.146927 p90=4.711007 threshold=1.05
ENTRY_SUMMARY width=512 mode=mixed iterations=8 median=0.999755 p10=0.701949 p90=1.209863 threshold=1.05
```

普通分配器测试 binary SHA-256：`c3f321a209bf93c5b4278d2c7cc7a97b068332b7ebd8849c4a511b9626a93171`。

### 候选首次完整计时

退出码 `101`，17.95 秒，31 次观测，31 次见外部构建命令；峰值 rustc/cargo/clang 为 0/0/8，load_1m 最大 49.4248。`cargo` 存在不保证正在编译，监测未检查其它 CPU 工作。每形状完整40对，无丢弃、挑格或重测。保留[全部600对计时](../../../../docs/measurements/2026-10-19-nine-key-leading-entry-candidate.csv)和[逐次进程计数](../../../../docs/measurements/2026-10-19-nine-key-leading-entry-candidate-monitor.json)。

```text
ENTRY_SUMMARY width=16 mode=unique iterations=2048 median=1.021671 p10=0.445826 p90=1.172224 threshold=0.98
ENTRY_SUMMARY width=16 mode=improve iterations=1024 median=0.987879 p10=0.407585 p90=2.035630 threshold=0.98
ENTRY_SUMMARY width=16 mode=equal iterations=1024 median=0.995910 p10=0.471441 p90=1.976640 threshold=1.05
ENTRY_SUMMARY width=16 mode=worse iterations=1024 median=1.011765 p10=0.334787 p90=2.564894 threshold=1.05
ENTRY_SUMMARY width=16 mode=mixed iterations=2048 median=0.936077 p10=0.397349 p90=2.357983 threshold=1.05
ENTRY_SUMMARY width=128 mode=unique iterations=64 median=1.013805 p10=0.735890 p90=1.596477 threshold=0.98
ENTRY_SUMMARY width=128 mode=improve iterations=8 median=0.981427 p10=0.943930 p90=1.000000 threshold=0.98
ENTRY_SUMMARY width=128 mode=equal iterations=128 median=1.015419 p10=0.952292 p90=1.840719 threshold=1.05
ENTRY_SUMMARY width=128 mode=worse iterations=256 median=0.999789 p10=0.544225 p90=1.046043 threshold=1.05
ENTRY_SUMMARY width=128 mode=mixed iterations=256 median=1.016281 p10=0.882268 p90=1.446799 threshold=1.05
ENTRY_SUMMARY width=512 mode=unique iterations=128 median=1.022638 p10=0.457984 p90=1.559852 threshold=0.98
ENTRY_SUMMARY width=512 mode=improve iterations=128 median=0.980352 p10=0.429643 p90=1.125599 threshold=0.98
ENTRY_SUMMARY width=512 mode=equal iterations=64 median=1.009689 p10=0.631023 p90=1.286389 threshold=1.05
ENTRY_SUMMARY width=512 mode=worse iterations=64 median=1.009076 p10=0.694571 p90=2.508207 threshold=1.05
ENTRY_SUMMARY width=512 mode=mixed iterations=32 median=1.016503 p10=0.929737 p90=1.612351 threshold=1.05
```

普通分配器测试 binary SHA-256：`b483abe05d13f2625bccbfdb5307659cef729409e30c7c51cbdd5792cd749fb9`。

候选6个目标格全部未过0.98，9个控制格均小于1.05。改善路径中位比0.980352–0.987879；唯一词路径1.013805–1.022638。外部构建和短批次校准会放大波动（128词改善仅校准到8次），不把这轮当空闲机器的稳定回退结论，也不据受干扰观测重复试到通过。失败证据不足以支持接入，生产 `push_ranked` 逐字恢复固定基线。

普通分配器构建方法：临时将 `crates/engine/src/ime/personal_rerank.rs` 唯一 `#[global_allocator]` 换成 `#[allow(dead_code)]`，`CARGO_BUILD_JOBS=4 cargo test --release --locked -p msime-engine --lib --no-run --message-format=json` 后复制唯一 test executable，finally 逐字恢复；只运行 `nine_key::leading_entry_tests::entry_paired_latency --exact --ignored --nocapture`。构建、测试和 push 均设 `TMPDIR="$PWD/target/tmp"`，没有另起 Cargo 产物目录。基线与候选的正式 release 例程用 `cargo build --release --locked -p msime-input-runtime --example rerank_latency --example convert_eval` 构建；全拼60例与九键81例完整质量JSON各自相同。未运行16ms ABBA：候选已拒绝，不进入产品，不再为该候选扩张验收。

## Retained test scope

生产只增加两个 `cfg(test)` 模块。完整候选入列保存在 `leading_entry_tests.rs`，旧入列固定在同模块；完整固定刷新仅把入列重定向到候选。正常回归检查候选与生产旧路径的全部字段、顺序、容量、分配及索引，增加224/896恰好满表与102权重的真实混合改善；配对计时输入不变。容量及分配断言只在恢复计数分配器的普通debug测试执行，不能用普通分配器计时binary声称分配预算通过。

## Verification

隔离后的普通计数分配器测试通过：引擎2337项、golden31项、运行时323项，47个既有或手动计时忽略项；满表224/896与混合102权重包含在完整普通测试中。两crate全targets Clippy `-D warnings`、fmt、1386篇笔记树/格式及4篇封印、差异检查通过。独立审查核对生产恢复、候选隔离、全部1200对原始计时、分位数、监测与binary SHA，无阻断项。正式计时发生在候选仍接入生产时；隔离及增加正常回归宽度之后没有重跑ignored计时，不能把旧binary当作重建过的最终测试binary。

本地 `bash scripts/verify-local.sh --quick` 退出0：仓库契约、Rust workspace、Android目标及Java宿主、两种WASM目标、Linux桌面外壳容器、Linux原生宿主与90项ctest、macOS原生宿主及共享Apple bridge通过；Windows本机兼容套件157项通过，2项宿主差异排除，68项需要Windows构建。Windows完整交叉及pipe-only因缺MinGW、HarmonyOS真ArkTS因缺前置产物跳过。Linux另完成五笔版构建和安装产物检查。没有产品文件读写、目录遍历、权限或Android资源变更，没有设备或桌面界面验收。
