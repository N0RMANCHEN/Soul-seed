> Progress: 以 doc/Roadmap.md 为准（本计划仅描述 scope，不做逐任务快照）

# Phase K Multi-Persona Chat Plan

## 目标摘要

建立多 persona 会话编排、发言仲裁、上下文隔离和评测闭环，实现 AGENT.md 定义的 **Group Chat（AI 群聊）** 形态：默认沉默 + 参与门槛 + 仲裁（避免多 persona 抢答）。

1. **K0（会话层）**：多人格图谱、注册表、回合调度基线
2. **K1（治理层）**：发言仲裁、上下文隔离、主动协同策略
3. **K2（产品层）**：CLI 可用、评测闭环可跑、故障可回放

## 既有基础（可复用）

- `conversation_control.ts`：`decideGroupParticipation()` 已实现单人格视角的群聊参与决策（`isGroupChat`、`addressedToAssistant`、`consecutiveAssistantTurns`、`mode: speak|wait|brief_ack`）
- `DecisionTrace.groupParticipation`：已有 schema 与 reasonCodes
- `orchestrator.ts`：已有 `isGroupChat` 检测（transcriptSpeakerHits >= 2 或关键词）
- `doc/Product-Standards.md` §3.4：群聊仲裁必须确定性，addressing 权重高于兴趣权重
- `doc/checklists/appendix_b_access_points.md`：Group Arbitration 插入点为 group-chat message dispatch layer

## 已落地基础设施（Phase K 前置）

以下改动已在 Phase J 收尾期间合入 `main`，Phase K 直接复用：

| 改动 | 位置 | 作用 |
|------|------|------|
| `LifeEventSpeaker` 接口 | `types.ts` | `role` / `actorId` / `actorLabel` 三元组，标注每条 life event 的发言者 |
| `appendLifeEvent` 自动注入 speaker | `persona.ts` `withDefaultMessageSpeaker()` | `user_message` / `assistant_message` 缺省补全 speaker，零改动兼容老数据 |
| memory.db schema v10 | `memory_store.ts` | 新增 `speaker_role` / `speaker_id` / `speaker_label` 列；v9→v10 迁移自动从 `origin_role` 回填 |
| ingest / recall / archive 路径 | `memory_ingest.ts` / `memory_recall.ts` / `memory_archive.ts` | 存储、检索、归档全链路感知 speaker 三元组 |
| CLI speaker 构建器 | `cli/src/index.ts` `buildAssistantSpeaker()` / `buildUserSpeaker()` | CLI 发送的每条消息显式携带 speaker |
| 兼容性测试 | `lifelog.test.mjs` / `memory_store_migration_v2.test.mjs` / `memory_ingest.test.mjs` | legacy 无 speaker 的 life log、v9 memory.db 均可正常加载/迁移 |

**Phase K 复用要点**：多人格场景中，每个 persona 的 `actorId` / `actorLabel` 天然区分发言来源；K/P0-0 注册表需将 registry ID 对齐为 speaker `actorId`，K/P1-0 隔离审计可直接查询 `speaker_id` 列做跨人格泄漏检测。

## 任务清单（含依赖链）

### K0 会话层

1. **K/P0-0 多人格会话图谱与注册表**  
   依赖：无（Phase K 启动项）  
   交付：
   - persona registry（`PersonaRegistryEntry` 接口，ID 对齐 speaker `actorId`）
   - 会话拓扑（`SessionGraph`：节点=persona，边=可通信关系）
   - 角色元数据约束（display name 唯一性、最大注册数硬上限）
   - 新增 persona 包内状态工件契约：
     - `group_policy.json`：多人格会话策略（仲裁模式、隔离等级、协同开关）
     - `session_graph.json`：当前活跃会话拓扑快照
     - `speaker_registry.json`：注册 persona 清单与角色标签映射
   - 每个新工件须提供 JSON Schema（存入 `schemas/`）、初始 seed 值、版本字段  
   门禁：
   - 注册失败与冲突必须有明确错误码与恢复路径
   - 新增工件必须满足 compatMode 缺省可加载（legacy persona 目录无此文件时 → 隐式默认值，不报错）
   - seed-from-existing：从现有 persona 状态推导初始值，不做 hard reset
   - 迁移幂等：`ensurePersonaPackage()` 反复运行不产生副作用
   - `scripts/check_direct_writes.mjs` 必须覆盖新工件写入路径

