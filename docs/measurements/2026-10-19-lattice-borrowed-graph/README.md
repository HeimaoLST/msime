# 词网格借用字段的否决记录

原型让稳定词典缓存页的词面和显式读音借用至同步解码结束，隐式读音与最终输出继续拥有。局部功能测试通过，完整建图配对因三个空页控制超过预设回退预算而否决；生产源码和测试接线已恢复。

## 数据

- `results.json`：固定基线、工具链、二进制与源码哈希、分配器恢复、全部54形状预算及两轮结果。
- `paired-round{1,2}.txt`：每轮全部1134对原始样本与统一失败断言；21对交替先后，包含完整建图、查询、跨度键构造及析构。
- `monitor-round{1,2}.json`：每秒构建进程数量和系统负载，只记录进程名计数。首轮因外部构建整轮无效；原样重跑为有效轮。
- `red.txt`、`green.txt`、`green-initial-compile-error.txt`：两项真实断言失败、最终四项专项通过，以及中间编译错误。绿色后仅加代表性分配日志并去掉冻结快照注释，未改变断言或生产逻辑；该日志没有另跑，不提供其数值。
- `candidate.patch.txt`：已撤回的完整生产与测试快照，不接入当前产品编译。三个冻结旧函数与固定基线相同。
- `build-system.py.txt`、`run.py.txt`：复现用入口，均为文本快照。

## 复现

在仓库外创建固定基线 `43715313f397281bdc974e9c007b23b786920647` 的隔离工作树，先把本目录复制过去。应用补丁后，普通计数分配器用于功能测试；计时构建临时取消全局计数包装注册，保存专用System二进制并在finally中恢复源文件。

```sh
git apply docs/measurements/2026-10-19-lattice-borrowed-graph/candidate.patch.txt
env -u MSIME_EVAL_RESOURCES CARGO_BUILD_JOBS=4 cargo test --release --locked -p msime-engine --lib borrowed_fields_tests -- --nocapture
python3 docs/measurements/2026-10-19-lattice-borrowed-graph/build-system.py.txt
git diff --exit-code HEAD -- crates/engine/src/ime/personal_rerank.rs
python3 docs/measurements/2026-10-19-lattice-borrowed-graph/run.py.txt target/borrowed-graph-system-tests target/borrowed-graph-paired.txt target/borrowed-graph-monitor.json
```

System二进制只运行ignored计时测试，不能用于验证普通分配断言。归档补丁去掉空白上下文行的尾随空格，日志去掉末尾空行；样本内容和失败保持原样，补丁通过 `git apply --check`。两个入口均从工作树根目录执行；本次已按同样命令构建并记录身份，文本构建脚本是方便复现的整理版。复现需运行新构建，二进制没有上传。

## 结果与限制

有效轮36个非空目标中位新旧比0.172805–0.908676，低于0.95；18个空页控制为0.716422–1.080507，三个超过1.05。全部形状收齐后统一退出101，按原预算否决。完整原始失败不删，首轮无效数据也不用于决定。

校准时较快臂达到20ms，不保证正式每个样本都超过20ms。有效轮112次观察未见构建，一分钟负载40.67–93.50；每秒采样不能证明机器独占，也不能排除短进程。结果只决定此原型不接入，不证明所有借用实现都更慢。撤回后没有继续新质量对照、完整引擎/Runtime测试、端到端ABBA或设备验收；默认Runtime九键p95 16ms仍未达到。
