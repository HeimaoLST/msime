# Agent Note: 触屏首页的「试用键盘」切到「对话」标签，不再单开试用页

Status: implemented

## Problem

[触屏底部标签栏的第二格换成「对话」](2026-10-11-touch-chat-tab-replaces-community.md) 之后，鸿蒙手机上出现了两页用途相同的东西：

- 「设置」首页状态卡片上的「试用键盘」推入子页面 `try-keyboard`（`TryKeyboardPage`，见 [触屏「设置」首页的试用键盘改为聊天样式的子页面](2026-10-08-touch-try-keyboard-page.md)）：一页对话，打字发给 AI。
- 底部「对话」标签是 `ChatPage` 的触屏版：同样是一页对话，空状态写着「打几个字试试键盘」。

两页各有缺漏：试用页没有模型目录的重试、居中的登录引导，切走就丢记录；对话页没有试用页的设置引导（「水杉还没启用？点此开启」）和「收起键盘」。Android 和 iOS 的原生 App 已经让首页的「试用键盘」直接切到「对话」标签（#7163、#7157）。仓库负责人问「试用键盘和对话不是一个东西？」，确认要合成一个。

## Decision

- 触屏首页 `TouchHomePage` 接收 `onOpenChat`。「试用键盘」的顺序是：宿主有 `openKeyboard` 就打开宿主自己的键盘；没有、或打开失败时，有对话就调用 `onOpenChat` 切到「对话」标签，没有对话才推入 `try-keyboard`。
- 外壳给首页的 `onOpenChat` 在切页之前把 `chatFocusRequest` 加一，`ChatPage` 的 `focusRequest` 每变一次就把焦点交给输入框，系统随之弹出键盘。点底部标签进来不加，所以照旧不弹键盘。切页和加一在同一次渲染里提交，聚焦发生时对话页已经不再 `hidden`。
- `settingsPageProjections` 只在触屏、有首页并且**没有对话**时提供 `try-keyboard`。有对话的宿主不再有这一页，`window.history` 里留下的旧 `try-keyboard` 记录按「页面不可用」落回首页。`TryKeyboardPage` 保留给有首页而没有对话客户端的触屏宿主。
- `ChatPage` 的触屏顶栏接过试用页的两样东西：
  - 设置引导：`setup` 传入宿主的 `SetupActions`（外壳给的是 `client.home`），按 `useImeSetupState` 的状态显示「水杉还没启用？点此开启」（打开系统设置）或「当前不是水杉输入法？点此切换」（打开输入法选择器），都完成后不显示。宿主动作失败时弹 toast。试用页在鸿蒙上本来就不给「切换输入法」去换走水杉（`switchAway={false}`），对话页同样不给。
  - 「收起键盘」：输入框有焦点时出现，按下不抢焦点，点按让输入框失焦。打字时底部标签栏是让开的，这也是不用系统返回手势就把标签栏叫回来的办法。

## Alternatives considered

- **反过来，删掉「对话」标签，只留试用页。** 用户已经拍板第二格是「对话」，而且对话页有切走不丢记录、模型目录重试这些试用页没有的东西。不用。
- **两页都留，只把样子做一致。** 改动最小。不用，是因为用户问的正是为什么有两个，而且两份实现会各自继续分叉，每次改对话的样子或错误处理都要改两遍。
- **把 `try-keyboard` 改成指向 `chat` 的别名路由。** 能让旧历史记录直接落到对话页。不用，因为别名要在外壳的页面注册、标签页记忆和返回逻辑里各开一个口子；旧记录落回首页的代价只是多点一下，而且只发生在升级后的第一次。

## Consequences

- **收益**：鸿蒙和 Android、iOS 一致，试用键盘只有一个地方。设置引导、收起键盘、对话记录保留、打字时让开标签栏都在同一页。
- **代价**：对话页的顶栏在设置没补完、或正在打字时多出一两个胶囊。从首页进来的对话没有试用页那条「你好，我是水杉输入法」的问候，空状态的「打几个字试试键盘」代替它。试用页的 Markdown 链接交给外部浏览器，对话页的触屏版关掉了链接（设置页跑在 WebView 里，点链接会把整页导航走），所以从首页进来以后回复里的链接不再可点。

## Verification

- `apps/desktop/tests/core/home-page.test.tsx`：有对话时「试用键盘」调用 `onOpenChat`，宿主键盘窗口打开失败时也是；没有对话时仍推入子页面。
- `apps/desktop/tests/core/mobile-tab-bar.test.tsx`：鸿蒙外壳里从首页点「试用键盘」落到「AI 对话」、输入框获得焦点、标签栏让开，「收起键盘」后标签栏回来；设置引导胶囊随宿主状态变化，分别调用打开系统设置和输入法选择器，设置补完后消失。
- `apps/desktop/tests/settings/settings-page-projections.test.ts`：触屏宿主有对话时不提供 `try-keyboard`。
- HarmonyOS phone 模拟器上的验证见 PR。
