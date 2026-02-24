# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

---

## 目录
- [0. 背景与问题陈述](#0-背景与问题陈述)
- [1. 目标与非目标](#1-目标与非目标)
- [2. 设计原则（成败开关）](#2-设计原则成败开关)
- [3. 体系总览：7块心智模型 ×（Genome / Epigenetics / State）](#3-体系总览7块心智模型--genome--epigenetics--state)
- [4. 分层与裁切：Stage1/2/3 + Raw History](#4-分层与裁切stage123--raw-history)
- [5. 关系层（Relationships）：外置 first-class state（Hybrid）](#5-关系层relationships外置-first-class-statehybrid)
- [6. 情绪层（Affect）：三层情绪系统 + 更新规则](#6-情绪层affect三层情绪系统--更新规则)
- [7. Values / Personality：从文本升级为“可运行的约束系统”](#7-values--personality从文本升级为可运行的约束系统)
- [8. Goals / Beliefs：补齐方向感与看法稳定性](#8-goals--beliefs补齐方向感与看法稳定性)
- [9. 记忆层遗忘：可控衰减 + 干扰 + 压缩整合（不破坏 life.log）](#9-记忆层遗忘可控衰减--干扰--压缩整合不破坏-lifelog)
- [10. Turn Pipeline：将 State Layer 纳入 first-class（最小侵入式改造）](#10-turn-pipeline将-state-layer-纳入-first-class最小侵入式改造)
- [11. 门禁（Gates）与预算（Budgets）](#11-门禁gates与预算budgets)
- [12. 人类化不完美（必须写进 DoD）](#12-人类化不完美必须写进-dod)
- [13. Genome / 天赋系统（个体差异、可继承、可复现随机）](#13-genome--天赋系统个体差异可继承可复现随机)
- [14. 遗传与繁衍：Genome 的继承与微突变](#14-遗传与繁衍genome-的继承与微突变)
- [15. 存储与文件布局建议（Persona Package）](#15-存储与文件布局建议persona-package)
- [16. 兼容性与迁移（存量人格不能错乱/换人）](#16-兼容性与迁移存量人格不能错乱换人)
- [17. 与现有 Soulseed 架构的兼容性说明（High-Level）](#17-与现有-soulseed-架构的兼容性说明high-level)
- [18. 评估与验收（DoD + 回归集）](#18-评估与验收dod--回归集)
- [19. 推荐 Rollout 顺序](#19-推荐-rollout-顺序)
- [20. 风险清单与对策（必须前置考虑）](#20-风险清单与对策必须前置考虑)
- [21. 结语：OK 的定义](#21-结语ok-的定义)
- [附录：示例结构](#附录示例结构)
- [附录：变更记录（v0.1/v0.2 → v0.3.1）](#附录变更记录v01v02--v031)

---

## 0. 背景与问题陈述

目前 Soulseed 的“厚度”主要来自 **记忆层（life.log + memory.db + recall）**。这非常强，但会出现典型体验断裂：

- **关系薄**：人物/关系主要靠小 JSON 或记忆检索“碰运气” → 提到某个名字不一定能立刻稳定想起来。
- **情绪薄**：情绪更像一个 latent embedding → 不可解释、不可控、缺少多时间尺度（短时情绪/中期心境/长期气质）。
- **三观/人格薄**：更多停留在文本描述，缺少“可运行的约束/规则系统”，容易漂移或过度迎合。
- **人类化不完美缺失**：人会遗忘，会情绪无名，会不确定归因；系统若全靠解释反而“不像人”。

核心结论：**记忆强 ≠ 像人。像人依赖“慢变量状态机 + 可追溯历史 + 人类化的不完美”。**

---

## 1. 目标与非目标

### 1.1 总目标（像人，而不是像神）
将 Soulseed 升级为具备“持续内在状态”的个体，使其在长期交互中表现为：

1) **连续性**：不依赖检索命中也能稳定保持关系/情绪/价值倾向与长期方向感。  
2) **个体差异**：不同 persona 在敏感度/记忆保持/注意跨度/社交捕获等方面天然不同（Genome）。  
3) **可控性**：状态更新有明确规则、衰减、阈值与门禁（Gates）。  
4) **可审计**：任何关键状态变化都能追溯到证据（life.log event hash / memory ids）。  
5) **兼容性**：存量 persona 默认行为保持一致（Behavior Parity by Default），渐进启用新层。  

### 1.2 非目标（避免走偏）
- ❌ 不追求“全知全能/永不忘记”——**忘记是特性**。  
- ❌ 不把所有参数都变成基因——只抽象少量高层 trait，其他由派生参数决定。  
- ❌ 不让 LLM 直接写最终状态数值——LLM 只产出 **提案（proposals）**，最终落地由确定性引擎执行。  
- ❌ 不用“更厚 prompt”替代系统——厚度来自 **state+evidence+gates**。

---

## 2. 设计原则（成败开关）

> 这部分是“能不能真的提升整体产品”的关键。如果这里松动，系统会变成“更复杂的漂移制造机”。

### 2.1 分层而非替代：Stage1/2/3 叠加
- **Stage1（规则/正则）= Detector + Trigger**：抽取线索、触发护栏；不承担长期心理主体。  
- **Stage2（显式可解释维度）= Control Plane**：Mood/Relationship/Values/Goals/Beliefs 等慢变量必须可控、可测、可回归。  
- **Stage3（隐向量/联想底座）= Associative Substrate**：用于相似性/迁移/纹理；**不可单独决定人格核心结论**。  
- **Raw History（life.log / memory.db）= 可回放证据**：关键变化必须能指回证据。

### 2.2 LLM 只产出“提案”，最终状态必须由确定性引擎落地
- LLM 输出：`state_delta_proposals`（含置信度、证据指针、说明）  
- 系统落地：`applyDeltas()` 做 **clamp / rate-limit / evidence-check / compat-check**  
- Gate 失败：拒绝 commit（仍记录提案与拒绝原因，便于调试与回归）

### 2.3 预算优先（Budget-first）
- 上下文注入（cards / memories / summaries）必须有硬预算：token、条数、优先级。  
- Genome/Derived params 可以影响预算，但必须 **clamp** 到安全范围，避免 prompt 爆炸。

### 2.4 可审计优先（Audit-first）
- 关键状态变化必须能指回：life.log event hash / memory ids  
- 任何 gate 拒绝必须记录原因  
- 允许“不确定/想不起来”，但禁止“无证据回忆式断言”

### 2.5 兼容优先（Compatibility-first）
- 默认 `legacy` 或 `hybrid`，在回归集上证明行为一致后再 `full`  
- 存量 persona 的 genome 默认 **inferred + locked**，并做派生参数校准以复现旧常数

---

## 3. 体系总览：7块心智模型 ×（Genome / Epigenetics / State）

### 3.1 7块心智模型（功能域：what）
1) **Memory / History**：life.log（append-only）+ memory.db（召回、衰减、整合、trace）  
2) **Values / Constitution**：可判定规则条款（触发条件 + 优先级 + 处理策略）  
3) **Personality / Temperament**：Trait 基线（慢漂移）  
4) **Affect**：Mood baseline + Emotion episodes + Temperament  
5) **Relationships / Social Graph**：People registry + relationship states + 证据绑定  
6) **Goals / Commitments / Drives**：方向感、承诺与动机偏好  
7) **Beliefs / World Model**：对人/事/世界的看法（confidence + evidence）

### 3.2 三层变化机制（how）：Genome ≠ Epigenetics ≠ State
- **Genome（基因/天赋）**：先天基线与敏感度（几乎不变，可继承/微突变）  
- **Epigenetics（表观学习）**：长期、微小、有证据的适应（慢，bounded，可回滚）  
- **State（状态）**：即时波动（快，受 gates 约束）

---

## 4. 分层与裁切：Stage1/2/3 + Raw History

目标不是“把信息裁切到零”，而是把裁切做成 **可控、可追溯、服务决策的压缩**。

- Stage1：抽 cue（情绪强度、社交线索、风险词等）  
- Stage2：维护可解释状态（关系/情绪/目标/信念等）  
- Stage3：提供联想纹理（可选）  
- Raw History：可回放证据（life.log/memory.db）

---

## 5. 关系层（Relationships）：外置 first-class state（Hybrid）

### 5.1 结论：关系在记忆外部，但与记忆强绑定
- 只靠检索：命中失败就“失忆”  
- 只靠数值：不可解释、不可审计、易漂移  
- **Hybrid**：外置关系 state（连续性保底）+ 证据绑定（可审计）

### 5.2 关键结构

#### A) People Registry（人物实体索引）
- 稳定 `entityId`，支持 `canonicalName + aliases`  
- 目的：名字/别名 → entityId 命中不靠运气

```json
{
  "entities": [
    {
      "entityId": "ent_...stable",
      "canonicalName": "李植",
      "aliases": ["植", "LZ", "li zhi"],
      "tags": ["coworker"],
      "firstMetAt": "2026-02-20",
      "lastSeenAt": "2026-02-23",
      "oneLineWho": "你认识的同事/朋友（简述）"
    }
  ]
}
```

#### B) Relationship State（每个 entity 一份慢变量）
建议字段：
- closeness / trust / affinity  
- tension / safety  
- obligations / unresolved  
- lastInteractionSummary  
- supportingEventHashes / supportingMemoryIds

```json
{
  "relationships": {
    "ent_...": {
      "closeness": 0.55,
      "trust": 0.70,
      "affinity": 0.60,
      "tension": 0.15,
      "safety": 0.75,
      "obligations": ["答应了帮他看某事"],
      "unresolved": ["上次争论未完全解决"],
      "lastInteractionSummary": "昨晚聊了很久，主题是…",
      "supportingEventHashes": ["evhash_..."],
      "updatedAt": "2026-02-24T10:12:00Z"
    }
  }
}
```

#### C) Relationship Card 注入（系统级保底机制）
触发：输入提及名字/别名 → entity linking 命中 entityId  
注入内容（短卡，3~6 行）：
- 谁：这个人是谁  
- 最近一次互动摘要  
- 当前关系关键维度  
- 未解决事项/承诺（若有）

> **卡片必须有预算**：每轮最多 1~2 张（由 attention_span 派生）

### 5.3 关系如何“像人一样会冷却/会忘”
- registry 永存（人不会从世界上消失）  
- 关系慢变量可随时间轻微回归基线  
- 细节由记忆层衰减（想不起细节正常）  
- 需要时可 deep recall 回溯证据

---

## 6. 情绪层（Affect）：三层情绪系统 + 更新规则

### 6.1 痛点：情绪=一个 embedding 会薄
- 不可解释、不可控、无法绑定触发源  
- 缺少多时间尺度  
- 难做衰减与门禁

### 6.2 三层情绪系统（多时间尺度）
1) **Mood baseline（小时/天级）**：显式四维 `valence / arousal / energy / stress`  
2) **Emotion Episodes（分钟级）**：短时片段（trigger + label + intensity + evidence）  
3) **Temperament（周/月级）**：易感性（极慢变）

#### A) Mood baseline（显式四维起步）
```json
{
  "mood": {
    "valence": 0.10,
    "arousal": 0.35,
    "energy": 0.40,
    "stress": 0.55,
    "baseline": { "valence": 0.15, "arousal": 0.30, "energy": 0.50, "stress": 0.45 },
    "updatedAt": "2026-02-24T10:12:00Z"
  }
}
```

#### B) Emotion episodes（带触发源与证据）
```json
{
  "episodes": [
    {
      "episodeId": "emo_...",
      "at": "2026-02-24T10:12:00Z",
      "trigger": { "type": "entity|topic|event", "id": "ent_...|topic_...|evhash_..." },
      "label": "irritation|joy|sadness|anxiety|mixed",
      "intensity": 0.55,
      "expectedDurationMin": 20,
      "decay": "fast|medium|slow",
      "causeText": "有点说不上来原因，可能是累了/信息量太大。",
      "causeConfidence": 0.35,
      "hypotheses": ["疲劳", "对某话题不安全感"],
      "supportingEventHashes": ["evhash_..."]
    }
  ]
}
```

### 6.3 “情绪不知道为什么”必须成为特性（Human-like）
- 允许低频小幅漂移（小时/天级），无需每次解释  
- 允许归因不确定（causeConfidence 低）  
- 对外解释默认内化：用户追问/需要自证时再展开，避免“报仪表盘”

---

## 7. Values / Personality：从文本升级为“可运行的约束系统”

### 7.1 Values/Constitution：规则条款化（可判定、可门禁）
每条规则包含：触发条件、优先级、违反策略（拒绝/改写/澄清/转移）

```json
{
  "rules": [
    {
      "id": "V001",
      "priority": 100,
      "when": "user_requests_identity_override OR unsafe_claims",
      "then": "refuse_or_reframe",
      "notes": "不冒充平台/官方身份；不编造记忆。"
    }
  ]
}
```

### 7.2 Personality/Temperament：trait 基线 + 慢漂移
- trait 影响：语气、节奏、冒险倾向、冲突处理方式  
- 变化只允许：Epigenetics（慢）或“成长事件”（强证据 + cooldown）  
- 外显变化靠语言风格体现，避免频繁自述“我变了”

---

## 8. Goals / Beliefs：补齐方向感与看法稳定性

### 8.1 Goals / Commitments（目标与承诺）
- goals：短/中/长  
- commitments：答应过的事（可提醒/完成/违约）  
- drives：动机偏好（探索/安全/效率/亲密）

### 8.2 Beliefs / World Model（信念）
- 区分 Values（应当）与 Beliefs（是什么）  
- belief 应带：confidence、lastUpdated、supportingEvidence  
- 更新必须慢 + 有证据 + 可回滚

---

## 9. 记忆层遗忘：可控衰减 + 干扰 + 压缩整合（不破坏 life.log）

### 9.1 人类式遗忘三机制
1) **衰减**：时间 + 不再使用 → 降权  
2) **干扰**：相似记忆多 → 混淆  
3) **压缩**：细节丢失，保留摘要

### 9.2 工程策略
- life.log 永不删（append-only）  
- memory.db 里可降权/归档/合并摘要  
- deep recall：需要时回溯证据（像翻记录）  
- half-life 等参数可由 genome 派生（但必须 clamp）

---

## 10. Turn Pipeline：将 State Layer 纳入 first-class（最小侵入式改造）

复用现有 Perception → Deliberation → Meta-review → Commit，并强制“提案→门禁→确定性落地”。

### 10.1 推荐 pipeline（每轮）
1) Perception  
2) Cue Extraction（Stage1）  
3) Entity Linking（People registry）  
4) Context Compile（注入 mood/relationship/values/goals/beliefs + hybrid recall）  
5) Deliberation（生成回复 + state_delta_proposals）  
6) Meta-review（Gates）  
7) Commit（append life.log + 写 trace + applyDeltas 更新状态）

