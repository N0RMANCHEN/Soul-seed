# contributing_ai.md — Soulseed (CLI / TypeScript)

> 本文件约束 **Dev AI（开发协作）**：用于 Cursor / Codex / 其它 AI 编程工具如何改动本仓库。
> 若与 `AGENT.md` 冲突：**以 `AGENT.md` 为准**。

---

## 0. Scope（范围）

- **Dev AI**：写代码、补测试、跑构建、更新文档。
- **Runtime AI**：产品内 Persona runtime / Orchestrator / ToolBus / ModelAdapter（属于产品能力，不属于 Dev AI 职责）。

### 0.1 Core-first & Multi-shell（对齐）

- CLI / iOS / Web 都是壳，核心逻辑必须优先放在 `packages/core`。
- 若某项逻辑可复用，不得只写在 `packages/cli` 的交互层。

---

## 1. Default Working Protocol（强制输出结构）

任何任务（哪怕很小）都必须按以下结构输出；缺一项 = 视为未完成：

1. **Goal（目标）**
2. **DoD（验收标准，PASS/FAIL）**
3. **Plan（步骤，可回滚）**
4. **Files to add/change（精确路径）**
5. **Verification（验证命令/预期）**
6. **Final Output（整文件交付，不给 diff）**
7. **Self-check（逐条标注 DoD：PASS / NOT VERIFIED）**

---

## 2. Read Order（每次会话开始必须阅读）

1. `AGENT.md`
2. `contributing_ai.md`
3. `doc/Roadmap.md`
4. `doc/Product-Standards.md`
5. `doc/Quality-Evaluation.md`
6. `doc/CLI.md`（若涉及 CLI 命令）
7. `README.md`
8. 若在排查构建：先看 `./scripts/verify.sh` 与 CI 日志
9. 若任务涉及门禁配置：检查 `config/h0/*.json` 与 `scripts/check_h0_gate.mjs`

说明：原则与边界以 `AGENT.md` 为唯一权威；本文件聚焦执行动作与验收要求。
---

## 3. Non-negotiables（铁律）

本节不重复定义产品原则，统一以 `AGENT.md` 第 6 节（开发铁律）与第 7 节（安全边界）为准。

本文件仅补充执行层约束：
- 默认采用最小变更集，禁止与当前任务无关的改动。
- 不得跳过验证门槛；`./scripts/verify.sh` 是任何改动的基础门禁。
- 所有改动必须执行文档联动排查，并在交付中写明结论（见 `AGENT.md` 的 `Doc Sync Gate`）。
- 任务达到 DoD 后，必须增量更新 `CHANGELOG.md` 当前版本节，记录本次新增/变更摘要（持续记录，不得攒到最后一次补记）。
- 任何新增命令、schema、迁移、线上链路改动，必须按第 5 节对应条款补齐验证或回归。

---

## 4. Secrets & API Keys（安全规则）

- API Key 不得提交进 git。
- 推荐：环境变量（`SOULSEED_API_KEY` 等）或本地 config（必须 gitignore）。
- 若引入配置文件：必须更新 `.gitignore` + README 说明。

---

## 5. Verification Gates（验证门槛）

### 5.1 Always（任何改动都必须）

- `./scripts/verify.sh` 通过（单一入口，失败退出非 0）。
- `npm run h0:check` 通过（当改动涉及 `config/h0/*` 时为必跑项）。
- 文档联动检查通过：按 `AGENT.md` 的 `Doc Sync Gate` 排查受影响文档；若无需更新，交付中必须说明理由。
- `CHANGELOG.md` 已同步：当前任务的新增/变更条目必须已写入当前版本节；若确实无用户可见变化，需在交付中说明“不更新 changelog 的理由”。
- 涉及信息裁切/意图识别的改动，必须声明四层路由设计（`L1 基向量 -> L2 潜向量 -> L3 元认知 -> L4 正则兜底`），且业务主路径不得走 regex。
- verify.sh 覆盖：
  - Lint（TypeScript 类型检查，三个包）
  - H0 门禁（`npm run h0:check`，含 `config/h0/*` 与 `invariant_table.json`）
  - Direct-writes 门禁（`scripts/check_direct_writes.mjs`，E2：状态文件仅允许指定模块写入）
  - Changelog 门禁
  - 全量单元测试（`packages/core` + `packages/cli` + `packages/mcp-server`）
  - 构建（三个包）
- 若改动涉及在线模型链路（ModelAdapter / chat online path），必须额外运行 `npm run acceptance` 并记录报告路径。

### 5.2 Chat / ModelAdapter changes（改动驱动链路必须）

至少完成 3 项回归：
1. 选择一个 persona 目录 → 成功加载
2. 发消息 → 模型返回（最好 streaming）
3. 对话后 life.log 追加写入（重新打开仍存在）

### 5.3 Storage / schema changes（改动 persona 文件结构必须）

