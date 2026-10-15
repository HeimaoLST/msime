# Agent Note: Windows Aux 确认读取保留有界等待

Status: implemented

## Problem

Windows 打字统计开启后，字数持续更新而 `dailyKeys` 为空。TSF 在开始保存按键次数前，必须通过 Aux 管道发送空 `TypingKeys` 探测并收到 `OK`。现有发送函数先写消息，再调用 `SetNamedPipeHandleState` 切换读取模式；在本机真实 Server 上，消息写入成功后该调用立即返回 `ERROR_PIPE_BUSY`，函数退出，TSF 将统计视为关闭。仅检查扫描码映射、统计模型和 Server 接收端的测试覆盖不到这条实际发送路径。

## Decision

在需要确认的消息发送前设置 `PIPE_READMODE_MESSAGE | PIPE_NOWAIT`，继续用既有 `ReadFile` 轮询读取回复，维持现有 150 毫秒等待上限。不等待确认的调用只写消息。正常回复必须恰好是两个 UTF-16 码元 `OK`；拒绝、断开、超时或异常长度均不视为同意。发送逻辑抽为 TSF 内部函数，由产品包装绑定本版本管道名；回归测试调用同一个函数，以独立命名管道和合成消息覆盖即时、延迟、拒绝和无效回复，不修改真实统计。

统计探测、按键批次和现有 Aux 请求仍使用原协议；Server 的消息模式、等待模式和跨会话校验继续成立。开始计数前必须收到同意、关闭后共享库拒绝写入的约束不变。

## Existing note audit

- [Windows 原生打字统计页](../feature/2026-10-11-windows-settings-typing-statistics.md)：部分重叠，保留页面及统计状态接口决定，本篇补充 TSF 采集入口的确认读取与运行验证。
- [输入统计锁绑定目录句柄](2026-10-09-typing-statistics-lock-directory.md)：保留存储与跨进程锁约定，本次合成测试已确认共享库可以追加并读取按键次数，不改变落盘方式。
- 其他检索命中的移动键盘布局、界面和 Linux 异步任务笔记与本次管道故障无关；没有被完全吸收的旧篇或过时提案。

## Alternatives considered

- 将模式设为 `PIPE_READMODE_MESSAGE` 并用 `PeekNamedPipe` 轮询后读取。它同样通过真实 Server 的空探测，可以在读取前确认已有数据；没有采用，因为模式设置移到写入前后，原有非阻塞读取也能收到 `OK`，保留既有读取方式可以缩小需要重新验证的路径。
- 延长探测重试或缩短统计关闭后的重试间隔。这样可以容忍 Server 暂时不可用，并让开启后的新按键更快开始统计；没有采用，因为模式切换在消息写入后立即失败，不是重试间隔或等待时间不足。
- 将整个 Aux 写入和读取改成重叠 I/O。这样能用事件明确限制每次传输的等待时间；本次优先保持既有发送路径，修正确认读取的必要部分，避免同时重构不等待确认的 Aux 调用。若现有同步传输出现阻塞问题，再独立处理取消与句柄生命周期。

## Consequences

- TSF 收到有效确认后可以开始按键计数；需要确认的其他 Aux 请求也使用同一条修正路径。
- 内部发送函数多一个管道名参数，产品只传入已有版本常量，测试传入独立名字；这让测试与产品执行同一套 Windows 调用顺序。
- 150 毫秒只限制确认轮询，连接重试和原有同步写入有自己的行为。本次没有把整个 Aux 调用改成可取消的重叠 I/O。
- 真机已有进程仍会持有安装前的 TSF DLL，源码和构建产物更新不能让这些进程自动换用新 DLL。
- 独立管道及共享库的合成测试不能单独证明真实编辑器中的按键已经显示在热力图上，运行验收需明确区分。

## Verification

- 本机真实 Server 的空探测对比：原样发送函数写入成功后在模式切换处返回 `ERROR_PIPE_BUSY`；新生产函数将模式设置移到写入前、保留原确认轮询后收到恰好两个 UTF-16 码元 `OK`。探测的计数表为空，不写入真实统计。
- 真实 Windows 线程池与原 `KeyPressStatisticsQueue.cpp` 的合成探测、计数、刷新测试通过；共享库在独立合成目录完成 `set_enabled → record_keys → load`，读取到预期三次按键，临时数据已清理。
- 新增 `windows-aux-namedpipe-sender` 测试调用产品内部函数，覆盖即时与延迟确认、否定回复、短帧、不完整码元、多余字节、断开、超时、迟到回复和不等待确认的发送，并注册在 quick 编译的 native-pipe 工程中。MSVC `/W4 /WX` 构建与 CTest 通过；在临时构建头文件中恢复旧调用顺序，同一测试退出 1，确认能拦住原故障。
- 本任务 x64 TSF DLL 经 MSVC 构建及链接通过，`msime-tsf-passthrough-statistics` 与 `msime-tsf-key-press-statistics` 两项测试通过。未更新已签名安装版，也未验证真实编辑器输入后热力图的显示。
- `bash scripts/verify-local.sh --quick` 退出 0，输出 `quick check passed`。可运行合同、笔记及归档封印、Windows Rust workspace 检查和包含新测试的 pipe-only MSVC Debug 编译通过；没有增加失败基线。默认完整原生构建目录未配置，本次另行构建上述 TSF 目标；缺少设备、资源或其他平台工具链的阶段按现有门禁跳过，不能视为对应平台验收。