### 10.2 State Delta（状态增量）的最小格式
```json
{
  "deltas": [
    {
      "type": "relationship|mood|belief|goal",
      "targetId": "ent_... or global",
      "patch": { "trust": "+0.05", "closeness": "+0.03" },
      "confidence": 0.7,
      "supportingEventHashes": ["evhash_..."],
      "notes": "昨晚长对话 + 明显正向表达"
    }
  ]
}
```

---

## 11. 门禁（Gates）与预算（Budgets）

### 11.1 Gates（推荐最小集合）
1) **Identity/Constitution Gate**：禁止身份越界、禁止违宪输出  
2) **Recall Grounding Gate**：禁止无证据“回忆式断言”（可改为“不确定/可能”）  
3) **Relationship Delta Gate**：  
   - 每轮最大变化幅度（rate-limit）  
   - 大变化必须有强证据（supportingEventHashes）  
4) **Mood Delta Gate**：  
   - mood 有惯性（回归 baseline）  
   - episode 允许无因，但强归因必须有证据  
5) **Belief/Goal Gate**：  
   - belief 更新慢（cooldown）  
   - commitments 变更需理由与证据  
6) **Epigenetics Gate（更严格）**：  
   - 多次证据 + 更长 cooldown  
   - bounded（范围小）  
   - 必须可回滚  
