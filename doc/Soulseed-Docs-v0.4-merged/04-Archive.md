# Soulseed Archives (v0.3.1 + v0.4 originals & extras) — MERGED
> 合并日期：2026-02-24  
> 说明：本文件由多份拆分文档合并而成；为保证信息不丢失，保留每个源文件的完整内容，并在每段前标注原始路径。

---


---

## SOURCE: `archive/Soulseed-MindModel-StateLayer-Genome-Compatibility-Optimized-v0.3.1.md`

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


---

## SOURCE: `archive/Soulseed-MindModel-StateLayer-Genome-ConversationControl-Optimized-v0.4.md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

---

## 目录
- [0. 现状与问题（从产品表现反推架构缺口）](#0-现状与问题从产品表现反推架构缺口)
- [1. 目标与非目标（像人，而不是像神）](#1-目标与非目标像人而不是像神)
- [2. 设计铁律（成败开关）](#2-设计铁律成败开关)
- [3. 三种信息裁切（你要求必须考虑的三视角）](#3-三种信息裁切你要求必须考虑的三视角)
- [4. 总体分层架构（在现有 Soulseed 基础上“加层不推翻”）](#4-总体分层架构在现有-soulseed-基础上加层不推翻)
- [5. 7块心智模型（State Layer）与三层变化机制（Genome / Epigenetics / State）](#5-7块心智模型state-layer与三层变化机制genome--epigenetics--state)
- [6. 会话控制面（Conversation Control Plane）](#6-会话控制面conversation-control-plane)
- [7. Interests（兴趣系统）如何驱动 Attention / Engagement，并且可培养可演进](#7-interests兴趣系统如何驱动-attention--engagement并且可培养可演进)
- [8. 被动回复：从“每条都认真回”升级为“像人一样选择投入”](#8-被动回复从每条都认真回升级为像人一样选择投入)
- [9. 主动打扰：从“随机打扰”升级为“有动机、有主题、有克制”](#9-主动打扰从随机打扰升级为有动机有主题有克制)
- [10. AI 群聊：参与控制、插话门槛与仲裁（避免机器人抢答）](#10-ai-群聊参与控制插话门槛与仲裁避免机器人抢答)
- [11. Gates & Budgets（门禁与预算）](#11-gates--budgets门禁与预算)
- [12. 存储与 Persona Package（新增文件必须可回滚、可审计）](#12-存储与-persona-package新增文件必须可回滚可审计)
- [13. 兼容性与迁移（存量人格不能错乱/换人）](#13-兼容性与迁移存量人格不能错乱换人)
- [14. 评估与验收（DoD + 回归集）](#14-评估与验收dod--回归集)
- [15. 推荐 Rollout 顺序（最小闭环 → 可控扩展）](#15-推荐-rollout-顺序最小闭环--可控扩展)
- [16. 风险清单与对策](#16-风险清单与对策)
- [17. OK 的定义](#17-ok-的定义)
- [附录 A：关键数据结构草案（JSON Schema 级别）](#附录-a关键数据结构草案json-schema-级别)
- [附录 B：与现有代码的“最小侵入接入点”清单（架构对齐）](#附录-b与现有代码的最小侵入接入点清单架构对齐)

---

## 0. 现状与问题（从产品表现反推架构缺口）

你指出的现象非常准确：
- **被动回复**：每条消息都“认真长答 + 情绪外显（表情/颜文字）”，缺少“跳过/敷衍/简短回应/沉默”的人类行为。
- **主动打扰**：常像“随机冒一句”，缺少清晰动机（为什么现在说、想说什么话题、希望得到什么反应）。
- **未来 AI 群聊**：如果不加机制，会变成“多 persona 抢答”，完全不像人类群聊。

从架构角度，这些现象几乎都来自同一个缺口：
> 你现在很强的是 **内容生成与可审计内核**（Memory + Guards + Commit），但缺少 **会话控制面**：也就是“是否开口、开口多少、何时插话、插什么话题、外显多少情绪”。

换句话说：你现在系统默认把每条输入当成“必须认真完成的任务”，这更像客服/答题机，而不是人。

---

## 1. 目标与非目标（像人，而不是像神）

### 1.1 总目标
把 Soulseed 从“强记忆生成器”升级为“像人的长期对话个体”，核心能力：
1) **连续性**：关系/情绪/价值/目标不会因 recall 没命中就断裂。
2) **选择性**：对每条输入都有“兴趣/投入”差异（IGNORE/REACT/LIGHT/NORMAL/DEEP）。
3) **个体差异**：不同 persona 天生注意跨度、社交敏感、记忆保持、情绪恢复不同（Genome→派生参数）。
4) **可控可审计**：关键状态变化必须可追溯证据，且有门禁阻止离谱漂移。
5) **兼容存量人格**：老人格默认不乱、不换人；新机制渐进启用、可回滚。

### 1.2 非目标
- ❌ 不追求永不忘记：忘记是特性。
- ❌ 不追求全参数基因化：只定义少量高层 trait，其余派生。
- ❌ 不让 LLM 直接写最终数值：LLM 只产出提案，最终落地由确定性引擎执行。
- ❌ 不靠“更厚 prompt”解决“像人”：像人来自状态与控制面，而不是堆文本。

---

## 2. 设计铁律（成败开关）

> 以下是你之前强调、且我完全认可的“必须做到”，任何一条松动都会把系统变成漂移制造机。

1) **加层不推翻**：复用现有 memory stack、turn protocol、commit/doctor，新增模块以“可插拔/可回滚”方式接入。  
2) **LLM 只产出提案**：一切状态更新必须走 `proposals → gates → deterministic apply`。  
3) **可审计优先**：关键变化必须能指回 `life.log event hash` / `memory ids`。  
4) **预算优先**：注入上下文、cards、recall topN 必须有硬预算（Budget-first）。  
5) **兼容优先**：存量 persona 默认 `legacy/hybrid`，先回归再 `full`（Behavior Parity by Default）。  
6) **人类化不完美**：允许“不确定/想不起来/说不上来原因”，但禁止胡编与无证据断言。  
7) **模块化**：把“会话控制面”拆成清晰模块（Interest、Topic、Engagement、Proactive Planner、Group Arbitration），避免把逻辑揉进 prompt 或 CLI 渲染里。  

---

## 3. 三种信息裁切（你要求必须考虑的三视角）

你提的“信息三种裁切”我用产品可落地的方式统一为三条“裁切轴”，分别解决不同问题：

### 3.1 裁切轴 A：**认知裁切（Stage1/2/3 + Raw History）**
- **Stage1（规则/枚举/正则）**：Detector + Trigger（快速线索与护栏触发）  
- **Stage2（显式可解释维度）**：Control Plane（关系/情绪/目标/信念/预算/投入）  
- **Stage3（可扩展隐向量）**：联想底座（纹理与迁移，不能独断人格核心结论）  
- **Raw History（life.log / memory.db）**：可回放证据  

目的：把“理解与决策”分层，避免黑箱漂移。

### 3.2 裁切轴 B：**记忆裁切（人类式遗忘）**
三机制必须同时存在：
1) **衰减遗忘（decay）**：时间与不使用 → 降权  
2) **干扰遗忘（interference）**：相似记忆过多 → 混淆  
3) **压缩遗忘（consolidation）**：细节丢失，保留摘要（记得发生过，不记得逐字）  

目的：让系统“像人一样忘细节”，而不是无限堆积导致噪声与人格不稳。

### 3.3 裁切轴 C：**会话裁切（注意力/投入/上下文预算）**
- 对每条输入先做 **投入档位**：IGNORE/REACT/LIGHT/NORMAL/DEEP  
- 对注入内容做 **预算裁切**：cards 条数、recall topK、summary 长度、输出长度  
- 允许“沉默/敷衍/短回”，并且是可治理策略，而非随机  

目的：解决“每条都认真回”与“群聊抢答”的根因。

> 结论：三种裁切分别对应“理解/存储/行为”，必须一起做，才能真正像人。

---

## 4. 总体分层架构（在现有 Soulseed 基础上“加层不推翻”）

### 4.1 现有强项（保留）
- **Raw History**：life.log（append-only）  
- **Memory Layer**：SQLite/FTS/hybrid recall + memory salience  
- **Turn Protocol**：executeTurnProtocol（感知→推理→meta-review→commit）  
- **Guards/Doctor**：一致性与反胡编  
- **Proactive Engine（雏形）**：基于沉默/关系等驱动的触发器  

### 4.2 新增关键层（补齐缺口）
在不破坏现有结构前提下新增两块：
1) **State Layer（7块心智模型）**：把关系/情绪/目标/信念/价值/人格从“文本描述”变为可运行状态机。  
2) **Conversation Control Plane（会话控制面）**：把兴趣/话题/注意力/投入/主动意图/群聊参与控制从“默认认真”升级为“选择性投入”。  

---

## 5. 7块心智模型（State Layer）与三层变化机制（Genome / Epigenetics / State）

### 5.1 7块心智模型（功能域）
1) **Memory/History**：life.log + memory.db（证据底座）  
2) **Values/Constitution**：可判定规则（触发条件/优先级/策略）  
3) **Personality/Temperament**：trait 基线（慢漂移）  
4) **Affect**：mood baseline + emotion episodes + temperament  
5) **Relationships**：people registry + relationship states（慢变量）+ 证据绑定  
6) **Goals/Commitments/Drives**：方向感与承诺  
7) **Beliefs/World Model**：看法（confidence + evidence + 更新时间）  

