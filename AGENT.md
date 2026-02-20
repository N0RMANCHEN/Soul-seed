# AGENT.md — Soulseed (CLI / TypeScript) Agent Guide

> 本文件定义 **Soulseed（CLI / TS 版本）** 的产品真相、架构边界与开发铁律，用于指导 Cursor / Codex / Dev AI agents 在仓库内正确协作开发。
> 若与 `contributing_ai.md` 冲突：**AGENT.md 优先**。

---

## 1. Product Identity

- **Codename**: Soulseed
- **定位**：local-first 的 **Persona / Identity Runtime（人格资产 + 决策闭环）**。它不是"聊天工具"，而是让一个人格资产在时间中**持续存在、可迁移、可审计、可成长**。
- **核心分层（工程对应）**
  - **Persona Package（灵魂资产）**：身份锚点 + 世界观种子 + 宪法（价值/边界/使命/承诺）+ 习惯/风格 + 记忆策略 + 生命史（事件流）
  - **Execution Protocol（执行入口）**：`execution_protocol.ts`，统一轮次入口，内部调用路由+流水线
  - **Dual Process Router（认知路由）**：`dual_process_router.ts`，五维信号决策 instinct / deliberative
  - **Runtime Pipeline（五段式流水线）**：`runtime_pipeline.ts`，perception → idea → deliberation → meta_review → commit
  - **Consistency Kernel（五层守卫）**：`consistency_kernel.ts`，identity / relational / recall_grounding / factual_grounding / constitution_rules
  - **Meta-Review（LLM 元认知审核）**：`meta_review.ts`，verdict + quality + style signals
  - **Agent Engine（多步执行）**：`agent_engine.ts`，Planner/Executor 循环，最多 12 步
  - **Drivers（驱动层）**：`ModelAdapter`（LLM）+ `ToolBus`（工具）+ MCP/HTTP

> **核心原则：真实感来自"人格资产 + 决策闭环 + 可持久化经历（event-sourced life）"，而不是堆 prompt。**

---

## 1.1 Core-first + Multi-shell（硬约束）

- CLI / iOS / Web 都只是壳；核心逻辑必须优先沉淀在 `packages/core`。
- 与人格/记忆/决策/存储相关的逻辑，不得只写在某一个壳里。
- 当前仓库默认以 `packages/core` 为真相层，`packages/cli` 只负责交互与编排入口。

---

## 2. 完整架构图

```
CLI 入口: ./ss
  └─ execution_protocol.executeTurnProtocol()
        ├─ dual_process_router.decideDualProcessRoute()
        │    五维信号: 边界冲突 / 风险 / 情绪强度 / 亲密度 / 陌生度
        │    → instinct 或 deliberative
        │
        └─ runtime_pipeline.runRuntimePipeline()
             ├─ [soul/deliberative] 五段式:
             │    perception → idea → deliberation → meta_review → commit
             │    orchestrator.decide() → LLM → consistency_kernel → meta_review
             │
             └─ [agent] agent_engine.runAgentExecution()
                  Planner(LLM) → consistency_kernel → ToolBus → re-plan
                  最多 12 步，支持降级执行

支撑模块:
  consistency_kernel       # 5层守卫: allow/rewrite/reject
  meta_review              # LLM verdict + quality(0-1) + styleSignals
  self_revision            # habits/voice/relationship 自修正
  constitution_crystallization  # 宪法晶化管道（提案→审核→应用/回滚）
  constitution_quality     # 宪法质量评分（0-100，A-D）
  behavior_drift           # 行为漂移检测（快照 + 基线对比）
  explain                  # 决策自然语言解释
  model_router             # instinct/deliberative/meta 三路模型配置
  memory_store             # SQLite 四状态记忆（hot/warm/cold/archive/scar）
  memory_embeddings        # 向量索引（Hybrid RAG）
  memory_consolidation     # 记忆整合（light/full）
  memory_user_facts        # 用户事实提取与晶化（3次门槛）
  social_graph             # 社交关系图谱（≤20人）
  golden_examples          # Few-shot 示例库（≤50条，预算控制）
  finetune_export          # SFT 数据集导出
  persona_migration        # 人格导入/导出（SHA-256 校验 + 回滚）
  proactive/engine         # 主动消息概率引擎
  goal_store               # Agent 目标持久化（JSON 文件）
  decision_trace           # DecisionTrace schema 规范化与版本管理
```

---

