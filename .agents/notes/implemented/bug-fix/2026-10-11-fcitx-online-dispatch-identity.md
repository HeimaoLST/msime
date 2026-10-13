# Agent Note: Fcitx5 网络分发身份独立于缓存探测与显示

Status: implemented

## Problem

按成功显示查询去重仍让云、AI 的空结果和失败每个 tick 重发。AI 缓存命中也被当作成功显示同一查询，反而阻止防抖后的真正网络刷新，用户只能看到缓存答案。

## Decision

每个来源的 `online_dispatched_queries_` 在网络任务成功创建后记录查询。空结果、失败和成功均不对同一查询重复分发；输入查询变化或会话、provider、来源配置失效后重新请求。AI cache-only 探测不写网络分发记录，命中先显示，未命中继续等待空闲防抖，二者均允许一次网络刷新。不新增缓存或 ABI。

原生回包夹具先实际分发，再模拟完成结果；新组合的 AI 用例先消费探测再断言网络分发。隔离 daemon/frontend 用真实合成 socket 检查 `ai_cache_only` 与网络次数，两次组合分别请求一次网络，而不是用 future 存在冒充已请求。离线缺失夹具使用测试局部的 C++ RAII 对象恢复资源目录与数据库，正常和异常退出均核对恢复结果；不依赖 Fcitx5 新版本才提供的 `ScopeExit`。两套真实 daemon 测试复用 `daemon_environment`，统一临时目录与 XDG 状态隔离，避免复制启动夹具后漂移。创建 daemon 前断言 `XDG_STATE_HOME` 指向夹具目录，防止提取函数时漏带状态隔离而写入用户级统计文件；该遗漏在补审时发现，断言先失败，补回环境变量后通过。

## Alternatives considered

- 只对成功显示结果去重，不阻止临时错误后的恢复；但请求失败或空答案会持续重发，而且缓存命中误占网络记录。本次移除这个分发条件。
- 空结果与失败做有界退避，能在用户不改输入时自动恢复；但需要额外计时与重试状态。当前采用每查询一次，若未来明确要求后台恢复，再引入有界退避，不恢复每 tick 重试。
- 保留独立显示查询，再加网络查询和探测完成状态，能分别追踪所有阶段；但当前显示查询除去重外没有用途，已有网络身份和在途槽足够。
- Fcitx5 的 `ScopeExit` 能复用宿主已有工具，代码最少；但本机 5.1.23 有此类型，CI 固定 Debian 环境的 5.0.21 没有。C++23 的 `std::scope_exit` 也不在当前 C++20/GCC 12 基线上，因此改用只属于这个夹具的局部析构恢复对象，不新建通用 helper。

## Verification

`fcitx5-online-cloud-empty`、`cloud-failure`、`ai-empty`、`ai-failure`、`ai-cache-hit` 五个独立 D-Bus 场景均先失败：前四项捕获重复网络请求，缓存命中项捕获网络刷新缺失。修改分发后五项通过，每个场景两次组合各有一次网络请求，AI 每次另有一次探测，缓存先显示且随后被新答案替换。

原生云/AI 夹具中途异常恢复断言先失败，加作用域恢复后通过；新组合消费探测后能实际分发网络请求。最终 Linux 全量 CTest 90 项通过，包含新登记的五个分发场景与 IBus 空结果用例；共享 Runtime 177 项与 Host API 428 项通过。原有六个云/AI、延迟和部分翻译回包场景复跑通过。合入上游 `23ba3a6d7` 并补足 AI 空座位释义保留后，Linux 93 项、Runtime 180 项、Host API 432 项及六个隔离翻译场景再次通过，保留上游 Caps Lock 与 AI 座位新测试。所有输入、配置、候选和 provider 都是合成值，不用当前账号或词库输入数据。

CI 在 `596be40a8` 编译 `fcitx5-native-test` 时报告 `ScopeExit is not a member of fcitx`；在同款 Debian/Fcitx5 5.0.21 镜像中，用最小头文件编译稳定复现。该问题属于测试依赖版本兼容，不改变产品行为。修复后在同款 Debian/Fcitx5 5.0.21 镜像编译原生测试目标，再完成 `build-container.sh` 的拼音/五笔构建与 80 项测试；挂载只读核心资源后，`fcitx5-native-context`、`fcitx5-native-ai` 两项也通过，覆盖正常与异常退出后的文件和资源目录恢复。本机 Linux 93 项及 `verify-local.sh --quick` 通过。容器沿用锁定依赖，使用本机依赖缓存离线构建、并发限制为 4，不修改 CI 或产品配置。随后发现 PR 远端已合入上游，快进到 `bbac26493` 后重跑以上门禁仍通过；最终日志为 `target/pr7046-ci-fixes-latest-{container-gate,debian-native,linux-all,quick}.log`。构建镜像若登记完整资源套件，额外六项 daemon 场景会因缺 Python `dbus` 失败，因此容器保持 CI 原本无资源的 80 项范围，原生两项单独运行，完整 daemon 场景由本机 93 项覆盖；不改变 CI 依赖或绕过原有测试。缺依赖的最小复现留在 `target/pr7046-ci-build-gate-dbus-limit.log`。

## Consequences

网络请求不会因空结果和失败循环重发，AI 保留快速缓存展示与后台刷新。代价是相同查询失败后等待输入或配置变化才重试，不保证无交互的网络恢复。原生与隔离入口验收不等于重新安装后的真实编辑器验收，本次不替换本机插件。

## Related notes

[已显示在线查询去重](2026-10-11-fcitx-online-refresh-translation-flicker.md) 部分重叠：保留宿主分发去重归属，本决定取代其成功显示条件与失败重试策略。[在线候选交集保留](2026-10-11-online-candidate-gloss-retention.md) 和[同代次释义合并](2026-10-11-generation-gloss-merge.md) 负责显示，不承担分发身份。检索命中的[在线批次词条去重](../testing/2026-10-08-online-batch-existing-dedup.md) 处理批内重复，不吸收其规则。