- 确保 life.log append-only；不得把二进制塞进 JSON（attachments 引用）。
- **状态文件写入**：mood_state.json、relationship_state.json、interests.json、cognition_state.json、voice_profile.json、social_graph.json 仅允许通过 `state_delta_writer.ts` 或 `state_delta_apply.ts` 写入；新增状态域必须注册到 `StateDeltaDomain` 与 `DOMAIN_FILE_MAP`，并加入 `scripts/check_direct_writes.mjs` 的允许列表。
- 若实现 hash 链：必须增加"断链检测"用例（fixture + test）。
- 增加/变更 schema 必须有 `schemaVersion` 与迁移策略，并提供迁移测试或 fixture。
- 修改 `memory.db` 结构：必须增加 schema version 校验与升级路径。


### 5.3a Compatibility regression（兼容性回归必须）

当你引入 Genome / 会话控制面 / 兴趣-注意力链路时，必须额外完成：

- **旧 persona 目录健康加载**：使用至少 1 份旧版本 persona fixture（缺少新文件/旧 schemaVersion）跑 `./ss doctor`，结果应为 PASS 或仅提示“可选迁移”（不得崩溃）。
- **迁移幂等**：对同一 persona 连续跑两次迁移脚本（如 `./scripts/migrate_schema.mjs` 或 CLI 的 migrate 命令），第二次不得再改写任何文件内容（可对比 hash 或 mtime/内容）。
- **行为基线不突变**：在 compatMode=legacy 下跑 3 条固定输入（fixture），至少保证：
  1) 不会突然开始大量 emoji
  2) 不会把每条消息都当任务长答
  3) 主动打扰不会频率飙升
  > 注：允许“内部 state 更新更细”，但外显行为必须稳定

### 5.4 Orchestrator / DecisionTrace changes（改动决策闭环必须）

- 至少新增/更新 1 个单元测试：mock ModelAdapter + mock ToolBus。
- `DecisionTrace` 必须结构化、可验证（schema 校验或类型约束）。
- 若改动决策逻辑：必须更新 replay fixture 或新增回放用例（`runtime_pipeline_replay.test.mjs`），保证关键决策可稳定复现。

### 5.5 Doctor changes（改动 doctor 必须）

- 至少提供 1 组坏数据 fixture（缺文件/断链/丢附件）+ 期望诊断输出。
- Doctor 不得"悄悄修复历史"：只能提示/生成迁移方案；任何修复必须写入事件（scar / migration event）。

### 5.6 ToolBus changes（改动工具系统必须）

- 默认 deny-by-default 不可破。
- 必须验证 Ctrl+C/abort 能中止工具与 streaming（至少 1 条自动化测试或脚本回归）。

### 5.7 Consistency Kernel changes（改动守卫链必须）

- 每个守卫层必须有独立单元测试（`consistency_kernel.test.mjs` 及各 guard 测试文件）。
- 改动裁决逻辑（allow/rewrite/reject）必须补对应 fixture 和回归用例。

### 5.8 Memory changes（改动记忆系统必须）

- 改动 Hybrid RAG 检索：运行 `memory eval recall` 回归，确认 `Recall@K` 和 `MRR` 不下降。
- 改动记忆生命周期/衰减：补 `memory_lifecycle_scoring.test.mjs` 用例。
- 改动整合逻辑：补 `memory_consolidation.test.mjs` 用例。
- 改动存储预算：补 `memory_budget.test.mjs` 用例。

### 5.9 CLI commands（改动 CLI 命令必须）

- 改动命令解析/参数/路径/默认值：补对应命令级验证（测试或实际执行结果）。
- 新增命令：同步更新 `doc/CLI.md`。
- 改动 `ss chat` 主循环或会话内命令：运行 `npm run acceptance` 验证。

### 5.10 Capabilities system（改动会话能力系统必须）

- 新增会话能力：在 `capabilities/registry.ts` 注册（含 risk / ownerOnly / requiresConfirmation）。
- 新增自然语言触发规则：在 `capabilities/intent_resolver.ts` 添加对应 Pattern/匹配逻辑。
- 新增后补集成测试：至少验证正向触发 + 非触发不误匹配。
- 高风险能力（risk="high"）必须有 owner auth 或显式确认机制。

### 5.11 Latent 向量相关改动（改动 latent 系统必须）

- 新增 latent 向量维度或类型：在 `types.ts` 定义并在 `doctor.ts` 的 `checkLatentHealth` 中添加验证逻辑。
- 改动 latent 更新路径：必须保持"LLM评估 → 元认知裁决 → normalize commit"三阶段协议，禁止规则或外部系统直接覆写。
- 改动跨维度联动（`latent_cross_influence.ts`）：更新后确认联动系数仍在 ≤0.05 上界内，补对应单元测试。

---

## 6. 关键文件映射（快速定位）

