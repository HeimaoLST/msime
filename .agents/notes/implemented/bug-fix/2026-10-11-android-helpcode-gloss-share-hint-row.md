# Agent Note: Android 候选提示位的辅助码和释义共用一行

Status: implemented

## Problem

Android 每个候选只有一个提示位，由 `CandidateGlossPolicy.annotation` 填。它让 Engine 注释优先：只要 `annotation` 非空就只显示它，释义整个丢掉。双拼的 `shuangpin_helpcode.show_in_candidate_window` 默认为真（`crates/client-core/src/preferences.rs` 的 `default_shuangpin_helpcode`），host-api 把它传成 `show_helpcode`，Engine 就给每个候选的 `annotation` 填上辅助码。结果是双拼开着离线释义也看不到译文，只有长按菜单里有（#6997 第 1 项）。日语没有辅助码，所以同一位用户在日语键盘上能看到译文。五笔的剩余编码提示（`MSIMEInputService.candidateAnnotation(candidate, typed)` 里的 `wubiCodeHint`）同样会把释义挤掉。

另外 Android 的原生设置页 `TypingPage` 没有共享设置页 `helpcode-page.tsx` 里的「在候选栏中显示双拼/全拼辅助码」开关，用户想让辅助码让位，只能把辅助码整个关掉，Shift 筛选也一起没了。

## Decision

`CandidateGlossPolicy.annotation` 改成辅助码在前、第一行释义跟在同一行后面，用 ` · ` 隔开：`(ab) · my; mine`。第二目标语言的释义（`joinGlosses` 写进去的换行之后那部分）仍然各占一行。只有一种时就只显示那一种，和以前一样。读屏的 `accessibilitySuffix` 跟着画出来的内容走，两者都有时念成「，提示：…，英文释义：…」。五笔剩余编码走同一个 `annotation`，读屏在「，还需输入 …」后面接 `glossAccessibilitySuffix`。韩语汉字的 `hanjaAnnotation` 本来就是这种画法，不动。

`TypingPage` 的辅助码组在「辅助码方案」下面加一个开关，标题按方案叫「在候选栏中显示双拼辅助码」或「在候选栏中显示全拼辅助码」，和共享页手机版的文案相同，经现有的 `saveHelpcode` 写回当前那一族的 `show_in_candidate_window`。读取的默认值和 client-core 一致：整个对象缺失时双拼为真、全拼为假，对象在但缺这一项时按 serde 的 `enabled_by_default` 为真。只在辅助码开着时出现。这个开关只关显示，Engine 测试 `helpcode_display_toggle_keeps_candidates_and_filtering_enabled` 保证 Shift 筛选不受影响。host-api 已经按这个偏好设 `show_helpcode`，Engine 和 host-api 都不用改。

## 为什么不另起一行

候选条的高度由 `updateCandidateViewportHeight` 按 `CandidateTranslationPolicy.reservedGlossRows(candidateGlossLineCount(), …)` 定，它只数释义的目标语言行数，不知道辅助码在不在。辅助码共用第一行时，候选按钮的行数（`renderedOwnRowLines`）和只有释义时完全相同，`reservedGlossRows` 不用改，候选条（`updateCandidateButton`）和展开的候选面板（`ImeCandidates.expandedCandidateButton`）拿到的行数也都不变。

## Alternatives considered

- 照 macOS 的样子把释义放到辅助码下一行（`engineAnnotation + "\n" + translation`）：最接近桌面，也是用户在 issue 里提的样子。但候选条只按释义行数预留高度，一种目标语言时 42 dp 只装得下一行附注，两种目标语言时附注变成三行而预留只有两行，字会被裁掉。要让它装得下，就得在显示辅助码时多预留一行，键盘高度随方案和辅助码开关变化，这正是 `hanjaAnnotation` 的注释和 `reservedGlossRows` 文档里刻意避开的问题。
- 只补设置开关、提示位优先级不动：用户关掉辅助码显示就能看到释义，改动最小。但双拼默认开着显示，不知道这个开关的人仍然看不到释义；而且想同时看辅助码和释义的人没有办法。开关保留，作为让位的手段，不当作 #6997 的修法。

## Consequences

开着离线释义或候选翻译时，双拼和五笔的候选提示行同时有辅助码（或剩余编码）和第一行释义，候选条高度和以前一样。代价是提示行变长，候选按钮更宽，窄屏上一页能放下的候选可能少一两个。另一个代价是和桌面的排版不完全一样（桌面在放不下时把释义折到下一行）。

## Verification

`platforms/android/tests/candidate/CandidateGlossModelSmoke.java` 把原来的「Engine annotation has priority」改成共行断言，覆盖释义关闭、两种目标语言、超长释义和读屏文本；`CandidateTranslationPolicySmoke.java` 断言辅助码加释义和只有释义的 `renderedOwnRowLines` 相同。改动前两条新断言都失败，改动后通过。`platforms/android/check-host.sh` 加了一道源码守卫，要求 `TypingPage` 的辅助码组里有这个开关、按上面的默认值读取、写回 `show_in_candidate_window`；它在改动前的 `TypingPage` 上失败。`SettingsSearchIndexSmoke` 要求这两个标题能在设置搜索里搜到。设备上没有跑：双拼开离线释义、加第二目标语言、五笔，以及切方案时键盘高度是否不变，都还没在模拟器或真机上看过。
