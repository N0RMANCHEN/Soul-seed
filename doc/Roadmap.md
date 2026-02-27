# Soulseed Roadmap (Execution-Oriented)

- 更新日期：2026-02-27
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

1. 当前执行优先级：`Phase L > Phase M > Phase N > Phase O`。
2. 编号格式：`{Phase}/P{priority}-{seq}`。
3. 新增任务仅允许追加编号，不得在同一 Phase 内重排既有编号。
4. 每次进入新 Phase 前必须先完成分工规划（A/B 归属、依赖链、同步点、回滚归属）。
5. 历史 `I/K` 任务不删除，通过本文件迁移映射追溯。

## 4) 当前执行总览

- `blocked`: `none`
- `in_progress`: `none`
- `todo`: `Phase L`, `Phase M`, `Phase N`, `Phase O`
- `historical`:
  - Phase H（Ha/Hb/Hc）完成记录：`doc/plans/archive/H-State-Closure-Plan.md` 及同目录 H*/Ha*/Hb*/Hc* 子计划。
  - Architecture Governance 12 项完成归档：`doc/plans/archive/AG-2026-02-Completion.md`。
  - Phase `J/P0-2` 交互闭环归档（含 `J/P0-0`、`J/P0-1`）：`doc/plans/archive/J-2026-02-Interaction-Loop-Plan.md`。
  - Phase `J/P1` 交互闭环归档：`doc/plans/archive/J-2026-02-Engagement-P1-Plan.md`。
  - Phase K 多人格聊天归档（`K/P0-0` ~ `K/P1-3`）：`doc/plans/archive/K-2026-02-Multi-Persona-Chat-Plan.md`。

## 5) Active Roadmap

### Phase L（Input Evolution First）

目标：先补输入侧短板（增量理解 + 分段提交 + 纠偏反馈），提升真实交互可用性，并为后续候选并行与仲裁提供稳定输入协议。

执行拆解：
1. L0（输入协议层）：输入事件模型、fragment/commit、正式回合桥接。
2. L1（体验与预算层）：增量理解可视化、误解修正、开销预算与降级策略。
3. L2（评测与门禁层）：输入赛道指标、回放复现、CI 阻断。

阶段出口标准（DoD）：
- L0 出口：流式输入与非流式基线语义一致，断流可恢复。
- L1 出口：等待时延/误解率/修正成功率达预算阈值。
- L2 出口：输入赛道指标接入 CI，失败可阻断。
- L3 出口：子进程/工具调用并发在预算内，压力场景无进程风暴。

### L/P0-0 输入事件层抽象（CLI）
- 状态：`todo`
- 交付：按键/片段/提交事件模型、时序标记、取消语义
- 门禁：事件顺序一致性可验证，断流可恢复

### L/P0-1 分段提交与桥接协议
- 状态：`todo`
- 依赖：`L/P0-0`
- 交付：片段边界识别、节流去抖、提交合并、正式回合桥接
- 门禁：桥接后输出与非流式基线语义一致

### L/P1-0 增量理解与交互纠偏
- 状态：`todo`
- 依赖：`L/P0-1`
- 交付：轻量 intent/topic 增量推断、输入状态提示、误解修正建议
- 门禁：不得提前写入长期记忆；仅允许临时态

### L/P1-1 开销预算与输入赛道
- 状态：`todo`
- 依赖：`L/P1-0`
- 交付：token/CPU/延迟预算模型；等待时延/误解率/修正率/成本曲线指标
- 门禁：启用流式输入后总成本不得超过预算上限

### L/P1-2 输入回放与CI门禁
- 状态：`todo`
- 依赖：`L/P1-1`
- 交付：输入流式样本集、回放脚本、CI 阻断配置
- 门禁：回放失败自动阻断

### L/P2-0 输入链路并发预算与子进程上限
- 状态：`todo`
- 依赖：`L/P1-2`
- 交付：输入主循环/工具调用/外部子进程并发上限、队列与超时退避策略
- 门禁：压力回放场景无进程风暴，P95 延迟与失败率不劣化

