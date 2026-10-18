# Agent Note: macOS 中英状态项使用产品标志

Status: implemented

## Problem

菜单栏状态项与系统输入源同时显示「中」时，两个相邻图标难以区分。

## Decision

状态项固定使用输入法 bundle 的产品 logo 模板图；模式名称仍用于悬停提示和读屏，系统输入源继续使用各自的模式字形。

## Alternatives considered

改变中英文字形或增加颜色可以保留模式图标，但会让状态项随模式拥有多套视觉规则，也无法解决 logo 与「中」相邻时的识别问题，因此选用已有 bundle logo。

## Consequences

状态项和系统输入源一眼可区分，模式语义仍由名称提供。logo 资源由 bundle 统一提供，不新增资源文件。
