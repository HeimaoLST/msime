# Agent Note: 桌面设置入口复用公共路由订阅清理

Status: implemented

## Problem

`DesktopSettings` 在 `settings-route` 监听旁手写取消函数保存、晚到注册释放和卸载释放，与公共 `trackAsyncSubscription` 重复。该 effect 还初始化宿主、首开页面与首启状态，`active` 保护整段异步初始化，不能随句柄清理一起移走。

## Decision

入口立即判断 `isTauri()` 并调用 `listen`，把返回的 Promise 交给公共工具。事件仍使用 `active` 并过滤空 payload；effect 清理先使 `active` 失效再释放句柄。宿主初始化保留两处 `active` 检查和既有调用时序。

公共工具的空注册结果与释放契约归[窗口状态订阅笔记](../../implemented/simplification/2026-10-14-window-state-subscription.md)。已检索 `DesktopSettings`、`settings-route`、入口路由和异步监听：原生生命周期笔记中的设置路由覆盖是原生宿主的页面表检查，Windows 账号页笔记持有原生页面和客户端能力，均与本次入口句柄持有不同；保留这些独立决定。

## Alternatives considered

- 抽取整个宿主初始化 hook：可显著缩短入口文件，但会移动宿主能力、首启状态和页面初始化等多个决定，超出相同句柄清理的复用范围。
- 把 `listen` 放到新的 Promise 续接中：可以统一同步异常处理，但会推迟宿主监听注册；当前 Tauri `listen` 是异步函数，直接调用的拒绝已由公共工具处理，无需改变注册时序。

## Consequences

入口复用公共句柄清理，移除重复的取消函数保存和晚到释放逻辑。`active` 仍由入口持有，保护事件与两处宿主初始化检查；退出不取消宿主已经开始的异步操作。

真实入口的六项生命周期测试在原实现和迁移后均通过，覆盖立即注册、空 payload、重复请求 nonce、正常与晚到释放、StrictMode 旧监听失效、注册拒绝、退出后的初始化失效和非原生环境。连同公共清理工具和真实设置页路由测试，共三文件十一项通过。

入口测试替换页面输出，只验证入口传递的 props 与生命周期；公共页面的导航与未保存草稿行为由既有 `macos-settings-routes` 测试覆盖。本次验证针对共享前端，不作为原生宿主装机验收。
