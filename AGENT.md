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

## 1.2 Interaction Modes（交互形态）& Conversation Control Plane（会话控制面，新增核心）

Soulseed 的“像人”不是靠更长 prompt，而是靠**会话控制面**在每轮对话做出“是否开口/开口多少/何时插话/插什么话题/外显多少情绪”的决策。

**交互形态（必须同时支持）**：
1. **Passive Reply（被动回复）**：用户输入 → 系统决定投入档位 → 再决定是否进入完整流水线。
2. **Proactive Ping（主动打扰）**：由内在驱动/未闭环线程/目标提醒触发，但必须先经过 *Proactive Planner*（先定动机再生成）。
3. **Group Chat（AI 群聊，未来）**：默认沉默 + 参与门槛 + 仲裁（避免多 persona 抢答）。

**投入档位（Engagement Tier）是主循环第一决策**：
- `IGNORE`（不回复，但可内部更新 state/记忆）
- `REACT`（极短反应）
- `LIGHT`（两三句以内）
- `NORMAL`（正常回答）
- `DEEP`（深度长答：仅在高任务/高兴趣/高关系价值时）

> 关键要求：**Interest → Attention → Engagement** 必须成为可运行信号链路；否则系统会变成“条条认真回”的客服机。

**三种信息裁切（必须同时成立）**：
- 认知裁切：Instinct / Deliberative / Meta（router + pipeline）
- 记忆裁切：decay / interference / consolidation（记得发生过，但可忘细节）
- 会话裁切：投入档位 + 上下文/输出预算（Budget-first）

**兼容性约束（必须）**：
- 对存量 persona：默认保持行为一致（Behavior Parity by Default）。
- 新增机制必须通过 `compatMode` / feature flags 渐进启用；缺文件必须有默认值与迁移策略。
- 旧参数/旧状态必须作为“新层的初始值/基线”，禁止重置导致人格“换人”。

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
             │
             │  ① Soul 永远先运行（无论是否需要 Agent）
             ├─ orchestrator.decide() → DecisionTrace（含 agentRequest?）
             │    LLM 语义评估风险/情绪/任务意图
             │    → 五段式: perception → idea → deliberation → meta_review → commit
             │
             │  ② 元认知前置裁决（是否调用 Agent，调用哪类）
             ├─ meta_cognition.arbitrateAgentInvocation()
             │    agentRequest.needed=false → 直接 compileContext → LLM → 回复用户
             │    requiresConfirmation=true → CLI 向用户请求确认
             │    proceed=true →
             │
             │  ③ Agent 作为人格的"手和脚"执行
             └─ agent_engine.runAgentExecution({ agentType, soulTraceId })
                  Planner(LLM) → consistency_kernel → ToolBus（白名单限制）→ re-plan
                  最多 12 步，支持降级执行
                  返回: { reply, artifact, memoryProposals[] }
                       ↓
                  ④ 元认知后置裁决（哪些 proposals 可以进记忆）
                  meta_cognition.arbitrateMemoryProposals()
                       ↓
                  ⑤ Soul 整合 artifact → compileContext → LLM 说最终的话
                  meta_review（后置审核）→ 回复用户

