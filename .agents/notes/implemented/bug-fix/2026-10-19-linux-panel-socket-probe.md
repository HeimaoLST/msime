# Agent Note: Linux 面板 socket 探测不等待监听队列

Status: implemented

## Problem

IBus 与 Fcitx5 共用 `PanelInputSocket`，后启动的宿主会连接已有路径以判断是否已有服务。探测使用阻塞 `connect()`；已有监听者来不及接受连接、队列已满时，宿主的初始化线程会无限等待。仅把探测改成非阻塞而沿用“连接失败就删除”也不正确：队列满的 `EAGAIN` 会让后来的宿主删掉仍在服务的路径。

## Decision

探测沿用监听 fd 的 `SOCK_NONBLOCK | SOCK_CLOEXEC`，保存 `connect()` 的错误再关闭 fd。成功连接或非 `ECONNREFUSED` 错误均保留路径并返回失败；仅明确拒绝连接才允许回收残留 socket。回收前复查设备号与 inode，路径已经变化时放弃本次打开。

## Existing notes

检索活跃笔记中的 `PanelInputSocket`、`panel-input.sock`、面板通信与套接字，没有已有的探测行为笔记。[语音 socket 就绪](../../implemented/bug-fix/2026-10-09-linux-voice-provider-socket-ready.md)处理测试的 bind/listen 启动竞态，与本次宿主竞争监听路径无关，保留原决定。

## Alternatives considered

- 带超时的阻塞探测：可以等待暂时繁忙的服务恢复，但该入口只需判断能否接管，等待仍会拖住宿主初始化，且多出轮询和超时策略。
- 非阻塞探测后遇错一律回收：代码最少，但无法区分繁忙监听者、协议或权限问题与确定失效的 socket，会替换仍有效的服务路径。

## Verification

新增真实 Unix socket 回归：填满队列后，子进程探测必须在两秒内退出并拒绝接管，路径保留原设备号与 inode；旧实现在该断言失败。另覆盖正常监听者不被替换、已关闭的残留 socket 重新监听、协议不匹配的 socket 保留。定向测试在 Linux 容器内以 `-Wall -Wextra -Werror` 编译并通过。`bash scripts/verify-local.sh --quick` 通过：Rust 工作区、Linux 设置外壳、IBus/Fcitx5 原生构建与 90/90 项测试、full/五笔版安装隔离和 Apple 桥接层构建通过；其他无关平台按改动范围跳过。未进行真实桌面输入框验收。

## Consequences

后启动的宿主无需等待繁忙监听者，已有服务的路径在探测结果不确定时保留。设备号与 inode 复查只缩小路径替换窗口，不提供跨进程原子锁；本次不扩展监听者选举协议。未知探测错误保留路径，可能需要原服务恢复或用户清理确实损坏的运行目录。

根因与错误码语义对照 [Linux connect(2)](https://man7.org/linux/man-pages/man2/connect.2.html)：非阻塞 Unix socket 的 `EAGAIN` 不等同于无人监听的 `ECONNREFUSED`。
