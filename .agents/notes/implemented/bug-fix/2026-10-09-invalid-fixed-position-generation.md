# Agent Note: 非法固定候选位置不推进代次

Status: implemented

## Problem

`Runtime::dispatch` 在检查 `FixCandidatePosition` 的位置范围之前推进候选代次。公开 Runtime 接口收到 0 或大于 5 的位置时虽然返回错误，却使当前页面的候选 ID 过期；随后使用原 ID 选择候选会失败。C ABI 入口已有预检查，但 Runtime 自身没有保持拒绝操作不改变候选身份的约束。

## Decision

在候选 ID 校验之后、代次推进之前校验固定位置的范围。错误类型和文字保持原样，成功路径继续交给 Engine。回归测试先用非法位置触发错误，再用同一候选 ID 完成选择。

## Alternatives considered

- 只依赖 C ABI 的预检查：直接调用 Runtime 的宿主或测试仍会遇到错误后的状态变化。
- 报错后回退代次：候选身份可能已被其他副作用改变，事前校验更简单且不会制造回滚路径。

## Consequences

非法固定位置不会更改候选代次；有效固定位置和其他候选操作保持原有流程。

## Verification

- 回归测试在旧实现中先失败，修复后通过。
- `cargo test -p msime-input-runtime --locked --lib`
- `cargo clippy -p msime-input-runtime --all-targets --locked -- -D warnings`
- `cargo fmt --all`
- `npm run verify-notes`
- `bash scripts/verify-local.sh --quick`