2. **K/P0-1 多人格发言仲裁器（addressing 优先）**  
   依赖：K/P0-0  
   交付：addressing 命中优先、冲突仲裁、静默角色唤醒机制  
   门禁：冲突时必须确定唯一发言者，且理由可追溯

3. **K/P0-2 回合调度与抢答抑制**  
   依赖：K/P0-1  
   交付：round-robin + 优先级混合调度、抢答抑制与超时接管  
   门禁：不得出现同一 persona 连续霸占回合

4. **K/P0-3 兼容性与迁移门禁**  
   依赖：K/P0-0（工件 schema 冻结后）  
   交付：
   - 全量 K 新增工件的 JSON Schema 验证脚本（`scripts/validate_k_schemas.mjs`）
   - 迁移函数：legacy persona 目录 → K 工件 seed（幂等，可重入）
   - fixture 回归套件：至少覆盖 legacy persona（无 K 工件）、hybrid persona（部分 K 工件）、full-K persona 三种形态
   - feature flag 集成：`SOULSEED_PHASE_K_ENABLE`（默认 `0`）控制 K 代码路径；flag=0 时所有 K 工件可存在但不被读取
   - `doctor` 扩展：K 工件健康检查项（schema 合法性、版本一致性、orphan 检测）  
   门禁：
   - `npm run test` fixture 套件全绿
   - flag=0 下现有 persona 行为零退化（doctor pass、chat 基线不变）
   - 迁移脚本在 v9 和 v10 memory.db 上均幂等

### K1 治理层

5. **K/P1-0 上下文总线与私有记忆隔离**  
   依赖：K/P0-0、K/P0-3（feature flag 就绪后）  
   交付：
   - shared bus（多人格共享上下文通道）与 private lane（per-persona 专有记忆/状态通道）分层架构
   - 读写权限矩阵：哪些状态跨 persona 可读 / 可写 / 不可见
   - 泄漏审计：基于 `speaker_id` 列的跨人格记忆访问日志，异常访问自动告警
   - 隔离断言库：可在测试与 CI 中复用的 `assertNoLeakage(sessionId)` 工具函数  
   门禁：
   - 跨 persona 私有记忆泄漏率必须为 0（评测样本集，≥50 条多人格对话）
   - 泄漏检测到时 fail-closed 到 single-persona 模式（不降级到 shared-only）

6. **K/P1-1 多人格主动协同规划器**  
   依赖：K/P0-2、K/P1-0  
   交付：协作任务分解、角色分工、互相引用与冲突降解策略  
   门禁：协同模式下总体回复时延不超过单人格基线阈值上限

7. **K/P1-2 CLI 多人格交互命令与会话视图**  
   依赖：K/P0-2、K/P1-0  
   交付：
   - 会话内 persona 视图（`/who`：列出当前活跃 persona 及状态）
   - 发言来源标注（复用已落地 `speakerLabel`，渲染 `[assistant:Luna]` 样式前缀）
   - 切换与静默控制命令（`/mute <persona>`、`/solo <persona>`、`/invite <persona>`）
   - `--multi-persona` CLI flag 入口，受 `SOULSEED_PHASE_K_ENABLE` 控制  
   门禁：
   - 每个命令须有对应的单元测试（命令解析 + 预期输出断言）
   - 端到端验收场景：≥1 个双 persona 对话脚本，验证发言标注、切换、静默全流程
   - 身份混淆零容忍：测试中任何输出行的 speaker label 与实际发言 persona 不匹配即 FAIL
   - flag=0 时所有多人格命令返回 "multi-persona not enabled" 提示，不报错不崩溃

### K2 产品层

