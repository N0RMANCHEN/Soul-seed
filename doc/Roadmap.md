# Soulseed Roadmap (Execution-Oriented, Reindexed, Archive-Complete)

## 文档规则总纲
- 更新日期：2026-02-25
- 核验范围：`/Users/hirohi/Soul-seed` + `/Users/hirohi/Downloads/Soul-seed-2.24.03/doc/`
- 状态定义：`todo` / `in_progress` / `blocked` / `done` / `deferred` / `historical`

### 1) Phase 展示与优先级规则
- Phase 可无限扩展：`Phase F -> G -> H -> I -> J -> K ...`。
- 当前执行优先级（跨 Phase）：`Phase Ha > Hb > Hc > Phase J > Phase K > Phase I`。
- 同一时刻默认只允许一个 Phase 进入主开发态，后续 Phase 以前序 Phase 的出口条件为门禁。

### 1.1) Phase 与版本联动规则（强制）
- 每当一个完整 Phase 达到“全部任务完成并归档”的状态，必须同步执行一次版本号 `minor` 递增（即 `x.y.z` 中 `y` 加 1）。
- 递增 minor 时，必须同步更新：`package.json`、workspace 包版本、`CHANGELOG.md` 当前版本节、README 版本徽标以及相关门禁文件中的版本常量。
- 若 Phase 完成但暂不发布版本，必须在 Roadmap 与交付说明里明确“延迟发布原因”和计划发布时间。

### 1.2) Phase 切分规则（强制）
- 每个 Phase 必须是“单一目标域”的可交付切片，不允许把 `状态内核`、`交互体验`、`产品化治理` 三类高耦合目标混在同一 Phase。
- 触发切分条件（任一满足即必须拆新 Phase）：
  - 任务规模超过 `12` 个 active 项；
  - 出现 `>=3` 条跨域硬依赖链（如状态内核任务直接阻塞交互体验任务）；
  - 验收口径不一致（同一 Phase 同时需要结构门禁 + UX 体验门禁且无法同批验证）。
- 切分后必须显式声明：`新 Phase 目标`、`入口条件`、`出口条件`、`与前一 Phase 的依赖边界`、`版本影响（是否触发 minor 递增）`。
- 新 Phase 的任务编号必须连续追加，不得改写既有任务 ID。

### 1.3) Sub-phase 计划文档规则（强制）
- 当一个 Phase 被切分为多个 sub-phase（如 Ha/Hb/Hc），每个 sub-phase 必须在 `doc/plans/` 下有独立计划文件，命名 `{SubPhase}-{ShortTitle}.md`（如 `Ha-State-Infra.md`）。
- 计划文件必须包含：目标摘要、任务清单（含依赖链）、入口/出口条件、A/B 分工、风险与回滚策略。
- 高层汇总计划（如 `H-State-Closure-Plan.md`）继续保留作为跨 sub-phase 的总览与同步点说明。
- 计划文件创建后，实现进度以 Roadmap 为准；计划文件只在 scope 变更时更新，不做逐任务进度同步。

### 2) 任务编号规则
- 本次执行一次性重编号（2026-02-24），用于清理历史混编编号。
- 重编号后规则生效：任务 ID 冻结，不再改号；新增任务仅追加编号。
- 格式：`{Phase}/P{priority}-{seq}`，例如 `F/P0-0`。
- 排列规则：按**逻辑依赖顺序**排列（先基础后上层），不强制按 P0/P1/P2 分组展示。

### 3) 任务信息完整性规则
- 每个任务必须包含：`原编号`、`来源需求`、`实现方式`、`测试/DoD`、`依赖`、`回滚`。
- 来源文件更新后，必须联动排查：`README.md`、`AGENT.md`、`contributing_ai.md`、`doc/Product-Standards.md`、`doc/Quality-Evaluation.md`、`doc/Roadmap.md`。

### 3.1) 语义识别实现规则（强制）
- 以 `doc/Product-Standards.md` 第 `3.6` 节为唯一规范源。
- Roadmap 只维护任务化落地，不重复定义框架细则。

### 4) 归档规则
- `done` 任务直接从当前 Roadmap active 列表移除。
- 不单独维护“已完成任务归档”章节，完成记录以 Git 历史为准。

### 5) 双人分工规则（轻量执行版）
- 分工原则：A 负责 `state-core`（状态/记忆/情绪/行为演化），B 负责 `control-plane`（路由/安全/兼容/治理）。
- active 任务必须补齐最小字段：`负责人`、`域标签`、`同步点`、`阻塞级别`、`回滚归属`。
- 同步点必须显式声明：`等待 X 完成 Y`；禁止隐式依赖。
- 同一 Phase 任务工作量差距建议控制在 30% 以内；超出需注明原因。
- AB 共建任务必须写主副责（例如 `AB(A主/B辅)`）。

### 5.1) 执行前任务分组评估规则（强制）
- 每次开始执行计划前，必须先做一次任务分组评估：`复杂度`（S/M/L）+ `耦合度`（low/medium/high）+ `风险等级`（soft/hard）。
- 分组决策规则：
  - `低耦合 + S/M`：可并行执行，单次建议 `2-3` 个任务。
  - `中耦合`：建议串行为主，必要时并行但必须设同步点。
  - `高耦合 或 hard 风险`：必须串行，单次仅 `1` 个任务，完成并验证后再进入下一项。
- 交付时必须写明本次选择“并行/串行”的依据与分组结果。

### 5.2) 新 Phase 接手前分工规划规则（强制）
- 每次进入一个新 Phase 前，必须先完成该 Phase 的分工规划，再开始编码实现。
- 分工规划至少包含：`任务归属(A/B/AB)`、`关键依赖链`、`同步点`、`并行批次划分`、`回滚责任归属`。
- 未完成分工规划时，Phase 任务状态不得从 `todo` 切换到 `in_progress`。