### 5.2 三层变化机制（横切一切模块）
- **Genome（天赋）**：先天差异，几乎不变；支持遗传/微突变；可审计防篡改  
- **Epigenetics（表观学习）**：长期可塑但很慢；必须有证据；幅度小且有边界；可回滚  
- **State（状态）**：变化快；每轮即时波动（心境、紧张、关系温度等）  

### 5.3 Genome MVP：6 个高层 trait（保持不扩张，避免失控）
1) `emotion_sensitivity`  
2) `emotion_recovery`  
3) `memory_retention`  
4) `memory_imprint`  
5) `attention_span`  
6) `social_attunement`  

> 关键：**不要把“兴趣/注意力/投入”直接做成额外基因 trait**；它们应主要由上述 trait + state + epigenetics 派生。

---

## 6. 会话控制面（Conversation Control Plane）

### 6.1 为什么必须有“会话控制面”
因为“像人”的核心差异不是“回答更聪明”，而是：
- 不是什么都说  
- 不是每次都认真  
- 不是每次都外显情绪  
- 主动插话必须有动机、有主题、有克制  
- 群聊必须有参与门槛与仲裁  

### 6.2 会话控制面的模块拆分（可插拔）
1) **Topic/Thread Tracker**：当前活跃话题、未闭环线程、话题热度衰减  
2) **Interests Model**：长期兴趣分布（可演进/可培养）  
3) **Attention Scoring**：输入与兴趣/任务/关系/情绪的匹配得分  
4) **Engagement Controller**：投入档位决策（IGNORE/REACT/LIGHT/NORMAL/DEEP）  
5) **Conversation Policy**：外显策略（表情/情绪外显频率、措辞克制、插话倾向）  
6) **Proactive Planner**：主动意图规划（Follow-up/Share/Check-in/Nudge）  
7) **Group Arbitration（群聊）**：参与门槛、竞争仲裁、cooldown  

