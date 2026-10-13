# Agent Note: iOS 原生对话页不让用户选模型，由后端决定

Status: implemented

## Problem

iOS App 的「对话」标签页（`KeyboardTryoutView` / `KeyboardChatModel`，`platforms/ios/App/Sources/keyboard/KeyboardChatView.swift`）进页面先请求 `/v1/models`，顶栏放一个模型下拉（`keyboardChatModelPicker`），发送时把选中的 id 作为 `model` 发给 `/v1/chat/completions`。仓库负责人的产品决定是：账号对话不让用户选模型，用哪个模型由服务端决定。水杉后端在请求不带 `model` 时用它配置的默认模型，服务端的备用模型另行加上。客户端继续挑模型，等于把这个决定留在了客户端：后端换默认模型或加备用模型时，已经选定某个 id 的用户不会跟着走，目录里的 id 下线后还会收到 400「请刷新模型列表」。

## Decision

- 共享的 Swift 账号客户端 `BackendAccountClient.chat(messages:model:...)`（`shared/backend/clients/BackendChatClient.swift`）的 `model` 改成 `String? = nil`。为 nil 时请求体里没有 `model` 这个键（合成的 `Encodable` 对可选属性用 `encodeIfPresent`），不是空字符串也不是 null；传了 id 时照旧校验并发送。已有的调用方传 `String`，不受影响。
- `KeyboardChatModel` 不再加载模型目录：去掉 `models`、`selectedModel`、`loadingModels` 和顶栏的模型下拉。`loadModels()` 改名为 `loadAccount()`，只确认当前账号与会话（`BackendAccountSession.user()` 加 `credentials(matchingUserID:)`，必要时会刷新令牌），账号切换时清空对话的逻辑不变。发送时不传 `model`。
- 顶栏在账号就绪后只剩 EveryAPI 标识；未登录或后端返回 401 时显示「登录使用 AI」，确认账号失败（网络等）时显示「重新连接」，两者同一个按钮 `keyboardChatAccountButton`。发送按钮的可用条件从「已选模型」改成「账号已确认」（`accountID != nil`）。
- 错误文案里不再提模型：404 是「聊天服务正在更新，请稍后重试。」，400 是「这条消息暂不受支持，请修改后重试。」。

范围只是这一个页面。以下地方仍然带模型，这次不动：

- `AISkinService.generate` 仍先拉 `/v1/models`，再把 `default_model` 传给 `chat`。那里没有给用户选，结果与不传相同，只是多一次请求；要省掉它是另一处改动。
- `SkinGenerationModel`（`platforms/ios/App/Sources/voice/SkinGenerationModel.swift`）有自己的模型目录和 `selectedModel`，但目前没有任何视图使用它。
- 用户自填服务商和密钥的「AI 润色与回复」等设置里的模型选择，是用户自己的服务，不属于账号对话。
- Rust 的 `msime-client-core` 也有账号对话的请求类型（`AccountChatMessage`、`chat_models`），`model` 仍是必填，但没有任何宿主调用它，iOS 走的是上面的 Swift 客户端，所以不改。
- 共享设置界面的 `ChatPage`（鸿蒙、Android、iOS Tauri 界面的「对话」标签）和 Android 原生对话标签已经按同一个产品决定去掉了模型选择，见 [共享对话页由服务端选模型](2026-10-11-chat-server-picks-model.md) 和 [Android 对话由服务端选模型](2026-10-11-android-chat-server-picks-model.md)。

## Alternatives considered

- **保留模型目录请求，只把下拉藏起来，发送时传 `default_model`。** 最强的理由是改动最小：`/v1/models` 顺带验证了会话，`chat` 的签名也不用动，`AISkinService` 已经是这么做的。不用它：客户端仍在替后端挑模型，后端只能通过改 `/v1/models` 的 `default_model` 来换模型，服务端的备用模型（主模型不可用时换另一个）也不能在请求层面生效；每次进页面还多一次网络请求。
- **请求里发空字符串 `model: ""`。** 理由是请求体形状不变，后端也接受空值。不用它：`model` 缺席比空字符串表达得清楚，Swift 端原有的 `validChatModelID` 也会把空字符串当成非法输入拒掉，要么放宽校验，要么特判空串，都比让键缺席更绕。

## Consequences

- **收益**：iOS 原生对话用哪个模型完全由后端决定，后端换默认模型或启用备用模型时客户端不用发版；进页面少一次 `/v1/models` 请求；不会再因为目录里的 id 下线而让用户「刷新模型列表」。
- **代价与已知上限**：页面上看不出当前用的是哪个模型。进页面时不再有 `/v1/models` 那次带令牌的请求，账号若在服务端已失效，要到第一次发送收到 401 才提示登录（`credentials` 只在令牌过期时去刷新）。依赖后端「缺少 `model` 时用默认模型」这一契约，后端若改成必填，这里会在发送时收到 400。

## Verification

- `swift test --package-path shared/backend --filter BackendChatClientTests`：`testChatWithoutModelLeavesChoiceToBackend` 断言不传 `model` 时请求体里没有这个键，`testModelsAndSelectedModelReachBackend` 断言传了 id 时照旧发送。
- `OnboardingUITests.testKeyboardChatSendsAndDisplaysReply`：fixture 账号就绪后顶栏既没有 `keyboardChatModelPicker` 也没有 `keyboardChatAccountButton`，发送后显示回复。
