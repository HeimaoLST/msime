# Agent Note: 触屏「我的 › 隐私」打开应用里的隐私页，不再直接跳网页

Status: implemented

## Problem

鸿蒙手机「我的」里的「隐私」行（右侧写着「本地优先」）点下去直接调 `onOpenUrl(privacyUrl)`，离开应用、在浏览器里打开一整篇隐私政策。仓库负责人：「直接打开网页？？？这什么鬼逻辑」。用户点「隐私」想知道的是自己的数据怎么处理、能关什么，不是一篇法律文本。

## Decision

- 新增设置页 `privacy`（「隐私」），`subPageParents` 挂在 `account` 下，属于「我的」标签。`settingsPageProjections` 只在触屏宿主上提供它：桌面的隐私设置在「关于」里。
- 页面只由设置界面内部打开，不增加宿主 `SettingsCategory`；macOS 的 `settings_route_coverage.py` 在 `NOT_ROUTED` 中声明这个边界，避免把触屏子页误报为缺少宿主路由。
- 页面三组：
  - 「你的数据」：三句话，标题是结论，说明是条件：
    - 打的字留在手机上（「云联想」默认关闭，打开后才把正在打的拼音发给 Google 输入工具）；
    - 语音和 AI 对话只在用的时候发出（只发那一次的录音或文字）；
    - 皮肤、词库和统计不会自动上传（只有点「上传本机设置」或主动发布作品时）。

    依据是仓库根目录的 PRIVACY.md。
  - 「匿名使用统计」：和「关于」页同一个 `TelemetryRow`，开关写 `usage_reporting`，下面是「发送哪些内容 ›」。
  - 最后一行「完整隐私政策 ↗」，明确标成外链，点了才去浏览器。
- 「我的」的「隐私」行优先用 `onOpenPage("privacy")`；没有设置页可开的宿主才退回直接打开网页。
- 外壳只在当前就是这一页时才渲染它。它和「关于」用同一个统计开关，常驻渲染的话，桌面上会有两个同名开关。

## Alternatives considered

- **在应用里用 WebView 打开隐私政策网页。** 还是一整篇法律文本，只是不离开应用；而且设置页本身就是 WebView，套一层又要处理返回。
- **把「隐私」行直接指到「关于」页。** 「关于」里隐私只是最后一组，进去还要找。

## Consequences

- **收益**：点「隐私」看到的是三句能看懂的话和能操作的开关，想看全文的人还在最后一行。
- **代价**：三句话和 PRIVACY.md 要一起维护，PRIVACY.md 里的行为变了（例如云联想的默认值），这里也要改。

## Verification

- `apps/desktop/tests/settings/privacy-page.test.tsx`：
  - 鸿蒙手机打开「隐私」页，分组是「你的数据」「匿名使用统计」；
  - 关掉统计保存 `usage_reporting: false`；
  - 只有点「完整隐私政策」才打开网页；
  - Windows 上没有这一页。
- `apps/desktop/tests/account/account-page.test.tsx`：点「隐私」调用 `onOpenPage("privacy")`，不打开网页。
- `apps/desktop/tests/settings/settings-page-registry.test.ts`：页面列表和 `subPageParents` 加上 `privacy`。
- `platforms/macos/tests/settings/settings_route_coverage.py`：共享页面全部有宿主路由或明确的内部入口说明，`privacy` 按触屏子页核对。
- 没有装到模拟器上看：模拟器当时正被仓库负责人使用。