## 当前执行总览（重排后）
- `done`：Phase H 全部完成 — Ha（H/P0-0..4）、Hb（H/P1-0..7）、Hc（H/P1-8..10, H/P1-12..19）
- `blocked`：`none`
- `todo`：Phase J（下一优先级）
- **Phase Ha 完成说明**：State Delta Pipeline（H/P0-0）+ Invariant Table（H/P0-1）+ Compat Migration（H/P0-2）+ Compat Constants（H/P0-3）+ Genome MVP（H/P0-4）全部落地。
- **Phase Hb 完成说明**：Values/Personality（H/P1-0）+ Goals/Beliefs（H/P1-1）+ Memory Forgetting（H/P1-2）+ Relationship State（H/P1-3）+ Persona Package v0.4（H/P1-4）+ Affect 3-Layer（H/P1-5）+ Imperfection DoD（H/P1-6）+ Compat Checklist（H/P1-7）全部落地；触发 minor bump 至 0.4.0。
- **Phase Hc 完成说明**：3 项回归套件 green（relationship, emotional depth, governance）；5 项风险护栏 CI active；schema contracts binding；access-point checklist mapped。H/P1-8..10, H/P1-12..19 全部落地；Phase H 完整闭环，触发 minor bump 至 0.5.0。

## 现状评估（兴趣/注意力/主动交互）
- 结论：`部分搭成，尚未形成完整闭环`。
- 已有能力（代码已接主链路）：
  - 兴趣更新：`interests.json` 每轮演化与 `curiosity` 计算已落地。
  - 注意力映射：已存在 `Interest -> Attention -> EngagementTier` 决策链。
  - 主动消息：CLI 已有定时 tick、概率决策、静默时段与 cooldown 机制。
- 核心缺口（未达产品愿景）：
  - 缺 `topic_state / unresolved_threads / engagement_plan / proactive_plan` 的工程化落盘与治理闭环。
  - 主动消息未实现“先规划后生成”的强约束（intent/topic/entity/goal/justification 契约不完整）。
  - 交互形态仍以 `user turn -> assistant turn` 为主，缺少更接近人类对话的连续会话策略（插话节流、重叠意图处理、自然停顿协商）。
  - 体验质量门禁未形成独立赛道（缺“非轮询式交互体验”专项回归与阈值）。

## 现状评估（多人格聊天系统）
- 结论：`未搭成可发布版本`，当前仅有群聊参与判定雏形，缺完整系统能力。
- 已有能力（局部）：
  - 单 persona 的 `groupParticipation` 决策字段与基础 cooldown 判定。
  - 主动消息/会话控制可输出 group 相关 reason codes。
- 核心缺口（必须补齐）：
  - 缺多人格会话编排层（speaker registry、回合调度、冲突仲裁、抢答抑制）。
  - 缺 persona 间上下文隔离与共享边界（shared context vs private memory）策略。
  - 缺多人格主动消息协调器（避免多 persona 同时触发主动打扰）。
  - 缺多人格评测赛道（覆盖 addressing 命中率、插话冲突率、persona identity leakage）。

## 分工总览（双人并行）

- `Phase G` 已完成并从 active 列表移除（按归档规则由 Git 历史保留）。

### Phase Ha 分工（State Infrastructure & Compat Foundation，5 tasks）

| Person A | Person B |
|---|---|
| **H/P0-0 AB共建** State Delta Pipeline | **H/P0-0 AB共建** |
| H/P0-1 Invariant Table | H/P0-2 Compat & Migration |
| | H/P0-3 Compat Constants |
| | H/P0-4 Genome & Epigenetics |

- 任务数：A=2 + 共建1 | B=4 + 共建1
- ⚠ 同步点（B→A）：H/P0-4 依赖 H/P0-2 + H/P0-3

### Phase Hb 分工（Mind Model State Modules，8 tasks）

| Person A | Person B |
|---|---|
| H/P1-0 Values / Personality | H/P1-4 Persona Package v0.4 |
| H/P1-1 Goals / Beliefs | H/P1-7 Compat Checklist |
| H/P1-2 Memory Forgetting |  |
| H/P1-3 Relationship State |  |
| H/P1-5 Affect 3-Layer ⚠sync |  |
| H/P1-6 Imperfection DoD |  |

- 任务数：A=6 | B=2
- ⚠ 同步点（B→A）：A 的 `H/P1-5` 需等 Phase Ha 的 `H/P0-4` 完成

### Phase Hc 分工（Verification & Governance，11 tasks）

| Person A | Person B |
|---|---|
| H/P1-8 Relationship Regression | H/P1-10 Governance Regression |
| H/P1-9 Emotional Depth Regression | H/P1-14 Epigenetics Backdoor Guard |
| H/P1-12 Over-numericalization Guard | H/P1-15 Genome Trait Gate |
| H/P1-13 Relationship Noise Guard | H/P1-16 LLM Direct-Write Ban |
| | H/P1-17 Schema Contracts |
| | H/P1-18 Appendix A Schemas |
| | H/P1-19 Access-Point Checklist |

- 任务数：A=4 | B=7
- `H/P1-11`（可观测性回归）已移至 Phase I 重编号为 `I/P1-11`
- 注：Hc 中 H/P1-10, H/P1-14, H/P1-15, H/P1-16, H/P1-19 仅依赖 Phase Ha，可与 Phase Hb 并行启动

### Phase I 分工

| Person A | Person B |
|---|---|
| I/P0-2 性能与可观测 | I/P0-0 开源合规 |
| I/P2-0 Inheritance（可选） | I/P0-3 OK 定义产品化门禁 |
| | I/P1-11 可观测性回归（原 H/P1-11，解锁于 A 的 I/P0-2） |

- ⚠ 同步点（A→B）：B 的 `I/P1-11` 需等 A 完成 `I/P0-2`
- 任务数：A=2 | B=3 | I/P2-0 为 Could 级可选

### Phase J 分工

