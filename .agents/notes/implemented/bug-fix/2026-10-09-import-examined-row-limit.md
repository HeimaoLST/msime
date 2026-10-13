# Agent Note: 导入器按已检查行数执行上限

Status: implemented

## Problem

词典和词书导入器以成功接收的条目数判断行数上限。大量无效行或重复词条不会推进计数，解析器会继续检查超过上限的输入，与导入报告中“后续行未检查”的语义不符。

## Decision

两个解析循环分别计数实际交给行解析器的非空、非注释行。达到上限后遇到下一条数据行就停止，并在报告中标记截断。词典的 Rime YAML 头部不算数据行。回归测试以一个有效行、达到上限所需的无效行和末尾有效行证明末尾不再被接收。

## Alternatives considered

- 继续只限制有效条目：无法限制无效行的解析工作量，也无法兑现报告的行数语义。
- 按物理行计数：空行、注释和 Rime 头部会消耗导入预算，改变现有的跳过规则。

## Consequences

有大量无效行的文件会在已检查行上限处截断；报告仍记录已检查范围内的失败数和首批行号。少量坏行仍可跳过。

## Verification

- 新增测试在旧实现中先失败，在修复后通过。
- `cargo test -p msime-client-core dictionary::import::tests:: --locked --lib`
- `cargo test -p msime-client-core vocabulary::import::tests:: --locked --lib`
- `cargo clippy -p msime-client-core --all-targets --locked -- -D warnings`
- `cargo fmt --all`
- `npm run verify-notes`
- `bash scripts/verify-local.sh --quick`