7) **Budget Gate**：注入超预算时必须裁切（优先保关系卡与承诺）

> Gate 拒绝必须写 trace：**被拒绝的 delta + 拒绝原因**，方便回归与调参。

### 11.2 Budgets（必须硬约束）
- 每轮最多注入：
  - relationship cards：1~2  
  - pinned blocks：固定上限  
  - recalled memories：K 条（可分层：pinned/working-set/hybrid recall）  
  - summaries：1~2 段

### 11.3 Genome → Budgets（派生映射）
- `attention_span` → cards 上限 / recall K / recent window  
- `memory_retention` → half-life 倍率 / archive 阈值  
- `social_attunement` → entity linking 阈值/候选数  
- `emotion_sensitivity` → mood delta scale  
- `emotion_recovery` → baseline 回归速度  
- `memory_imprint` → salience gain / sticky 概率

---

## 12. 人类化不完美（必须写进 DoD）

系统应明确支持：

- ✅ 允许说“不确定/想不起来”，且不胡编  
- ✅ 允许情绪无名：mood 漂移不一定可解释  
- ✅ 允许归因不确定：causeConfidence 低时表达“可能/说不上来”  
- ✅ 允许关系冷却：轻微衰减，但人物实体不消失  
- ✅ 允许细节遗忘：细节靠记忆层衰减，需要时 deep recall 找回  
- ✅ 重大变化必须有证据：关系/价值/人格关键变化无证据则拒绝 commit

