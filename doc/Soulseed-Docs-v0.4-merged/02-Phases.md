# Soulseed Phases H0–H8 — MERGED
> 合并日期：2026-02-24  
> 说明：本文件由多份拆分文档合并而成；为保证信息不丢失，保留每个源文件的完整内容，并在每段前标注原始路径。

---


## 旧 Phase 口径对照（仅用于历史阅读）

> **唯一官方 Phase 命名：H0–H8**。  
> 以下对照用于把旧文档/旧注释里的 Phase D/E/F 翻译到新路线图（**范围重叠，不是一一对应**）。

| 旧口径 | 新口径（唯一官方） | 说明 |
|---|---|---|
| Phase D | H0 + H5（为主） | State Layer 纳入主链路、proposal→gates→apply、基础稳健性 |
| Phase E | H0 + H5 +（部分 H6/H7） | 质量门禁/预算/漂移治理加强；为 genome/compat 打地基 |
| Phase F | H1–H4 + H6–H8 | 会话控制面/兴趣驱动/主动系统/群聊仲裁/基因与繁衍（高级能力） |

---



---

## SOURCE: `phases/00-Phase-Overview.md`

# Phase 推进总览（MindModel / StateLayer / Genome / Conversation Control）
> 版本：v0.1（2026-02-24）  
> 目标：把 v0.3.1 + v0.4 拆成“每一阶段都能闭环验收”的推进路径，并且**不破坏存量人格**。

---

## Phase H0（前置治理与稳健性硬化）— *强依赖现有 Roadmap*
**目的**：让后续大量 persona 写入与 schema 扩张不会把系统写崩、也不会让人格资产不可治理。  
**依赖**：P0-13（persona 写锁接入写路径）必须 done；强烈建议并行起 P1-1（persona lint）。

---

## Phase H1（Conversation Control MVP）
**目的**：立刻把体验从“每条都认真回”升级到“像人一样选择投入”，同时保证关键任务不被忽略。  
**范围**：Engagement tiers（LIGHT/NORMAL/DEEP）+ 情绪外显策略化（频率门禁）+ People Registry / Relationship Card 注入。

---

## Phase H2（Interests → Attention → Engagement）
**目的**：把兴趣变成可培养可演进的系统，但必须确定性更新（reward/decay）+ gates，避免乱学。  
**范围**：interests.json + topic_state.json + attention budget 派生。

---

## Phase H3（Proactive 主动系统）
**目的**：从“随机打扰”升级为“有动机、有主题、有克制”。  
**范围**：proactive_plan + trigger engine + budgets + cooldown。

---

## Phase H4（AI 群聊参与控制）
**目的**：避免机器人抢答；多 persona 公平仲裁；冷却与发言上限。  
**范围**：participation scoring + deterministic arbitration + cooldown window。

---

## Phase H5（State Delta Pipeline 全链路）
**目的**：把 State Layer 变成 first-class：每轮输出 delta proposal，经过 gate 后再确定性落地，并全量审计。  
**范围**：state_delta_proposals / audit events / deterministic apply。

---

## Phase H6（Genome & Epigenetics MVP）
**目的**：用少量 trait 解释差异、派生 budgets，并把“学习”限定为表观层（epigenetics）。  
**范围**：genome.json + epigenetics.json（MVP）；trait→budget 映射；学习率/冷却/证据门槛。

---

## Phase H7（Compatibility & Migration）
**目的**：兑现“存量人格不换人”：legacy/hybrid/full 三档 + 校准旧常数 + 可回滚。  
**范围**：compat_calibration.json + migration plan + parity regression。

---

## Phase H8（Inheritance / 繁衍，可选后置）
**目的**：支持人格派生、继承与微突变，但必须不破坏前面所有可控性。  
**范围**：inheritance policy + seed reproducibility + audit.

---

> 详细 DoD、数据结构、接入点：见 `docs/phases/Hx-*.md` 与 `docs/engineering/工程加固补充（严苛评审落地条款）.md`


---

## SOURCE: `phases/01-Roadmap-Alignment.md`

# 与仓库 Roadmap 的对齐（审计版）
> 来源：`doc/Roadmap.md`（更新日期：2026-02-23，仓库已审计）  
> 目的：在不打乱现有 Phase G 的情况下，把“MindModel/StateLayer/Genome/Conversation Control”拆成可推进的 Phase，并明确依赖关系与 DoD。

## 1) 现有 Roadmap 的关键状态（与你这套方案强相关）
- 已完成：P0-11 / P0-12 / P0-14 / P0-15 / P0-16  
- 进行中：P0-13（SQLite 并发 + persona 写锁接入写路径）  
- 待开始：P1-0（Driver 抽象） / P1-1（persona lint）等

**结论：MindModel 相关改造会增加 persona package 写入与 schema 复杂度，因此必须把 P0-13 当作硬前置。**