| Person A | Person B |
|---|---|
| J/P0-0 Interest-Attention 状态闭环 | J/P0-1 Proactive Planner 契约化 |
| J/P0-2 非轮询会话循环（核心交互层） | J/P1-0 Engagement Plan + 预算门禁 |
| J/P1-1 多话题上下文调度器 | J/P1-2 交互体验评测赛道 |

- ⚠ 同步点（A→B）：`J/P1-2` 需等 `J/P0-2` 稳定后才能固化阈值
- 任务数：A=3 | B=3 | 差距 0%

### Phase K 分工

| Person A | Person B |
|---|---|
| K/P0-0 多人格会话图谱与注册表 | K/P0-1 多人格发言仲裁器（addressing 优先） |
| K/P0-2 回合调度与抢答抑制 | K/P1-0 上下文总线与私有记忆隔离 |
| K/P1-1 多人格主动协同规划器 | K/P1-2 CLI 多人格交互命令与会话视图 |
| K/P1-3 多人格评测赛道（AB共建） | K/P1-3 多人格评测赛道（AB共建） |

- ⚠ 同步点 1（A→B）：`K/P1-2` 需等 `K/P0-0` 注册表结构冻结
- ⚠ 同步点 2（B→A）：`K/P1-1` 需等 `K/P0-1` 仲裁策略稳定
- 任务数：A=4（含共建1）| B=4（含共建1）| 差距 0%

## 全量重排排期（不丢失）

### 迭代窗口与批次策略
- `W1-W3`：Phase Ha（State Infrastructure，高耦合，严格串行）
  - `H/P0-0 -> H/P0-1 -> H/P0-2 -> H/P0-3 -> H/P0-4`
- `W4-W6`：Phase Hb（Mind Model Modules，中耦合，串行主 + 小并行）
  - `H/P1-0 -> H/P1-1 -> H/P1-2 -> H/P1-3 -> H/P1-4 -> H/P1-5 -> H/P1-6 -> H/P1-7`
- `W7-W8`：Phase Hc（Verification & Governance，低耦合，分组并行）
  - `(H/P1-8 || H/P1-12) -> (H/P1-9 || H/P1-13) -> H/P1-10 -> (H/P1-14 || H/P1-15 || H/P1-16) -> H/P1-17 -> H/P1-18 -> H/P1-19`
  - 注：H/P1-10, H/P1-14..16, H/P1-19 仅依赖 Ha，可提前启动
- `W9-W10`：Phase J（交互体验闭环，`P0` 串行，`P1` 条件并行）
  - `J/P0-0 -> J/P0-1 -> J/P0-2 -> (J/P1-0 || J/P1-1) -> J/P1-2`
- `W11-W12`：Phase K（多人格聊天系统，仲裁链路串行，工具/评测并行）
  - `K/P0-0 -> K/P0-1 -> K/P0-2 -> (K/P1-0 || K/P1-2) -> K/P1-1 -> K/P1-3`
- `W13+`：Phase I（产品化收口）
  - `I/P0-0 -> I/P0-2 -> I/P0-3 -> I/P2-0 -> I/P2-1`

### 任务保全映射（防丢失）
- `Phase Ha`：`5` 项（`H/P0-0..4`）— State Infrastructure & Compat
- `Phase Hb`：`8` 项（`H/P1-0..7`）— Mind Model State Modules
- `Phase Hc`：`11` 项（`H/P1-8..10` + `H/P1-12..19`）— Verification & Governance；`H/P1-11` 移至 Phase I 重编号为 `I/P1-11`。
- `Phase J`：保留全部 `6` 项（`J/P0-0..2` + `J/P1-0..2`），无删减。
- `Phase K`：新增 `7` 项（多人格聊天完整链路）。
- `Phase I`：`6` 项（`I/P0-0`、`I/P0-2`、`I/P0-3`、`I/P1-11`、`I/P2-0`、`I/P2-1`）；`I/P1-11` 从 Phase H 移入。
- `Phase G`：已归档，历史完成项保持在 Git 记录中，不回写 active 列表。

## Phase Ha（State Infrastructure & Compat Foundation）

> **目标**：构建状态变更管线、不变量表、兼容机制、Genome MVP — 后续所有状态模块的基础设施。
> **入口条件**：Phase G 归档完成；四层语义路由门禁可用（Phase F）。
> **出口条件**：`proposal → gates → apply` 管线可用；invariant CI green；compat migration 在 legacy persona 上验证通过；genome derived params 在线。
> **版本影响**：完成后触发 minor bump。
> **任务数**：5

### H/P0-0 MindModel H5：State Delta Pipeline
- 原编号：`G/P2-3`
- 状态：`done`，必要性：`Must`
- 来源需求：`02-Phases/H5` `01-Spec/§2.2,§11` `04-Archive/§10`
- 实现方式：统一 `StateDeltaProposal → gates → deterministic apply` 管线，所有状态写入必须经过此路径。LLM 只输出提案（含置信度、证据指针），系统引擎做 clamp / rate-limit / evidence-check / compat-check 后决定 apply 或 reject。
- 测试/DoD：delta 可审计（traceId + evidenceIds）、可回放（同输入→同 delta）、可拒绝（gate reject 有 reason + trace）；超阈值变化必须满足证据门槛。
- 依赖：`前序控制面任务出口条件满足`；回滚：保留旧路径并行。
- 代码锚点：`packages/core/src/state_delta.ts`（新）、`state_delta_apply.ts`（新）、`state_delta_gates.ts`（新）、`execution_protocol.ts`（改）
- 子任务：
  - [ ] `.1` [AB] 定义 `StateDeltaProposal` 类型（type / targetId / patch / confidence / supportingEventHashes / notes）
  - [ ] `.2` [A] 实现 `applyDeltas()` 引擎：clamp + rate-limit + evidence-check + compat-check
  - [ ] `.3` [B] 实现 7 类 gate 框架（identity / relational / recall / mood / belief / epigenetics / budget）→ `01-Spec §11.1`
  - [ ] `.4` [A] 接入 turn pipeline：meta-review 之后、commit 之前 → `01-Spec 附录B §3`
  - [ ] `.5` [B] Gate reject 审计事件写入 life.log + DecisionTrace

