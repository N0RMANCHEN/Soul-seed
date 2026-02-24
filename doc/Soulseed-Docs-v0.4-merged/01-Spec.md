# Soulseed MindModel Spec (v0.4) — MERGED
> 合并日期：2026-02-24  
> 说明：本文件由多份拆分文档合并而成；为保证信息不丢失，保留每个源文件的完整内容，并在每段前标注原始路径。

---


---

## SOURCE: `spec/10-0._现状与问题(从产品表现反推架构缺口).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/11-1._目标与非目标(像人而不是像神).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/12-2._设计铁律(成败开关).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/13-3._三种信息裁切(你要求必须考虑的三视角).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/14-4._总体分层架构(在现有_Soulseed_基础上加层不推翻).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/15-5._7块心智模型(State_Layer)与三层变化机制(Genome_-_Epigenetics_-_State).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/16-6._会话控制面(Conversation_Control_Plane).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/17-7._Interests(兴趣系统)如何驱动_Attention_-_Engagement并且可培养可演进.md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/18-8._被动回复-从每条都认真回升级为像人一样选择投入.md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/19-9._主动打扰-从随机打扰升级为有动机有主题有克制.md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/20-10._AI_群聊-参与控制插话门槛与仲裁(避免机器人抢答).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/21-11._Gates_&_Budgets(门禁与预算).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/22-12._存储与_Persona_Package(新增文件必须可回滚可审计).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/23-13._兼容性与迁移(存量人格不能错乱-换人).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/24-14._评估与验收(DoD__回归集).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/25-15._推荐_Rollout_顺序(最小闭环__可控扩展).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/26-16._风险清单与对策.md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/27-17._OK_的定义.md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/28-附录_A-关键数据结构草案(JSON_Schema_级别).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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


---

## SOURCE: `spec/29-附录_B-与现有代码的最小侵入接入点清单(架构对齐).md`

# Soulseed 心智系统与会话控制面总体方案（整合优化版）
> 版本：v0.4（2026-02-24）  
> 目标：在**彻底尊重既有产品与代码结构**的前提下，把 v0.1（StateLayer-Optimization）+ v0.2（Genome-Compatibility MasterPlan）+ 新增的“会话注意力/兴趣/投入/群聊参与控制”整合为一套**可落地、可扩展、可兼容存量人格**的系统方案。  
> 关键词：7块心智模型｜State Layer｜Genome/天赋｜Epigenetics｜兼容性（compatMode）｜Gates & Budgets｜三种信息裁切｜Interest→Attention→Engagement｜被动回复｜主动打扰｜AI 群聊参与控制

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