## 3. Persona Package 结构

```
<Name>.soulseedpersona/
  persona.json              # id, displayName, schemaVersion, defaultModel
  identity.json             # 身份锚点（personaId 永不变）
  constitution.json         # 使命/价值/边界/承诺（可修宪，有门槛）
  worldview.json            # 世界观种子（可演化）
  habits.json               # 习惯与表达风格（可塑形）
  user_profile.json         # 用户称呼/语言偏好（Profile Memory）
  pinned.json               # Pinned Memory（少而硬，始终注入）
  voice_profile.json        # 语气偏好 tone/stance
  relationship_state.json   # 关系状态六维向量（trust/safety/intimacy/reciprocity/stability/libido）
  cognition_state.json      # 认知状态（模型路由配置）
  soul_lineage.json         # 繁衍血脉（parent/children/reproductionCount）
  life.log.jsonl            # append-only 事件流（带 prevHash/hash 链，不可篡改）
  memory.db                 # SQLite 四状态记忆库
  summaries/
    working_set.json        # 近期工作集摘要
    consolidated.json       # 阶段性内化总结
    archive/                # 冷归档段文件 segment-YYYYMM.jsonl
  goals/                    # Agent 目标 JSON + 规划上下文 + execution trace
  golden_examples.jsonl     # Few-shot 示例库（≤50条）
  social_graph.json         # 社交关系图谱（≤20人）
```

**硬规则**：
- `life.log.jsonl` **append-only**；历史不可篡改；断链/回写必须写入 scar event
- 二进制附件不进 JSON（只存引用）
- schema 变更必须 bump `schemaVersion` 并提供迁移策略

---

## 4. 关键模块说明

### 4.1 DecisionTrace（决策轨迹）
- schema 版本：`"1.0"`（`DECISION_TRACE_SCHEMA_VERSION`）
- 每轮必须生成：选择的记忆、路由决策、一致性裁决、风险等级、执行模式、model
- `normalizeDecisionTrace()` 统一校验所有字段类型与枚举值
- **向后兼容**：v0.1.0 字段可通过 normalize 升级，不得破坏 replay

### 4.2 Consistency Kernel（一致性内核）
五层串联，全部 allow 才输出 allow，任一 reject/rewrite 则上升：
1. `identity_guard`：防止 persona 将自身归属为模型厂商
2. `relational_guard`：防止关系状态异常跳变
3. `recall_grounding_guard`：防止召回内容无证据引用
4. `factual_grounding_guard`：防止无据的事实性主张
5. `constitution_rules`：检查是否触发宪法边界规则

### 4.3 Meta-Review（LLM 元认知审核）
- 四维审核：身份一致性 / 情绪一致性 / 自我意识 / 宪法一致性
- 额外输出：`styleSignals`（四维风格信号）、`quality`（0-1 质量评分）
- `quality >= 0.85` 时，CLI 运行时自动调用 `addGoldenExample`（addedBy: "meta_review"）

### 4.4 Memory Stack（记忆栈）
- **四状态**：`hot → warm → cold → archive`（含 `scar` 不可过期标记）
- **Hybrid RAG**：FTS（全文检索）+ 向量嵌入（deepseek/local）+ salience 融合评分
- **decay 类型**：`fast / standard / slow / sticky`，影响衰减速率
- **整合**：`light` 轻量（关键词提炼）/ `full` 深度（LLM 语义合并）
- **用户事实**：每轮从对话提取 key-value，3次提及自动晶化，编译为 always-inject 上下文（预算 1200 chars）

### 4.5 Constitution Crystallization（宪法晶化）
完整生命周期：`proposeConstitutionCrystallization()` → 提案 → `approveConstitutionReview()` → `applyCrystallizationRun()` → `rollbackCrystallizationRun()`（可回滚）

### 4.6 Golden Examples（Few-shot 示例库）
- 最多 50 条，每条上限 300 字符
- 注入预算：3000 chars（≈ prompt 上限的 10%）
- 来源：用户主动添加（`ss examples add`）或 Meta-Review 自动晶化（quality ≥ 0.85）
- 通过 `loadAndCompileGoldenExamples()` 注入 `compileContext` 的 `alwaysInjectBlock`

### 4.7 Agent Engine（多步执行）
- LLM 生成 `MetaIntentPlan` → 逐步执行 `ExecutionAction` → `ToolBus` 调用 → 观察 → 再规划
- 每步调用 `consistency_kernel` 检查
- 最终回复经 `meta_review` 审核
- 最多 12 步，支持降级执行（步数耗尽时生成摘要回复）