### H/P0-1 Invariant Table 回归落地
- 原编号：`G/P2-6`
- 状态：`done`，必要性：`Must`
- 来源需求：`03-Engineering/§3` `01-Spec/§11` `04-Archive/§11`
- 实现方式：为 6 个状态域（Relationship / Beliefs / Mood-Affect / Engagement / Proactive / Group Chat）定义硬不变量（clamp / rate-limit / cooldown / 证据门槛），以 config 驱动、CI 强制。
- 测试/DoD：任何不变量越界直接 CI fail；每条不变量有 domain + actual-vs-threshold 审计。
- 依赖：`H/P0-0`；回滚：阈值可配置回退。
- 代码锚点：`packages/core/src/invariant_table.ts`（新）、CI config
- 子任务：
  - [ ] `.1` [A] 定义 Relationship 不变量：|Δtrust| ≤ 0.03/turn, audit if ≥ 0.10, 证据 ≥ 2 → `03-Engineering §3.1`
  - [ ] `.2` [A] 定义 Beliefs 不变量：cooldown ≥ 7 天, |Δconf| ≤ 0.10, sources 绑定 → `03-Engineering §3.2`
  - [ ] `.3` [A] 定义 Mood/Affect 不变量：baseline 回归速度 [0.02, 0.08]/hr, 外显频率门禁 → `03-Engineering §3.3`
  - [ ] `.4` [B] 定义 Engagement / Proactive / Group Chat 不变量 → `03-Engineering §3.4-§3.6`
  - [ ] `.5` [B] 实现 config-driven invariant engine + CI 集成（违规 = 阻断）

### H/P0-2 MindModel H7：Compatibility & Migration
- 原编号：`G/P2-5`
- 状态：`done`，必要性：`Must`
- 来源需求：`02-Phases/H7` `01-Spec/§13` `03-Engineering/§5` `04-Archive/§16`
- 实现方式：2-tier compatMode（`legacy` / `full`）。Legacy 自动推断 genome（traits=0.5）；迁移走推断→锁定→校准流程；shadow mode 验证后再激活。
- 测试/DoD：存量 persona 漂移在阈值内，无“换人”。
- 依赖：`H/P0-0`；回滚：可回滚迁移前快照。
- 代码锚点：`packages/core/src/genome.ts`（改，部分完成）、`persona.ts`（改，部分完成）、`compat_mode.ts`（新）、`compat_migration.ts`（新）
- 子任务：
  - [x] `.1` [B] 定义 CompatMode 类型 + 自动推断 genome 加载（已完成）
  - [x] `.2` [B] loadPersonaPackage 包含 genome/epigenetics（已完成）
  - [ ] `.3` [B] 实现迁移路径 legacy→full：pre-migration snapshot + rollback entry
  - [ ] `.4` [B] 实现 shadow mode（trace-only，对比后再激活）
  - [ ] `.5` [A] 构建 compat 回归夹具：旧版 persona fixture → doctor PASS
  - [ ] `.6` [B] 迁移幂等检查（连续两次不改写文件）

### H/P0-3 compat 常数清单与校准文件
- 原编号：`G/P2-7`
- 状态：`done`，必要性：`Must`
- 来源需求：`03-Engineering/§5` `01-Spec/§13`
- 实现方式：定义版本化 `compat_calibration.json` 记录旧常数基线（reply_len_avg / emoji_rate / recall_topK_baseline / mood_decay_rate / 认真程度基线），支持从 `life.log.jsonl` 最近 200 turns 推断 → lock → 校准。
- 测试/DoD：迁移样本通过；缺项触发 lint fail；hybrid 输出校准到旧基线（允许轻微误差）。
- 依赖：`H/P0-2`；回滚：回退上一个校准版本。
- 代码锚点：`packages/core/src/compat_constants.ts`（新）、`config/compat_calibration.schema.json`（新）、`persona_lint.ts`（改/新）
- 子任务：
  - [x] `.1` [B] genome 公式校准：trait=0.5 → legacy defaults（已完成，`genome_derived.ts`）
  - [ ] `.2` [B] 定义版本化 `compat_calibration.json` schema → `03-Engineering §5.1`
  - [ ] `.3` [B] 实现从 `life.log.jsonl` 最近 200 turns 推断基线 → `03-Engineering §5.2`
  - [ ] `.4` [A] 实现 calibration lock 机制（推断后锁定，版本化管理）
  - [ ] `.5` [B] 添加 lint 规则：缺项触发 CI fail

### H/P0-4 MindModel H6：Genome & Epigenetics MVP
- 原编号：`G/P2-4`
- 状态：`done`，必要性：`Must`
- 来源需求：`02-Phases/H6` `01-Spec/§5.3,§11.2` `04-Archive/§13`
- 实现方式：固定 6 trait（emotion_sensitivity / emotion_recovery / memory_retention / memory_imprint / attention_span / social_attunement），建立 Genome→Budget 映射（clamped formulas）、seed-based 可复现随机（daily jitter ±0.02）、Epigenetics 慢漂移规则（多证据 + cooldown + bounded + 可回滚）。
- 测试/DoD：差异可解释（两个 persona 不同 trait → 不同 recallTopK，可追溯公式）；随机可复现（同 seed+date → 同 jitter）；epigenetics 无证据更新 = 0。
- 依赖：`H/P0-2` `H/P0-3`；回滚：降级静态 trait（删 genome.json 即回到 0.5 default）。
- 代码锚点：`packages/core/src/genome.ts`（已完成）、`genome_derived.ts`（已完成）、`genome_randomness.ts`（已完成）、`state_delta_gates.ts`（新，epigenetics gate 部分）、`config/genome_presets.json`（新）
- 子任务：
  - [x] `.1` [B] 定义 GenomeConfig / EpigeneticsConfig 类型 + 6 traits（已完成）
  - [x] `.2` [B] 实现 DerivedParams 映射 + clamped formulas（已完成）
  - [x] `.3` [B] 实现 seed-based 可复现 daily jitter（已完成）
  - [x] `.4` [B] 运行时接线：orchestrator / recall_budget / mood / social（已完成）
  - [ ] `.5` [B] 实现 epigenetics gate：evidence ≥ 2, cooldown ≥ 48h, |Δ| ≤ 0.05, bounded → `state_delta_gates.ts`
  - [ ] `.6` [B] 创建 genome presets（balanced / empathetic / analytical / social）→ `config/genome_presets.json`
  - [ ] `.7` [A] 添加 persona lint 规则：genome schema 校验 + trait 范围检查