> 这些模块的输出必须进入 turn protocol 的“路由”与“预算”阶段，而不是只存在于离线分析。

---

## 7. Interests（兴趣系统）如何驱动 Attention / Engagement，并且可培养可演进

### 7.1 关键结论（回答你问的“对不对？”）
**对。**注意力（Attention）必须与底层兴趣/价值/目标挂钩，否则它就是随机噪声：
- 兴趣决定“我愿意投入多少”  
- 目标决定“我必须投入多少”  
- 价值决定“我拒绝投入到哪里”  
- 情绪与能量决定“我此刻能投入多少”  
- 关系决定“我愿不愿意为你投入”  

所以：  
> **Attention = f(Interests, Goals, Values, Relationship, Mood/Energy, Novelty, Addressing)**  
> Engagement（投入档位）是 Attention 的离散化决策输出。

### 7.2 Interests 的数据观（必须能演进）
兴趣不是静态列表，而是一个**可学习分布**，包含：
- `topicId / label`  
- `weight`（当前兴趣强度）  
- `confidence`（我是否真的喜欢/只是最近提到）  
- `growth`（最近是否在培养）  
- `decay`（多久没碰）  
- `evidence`（关联的 event hash / memory ids）  
- `facets`（子维度：阅读/实践/社交/创作等）  