## 2) 我建议把本套方案作为“Phase H：MindModel & Conversation Control”挂到 Roadmap（不替代 Phase G）
- Phase G 继续按原路线推进（开源稳健性/可运行性）
- Phase H 以“最小闭环 → 可控扩展”为原则推进（对应 v0.4 的 Rollout 哲学）

## 3) Phase H 的任务编号建议（不与现有 P0/P1 冲突）
- H0：前置硬化与治理（persona 写锁 / lint / schema）
- H1：Conversation Control MVP（投入档位 + 情绪外显策略化 + 关系卡保底）
- H2：Interests → Attention → Engagement（确定性 reward/decay + gate）
- H3：Proactive（主动打扰）系统（有动机/有主题/有克制）
- H4：Group Chat Arbitration（确定性仲裁 + cooldown）
- H5：State Delta Pipeline（proposal → gates → deterministic apply）全链路
- H6：Genome & Epigenetics（MVP trait + 派生 budgets + 表观学习门禁）
- H7：Compatibility & Migration（legacy/hybrid/full + 校准 + 回滚）
- H8：Inheritance（可选，后置）

> 这些任务的 spec 已在 `docs/phases/` 中拆开，每个 Phase 都有 DoD 与触及的接入点清单。


---

## SOURCE: `phases/H0-前置治理与稳健性硬化（必须先做）.md`

# Phase H0：前置治理与稳健性硬化（必须先做）
## 目标
让后续引入 StateLayer / Conversation Control 时，persona package 的写入与 schema 扩张不会导致：
- SQLite 并发写崩（BUSY/锁争用）
- persona 资产无法治理（字段乱长、版本不可迁移）
- 回归与审计缺位（debug 地狱）

## 依赖（与现有 Roadmap 对齐）
- **硬依赖**：P0-13 `withPersonaLock()` 接入所有写路径（Roadmap: in_progress）
- **强烈建议**：P1-1 `ss persona lint`（Roadmap: todo）
- **建议**：P1-0 MemoryStoreDriver scaffold（Roadmap: todo）

## DoD（验收）
- 并发写回归集：连续 500 turns 写入无 SQLITE_BUSY（或低于阈值且可退避恢复）
- persona lint：能检测 schemaVersion、必填字段、长度预算、未知字段、文件缺失
- schema 版本策略：新增文件必须有 schemaVersion + migration notes

## 输出文档/产物
- `docs/engineering/工程加固补充（严苛评审落地条款）.md` 中的 Invariant Table 进入“可执行约束”
- `docs/spec/22-*`（Persona Package）里补充 JSON Schema 清单与版本策略


---

## SOURCE: `phases/H1-Conversation_Control_MVP（最小闭环）.md`

# Phase H1：Conversation Control MVP（最小闭环）
## 目标（立刻提升体验）
- 不再“每条都认真回”
- 但对关键任务与明确指令不敷衍
- 情绪外显变成策略输出（可控、克制）
- 关系连续性立竿见影（卡片注入保底）

## 范围（只做最小闭环）
1) Engagement tiers：LIGHT / NORMAL / DEEP（三档）
2) Emotion exposure policy：emoji/颜文字/语气 = policy 输出（带频率门禁）
3) People Registry + Relationship Card 注入（系统级保底）

## 接入点（最小侵入）
- CLI 主循环最前：插 Engagement Controller（决定是否走完整 executeTurnProtocol）
- Context compile：按 engagement_plan 派发 budgets（recall topK / cards / summaries）
- 输出：写入 `engagement_plan.json`（每轮）+ 审计事件

## DoD（回归可测）
- taskness=true 的输入：不得被 LIGHT 处理
- 连续 N 次 LIGHT：必须强制一次 NORMAL（避免体验断裂）
- Emoji Exposure Rate：每 20 轮不超过 persona policy 的上限
- Relationship Card：只在本轮 entity/topic 命中时注入（避免噪音）

## 文件/结构（建议）
- `engagement_plan.json`（v0.4 附录 A1）
- `topic_state.json`（v0.4 附录 A3）
- `conversation_policy.json`（可选：把情绪外显策略独立出来）


---

## SOURCE: `phases/H2-Interests→Attention→Engagement（可培养但必须可控）.md`

# Phase H2：Interests → Attention → Engagement（可培养，但必须可控）
## 目标
- 兴趣可演进（不是写死的 profile）
- 但不会“一句话就变爱好”
- 兴趣影响注意力与投入（budget-first）

## 范围
- `interests.json`（长期兴趣，带强约束）
- reward/decay 的确定性规则（先规则后 LLM）
- gate：LLM 只能提案，最终由规则引擎 apply/reject

## DoD
- 学习门槛：同主题出现 ≥ 3 次才进入稳定兴趣
- 单次更新步长 clamp：|Δinterest| ≤ 0.05（示例）
- Delta Gate Reject Rate 在合理区间（避免“门禁无效”或“模型乱提案”）

