> Progress: 以 doc/Roadmap.md 为准（本计划仅描述 scope，不做逐任务快照）
> Latest: `J/P1-1` 与 `J/P1-2` 均为 `in_progress`；J/P1-2 已有 AB+replay 最小评测赛道

# Phase J Engagement P1 Plan

## 目标摘要

围绕 Phase J 的 P1 任务构建交互体验闭环，优先完成：

1. `J/P1-0` Engagement 预算门禁（防止过触发/空转）
2. `J/P1-1` 多话题上下文调度（降低串线与饥饿）
3. `J/P1-2` 交互体验评测赛道（可复现、可门禁）

## 任务清单（含依赖链）

1. `J/P1-0` Engagement Plan + 预算门禁  
依赖：`J/P0-2`

2. `J/P1-1` 多话题上下文调度器  
依赖：`J/P1-0`

3. `J/P1-2` 交互体验评测赛道  
依赖：`J/P1-0`、`J/P1-1`

## 入口条件

1. `doc/Roadmap.md` 中 `J/P1-0` 状态为 `in_progress`
2. `conversation_control`、`proactive engine`、`DecisionTrace` 当前链路可运行
3. `npm run verify` 基线通过

## 出口条件

1. `J/P1-0~P1-2` 在 `doc/Roadmap.md` 状态闭环
2. 预算/调度决策在 `DecisionTrace` 可观测、可回放
3. 交互体验评测脚本纳入质量门禁并可在 CI 复现

## A/B 分工（建议）

1. A：预算策略、调度策略、trace schema、门禁阈值
2. B：CLI 可观测输出、回放脚本、评测样本与报告
3. 同步点：
- `J/P1-0` trace 字段冻结后再推进 `J/P1-1`
- `J/P1-1` 稳定后再冻结 `J/P1-2` 指标口径

## 风险与回滚策略

1. 风险：预算策略过严导致回复质量下降  
回滚：仅启用记录模式（record-only），不执行降级

2. 风险：调度策略引入话题震荡  
回滚：回退到 `topicAction=maintain/clarify` 的保守模式

3. 风险：评测集不能反映真实会话  
回滚：保留现有 scorecard 门禁，J 赛道先作为非阻断观察