支撑模块:
  consistency_kernel       # 5层守卫: allow/rewrite/reject（规则 + 可选 LLM 语义层）
  meta_review              # LLM verdict + quality(0-1) + styleSignals
  meta_cognition           # 元认知主权层（前置/后置裁决 Agent 调用与记忆写入）
  agent_memory_proposal    # Agent→Persona 记忆提案协议（propose→arbitrate→commit）
  self_revision            # habits/voice/relationship 自修正
  constitution_crystallization  # 宪法晶化管道（提案→审核→应用/回滚）
  constitution_quality     # 宪法质量评分（0-100，A-D）
  behavior_drift           # 行为漂移检测（快照 + 基线对比）
  explain                  # 决策自然语言解释
  model_router             # instinct/deliberative/meta 三路模型配置
  memory_store             # SQLite 四状态记忆（hot/warm/cold/archive/scar）
  memory_embeddings        # 向量索引（Hybrid RAG）
  memory_consolidation     # 记忆整合（light=正则 / full=LLM 语义）
  memory_user_facts        # 用户事实提取与晶化（3次门槛）
  memory_rotation          # life.log 超限自动轮换（归档最旧 20% 到 life_archive.jsonl）
  social_graph             # 社交关系图谱（≤20人）
  golden_examples          # Few-shot 示例库（≤50条，预算控制）
  finetune_export          # SFT 数据集导出
  persona_migration        # 人格导入/导出（SHA-256 校验 + 回滚）
  proactive/engine         # 主动消息概率引擎（由 interests.json 驱动 curiosity）
  conversation_control      # 会话控制主模块（投入档位/话题动作/外显策略路由）
  semantic_projection       # 语义投影层（向量锚点映射 + 元认知仲裁入口）
  recall_navigation_intent  # 时间线/回看意图识别（将逐步迁移到四层语义路由）
  pronoun_role_guard        # 人称角色守卫（主体归因歧义处理）
  proactive/engine          # 主动触达引擎（后续规划器能力在此演进）
  group chat arbitration    # 群聊仲裁为规划能力，暂未拆分独立文件
  goal_store               # Agent 目标持久化（JSON 文件）
  decision_trace           # DecisionTrace schema 规范化与版本管理
  content_safety_semantic  # LLM 语义内容安全评估（riskLatent[3]，正则 fallback）
  agent_memory_proposal    # Agent→Persona 记忆提案协议（propose→arbitrate→commit）
  expression_belief_state  # voiceLatent[16] / beliefLatent[32] 持久化更新（EC-0/EB-6）
  latent_cross_influence   # 跨维度 Latent 柔和联动（mood→voice→belief，系数 ≤0.05）
  routing_adaptation       # 路由权重自适应（从 life.log 历史满意度信号学习，步长 ≤0.02）
  capabilities/registry    # 会话能力注册表（11 种 session.* 能力的风险/确认策略）
  capabilities/intent_resolver  # 对话意图解析（自然语言 → CapabilityCallRequest）
  mood_state               # 内在情绪状态（moodLatent[32] + valence/arousal 投影，Phase D P2-0）
  autobiography            # 自传体叙事（章节 + selfUnderstanding，Phase D P2-2）
  interests                # 兴趣分布（从记忆自动涌现，驱动 proactive curiosity，Phase D P3-0）
  self_reflection          # 周期自我反思（LLM 第一人称，Phase D P3-1）
```

---

## 3. Persona Package 结构

```
<Name>.soulseedpersona/
  persona.json              # id, displayName, schemaVersion, defaultModel, compatMode(legacy|hybrid|modern), featureFlags
  identity.json             # 身份锚点（personaId 永不变）
  constitution.json         # 使命/价值/边界/承诺（可修宪，有门槛）
  worldview.json            # 世界观种子（可演化）
  habits.json               # 习惯与表达风格（可塑形）
  user_profile.json         # 用户称呼/语言偏好（Profile Memory）
  pinned.json               # Pinned Memory（少而硬，始终注入）
  voice_profile.json        # 语气偏好 tone/stance
  relationship_state.json   # 关系状态（6维投影 + relationshipLatent[64]）
  cognition_state.json      # 认知状态（模型路由配置 + routingWeights + relationshipDynamics）
  mood_state.json           # 情绪状态（valence/arousal 投影 + moodLatent[32]）
  genome.json               # 基因/天赋（slow-changing；决定学习率/预算/敏感度等派生参数；默认缺省可推断，Phase F）
  epigenetics.json          # 表观学习（very-slow；长期可塑但门槛高；缺省为空，Phase F）
  topic_state.json          # 话题/线程状态（active topic + unresolved threads，Phase F）
  conversation_policy.json  # 会话外显策略（emoji/情绪外显/插话倾向/quiet hours 等，Phase F）
  group_policy.json         # 群聊策略（默认沉默/参与门槛/cooldown/仲裁权重，Phase F）
  soul_lineage.json         # 繁衍血脉（parent/children/reproductionCount）
  life.log.jsonl            # append-only 事件流（带 prevHash/hash 链，不可篡改）
  memory.db                 # SQLite 四状态记忆库
  summaries/
    working_set.json        # 近期工作集摘要
    consolidated.json       # 阶段性内化总结
    archive/                # 冷归档段文件 segment-YYYYMM.jsonl
  autobiography.json        # 自传体叙事（章节 + selfUnderstanding，Phase D P2-2）
  interests.json            # 兴趣分布（topic/weight/lastActivatedAt，Phase D P3-0）
  self_reflection.json      # 周期自我反思日志（Phase D P3-1）
  latent/                   # Latent 向量 checkpoint（Phase E 新增）
    mood_latent_history.jsonl       # moodLatent 快照（可回滚）
    relationship_latent_history.jsonl
    agent_memory_proposals.jsonl    # 待裁决的记忆提案池
  goals/                    # Agent 目标 JSON + 规划上下文 + execution trace
  golden_examples.jsonl     # Few-shot 示例库（≤50条）
  social_graph.json         # 社交关系图谱（≤20人）
  summaries/
    life_archive.jsonl      # life.log 轮换归档（由 memory_rotation 自动写入）