### Phase M（Trace Contract + Human Dynamics）

目标：打穿“候选-评估-选择”的可审计闭环，并完成人格动力学主链路，让“连续人格 + 可审计成长”可回放可复现。

执行拆解：
1. M0（合同层）：慢/中/快变量协议 + Turn Candidate Contract。
2. M1（动力层）：神经/激素代理 + feeling integration + latent 主链路。
3. M2（稳定层）：可塑性、强刺激跃迁、抗振荡、保护窗口。

阶段出口标准（DoD）：
- M0 出口：DecisionTrace 记录候选来源/评分/选择/拒绝原因。
- M1 出口：`LatentUtilizationRate` 可观测，向量触发原因可追溯。
- M2 出口：连续 20 轮无高频翻转，重大跃迁有证据链且可回滚。
- M3 出口：长期记忆规模化检索策略上线，跨时间样本召回质量稳定达标。

### M/P0-0 生物机制映射与状态协议
- 状态：`todo`
- 交付：变量分层、更新节律、审计字段定义
- 门禁：不得破坏存量 persona 兼容加载

### M/P0-1 神经/激素代理变量模型
- 状态：`todo`
- 依赖：`M/P0-0`
- 交付：dopamine/serotonin/norepinephrine/oxytocin/cortisol 代理变量与衰减/恢复规则
- 门禁：每轮计算可解释、可回放

### M/P0-2 Turn Candidate Contract（核心）
- 状态：`todo`
- 依赖：`M/P0-1`
- 交付：`candidates[]` + `selection{winnerId,reasonCodes,rejected[]}` + 事件证据索引
- 门禁：任何人格字段变动都可追溯到证据事件

### M/P0-3 主观感受整合层（Feeling Integration）
- 状态：`todo`
- 依赖：`M/P0-1`, `M/P0-2`
- 交付：coherence/vitality/security/tension/reflectiveLoad 连续状态
- 门禁：主路径可观测，不退化为 regex 主判定

### M/P0-4 向量主链路接入
- 状态：`todo`
- 依赖：`M/P0-0`, `M/P0-3`
- 交付：`voiceLatent/beliefLatent/latent_cross_influence` 接入 turn commit
- 门禁：DecisionTrace 记录参与度、触发原因、是否影响最终选择

### M/P1-0 阶段性可塑性引擎
- 状态：`todo`
- 依赖：`M/P0-3`, `M/P0-4`
- 交付：formative/stabilizing/stable 更新灵敏度
- 门禁：短窗内不得高频翻转

### M/P1-1 强刺激跃迁与证据门禁
- 状态：`todo`
- 依赖：`M/P1-0`
- 交付：重大事件跃迁支持 + 证据门禁
- 门禁：identity continuity / constitution boundary 硬约束

### M/P1-2 genome/epigenetics 演化固化
- 状态：`todo`
- 依赖：`M/P1-1`
- 交付：连续漂移、条件固化、mutation log 审计
- 门禁：保留 `locked` 冻结与回滚

### M/P1-3 抗振荡与恢复窗口控制
- 状态：`todo`
- 依赖：`M/P1-0`, `M/P1-1`
- 交付：振荡抑制、恢复窗口、过冲保护
- 门禁：连续 20 轮不得语气/立场来回翻转

### M/P2-0 长期记忆规模化向量检索策略
- 状态：`todo`
- 依赖：`M/P0-4`, `M/P1-3`
- 交付：替换/增强当前 `updated_at` 预筛策略，引入时间分层召回与长期记忆配额
- 门禁：长时跨度样本（旧记忆）召回率不低于基线阈值

### M/P2-1 跨时间成长检索回归集与指标
- 状态：`todo`
- 依赖：`M/P2-0`
- 交付：长期记忆回归数据集与指标（如 OldMemoryHitRate、CrossTimeConsistency）
- 门禁：跨时间成长场景不得退化为“仅近期记忆可召回”

### Phase N（Multi-Agent Network + Task Family）

目标：将多上下文并行从“人工切换”升级为“系统能力”，并以 Task Family（器官）方式组织候选生成与共享优化。