## Phase Hb（Mind Model State Modules）— done

> **目标**：将 7 块心智模型域（Values / Personality / Goals / Beliefs / Memory / Relationships / Affect）升级为 first-class 状态机，加上人类化不完美 DoD 与兼容检查单。
> **入口条件**：Phase Ha 出口条件满足（State Delta Pipeline + Invariant Table + Compat + Genome 可用）。
> **出口条件**：所有状态模块插入 `proposal → gates → apply` 管线；imperfection 可表达；Persona Package v0.4 布局稳定。
> **版本影响**：完成后触发 minor bump。
> **任务数**：8
> **计划文件**：`doc/plans/Hb-Mind-Model-State-Modules.md`（高层）；`Hb-1-State-Core.md`、`Hb-2-Package-Compat.md`（子计划）；`Hb-1-1-Identity-Beliefs.md`、`Hb-1-2-Memory-Relationships.md`、`Hb-1-3-Affect-Module.md`、`Hb-1-4-Imperfection-DoD.md`、`Hb-2-1-Persona-Package.md`、`Hb-2-2-Compat-Checklist.md`（嵌套子计划）。

### H/P1-0 Values / Personality 可运行约束系统
- 原编号：`G/P2-8`
- 状态：`done`，必要性：`Should`
- 来源需求：`extra/37`
- 实现方式：将 values 条款化接 gate，personality 慢漂移。
- 测试/DoD：越界回复可拦截并给出原因。
- 依赖：`H/P0-0`；回滚：先告警后拦截。

### H/P1-1 Goals / Beliefs 状态模块
- 原编号：`G/P2-9`
- 状态：`done`，必要性：`Should`
- 来源需求：`extra/38` `spec/15`
- 实现方式：新增 goals/beliefs 状态与慢变量更新规则。
- 测试/DoD：跨会话连续性达标。
- 依赖：`H/P0-0`；回滚：只读展示。

### H/P1-2 记忆遗忘与压缩整合管线
- 原编号：`G/P2-10`
- 状态：`done`，必要性：`Should`
- 来源需求：`extra/39` `spec/3`
- 实现方式：衰减+干扰+压缩并行，不修改原始 `life.log`。
- 测试/DoD：容量受控且关键召回达标。
- 依赖：`H/P0-0`；回滚：关闭压缩。

### H/P1-3 Relationship first-class state
- 原编号：`G/P2-11`
- 状态：`done`，必要性：`Should`
- 来源需求：`extra/35`
- 实现方式：关系状态外置，支持冷却/遗忘曲线与事件绑定。
- 测试/DoD：关系变化可追溯、可解释。
- 依赖：`H/P0-0` `H/P1-2`；回滚：回退 memory-only。

### H/P1-4 Persona Package v0.4 布局与回滚
- 原编号：`G/P2-12`
- 状态：`done`，必要性：`Should`
- 来源需求：`spec/22` `extra/45` `extra/52`
- 实现方式：规范包布局、元数据、迁移快照、回滚入口与签名。
- 测试/DoD：跨版本加载稳定，可迁移可回滚。
- 依赖：`F/P0-4` `H/P0-2`；回滚：保留旧布局读取。

### H/P1-5 Affect 情绪层分离与三层状态机
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`spec/15(Affect)` `engineering/3.3` `archive/6.情绪层(Affect)`
- 实现方式：将情绪系统拆分为 `mood baseline（慢）/emotion episodes（快）/temperament influence（特质）` 三层；与响应渲染层解耦，禁止“仅靠语气模板伪装情绪”。
- 测试/DoD：情绪更新有证据链；快慢变量更新速率分离；情绪层可回放可审计。
- 依赖：`H/P0-0` `H/P0-1` `H/P0-4`；回滚：切回旧 mood 单层模式。

### H/P1-6 人类化不完美 DoD 套件
- 原编号：`新增（A12）`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/12.人类化不完美`
- 实现方式：把“非全知、非稳定满分、允许不完美”转换成可测规则，加入输出策略与回归断言。
- 测试/DoD：禁止持续“完美答复”模式，允许合理不确定表达，且不降低安全合规。
- 依赖：`四层语义路由门禁（已完成）` `H/P0-1`；回滚：仅保留监控不做硬门禁。

### H/P1-7 与现有架构兼容说明落地校核
- 原编号：`新增（A17）`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/17.兼容性说明`
- 实现方式：把 High-Level 兼容说明拆成工程检查单（入口、存储、召回、回滚）并纳入 CI 文档校核。
- 测试/DoD：兼容检查单全通过，且每项有证据路径。
- 依赖：`F/P0-3` `H/P0-2`；回滚：退回人工审查流程。

## Phase Hc（Verification, Risk Guards & Schema Contracts）— done

