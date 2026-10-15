# Agent Note: Android 统计摘要与按键热力图使用同一日期

Status: implemented

## Problem

Android 统计页在后台线程读取 `summary` 时得到近七天日期，页面稍后渲染按键热力图却重新调用 `LocalDate.now()`。如果读取和渲染跨过午夜，摘要的近七天 KPI 仍以昨天为末日，热力图却以今天为末日，两个区域显示不同时间窗口。

## Alternatives considered

让 `weekKeys()` 在渲染时继续读取系统时钟，改动更小，但会保留摘要和热力图跨午夜不一致的问题。每次重画都重新读取摘要会增加锁竞争和不必要的后台工作，也不能保证两次读取落在同一天。

## Decision

按键热力图直接使用摘要返回的 `overview.last7` 日期列表查询按键计数。同一次摘要读取成功时两处必然使用同一窗口；摘要读取失败而保留旧摘要时也不会用新的系统日期拼出另一窗口。

## Risks

页面停留跨午夜但尚未刷新时，热力图不会单独推进；它与摘要保持一致，下一次现有可见性刷新会一起更新。

## Verification

Android 主机合同检查通过，包含 230 个 JVM smoke 和 105 个设备套件源码编译；新增日期窗口 smoke 通过，`pnpm run verify-notes` 和 `git diff --check` 通过。

## Consequences

页面停留跨午夜但尚未刷新时，热力图与摘要保持同一旧窗口；下一次摘要刷新会一起更新。渲染阶段不再读取系统日期。
