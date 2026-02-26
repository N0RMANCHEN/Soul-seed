# Soulseed Roadmap (Execution-Oriented)

- 更新日期：2026-02-26
- 状态定义：`todo` / `in_progress` / `blocked` / `done` / `deferred` / `historical`

## 1) 文档职责与边界（强制）

1. `doc/Roadmap.md` 只维护当前和未来的 active 工作，不写已完成任务细节。
2. `doc/plans/*.md` 只描述 scope、依赖链、入口/出口条件，不做逐任务进度快照。
3. `done` 任务必须从 Roadmap active 列表移除；历史细节写入 `doc/plans/archive/*.md`。
4. 完成记录以 Git 历史为准；archive 文档用于检索与追溯，不替代提交历史。

## 2) Plan 生命周期规则（强制）

1. 新建计划时，文件放在 `doc/plans/`，并在 `doc/plans/README.md` 的 Active Index 登记。
2. 计划执行期间，进度只在 `doc/Roadmap.md` 更新；计划文件仅在 scope 变更时更新。
3. 计划完成后，必须移动到 `doc/plans/archive/`（或新增等价归档文件）。
4. 归档后，必须同时更新：
   - `doc/plans/archive/README.md` 的 Archive Index
   - `doc/Roadmap.md` 的完成摘要索引（仅一行链接）
5. 归档完成后，Roadmap 中对应条目只保留 active 相关依赖信息，不保留执行过程细节。

## 3) Phase 与编号规则（强制）

1. 当前执行优先级：`Phase J > Phase M > Phase K > Phase I > Phase L`。
2. 任务 ID 冻结，不重排；新增任务仅允许追加编号。
3. 编号格式：`{Phase}/P{priority}-{seq}`。
4. 每次进入新 Phase 前必须先完成分工规划（A/B 归属、依赖链、同步点、回滚归属）。

## 4) 当前执行总览

- `blocked`: `none`
- `in_progress`: `none`
- `todo`: `Phase M`, `Phase K`, `Phase I`, `Phase L`
- `historical`:
  - Phase H（Ha/Hb/Hc）完成记录：`doc/plans/archive/H-State-Closure-Plan.md` 及同目录 H*/Ha*/Hb*/Hc* 子计划。
  - Architecture Governance 12 项完成归档：`doc/plans/archive/AG-2026-02-Completion.md`。
  - Phase J P0 交互闭环归档：`doc/plans/archive/J-2026-02-Interaction-Loop-Plan.md`。
  - Phase J P1 交互闭环完成（2026-02-26）：预算门禁、话题调度、Phase J 评测赛道 PR 阻断上线。
  - Core 分层重构（2026-02-26）：`packages/core/src` 根层收敛为 `index.ts`/`types.ts`，其余迁入 `runtime|memory|persona|state|guards|governance|capabilities|proactive`。

## 5) Active Roadmap

### Phase J（交互体验闭环）

目标：补齐兴趣/注意力/主动交互闭环，形成非轮询式会话体验。

执行拆解：
1. J1（调度）：建立 engagement 预算、优先级、冷却与抢占规则。
2. J2（路由）：多话题上下文分配与回收，降低话题漂移与抢答。
3. J3（评测）：形成可重放体验评测并纳入质量门禁。

阶段出口标准（DoD）：
- J1 出口：预算消耗与触发原因在 DecisionTrace 可见，空转与过触发受控。
- J2 出口：多话题切换稳定，跨话题串线率下降且可回放定位。
- J3 出口：评测脚本可复现，关键体验指标纳入 `doc/Quality-Evaluation.md`。

### J/P0-2 非轮询会话循环（已归档）
- 状态：`historical`
- 索引：`doc/plans/archive/J-2026-02-Interaction-Loop-Plan.md`（含 `J/P0-0`、`J/P0-1`、`J/P0-2`）

### J/P1-0 Engagement Plan + 预算门禁
- 状态：`done`
- 依赖：`J/P0-2`
- 交付：兴趣/注意力预算模型、触发阈值、冷却窗口、抢占策略
- 当前实现：新增 `phaseJMode` 与 `engagementTrace`（triggerType/triggerReason/budgetBefore/budgetAfter/cooldownApplied/recordOnly），并支持 `SOULSEED_PHASE_J_ENABLE`、`SOULSEED_PHASE_J_RECORD_ONLY` 灰度策略
- 门禁：连续 30 轮内主动触发频率与预算偏差保持在预设阈值内