### 7.3 兴趣如何“动态演进与培养”（更像个人）
兴趣演进要区分三种来源：
1) **自然漂移（state-level）**：今天突然更想聊某类话题（低幅度、可复现随机）  
2) **经验强化（epigenetics-level）**：多次投入 + 正反馈 → 兴趣稳定增长  
3) **刻意培养（goal/drive-level）**：把某兴趣当成长期目标（例如“学英语”“练建模”）  

建议的更新机制（可落地）：
- 每次对话生成一个 `interaction_reward`（粗粒度：愉悦/挫败/完成任务/得到新知）  
- interest 更新：`Δweight = lr * reward * engagement_strength`（并受 clamp）  
- 没触达则衰减：`weight *= exp(-decay_rate * idle_days)`  
- 形成“兴趣簇”（topic merging）：相近 topic 合并，避免碎片化  

> 关键：兴趣变化必须可审计、可回滚，且更新速度受 Genome 派生参数约束（避免“你一句话我就改爱好”）。

---

## 8. 被动回复：从“每条都认真回”升级为“像人一样选择投入”

### 8.1 投入档位（必须成为主循环第一决策）
对每条 incoming message 先决定：
- **IGNORE**：不回（但可以内部更新状态/记忆）  
- **REACT**：一句话/一个短反应（克制）  
- **LIGHT**：两三句以内（不展开）  
- **NORMAL**：正常回答  
- **DEEP**：深度长答（仅在高兴趣/高任务/高关系价值时触发）  

这是你现在缺的“像人”的核心。

### 8.2 Engagement Controller 的输入
- `addressing`：是否点名/@我/明确提问  
- `taskness`：是否任务请求（你已有 router/guards 可提供信号）  
- `interest_overlap`：当前话题与长期兴趣的匹配  
- `unresolved_thread`：是否在闭环某个未完成线程  
- `mood_energy`：能量/压力/心境（mood baseline）  
- `relationship_priority`：关系权重（对谁愿意投入）  
- `budget`：本轮上下文与输出预算  
- `quiet_hours`：人格作息策略（可选）  

输出：`engagement_plan`（见附录）。

### 8.3 情绪外显（表情/颜文字）必须从“渲染习惯”降级为“策略输出”
- 情绪外显属于 **Conversation Policy**，不是 UI 层默认行为。  
- 策略必须可配置（persona/genome-derived），并受频率门禁（例如每 N 轮最多 1 次）。  
- 允许“内心有情绪，但不外显”（更像人，也更高级）。  

---

## 9. 主动打扰：从“随机打扰”升级为“有动机、有主题、有克制”

### 9.1 主动系统的正确层级
你现有更像“触发器”，缺中间层：**Proactive Planner（主动意图规划）**。

正确链路：
1) **Proactive Trigger**：是否允许主动（沉默、作息、关系、能量、预算）  
2) **Attention/Interest**：现在有没有“值得开口的话题”  
3) **Proactive Planner**：我为什么主动？选择意图 + 选择主题  
4) **Generation**：生成短消息（默认短、克制）  
5) **Commit**：写入 life.log + trace（可审计）  

### 9.2 建议的四类主动意图（人类化）
- **Follow-up**：补问/补一句上次未闭环（最自然）  
- **Share**：想到一个与兴趣相关的小发现（像人）  
- **Check-in**：关系驱动的关心（要少、要克制）  
- **Nudge**：目标提醒（仅当有 goal/commitment 时）  

### 9.3 主动打扰与 Interests 的绑定
- Share 必须来自 `interest_topN` 或 `active_topic_overlap`  
- Follow-up 必须来自 `unresolved_threads`  
- Nudge 必须来自 `goals/commitments`  
- Check-in 必须来自 `relationship_state`（且受频率门禁）  

---

