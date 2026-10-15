# Agent Note: 背单词的文件读取和确认绑定客户端代次

Status: implemented

## Problem

`VocabularyReviewPage` 用 `requestRef` 隔离已发出的旧请求，但导入文件的读取、清空进度和删除词书的确认都发生在进入该请求槽位之前。等待期间替换客户端后，旧回调仍能发起旧客户端的修改，旧读取错误及导入成功提示也能污染新页面。客户端 A 切到 B 再切回同一个 A 对象时，仅比较对象身份无法识别原操作已经过期。

## Decision

复用 `useAsyncGeneration(client)`，在文件读取与确认之前捕获代次，`update` 在调用宿主前检查捕获代次，结果写入继续同时检查代次和请求槽位。读取错误与导入提示也检查相同代次。已经发出的宿主操作完成底层调用，但不再更新失效页面。

## Alternatives considered

- 比较客户端对象可直接识别 A 到 B 的替换，代码也少；但 A 到 B 再回 A 后旧确认会重新生效，因此使用单调代次。
- 只保护请求返回值可保持现有串行机制；但删除、清空和导入的副作用已经发生，守卫必须放在调用之前。

## Verification

新增用例在修复前 5 项失败，既有 22 项通过；修复后该文件 29 项全部通过，覆盖旧文件读取成功/失败、旧导入成功、两个破坏性确认、正常导入，以及新旧代次复用同一 Promise 时的请求归属。桌面类型检查和生产构建、改动文件的 lint 与格式检查、笔记门禁、`git diff --check` 均通过。

`bash scripts/verify-local.sh --quick` 输出 `quick check passed`；包含仓库契约、Rust workspace、Android 目标和 Linux 设置外壳编译。Wasm 和原生宿主按改动范围跳过；Windows 缺 MinGW、HarmonyOS 缺 hvigorw/已准备资源；macOS desktop crate 因没有原生 bundle 跳过。测试使用合成客户端和文件，不代表原生宿主装机验收。

## Consequences

不取消已经发出的宿主修改；只拒绝失效交互继续发起操作和写入界面。改动仅在共享 React 层，不改变词书文件读写实现或宿主协议。

## Related notes

- [旧 MCP 确认的边界](../../implemented/bug-fix/2026-10-14-mcp-stale-entry-confirmation.md)：同样的异步交互守卫原则，属于另一个组件，不合并决定。
- [词书进度原子清空](../../implemented/bug-fix/2026-10-12-vocabulary-reset-settings-atomic.md)：保护底层存储原子性，与本次界面交互归属互补。
- [iOS 可见请求代次](../../implemented/simplification/2026-10-13-ios-visible-request-generation.md)：原生 Swift 界面，非本次 React 页，不修改。