### J/P1-1 多话题上下文调度器
- 状态：`done`
- 依赖：`J/P1-0`
- 交付：topic slot 分配、优先级队列、话题回收与跨话题桥接规则
- 当前实现：已接入 `topic_state` 到会话控制，输出候选话题优先队列、`queueSnapshot`、饥饿提升标记、`recycleAction` 与 `bridgeFromTopic` 观测字段；支持 `SOULSEED_PHASE_J_TOPIC_SCHEDULER` 开关
- 门禁：不得出现高优先级话题长期饥饿；上下文命中率可观测

### J/P1-2 交互体验评测赛道
- 状态：`done`
- 依赖：`J/P1-0`, `J/P1-1`
- 交付：主动交互体验基线、AB 对照脚本、失败样本回放模板
- 当前实现：`scripts/eval_phase_j.mjs` + `datasets/quality/phase_j_engagement_cases.json` 已接入 `eval_all.sh` 与 `verify.sh` 门禁链路；`2026-02-26` 本地 strict 评测通过（ReplayPassRate=1, TopicHitRateB=1, Delta=0.5）
- 门禁：评测结果可复现并已进入 PR 阶段阻断门禁

### Phase M（Bio-Inspired Human Dynamics）

目标：引入“基因/表观-神经调制-主观感受整合”的人类式更新动力学，修复“参数在动但人格不活”的体验断层；在不破坏身份一致性与边界规则的前提下，提升连续人格感与向量主链路利用率。

执行拆解：
1. M0（协议层）：统一慢/中/快变量协议与事件审计字段，建立可回放输入输出面。
2. M1（动力层）：建立神经/激素代理和感受整合，并接入主链路与阶段可塑性。
3. M2（收口层）：完成强刺激跃迁、genome/epigenetics 固化、评测与发布回滚。

阶段出口标准（DoD）：
- M0 出口：类型定义稳定、兼容开关生效、回放脚本可重放同一输入得到一致轨迹。
- M1 出口：向量参与度可观测、人格变化连续且无高频振荡、证据链完整。
- M2 出口：评测指标达标并接入 CI，发布检查单与回滚脚本演练通过。

### M/P0-0 生物机制映射与状态协议（文档与类型）
- 状态：`todo`
- 交付：统一变量分层、更新节律、证据字段、审计字段定义（与 `doc/Product-Standards.md` 对齐）
- 门禁：不得引入破坏现有 persona 加载兼容的 schema 变更

### M/P0-1 神经/激素代理变量模型（中度拟真）
- 状态：`todo`
- 依赖：`M/P0-0`
- 交付：dopamine/serotonin/norepinephrine/oxytocin/cortisol 代理变量与更新规则，含饱和/恢复/衰减参数
- 门禁：每轮计算可解释、可回放，不允许黑盒直接改写最终人格字段

### M/P0-2 事件证据与可回放轨迹（Trace Contract）
- 状态：`todo`
- 依赖：`M/P0-1`
- 交付：定义事件哈希、证据强度、冲突来源、回放步骤索引字段
- 门禁：任何人格字段变动都必须能追溯到至少一个事件证据

### M/P0-3 主观感受整合层（Feeling Integration）
- 状态：`todo`
- 依赖：`M/P0-1`, `M/P0-2`
- 交付：把代理变量映射为连续 feeling state（coherence/vitality/security/tension/reflectiveLoad）
- 门禁：L2 主路径可观测，不能退化为 regex 规则主判定

### M/P0-4 向量主链路接入（voice/belief/cross-influence）
- 状态：`todo`
- 依赖：`M/P0-0`, `M/P0-3`
- 交付：`voiceLatent/beliefLatent/latent_cross_influence` 真正进入 turn commit 主链路
- 门禁：DecisionTrace 必须记录“本轮向量参与度与触发原因”

### M/P1-0 阶段性可塑性引擎（formative/stabilizing/stable）
- 状态：`todo`
- 依赖：`M/P0-3`, `M/P0-4`
- 交付：按人格阶段动态调整更新灵敏度（早期更可塑，稳定期更稳）
- 门禁：短窗内不得出现风格高频翻转（anti-oscillation）

### M/P1-1 强刺激跃迁与证据门禁
- 状态：`todo`
- 依赖：`M/P1-0`
- 交付：支持重大事件触发显著变化（不设固定硬上限），同时落地证据链门禁
- 门禁：identity continuity / constitution boundary 必须硬约束

### M/P1-2 genome/epigenetics 演化固化
- 状态：`todo`
- 依赖：`M/P1-1`
- 交付：epigenetics 连续漂移 + genome 条件固化 + mutation log 完整审计
- 门禁：保留 `locked` 冻结与回滚能力；兼容模式不得“换人感”