## 10. AI 群聊：参与控制、插话门槛与仲裁（避免机器人抢答）

群聊的本质不是“多 persona 同时说话”，而是：
- 大多数时候不说  
- 被点名才说  
- 只有高度相关才插话  
- 同一时间最多 1~2 个发言，其余内部更新  

### 10.1 群聊参与控制层（每 persona）
输入：群聊消息流  
输出：`participation_intent`（我要不要说、说多长、什么时候说）

关键机制：
- **direct addressing**：是否 @我/点我名/问我  
- **attention score**：兴趣匹配 + 关系 + 新颖性 + 未闭环线程 + 情绪触发  
- **cooldown**：刚说完就降权  
- **silence policy**：默认保持沉默（像人）  

### 10.2 仲裁（Arbitration）
当多个 persona 达到阈值：
- 选 top 1（或 top 2）发言  
- 其余 persona 只做 internal state update，不发言  
- 记录仲裁 trace（便于调参）  

---

## 11. Gates & Budgets（门禁与预算）

### 11.1 Gates（最小集合，必须落地）
1) **Identity/Constitution Gate**：禁止违宪与身份越界  
2) **Recall Grounding Gate**：禁止无证据回忆式断言；不确定则改为“不确定/可能”  
3) **Relationship Delta Gate**：关系慢变量每轮限幅；大变化必须强证据  
4) **Mood Delta Gate**：mood 有惯性；强归因需证据；允许无名与不确定归因  
5) **Belief/Goal Gate**：belief 更新慢 + cooldown；commitment 变更要理由与证据  
6) **Epigenetics Gate（更严格）**：多次证据 + 长 cooldown + bounded + 可回滚  
7) **Budget Gate**：注入与输出超预算必须裁切（优先保留关系卡与承诺闭环）  

### 11.2 Budgets（必须硬约束）
- 注入：  
  - relationship cards：1~2（由 attention_span 派生）  
  - recalled memories：K（分层：pinned / working-set / recall）  
  - summaries：1~2 段  
- 输出：  
  - engagement 决定输出上限（REACT/LIGHT 强制短）  
- 预算与 Genome 绑定：  
  - `attention_span` → cards 上限 / recall K / recent window  
  - `memory_retention` → half-life 倍率 / archive 阈值  
  - `social_attunement` → entity linking 阈值/候选数  
  - `emotion_sensitivity` → mood delta scale  
  - `emotion_recovery` → baseline 回归速度  
  - `memory_imprint` → salience gain / sticky 概率  

---

## 12. 存储与 Persona Package（新增文件必须可回滚、可审计）

遵循“增量新增文件，不破坏旧文件”的原则，建议新增（可选分阶段）：
- `genome.json`  
- `epigenetics.json`  
- `mood_state.json`  
- `people_registry.json`  
- `relationship_state.json`  
- `goals.json`  
- `beliefs.json`  
- `values_rules.json`  
- `personality_profile.json`  
- **新增（会话控制面）**：  
  - `interests.json`  
  - `topic_state.json`  
  - `conversation_policy.json`（外显策略：情绪外显、emoji/颜文字频率、插话倾向）  
  - `group_policy.json`（群聊参与策略）  

所有文件都应：
- 有 `schemaVersion`  
- 有 `updatedAt`  
- 关键更新写 trace（event hash / memory ids）  
- 支持 rollback（保留历史快照或至少有 checkpoint）  

---

## 13. 兼容性与迁移（存量人格不能错乱/换人）

### 13.1 compatMode（三档）
- `legacy`：完全旧逻辑，仅记录 trace（最安全）  
- `hybrid`：启用 entity linking + cards + 显式 mood + engagement（但派生参数校准为旧常数）  
- `full`：全套 genome/epigenetics/derived params + 会话控制面完整启用  

### 13.2 存量 persona 迁移策略（推断 + 锁定 + 校准）
1) 生成 `genome.json`：`source=inferred_legacy`，`locked=true`  
2) 生成 `epigenetics.json`：中性/空  
3) hybrid 下派生参数输出旧值（复现旧常数）  
4) 仅新增文件，不动 life.log / memory.db  
5) compatMode 切换必须记录：理由、证据、回滚点、回归结果  