8. **K/P1-3 多人格评测赛道（AB 共建）**  
   依赖：K/P1-1、K/P1-2、K/P0-3  
   交付：
   - 评测数据集：≥50 条多人格对话场景（含 addressing、冲突、协同、隔离边界），存入 `test/fixtures/k_eval/`
   - 评测脚本：`scripts/eval_multi_persona.mjs`，输出 JSON scorecard
   - 核心指标与初始阈值：
     - `ArbitrationAccuracy >= 0.90`（仲裁正确率：addressed persona 被正确选中）
     - `LeakageRate == 0`（跨 persona 私有记忆泄漏）
     - `TurnMonopolyRate <= 0.05`（单 persona 连续霸占 ≥3 回合的比例）
     - `SpeakerLabelAccuracy == 1.0`（CLI 输出 speaker 标注与实际一致）
     - `CooperationLatencyP95 <= 1.5x SinglePersonaP95`（协同时延上限）
   - 阈值可按基线滚动调整，但只能收紧不能放松  
   门禁：
   - 评测指标进入 `doc/Quality-Evaluation.md` §6.1 PR 门禁
   - `eval_all.sh` 集成 `eval_multi_persona.mjs`；`verify.sh` 含 strict 阈值阻断
   - scorecard JSON 归档到 `reports/quality/` 并纳入 CI artifact

## 阶段出口标准（DoD）

- **K0 出口**：至少支持双人格稳定轮转，发言顺序可追踪可复放；K 工件 schema 冻结，兼容门禁（K/P0-3）全绿
- **K1 出口**：私有记忆隔离有效（`LeakageRate == 0`），跨人格污染可检测且可阻断；CLI 多人格命令端到端验收通过
- **K2 出口**：评测赛道纳入 CI 门禁链路，所有初始阈值达标；legacy persona 在 flag=0 下行为零退化（doctor pass + chat 基线不变）

## 入口条件

1. `doc/plans/README.md` Active Index 已登记本计划
2. `doc/Roadmap.md` 将 Phase K 任务标记为 `todo`（或首个任务 `in_progress`）
3. `npm run verify` 绿线基准存在
4. Phase J 交互闭环已完成（可选依赖：engagement/topic 状态可复用）

## 出口条件

1. K/P0-0 至 K/P0-3、K/P1-0 至 K/P1-3 在 Roadmap 标记为 `done`
2. 计划文件归档至 `doc/plans/archive/` 并更新 archive index
3. `npm run verify`、`npm run governance:check`、`npm run doc-consistency:check` 全通过
4. 多人格评测纳入 `eval_all.sh` 与 `verify.sh` 门禁链路

## A/B 分工（建议）

1. **A**：核心契约（registry、arbitration、shared/private bus）、状态协议、评测口径、兼容/迁移门禁
2. **B**：CLI 接入、会话视图、命令流、回放脚本
3. **同步点**：
   - K/P0-0 registry 冻结后并行推进 K/P0-1 与 K/P0-3
   - K/P0-3 feature flag 就绪后启动 K/P1-0（隔离层依赖 flag 切换）
   - K/P0-2 合入前完成 K/P1-0 最小隔离门禁
   - K/P1-3 与 K/P1-1、K/P1-2 可 AB 共建（评测脚本与 CLI 并行迭代）；K/P1-3 依赖 K/P0-3 fixture 套件

## 风险与回滚策略

1. **风险**：多人格模式破坏单人格主链路  
   **回滚**：`SOULSEED_PHASE_K_ENABLE=0` 或 `--single-persona` 默认，多人格以 feature flag 灰度

2. **风险**：私有记忆泄漏导致跨人格污染  
   **回滚**：K/P1-0 门禁硬阻断；泄漏率 > 0 时自动 fail-closed 到 single-persona 安全模式并告警（禁止降级到 shared-only）

3. **风险**：仲裁冲突导致多 persona 同时发言或无人发言  
   **回滚**：冲突时 fallback 到 round-robin；超时接管规则必须 deterministic

4. **风险**：新增状态文件绕过 direct-write 门禁  
   **回滚**：`state_write_registry` + `scripts/check_direct_writes.mjs` 必须覆盖多人格会话状态

## 与 Phase J / Phase M 的衔接

- **Phase J**：`engagementTrace`、`topic_state`、`topicScheduler` 可复用为多人格场景下的 per-persona 投入与话题调度输入
- **Phase M**：多人格场景下每个 persona 的 latent/feeling 独立演化，不共享；后续 M 的 genome/epigenetics 需支持 per-persona 隔离

## 文档联动清单（变更时必查）

- `AGENT.md`（Group Chat 形态描述）
- `doc/Product-Standards.md`（§3.4 群聊仲裁）
- `doc/Quality-Evaluation.md`（多人格评测指标）
- `doc/Persona-Package-Layout.md`（group_policy.json 若引入）
- `doc/CLI.md`（多人格命令）
- `doc/checklists/appendix_b_access_points.md`（Group Arbitration 插入点）