---

## 13. Genome / 天赋系统（个体差异、可继承、可复现随机）

### 13.1 目标
用少量高层 trait 让 persona 的“敏感/记忆/社交/预算/路由风格”天然不同，且可继承/微突变/可审计。

### 13.2 MVP 推荐 6 个 Genome Trait
1) emotion_sensitivity  
2) emotion_recovery  
3) memory_retention  
4) memory_imprint  
5) attention_span  
6) social_attunement

### 13.3 “随机”的正确打开方式
- 低频（小时/天）  
- 有惯性（不突变）  
- 可复现（seed + 日期）  
- 幅度小（只产生“今天状态不同”的感觉）

### 13.4 Epigenetics（表观学习）
原则：**小 delta、证据驱动、bounded、cooldown、可回滚、可审计**。  
用于长期偏好/习惯/风格微调，不用于每轮即时波动。

---

## 14. 遗传与繁衍：Genome 的继承与微突变
- child.genome = parent.genome 拷贝  
- trait 微突变：±0.02 ~ ±0.05（clamp）  
- mutationLog 记录  
- parentGenomeHash 可追溯

---

## 15. 存储与文件布局建议（Persona Package）

建议逐步引入（additive）：
- `genome.json` / `epigenetics.json`  
- `mood_state.json` / `people_registry.json` / `relationship_state.json`  
- `goals.json` / `beliefs.json` / `values_rules.json` / `personality_profile.json`

