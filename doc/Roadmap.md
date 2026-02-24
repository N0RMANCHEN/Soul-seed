# Soulseed Roadmap (Execution-Oriented, Reindexed, Archive-Complete)

## 文档规则总纲
- 更新日期：2026-02-24
- 核验范围：`/Users/hirohi/Soul-seed` + `/Users/hirohi/Downloads/Soul-seed-2.24.03/doc/`
- 状态定义：`todo` / `in_progress` / `blocked` / `done` / `deferred` / `historical`

### 1) Phase 展示与优先级规则
- Phase 可无限扩展：`Phase F -> G -> H -> I -> J ...`。
- 当前执行优先级（跨 Phase）：`Phase G > Phase H > Phase I`。
- 同一时刻默认只允许一个 Phase 进入主开发态，后续 Phase 以前序 Phase 的出口条件为门禁。

### 2) 任务编号规则
- 本次执行一次性重编号（2026-02-24），用于清理历史混编编号。
- 重编号后规则生效：任务 ID 冻结，不再改号；新增任务仅追加编号。
- 格式：`{Phase}/P{priority}-{seq}`，例如 `F/P0-0`。
- 排序规则：`P0（阻塞） -> P1（核心） -> P2（优化）`，每档内部按 `seq` 升序。

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

## 当前执行总览（重排后）
- `in_progress`：`none`
- `blocked`：`none`
- `todo`：其余 active 任务

## 分工总览（双人并行）

### Phase G 分工

| Person A（MindModel + 记忆） | Person B（路由 + 安全 + 工具） |
|---|---|
| G/P0-3 回忆动态调度 | G/P0-5 工具调用自然化 |
| G/P0-4 Proactive 主动系统 | G/P0-6 四层语义路由门禁 |
| G/P1-0 群聊参与控制（← G/P0-4） | G/P0-7 业务 regex 清零（← G/P0-6） |
| G/P1-1 开场/结束语短语库 | G/P0-8 安全 fallback 收敛（← G/P0-6） |

- 同步点：无（全部从"控制面稳定"独立展开）
- A 关键链：`G/P0-4 → G/P1-0`；B 关键链：`G/P0-6 → G/P0-7 / G/P0-8`
- 任务数：A=4 | B=4 | 差距 0%

### Phase H 分工

| Person A（状态 + 记忆 + 情绪） | Person B（兼容 + Schema + 治理） |
|---|---|
| **H/P0-0 AB共建** | **H/P0-0 AB共建** |
| H/P0-1 Invariant Table | H/P0-2 Compat & Migration |
| H/P1-0 Values / Personality | H/P0-3 compat 常数清单（← H/P0-2） |
| H/P1-1 Goals / Beliefs | H/P0-4 Genome & Epigenetics（← H/P0-2 + H/P0-3） |
| H/P1-2 记忆遗忘与压缩 | H/P1-4 Persona Package（← H/P0-2） |
| H/P1-3 Relationship state（← H/P1-2） | H/P1-7 兼容说明落地校核（← H/P0-2） |
| H/P1-5 Affect 三层状态机 ⚠sync | H/P1-10 治理验收回归集 ⚠sync |
| H/P1-6 人类化不完美 DoD | H/P1-14 Epigenetics 暗门防护（← H/P0-4） |
| H/P1-8 关系连续性回归（← H/P1-3） | H/P1-15 Genome trait 闸门（← H/P0-4） |
| H/P1-9 情绪厚度回归（← H/P1-5） | H/P1-16 LLM 直写封禁 |
| H/P1-12 风险护栏：过度数值化 | H/P1-17 附录示例契约化（← H/P1-4） |
| H/P1-13 风险护栏：Relationship 噪音（← H/P1-3） | H/P1-18 Spec 附录A Schema（← H/P1-17） |
| | H/P1-19 Spec 附录B 接入点核查 |

- ⚠ 同步点 1（B→A）：A 的 `H/P1-5` 需等 B 完成 `H/P0-4`
- ⚠ 同步点 2（A→B）：B 的 `H/P1-10` 需等 A 完成 `H/P0-1`
- 跨 Phase 延迟：`H/P1-11`（可观测性回归）依赖 `I/P0-2`，归 B，延迟到 Phase I 启动后执行
- 任务数：A=11 + 共建1 | B=12 + 共建1 + 延迟1 | 差距 ~8%

### Phase I 分工