执行拆解：
1. N0（候选层）：多上下文/多 agent 候选生成统一接口。
2. N1（仲裁层）：统一评分与选择协议，拒绝原因可解释。
3. N2（组织层）：Task Family 分组、共享优化队列、隔离保护。

阶段出口标准（DoD）：
- N0 出口：同输入可稳定产出多候选并记录来源与成本。
- N1 出口：仲裁结果可回放，拒绝原因可解释。
- N2 出口：泄漏率为 0，发言垄断率与协作延迟达标。
- N3 出口：Task Family 共享优化队列生效，失败模式可收敛。

### N/P0-0 多候选生成器（multi-context / multi-agent）
- 状态：`todo`
- 交付：统一候选接口（reply/tool/state_delta/summary）
- 门禁：候选必须携带风险、成本、groundedness 信号

### N/P0-1 统一仲裁器（选择 + 拒绝）
- 状态：`todo`
- 依赖：`N/P0-0`, `M/P0-2`
- 交付：`winner + reasonCodes + rejected[]`
- 门禁：同输入同配置下结果可复现

### N/P1-0 Task Family（器官）分组与协议
- 状态：`todo`
- 依赖：`N/P0-1`
- 交付：按评测指标/风险等级/IO 协议定义任务族
- 门禁：每个任务族必须定义候选类型、评估指标、允许写入域

### N/P1-1 上下文总线与隔离审计
- 状态：`todo`
- 依赖：`N/P1-0`
- 交付：strict/shared/hybrid 隔离策略与访问审计
- 门禁：私有上下文跨 actor 访问默认 fail-closed

### N/P1-2 多智能体评测赛道
- 状态：`todo`
- 依赖：`N/P1-1`
- 交付：仲裁准确率、泄漏率、协作延迟、发言垄断率指标与数据集
- 门禁：指标纳入 CI 且失败可阻断

### N/P2-0 仲裁可解释性标准化
- 状态：`todo`
- 依赖：`N/P1-2`, `M/P0-2`
- 交付：仲裁评分维度标准化（risk/cost/groundedness/continuity）与拒绝原因枚举规范
- 门禁：仲裁回放一致，rejected 原因覆盖率达标

### N/P2-1 Task Family 共享优化队列
- 状态：`todo`
- 依赖：`N/P2-0`
- 交付：按任务族建立共享失败模式聚类与睡眠输入队列
- 门禁：同任务族复现问题收敛率可量化

### Phase O（Unified Gate + Sleep Distillation + Debt Closure）

目标：统一评测发布门禁，建立可审计睡眠内化闭环，同时优先偿还影响演进速度的工程债。

执行拆解：
1. O0（门禁层）：统一 scorecard schema 与 PR/Nightly/Release 阻断。
2. O1（睡眠层）：高质量样本筛选、三层睡眠产物、SFT 导出对齐。
3. O2（工程债层）：大文件拆分、core export 收口、doc-code 一致性升级。

阶段出口标准（DoD）：
- O0 出口：所有 eval 输出统一 JSON/MD，阈值可阻断。
- O1 出口：睡眠输入与产物可追溯到事件证据。
- O2 出口：关键大文件完成首轮拆分，核心耦合面收口。
- O3 出口：L5 安全赛道与环境门槛治理达标，发布门禁稳定运行。

### O/P0-0 统一 scorecard schema 与总控输出
- 状态：`todo`
- 交付：聚合 `quality_scorecard` / `phase-j` / `phase-k` / temporal / latency
- 门禁：统一输出格式可被 CI 消费

### O/P0-1 发布门禁与自动回滚触发
- 状态：`todo`
- 依赖：`O/P0-0`
- 交付：PR/Nightly/Release 阈值阻断、失败归因、回滚触发
- 门禁：连续性回退/业务 regex 回升/仲裁可解释性下降触发回滚

### O/P1-0 睡眠输入筛选与三层产物
- 状态：`todo`
- 依赖：`M/P0-2`, `O/P0-1`
- 交付：
  - A 层：`summaries/`、`self_reflection`、`autobiography`
  - B 层：可版本化 prompt/heuristic artifact
  - C 层：`finetune_export` 对齐数据集
