# MindModel Implementation Contract

> 更新日期：2026-02-24  
> 作用：作为 MindModel / Conversation Control 的唯一实施约束文档。  
> 边界：
> - `doc/Roadmap.md` 只负责阶段状态与优先级。
> - 本文档只负责设计约束、DoD、依赖与落地顺序。

## 1. 总体结论与落地原则

结论：方案方向合理，但必须遵循“先稳态，再扩张”。

强约束：
1. `G/P0-0` 未完成前，不进入 H1+ 生产接入。
2. 所有状态更新必须走 `proposal -> gates -> deterministic apply`。
3. 默认兼容优先：legacy/hybrid/full，不得导致存量 persona “换人”。
4. 速度是硬约束：Quick 档每轮最多 1 次 LLM；超时必须降级。
5. H8 为后置可选，不阻塞主发布。

## 2. H0-H8 执行定义（映射 Roadmap）

- H0 -> `G/P0-6`：前置治理与稳健性硬化（依赖 `G/P0-0`）
- H1 -> `G/P1-4`：Conversation Control MVP（LIGHT/NORMAL/DEEP）
- H2 -> `G/P1-5`：Interests -> Attention -> Engagement（可控学习）
- H3 -> `G/P1-6`：Proactive（有动机/有主题/有克制）
- H4 -> `G/P1-7`：群聊参与仲裁（确定性、公平、冷却）
- H5 -> `G/P2-3`：State Delta Pipeline（统一写入通道）
- H6 -> `G/P2-4`：Genome & Epigenetics MVP（差异可解释）
- H7 -> `G/P2-5`：Compatibility & Migration（不换人）
- H8 -> `G/P3-0`：Inheritance（可选后置）

## 3. 全局硬门禁（Invariant）

### 3.1 Engagement
- `addressing=true` 且 `taskness=true` 时禁止 LIGHT。
- 连续 N 次 LIGHT/REACT 后强制至少一次 NORMAL。

### 3.2 Interest 学习
- 学习门槛：同主题 >= 3 次才进入稳定兴趣。
- 单次步长：`|delta_interest| <= 0.05`。
- LLM 只能提案，规则 gate 决定 apply/reject。

### 3.3 Relationship / Belief / Mood
- 关系慢变量每轮限幅；超阈值变更需多证据并写审计事件。
- belief 更新慢且有 cooldown；大幅变化必须证据绑定。
- mood 可快变，但长期变量不能被“无因事件”直接拉动。

### 3.4 Proactive / Group
- 主动消息需 intent + topic/entity/goal + justification。
- 频控：24h 内默认 <= 1 次（可按关系层级调整）。
- 群聊仲裁必须确定性；addressing 权重高于兴趣权重。

### 3.5 Compatibility
- 默认 legacy/hybrid，行为基线不突变。
- 新文件缺省时必须保守默认或 seed-from-existing。
- 迁移必须可回滚、可幂等、可审计。

## 4. 速度与降级合同（Latency Contract）

Quick 档建议预算：
- route+decide <= 30ms
- recall <= 150ms（超时降级）
- compileContext <= 40ms
- core guards <= 80ms
- commit(minimal) <= 80ms

超时降级：
- recall 超时 -> 仅 pinned + working_set
- vector 超时 -> 跳过向量召回
- guard 超时 -> 保留核心 guard
- commit 超时 -> 先写 life.log，其余延后并写 trace

## 5. 当前代码基线差距（用于任务拆分）

已有基础：
- `packages/core/src/persona_write_lock.ts`
- `packages/core/src/interests.ts`
- `packages/core/src/persona_migration.ts`
- `packages/core/src/decision_trace.ts`

主要缺口：
- `engagement_controller.ts` / `topic_tracker.ts` / `conversation_policy.ts`
- `proactive/planner.ts`
- `group_chat/arbitration.ts`
- `genome.ts` / `epigenetics.ts`
- `state_delta_proposals` + 统一 deterministic apply 通道

## 6. 文档使用方式

- 需求排期与状态：`doc/Roadmap.md`
- 质量评测与指标：`doc/Quality-Evaluation.md`
- 研发协作准则：`AGENT.md`、`contributing_ai.md`
