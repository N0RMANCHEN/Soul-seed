> Progress: 以 doc/Roadmap.md 为准（本计划仅描述 scope，不做逐任务快照）

# Phase J Interaction Loop Plan

## 目标摘要

在不破坏现有单人格主链路稳定性的前提下，完成 Phase J 的最小闭环：

1. Interest-Attention 状态闭环（可持久化、可回放、可门禁）
2. Proactive Planner 契约化（输入输出可校验）
3. 非轮询会话循环骨架（触发-抑制-审计链路）

## 任务清单（含依赖链）

1. J/P0-0 Interest-Attention 状态闭环  
依赖：无（Phase J 启动项）

2. J/P0-1 Proactive Planner 契约化  
依赖：J/P0-0（优先复用 topic/thread 状态）

3. J/P0-2 非轮询会话循环（核心交互层）  
依赖：J/P0-0、J/P0-1

## 入口条件

1. `doc/plans/README.md` Active Index 已登记本计划
2. `doc/Roadmap.md` 将 `J/P0-0` 标记为 `in_progress`
3. `npm run verify` 绿线基准存在

## 出口条件

1. J/P0-0、J/P0-1、J/P0-2 在 Roadmap 标记为 `done`
2. 计划文件归档至 `doc/plans/archive/` 并更新 archive index
3. `npm run verify`、`npm run governance:check`、`npm run doc-consistency:check` 全通过

## A/B 分工（建议）

1. A：状态协议与写入门禁（topic_state / engagement_plan / proactive_plan）
2. B：交互循环实现与 CLI 接入（tick/signal/suppression/trace）
3. 同步点：J/P0-1 contract 冻结后再并行推进 J/P0-2

## 风险与回滚策略

1. 风险：主动交互触发过频，破坏用户体感  
回滚：保留现有 proactive 引擎阈值，J/P0-2 以 feature flag 默认关闭

2. 风险：新状态文件写路径绕过门禁  
回滚：通过 `state_write_registry` + direct-writes gate 阻断合入

3. 风险：topic thread 判断偏差导致“误跟话题”  
回滚：保守策略，只更新 activeTopic，不自动关闭历史 thread
