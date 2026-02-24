# Soulseed Roadmap (Audited, Phase-Ordered)

## 文档规则总纲
- 更新日期：2026-02-24
- 核验范围：以当前仓库代码/文件为准（`/Users/BofeiChen/Soul-seed`）
- Phase 展示顺序固定为：`Phase A -> Phase B -> Phase C -> Phase D -> Phase E -> Phase F -> Phase G`
- 扩展轨道规则：允许在既有 Phase 下挂载子轨道（如 `Phase G / Track H0-H8`），但主编号仍按该 Phase 的 `P0-0 -> PN-M` 连续排序
- 任务编号规则：每个 Phase 内独立编号，格式 `P{优先级}-{序号}`（示例：`P0-0`）
- 优先级规则：`P0` 阻塞级，`P1` 高优先，`P2` 中优先，`PN` 可扩展
- 排序规则：每个 Phase 内必须按 `P0-0 -> ... -> PN-M` 升序排列
- 状态定义：`done` / `in_progress` / `todo` / `blocked` / `archived`
- 归档规则：某个 Phase 内全部任务进入 `done` 或 `closed` 后，该 Phase 必须转为 `archived`，并从主执行清单移出细项，仅保留摘要与归档记录
- 追踪规则：重编号后保留 `原编号` 字段，避免历史引用断链
- 核验原则：`done` 需有仓库证据；`in_progress` 为部分落地但 DoD 未闭合；`todo` 为未见实现或仅有规划

## 当前总览（按新编号）
- 已归档 Phase：`A` `B` `C` `D` `E`
- 进行中：`F/P0-0` `G/P0-0` `G/P2-0` `G/P2-1`
- 阻塞中：`G/P0-6`（依赖 `G/P0-0`）
- 待开始：`F/P1-0` `F/P1-1` `F/P2-0` `G/P1-0` `G/P1-1` `G/P1-2` `G/P1-3` `G/P1-4` `G/P1-5` `G/P1-6` `G/P1-7` `G/P2-2` `G/P2-3` `G/P2-4` `G/P2-5` `G/P3-0`

---

## Phase A（已归档）

### P0-0 阶段归档记录
- 状态：`archived`
- 说明：Phase A 已完成并归档，详细执行条目不再与当前迭代混排。

## Phase B（已归档）

### P0-0 阶段归档记录
- 状态：`archived`
- 说明：Phase B 已完成并归档，详细执行条目不再与当前迭代混排。

## Phase C（已归档）

### P0-0 阶段归档记录
- 状态：`archived`
- 说明：Phase C 已完成并归档，详细执行条目不再与当前迭代混排。

## Phase D（已归档）

### P0-0 阶段归档记录
- 状态：`archived`
- 说明：Phase D 已完成并归档，详细执行条目不再与当前迭代混排。

## Phase E（已归档）

### P0-0 阶段归档记录
- 状态：`archived`
- 说明：Phase E 已完成并归档，详细执行条目不再与当前迭代混排。

## Phase F（CLI 人格体验闭环）

### P0-0 CLI 全量人格声化（第二批）
- 原编号：`FB-0`
- 状态：`in_progress`
- 核验结论：大量输出已人格化，但仍存在用户可见 `console.log` / 系统式报错。
- 证据：
  - `packages/cli/src/index.ts:3792`
  - `packages/cli/src/index.ts:3806`
  - `packages/cli/src/index.ts:3844`
  - `packages/cli/src/index.ts:3869`
  - `packages/cli/src/index.ts:4383`

### P1-0 Agent 执行期间用户感知通道
- 原编号：`FB-1`
- 状态：`todo`
- 核验结论：未形成稳定的“执行前提示 / 执行中状态 / 执行后人格化收束”闭环。

### P1-1 开场/结束语短语库（voice_profile 扩展）
- 原编号：`FB-2`
- 状态：`todo`
- 核验结论：未发现 `greetingPhrasePool` / `farewellPhrasePool` schema 与对应 CLI。
- 证据：
  - `packages/cli/src/index.ts:2323`
  - `packages/cli/src/index.ts:2387`

### P2-0 死代码清理
- 原编号：`FB-3`
- 状态：`todo`
- 核验结论：`buildSessionGreeting()` 仍存在。
- 证据：
  - `packages/cli/src/index.ts:4925`

- 归档条件：Phase F 内全部任务状态为 `done` 或 `closed` 后归档。

## Phase G（开源产品化与稳健性）