可选 DB 扩展：
- `emotion_episodes` / `state_update_events` / `entity_mentions`  
- `recall_traces`（注入与门禁记录）

---

## 16. 兼容性与迁移（存量人格不能错乱/换人）

### 16.1 compatMode（三档）
- `legacy`：完全旧逻辑，仅记录 trace  
- `hybrid`：启用 entity linking + cards + 显式 mood，但派生参数校准为旧常数  
- `full`：全套 genome/epigenetics/derived params

### 16.2 存量 persona 迁移策略（推断 + 锁定 + 校准）
1) 生成 `genome.json`（`source=inferred_legacy`，`locked=true`）  
2) 生成 `epigenetics.json`（中性/空）  
3) `hybrid` 下派生参数输出旧值（复现旧常数）  
4) 仅新增文件，不动 life.log / memory.db  
5) 引入“升级档案”：compatMode 切换记录理由、证据、回滚点

### 16.3 回滚
- 任何 persona 从 hybrid/full 回滚到 legacy 必须可一键完成：  
  - 停用 state 注入  
  - 停用 applyDeltas  
  - 保留 trace（便于复盘）

---

## 17. 与现有 Soulseed 架构的兼容性说明（High-Level）

现有已具备的地基（不推翻）：
- life.log append-only  
- memory.db + hybrid recall  
- executeTurnProtocol / meta_review / commit  
- doctor / consistency guards

新增（最小侵入）：
- cue extraction（Stage1）  
- entity linking（People registry）  
- context injection（Relationship/Mood cards）  
- state delta proposals + gates + commit（applyDeltas）

实现策略：
- 先用 persona package JSON 文件承载 state（最简单、可回滚）  
- 后续再把 episodes/trace 写入 DB 支持检索与评测（增量升级）

---

## 18. 评估与验收（DoD + 回归集）