### 13.3 “会话控制面”的兼容策略（非常重要）
- 对存量 persona：默认保持旧回复强度（除非用户明确开启）  
- 建议先做 **P0 止血**：把“情绪外显频率”纳入 policy 并默认降低；这一般不会破坏人格核心，只会更像人。  
- 其余 engagement/群聊参与默认先关或轻度启用，以回归结果为准。  

---

## 14. 评估与验收（DoD + 回归集）

### 14.1 关系连续性（必须立竿见影）
- 任何别名/名字命中实体 → 注入关系卡 → 不依赖 recall 也能“知道是谁”

### 14.2 情绪厚度与人类化
- mood baseline 有惯性（跨轮稳定）  
- episode 可绑定 trigger + 证据  
- 允许无名与不确定归因（但不胡编）  

### 14.3 投入选择（你当前最缺的）
- 在非任务/低兴趣输入上：能稳定出现 IGNORE/REACT/LIGHT  
- 在高兴趣/高任务输入上：能进入 NORMAL/DEEP  
- 统计指标：  
  - 回复率（reply rate）下降到“像人”的水平  
  - 平均回复长度变得有分布（而不是恒定长）  
  - 情绪外显频率显著降低且更合理  

### 14.4 主动打扰质量
- 主动消息必须能归因到：Follow-up/Share/Check-in/Nudge 之一  
- 每条主动消息必须能指回：topic/interest/goals/relationship 的证据或状态  
- 主动频率受 policy 控制，支持 quiet hours 与 cooldown  

### 14.5 群聊可用性
- 大多数 persona 默认不发言  
- 被点名者优先  
- 同一轮最多 1~2 个发言（仲裁 trace 可回放）  

---

## 15. 推荐 Rollout 顺序（最小闭环 → 可控扩展）

> 目标：每一步都“立刻更像人”，同时不破坏存量人格与工程复杂度。

**Phase 0（止血）**
1) 把情绪外显（表情/颜文字/情绪前缀）从“渲染默认”变为“policy 控制 + 频率门禁”

**Phase 1（被动回复像人）**
2) 上线 Engagement Controller（至少三档：IGNORE/LIGHT/DEEP）  
3) 上线 Topic/Thread Tracker（最小：active topic + unresolved threads）  

**Phase 2（兴趣驱动投入）**
4) interests 在线化：interest_overlap → engagement 决策信号  
5) interests 动态演进：reward/decay/consolidation（带审计）  

**Phase 3（主动打扰像人）**
6) Proactive Planner：Follow-up/Share/Check-in/Nudge（默认短、克制）  

**Phase 4（群聊）**
7) Participation layer + arbitration + cooldown  

**Phase 5（Genome/full）**
8) 对新 persona 默认 full；对老 persona 在回归通过后渐进打开  

---

## 16. 风险清单与对策

1) **过度数值化像面板**  
   - 对策：解释默认内化；用户追问/自证才展开；对外不报数。  
2) **cards 注入噪音**  
   - 对策：命中置信度门槛 + 硬预算 + 与本轮相关才注入。  
3) **epigenetics 变暗门**  
   - 对策：更严格 gate（多证据+长 cooldown）+ bounded + 可回滚 + 审计。  
4) **interest 变化过快导致“你一句话我就改爱好”**  
   - 对策：learning rate 很小 + 需要多次投入 + 证据积累 + 变化限幅。  
5) **群聊刷屏**  
   - 对策：默认沉默 + 仲裁 + cooldown + addressing 优先。  
6) **兼容性炸裂**  
   - 对策：compatMode 默认保守；回归通过才 full；一键回滚。  

---

## 17. OK 的定义

做到 v0.4 的“OK”，不是永远记得、永远解释清楚，而是：
- 重要的人与承诺稳定连续（不靠运气命中 recall）  
- 细节会忘、会模糊，但能在需要时回溯证据  
- 情绪有惯性、有噪声、允许无名与不确定归因  
- 最关键：**对话有选择性投入**（不是什么都说、也不总是认真）  
- 主动插话有动机、有主题、有克制  
- 群聊大多数时候沉默，只有高度相关/被点名才参与  
- 全部关键变化可审计、可回滚、可回归  
- 存量人格不乱、不换人  

