# Agent Note: 复用宿主操作错误提示

Status: implemented

## Problem

设置状态卡、试用键盘页和触屏聊天页都把宿主异步操作写成 `action().catch(errorMessage)` 后调用 toast。三处必须保持相同的错误映射和 provider 缺失时的静默行为，但各自维护实现会继续复制这段逻辑。

## Decision

把 `useToast` 与 `errorMessage` 的组合提取为公共 `useHostAction` hook。调用方仍直接执行传入 action；成功不显示提示，拒绝使用现有 `errorMessage`，没有 action 或没有 `ToastProvider` 时保持静默。不把发送请求、运行锁、挂载守卫或宿主动作取消纳入本次复用。

已检索既有笔记：`host-action-runner` 记录的是带运行锁和挂载生命周期的按钮 runner，决定独立；试用键盘页笔记记录页面行为，均保留并与本次 hook 互链边界。

## Alternatives considered

- 保留三处局部函数：改动最小，但相同的错误提示契约会继续分散。
- 复用 `useAsyncActionRunner`：可提供运行锁和生命周期守卫，但会改变宿主动作完成后的忙碌语义；这些动作不需要取消或状态反馈，本次只抽错误提示组合。

## Consequences

三个消费者共享同一 `useHostAction` hook，保留 action 立即调用、成功静默、拒绝按 `errorMessage` 映射和无 `ToastProvider` 时静默的行为。hook 不增加运行锁、挂载守卫、取消或发送请求状态，调用方原有的生命周期和状态机不变。

新增 hook 测试覆盖立即调用、成功、拒绝和无 provider；设置首页、试用键盘页与聊天页的既有测试连同新测试共 4 个文件、67 项通过。桌面设置类型检查通过，修改文件格式和 diff 检查通过。

hook 只处理 Promise rejection；同步抛出的 action 仍保持调用方原实现语义。共享前端验证不代表原生宿主装机验收。
