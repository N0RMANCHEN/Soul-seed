# Soulseed Engineering Hardening — MERGED
> 合并日期：2026-02-24  
> 说明：本文件由多份拆分文档合并而成；为保证信息不丢失，保留每个源文件的完整内容，并在每段前标注原始路径。

---


---

## SOURCE: `engineering/工程加固补充（严苛评审落地条款）.md`

# 工程加固补充（严苛评审落地条款）
> 版本：v0.1（2026-02-24）  
> 目的：把 v0.3.1 / v0.4 的“理念”补齐为**可写进代码与回归集**的硬约束（Invariant / Schema / DoD）。  
> 原则：**不改变原方案的方向**，只补齐“会炸的缺口”。

---

## 1. 这套系统落地时最容易爆炸的 5 个点（必须前置硬化）

1) **缺硬不变量（Invariant）与阈值** → 会变成“更复杂的漂移制造机”  
2) **Interests/Attention/Engagement 的 reward/decay 未定义** → 兴趣会乱学、难 debug  
3) **投入档位（IGNORE/REACT/LIGHT）缺覆盖规则** → 容易被感知为敷衍/不靠谱  
4) **群聊仲裁缺确定性函数** → 易被强势人格垄断或刷屏  
5) **兼容性承诺缺“旧常数清单 + 推断方法”** → compatMode 可能变成口头保证

---

## 2. 最小闭环（MVP）建议：先做“会话控制面 P0”再扩张

### P0-MVP 仅做三件事（立刻提升体验、风险可控）
- **Engagement Controller（LIGHT / NORMAL / DEEP 三档）**：先不开放 IGNORE（可后续加）
- **情绪外显策略化**：emoji/颜文字/语气作为 policy 输出（有频率门禁）
- **People Registry + Relationship Card 注入**：关系连续性保底（“你不是每次都忘了谁是谁”）

> 这三件事都能走“加层不推翻”的路径：不会破坏现有 memory/guards/trace。

---

## 3. 硬不变量表（Invariant Table）模板（建议写入文档附录并做回归）
> 下面给出“必须写死”的维度；数值可按 Genome trait 派生，但**必须有 clamp**。

### 3.1 Relationship（慢变量）
- 单轮变化上限：`|Δtrust| ≤ 0.03`（示例，最终由 genome 派生后 clamp）
- 关键变化定义：`|Δtrust| ≥ 0.10` 或 `relationship_state.version++` 必须写 audit event
- 证据门槛：若 `|Δtrust| > 0.03`，需要 ≥2 个 supportingEventHashes
- 冷却：在无新证据情况下，trust 向 baseline 回归（rate 受 trait 影响）

### 3.2 Beliefs（更慢、更难改）
- 同一 belief 的 cooldown：≥ 7 天（或 ≥ N 轮对话）
- 单次 confidence 变化：`|Δconf| ≤ 0.10`
- 关键变化定义：`|Δconf| ≥ 0.20` 必须写入 “belief_change” 审计事件
- 证据门槛：belief 变化必须绑定 sources（记忆片段 id / 用户明确表述）

### 3.3 Mood / Affect（快变量）
- baseline 回归速度范围：`[0.02, 0.08]/hour`（示例）
- 单轮外显频率门禁：每 20 轮 emoji ≤ X（X 由 persona policy 决定）
- “原因不明”允许：episode 可标记 `unknown_cause=true`（但不能借此乱改长期变量）

### 3.4 Engagement（投入）
- 任何满足以下条件的输入**禁止**进入 LIGHT（必须 NORMAL+）：
  - `addressing=true` 且 `taskness=true`
  - 存在未闭环 commitments / TODO
  - 用户显式请求“解释/步骤/输出结果”
- 连续 N 次 LIGHT/REACT：强制至少一次 NORMAL（防体验断裂）
- Budget 绑定：投入档位决定 recall topK / summaries / cards 注入上限

### 3.5 Proactive（主动打扰）
- 频率上限：例如 24h 内 ≤ 1 次（可按 relationship tier 调整）
- 必须满足：明确动机（intent）+ 主题（topic/entity/goal）+ 克制（budget）  
- 禁止：随机、无主题、重复

### 3.6 Group Chat（群聊）
- 仲裁必须确定性（同输入同输出）：`score = w_addr*addressing + w_rel*relationship + w_int*interest - w_cd*cooldown - w_spam*recent_speaks`
- addressing 权重必须碾压其他权重（避免“兴趣更大就抢答”）
- 5 分钟窗口发言上限：≤ 1 条（建议值）

---

## 4. Interests / Attention / Engagement：必须补齐的“确定性更新规则”

### 4.1 建议的 reward 信号（先规则后 LLM）
正向（+）：
- 用户显式正反馈（“有用/喜欢/继续/对”）
- 用户追问深挖（同主题连续追问）
- commitment 完成（任务闭环）
负向（-）：
- 用户显式否定/拒绝
- 频繁切话题（短时间多 topic switch）
- 用户打断（“别说了/算了”）

### 4.2 更新与衰减
- 单次更新步长：`|Δinterest| ≤ 0.05`（示例）
- 学习门槛：同主题出现 ≥ 3 次才进入“稳定兴趣”（避免一句话就变爱好）
- 衰减：无触发时按时间衰减（半衰期可由 trait 派生）

### 4.3 LLM 的角色
- LLM 只能输出 `interest_delta_proposal`（带 reason + evidence）
- gate 根据上述规则决定 apply 或 reject

---

## 5. compatMode 兑现：旧常数清单 + 推断方法（必须写清）
> 目标：legacy/hybrid 下**行为稳定**，不因升级“换人”。

### 5.1 旧常数清单（建议最少包含）
- reply_len_avg / reply_len_std
- emoji_rate / emotion_exposure_rate
- recall_topK_baseline
- proactive_rate（几乎为 0）
- mood_decay_rate（或等价投影参数）
- “认真程度”基线（例如默认 NORMAL）

### 5.2 推断方法（建议）
- 从 `life.log.jsonl` 最近 200 turns 统计基线
- 写入 `compat_calibration.json` 并 **lock**
- hybrid 输出需校准到旧基线（允许轻微误差）

---

## 6. 可量化验收指标（建议写入 DoD + CI 回归）
- Reply Length Distribution（LIGHT/NORMAL/DEEP 比例）
- Emoji Exposure Rate（每 20 轮上限）
- Entity Linking Hit Rate（alias → entityId 命中率）
- Relationship Card Relevance（注入卡片必须与本轮 entity/topic 命中）
- Delta Gate Reject Rate（过高=LLM乱提案；过低=门禁无效）
- Behavior Parity（legacy vs hybrid 在任务型问答差异 ≤ 阈值）

---

## 7. 与现有 Roadmap 的前置依赖
- **强依赖**：`P0-13` persona 写锁接入所有写路径（State Layer 会显著增加写频率）
- **强烈建议并行**：`P1-1` persona lint（Schema/字段治理必需）
- **建议**：`P1-0` driver 抽象（更易测、更易做回归与仿真）
