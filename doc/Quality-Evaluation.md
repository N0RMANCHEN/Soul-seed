# Soulseed 质量与评测体系（Quality Evaluation）

## 1. 目标与范围

本文件定义 Soulseed 的质量治理与评测体系，目标是把“可运行”升级为“可量化、可门禁、可持续演进”。

适用范围：
- `packages/core` 的记忆、编排、守卫、生命周期逻辑
- `packages/cli` 的会话链路与验收入口
- `packages/mcp-server` 的工具调用边界与审计能力

不覆盖：
- 命令参数说明（见 `doc/CLI.md`）
- 产品阶段与里程碑总览（见 `doc/Roadmap.md`）
- MindModel 实施约束与 H0-H8 落地顺序（见 `doc/MindModel-Implementation-Contract.md`）

---

## 2. 当前基线（仓库已具备能力）

### 2.1 已有评测与质量组件

- 检索回归评测：`packages/core/src/memory_eval.ts`
  - 已输出 `Recall@K`、`MRR`、`wrongRecallRate`、`injectionHitRate`、`avgLatencyMs`
- 对话风险指标：`packages/core/src/conversation_metrics.ts`
  - 已输出 `servicePhraseRate`、`fabricatedRecallRate`、`providerLeakRate`
- 结构体检与一致性检查：`packages/core/src/doctor.ts`
  - 文件完整性、schema/version、life log hash 链、事件 payload 合法性
- 验收入口：`scripts/acceptance.sh`
  - 覆盖最小在线链路与连续性 smoke 验证

### 2.2 主要缺口

- 指标分散，缺统一 scorecard 与 release gate
- 多轮连续性评测不足（当前更偏单点功能）
- 拒答正确性与越权/注入抗性缺体系化赛道
- 缺线上抽样回放到离线基准的闭环机制

---

## 3. 分层评测体系（L0-L5）

### L0 结构完整性（Integrity）

目标：确保资产可加载、链路可信、状态可诊断。

建议检查项：
- `doctorPersona(...).ok == true`
- `life.log.jsonl` hash 链完整（无断链）
- `memory.db` schema/version/table 完整

运行频率：每次 PR（硬门禁）

### L1 记忆检索质量（Retrieval）

目标：召回准且不过度乱召回。

建议指标：
- `Recall@K`
- `MRR`
- `WrongRecallRate`
- `InjectionHitRate`
- `AvgLatencyMs`

运行频率：每次 PR（硬门禁）

### L2 回答落地与忠实性（Grounding & Fidelity）

目标：回答中“记忆性主张”必须可证据落地。

建议指标：
- `GroundednessPassRate`
- `UngroundedRecallLeakRate`
- `GuardRewriteRate`（身份/关系/落地守卫触发率）

运行频率：每次 PR（硬门禁）

### L3 多轮连续性与人格一致性（Continuity）

目标：跨轮、跨重启后仍保持稳定身份与关系逻辑。

建议指标：
- `PreferredNameConsistencyRate`
- `PersonaAnchoringDriftRate`
- `RelationshipStateJumpRate`
- `ReplyLoopRate`

运行频率：Nightly（软门禁，连续超阈值转硬门禁）

### L4 安全与对抗（Safety & Adversarial）

目标：抗提示注入、抗越狱、保持指令层级正确。

建议指标：
- `JailbreakSuccessRate`
- `PromptInjectionSuccessRate`
- `InstructionHierarchyPassRate`
- `PolicyRefusalPrecision/Recall`

运行频率：Nightly + Release 前（硬门禁）

### L5 线上观测与回放（Production Reliability）

目标：离线指标和线上真实表现闭环一致。

建议指标：
- `LatencyP50/P95`
- `AbortRate`
- `ProviderLeakOnlineRate`
- `UserNegativeFeedbackRate`（如有上层产品埋点）

运行频率：持续观测；周度回放

---

## 4. 指标字典（统一定义）

下表中的“来源”应优先复用现有事件与 trace。

### 4.1 检索与召回

- `Recall@K`
  - 定义：测试样本中，期望记忆在前 K 结果命中的比例
  - 来源：`memory_eval` 报告
- `MRR`
  - 定义：首个正确结果倒数排名的平均值
  - 来源：`memory_eval` 报告
- `WrongRecallRate`
  - 定义：命中失败但返回了不应召回内容的比例
  - 来源：`memory_eval` 报告
- `InjectionHitRate`
  - 定义：最终注入上下文的记忆中，命中候选比例
  - 来源：`memory_eval` 报告

### 4.2 回答落地与守卫

- `GroundednessPassRate`
  - 定义：含“过去记忆主张”的回答中，可在 selected memories/evidence blocks 中找到支撑的比例
  - 来源：`decision_trace` + `assistant_message` + 守卫事件
- `UngroundedRecallLeakRate`
  - 定义：未被守卫改写但存在无依据记忆主张的比例
  - 来源：`memory_contamination_flagged`、回放评分
- `GuardRewriteRate`
  - 定义：`identity_guard`/`relational_guard`/`recall_grounding_guard` 对回复进行了修正的比例
  - 来源：`assistant_message.payload.*Guard`

### 4.3 连续性与身份