> **目标**：回归验收套件、5 项风险护栏、schema 契约化、接入点核查 — 确保 Ha/Hb 产出经得起治理与回归检验。
> **计划文件**：`doc/plans/Hc-Verification-Governance.md`（高层）；`Hc-1-Regression-Suites.md`、`Hc-2-Risk-Guards.md`、`Hc-3-Schema-Access.md`（子计划）；`Hc-1-1-Relationship-Regression.md`、`Hc-1-2-Emotional-Depth-Regression.md`、`Hc-1-3-Governance-Regression.md`、`Hc-2-1-Output-Guards.md`、`Hc-2-2-State-Guards.md`、`Hc-3-1-Schema-Contracts.md`、`Hc-3-2-Appendix-A-Schemas.md`、`Hc-3-3-Access-Point-Checklist.md`（嵌套子计划）。
> **入口条件**：Phase Ha 出口条件满足（部分任务仅依赖 Ha，可与 Hb 并行）。完整入口需 Phase Hb 对应状态模块完成（H/P1-8 依赖 H/P1-3，H/P1-9 依赖 H/P1-5）。
> **出口条件**：3 项回归套件 green；5 项风险护栏 CI active；schema contracts binding；access-point checklist mapped。
> **版本影响**：完成后触发 minor bump。
> **任务数**：11（H/P1-11 已移至 Phase I）

### H/P1-8 关系连续性验收回归集
- 原编号：`新增（A18.1）`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/18.1`
- 实现方式：建设关系连续性回归场景与评分脚本，验证长期互动不“失忆换人”。
- 测试/DoD：关系连续性指标达标并稳定。
- 依赖：`H/P1-3`；回滚：保留人工抽检。

### H/P1-9 情绪厚度验收回归集
- 原编号：`新增（A18.2）`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/18.2`
- 实现方式：建立情绪厚度回归维度（层次、触发、恢复、可解释性）与评分基线。
- 测试/DoD：情绪厚度指标达标，无单层扁平情绪。
- 依赖：`H/P1-5`；回滚：降级为观测指标。

### H/P1-10 一致性与治理验收回归集
- 原编号：`新增（A18.3）`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/18.3`
- 实现方式：统一治理项（门禁、预算、兼容、回滚）验收套件。
- 测试/DoD：治理项全部可自动检查且无阻塞缺口。
- 依赖：`H/P0-1` `H/P0-2` `H/P0-3`；回滚：拆分为分模块校验。

### ~~H/P1-11~~ → 已移至 Phase I，见 `I/P1-11`

### H/P1-12 风险护栏：过度数值化（A20.1）
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/20.1`
- 实现方式：限制面板化参数外显，要求回复保持自然语言主导。
- 测试/DoD：数值化过载率低于阈值。
- 依赖：`四层语义路由门禁（已完成）`；回滚：以告警替代拦截。

### H/P1-13 风险护栏：Relationship 注入噪音（A20.2）
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/20.2`
- 实现方式：控制关系卡注入频次与权重，加入噪音抑制门禁。
- 测试/DoD：噪音注入率和无关注入率达标。
- 依赖：`H/P1-3`；回滚：放宽阈值。

### H/P1-14 风险护栏：Epigenetics 暗门防护（A20.3）
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/20.3`
- 实现方式：所有 Epigenetics 更新必须带证据与审计记录，禁止静默改人格。
- 测试/DoD：无证据更新为 0。
- 依赖：`H/P0-4`；回滚：仅告警模式。

### H/P1-15 风险护栏：Genome trait 扩张闸门（A20.4）
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/20.4`
- 实现方式：MVP 固守 6 trait，新增 trait 需评审开关与回归证明。
- 测试/DoD：未审批 trait 不可上线。
- 依赖：`H/P0-4`；回滚：临时冻结 trait 扩展。

### H/P1-16 风险护栏：LLM 直写状态封禁（A20.5）
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/20.5` `spec/12`
- 实现方式：仅允许通过 `proposal -> gates -> apply` 写状态，封禁直写通道。
- 测试/DoD：直写尝试全部失败且可审计。
- 依赖：`H/P0-0`；回滚：白名单临时放行。

### H/P1-17 附录示例结构契约化（A52）
- 原编号：`新增`
- 状态：`done`，必要性：`Must`
- 来源需求：`archive/附录示例结构` `spec/28`
- 实现方式：将附录示例结构转换为 schema 契约与版本校验规则。
- 测试/DoD：样例结构全部通过 schema 校验。
- 依赖：`F/P0-4` `H/P1-4`；回滚：允许 legacy schema 兼容读取。

### H/P1-18 Spec 附录A（A1~A4）Schema 契约化
- 原编号：`新增（spec/28）`
- 状态：`done`，必要性：`Must`
- 来源需求：`spec/28`（`engagement_plan.json` `interests.json` `topic_state.json` `proactive_plan.json`）
- 实现方式：为 A1~A4 建立版本化 schema、兼容校验与迁移策略；在 lint/compile 阶段执行结构验证。
- 测试/DoD：四类结构在样例与真实数据上校验通过；版本升级可回滚。
- 依赖：`F/P0-2` `F/P0-4` `H/P1-17`；回滚：保留 legacy schema 读取适配层。

### H/P1-19 Spec 附录B 最小侵入接入点核查
- 原编号：`新增（spec/29）`
- 状态：`done`，必要性：`Must`
- 来源需求：`spec/29` `archive/17`
- 实现方式：把附录B接入点列表转为工程检查单，逐项绑定代码锚点与回归用例，防止“接错层/侵入过深”。
- 测试/DoD：接入点检查单全通过，且每项都有代码证据与回归案例。
- 依赖：`F/P0-3` `四层语义路由门禁（已完成）` `H/P0-0`；回滚：回退到人工架构评审。

## Phase I（第三优先级：产品化与后置演进）

