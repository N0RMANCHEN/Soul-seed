# Soulseed Roadmap (Audited)

## 基线
- 更新日期：2026-02-23
- 核验范围：以当前仓库代码/文件为准（`/Users/hirohi/Soul-seed`）
- 状态定义：`done` / `in_progress` / `todo` / `blocked`
- 核验原则：
  - `done`：功能与 DoD 关键点都可在仓库中找到实现证据
  - `in_progress`：已落地部分实现，但 DoD 未闭合
  - `todo`：未见实现或仅有规划

## 当前总览（准确状态）
- 已完成：`P0-11` `P0-12` `P0-14` `P0-15` `P0-16`
- 进行中：`P0-13` `P2-0` `P2-1` `FB-0`
- 待开始：`P1-0` `P1-1` `P1-2` `P1-3` `P2-2` `FB-1` `FB-2` `FB-3`

---

## Phase G：开源产品化 & 稳健性（审计后状态）

### P0（阻塞级）

### P0-11 开源合规：LICENSE + SPDX
- 状态：`done`
- 核验结论：MIT 许可证已落地；README 与各 package 已声明 License
- 证据：
  - `LICENSE`
  - `README.md:7`
  - `README.md:431`
  - `package.json:4`
  - `packages/core/package.json:4`
  - `packages/cli/package.json:4`
  - `packages/mcp-server/package.json:4`

### P0-12 First-run 成功率：doctor 前置 + 依赖自检
- 状态：`done`
- 核验结论：`checkEnvironment()` 已检测 sqlite3/FTS5/JSON1/Node；聊天入口有启动前 gate
- 证据：
  - `packages/core/src/doctor.ts:579`
  - `packages/core/src/doctor.ts:605`
  - `packages/core/src/doctor.ts:620`
  - `packages/core/src/doctor.ts:565`
  - `packages/core/src/doctor.ts:567`
  - `packages/cli/src/index.ts:1806`

### P0-13 SQLite 并发稳定：busy_timeout + 重试退避 + persona 写锁
- 状态：`in_progress`
- 已完成：
  - busy_timeout + WAL 注入
  - SQLITE_BUSY 指数退避重试
- 未完成：
  - `withPersonaLock()` 已实现但未接入写路径（当前仅定义，未调用）
- 证据：
  - `packages/core/src/memory_store.ts:607`
  - `packages/core/src/memory_store.ts:625`
  - `packages/core/src/memory_store.ts:609`
  - `packages/core/src/persona_write_lock.ts:97`

### P0-14 Pinned 预算与分层
- 状态：`done`
- 核验结论：pinned 条数与长度上限、library block 类型与 CLI 已落地
- 证据：
  - `packages/core/src/types.ts:182`
  - `packages/core/src/types.ts:183`
  - `packages/core/src/types.ts:172`
  - `packages/core/src/persona.ts:604`
  - `packages/core/src/persona.ts:623`
  - `packages/cli/src/index.ts:6932`

### P0-15 mood 范围一致性修复 + 回归用例
- 状态：`done`
- 核验结论：基线 valence 已统一为 `0.0`，回归数据与脚本存在
- 证据：
  - `packages/core/src/mood_state.ts:18`
  - `packages/core/src/latent_cross_influence.ts:71`
  - `datasets/mood/cases.jsonl`
  - `scripts/eval_mood.mjs`

### P0-16 MCP 默认安全：最小权限 + 显式写入开关
- 状态：`done`
- 核验结论：默认 read-only，写工具需显式环境变量开启；审计字段包含 `isWrite`/`personaId`
- 证据：
  - `packages/mcp-server/src/tool_registry.ts:59`
  - `packages/mcp-server/src/tool_registry.ts:150`
  - `packages/mcp-server/src/tool_registry.ts:90`
  - `packages/mcp-server/src/index.ts:41`

### P1（高优先）

### P1-0 SQLite Driver 抽象（scaffold）
- 状态：`todo`
- 核验结论：未发现 `memory_store_driver.ts` / `MemoryStoreDriver` / `CliSqliteDriver`