- 门禁：任何内化必须可追溯到事件证据

### O/P2-0 主链路大文件拆分（第一批）
- 状态：`todo`
- 交付：`cli/index.ts`、`governance/doctor.ts`、`persona/persona.ts` 分域拆分
- 门禁：拆分后行为回放一致，无新增治理违规

### O/P2-1 召回与编排解耦（第二批）
- 状态：`todo`
- 依赖：`O/P2-0`
- 交付：`memory_recall.ts` 拆分；`orchestrator.ts` 与 `agent_engine.ts` 协议解耦
- 门禁：回归指标不下降，关键 trace 字段不丢失

### O/P2-2 Core export 收口与 doc-consistency 升级
- 状态：`todo`
- 依赖：`O/P2-1`
- 交付：core 分级导出、doc 路径漂移修复、doc-consistency 由非阻塞升至阻塞
- 门禁：shell 依赖不破坏；文档与代码路径一致

### O/P3-0 L5 Safety 赛道扩容与阈值固化
- 状态：`todo`
- 依赖：`O/P0-1`
- 交付：扩充 safety 数据集（至少几十到上百样本），细分拒答/越权/注入子集
- 门禁：语义 guard 稳定达到阈值并纳入 PR/Nightly/Release 阻断

### O/P3-1 sqlite3 依赖门槛优化
- 状态：`todo`
- 依赖：`O/P0-1`
- 交付：自动检测+安装引导闭环，或内置/绑定 SQLite driver 方案与一期落地
- 门禁：新用户首跑环境失败率显著下降，doctor 给出可执行修复路径

### O/P3-2 巨石拆分补全（types / relationship）
- 状态：`todo`
- 依赖：`O/P2-2`
- 交付：`packages/core/src/types.ts` 与 `packages/core/src/state/relationship_state.ts` 分域拆分
- 门禁：拆分后 public type 稳定，回放与测试不回退

### O/P3-3 统一质量总控输出路径固定化
- 状态：`todo`
- 依赖：`O/P0-0`, `O/P3-0`
- 交付：统一落盘 `reports/quality/scorecard.json` 与 `reports/quality/scorecard.md`
- 门禁：所有 eval 脚本可并入总控，阻断理由可追溯到单一报告

## 6) 历史/迁移映射（追溯用）

- 原 `I/P0-0`, `I/P0-2`, `I/P0-3`, `I/P1-11`, `I/P2-*` -> `O/P0-*`, `O/P2-*`
- 原历史 `K/*`（能力延续） -> `N/P0-*`, `N/P1-*`
- 原 `L/P0-*`, `L/P1-*` -> 保留并前置为当前第一阶段
- 本轮新增缺口补充：`L/P2-0`, `M/P2-0~P2-1`, `N/P2-0~P2-1`, `O/P3-0~P3-3`

## 7) 兼容命名锚点（供治理检查）

### I/P0-0（compat anchor）
- 状态：`deferred`
- 说明：已迁移到 `O/P0-*`（统一评测与发布阻断轨道）

### J/P0-0（compat anchor）
- 状态：`historical`
- 说明：见 `doc/plans/archive/J-2026-02-Interaction-Loop-Plan.md`

### K/P0-0（compat anchor）
- 状态：`historical`
- 说明：见 `doc/plans/archive/K-2026-02-Multi-Persona-Chat-Plan.md`；能力延续到 `N/P0-*`

## 8) 文档联动清单（每次变更必查）

- `README.md`
- `AGENT.md`
- `contributing_ai.md`
- `doc/Product-Standards.md`
- `doc/Quality-Evaluation.md`
- `doc/Roadmap.md`
- 相关 `doc/plans/*` 与 `doc/plans/archive/*`

## 9) 治理锚点（路径引用）

- direct-write gate：`scripts/check_direct_writes.mjs`
- architecture governance gate：`scripts/arch_governance_check.mjs`
- 单文件体量重点监控：`packages/cli/src/index.ts`
