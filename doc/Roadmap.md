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
- `in_progress`: `J/P1-0`
- `todo`: `Phase J`（P1 其余）, `Phase M`, `Phase K`, `Phase I`, `Phase L`
- `historical`:
  - Phase H（Ha/Hb/Hc）完成记录：`doc/plans/archive/H-State-Closure-Plan.md` 及同目录 H*/Ha*/Hb*/Hc* 子计划。
  - Architecture Governance 12 项完成归档：`doc/plans/archive/AG-2026-02-Completion.md`。
  - Phase J P0 交互闭环归档：`doc/plans/archive/J-2026-02-Interaction-Loop-Plan.md`。
  - Core 分层重构（2026-02-26）：`packages/core/src` 根层收敛为 `index.ts`/`types.ts`，其余迁入 `runtime|memory|persona|state|guards|governance|capabilities|proactive`。

## 5) Active Roadmap

### Phase J（交互体验闭环）

目标：补齐兴趣/注意力/主动交互闭环，形成非轮询式会话体验。

### J/P0-2 非轮询会话循环（已归档）
- 状态：`historical`
- 索引：`doc/plans/archive/J-2026-02-Interaction-Loop-Plan.md`（含 `J/P0-0`、`J/P0-1`、`J/P0-2`）

### J/P1-0 Engagement Plan + 预算门禁
- 状态：`in_progress`

### J/P1-1 多话题上下文调度器
- 状态：`todo`

### J/P1-2 交互体验评测赛道
- 状态：`todo`
- 依赖：`J/P0-2`

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

### K/P0-0 多人格会话图谱与注册表
- 状态：`todo`

### K/P0-1 多人格发言仲裁器（addressing 优先）
- 状态：`todo`

### K/P0-2 回合调度与抢答抑制
- 状态：`todo`

### K/P1-0 上下文总线与私有记忆隔离
- 状态：`todo`

### K/P1-1 多人格主动协同规划器
- 状态：`todo`

### K/P1-2 CLI 多人格交互命令与会话视图
- 状态：`todo`

### K/P1-3 多人格评测赛道（AB 共建）
- 状态：`todo`

### Phase I（产品化收口）

目标：完成开源合规、可观测、产品化门禁与兼容收口。

### I/P0-0 开源合规
- 状态：`todo`

### I/P0-2 性能与可观测
- 状态：`todo`

### I/P0-3 OK 定义产品化门禁
- 状态：`todo`

### I/P1-11 可观测性回归
- 状态：`todo`
- 依赖：`I/P0-2`

### I/P2-0 Inheritance（可选）
- 状态：`todo`

### I/P2-1 兼容收口（可选）
- 状态：`todo`

### Phase L（输入流式化：增量理解 + 分段提交）

目标：在不破坏现有治理与主链路稳定性的前提下，建立 CLI 文本输入侧增量处理能力，实现“边输入边理解、分段提交后正式回合处理”。

### L/P0-0 输入事件层抽象（CLI）
- 状态：`todo`

### L/P0-1 分段提交引擎
- 状态：`todo`

### L/P0-2 增量理解（轻量层）
- 状态：`todo`

### L/P0-3 正式回合桥接
- 状态：`todo`

### L/P1-0 交互可视化与修正提示
- 状态：`todo`

### L/P1-1 开销预算与门禁
- 状态：`todo`

### L/P1-2 评测赛道
- 状态：`todo`

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