### M/P1-3 抗振荡与恢复窗口控制
- 状态：`todo`
- 依赖：`M/P1-0`, `M/P1-1`
- 交付：短窗振荡抑制、异常恢复窗口、过冲保护参数
- 门禁：连续 20 轮不得出现角色语气/立场来回翻转

### M/P2-0 评测赛道（连续人格感优先）
- 状态：`todo`
- 依赖：`M/P1-2`, `M/P1-3`
- 交付：`HumanContinuityScore`、`LatentUtilizationRate`、`ShockTransitionCoherence` 指标
- 门禁：纳入 `doc/Quality-Evaluation.md` 与 CI/回放脚本

### M/P2-1 回放基线与对照样本
- 状态：`todo`
- 依赖：`M/P2-0`
- 交付：形成期/稳定期/强刺激三类样本集与回放报告模板
- 门禁：结果可复现、可比较、可追溯到事件哈希

### M/P2-2 发布门禁与回滚预案
- 状态：`todo`
- 依赖：`M/P2-1`
- 交付：一次切换发布检查单、降级条件、回滚脚本与审计要求
- 门禁：若连续性指标回退则自动进入回滚路径

### Phase K（多人格聊天系统）

目标：建立多 persona 会话编排、发言仲裁、上下文隔离和评测闭环。

执行拆解：
1. K0（会话层）：建立多人格图谱、注册和回合调度基线。
2. K1（治理层）：完成发言仲裁、上下文隔离、主动协同策略。
3. K2（产品层）：CLI 可用、评测闭环可跑、故障可回放。

阶段出口标准（DoD）：
- K0 出口：至少支持双人格稳定轮转，发言顺序可追踪可复放。
- K1 出口：私有记忆隔离有效，跨人格污染可检测且可阻断。
- K2 出口：CLI 命令可操作，评测覆盖核心多人格场景。

### K/P0-0 多人格会话图谱与注册表
- 状态：`todo`
- 交付：persona registry、会话拓扑、角色元数据约束
- 门禁：注册失败与冲突必须有明确错误码与恢复路径

### K/P0-1 多人格发言仲裁器（addressing 优先）
- 状态：`todo`
- 依赖：`K/P0-0`
- 交付：addressing 命中优先、冲突仲裁、静默角色唤醒机制
- 门禁：冲突时必须确定唯一发言者，且理由可追溯

### K/P0-2 回合调度与抢答抑制
- 状态：`todo`
- 依赖：`K/P0-1`
- 交付：round-robin + 优先级混合调度、抢答抑制与超时接管
- 门禁：不得出现同一 persona 连续霸占回合

### K/P1-0 上下文总线与私有记忆隔离
- 状态：`todo`
- 依赖：`K/P0-0`
- 交付：shared bus 与 private lane 分层、读写权限与泄漏审计
- 门禁：跨 persona 私有记忆泄漏率必须为 0（评测样本集）

### K/P1-1 多人格主动协同规划器
- 状态：`todo`
- 依赖：`K/P0-2`, `K/P1-0`
- 交付：协作任务分解、角色分工、互相引用与冲突降解策略
- 门禁：协同模式下总体回复时延不超过单人格基线阈值上限

### K/P1-2 CLI 多人格交互命令与会话视图
- 状态：`todo`
- 依赖：`K/P0-2`, `K/P1-0`
- 交付：会话内 persona 视图、发言来源标注、切换与静默控制命令
- 门禁：命令行为与输出标注一致，不得出现身份混淆

### K/P1-3 多人格评测赛道（AB 共建）
- 状态：`todo`
- 依赖：`K/P1-1`, `K/P1-2`
- 交付：多人格对话质量指标、隔离性指标、仲裁正确率指标
- 门禁：评测进入 `doc/Quality-Evaluation.md` 且可在 CI 复现

### Phase I（产品化收口）

目标：完成开源合规、可观测、产品化门禁与兼容收口。

执行拆解：
1. I0（底线）：合规、性能、可观测三项底线先闭合。
2. I1（门禁）：产品化 DoD 与回归机制固化为发布前置。
3. I2（兼容）：Inheritance/兼容策略在可回滚前提下上线。

阶段出口标准（DoD）：
- I0 出口：许可证、三方依赖、性能指标、观测指标都可审计。
- I1 出口：发布门禁脚本化且失败可阻断发布。
- I2 出口：兼容能力灰度可控，回滚路径经演练通过。