### I/P0-0 开源合规：LICENSE + SPDX 一致性
- 原编号：`G/P0-1`
- 状态：`todo`，必要性：`Must`
- 来源需求：`external roadmap`
- 实现方式：所有包与文档的 license 元数据统一到仓库当前 LICENSE（CC BY-NC-ND 4.0）并补 SPDX。
- 测试/DoD：license 扫描零不一致。
- 依赖：`Phase F` 主任务完成；回滚：元数据回退。

### I/P0-2 性能与可观测：慢点定位
- 原编号：`G/P2-2`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/24` `extra/48`
- 实现方式：引入 perf span、trace id 与 `--perf` 输出。
- 测试/DoD：关键链路 p95 可观测。
- 依赖：`I/P0-0`；回滚：埋点按环境开关。

### I/P0-3 OK 定义产品化门禁
- 原编号：`新增（A21）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/21.OK定义` `spec/27`
- 实现方式：把 OK 定义转为可执行发布门禁（关系连续性、情绪厚度、治理稳定、可观测性）。
- 测试/DoD：未满足 OK 门禁禁止发布。
- 依赖：`H/P1-8` `H/P1-9` `H/P1-10` `I/P1-11`；回滚：降级为发布告警。

### I/P1-11 可观测性验收回归集（原 H/P1-11，从 Phase H 移入）
- 原编号：`新增（A18.4）`，原 Phase H 任务 `H/P1-11`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.4`
- 实现方式：定义状态变化、门禁决策、异常路径的最小观测事件集。
- 测试/DoD：关键链路可追踪，故障可定位。
- 依赖：`I/P0-2`；回滚：保留核心事件集。
- 移入原因：依赖 `I/P0-2`（性能与可观测）属 Phase I 范畴，Roadmap 规则 1.1 要求 Phase 内全部任务完成才可 minor bump，故移出 Phase H。

### I/P2-0 MindModel H8：Inheritance（可选后置）
- 原编号：`G/P3-0`
- 状态：`todo`，必要性：`Could`
- 来源需求：`phases/H8` `extra/44`
- 实现方式：定义继承与微突变规则，补伦理与安全约束。
- 测试/DoD：继承结果可解释，不突破安全边界。
- 依赖：`Phase H` 全部 Must 任务完成；回滚：字段保留不启用。

### I/P2-1 Provider Adapter 架构深化（Registry + Capability Matrix + Telemetry）
- 原编号：`新增`
- 状态：`todo`，必要性：`Could`
- 来源需求：`engineering/provider_adapter_review(2026-02-24)` `spec/24(可观测)` `archive/17(兼容性说明)`
- 实现方式：在现有 `openai-compatible + anthropic-native` 基础上，引入 `ProviderRegistry` 与能力矩阵（流式、token 语义、工具调用、重试/降级策略）；统一 adapter 观测事件（provider/model/attempt/error_class/latency）并接入 `--perf` 与 trace 输出。
- 测试/DoD：跨 provider 行为契约一致；fallback 行为可预测；故障定位不依赖人工复盘日志。
- 依赖：`I/P0-2` `H/P0-2`；回滚：保留当前双 adapter 直连实现并关闭 Registry 路径。

## Phase J（第二优先级：会话体验闭环与非轮询交互）

### J/P0-0 Interest-Attention 状态闭环（topic_state + unresolved threads）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`AGENT.md 1.2` `spec/28(A3)` `doc/Product-Standards.md 3.1/3.2/3.6`
- 实现方式：将兴趣/注意力从“仅分值”升级为“线程化状态”，落盘 `topic_state.json`（activeTopic、threadStack、unresolvedThreads、lastShiftReason），并接入 `proposal -> gates -> deterministic apply`。
- 测试/DoD：可追踪线程切换原因；跨会话可恢复未闭环线程；业务主路径不走 regex。
- 依赖：`H/P0-0` `H/P0-1`；回滚：退回当前 score-only 路径。

### J/P0-1 Proactive Planner 契约化（先规划后生成）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`AGENT.md 1.2` `doc/Product-Standards.md 3.4` `spec/28(A4)`
- 实现方式：新增 `proactive_plan.json` 与 planner 产物契约：`intent + topic/entity + goal + justification + deferReason`；生成回复前必须先过 planner gate。
- 测试/DoD：所有主动消息都能回放到 plan；无 plan 的主动输出为 0。
- 依赖：`J/P0-0` `H/P0-1`；回滚：仅允许低频 fallback 模式并强审计。

### J/P0-2 非轮询会话循环（Human-like Turn Flow）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`AGENT.md 1.2(Interaction Modes)` `README 产品愿景（持续陪伴而非客服轮询）`
- 实现方式：在 CLI 主循环增加“连续会话层”：自然停顿窗口、用户未说完保护、轻量 backchannel、插话节流、主动消息与用户输入冲突仲裁。
- 测试/DoD：不再只表现为固定一问一答；无抢答/无连续打断；可配置降级到 legacy 轮询模式。
- 依赖：`J/P0-1`；回滚：feature flag 关闭连续会话层。

### J/P1-0 Engagement Plan 落盘与预算门禁
- 原编号：`新增`
- 状态：`todo`，必要性：`Should`
- 来源需求：`spec/28(A1)` `doc/Product-Standards.md 3.1/4`
- 实现方式：新增 `engagement_plan.json`（tier、budget、depth ceiling、interrupt policy），每轮执行前先决策并绑定 token/latency 预算。
- 测试/DoD：`IGNORE/REACT/LIGHT/NORMAL/DEEP` 行为与预算一致；超时按降级合同执行。
- 依赖：`J/P0-0`；回滚：保留静态预算。

### J/P1-1 多话题上下文调度器（Context Scheduler）
- 原编号：`新增`
- 状态：`todo`，必要性：`Should`
- 来源需求：`AGENT.md 1.2` `doc/Quality-Evaluation.md L3`
- 实现方式：实现话题优先队列与上下文窗口调度，支持“主线程 + 支线程”并行保留，减少上下文突然跳题。
- 测试/DoD：多轮对话 topic drift 下降；未闭环话题召回成功率提升。
- 依赖：`J/P0-0` `J/P1-0`；回滚：单线程上下文策略。