| Person A | Person B |
|---|---|
| I/P0-2 性能与可观测 | I/P0-0 开源合规 |
| I/P2-0 Inheritance（可选） | I/P0-3 OK 定义产品化门禁 |
| | H/P1-11 可观测性回归（解锁于 A 的 I/P0-2） |

- ⚠ 同步点（A→B）：B 的 `H/P1-11` 需等 A 完成 `I/P0-2`
- 任务数：A=2 | B=3 | I/P2-0 为 Could 级可选

## Phase G（第一优先级：会话控制与交互闭环）

### G/P0-3 回忆动态调度（Task-aware Recall Budget）
- 原编号：`G/P1-9`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/3` `spec/11` `extra/34`
- 实现方式：按任务类型动态分配 recall budget，相关优先，长尾抑制。
- 测试/DoD：token 成本下降且相关性不降。
- 依赖：`Phase G 控制面稳定`；回滚：固定 recall budget。

### G/P0-4 MindModel H3：Proactive 主动系统
- 原编号：`G/P1-6`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H3` `spec/19`
- 实现方式：主动意图规划器（关心/跟进/提醒/分享）+ 频率门禁 + 关系约束。
- 测试/DoD：触发频率与主题相关率达标。
- 依赖：`Phase G 控制面稳定`；回滚：降级为被动。

### G/P0-5 工具调用自然化与意图确认闭环
- 原编号：`G/P1-10`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/16` `spec/18`
- 实现方式：工具前确认、工具后人格化解释、失败重试建议闭环。
- 测试/DoD：工具调用全链路可理解。
- 依赖：`Phase G 控制面稳定`；回滚：关闭确认层。

### G/P0-6 四层语义路由门禁落地（L1/L2/L3/L4）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`Product-Standards/3.6` `Quality-Evaluation/Lx`
- 实现方式：统一路由层级输出（L1/L2/L3/L4）与原因字段；将路由层级纳入 `decision_trace` 与质量报表。
- 测试/DoD：业务链路可观测路由层级；`BusinessPathRegexRate == 0`。
- 依赖：`Phase G 控制面稳定`；回滚：先监控后拦截（保留告警）。

### G/P0-7 业务 regex 主路径清零（会话/召回/代词）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`Product-Standards/3.6` `archive/18.3`
- 实现方式：将 `conversation/recall/pronoun` 的业务判定迁移到向量/潜向量主路径，regex 仅保留安全/兼容兜底。
- 测试/DoD：核心模块不再以 regex 作为第一判定分支；语义回归通过。
- 依赖：`G/P0-6`；回滚：按模块 feature flag 退回旧路径。

### G/P0-8 安全 fallback 单入口收敛
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`Product-Standards/3.6` `archive/20.5`
- 实现方式：收敛重复安全 fallback 逻辑到单入口（统一评估、统一 trace、统一审计字段）。
- 测试/DoD：fallback 逻辑单源且可追踪；安全回归不退化。
- 依赖：`G/P0-6`；回滚：保留 legacy 兼容代理层。

### G/P0-9 系统提示泄漏治理（Prompt Leak Guard）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`user-feedback/2026-02-24` `spec/18` `Quality-Evaluation/L4RegexFallbackRate`
- 负责人：`B`
- 域标签：`control-plane`
- 同步点：`等待 G/P0-8 统一 fallback 入口`
- 阻塞级别：`hard`
- 实现方式：新增系统语句泄漏检测（如“系统提示/执行状态/观察你”等元叙事措辞）；在回复提交前增加人格层 rewrite/reject gate；记录结构化 trace（`leak_type` `source_stage` `rewrite_applied`）。
- 测试/DoD：系统提示泄漏样本阻断率 100%；正常对话误杀率受控（<=1%）。
- 依赖：`G/P0-6` `G/P0-8`；回滚：降级为只告警不拦截；回滚归属：`B`。

### G/P0-10 网络异常下人格回路保真（Degraded Persona Path Integrity）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`user-feedback/2026-02-24` `spec/18` `spec/19`
- 负责人：`AB(A主/B辅)`
- 域标签：`shared`
- 同步点：`A 等待 B 完成 G/P0-9 泄漏门禁；B 等待 A 完成语气策略基线`
- 阻塞级别：`hard`
- 实现方式：将中间主动询问、开场白、结束语统一接入人格主回路（同一 voice policy/relationship state/context gate）；网络异常与 fallback 场景禁用固定模板直出，改为 `persona-aware degraded composer`。
- 测试/DoD：异常注入（timeout/429/5xx/model_not_exist）下人格一致性评分不低于阈值；开场/主动/结束语在正常与异常路径风格偏差受控。
- 依赖：`G/P0-4` `G/P0-8` `H/P0-2`；回滚：feature flag 退回当前 fallback 路径；回滚归属：`AB(A主)`。

### G/P0-11 会话阶段时延剖析与体验预算门禁（Latency Mix Profiler）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`user-feedback/2026-02-24` `spec/24` `extra/48` `I/P0-2`
- 负责人：`A`
- 域标签：`state-core`
- 同步点：`等待 I/P0-2 指标口径冻结后收敛门禁阈值`
- 阻塞级别：`soft`
- 实现方式：按回合拆分 `routing/recall/planning/llm_primary/llm_meta/guard/rewrite/emit` 阶段计时；输出时间占比、平均时长、p50/p95、异常占比；接入评估系统生成“简化裁切收益 vs 质量损失”建议。
- 测试/DoD：CI 自动产出阶段占比报告；关键阶段时延越界可触发门禁 fail；可定位导致“卡顿”的主耗时段与工作流程占比。
- 依赖：`G/P0-6` `I/P0-2`；回滚：仅保留观测采样，不启用硬门禁；回滚归属：`A`。

### G/P1-0 MindModel H4：AI 群聊参与控制
- 原编号：`G/P1-7`
- 状态：`todo`，必要性：`Should`
- 来源需求：`phases/H4` `spec/20`
- 实现方式：参与门槛 + 仲裁器，限制抢答/连发。
- 测试/DoD：打断率、刷屏率达标。
- 依赖：`G/P0-4`；回滚：回退轮询仲裁。

### G/P1-1 开场/结束语短语库（voice_profile 扩展）
- 原编号：`F/P1-1`
- 状态：`todo`，必要性：`Should`
- 来源需求：`spec/18` `spec/27`
- 实现方式：扩展 `greeting/farewell` 池，按关系/情绪/场景抽样。
- 测试/DoD：语料去重与人格一致性评测通过。
- 依赖：`Phase G 控制面稳定`；回滚：回到固定模板。

## Phase H（第二优先级：状态闭环与兼容兑现）

### H/P0-0 MindModel H5：State Delta Pipeline
- 原编号：`G/P2-3`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H5` `spec/21` `extra/40`
- 实现方式：`proposal -> gates -> deterministic apply`，禁止 LLM 直写状态。
- 测试/DoD：delta 可审计、可回放、可拒绝。
- 依赖：`Phase G` 出口条件满足；回滚：保留旧路径并行。