### P1-1 Persona 规范化：`ss persona lint`
- 状态：`todo`
- 核验结论：未发现 `persona_lint.ts` / `lintPersona` / `ss persona lint`

### P1-2 Persona 编译快照：`ss persona compile`
- 状态：`todo`
- 核验结论：未发现 `persona_compile.ts` / `compilePersonaSnapshot` / `compiled_snapshot.json`

### P1-3 Persona library 检索注入（scaffold）
- 状态：`todo`
- 核验结论：仅 CRUD 已有；未见 `persona_library.ts` 与检索注入逻辑
- 证据：
  - 已有 CRUD：`packages/core/src/persona.ts:604`
  - 未接入检索：`packages/core/src/memory_user_facts.ts:278`

### P2（中优先）

### P2-0 上手路径文档 + 示例资产
- 状态：`in_progress`
- 已完成：`doc/Quickstart.md`、`doc/Windows.md`
- 未完成：`personas/demo.soulseedpersona/`（未找到）
- 证据：
  - `doc/Quickstart.md`
  - `doc/Windows.md`

### P2-1 Release discipline：SemVer + CHANGELOG
- 状态：`in_progress`
- 已完成：版本号已统一 `0.2.0`
- 未完成：`CHANGELOG.md`（未找到）
- 证据：
  - `package.json:3`
  - `packages/core/package.json:3`
  - `packages/cli/package.json:3`
  - `packages/mcp-server/package.json:3`

### P2-2 性能与可观测：慢点定位
- 状态：`todo`
- 核验结论：未发现 `perf_trace.ts` / `PerfSpan` / CLI `--perf` 打点输出

---

## Phase F Track B（CLI 人格体验闭环）

### FB-0 CLI 全量人格声化（第二批）
- 状态：`in_progress`
- 核验结论：大量输出已人格化，但仍存在用户可见 `console.log`/系统式报错
- 证据（示例）：
  - `packages/cli/src/index.ts:3792`
  - `packages/cli/src/index.ts:3806`
  - `packages/cli/src/index.ts:3844`
  - `packages/cli/src/index.ts:3869`
  - `packages/cli/src/index.ts:4383`

### FB-1 Agent 执行期间用户感知通道
- 状态：`todo`
- 核验结论：未形成稳定的“执行前提示/执行中状态/执行后人格化收束”闭环

### FB-2 开场/结束语短语库（voice_profile 扩展）
- 状态：`todo`
- 核验结论：未发现 `greetingPhrasePool` / `farewellPhrasePool` schema 与对应 CLI
- 证据：
  - `packages/cli/src/index.ts:2323`
  - `packages/cli/src/index.ts:2387`

### FB-3 死代码清理
- 状态：`todo`
- 核验结论：`buildSessionGreeting()` 仍存在
- 证据：
  - `packages/cli/src/index.ts:4925`

---

## 历史阶段归档（A–E）
- 状态：`closed`
- 说明：A–E 在当前仓库中已形成大量落地实现，且没有挂起任务；为避免文档失焦，详细历史条目不再与当前执行清单混排。
- 审计策略：后续如需对 A–E 任一条目做“逐条复验”，单独开一个 `doc/Roadmap.AE.audit.md`，不与当前迭代待办混写。

---

## 下一步执行顺序（只含未闭合项）
1. `P0-13`：把 `withPersonaLock()` 接入所有写路径，完成并发压测脚本
2. `FB-0`：清理剩余用户可见 `console.log` 与 `[error]` 裸输出
3. `P1-0`：落地 Driver 抽象脚手架（不改行为）
4. `P1-1`：实现 `ss persona lint`
5. `P1-2`：实现 `ss persona compile`
6. `P1-3`：实现 library 检索注入
7. `P2-0`：补齐 `personas/demo.soulseedpersona/`
8. `P2-1`：补齐 `CHANGELOG.md`
9. `P2-2`：补齐 perf trace 与 CLI `--perf`
10. `FB-1` / `FB-2` / `FB-3`：完成 CLI 体验闭环收尾
