# Agent Note: 鸿蒙键盘删光标前的文字改用 deleteForwardSync

Status: implemented

## Problem

鸿蒙键盘的退格删不掉已经上屏的文字：设置应用的输入框、浏览器网页里的输入框（Google 登录页）、浏览器原生的搜索框都一样。引擎对退格回的是「未处理」，宿主照规矩调用编辑器删除，接口返回成功，文字却一个也没少，也没有任何报错日志。

同一个出口 `KeyboardSession.deleteEditorBackwardSync` 还被智能标点替换、AI 润色和翻译的替换、预上屏回退共用，它们的删除也都落了空。连按两次「.」得到「。。」就是这样来的：替换要先删掉前一个标点，删除没有生效，就多出一个。

## Decision

`deleteEditorBackwardSync` 改为调用 `inputClient.deleteForwardSync(count)`。

鸿蒙输入法框架的方向命名与 Android 相反：`deleteForward` 删光标之前的文字，`deleteBackward` 删光标之后的。SDK 的英文文档只写了 "Delete text forward/backward"，看不出以什么为参照，以设备实测为准（HarmonyOS 6.0.2 模拟器，光标在 `abc` 末尾）：

- `deleteBackward(1)` 返回 `true`，文字不变；
- `deleteForward(1)` 得到 `ab`。

旧代码按 Android 的习惯调用 `deleteBackwardSync`，光标在末尾时什么也不删，光标在中间时删的是后面的字。

`scripts/test-harmony-delete-direction.py` 拒绝在宿主源码里直接调用 `deleteBackward` / `deleteBackwardSync`，并确认唯一的出口仍调用 `deleteForwardSync`。

同时在设备上确认了删除长度的单位：`deleteForwardSync(1)` 会把光标前的 😀（一个码点、两个 UTF-16 单元）整个删掉，单位不是 UTF-16 单元，与 `AiPolishPolicy` 按码点计算一致。由多个码点组成的字形还没有试过。

## Alternatives considered

- **按引擎回应自己算出新文本，再用 `insertText` 整体替换。** 好处是不依赖删除接口的方向语义。不用它，是因为宿主拿不到输入框的完整内容（只能读光标前后有限的几个字），整体替换会动到不该动的文字，而且每一次退格都要改写一大段，开销也大。
- **只在退格路径里改，其他调用方保持原样。** 改动最小。不用它，是因为另外几个调用方要的同样是「删光标前的字」，都是同一个错误，只改退格会留下智能标点和 AI 替换继续出错。

## Consequences

- **收益**：退格在所有输入框里恢复正常；智能标点替换、AI 润色和翻译的替换不再多出或残留文字。新增的契约检查能防止再次误用。
- **代价**：方向语义依赖设备实测而不是文档。如果将来某个系统版本把它改成跟 Android 一样，这个检查和这里的注释会是第一个要回头看的地方。

## Verification

- 设备（HarmonyOS 6.0.2 phone 模拟器）：
  - 设置应用的输入框里，`abc` 连按两次退格依次变成 `ab`、`a`；
  - `x😀` 退格一次变成 `x`；
  - 浏览器原生搜索框里，`abc` 退格变成 `ab`。
- 修复前同样的步骤删不掉；修复前的探针日志：`deleteBackward resolved true; before now: "as"`。
- `scripts/test-harmony-delete-direction.py` 在修复后的代码上通过，在原来的代码上报出出错的那一行；`bash platforms/harmony/tests/run.sh` 通过；`hvigorw assembleHap` 通过。
