# Agent Note: 鸿蒙手机「手写输入」页顶上加一个会写字的手写板预览

Status: implemented

## Problem

鸿蒙手机的「手写输入」页只有三项：识别等待时间、笔迹颜色、笔迹粗细。拖滑块、换颜色时看不到它们改的是什么，「识别等待时间 600ms」尤其抽象。仓库负责人要求加一个预览的键盘，要有动画。

## Decision

- `HandwritingPadPreview`（`packages/ui/src/settings/handwriting-pad-preview.tsx`）画键盘上的手写面板：上面是候选栏，下面是手写板，背景、按键、文字和强调色取当前皮肤（`resolveKeyboardSkinLook`，与键盘尺寸预览同一份）。
- 动画是一个循环：
  - 一笔一笔写出「水」，四笔，每笔 420ms，笔间停 140ms，用 `animate-hand-stroke`（复用开屏的 `splash-draw` 关键帧）描出来；
  - 写完按「识别等待时间」停顿；
  - 然后候选栏淡入「水 永 小 求 冰」（第一个用强调色），手写板清空；
  - 停 1.6 秒再写下一遍。
- 笔迹和真键盘一致：
  - 「跟随皮肤」取皮肤的按键文字颜色，黑、白、蓝用鸿蒙键盘 `HANDWRITING_STROKE_COLORS` 的色值；
  - 粗细按 vp 画（120 宽的格子换算到 100 单位的 viewBox），圆头圆角。
- 预览放在页面最上面的「预览」组，跟着下面的设置走：拖滑块时用正在拖的值，不等保存。
- 系统设置了减少动态效果时不播动画，直接画写好的字和候选。

## Alternatives considered

- **画一张静态的写好的字。** 看得出颜色和粗细，看不出「识别等待时间」，而这是三项里最难理解的一项。
- **让用户在预览上自己写。** 要接系统的文字识别，设置页拿不到；只画笔迹不出候选又和真键盘不一样。

## Consequences

- **收益**：三项设置都能直接看到效果，拖「识别等待时间」能看出候选出来得快还是慢。
- **代价**：「水」的四笔是手写的近似笔画，不是字库字形。

## Verification

- `apps/desktop/tests/settings/handwriting-pad-preview.test.tsx`：假时钟推进，写四笔用 2100ms，之后在等待时间（900ms）满之前不出候选，满了出候选、手写板清空，1.6 秒后重新写；蓝色是 `#2F6FDB`，6vp 的笔迹在 viewBox 里是 5。
- `apps/desktop/tests/settings/voice-handwriting-harmony.test.tsx`：手写页的分组是「预览」「书写」「笔迹」，预览里是四笔的「水」。
- 已装到 HarmonyOS 6.0.2 phone 模拟器，动画还没在设备上看过：模拟器当时正被仓库负责人使用。
