# Soulseed Product Standards（通用产品规范）

> 更新日期：2026-02-24  
> 作用：定义跨模块、跨阶段通用的产品实施标准与门禁。  
> 边界：
> - 任务排期与状态：见 `doc/Roadmap.md`
> - 质量评测指标与阈值：见 `doc/Quality-Evaluation.md`
> - 开发协作与提交流程：见 `AGENT.md`、`contributing_ai.md`
> - 本文档定义“实施标准与设计门禁”，不重复“开发提交流程”和“质量阈值细则”

---

## 1. 总体实施原则（适用于全产品）

1. 先稳态，再扩张：阻塞级治理任务未闭合前，不进入高风险能力的生产接入。
2. 默认兼容优先：新增能力不得导致存量 persona 外显行为突变或“换人感”。
3. 决策与写入分离：LLM 负责提案，规则 gate 负责裁决，落盘必须可确定性复现。
4. 性能有预算：每轮执行必须在预算内完成；超时时优先降级而不是失控扩展。
5. 可选能力后置：实验性/继承性能力不阻塞主发布链路。

---

## 2. 统一状态变更协议（State Delta Contract）

所有可持久化状态更新必须遵守：

`proposal -> gates -> deterministic apply -> audit trace`

硬要求：
- `proposal`：允许模型生成候选变更，但不能直接写入最终状态。
- `gates`：通过规则门禁校验边界、幅度、证据和节流策略。
- `deterministic apply`：同一输入在同版本规则下得到同一结果。
- `audit trace`：保留可追溯证据（决策来源、拒绝原因、最终写入结果）。

---

## 3. 全局行为门禁（Invariant）

### 3.1 Engagement（投入档位）
- 被明确点名且任务意图明确时，不得降级为低投入回复。
- 连续低投入回复达到阈值后，必须触发一次正常投入，避免长期敷衍。

### 3.2 Interest 学习
- 主题进入稳定兴趣前需满足最小重复门槛（默认 >= 3 次）。
- 单轮兴趣更新必须限幅（默认 `|delta| <= 0.05`）。
- 学习建议可由模型提出，但是否落盘由 gate 决定。

### 3.3 Relationship / Belief / Mood
- 关系与信念属于慢变量：每轮限幅，超阈值需多证据与审计事件。
- 情绪可快变，但不得无因牵引长期变量产生跃迁。

### 3.4 Proactive / Group
- 主动交互必须具备：明确 intent + topic/entity/goal + justification。
- 主动频率有默认上限（建议 24h <= 1，可按关系层级细化）。
- 群聊仲裁必须确定性，且 addressing 权重高于兴趣权重。

### 3.5 Compatibility（兼容性）
- 默认 `legacy/hybrid` 路径，保证行为基线稳定。
- 新文件缺失时必须使用保守默认或 `seed-from-existing`。
- 迁移必须满足可回滚、可幂等、可审计。

---

## 4. 性能与降级标准（Latency & Degrade Contract）

Quick 档建议预算：
- `route + decide <= 30ms`
- `recall <= 150ms`（超时降级）
- `compileContext <= 40ms`
- `core guards <= 80ms`
- `commit(minimal) <= 80ms`

超时降级顺序（必须可执行）：
1. `recall` 超时：仅保留 `pinned + working_set`
2. 向量召回超时：跳过向量召回，保留结构化记忆基础链路
3. guard 超时：保留核心 guard，延后非核心检查
4. commit 超时：先写 `life.log` 最小事件，其余异步补写并记 trace

---

## 5. 兼容与迁移标准（Migration Contract）

1. 旧 persona 必须可健康加载（缺省新文件不崩溃）。
2. 迁移重复执行不得产生二次改写（幂等）。
3. 迁移失败必须支持回滚，并保留备份与事件记录。
4. 兼容模式下，外显行为（回复长度、主动频率、风格信号）不得突变。

---

## 6. 能力落地 DoD（功能实现最小验收）

新增能力在进入主链路前，至少满足：
1. 规则门禁已接入统一写入协议（非直接写状态）。
2. 决策轨迹可回放，关键分支有结构化证据。
3. 有超时降级路径且不会阻塞主对话链路。
4. 有兼容夹具（legacy persona）与迁移回归。
5. 文档引用已更新到对应规范层：
   - 路线与状态：`doc/Roadmap.md`
   - 质量指标：`doc/Quality-Evaluation.md`
   - 协作流程：`AGENT.md` / `contributing_ai.md`