### I/P0-0 开源合规
- 状态：`todo`
- 交付：license 清单、第三方依赖归因、合规检查脚本
- 门禁：新增依赖必须通过合规扫描并记录版本来源

### I/P0-2 性能与可观测
- 状态：`todo`
- 交付：核心链路延迟/吞吐指标、关键事件 trace、异常分级告警
- 门禁：关键路径 P95 延迟与错误率达到产品阈值

### I/P0-3 OK 定义产品化门禁
- 状态：`todo`
- 依赖：`I/P0-0`, `I/P0-2`
- 交付：产品化发布清单、阻断条件、降级与回滚条件
- 门禁：无门禁豁免发布；例外必须记录审批链路

### I/P1-11 可观测性回归
- 状态：`todo`
- 依赖：`I/P0-2`
- 交付：回归仪表板、波动区间、异常聚类与根因模板
- 门禁：回归失败自动阻断发布流水线

### I/P2-0 Inheritance（可选）
- 状态：`todo`
- 依赖：`I/P0-3`
- 交付：继承策略配置、隔离与边界检查、灰度开关
- 门禁：关闭继承后行为回到基线，且无数据残留副作用

### I/P2-1 兼容收口（可选）
- 状态：`todo`
- 依赖：`I/P2-0`
- 交付：兼容模式矩阵、迁移指南、失败回滚手册
- 门禁：兼容矩阵覆盖主流使用路径并通过回放验证

### Phase L（输入流式化：增量理解 + 分段提交）

目标：在不破坏现有治理与主链路稳定性的前提下，建立 CLI 文本输入侧增量处理能力，实现“边输入边理解、分段提交后正式回合处理”。

执行拆解：
1. L0（输入层）：输入事件抽象、分段提交、正式回合桥接打通。
2. L1（体验层）：增量理解可视化、纠错提示、开销门禁稳定。
3. L2（评测层）：形成可复现输入流式化评测与上线标准。

阶段出口标准（DoD）：
- L0 出口：输入事件到正式回合链路稳定且可追踪。
- L1 出口：等待时间与误解率在预算内，用户可见纠偏反馈可用。
- L2 出口：评测脚本和回放样本进入 CI，失败可自动阻断。

### L/P0-0 输入事件层抽象（CLI）
- 状态：`todo`
- 交付：按键/片段/提交事件模型、会话内时序标记、取消语义
- 门禁：事件顺序一致性可验证，断流可恢复

### L/P0-1 分段提交引擎
- 状态：`todo`
- 依赖：`L/P0-0`
- 交付：片段边界识别、节流与去抖、提交合并策略
- 门禁：误切段率与重复提交率在阈值内

### L/P0-2 增量理解（轻量层）
- 状态：`todo`
- 依赖：`L/P0-1`
- 交付：轻量 intent/topic 增量推断，低成本上下文预热
- 门禁：不得提前写入长期记忆；仅允许临时态

### L/P0-3 正式回合桥接
- 状态：`todo`
- 依赖：`L/P0-2`
- 交付：分段缓存到正式 turn commit 的桥接协议
- 门禁：桥接后输出与非流式基线语义一致

### L/P1-0 交互可视化与修正提示
- 状态：`todo`
- 依赖：`L/P0-3`
- 交付：输入增量状态提示、误解纠正建议、分段确认反馈
- 门禁：提示信息不泄露系统内部规则与隐私上下文

### L/P1-1 开销预算与门禁
- 状态：`todo`
- 依赖：`L/P0-2`, `L/P1-0`
- 交付：token/CPU/延迟预算模型，过载降级与兜底策略
- 门禁：启用流式输入后总成本不得超过预算上限

### L/P1-2 评测赛道
- 状态：`todo`
- 依赖：`L/P1-1`
- 交付：等待时延、误解率、修正成功率、成本曲线四类指标
- 门禁：纳入 `doc/Quality-Evaluation.md` 并可回放复现

## 6) 文档联动清单（每次变更必查）

- `README.md`
- `AGENT.md`
- `contributing_ai.md`
- `doc/Product-Standards.md`
- `doc/Quality-Evaluation.md`
- `doc/Roadmap.md`
- 相关 `doc/plans/*` 与 `doc/plans/archive/*`

## 7) 治理锚点（路径引用）

- direct-write gate：`scripts/check_direct_writes.mjs`
- architecture governance gate：`scripts/arch_governance_check.mjs`
- 单文件体量重点监控：`packages/cli/src/index.ts`