```

**硬规则**：
- `life.log.jsonl` **append-only**；历史不可篡改；断链/回写必须写入 scar event
- 二进制附件不进 JSON（只存引用）
- schema 变更必须 bump `schemaVersion` 并提供迁移策略

- **新增文件必须可缺省**：旧 persona 缺少新文件（genome/epigenetics/policy/topic_state 等）时不得崩溃；loader 必须用保守默认值或从旧参数推断（seed-from-existing），并由 doctor/迁移脚本生成落盘- `latent/` 目录中的向量文件不得被规则或外部系统直接覆写（只能通过 commit 协议更新）

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
- **Hybrid RAG**：FTS（全文检索）+ 向量嵌入（openai-compat/local）+ salience 融合评分
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

### 4.8 双层状态表示（Latent + Projection）

> **Phase E 引入的架构原则**：所有"度量"都是投影而非本体。

**核心思想**：
- 人格的真实内在状态存储为高维 Latent 向量（坐标轴无命名，含义由经历涌现）
- 现有的可解释标量/枚举（valence/arousal/trust/stance 等）是从 latent 派生的**投影层**，用于治理、跨版本兼容、system prompt 注入——但不是内在状态的直接量化
- Latent 向量通过元认知裁决的小步更新演化，不能被规则或 agent 直接写入

**各状态的 Latent 向量规划**：

| 状态 | Latent 向量 | 维度 | 投影出的可读接口 |
|------|------------|------|----------------|
| 情绪 | `moodLatent` | 32 | valence / arousal / dominantEmotion |
| 关系 | `relationshipLatent` | 64 | trust / safety / intimacy / reciprocity / stability / libido |
| 表达意图 | `voiceLatent` | 16 | stance / tone |
| 信念/判断 | `beliefLatent` | 32 | PersonaJudgmentLabel |
| 风险评估 | `riskLatent` | 16 | riskLevel |

**Latent 更新协议**（所有向量共用）：
```
刺激（对话/事件/agent 结果）
  → LLM 评估 → Δz（候选更新向量）
  → 元认知裁决（accept/reject/partial）
  → commit: z ← normalize((1-α)·z + α·(z+Δz))
  → 投影 → 更新可读接口字段
  → checkpoint（定期快照，支持回滚）