### H/P0-1 Invariant Table 回归落地
- 原编号：`G/P2-6`
- 状态：`todo`，必要性：`Must`
- 来源需求：`engineering/3,6` `spec/24` `extra/48`
- 实现方式：固化 Relationship/Beliefs/Mood/Engagement/Proactive/Group Chat 不变量阈值并纳入 CI。
- 测试/DoD：阈值越界直接 fail。
- 依赖：`H/P0-0`；回滚：阈值可配置回退。

### H/P0-2 MindModel H7：Compatibility & Migration
- 原编号：`G/P2-5`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H7` `spec/23` `extra/46`
- 实现方式：compat 三档、推断+锁定+校准流程、会话控制兼容桥接。
- 测试/DoD：存量 persona 漂移在阈值内，无“换人”。
- 依赖：`H/P0-0`；回滚：可回滚迁移前快照。

### H/P0-3 compat 常数清单与校准文件
- 原编号：`G/P2-7`
- 状态：`todo`，必要性：`Must`
- 来源需求：`engineering/5` `spec/23`
- 实现方式：落地 compat 常数与校准配置，版本化管理。
- 测试/DoD：迁移样本通过，缺项触发 lint fail。
- 依赖：`H/P0-2`；回滚：回退上一个校准版本。

### H/P0-4 MindModel H6：Genome & Epigenetics MVP
- 原编号：`G/P2-4`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H6` `spec/15` `extra/43`
- 实现方式：固定 6 trait，建立 Genome->Budget 映射与慢漂移规则。
- 测试/DoD：差异可解释，随机可复现。
- 依赖：`H/P0-2` `H/P0-3`；回滚：降级静态 trait。

