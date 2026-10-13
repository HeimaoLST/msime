# Agent Note: Linux IBus 异步回调析构状态保护

Status: implemented

## Problem

翻译和在线候选请求用 `GTask` 持有 `IBusEngine`。Engine 销毁时会释放并清空 `MsimeIbusEngine::state`，但后台任务仍可能在主循环中完成。两个完成回调在第一次读取 `state(engine)` 前没有确认状态仍存在，退出期间可能解引用空指针并崩溃。

## Decision

让 `MsimeIbusEngine` 的完整定义在异步完成回调之前可见，并在 `translation_complete` 和 `online_complete` 入口检查 `self->state`。状态已清空时传播并释放任务返回的字符串后立即返回；正常生命周期继续沿用现有会话、代次和请求新鲜度检查。回归脚本同时钉住翻译、在线候选和已有剪贴板回调的检查顺序。

## Alternatives considered

- 在完整类型定义之后增加生命周期辅助函数：能避免移动结构体，但会把关键保护隐藏在辅助函数中，静态门禁无法直接确认回调入口顺序。
- 取消后台任务：需要跨请求协调取消和回调清理，扩大改动范围，且 `GTask` 已保证 Engine 生命周期。
- 仅依赖会话或代次检查：这些检查本身需要先读取 `State`，无法保护析构窗口。

## Verification

`python3 scripts/test-linux-async-state-callback-guard.py` 通过。`bash platforms/linux/build-container.sh` 完成 IBus/Fcitx5 生产目标编译，C++ 回归构建通过，79/79 个 Linux 测试通过。

## Consequences

Engine 销毁后完成的翻译和在线候选结果会被安全丢弃并释放，不再访问已释放状态；正常请求处理路径和任务持有关系不变。