### P0-0 SQLite 并发稳定：busy_timeout + 重试退避 + persona 写锁
- 原编号：`P0-13`
- 状态：`in_progress`
- 已完成：busy_timeout + WAL 注入；`SQLITE_BUSY` 指数退避重试。
- 未完成：`withPersonaLock()` 已实现但未接入写路径（当前仅定义，未调用）。
- 证据：
  - `packages/core/src/memory_store.ts:607`
  - `packages/core/src/memory_store.ts:625`
  - `packages/core/src/memory_store.ts:609`
  - `packages/core/src/persona_write_lock.ts:97`

### P0-1 开源合规：LICENSE + SPDX
- 原编号：`P0-11`
- 状态：`done`
- 核验结论：MIT 许可证已落地；README 与各 package 已声明 License。
- 证据：
  - `LICENSE`
  - `README.md:7`
  - `README.md:431`
  - `package.json:4`
  - `packages/core/package.json:4`
  - `packages/cli/package.json:4`
  - `packages/mcp-server/package.json:4`

### P0-2 First-run 成功率：doctor 前置 + 依赖自检
- 原编号：`P0-12`
- 状态：`done`
- 核验结论：`checkEnvironment()` 已检测 sqlite3/FTS5/JSON1/Node；聊天入口有启动前 gate。
- 证据：
  - `packages/core/src/doctor.ts:579`
  - `packages/core/src/doctor.ts:605`
  - `packages/core/src/doctor.ts:620`
  - `packages/core/src/doctor.ts:565`
  - `packages/core/src/doctor.ts:567`
  - `packages/cli/src/index.ts:1806`

### P0-3 Pinned 预算与分层
- 原编号：`P0-14`
- 状态：`done`
- 核验结论：pinned 条数与长度上限、library block 类型与 CLI 已落地。
- 证据：
  - `packages/core/src/types.ts:182`
  - `packages/core/src/types.ts:183`
  - `packages/core/src/types.ts:172`
  - `packages/core/src/persona.ts:604`
  - `packages/core/src/persona.ts:623`
  - `packages/cli/src/index.ts:6932`

### P0-4 mood 范围一致性修复 + 回归用例
- 原编号：`P0-15`
- 状态：`done`
- 核验结论：基线 valence 已统一为 `0.0`，回归数据与脚本存在。
- 证据：
  - `packages/core/src/mood_state.ts:18`
  - `packages/core/src/latent_cross_influence.ts:71`
  - `datasets/mood/cases.jsonl`
  - `scripts/eval_mood.mjs`

### P0-5 MCP 默认安全：最小权限 + 显式写入开关
- 原编号：`P0-16`
- 状态：`done`
- 核验结论：默认 read-only，写工具需显式环境变量开启；审计字段包含 `isWrite` / `personaId`。
- 证据：
  - `packages/mcp-server/src/tool_registry.ts:59`
  - `packages/mcp-server/src/tool_registry.ts:150`
  - `packages/mcp-server/src/tool_registry.ts:90`
  - `packages/mcp-server/src/index.ts:41`

### P0-6 MindModel 轨道硬前置：H0 前置治理与稳健性硬化
- 原编号：`H0`
- 状态：`blocked`
- 阻塞条件：`G/P0-0`（persona 写锁接入写路径）未完成。
- 范围：并发写回归、persona lint、schema version + migration notes 治理基线。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P1-0 SQLite Driver 抽象（scaffold）
- 原编号：`P1-0`
- 状态：`todo`
- 核验结论：未发现 `memory_store_driver.ts` / `MemoryStoreDriver` / `CliSqliteDriver`。

### P1-1 Persona 规范化：`ss persona lint`
- 原编号：`P1-1`
- 状态：`todo`
- 核验结论：未发现 `persona_lint.ts` / `lintPersona` / `ss persona lint`。

### P1-2 Persona 编译快照：`ss persona compile`
- 原编号：`P1-2`
- 状态：`todo`
- 核验结论：未发现 `persona_compile.ts` / `compilePersonaSnapshot` / `compiled_snapshot.json`。

### P1-3 Persona library 检索注入（scaffold）
- 原编号：`P1-3`
- 状态：`todo`
- 核验结论：仅 CRUD 已有；未见 `persona_library.ts` 与检索注入逻辑。
- 证据：
  - 已有 CRUD：`packages/core/src/persona.ts:604`
  - 未接入检索：`packages/core/src/memory_user_facts.ts:278`

