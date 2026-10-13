# Agent Note: iOS 在线候选签名包含资格状态

Status: implemented

## Problem

iOS 在线候选 provider 用签名避免同一查询重复请求，但签名没有记录 Engine 查询里的 `cloud_eligible` 和 `ai_eligible`。当同一组查询的资格状态发生变化而其它签名字段保持不变时，provider 会直接跳过刷新，云候选或 AI 候选可能永远不会发起请求。

## Decision

把两个资格布尔值加入 `OnlineCandidateProvider.signature`，保留现有的会话、缓存键、身份、云候选开关和 AI 配置字段。资格状态是查询身份的一部分，变化时必须开启新的去抖请求。

## Alternatives considered

- 只在调用方遇到资格变化时清除签名：资格状态由 Engine 生成，provider 无法可靠知道所有变化来源，容易遗漏新的宿主路径。
- 把 generation 加入签名：会把仅推进代次的查询重复发送，违背现有去重契约；这次问题只需要补齐资格字段。

## Consequences

资格状态变化会重新安排对应的在线请求；generation 仍然不触发重复请求，旧响应仍由 Engine 的代次校验拒绝。

## Verification

新增 `OnlineCandidateTests.testTheSignatureTracksProviderEligibility`。旧实现的回归测试在 iOS 模拟器上两项断言均失败；加入资格字段后，该用例通过，完整 `OnlineCandidateTests` 21 项通过。