```

**感知层原则**：
- 所有感知系统（情绪信号/风险/任务类型/记忆值得性）从正则词表升级为 LLM 语义评估
- LLM 不可用时 fallback 到正则，但有 trace 标记（`perceptionMode: "semantic"|"regex_fallback"`）
- 感知输出优先为连续向量，而非离散 flag 列表

### 4.7 Agent Engine（多步执行）

**架构铁律（Phase E 引入，强制执行）**：
1. **人格先于 Agent**：`orchestrator.decide()` 永远先运行；Agent 在 soul trace 已存在的上下文中启动，不是独立入口
2. **Agent 不直接写权威人格记忆**：执行结果只能返回 `memoryProposals[]`，经 `meta_cognition.arbitrateMemoryProposals()` 裁决后才能 commit 到 memory_store
3. **高风险动作默认需确认**：`agentType=action` 或 `riskLevel=high` 时，CLI 层向用户请求显式确认，不自动执行

**执行流程**：
- Soul 层调用 → `runAgentExecution({ agentType, soulTraceId })` → LLM 生成 `MetaIntentPlan` → 逐步执行 `ExecutionAction` → `ToolBus`（白名单限制）→ 观察 → 再规划
- 每步调用 `consistency_kernel` 检查（pre_plan / pre_action / post_action）
- 最终回复经 `meta_review` 审核
- 最多 12 步，支持降级执行（步数耗尽时生成摘要回复）
- 返回 `{ reply, artifact?, memoryProposals[] }`，由 soul 层整合后说最终的话

**4 类 Agent 与工具白名单**：

| 类型 | 可用工具 | 风险 | 需确认 |
|------|---------|------|--------|
| Retrieval | memory.search / read_file / fetch_url | 低 | 否 |
| Transform | memory.search / read_file | 低 | 否 |
| Capture | session.log_event（仅写 event log） | 中 | 否 |
| Action | 全工具集 | 高 | **是** |

**记忆提案（agent_memory_proposal.ts）**：
- `memoryProposals` 中每条带 `kind`（semantic/preference/relational/open_question）、`evidenceRefs`、`confidence`
- `confidence < 0.5` 或 `kind=open_question` 或与宪法冲突 → 元认知自动 reject
- `artifact`（知识库内容）直接存知识库，不经过 persona 记忆通道

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
3. **Doc Sync Gate（强制）**：任何涉及代码、命令、配置、架构、schema、流程的改动，必须排查受影响文档（至少 `README.md`、`doc/*.md`、`AGENT.md`、`contributing_ai.md`）；若无需更新，交付中必须明确写出“已排查且无需更新”的理由。
4. **H0 门禁配置属于机器配置资产**：位置固定为 `config/h0/*`；任何修改后必须通过 `npm run h0:check`。
5. **不删除旧代码**：替换则移动到 `packages/legacy-*` 或归档目录
6. **改 schema 必须**：`schemaVersion` bump + 迁移策略 + 回归用例
7. **DecisionTrace schema 一旦发布必须向后兼容**，或提供迁移（回放基石）
8. **新增铁律：Persona 演化必须向后兼容（比 DecisionTrace 更严格）**  
   对已有 persona 引入的新层（genome/epigenetics/interests/policy 等）必须做到“缺省不改变行为（Behavior Parity by Default）”。任何升级必须：
   - **旧参数作为初始值/基线（seed-from-existing）**，禁止重置导致人格“换人”
   - 通过 `compatMode` / feature flags 渐进启用（默认 `legacy` 或 `hybrid`）
   - 提供迁移脚本 + 回滚点 + fixture 回归（覆盖：缺文件/旧 schemaVersion/迁移幂等）
9. **新增铁律：会话控制面不得仅靠文案**  
   投入档位/主动意图/群聊参与必须由可解释信号与预算驱动（Interest→Attention→Engagement），禁止只改 prompt 让它“看起来克制”。

10. **不引入显式评分闭环**（⭐/👍👎）作为主塑形路径
11. **不宣告"意识/痛苦"事实**：只做可验证机制（张力、代价、边界、内化）
12. **命令级改动补测**：CLI 命令解析/参数/路径改动必须补对应测试或执行验证
13. **在线链路改动**：必须运行 `npm run acceptance` 并给出报告路径（失败必须归因）
14. **验收隔离**：验收只使用 `personas/_qa/*`，禁止使用日常 persona
15. **禁止新增正则词表作为感知主路径**（Phase E）：任何感知模块（情绪/风险/任务分类/记忆值得性判断）新增感知维度，必须走 LLM 语义评估；正则只允许作为 fallback 且必须有 trace 标记
15. **禁止新增固定标量/枚举作为状态本体**（Phase E）：新状态表示必须使用 Latent 向量；可解释标量/枚举只作为投影层存在，不得作为更新的输入或内在状态的直接量化
16. **Agent 不得绕过 soul 路径**（Phase E）：新增 agent 功能必须通过 `agentRequest` + `meta_cognition.arbitrateAgentInvocation()` 进入，禁止在 `runtime_pipeline` 中新增与 soul 路径并行的 agent 分叉
17. **会话能力扩展必须通过 capabilities 系统**：新增会话级别的操作（文件读取/URL 抓取/模式切换等），必须在 `capabilities/registry.ts` 注册、在 `capabilities/intent_resolver.ts` 添加识别规则，不得直接在 chat 主循环中添加 if 分支处理
---

## 7. 安全边界

- **ToolBus deny-by-default**：默认无工具；必须在 DecisionTrace 中显式批准（理由/预算/影响面）
- **Ctrl+C 可中止**：必须能停止工具调用与 streaming
- **成人内容门控**：`adultSafety` 默认关闭，需三重显式确认（adult_mode + age_verified + explicit_consent）
- **繁衍门控**：`ss persona reproduce` 需满足条件（libido / consent / safety_boundary）；`--force-all` 跳过但仍写入事件
- **API Key 不进仓库**：只允许环境变量或本地 config（gitignore）
- **日志脱敏**：trace/日志禁止输出绝对路径与用户长段原文

**Agent 主权边界（Phase E 新增）**：
- **人格最终裁决**：`orchestrator.decide()` 永远在 agent 之前运行；任何 agent 的执行都发生在人格已经思考过的上下文中
- **Agent 不写权威记忆**：agent 只能返回 `memoryProposals[]`；直接写 `memory_store` 的操作必须经过 `arbitrateMemoryProposals()` 批准通道
- **高风险动作默认拦截**：`agentType=action` 或 `riskLevel=high` 的 agent 动作，CLI 层必须向用户弹出确认；禁止静默执行
- **Latent 不可被规则直接写**：`moodLatent` / `relationshipLatent` 等 latent 向量只能通过"LLM评估→元认知裁决→commit"三阶段更新，禁止任何规则或外部系统直接覆写

---

## 8. CI 与质量门禁

### Git Commit 规范

**格式**：`<prefix>: <description> (<version>)`

| 字段 | 说明 |
|---|---|
| `prefix` | `feat` 新功能 · `fix` 缺陷修复 · `chore` 配置/构建/维护 · `docs` 纯文档 |
| `description` | 简明描述做了什么，**不能只写 "update"** |
| `version` | `(月.日.当日序号)` — 例如 `(2.24.07)` = 2月24日第7个提交 |

**示例**：
```
feat: migrate core LLM adapter to OpenAICompatAdapter (2.24.07)
fix: trim trailing slash from SOULSEED_BASE_URL in adapters (2.24.11)
docs: add dual-team assignment rules to Roadmap (2.24.12)
chore: update .env.example to SOULSEED_* vars (2.24.09)
```

**规则**：
- 按逻辑域拆分提交，不把不相关的变更合成一个 commit
- 同一批次（同时完成的多个提交）共享同一个 version 号，不必每个 commit 递增
- version 序号当日连续递增，跨日从 `.01` 重新计数
- 已推送的 commit 不得 amend / rebase rewrite

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
  CLI.md                   # 完整命令参考（含 Phase D/E 所有新命令）
  Roadmap.md               # 产品阶段总览（Phase A-G；含 G 阶段 H0-H8 扩展轨道）
  Quality-Evaluation.md    # 分层评测框架（L0-L5）
  Product-Standards.md     # 全产品实施标准（门禁/降级/兼容/迁移）
```

---

## License

Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0).  
See [LICENSE](LICENSE) for full terms.