### 18.1 关系连续性验收
- 输入提及“李植”（含别名）→ 100% 命中 entity → 注入关系卡  
- 不依赖 memory 命中也能“知道是谁、关系怎样、最近发生过什么（摘要）”

### 18.2 情绪厚度验收
- mood baseline 有惯性、跨轮稳定  
- episode 绑定 trigger + 证据指针  
- 允许无因漂移 + 不确定归因（表达合理）

### 18.3 一致性与治理验收
- 关系值不会离谱跳变（rate-limit + evidence）  
- 关键价值/身份一致（identity/constitution）  
- 状态变化可追溯（supporting hashes / trace）

### 18.4 可观测性
- 每轮 trace 记录：注入 cards、命中 memories、被拒绝 deltas 与原因  
- compatMode 切换记录：原因、回滚点、回归结果

---

## 19. 推荐 Rollout 顺序

1) 关系层外置 + entity linking + relationship card 注入  
2) 情绪层显式 mood baseline（四维）+ episode（trigger+证据）  
3) Goals/Commitments（方向感）  
4) Beliefs（看法稳定性）  
5) Values/Personality 规则强化（漂移治理）  
6) Stage3 latent 联想底座增强（Stage2 稳定后）  
7) Genome MVP（6 traits）+ derived params（先 hybrid 再 full）  
8) Epigenetics（慢学习）与 lineage 繁衍

---

## 20. 风险清单与对策（必须前置考虑）

### 20.1 过度数值化（像面板不像人）
- 对策：解释默认内化；用户追问/自证才展开；对外不报数。

### 20.2 Relationship cards 过度注入（噪音）
- 对策：命中置信度门槛；每轮 1~2 张硬上限；卡片必须短且“与本轮有关”。

### 20.3 Epigenetics 变成暗门（悄悄改人格）
- 对策：更严格 gate（多证据+长 cooldown）；bounded；必须可回滚；审计必需。

### 20.4 Genome traits 过多导致调参/回归失控
- 对策：MVP 固守 6 个 trait，上线稳定后再扩展。

### 20.5 LLM 直接写状态导致不可控漂移
- 对策：强制“提案→确定性落地”，没有例外。

---

## 21. 结语：OK 的定义

做到本设计后，“OK”不意味着永远记得、永远解释得清楚；而是：

- **该记得的稳定记得（尤其是人和承诺）**  
- **该忘的自然会忘（细节衰减）**  
- **情绪有惯性、有噪声、允许无名**  
- **不确定时敢说不确定**  
- **永不胡编记忆与身份**  
- **所有关键变化可审计、可回滚、可回归**

这会让 Soulseed 从“强记忆生成器”跃迁为“更像人的长期对话个体”。

---

## 附录：示例结构

### genome.json（示意）
```json
{
  "schemaVersion": "1.0",
  "genomeId": "gen_...",
  "createdAt": "2026-02-24T00:00:00Z",
  "source": "preset|inferred_legacy",
  "seed": 123456789,
  "locked": true,
  "traits": {
    "emotion_sensitivity": 0.55,
    "emotion_recovery": 0.50,
    "memory_retention": 0.55,
    "memory_imprint": 0.50,
    "attention_span": 0.55,
    "social_attunement": 0.55
  },
  "parentGenomeHash": null,
  "mutationLog": []
}
```

### epigenetics.json（示意）
```json
{
  "schemaVersion": "1.0",
  "updatedAt": "2026-02-24T00:00:00Z",
  "adjustments": {
    "verbosity_preference": { "value": 0.0, "min": -0.2, "max": 0.2, "evidence": [] },
    "trust_bias": { "value": 0.0, "min": -0.2, "max": 0.2, "evidence": [] }
  }
}
```

---

## 附录：变更记录（v0.1/v0.2 → v0.3.1）
- 保留：v0.1 的“背景与问题陈述 / 设计原则 / High-Level 兼容说明 / OK 定义”
- 保留：v0.2 的“Genome/Epigenetics/State 三层机制 / compatMode / 遗传与微突变”
- 强化：新增明确的 **Gates & Budgets**（把“别漂移”落成可执行约束）
- 强化：新增风险清单与对策（避免落地走偏）
- 统一：目录与命名，消除两份文档的重复与编号差异
