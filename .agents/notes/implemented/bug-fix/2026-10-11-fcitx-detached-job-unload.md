# Agent Note: Fcitx5 detached worker 卸载生命周期

Status: implemented

## Problem

Fcitx5 宿主把偏好、在线候选、翻译、剪贴板、Emoji 和语音请求放到 detached thread，输入上下文关闭时主动丢弃 future 以免输入法线程等待网络。插件卸载时 `FcitxEngine` 只等待主题、遥测和按键统计任务；其余线程仍可能执行 `.so` 中的函数，动态库卸载后会跳转到失效代码。

## Decision

为所有 `detachedJob` 建立插件级活动计数和条件变量。每个任务无论正常返回还是抛异常都减少计数，创建线程失败也回滚计数；`FcitxEngine` 析构在 Fcitx5 卸载插件前等待计数归零。上下文关闭仍然可以丢弃 future，不在输入法主循环中等待 provider。

## Alternatives considered

- 只在每个 `FcitxState` 析构时等待：输入上下文可能早于插件卸载销毁，且会让失焦操作阻塞 provider，仍无法覆盖插件级任务。
- 继续只等待主题任务：其它 provider 和语音任务同样执行插件代码，风险仍在。
- 用固定超时等待：超时后仍允许 `dlclose`，无法保证安全；统一计数等待完整结束才能建立卸载前不变量。

## Verification

`python3 scripts/test-linux-fcitx-detached-job-lifecycle.py` 通过。`bash platforms/linux/build-container.sh` 完成 IBus/Fcitx5 与 full/wubi 构建，79/79 个 Linux 测试通过。

## Consequences

失焦和会话切换仍不等待 provider；真正卸载 Fcitx5 插件时会等待所有 detached worker 结束，避免线程在共享对象卸载后继续执行。退出时可能等待 provider 完成或响应取消，这是为了保住动态库卸载前的安全不变量。