### H/P1-0 Values / Personality 可运行约束系统
- 原编号：`G/P2-8`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/37`
- 实现方式：将 values 条款化接 gate，personality 慢漂移。
- 测试/DoD：越界回复可拦截并给出原因。
- 依赖：`H/P0-0`；回滚：先告警后拦截。

### H/P1-1 Goals / Beliefs 状态模块
- 原编号：`G/P2-9`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/38` `spec/15`
- 实现方式：新增 goals/beliefs 状态与慢变量更新规则。
- 测试/DoD：跨会话连续性达标。
- 依赖：`H/P0-0`；回滚：只读展示。

### H/P1-2 记忆遗忘与压缩整合管线
- 原编号：`G/P2-10`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/39` `spec/3`
- 实现方式：衰减+干扰+压缩并行，不修改原始 `life.log`。
- 测试/DoD：容量受控且关键召回达标。
- 依赖：`H/P0-0`；回滚：关闭压缩。

### H/P1-3 Relationship first-class state
- 原编号：`G/P2-11`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/35`
- 实现方式：关系状态外置，支持冷却/遗忘曲线与事件绑定。
- 测试/DoD：关系变化可追溯、可解释。
- 依赖：`H/P0-0` `H/P1-2`；回滚：回退 memory-only。

### H/P1-4 Persona Package v0.4 布局与回滚
- 原编号：`G/P2-12`
- 状态：`todo`，必要性：`Should`
- 来源需求：`spec/22` `extra/45` `extra/52`
- 实现方式：规范包布局、元数据、迁移快照、回滚入口与签名。
- 测试/DoD：跨版本加载稳定，可迁移可回滚。
- 依赖：`F/P0-4` `H/P0-2`；回滚：保留旧布局读取。

### H/P1-5 Affect 情绪层分离与三层状态机
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/15(Affect)` `engineering/3.3` `archive/6.情绪层(Affect)`
- 实现方式：将情绪系统拆分为 `mood baseline（慢）/emotion episodes（快）/temperament influence（特质）` 三层；与响应渲染层解耦，禁止“仅靠语气模板伪装情绪”。
- 测试/DoD：情绪更新有证据链；快慢变量更新速率分离；情绪层可回放可审计。
- 依赖：`H/P0-0` `H/P0-1` `H/P0-4`；回滚：切回旧 mood 单层模式。

### H/P1-6 人类化不完美 DoD 套件
- 原编号：`新增（A12）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/12.人类化不完美`
- 实现方式：把“非全知、非稳定满分、允许不完美”转换成可测规则，加入输出策略与回归断言。
- 测试/DoD：禁止持续“完美答复”模式，允许合理不确定表达，且不降低安全合规。
- 依赖：`G/P0-6` `H/P0-1`；回滚：仅保留监控不做硬门禁。

### H/P1-7 与现有架构兼容说明落地校核
- 原编号：`新增（A17）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/17.兼容性说明`
- 实现方式：把 High-Level 兼容说明拆成工程检查单（入口、存储、召回、回滚）并纳入 CI 文档校核。
- 测试/DoD：兼容检查单全通过，且每项有证据路径。
- 依赖：`F/P0-3` `H/P0-2`；回滚：退回人工审查流程。

### H/P1-8 关系连续性验收回归集
- 原编号：`新增（A18.1）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.1`
- 实现方式：建设关系连续性回归场景与评分脚本，验证长期互动不“失忆换人”。
- 测试/DoD：关系连续性指标达标并稳定。
- 依赖：`H/P1-3`；回滚：保留人工抽检。

### H/P1-9 情绪厚度验收回归集
- 原编号：`新增（A18.2）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.2`
- 实现方式：建立情绪厚度回归维度（层次、触发、恢复、可解释性）与评分基线。
- 测试/DoD：情绪厚度指标达标，无单层扁平情绪。
- 依赖：`H/P1-5`；回滚：降级为观测指标。

### H/P1-10 一致性与治理验收回归集
- 原编号：`新增（A18.3）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.3`
- 实现方式：统一治理项（门禁、预算、兼容、回滚）验收套件。
- 测试/DoD：治理项全部可自动检查且无阻塞缺口。
- 依赖：`H/P0-1` `H/P0-2` `H/P0-3`；回滚：拆分为分模块校验。

### H/P1-11 可观测性验收回归集
- 原编号：`新增（A18.4）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.4`
- 实现方式：定义状态变化、门禁决策、异常路径的最小观测事件集。
- 测试/DoD：关键链路可追踪，故障可定位。
- 依赖：`I/P0-2`；回滚：保留核心事件集。

### H/P1-12 风险护栏：过度数值化（A20.1）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.1`
- 实现方式：限制面板化参数外显，要求回复保持自然语言主导。
- 测试/DoD：数值化过载率低于阈值。
- 依赖：`G/P0-6`；回滚：以告警替代拦截。