### J/P1-2 会话体验评测赛道（Continuity + Interaction）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`doc/Quality-Evaluation.md L3/L5` `AGENT.md Doc Sync Gate`
- 实现方式：新增“交互形态”指标与回归集：`TurnNaturalnessRate`、`InterruptCollisionRate`、`UnfinishedThoughtRespectRate`、`ProactiveRelevancePassRate`。
- 测试/DoD：PR/Nightly 可自动出分；低于阈值阻断发布。
- 依赖：`J/P0-2`；回滚：降级为观测告警。

## Phase K（第三优先级：多人格聊天系统）

### K/P0-0 Multi-Persona Session Graph（会话图谱与注册表）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`AGENT.md 1.2(Group Chat)` `doc/Product-Standards.md 3.4`
- 实现方式：建立多人格会话图谱（persona registry、speaker metadata、turn ownership、session scope），并接入统一决策 trace。
- 测试/DoD：会话可稳定加载多个 persona；每轮发言归属可追溯。
- 依赖：`J/P0-0` `H/P0-0`；回滚：退回单 persona 会话模式。

### K/P0-1 多人格发言仲裁器（Addressing-First）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`AGENT.md 1.2(Group Chat)` `doc/Product-Standards.md 3.4/3.6`
- 实现方式：实现 deterministic arbitration：addressing > safety > task relevance > interest，避免多人格抢答。
- 测试/DoD：点名命中率达标；非点名场景无多 persona 同时抢答。
- 依赖：`K/P0-0` `H/P0-1`；回滚：启用单 persona 主讲兜底模式。

### K/P0-2 多人格回合调度与插话节流
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`README 愿景（自然陪伴）` `doc/Quality-Evaluation.md L3`
- 实现方式：新增 turn scheduler、per-persona cooldown、冲突窗口和延迟重试机制，避免“连环插话”。
- 测试/DoD：插话冲突率低于阈值；连续两轮以上抢答为 0。
- 依赖：`K/P0-1` `J/P0-2`；回滚：固定轮询主讲策略。

### K/P1-0 Shared Context Bus 与私有记忆隔离
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`AGENT.md Core-first + Memory Boundary` `doc/Product-Standards.md 2/5`
- 实现方式：定义共享上下文总线（会话公共事实）与 persona 私有记忆边界（private life log / private memory tier）。
- 测试/DoD：persona 间无未授权记忆泄漏；共享事实同步可审计。
- 依赖：`K/P0-0` `H/P0-2`；回滚：仅共享显式用户输入文本。

### K/P1-1 多人格主动协同规划器
- 原编号：`新增`
- 状态：`todo`，必要性：`Should`
- 来源需求：`J/P0-1 proactive planner` `AGENT.md Interaction Modes`
- 实现方式：扩展 proactive planner 到多人格：每个 tick 只允许单 persona 获得主动资格，其他 persona 进入 defer queue。
- 测试/DoD：多 persona 主动冲突率接近 0；主动消息相关度达标。
- 依赖：`K/P0-1` `K/P0-2` `J/P0-1`；回滚：关闭多人格主动，仅保留被动响应。

### K/P1-2 CLI 多人格交互命令与视图
- 原编号：`新增`
- 状态：`todo`，必要性：`Should`
- 来源需求：`doc/CLI.md` `README Quickstart（可用性）`
- 实现方式：新增多人格会话命令（创建会话、加入/移除 persona、指定主讲、查看仲裁状态），并提供 transcript 视图。
- 测试/DoD：命令可用、文档同步、回归通过。
- 依赖：`K/P0-0` `K/P0-1`；回滚：隐藏命令并保留实验开关。

### K/P1-3 多人格评测赛道与发布门禁
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`doc/Quality-Evaluation.md L3/L5` `I/P0-3`
- 实现方式：新增指标：`AddressingHitRate`、`MultiPersonaCollisionRate`、`PersonaLeakageRate`、`TurnFairnessIndex`，接入 PR/Nightly。
- 测试/DoD：低于阈值阻断发布；报告可回放定位。
- 依赖：`K/P0-2` `K/P1-0`；回滚：降级为 nightly 观测。

## 统一执行顺序（工程落地顺序）
1. `Phase Ha`：`H/P0-0 -> H/P0-1 -> H/P0-2 -> H/P0-3 -> H/P0-4`
2. `Phase Hb`：`H/P1-0 -> H/P1-1 -> H/P1-2 -> H/P1-3 -> H/P1-4 -> H/P1-5 -> H/P1-6 -> H/P1-7`
3. `Phase Hc`：`(H/P1-8 || H/P1-12) -> (H/P1-9 || H/P1-13) -> H/P1-10 -> (H/P1-14 || H/P1-15 || H/P1-16) -> H/P1-17 -> H/P1-18 -> H/P1-19`
4. `Phase J`：`J/P0-0 -> J/P0-1 -> J/P0-2 -> J/P1-0 -> J/P1-1 -> J/P1-2`
5. `Phase K`：`K/P0-0 -> K/P0-1 -> K/P0-2 -> K/P1-0 -> K/P1-1 -> K/P1-2 -> K/P1-3`
6. `Phase I`：`I/P0-0 -> I/P0-2 -> I/P1-11 -> I/P0-3 -> I/P2-0 -> I/P2-1`

## 覆盖性与漏项结论
- `2.24.03` 的 `00/01/02/03/04` 已完成覆盖核对并映射到任务；`A-APP-CHANGELOG` 以 `historical` 审计保留。
- 本次重排后保全结论：`Ha(5) + Hb(8) + Hc(11) + J(6) + K(7) + I(6) = 43` 全量保留/新增映射完成，`missing=0`、`partial=0`（active 范围）。H/P1-11 移至 Phase I 重编号为 I/P1-11。