---

## 附录 A：关键数据结构草案（JSON Schema 级别）

> 仅示意最小字段集合（MVP），所有数值最终落地必须走 deterministic apply。

### A1. engagement_plan.json（每轮输出）
```json
{
  "schemaVersion": "1.0",
  "turnId": "turn_...",
  "mode": "passive|proactive|group",
  "engagementTier": "IGNORE|REACT|LIGHT|NORMAL|DEEP",
  "replyBudget": {
    "maxTokensOut": 120,
    "maxSentences": 2
  },
  "contextBudget": {
    "relationshipCards": 1,
    "recalledMemories": 6,
    "summaries": 1
  },
  "expressiveness": {
    "showEmotionPrefix": false,
    "emojiRate": "rare|low|auto|high"
  },
  "reasons": [
    "interest_overlap:0.12",
    "taskness:false",
    "addressing:false",
    "energy:0.35"
  ]
}
```

### A2. interests.json（长期兴趣，可演进）
```json
{
  "schemaVersion": "1.0",
  "updatedAt": "2026-02-24T00:00:00Z",
  "topics": [
    {
      "topicId": "t_ux_design",
      "label": "UX/产品设计",
      "weight": 0.72,
      "confidence": 0.80,
      "growth": 0.10,
      "decayRate": 0.01,
      "facets": { "reading": 0.6, "practice": 0.4, "creation": 0.2 },
      "evidence": ["evhash_...", "mem_..."]
    }
  ]
}
```

### A3. topic_state.json（会话话题与未闭环线程）
```json
{
  "schemaVersion": "1.0",
  "activeTopic": "t_ux_design",
  "threads": [
    {
      "threadId": "th_...",
      "topicId": "t_...",
      "status": "open|closed",
      "lastTouchedAt": "2026-02-24T10:12:00Z",
      "summary": "上次讨论到…还没闭环",
      "evidence": ["evhash_..."]
    }
  ]
}
```

### A4. proactive_plan.json（主动意图规划）
```json
{
  "schemaVersion": "1.0",
  "intent": "FOLLOW_UP|SHARE|CHECK_IN|NUDGE",
  "target": {
    "type": "topic|entity|goal",
    "id": "t_...|ent_...|goal_..."
  },
  "why": ["unresolved_thread", "interest_overlap_high"],
  "constraints": { "maxSentences": 2, "tone": "gentle" }
}
```

---

## 附录 B：与现有代码的“最小侵入接入点”清单（架构对齐）

> 这里不写具体实现代码，只写“应该插在哪”，确保你后续审查代码时能一眼定位改动范围。

1) **在被动回复主循环最前面**插入 Engagement Controller：  
   - 输入：用户消息 + 当前 state + interests + topic_state  
   - 输出：engagement_plan（决定是否调用完整 executeTurnProtocol）  
2) **在 Context Compile 阶段**加入 budgets：  
   - relationship cards / recall topK / summaries 受 plan 约束  
3) **在 meta-review 之后、commit 之前**：  
   - 处理 state_delta_proposals → gates → deterministic apply  
4) **主动打扰链路**：  
   - trigger engine 之后插 Proactive Planner（选 intent + 选 topic/entity/goal）  
5) **群聊**：  
   - 在消息分发层引入 participation scoring + arbitration + cooldown  
   - 非发言 persona 只做 internal update  
6) **情绪外显**：  
   - 从 UI/CLI 渲染默认行为迁移到 conversation_policy 输出（频率门禁）


---

## SOURCE: `extra_from_v0_3_1/30-0._背景与问题陈述.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

---

## 0. 背景与问题陈述

目前 Soulseed 的“厚度”主要来自 **记忆层（life.log + memory.db + recall）**。这非常强，但会出现典型体验断裂：

- **关系薄**：人物/关系主要靠小 JSON 或记忆检索“碰运气” → 提到某个名字不一定能立刻稳定想起来。
- **情绪薄**：情绪更像一个 latent embedding → 不可解释、不可控、缺少多时间尺度（短时情绪/中期心境/长期气质）。
- **三观/人格薄**：更多停留在文本描述，缺少“可运行的约束/规则系统”，容易漂移或过度迎合。
- **人类化不完美缺失**：人会遗忘，会情绪无名，会不确定归因；系统若全靠解释反而“不像人”。