---

## 5. 注入优先级（上下文编译）

```
system prompt 构成（优先级从高到低）:
  1. 身份锚点 + 宪法（Mission / Values / Boundaries / Commitments）
  2. 关系状态 / 声音配置 / 成人安全设置
  3. 选中记忆（Selected memories + evidence blocks）
  4. Always-inject：用户事实 + Pinned Memory + 关系状态摘要
  5. 社交关系图谱上下文（若用户输入提及关系人）
  6. Few-shot 示例（golden_examples，按字符预算裁剪）
  7. 自我修正摘要（Applied self-revision）

conversation window:
  最近 N 轮对话（buildRecentConversationWindow）

最后:
  当前用户输入
```

---

## 6. 开发铁律（对所有 Dev AI 生效）

1. **一次只做一个任务**（最小变更集），禁止"顺手重构"
2. **任何改动必须保持可 build / 可跑**（至少 `./scripts/verify.sh` 通过）
3. **不删除旧代码**：替换则移动到 `packages/legacy-*` 或归档目录
4. **改 schema 必须**：`schemaVersion` bump + 迁移策略 + 回归用例
5. **DecisionTrace schema 一旦发布必须向后兼容**，或提供迁移（回放基石）
6. **不引入显式评分闭环**（⭐/👍👎）作为主塑形路径
7. **不宣告"意识/痛苦"事实**：只做可验证机制（张力、代价、边界、内化）
8. **命令级改动补测**：CLI 命令解析/参数/路径改动必须补对应测试或执行验证
9. **在线链路改动**：必须运行 `npm run acceptance` 并给出报告路径（失败必须归因）
10. **验收隔离**：验收只使用 `personas/_qa/*`，禁止使用日常 persona

---

## 7. 安全边界

- **ToolBus deny-by-default**：默认无工具；必须在 DecisionTrace 中显式批准（理由/预算/影响面）
- **Ctrl+C 可中止**：必须能停止工具调用与 streaming
- **成人内容门控**：`adultSafety` 默认关闭，需三重显式确认（adult_mode + age_verified + explicit_consent）
- **繁衍门控**：`ss persona reproduce` 需满足条件（libido / consent / safety_boundary）；`--force-all` 跳过但仍写入事件
- **API Key 不进仓库**：只允许环境变量或本地 config（gitignore）
- **日志脱敏**：trace/日志禁止输出绝对路径与用户长段原文

---

## 8. CI 与质量门禁

### PR 门禁（`.github/workflows/pr_gate.yml`）
- TypeScript 编译检查
- 全量单元测试（`packages/core` + `packages/cli` + `packages/mcp-server`）
- L0-L2 质量评测（完整性 + 检索 + 落地守卫）
- MCP 兼容性回归

### Nightly（`.github/workflows/ci.yml`）
- 全量测试 + L0-L5 评测
- 指标 delta 对比（`baseline_delta.mjs`）
- L3/L4 连续超阈值 3 天 → 升级为硬门禁

### 验收（`.github/workflows/acceptance.yml`）
- 在线链路 smoke（创建 → 对话 → 写回 → 验证连续性）
- MCP 集成测试（stdio + HTTP）

---

## 9. Repo 结构

```
packages/
  core/         # 纯核心：domain / storage / orchestrator / adapters（真相层）
  cli/          # CLI 壳：命令、交互、编排入口
  mcp-server/   # MCP JSON-RPC 2.0 服务器
scripts/
  verify.sh                # 单一验证入口
  acceptance.sh            # 在线链路验收
  eval_all.sh              # 质量评测全量
  baseline_delta.mjs       # 基线 delta 对比
  nightly_diff.mjs         # Nightly 指标差异报告
  update_baseline.mjs      # 更新基线快照
  quality_scorecard.mjs    # 质量 scorecard 生成
  migration_audit.mjs      # 迁移一致性对账
  nightly_consolidate.mjs  # 定时记忆整合 cron 脚本
datasets/
  quality/retrieval/ grounding/ safety/  # 评测数据集（JSONL）
doc/
  CLI.md                   # 完整命令参考
  Roadmap.md               # 产品阶段总览（全部完成）
  Quality-Evaluation.md    # 分层评测框架（L0-L5）
```

---

## License

TBD
