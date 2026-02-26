> Progress: 以 doc/Roadmap.md 为准（本计划仅描述 scope，不做逐任务快照）

# Phase L Incremental Input Plan

## 目标摘要

在保持当前输出流式、治理门禁与状态一致性的前提下，为 CLI 增加输入侧“增量理解 + 分段提交”能力：

1. 输入事件层抽象（fragment/commit）
2. 分段提交策略（停顿/标点/长度）
3. 轻量增量理解（不触发完整回合）
4. 正式回合桥接（commit 后进入现有全链路）
5. 开销预算与评测闭环

## 任务清单（含依赖链）

1. L/P0-0 输入事件层抽象（CLI）  
依赖：无（Phase L 启动项）

2. L/P0-1 分段提交引擎  
依赖：L/P0-0

3. L/P0-2 增量理解（轻量层）  
依赖：L/P0-0

4. L/P0-3 正式回合桥接  
依赖：L/P0-1、L/P0-2

5. L/P1-0 交互可视化与修正提示  
依赖：L/P0-3

6. L/P1-1 开销预算与门禁  
依赖：L/P0-3

7. L/P1-2 评测赛道  
依赖：L/P1-1

## 入口条件

1. `doc/plans/README.md` Active Index 已登记本计划
2. `doc/Roadmap.md` 已新增 Phase L 与任务编号
3. 现有 `npm run verify` 绿线基准存在

## 出口条件

1. Phase L 任务按 Roadmap 状态闭环（完成项归档）
2. 输入增量模式在 feature flag 下可灰度启用与回退
3. `npm run verify`、`npm run governance:check`、`npm run doc-consistency:check` 全通过

## A/B 分工（建议）

1. A：核心契约、分段提交策略、预算门禁、评测口径
2. B：CLI 输入事件接入、交互提示与兼容命令流
3. 同步点：
   - L/P0-0 契约冻结后并行推进 L/P0-1 与 L/P0-2
   - L/P0-3 合入前完成 L/P1-1 最小门禁实现

## 风险与回滚策略

1. 风险：输入事件频率过高导致请求与写入开销上升  
回滚：`SOULSEED_INCREMENTAL_INPUT=0` 一键回退到行级输入

2. 风险：中文 IME/终端兼容导致误分段  
回滚：保守阈值（停顿+标点双条件）并保留行级兜底

3. 风险：增量路径污染长期记忆  
回滚：增量阶段仅保存在临时缓冲，commit 前不写长期状态
