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

1. 当前执行优先级：`Phase J > Phase K > Phase I`。
2. 任务 ID 冻结，不重排；新增任务仅允许追加编号。
3. 编号格式：`{Phase}/P{priority}-{seq}`。
4. 每次进入新 Phase 前必须先完成分工规划（A/B 归属、依赖链、同步点、回滚归属）。

## 4) 当前执行总览

- `blocked`: `none`
- `in_progress`: `J/P0-2`
- `todo`: `Phase J`（其余）, `Phase K`, `Phase I`
- `historical`:
  - Phase H（Ha/Hb/Hc）完成记录：`doc/plans/archive/H-State-Closure-Plan.md` 及同目录 H*/Ha*/Hb*/Hc* 子计划。
  - Architecture Governance 12 项完成归档：`doc/plans/archive/AG-2026-02-Completion.md`。
  - Core 分层重构（2026-02-26）：`packages/core/src` 根层收敛为 `index.ts`/`types.ts`，其余迁入 `runtime|memory|persona|state|guards|governance|capabilities|proactive`。

## 5) Active Roadmap

### Phase J（交互体验闭环）

目标：补齐兴趣/注意力/主动交互闭环，形成非轮询式会话体验。

### J/P0-0 Interest-Attention 状态闭环
- 状态：`done`
- 计划：`doc/plans/J-Interaction-Loop-Plan.md`

### J/P0-1 Proactive Planner 契约化
- 状态：`done`

### J/P0-2 非轮询会话循环（核心交互层）
- 状态：`in_progress`

### J/P1-0 Engagement Plan + 预算门禁
- 状态：`todo`

### J/P1-1 多话题上下文调度器
- 状态：`todo`

### J/P1-2 交互体验评测赛道
- 状态：`todo`
- 依赖：`J/P0-2`

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
