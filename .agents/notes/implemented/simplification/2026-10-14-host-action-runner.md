# Agent Note: 宿主操作按钮复用公共异步 runner

Status: implemented

## Problem

`HostActionButton` 自行维护运行锁、忙碌状态、挂载检查和成功失败收尾。公共 `useAsyncActionRunner` 已承担同样的操作生命周期，保留两套实现会重复维护 StrictMode 与卸载守卫。

## Decision

按钮使用公共 runner 的 `busy` 与同步运行锁，成功回调通过 `isCurrent` 接受结果，错误格式化只返回原有固定提示或调用方指定的提示。按钮继续保留成功或失败状态，保证调用方传入空错误文案时仍保留错误提示节点。

操作归属仍为按钮的挂载生命周期；不把 `action` 的函数身份加入 owner，父页刷新或替换回调不会改变已经提交的动作。缺少能力时禁用、处理中标签与 `aria-busy` 保持现有语义。公共 runner 不修改。

## Alternatives considered

- 保留局部实现：全部状态都写在按钮旁，容易阅读，现有行为测试已经覆盖主要路径。代价是继续复制公共工具已经提供的运行锁和生命周期收尾。
- 把 `action` 作为 owner：可隔离不同回调的结果，但父页传入的回调可能随重画改变，会取消本来仍有效的操作反馈；本次保留按钮原有挂载边界。

## Verification

宿主按钮的行为测试在抽取前后通过；抽取后进一步加强 StrictMode 的完成与再次点击检查，当前 10 项覆盖 StrictMode、同步和异步失败、重复请求、错误脱敏、重试、错误码及空提示、父页更换回调期间的忙碌和完成反馈。连同 `tests/core/use-async-action-runner.test.tsx` 和 `tests/core/async-action.test.ts` 共 18 项通过；公共 runner 的既有测试覆盖卸载时挂载守卫失效。删除仅检查直接调用 `useMountedRef` 的旧源码断言，实际行为由组件与 hook 测试验证。验证范围为共享前端行为与构建，宿主已经执行的动作由宿主自身控制。

## Consequences

按钮共用同步运行锁、挂载检查和忙碌收尾，减少本地生命周期实现。公共 runner 开始时清空错误，按钮在同一轮清空结果状态，旧提示随新动作消失；`onError` 独立设置失败状态，使空错误文案也保留提示节点。错误格式化和成功提示仍由按钮负责。挂载检查保护界面反馈，不取消宿主已经执行的动作。

## Existing notes audit

当前笔记树没有 `HostActionButton` 或宿主操作按钮的同机制记录。双拼编辑器与词库列表的 runner 复用记录属于不同消费者，保留各自业务归属；本篇只记录按钮的挂载边界与固定错误提示，没有吸收其他笔记。
