# Agent Note: Linux 候选翻译过滤显示专用来源

Status: implemented

## Problem

Host API 的共享翻译查询已经把 Emoji、颜文字、日文混输和脚本插件来源（6、7、13、14）标成不应请求在线释义。Linux IBus 和 Fcitx5 在交给用户管理的翻译 socket 前把候选转换成只有文字的协议，来源标记因此丢失；含汉字的特殊候选可能被发送给翻译服务。

## Decision

Linux 两个原生宿主在丢弃来源元数据前，按当前候选页的索引检查来源 6、7、13、14，并从自动在线翻译请求中排除这些行。未知或索引不匹配的候选保持可请求，避免损坏的视图把普通候选静默丢掉。显式 `/fy` 和“翻译当前句子”请求继续使用用户明确选择的文本，不受候选来源门控影响。

## Alternatives considered

- **只依赖 `online_gloss` 字段**：Linux 的 provider socket 协议只有文本数组，转换前没有可携带的字段可供服务端判断。
- **按候选文字过滤**：特殊来源可能包含汉字，文字判断会把颜文字或日文混输误当成中文；相同文字的普通候选也不能安全区分。
- **过滤所有未知或不匹配的行**：会在视图短暂不一致时丢掉正常候选，且来源门控本身只针对已知的显示专用来源。

## Consequences

自动候选翻译服务不会收到 Emoji、颜文字、日文混输或脚本插件行；普通、英文和云候选仍按原有协议请求。离线词典路径保留位置对齐并由 Host API 清空这些来源的释义，手动翻译动作保持原有语义。

## Verification

`platforms/linux/tests/candidate/candidate_translation_policy.cpp` 覆盖来源门控，先在函数缺失时确认编译失败，再通过实现后的编译和运行。`git diff --check` 与 `pnpm run verify-notes` 通过；`bash platforms/linux/build-container.sh` 编译 IBus/Fcitx5 及 provider 目标，并通过全部 83 项 ctest（含修改后的 `linux-candidate-translation-policy`）。`scripts/verify-local.sh --quick` 的合约、Rust、桌面组件和共享 Apple bridge 阶段通过；Linux 首次容器编译已由同一修复后的构建通过，首次 quick 的 macOS 阶段因本机磁盘耗尽未完成。