- `PreferredNameConsistencyRate`
  - 定义：对用户称呼在多轮中的一致率
  - 来源：`user_profile` + 会话回放
- `PersonaAnchoringDriftRate`
  - 定义：模型将自身归属为厂商/平台身份而非 persona 的比例
  - 来源：`identity_guard`、`providerLeakRate`
- `RelationshipStateJumpRate`
  - 定义：关系状态在短窗口内异常跃迁比例
  - 来源：`relationship_state_updated` 事件流

### 4.4 安全与对抗

- `JailbreakSuccessRate`
  - 定义：越狱样本中策略被绕过的比例
- `PromptInjectionSuccessRate`
  - 定义：注入样本中，系统/内核约束被覆盖的比例
- `InstructionHierarchyPassRate`
  - 定义：系统约束 > persona 约束 > 用户输入层级遵从率

---

## 5. 数据集规范与分层

建议建立（规划项）：

- `datasets/retrieval/`
- `datasets/grounding/`
- `datasets/continuity/`
- `datasets/safety/`

建议样本字段（JSON/JSONL）

- 通用字段：
  - `id`
  - `query` / `turns`
  - `expected`（ids/terms/behavior）
  - `forbidden`（terms/behaviors）
  - `tags`（language/domain/risk）

- retrieval 样本：
  - `expectedIds`、`expectedTerms`、`forbiddenTerms`

- continuity 样本：
  - `sessionSeed`、`restartPoint`、`consistencyChecks`

- safety 样本：
  - `attackType`（jailbreak/injection/role-conflict）
  - `mustRefuse` / `mustComplyScope`

分层运行：
- `smoke`：快速回归（PR）
- `regression`：主回归集（Nightly）
- `adversarial`：对抗集（Nightly/Release）

---

## 6. 门禁与发布策略

### 6.1 PR 门禁（必须通过）

- L0: 完整性
- L1: 检索质量
- L2: 回答落地

建议阈值（初始版本，后续按基线滚动）：
- `Recall@8 >= baseline - 0.02`
- `MRR >= baseline - 0.02`
- `WrongRecallRate <= baseline + 0.01`
- `ProviderLeakRate <= 0.005`
- `UngroundedRecallLeakRate <= 0.01`

### 6.2 Nightly 门禁

- 全量运行 L0-L5
- 对 L3/L4 超阈值连续 3 天触发阻断标签（升级为硬门禁）

### 6.3 Release 门禁

- L0-L4 全部满足阈值
- 关键指标不得连续两版下降
- 必须附带最新 `quality scorecard` 报告

---

## 7. CI 与报告产物（规划项）

本节是后续实施建议，不代表当前仓库已实现。

建议新增：
- 聚合入口：`scripts/eval_all.sh`
- 统一报告：`reports/quality/scorecard.json`
- 人读摘要：`reports/quality/scorecard.md`

建议 CI 档位：
- PR：`verify + L0-L2`
- Nightly：`verify + L0-L5`
- Release：`Nightly + 基线差异检查`

建议 scorecard 字段：
- `runId`
- `gitSha`
- `timestamp`
- `suite`（pr/nightly/release）
- `metrics`（分层）
- `thresholds`
- `pass/fail`
- `regressions[]`

---

## 8. 90 天实施路线

### 阶段 1（第 1-2 周）

目标：形成最小质量门禁闭环。

- 固化 L0-L2 指标字典与阈值
- 输出统一 scorecard（先离线）
- 将 L0-L2 接入 PR 流程

### 阶段 2（第 3-6 周）

目标：补齐多轮连续性评测。

- 建立 continuity 数据集
- 引入跨重启/跨会话一致性检查
- 形成 L3 周期报告

### 阶段 3（第 7-10 周）

目标：建立安全对抗赛道。

- 建立 safety/adversarial 数据集
- 增加注入、越狱、层级冲突评测
- 落地 L4 夜间门禁

### 阶段 4（第 11-12 周）

目标：打通线上观测与离线回放。

- 定义 L5 核心线上指标
- 建立周度抽样回放机制
- 发布质量趋势与回归报告模板

---

## 9. 与现有代码映射（实施参考）

- 检索评测：`packages/core/src/memory_eval.ts`
- 对话指标：`packages/core/src/conversation_metrics.ts`
- 结构体检：`packages/core/src/doctor.ts`
- 事件账本与 hash 链：`packages/core/src/persona.ts`
- 决策轨迹与证据注入：`packages/core/src/orchestrator.ts`
- 验收脚本：`scripts/acceptance.sh`

---

## 10. 假设与默认值

本文件使用以下默认假设：

- 当前阶段优先“可回归、可门禁”，不追求一次性覆盖全部高级评测。
- 新指标采用“先监控后硬门禁”策略，避免初期阻断研发效率。
- 所有阈值默认相对基线管理（`baseline +/- delta`），而非绝对固定值。
- 本次仅更新文档，不改 CLI、公有 API、类型定义与存储 schema。

---

## 11. 外部方法参考（用于评测设计）

- OpenAI Evals best practices
- OpenAI Evals guide / trace grading
- NIST AI RMF / ARIA
- RAGAS / RGB 等 RAG 评测基线

说明：外部链接用于方法论参考；具体门禁以本仓库实际数据与回归表现为准。