## 与 v0.4 的关系
- 对应 v0.4 第 7 章 + 附录 A2
- 细化为“工程可执行规则”（见工程加固补充）


---

## SOURCE: `phases/H3-Proactive_主动系统（有动机有主题有克制）.md`

# Phase H3：Proactive 主动系统（有动机、有主题、有克制）
## 目标
让主动打扰变成“像人”的功能，而不是噪音源。

## 范围
- proactive intent 分类（v0.4 9.2）
- `proactive_plan.json`（v0.4 附录 A4）
- budgets + cooldown + 去重（同主题/同意图短期不重复）

## DoD
- 频率上限：24h 内 ≤ 1 次（可按关系 tier 调整）
- 每次主动必须有：intent + topic/entity/goal + justification
- 被用户拒绝后：进入 cooldown（显著降低再次触发概率）

## 接入点
- trigger engine 之后插 Proactive Planner（v0.4 附录 B4）


---

## SOURCE: `phases/H4-AI_群聊参与控制（不抢答不刷屏）.md`

# Phase H4：AI 群聊参与控制（不抢答、不刷屏）
## 目标
- 多 persona 不互相抢答
- addressing 优先级碾压兴趣优先级
- 冷却窗口与发言上限明确

## 范围
- participation scoring（每 persona）
- deterministic arbitration（可复现）
- cooldown window / max speak rate

## DoD
- addressing=true 的 persona 必须赢（除非明确被禁言/冷却）
- 5 分钟窗口 ≤ 1 条（建议值，可配置）
- tie-breaker 可复现（seed/priority）

## 接入点
- 消息分发层插 arbitration（v0.4 附录 B5）
- 非发言 persona 只做 internal update


---

## SOURCE: `phases/H5-State_Delta_Pipeline（proposal→gates→apply）.md`

# Phase H5：State Delta Pipeline（proposal → gates → deterministic apply）
## 目标
把 State Layer 真正变成 first-class：可审计、可回滚、可回归。

## 范围
- `state_delta_proposals` 统一格式
- gates（identity/relational/recall/factual/constitution + state invariants）
- deterministic apply（唯一写入通道）
- 审计事件：关键变化必须写入 life.log（或专用 audit log）

## DoD
- 任何状态变化都有 traceId + evidenceIds
- 超阈值变化必须满足证据门槛（否则 reject）
- 回归集能复现：同输入 → 同 delta（除非显式 random seed）

## 参考
- v0.3.1 第 10/11 章（Turn Pipeline / Gates & Budgets）
- v0.4 第 11 章（Gates & Budgets）


---

## SOURCE: `phases/H6-Genome&Epigenetics_MVP（差异可解释学习可控）.md`

# Phase H6：Genome & Epigenetics MVP（差异可解释、学习可控）
## 目标
- Genome 解释“天赋差异/敏感度/记忆强弱/反应速度”等稳定偏置
- Epigenetics 负责“表观学习”，但必须门禁、防暗门

## 范围
- Genome MVP：6 个 trait（v0.4 5.3 / v0.3.1 13.2）
- trait → budgets 派生映射（clamp）
- epigenetics：学习率/冷却/证据门槛/可回滚

## DoD
- trait 数量不扩张（MVP 固定 6）
- trait 变化（若允许）必须极慢、强证据、可审计
- epigenetics 不得直接改 constitution/identity（硬边界）

## 后置
- inheritance/mutation 不在本 Phase 做（放 H8）


---

## SOURCE: `phases/H7-Compatibility&Migration（存量人格不换人）.md`

# Phase H7：Compatibility & Migration（存量人格不换人）
## 目标
兑现 compatMode 的承诺：legacy/hybrid/full 三档，让老 persona 行为稳定。

## 范围
- compatMode（三档）策略落地
- compat_calibration（旧常数清单 + 推断方法）
- migration plan + rollback

## DoD
- legacy：输出风格与旧版一致（行为 parity 回归集通过）
- hybrid：新系统跑起来，但输出校准到旧基线（允许小误差）
- full：启用新系统全部能力
- 可回滚：任何时候能回退到 legacy（不丢资产）

## 特别强调
- “会话控制面”的兼容策略（v0.4 13.3）必须写死覆盖规则


---

## SOURCE: `phases/H8-Inheritance_繁衍（可选后置）.md`

# Phase H8：Inheritance / 繁衍（可选后置）
## 目标
支持 persona 派生（继承 + 微突变），但不破坏可控性与回归可测性。

## 范围
- seed 可复现（同 seed 生成同 genome）
- inheritance policy（哪些 trait 可继承、哪些可微突变、范围多大）
- audit：派生关系链可追溯

## DoD
- 任何派生都能回放/复现
- 微突变范围严格 clamp
- 不允许绕过 compatMode 或 gates