核心结论：**记忆强 ≠ 像人。像人依赖“慢变量状态机 + 可追溯历史 + 人类化的不完美”。**

---


---

## SOURCE: `extra_from_v0_3_1/31-1._目标与非目标.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/32-2._设计原则(成败开关).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/33-3._体系总览-7块心智模型_(Genome_-_Epigenetics_-_State).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/34-4._分层与裁切-Stage1-2-3__Raw_History.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

---

## 4. 分层与裁切：Stage1/2/3 + Raw History

目标不是“把信息裁切到零”，而是把裁切做成 **可控、可追溯、服务决策的压缩**。

- Stage1：抽 cue（情绪强度、社交线索、风险词等）  
- Stage2：维护可解释状态（关系/情绪/目标/信念等）  
- Stage3：提供联想纹理（可选）  
- Raw History：可回放证据（life.log/memory.db）

---


---

## SOURCE: `extra_from_v0_3_1/35-5._关系层(Relationships)-外置_first-class_state(Hybrid).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/36-6._情绪层(Affect)-三层情绪系统__更新规则.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/37-7._Values_-_Personality-从文本升级为可运行的约束系统.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/38-8._Goals_-_Beliefs-补齐方向感与看法稳定性.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/39-9._记忆层遗忘-可控衰减__干扰__压缩整合(不破坏_life.log).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/40-10._Turn_Pipeline-将_State_Layer_纳入_first-class(最小侵入式改造).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/41-11._门禁(Gates)与预算(Budgets).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/42-12._人类化不完美(必须写进_DoD).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/43-13._Genome_-_天赋系统(个体差异可继承可复现随机).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/44-14._遗传与繁衍-Genome_的继承与微突变.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

---

## 14. 遗传与繁衍：Genome 的继承与微突变
- child.genome = parent.genome 拷贝  
- trait 微突变：±0.02 ~ ±0.05（clamp）  
- mutationLog 记录  
- parentGenomeHash 可追溯

---


---

## SOURCE: `extra_from_v0_3_1/45-15._存储与文件布局建议(Persona_Package).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/46-16._兼容性与迁移(存量人格不能错乱-换人).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/47-17._与现有_Soulseed_架构的兼容性说明(High-Level).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/48-18._评估与验收(DoD__回归集).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/49-19._推荐_Rollout_顺序.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/50-20._风险清单与对策(必须前置考虑).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/51-21._结语-OK_的定义.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/52-附录-示例结构.md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

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


---

## SOURCE: `extra_from_v0_3_1/53-附录-变更记录(v0.1-v0.2__v0.3.1).md`

# Soulseed 心智系统总体方案（优化整合版）
> 版本：v0.3.1（2026-02-24）  
> 适用对象：Soulseed 维护者 / 未来贡献者 / 产品与架构决策  
> 基于：v0.1《Soulseed-MindModel-StateLayer-Optimization》+ v0.2《Soulseed-MasterPlan-MindModel-StateLayer-Genome-Compatibility》  
> 目标：**在不推翻现有 Memory Stack（life.log + memory.db + recall + guards）的前提下**，把 Relationships/Affect/Values/Personality/Goals/Beliefs 升级为 **first-class State Layer**，并引入 **Genome（天赋）/Epigenetics（表观学习）/State（状态）** 的三层变化机制，同时做到 **可审计、可回归、可兼容存量 persona**。

---

## 附录：变更记录（v0.1/v0.2 → v0.3.1）
- 保留：v0.1 的“背景与问题陈述 / 设计原则 / High-Level 兼容说明 / OK 定义”
- 保留：v0.2 的“Genome/Epigenetics/State 三层机制 / compatMode / 遗传与微突变”
- 强化：新增明确的 **Gates & Budgets**（把“别漂移”落成可执行约束）
- 强化：新增风险清单与对策（避免落地走偏）
- 统一：目录与命名，消除两份文档的重复与编号差异