### P1-4 MindModel H1：Conversation Control MVP（最小闭环）
- 原编号：`H1`
- 状态：`todo`
- 核验结论：未发现 `engagement_controller.ts` / `topic_tracker.ts` / `conversation_policy.ts` 等接入实现。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P1-5 MindModel H2：Interests -> Attention -> Engagement（可控学习）
- 原编号：`H2`
- 状态：`todo`
- 核验结论：`interests.ts` 已存在，但未形成 H2 要求的 proposal->gate->deterministic apply 闭环。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P1-6 MindModel H3：Proactive 主动系统（有动机、有主题、有克制）
- 原编号：`H3`
- 状态：`todo`
- 核验结论：未发现 `proactive/planner.ts`，主动策略仍需从触发到计划层闭环。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P1-7 MindModel H4：AI 群聊参与控制（不抢答、不刷屏）
- 原编号：`H4`
- 状态：`todo`
- 核验结论：未发现 `group_chat/arbitration.ts`，群聊参与仲裁尚未落地。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P2-0 上手路径文档 + 示例资产
- 原编号：`P2-0`
- 状态：`in_progress`
- 已完成：`doc/Quickstart.md`、`doc/Windows.md`。
- 未完成：`personas/demo.soulseedpersona/`（未找到）。
- 证据：
  - `doc/Quickstart.md`
  - `doc/Windows.md`

### P2-1 Release discipline：SemVer + CHANGELOG
- 原编号：`P2-1`
- 状态：`in_progress`
- 已完成：版本号已统一 `0.2.0`。
- 未完成：`CHANGELOG.md`（未找到）。
- 证据：
  - `package.json:3`
  - `packages/core/package.json:3`
  - `packages/cli/package.json:3`
  - `packages/mcp-server/package.json:3`

### P2-2 性能与可观测：慢点定位
- 原编号：`P2-2`
- 状态：`todo`
- 核验结论：未发现 `perf_trace.ts` / `PerfSpan` / CLI `--perf` 打点输出。

### P2-3 MindModel H5：State Delta Pipeline（proposal -> gates -> apply）
- 原编号：`H5`
- 状态：`todo`
- 核验结论：未见统一 `state_delta_proposals` 与唯一写入通道约束。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P2-4 MindModel H6：Genome & Epigenetics MVP（差异可解释、学习可控）
- 原编号：`H6`
- 状态：`todo`
- 核验结论：未发现 `genome.ts` / `epigenetics.ts` 主实现与 trait->budget 映射链路。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P2-5 MindModel H7：Compatibility & Migration（存量人格不换人）
- 原编号：`H7`
- 状态：`todo`
- 核验结论：已有 `persona_migration.ts`，但缺 `compat_calibration.json` 与 parity regression 规范化产物。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

### P3-0 MindModel H8：Inheritance（可选后置）
- 原编号：`H8`
- 状态：`todo`
- 核验结论：属于后置可选能力，不阻塞主发布。
- 文档依据：`doc/MindModel-Implementation-Contract.md`

- 归档条件：Phase G 内全部任务状态为 `done` 或 `closed` 后归档。

---

## 下一步执行顺序（仅未闭合项）
1. `G/P0-0`：把 `withPersonaLock()` 接入所有写路径，完成并发压测脚本。
2. `F/P0-0`：清理剩余用户可见 `console.log` 与 `[error]` 裸输出。
3. `G/P1-0`：落地 Driver 抽象脚手架（不改行为）。
4. `G/P1-1`：实现 `ss persona lint`。
5. `G/P1-2`：实现 `ss persona compile`。
6. `G/P1-3`：实现 library 检索注入。
7. `G/P0-6`：完成 H0 前置治理（依赖 `G/P0-0` 完成后立即启动）。
8. `G/P1-4`：落地 H1 Conversation Control MVP。
9. `G/P1-5`：落地 H2 Interests->Attention->Engagement。
10. `G/P1-6` / `G/P1-7`：主动系统与群聊仲裁。
11. `G/P2-3` / `G/P2-4` / `G/P2-5`：State Delta、Genome/Epigenetics、compat 迁移闭环。
12. `G/P2-0` / `G/P2-1` / `G/P2-2`：文档示例、CHANGELOG、perf 可观测补齐。
13. `F/P1-0` / `F/P1-1` / `F/P2-0`：完成 CLI 体验闭环收尾。
14. `G/P3-0`：Inheritance（后置可选，不阻塞主发布）。