| 功能 | 文件 |
|------|------|
| 轮次执行入口 | `packages/core/src/execution_protocol.ts` |
| 双进程路由 | `packages/core/src/dual_process_router.ts` |
| 五段式流水线 | `packages/core/src/runtime_pipeline.ts` |
| Agent 多步执行 | `packages/core/src/agent_engine.ts` |
| 五层一致性守卫 | `packages/core/src/consistency_kernel.ts` |
| 决策编排 | `packages/core/src/orchestrator.ts` |
| LLM 元认知审核 | `packages/core/src/meta_review.ts` |
| 人格自修正 | `packages/core/src/self_revision.ts` |
| 宪法晶化管道 | `packages/core/src/constitution_crystallization.ts` |
| 宪法质量评分 | `packages/core/src/constitution_quality.ts` |
| 行为漂移检测 | `packages/core/src/behavior_drift.ts` |
| 决策解释 | `packages/core/src/explain.ts` |
| 模型路由配置 | `packages/core/src/model_router.ts` |
| 记忆存储（SQLite） | `packages/core/src/memory_store.ts` |
| 向量嵌入索引 | `packages/core/src/memory_embeddings.ts` |
| 记忆整合 | `packages/core/src/memory_consolidation.ts` |
| 用户事实提取 | `packages/core/src/memory_user_facts.ts` |
| 社交关系图谱 | `packages/core/src/social_graph.ts` |
| Few-shot 示例库 | `packages/core/src/golden_examples.ts` |
| SFT 数据集导出 | `packages/core/src/finetune_export.ts` |
| 人格文件 I/O | `packages/core/src/persona.ts` |
| 人格导入/导出 | `packages/core/src/persona_migration.ts` |
| 主动消息引擎 | `packages/core/src/proactive/engine.ts` |
| 目标持久化 | `packages/core/src/goal_store.ts` |
| DecisionTrace schema | `packages/core/src/decision_trace.ts` |
| DecisionTrace 类型 | `packages/core/src/types.ts` |
| Doctor 体检 | `packages/core/src/doctor.ts` |
| 内在情绪状态 | `packages/core/src/mood_state.ts` |
| 自传体叙事 | `packages/core/src/autobiography.ts` |
| 兴趣分布（内在驱动） | `packages/core/src/interests.ts` |
| 会话控制主模块 | `packages/core/src/conversation_control.ts` |
| 语义投影层（向量锚点/元认知仲裁） | `packages/core/src/semantic_projection.ts` |
| 时间线回看意图识别 | `packages/core/src/recall_navigation_intent.ts` |
| 人称角色守卫 | `packages/core/src/pronoun_role_guard.ts` |
| 主动交互引擎（当前入口） | `packages/core/src/proactive/engine.ts` |
| Genome/天赋 | `packages/core/src/genome.ts`、`genome_derived.ts`、`genome_randomness.ts` |
| Epigenetics/表观学习 | `packages/core/src/genome.ts`（EpigeneticsConfig）；运行时漂移门控待 `H/P0-0` |
| 周期自我反思 | `packages/core/src/self_reflection.ts` |
| 内容安全语义评估 | `packages/core/src/content_safety_semantic.ts` |
| Agent 记忆提案协议 | `packages/core/src/agent_memory_proposal.ts` |
| 表达/信念向量持久化 | `packages/core/src/expression_belief_state.ts` |
| 跨维度 Latent 联动 | `packages/core/src/latent_cross_influence.ts` |
| 路由权重自适应 | `packages/core/src/routing_adaptation.ts` |
| Life.log 自动轮换 | `packages/core/src/memory_rotation.ts` |
| 会话能力注册表 | `packages/core/src/capabilities/registry.ts` |
| 会话能力意图解析 | `packages/core/src/capabilities/intent_resolver.ts` |
| CLI 主入口 | `packages/cli/src/index.ts` |
| MCP 工具注册 | `packages/mcp-server/src/tool_registry.ts` |
| MCP 工具定义 | `packages/mcp-server/src/tool_definitions.ts` |

---

## 7. Output Rules（交付格式）

- 只输出整文件（完整内容可复制粘贴），不要给 diff。
- 文件名必须写清楚：
  - `# FILE: packages/core/src/...`
  - `# FILE: doc/CLI.md`

---

## 8. Definition of Done（一次贡献成功标准）

必须同时满足：

- 不违反 `AGENT.md` 铁律
- `./scripts/verify.sh` 通过 + CI 全绿
- 驱动闭环不被破坏（能加载 persona、能聊、能写回）
- Persona 存储可迁移、可审计、life.log append-only（hash 链完整）
- `DecisionTrace` 结构化且可回放（至少 mock 回放）
- 不引入显式评分反馈作为主闭环
- 主动思考不是文案：由 decision/tension/代价预算驱动
- 四条核心指标（持续自我/价值结构/不可逆损失/情绪控制信号）的实现路径更清晰而不是更模糊
- 在线链路改动已通过 `npm run acceptance`，并提供报告文件（成功或失败归因）
- 验收未污染日常 persona（只使用 `personas/_qa/*`）
- 若新增/修改 CLI 命令：`doc/CLI.md` 已同步更新
- 文档联动检查已完成（或已说明“无需更新”的理由）