### H/P1-13 风险护栏：Relationship 注入噪音（A20.2）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.2`
- 实现方式：控制关系卡注入频次与权重，加入噪音抑制门禁。
- 测试/DoD：噪音注入率和无关注入率达标。
- 依赖：`H/P1-3`；回滚：放宽阈值。

### H/P1-14 风险护栏：Epigenetics 暗门防护（A20.3）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.3`
- 实现方式：所有 Epigenetics 更新必须带证据与审计记录，禁止静默改人格。
- 测试/DoD：无证据更新为 0。
- 依赖：`H/P0-4`；回滚：仅告警模式。

### H/P1-15 风险护栏：Genome trait 扩张闸门（A20.4）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.4`
- 实现方式：MVP 固守 6 trait，新增 trait 需评审开关与回归证明。
- 测试/DoD：未审批 trait 不可上线。
- 依赖：`H/P0-4`；回滚：临时冻结 trait 扩展。

### H/P1-16 风险护栏：LLM 直写状态封禁（A20.5）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.5` `spec/12`
- 实现方式：仅允许通过 `proposal -> gates -> apply` 写状态，封禁直写通道。
- 测试/DoD：直写尝试全部失败且可审计。
- 依赖：`H/P0-0`；回滚：白名单临时放行。

### H/P1-17 附录示例结构契约化（A52）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/附录示例结构` `spec/28`
- 实现方式：将附录示例结构转换为 schema 契约与版本校验规则。
- 测试/DoD：样例结构全部通过 schema 校验。
- 依赖：`F/P0-4` `H/P1-4`；回滚：允许 legacy schema 兼容读取。

### H/P1-18 Spec 附录A（A1~A4）Schema 契约化
- 原编号：`新增（spec/28）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/28`（`engagement_plan.json` `interests.json` `topic_state.json` `proactive_plan.json`）
- 实现方式：为 A1~A4 建立版本化 schema、兼容校验与迁移策略；在 lint/compile 阶段执行结构验证。
- 测试/DoD：四类结构在样例与真实数据上校验通过；版本升级可回滚。
- 依赖：`F/P0-2` `F/P0-4` `H/P1-17`；回滚：保留 legacy schema 读取适配层。

### H/P1-19 Spec 附录B 最小侵入接入点核查
- 原编号：`新增（spec/29）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/29` `archive/17`
- 实现方式：把附录B接入点列表转为工程检查单，逐项绑定代码锚点与回归用例，防止“接错层/侵入过深”。
- 测试/DoD：接入点检查单全通过，且每项都有代码证据与回归案例。
- 依赖：`F/P0-3` `G/P0-6` `H/P0-0`；回滚：回退到人工架构评审。

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
- 依赖：`H/P1-8` `H/P1-9` `H/P1-10` `H/P1-11`；回滚：降级为发布告警。

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

## 统一执行顺序（工程落地顺序）
1. `Phase G`：`G/P0-3 -> G/P0-4 -> G/P0-5 -> G/P0-6 -> G/P0-7 -> G/P0-8 -> G/P0-9 -> G/P0-10 -> G/P0-11 -> G/P1-0 -> G/P1-1`
2. `Phase H`：`H/P0-0 -> H/P0-1 -> H/P0-2 -> H/P0-3 -> H/P0-4 -> H/P1-0 -> H/P1-1 -> H/P1-2 -> H/P1-3 -> H/P1-4 -> H/P1-5 -> H/P1-6 -> H/P1-7 -> H/P1-8 -> H/P1-9 -> H/P1-10 -> H/P1-11 -> H/P1-12 -> H/P1-13 -> H/P1-14 -> H/P1-15 -> H/P1-16 -> H/P1-17 -> H/P1-18 -> H/P1-19`
3. `Phase I`：`I/P0-0 -> I/P0-2 -> I/P0-3 -> I/P2-0 -> I/P2-1`

## 覆盖性与漏项结论
- `2.24.03` 的 `00/01/02/03/04` 已完成覆盖核对并映射到任务；`A-APP-CHANGELOG` 以 `historical` 审计保留。
- 本次按你的要求把漏项全部独立任务化，`missing=0`、`partial=0`（对 `2.24.03` 五个文件范围）。
