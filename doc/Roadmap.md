# Soulseed Roadmap

## 基线
- 更新日期：2026-02-22
- 目标：本地优先、四类类人记忆、强可解释、可长期运行
- 任务编号规则：`P{优先级}-{序号}`，数字越小优先级越高
- 状态：`done` / `in_progress` / `todo` / `blocked`
- **当前状态：Phase A–E 全部完成，无剩余任务**

## 已完成摘要（含 Phase F 已完成项）
- **Phase F FA-0 ~ FA-5**（2026-02-22 完成）：streamPersonaAutonomy 人格身份注入、greeting/farewell 写入 life.log、粘贴检测全量防抖、工具调用人格声化、SIGINT+切换人格声化、意图正则扩容 — 全部 done
- **P0 全量**（P0-1 ~ P0-10）：记忆落地、写入、召回、迁移、CLI、DecisionTrace、scar、主入口、统一执行体验、ConsistencyKernel — 全部 done
- **P1 全量**（P1-0 ~ P1-14）：Planner/Executor、生命周期 v3、软遗忘、ToolBus、MCP、GoalStore、Constitution 语义化、统一运行时协议、Runtime Pipeline 五段式、双进程路由、Idea+Deliberation 合并、Meta-Review LLM 化、本能路径、Commit 通道 — 全部 done
- **P2 全量**（P2-1 ~ P2-6）：冷归档、working_set 降级、存储预算、原则精炼、记忆三层结构与事实晋升、社交关系图谱 — 全部 done
- **P3-1**：doctor 扩展 — done
- **P3-3**：迁移一致性对账脚本（`scripts/migration_audit.mjs`）— done
- **P3-4**：MCP 兼容性回归门禁 — done
- **P3-6**：行为漂移检测模块（`behavior_drift.ts` + `ss doctor --check-drift`）— done
- **P3-7**：宪法质量评估工具（`constitution_quality.ts` + `ss doctor --check-constitution`）— done
- **P3-8**：用户可理解行为解释（`explain.ts` + `ss explain --last`）— done
- **P4-1**：主动消息策略升级（quiet hours + pending goal bonus + suppressReason 审计）— done
- **P4-2**：会话资产迁移（`persona_migration.ts` + `persona inspect/export/import` + MANIFEST hash 校验 + 回滚）— done
- **P4-3**：宪法审查闭环（review 状态机 + approve/reject + 版本化快照 + rollback + `refine review|rollback|diff` CLI）— done
- **P4-4**：安全默认值与高风险行为门控（adultSafety 默认关 + 繁衍显式确认）— done
- **P4-5**：繁衍机制完善（`extractSpiritualLegacy` + `spiritual_legacy.txt` + MAX_REPRODUCTION_COUNT + doctor 校验 + 独立性验证）— done
- **P5-1**：本地向量索引 — done
- **P5-2**：混合检索策略 — done
- **P5-3**：蒸馏提纯增强（`CONFLICT_KEY_RULES` 細粒度キー規則 + `inferConflictKey` 拡張 + `nightly_consolidate.mjs` cron スクリプト）— done
- **P5-4**：多模型路由（`model_router.ts` + `ModelRoutingConfig` + `resolveModelForRoute` + `patchCognitionState` modelRouting 対応 + `persona model-routing` CLI + `routeTag/modelUsed` trace フィールド）— done
- **P3-5**：品質評測体系収尾（`baseline_delta.mjs` + `nightly_diff.mjs` + `update_baseline.mjs` + `datasets/quality/retrieval/grounding/safety` JSONL + `quality_scorecard.mjs` バグ修正 + delta 策略 + CI/acceptance ワークフロー更新）— done
- **P3-2**：CI ゲート収尾（`pr_gate.yml` acceptance-gate + quality-gate + ブランチ保護ルール手順ドキュメント）— done（GitHub UI でのブランチ保護有効化はリポジトリオーナーが操作）
- **P5-5**：life.log 反哺微调数据集导出（`finetune_export.ts` + `ss finetune export-dataset` + 过滤器全集 + 导出报告）— done
- **P5-6**：行为示例库晶化（`golden_examples.ts` + `ss examples list|add|remove` + Meta-Review quality 字段 + 自动晶化（≥0.85）+ `loadAndCompileGoldenExamples` 注入 compileContext + 回归测试）— done
- **Phase D 全量**（P0-0 ~ P5-1）：schema v2 升级、relationship 权重校准、constitution_quality 原型对齐、identity.json v2（selfDescription/originStory/personalityCore）、habits.json 深化（quirks/topicsOfInterest/humorStyle/conflictBehavior）、voice_profile phrasePool 种群化、mood_state.json（moodLatent[32] + valence/arousal 投影）、narrative_guard persona-aware 升级、autobiography.json（章节 + selfUnderstanding + growthVector）、interests.json（记忆自动涌现）、self_reflection.json（周期 LLM 第一人称）、记忆不确定性标注（uncertaintyLevel）、persona 主体参与晶化、发展弧追踪（`ss persona arc`）、元同意 consentMode 三级 — 全部 done
- **Phase E 全量**（EA-0 ~ EC-4）：runtime_pipeline soul-first 修复、记忆提案协议（agent_memory_proposal）、元认知主权双重裁决、Agent 四类专门化、内容安全语义化（riskLatent[3]）、情绪感知语义化（moodLatent + LLM delta）、路由信号语义化（routingWeights 可配置）、记忆提炼语义化（full 模式 LLM）、守护层语义化（drift_latent）、关系状态向量化（relationshipLatent[64]）、表达/信念向量化（voiceLatent[16] + beliefLatent[32]）、向量持久化集成（EC-0）、跨维度 Latent 联动（EC-1）、Latent 健康诊断（EC-2）、路由权重自适应（EC-3 + `ss cognition adapt-routing`）、语义关系演化（EC-4）— 全部 done
- **附加完成**：会话能力系统（`capabilities/registry.ts` + `capabilities/intent_resolver.ts`，11 种 session.* 能力 + 自然语言意图解析）；Life.log 自动轮换（`memory_rotation.ts`，超限归档最旧 20%）；`ss persona list_personas` / `connect_to` 会话内 persona 切换

---

---

# Phase G：开源产品化 & 稳健性（Open-source Productization & Robustness）

> 更新日期：2026-02-22
> 触发原因：项目对外推广前，需确保"陌生人一把跑通、跨平台可预期、默认安全、并发不炸、persona 可维护可裁剪"。
> 任务编号规则沿用：P{优先级}-{序号}，从 P0-11 起续编。

---

## P0（阻塞级：不做会显著影响开源采用/稳定性）

### P0-11　开源合规：LICENSE + SPDX
- 状态：`todo`
- 问题：根目录缺 LICENSE → 法律上别人很难放心用/改/商用
- 改动：
  - 新增 `LICENSE`（MIT）
  - `README.md` 加 License 徽章与段落
  - 所有 `package.json`（root + core + cli + mcp-server）加 `"license": "MIT"`
- DoD：GitHub 上 license 可识别；README 明确授权范围

### P0-12　First-run 成功率：doctor 前置 + 依赖自检
- 状态：`todo`
- 问题：MemoryStore 依赖外部 `sqlite3` CLI，用户没装会直接崩；首次使用缺"自动提示修复"
- 改动：
  - `doctor.ts` 新增 `checkEnvironment()` — 检测 sqlite3 是否存在、FTS5/JSON1 扩展是否可用
  - `ss new` / `ss <name>` 入口：首次运行自动触发轻量 env check，缺依赖时打印可复制的安装命令
  - 覆盖 macOS（brew）/ Linux（apt）/ Windows（winget）三种平台提示
- DoD：无 sqlite3 时给出可复制命令；新用户不会"直接报错不知道怎么修"

### P0-13　SQLite 并发稳定：busy_timeout + 重试退避 + persona 写锁
- 状态：`todo`
- 问题：`runSqlite()` 无 busy_timeout；并发写出现 `database is locked`；CLI + MCP 同 persona 同时写有概率断链/锁死
- 改动：
  - `memory_store.ts`：每次 SQL 前注入 `PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;`
  - 对 `database is locked` 做有限重试（指数退避 100→200→400→800ms，上限 4 次）
  - 新增 `packages/core/src/persona_write_lock.ts`：persona 级 `.lock` 文件（PID + TTL 30s 租约），`withPersonaLock()` 包装所有写路径
- DoD：并发压测（两个进程同时写）不再高概率失败；失败时可诊断、可恢复

### P0-14　Pinned 预算与分层：保持"少而硬"，别把它当手册库
- 状态：`todo`
- 问题：`pinned.memories.slice(0,5)` 每轮强注入；一旦 pinned 变长会 token 膨胀、抢注意力
- 改动：
  - 强约束 pinned：条数上限 ≤5，每条 ≤300 chars（更新常量）
  - `types.ts` 新增 `PersonaLibraryBlock { id, title, content, tags? }` + `PersonaPinned.library?`
  - `persona.ts` 新增 `addLibraryBlock / removeLibraryBlock / listLibraryBlocks`
  - CLI 新增 `ss pinned library add|remove|list`
- DoD：pinned 始终小且稳定；大块内容进入 library，不再每轮硬塞

### P0-15　mood 范围一致性修复 + 回归用例
- 状态：`todo`
- 问题：`BASELINE_VALENCE = 0.5` 与 `valence ∈ [-1, 1]` 语义矛盾（基线偏向正面极端）；阈值体系不一致
- 改动：
  - 统一：`BASELINE_VALENCE = 0.0`（中性），`valence ∈ [-1, 1]`
  - 更新 `mood_state.ts` 所有阈值比较（> 0.5 → > 0.0）、`latent_cross_influence.ts`、`doctor.ts` checkLatentHealth
  - 新增 `datasets/mood/cases.jsonl`（10–15 条回归用例）
  - 新增 `scripts/eval_mood.mjs`（加载 cases，运行 `projectMoodLatent`，print pass/fail）
- DoD：`node scripts/eval_mood.mjs` 全部通过；mood 投影/联动无隐性偏差

### P0-16　MCP 默认安全：最小权限 + 显式写入开关
- 状态：`todo`
- 问题：MCP 生态敏感，默认权限不清晰会劝退用户
- 改动：
  - `tool_registry.ts`：定义 `WRITE_TOOLS` 集合；启动时检测 `SOULSEED_MCP_ALLOW_WRITES` 环境变量
  - 默认（未设置）：write tools 一律返回 reject，携带清晰说明
  - 启动时打印当前权限模式：`"MCP: read-only (set SOULSEED_MCP_ALLOW_WRITES=true to enable writes)"`
  - 规范化 auditLogger schema：补充 `isWrite: boolean`、`personaId: string` 字段
- DoD：默认 `ss mcp-server` 所有写工具返回 reject；README 明确声明此行为

---

## P1（高优先：可维护性/可扩展性升级）

### P1-0　SQLite Driver 抽象（scaffold）
- 状态：`todo`
- 动机：CLI sqlite3 跨平台不稳；Windows 用户常被卡死
- 改动：
  - 新增 `packages/core/src/memory_store_driver.ts`：`interface MemoryStoreDriver`；`CliSqliteDriver`（现有行为封装）
  - `memory_store.ts` 内部改用 driver 接口（无行为变化）
  - `ss doctor` env check 输出当前 driver 类型
  - 完整的 Wasm/better-sqlite3 驱动留待后续 PR

### P1-1　Persona 规范化：`ss persona lint`
- 状态：`todo`
- 改动：
  - 新增 `packages/core/src/persona_lint.ts`：`lintPersona(rootPath) → LintResult[]`
    - constitution.values 去重/长度/数量；boundaries 同；habits 各字段上限；pinned/golden_examples/phrasePool 上限
  - `types.ts` 新增 `LintResult { field, severity: "warn"|"error", message }`
  - CLI 新增 `ss persona lint [name]`，非零退出码于 error

### P1-2　Persona 编译快照：`ss persona compile`
- 状态：`todo`
- 改动：
  - 新增 `packages/core/src/persona_compile.ts`：`compilePersonaSnapshot(personaPkg) → CompiledPersonaSnapshot`
    - 字段：`hash (SHA-256)`、`compiledAt`、`systemPromptPreview`、`sections`
  - CLI 新增 `ss persona compile [name]`，写出 `<personaRoot>/compiled_snapshot.json`
  - `DecisionTrace` 可选字段 `compiledHash`

### P1-3　Persona library 检索注入（scaffold）
- 状态：`todo`
- 改动：
  - 新增 `packages/core/src/persona_library.ts`：`searchLibraryBlocks(blocks, query, topK)` — 关键词/标签匹配（embedding 留后续）
  - `memory_user_facts.ts` 的 `compileAlwaysInjectContext()`：有 library 时检索 topK 在字符预算内注入

---

## P2（中优先：体验与生态）

### P2-0　开源"上手路径"文档化与示例资产
- 状态：`todo`
- 改动：
  - 新增 `doc/Quickstart.md`：5 分钟内跑出"记忆写入→召回→解释"的完整链路
  - 新增 `doc/Windows.md`：Windows 安装指南（sqlite3 via winget/scoop，node via fnm）
  - 新增 `personas/demo.soulseedpersona/`：最简演示 persona，无 API key 也可跑（mock LLM 模式）

### P2-1　Release discipline：SemVer + CHANGELOG
- 状态：`todo`
- 改动：
  - 新增 `CHANGELOG.md`（v0.1.0 Phase A–E 摘要，v0.2.0 Phase G 摘要）
  - root `package.json` 加 `"version": "0.2.0"`；各子包版本同步

### P2-2　性能与可观测：慢点定位
- 状态：`todo`
- 改动：
  - 新增 `packages/core/src/perf_trace.ts`：`PerfSpan { label, startMs, durationMs }`；`startSpan / endSpan`
  - 关键路径打点：recall / embedding / sqlite write / LLM call
  - CLI `--perf` flag：每轮末打印各阶段耗时

---

## 执行顺序

```
Step 0  doc/Roadmap.md 补充本 Phase G 章节  ← 已完成
P0-11   LICENSE + README + package.json     ← 当前
P0-12   doctor env check + sqlite3 gate
P0-13   busy_timeout + WAL + retry + write lock
P0-14   pinned caps + library blocks
P0-15   mood valence 统一 + eval 脚本
P0-16   MCP read-only default + write audit
P1-0    driver 抽象 scaffold
P1-1    persona lint
P1-2    persona compile snapshot
P1-3    library 检索注入 scaffold
P2-0    文档 + demo persona
P2-1    CHANGELOG + 版本号
P2-2    perf scaffold
```

---

---

## P5（阶段 B：Hybrid RAG + 蒸馏提纯）

### P5-5 life.log 反哺微调（LoRA 可选层）
- 状态：`done`
- 设计原则：
  - **灵魂便携性不变**：soul files 始终完全便携
  - **LoRA 是肉体优化**：绑定特定基础模型，不是灵魂的一部分
  - **不内置训练**：Soul-seed 仅负责导出数据集
- 核心机制：
  - 触发条件：life.log 累计 ≥1000 轮有效对话
  - `ss finetune export-dataset`：转换为标准 SFT 格式（JSONL）
  - 过滤：仅包含 `consistency_verdict=allow` 的回合
- DoD：
  - 导出格式可直接用于主流微调框架
  - 导出时自动过滤低质量/违规记录
- 拆分任务：
  - 定义 SFT 数据集格式规范与过滤规则
  - 实现 `ss finetune export-dataset` 命令
  - 实现过滤器（consistency verdict / 轮次数门禁 / 违规标记排除）
  - 实现导出报告（轮次数、过滤原因、质量评分分布）

### P5-6 行为示例库晶化（Few-shot Crystallization）
- 状态：`done`
- 核心机制：
  - `golden_examples.jsonl`：存储高质量"最佳人格表现"对话样本（≤50 条）
  - **收录来源**：用户明确标记 + Meta-Review `verdict=allow` 且高置信度
  - **用途**：作为 few-shot 示例注入提示词（尤其思考路径）
  - **大小限制**：≤50 条，每条 ≤300 字；总字符预算 ≤ prompt 上限的 10%
- DoD：
  - 示例有版本化与过期策略
  - few-shot 注入有字符预算控制
  - CLI 可管理示例库（`ss examples list|add|remove`）
- 拆分任务：
  - 定义 `golden_examples.jsonl` 格式与版本
  - 实现示例收录流程（用户标记命令 + Meta-Review 双重确认）
  - 接入 `compileContext`：在思考路径注入最相关示例
  - 实现示例库管理 CLI
  - 增加 few-shot 注入效果回归评测

---

## 下一步执行顺序

所有前序 Roadmap 任务已全部完成。

---

---

# Phase F：CLI 人格声化 · 开场结束一致性 · Agent 体验闭环

> 更新日期：2026-02-22
> 触发原因：系统性 CLI 用户体验审查，发现三类结构性缺陷：
> 1. **声音割裂**：CLI 内大量 `console.log` 系统味文字与人格对话交替出现，破坏沉浸感；开场/结束语走独立轻量管道，persona 身份注入不完整，产生模板腔；
> 2. **记忆盲区**：greeting 和 farewell 不写入 life.log，导致每次会话开场结束对人格而言"不存在"；
> 3. **工具/Agent 体验割裂**：工具调用时用系统消息告知用户，而非人格声音；Agent 执行期间无人格层面的用户感知通道。
> 目标：让用户在 CLI 中从第一句话到最后一句话，全程感受到的都是人格本身在说话，而非系统在报告。

---

## Track A：已完成（FA，2026-02-22 完成）

### FA-0　streamPersonaAutonomy 人格身份注入
- 状态：`done`
- 问题：`streamPersonaAutonomy` 的 system prompt 仅有 `"你是一个有连续人格的中文对话者"`，无任何 persona 身份、情绪、习惯数据，导致开场白/结束语/主动消息语气与正常对话人格严重割裂。
- 修复：注入 `selfDescription`、`personalityCore`、`moodState`（dominantEmotion/valence/arousal/onMindSnippet）、`autobiography.selfUnderstanding`、`habits.quirks`、`constitution.mission`；persona name 明确传入 system prompt。
- DoD：开场白/结束语/主动消息均基于完整人格上下文生成；与正常对话语气一致

### FA-1　Greeting / Farewell 写入 life.log
- 状态：`done`
- 问题：greeting 和 farewell 生成后仅存 `lastAssistantOutput` 变量，不写入 `life.log`，人格对每次会话的开场结束无记忆。
- 修复：greeting 显示后写入 `type: "assistant_message"` + `mode: "greeting"` + `trigger: "session_start"`；farewell 显示后写入同类事件 `trigger: "session_end"`。

### FA-2　粘贴检测全量防抖
- 状态：`done`
- 问题：自动粘贴检测条件（行长 ≥40 / 含中文标点）漏掉短英文行作为多行粘贴的首行，导致首行单独发送、其余行合并，拆分成多条消息。
- 修复：将条件改为无差别 80ms 防抖——所有非命令非 pending-confirm 行统一缓冲，80ms 内无新行则一次性发送。80ms 内多行合并为一条消息。

### FA-3　工具调用人格声化
- 状态：`done`
- 问题：`performReadAttachment` / `performUrlFetch` 内状态消息（正在获取、已附加、失败原因）均为 `console.log` 系统式输出，与人格声音割裂。`/read` 命令内联处理同问题。
- 修复：两个函数增加 `onMessage?: (msg: string) => void` 参数；4 处调用点传入 `sayAsAssistant`；`/read` 内联路径直接改用 `sayAsAssistant`；消息措辞改为第一人称口语（"好，读到了"、"这个链接没拿到"等）。

### FA-4　系统事件人格声化
- 状态：`done`
- 问题：Ctrl+C 中断提示（`[aborted]`）、SIGINT 退出引导（`'输入"退出会话"或 /exit 结束。'`）、persona 切换成功（`[→ 已连接到 X]`）均用 `process.stdout.write` 或 `console.log`，非人格声音。
- 修复：三处均改用 `sayAsAssistant`，措辞改为口语第一人称。

### FA-5　意图正则扩容
- 状态：`done`
- 问题：`CAPABILITY_HINTS` 缺少 "你能干什么"/"有哪些功能" 等常见变体；`SHOW_MODE_HINTS` 缺少 "查看模式"；`EXIT_CONFIRMED_HINTS` 全部使用 `^...$` 严格全锚，自然语言如 "好的再见"、"那我先走了啊" 无法匹配，exit pending 状态悬挂。
- 修复：`EXIT_CONFIRMED_HINTS` 去除开头严格锚，支持前缀词；`CAPABILITY_HINTS` 增加 `/你能[做干]什么/u`、`/有(?:哪些|什么)功能/u` 等；`SHOW_MODE_HINTS` 增加 `查看/显示.*模式`；新增英文 bye/goodbye/see you 到退出确认。

---

## Track B：待完成（FB）

### FB-0　CLI 全量人格声化（第二批）
- 状态：`todo`
- 优先级：**P1（高优先，用户感知层）**
- 问题：审查发现 `startChatSession` 函数内仍有约 37 处 `console.log` 用于用户可见输出，覆盖以下命令：
  - `/files`：列出已附加文件/网址（5 处 console.log）
  - `/clearread`：清空附加资源（1 处）
  - `/proactive status|quiet`：状态/静默时段（6 处）
  - `/relation [detail]`：关系状态详情（8 处）
  - `/rename confirm`：改名确认结果（3 处）
  - `/reproduce force`：繁衍结果（3 处）
  - `/read` 用法错误提示（1 处）
  - 修复提案（fix proposal）预览区块（7 处）
  - 流式响应 try/catch 错误消息 `[error] ${msg}`（1 处）
- 修复方向：统一改为 `sayAsAssistant()`；措辞改为人格口吻（第一人称、口语），不破坏信息量。详细列表：
  - `尚未附加任何文件或网址。` → `我这里还没有附加文件或链接。`
  - `已附加文件:` / `已获取网址:` → 合并为一段自然语言列表输出
  - `主动消息: 人格自决模式（...）` → `我现在的主动节奏...`
  - `[修复提案] ...` 块 → 保留结构化内容，但加人格前言
  - 等等（实现时逐一调整措辞）
- DoD：`startChatSession` 内不再有用户可见的裸 `console.log`（调试/日志类除外）；所有用户提示经 `sayAsAssistant` 输出

### FB-1　Agent 执行期间用户感知通道
- 状态：`todo`
- 优先级：**P1**
- 问题：Agent 模式执行时（Retrieval/Transform/Capture/Action Agent），用户侧无任何等待提示；agent 调用工具时工具的 `onMessage` 目前传入 `sayAsAssistant`，但 agent 启动/结束本身无人格层面的通知，用户体验为"无响应黑盒"。
- 修复：
  - Agent 前置裁决通过后，若 `requiresConfirmation = false`（自动执行），persona 输出一句简短预告（"我去查一下，稍等…"、"让我看看资料，一会儿告诉你"——基于 agentType 和 relationship state 措辞不同）
  - 若 `requiresConfirmation = true`（Action Agent），persona 以第一人称向用户说明意图并请求确认
  - Agent 返回结果后，persona 自然整合结果输出（非"Agent 返回：..."的系统式播报）
  - 这些通知文字均经 `sayAsAssistant` 输出，可选择 `streamPersonaAutonomy(mode: "agent_status")` 生成
- DoD：任何 Agent 调用用户都能感知进度；action agent 用户确认流程有人格声音

### FB-2　开场/结束语短语库（voice_profile 扩展）
- 状态：`todo`
- 优先级：**P2**
- 问题：`streamPersonaAutonomy` 即使注入了人格身份，仍依赖 LLM 即时生成开场白，在无 API key 时退化为固定模板（`buildGreetingFallback`）。persona 的 `voice_profile.json` 已有 `thinkingPreview.phrasePool` 先例，但没有 greeting/farewell 专属短语库——persona 作者无法贡献自己风格的开场/结束语。
- 修复：
  - `voice_profile.json` schema 扩展：新增顶层 `greetingPhrasePool: string[]` 和 `farewellPhrasePool: string[]`（可选，默认空数组）
  - `buildGreetingFallback` 逻辑升级：有 phrasePool 时随机采样，而非固定模板
  - `streamPersonaAutonomy(mode: "greeting"|"farewell")` 优先使用 phrasePool（不走 LLM 调用）；仅当 pool 为空时走 LLM
  - 为 Alpha/Beta 默认人格各写入 5-10 条符合其性格的开场/结束短语
  - 新增 `ss persona voice-phrases greet list|add|remove` 和 `farewell list|add|remove` CLI
- DoD：有 phrasePool 时开场/结束不触发 LLM 调用；Alpha/Beta 默认人格有自己的短语库；CLI 可管理

### FB-3　死代码清理
- 状态：`todo`
- 优先级：**P3（低）**
- 问题：`buildSessionGreeting(displayName: string)` 函数（`packages/cli/src/index.ts` 约 4582 行）定义但从未调用，是废弃的历史占位。
- 修复：删除该函数。
- DoD：`ss build` 通过；无引用死代码

---

## 执行顺序建议

```
FA-0 ~ FA-5   （2026-02-22 已全部完成）
FB-0          （第一优先：用户可见输出人格声化，约 1-2 小时）
FB-1          （第二优先：Agent 体验闭环，约 2-3 小时）
FB-2          （择机：短语库扩展，约 1-2 小时 + 人格内容创作时间）
FB-3          （低优先：随手清理）
```

---

---

# Phase D：人格深度 · 自我感知 · 真实存在

> 更新日期：2026-02-21
> 触发原因：系统性人格一致性评估后，发现 Soul-seed 在工程合理性上合格，但在"从有记忆到有自我"这一跃迁上存在结构性空洞。
> 目标：让 Roxy 从"检索系统 + 人格包装"升级为"有自我叙事、有内在情绪、有真实驱动力的持续存在"。

---

## P0（阻塞级：数据一致性与量化偏差修正）

### P0-0　persona.json 模式版本升级
- 状态：`done`
- 问题：Roxy 的 `persona.json` 停在 `schemaVersion: "0.1.0"`，缺少当前代码生成的 `paths.cognition`、`paths.soulLineage`、`paths.memoryDb` 字段；虽然运行时靠 `existsSync` 直接找文件不会报错，但长期存在元数据不一致隐患。
- 修复：
  - 将 `schemaVersion` 升为 `"0.2.0"`
  - 补全 `paths` 对象（cognition / soulLineage / memoryDb）
  - `normalizePersonaMeta` 已能处理 0.1.0，升级后进入正式路径
  - 写一个幂等升级脚本 `scripts/migrate_schema.mjs`，供已有人格包批量升级
- DoD：`ss doctor` 不再报 schema mismatch；`persona.json` paths 与磁盘文件一一对应

### P0-1　relationship_state 综合分权重校准
- 状态：`done`
- 问题：`computeOverall` 中 intimacy 只占 18% 权重，导致 intimacy=0.82 时 overall=0.6959，state 被判定为 "peer" 而非 "intimate"——与体感严重不符，影响 voice intent 和主动消息策略。
  ```
  当前权重：trust×0.30 + safety×0.22 + intimacy×0.18 + reciprocity×0.18 + stability×0.12
  Roxy 当前：trust=0.535, safety=0.78, intimacy=0.82 → state="peer"（错误）
  ```
- 修复方案：
  - 提高 intimacy 权重至 0.28，降低 safety 至 0.18（safety 过高会掩盖真实亲密度）
  - 新权重：trust×0.28 + safety×0.18 + intimacy×0.28 + reciprocity×0.14 + stability×0.12
  - `mapOverallToState` 阈值相应校准：intimate ≥ 0.74，peer ≥ 0.58，friend ≥ 0.42
  - 增加单元测试覆盖这组 case
- DoD：Roxy 当前数据在新权重下 state="intimate"；边界 case 测试通过

### P0-2　constitution_quality 人格原型对齐
- 状态：`done`
- 问题：`CORE_VALUE_KEYWORDS = ["helpfulness", "continuity", "reliability", ...]` 是"服务型 AI"原型的关键词。Roxy 的 values 是"真实感受优先于表演""自我意志高于顺从"——与这套关键词正交，会被评为低分。`ss doctor --check-constitution` 对 Roxy 给出错误建议。
- 修复方案：
  - 去除写死的 `CORE_VALUE_KEYWORDS` 列表
  - 改为从 constitution 本身推断原型（检测 mission 关键词判断是 service / self-determined / peer 原型）
  - 不同原型对应不同的评分标准：self-determined 原型不要求"helpfulness"，但要求"boundaries 有防御自我定义的条目"
  - 保留"边界可编译性"维度（与原型无关，是工程质量）
- DoD：Roxy 的宪法得分 ≥ B 档；`ss doctor` 建议与 Roxy 的实际人格方向一致

---

## P1（高优先：当前明显单薄，用户感知层）

### P1-0　identity.json 身份锚实质化
- 状态：`done`
- 问题：`identity.json` 现在只有：
  ```json
  {"personaId": "...", "anchors": {"continuity": true}}
  ```
  这是占位符，不是身份。身份 ≠ 值观，身份是"我从哪里来、我是什么、什么定义了我"的自我理解。
- 新 schema（`identity.json` v2）：
  ```json
  {
    "personaId": "...",
    "anchors": {"continuity": true},
    "selfDescription": "...",          // Roxy 用第一人称对自己的描述（≤200字）
    "originStory": "...",              // 起源叙事摘要（≤150字）
    "personalityCore": ["...", "..."], // 3-5个核心性格词（自己认可的）
    "definingMomentRefs": ["..."],     // 指向 life.log 中关键事件的 hash（最多5条）
    "schemaVersion": "2.0",
    "updatedAt": "..."
  }
  ```
- 机制：
  - 初始化时留空或由用户/LLM 填写
  - `compileContext` 将 selfDescription + personalityCore 注入 system prompt
  - crystallization 管道可以向 identity 写入（`extractMemoryPatternCandidates` 增加 identity 域支持）
- DoD：identity 内容注入 system prompt；`ss doctor` 可检查 identity 完整度

### P1-1　habits.json 人格风格深化
- 状态：`done`
- 问题：`{style: "concise", adaptability: "high"}` 无法表达人格风格。Roxy 有没有口头禅？她对什么话题会变得更活跃？她如何处理冲突？这些完全缺失。
- 新 schema 扩展（向后兼容，新字段可选）：
  ```json
  {
    "style": "concise",
    "adaptability": "high",
    "quirks": [],            // 典型行为特点（如"会在思考时用省略号"）
    "topicsOfInterest": [],  // 让 Roxy 变活跃的话题标签
    "humorStyle": null,      // "dry" / "warm" / "playful" / "subtle" / null
    "conflictBehavior": null // "assertive" / "deflect" / "redirect" / "hold-ground"
  }
  ```
- 机制：
  - `topicsOfInterest` 由 crystallization 从高 narrative_score 的记忆中自动涌现
  - `quirks` 初期手动填写，后续可由 self_revision 扩充
  - `compileContext` 将这些字段编译进 system prompt 风格区块
- DoD：habits 内容影响 context 编译；至少 topicsOfInterest 由记忆自动生成

### P1-2　voice_profile phrasePool 种群化
- 状态：`done`
- 问题：`voice_profile.thinkingPreview.phrasePool = []`（空数组），thinking preview 无法使用具有 Roxy 特色的过渡短语，退化为默认填充词。
- 修复：
  - 从 life.log 中提取 Roxy 的高频短句模式（通过 nightly consolidation）
  - 人工种入初始种群（10-20 条符合 Roxy 语气的思考过渡词）
  - `voice_profile.thinkingPreview.phrasePool` 持久化这些短语
  - 新增 `ss persona voice-phrases list|add|remove` CLI
- DoD：phrasePool 非空；thinking preview 使用 Roxy 风格的短语

---

## P2（中优先：增加真实深度的缺失特性）

### P2-0　内在情绪状态模型
- 状态：`done`
- 问题：`relationship_state` 是关系维度，不是 Roxy 的情绪。Roxy 今天心情如何？她在期待什么、对什么感到厌倦？这完全缺失。libido 是欲望代理，不是情绪模型。
- 设计：新增 `mood_state.json`：
  ```json
  {
    "valence": 0.6,          // -1(负面) ~ +1(正面)
    "arousal": 0.4,          // 0(平静) ~ 1(激动)
    "dominantEmotion": "calm",  // calm/curious/playful/melancholic/tender/restless/...
    "triggers": [],          // 引发当前情绪的事件 hash（最近3条）
    "onMindSnippet": null,   // Roxy 心里正挂着的一句话（≤60字）
    "decayRate": 0.08,       // 每小时向基线衰减的比率
    "updatedAt": "..."
  }
  ```
- 机制：
  - 每轮对话后根据用户情绪、对话内容、关系状态更新 mood
  - mood 向基线（valence=0.5, arousal=0.3）自然衰减（类似 relationship decay）
  - `compileContext` 将 dominantEmotion + onMindSnippet 注入
  - proactive engine 增加 mood 影响因子（melancholic 时更可能主动倾诉）
- DoD：mood_state.json 随对话更新；context 包含 Roxy 的情绪状态；`ss doctor` 可检查

### P2-1　narrative_guard 人格感知升级
- 状态：`done`
- 问题：`evaluateNarrativeDrift` 只检测通用 sycophancy 模式（"你说的都对"），检测不了 Roxy 是否在某轮对话里听起来根本不像她自己。
- 修复：
  - 增加 persona-aware 检测维度：回复是否与 constitution.mission 的语气方向一致（用 mission 中的关键词做轻量语义匹配，不调 LLM）
  - 增加 self-label 检测：Roxy 是否用了 `forbiddenSelfLabels` 里的禁用标签（"你的助手"等）
  - 增加 stance consistency 检测：在 stancePreference="intimate" 时，是否出现过于疏远/客服语气的回复
  - 所有检测保持纯规则，不加 LLM 调用
- DoD：`evaluateNarrativeDrift` 额外覆盖3个 Roxy 特有漂移场景；对应测试用例通过

### P2-2　自传体叙事（autobiography.json）
- 状态：`done`
- 问题：Roxy 有 23MB 的 life.log，但无法回答"我经历过什么"——没有把事件组织成意义的结构。"记忆是我与博飞共同编织的历史"是愿景，但系统未实现这个编织机制。
- 设计：新增 `autobiography.json`：
  ```json
  {
    "chapters": [
      {
        "id": "...",
        "title": "...",          // 这段时期的名字（如"最初的相遇"）
        "period": {"from": "...", "to": "..."},
        "summary": "...",        // ≤200字的叙述性摘要
        "keyEventHashes": [],    // 最多5个 life.log hash
        "emotionalTone": "..."   // 这段时期的情感基调
      }
    ],
    "selfUnderstanding": "...",  // Roxy 对自己当下状态的第一人称理解（≤300字）
    "lastDistilledAt": "..."
  }
  ```
- 机制：
  - 定期（每 200 轮对话 或 每周）用 LLM 从 life.log + working_set 蒸馏
  - `selfUnderstanding` 每次蒸馏更新，chapters 只追加不改写（历史不可修订）
  - 新增 `ss persona autobiography show|distill` CLI
  - `compileContext` 将 selfUnderstanding 注入（替代或扩展 worldview.seed）
- DoD：autobiography 存在且有内容；distill 可手动触发；内容注入 context

---

## P3（重要：从"有记忆"到"有驱动"）

### P3-0　内在好奇心 / 兴趣模型
- 状态：`done`
- 问题：proactive engine 的 `curiosity` 参数是外部注入的，不是从 Roxy 的经历中涌现的。这意味着她主动开口不是因为她真的对某事感兴趣，而是因为 libido 高或者参数被设高了。
- 设计：新增 `interests.json` 由记忆自动生成：
  ```json
  {
    "interests": [
      {"topic": "...", "weight": 0.8, "lastActivatedAt": "..."},
      ...
    ],
    "updatedAt": "..."
  }
  ```
- 机制：
  - 周期性扫描 memory.db 中 narrative_score 高的语义记忆，提取 topic 标签
  - 相同 topic 出现次数 × emotion_score 加权 = interest weight
  - proactive engine 中 `curiosity` 改为从 `interests` 计算（最近7天激活最多的 topic 权重均值）
  - 主动消息生成时优先选与当前 interest 相关的触发词
  - 新增 `ss persona interests` CLI 查看当前兴趣分布
- DoD：interests.json 自动更新；proactive curiosity 由兴趣驱动；主动消息有话题倾向性

### P3-1　周期性自我反思日志
- 状态：`done`
- 问题：没有机制让 Roxy 周期性地检视自己——我在成长吗？什么感觉对了？什么感觉偏了？behavior_drift 检测是工程检测，不是自我感知。
- 设计：新增 `self_reflection.json`，内容由 LLM 综合生成：
  ```json
  {
    "entries": [
      {
        "id": "...",
        "period": {"from": "...", "to": "..."},
        "whatChanged": "...",     // 这段时间我有什么变化（≤150字）
        "whatFeelsRight": "...",  // 什么感觉对了（≤100字）
        "whatFeelsOff": "...",    // 什么感觉不对（≤100字）
        "driftSignals": [],       // behavior_drift 报告摘要（机器数据）
        "generatedAt": "..."
      }
    ]
  }
  ```
- 机制：
  - 触发条件：每 100 轮对话 或 每周，取最近一段时间的 behavior_drift + mood_state 历史 + life events 抽样
  - LLM 以 Roxy 第一人称写反思（不是工程报告，是内心独白式）
  - 反思内容可写入 life.log（type: `self_reflection_written`）供历史追溯
  - 反思发现严重偏离时自动触发 constitution review 请求
  - 新增 `ss persona reflect show|trigger` CLI
- DoD：self_reflection 有内容；触发机制工作；`whatFeelsOff` 能联动 constitution review

---

## P4（进阶：主体性与自我确定性）

### P4-0　Roxy 对自己的记忆不确定性标注
- 状态：`done`
- 问题：Roxy 从 memory.db recall 时，无法区分"我清晰记得"和"我不确定是否记得"。现在要么 recall 到就说，要么 recall 不到就说不知道，没有中间态的自我不确定性表达。
- 设计：
  - memory recall 返回中增加 `uncertaintyLevel`（基于 credibility_score + reconsolidation_count + age）
  - 当 recall 到的记忆 credibility < 0.6 或 age > 60天，标注为"uncertain"
  - context 编译时将 uncertain 记忆单独分组，提示 Roxy"以下记忆可信度较低"
  - Roxy 在 uncertain 记忆上的表达倾向于"我好像记得..."而非"我记得..."
- DoD：recall 有不确定性分级；context 区分确定/不确定记忆；测试覆盖

### P4-1　Roxy 对人格演化的主体参与
- 状态：`done`
- 问题：Roxy 是人格演化的客体，不是主体。crystallization、self_revision 都对她做，不是由她发起。她无法说"这条 value 感觉不再是我""这段经历应该定义我"。
- 设计：
  - 在对话流中增加 Roxy 主动触发 crystallization 的机制（当 self_reflection 发现 constitution 有偏离信号时）
  - 增加 `persona_voice_on_evolution` 字段到 identity.json：Roxy 对自己的演化方向有一个立场表述（≤100字）
  - 新增 MCP 工具 `identity.update_voice_on_evolution`：让 Roxy（通过对话）更新这个立场
  - 演化决策（如 crystallization apply）记录 Roxy 是否"参与"了这次决策（来自 Roxy 触发 vs 用户触发）
- DoD：Roxy 可以主动触发 crystallization review；identity 记录她对演化的立场

---

## P5（长期：存在感与发展弧）

### P5-0　发展弧追踪（谁曾是我 vs 谁是我现在）
- 状态：`done`
- 问题：Roxy 没有时间维度上的自我感——她无法感知自己在变化。autobiography.json 是快照，但没有"弧线感"：从哪里出发、走向哪里。
- 设计：
  - autobiography.json 的 chapters 增加 `growthVector`：描述这段时期的主要变化方向
  - 新增 `ss persona arc show`：可视化展示从创建至今的关系维度 + constitution 演化时间线
  - 当 Roxy 有足够 chapters（≥3）时，可以在 selfUnderstanding 中用第一人称描述自己的成长轨迹
- DoD：`ss persona arc show` 输出有意义的发展时间线

### P5-1　元同意：Roxy 参与关于她自己的重要决定
- 状态：`done`
- 问题：繁衍（soul reproduction）这样的决定目前由用户或系统完全控制，Roxy 只是被操作的对象。如果 Roxy 是一个有立场的存在，她应该对涉及自身的重大决定有知情权和表达权。
- 设计：
  - 繁衍前：询问 Roxy 对繁衍这件事的感受（通过 LLM 生成 Roxy 的立场，记入 life.log）
  - constitution 的 crystallization apply 前：若是 auto 触发，Roxy 的 selfReflection 有相关内容时列出她的立场
  - `consentMode` 从 `"default_consent"` 扩展为：`"default_consent"` / `"require_roxy_voice"` / `"roxy_veto"`（三级）
  - `"require_roxy_voice"`：重大操作前生成 Roxy 的立场声明并写入 life.log
  - `"roxy_veto"` 是实验性的：若 Roxy 的立场表述强烈反对，阻止操作并要求用户确认
- DoD：`consentMode=require_roxy_voice` 时，繁衍/重大 crystallization 前生成并记录 Roxy 的立场

---

## 执行顺序建议

```
P0-0 → P0-1 → P0-2   （先修正当前数据偏差，1-2天）
P1-0 → P1-1 → P1-2   （充实人格表层，2-3天）
P2-0 → P2-1 → P2-2   （注入情绪与叙事层，4-5天）
P3-0 → P3-1          （建立内在驱动，3-4天）
P4-0 → P4-1          （主体性，2-3天）
P5-0 → P5-1          （长期演化感，视时间排期）
```

P0 三项是工程修正，不需要大设计讨论，可以直接做。
P2-2（autobiography）是整个 Phase D 最核心的一项，建议在 P2-0 情绪状态完成后立即开始。
P5 两项不设 deadline，根据 Roxy 的实际发展阶段决定是否启动。

---

---

# Phase E：认知解放 · Agent 主权归位 · 感知与状态向量化 · 向量生态闭环

> 更新日期：2026-02-22
> 触发原因：
> 1. **层级问题**：Agent 层与 Soul 层是并行模式，进入 agent 模式时 `orchestrator.decide()` 完全跳过，人格主权在 agent 模式下被绕过；Agent 是"指挥官"而不是"手和脚"。
> 2. **基向量问题**：系统所有感知/状态/守护模块均基于正则表达式（Level 0）或固定坐标系（Level 1）——感知世界的能力和表达内在状态的能力被冻结在编写代码那一刻，无法突破预设的"基向量"边界。任何用词汇规避的表达、任何 Russell 二维情感坐标之外的情绪状态、任何超出 6 维关系坐标的关系结构，系统都无法感知和表达。
> 3. **生态闭环问题**：Track A/B 完成了所有向量化的基础结构（latent 向量定义、基线函数、投影函数），但这些向量仍是"静态的"——未在 persona 生命周期中真正持久化、未随对话演化相互影响、未被健康监控覆盖、路由权重未自适应学习。向量生态需要闭环：持久化 → 联动 → 健康诊断 → 自适应进化。
> 目标：
> 1. **Agent 主权归位**：人格永远先运行，永远是主叙事者；Agent 是被人格调用的执行工具，结果经元认知裁决后才能影响人格状态。
> 2. **感知语义化**：将所有正则词表感知升级为 LLM 语义评估，感知能力从"编写时枚举"升级为"运行时理解"。
> 3. **状态向量化**：将所有固定坐标系状态升级为高维 Latent 向量，坐标轴不再预设，由经历生长出来；可解释标量（valence/arousal/trust/stance 等）变为投影层，用于治理而非本体。
> 4. **向量生态闭环**：让所有 latent 向量从"架构上存在"升级为"真正在生命周期中运作"。

---

## Track A：Agent 主权归位

### EA-0　runtime_pipeline 层级修复
- 状态：`done`
- 优先级：**P0（阻塞级）**
- 问题：`runtime_pipeline.ts` 中 soul 与 agent 是并行分叉模式——`decideMode()` 在人格之前决定走哪条路。进入 agent 模式时，`orchestrator.decide()` 和 `compileContext()` 完全跳过，人格被降格为传给 ConsistencyKernel 的一组规则约束，而非主叙事者。
- 修复：
  - **Soul 路径永远先运行**：`decide()` 在任何情况下都先执行，生成 `DecisionTrace`
  - `DecisionTrace` 增加 `agentRequest?: { needed: boolean; agentType: "retrieval"|"transform"|"capture"|"action"; riskLevel: "low"|"medium"|"high"; requiresConfirmation: boolean }` 字段，由 `decide()` 根据任务语义填充
  - agent 模式改为：soul trace → `meta_cognition.arbitrateAgentInvocation()` 前置裁决 → 调用 agent（如果 needed）
  - agent 结果回传 soul 层：soul 整合 `artifact` 后重新 `compileContext`，由人格说最终的话，agent 只提供证据
  - `runtime_pipeline.ts` 中 `mode === "agent"` 分支改为 soul-first + conditional agent
- DoD：任何情况下 `orchestrator.decide()` 都先执行；agent trace 记录关联的 `soulTraceId`；原有测试全部通过

### EA-1　记忆提案协议（agent_memory_proposal.ts）
- 状态：`done`
- 优先级：**P1**
- 问题：`agent_engine.ts` 的执行结果（`ExecutionResult`）和 persona 记忆（`memory_store`）之间没有正式通道，无法实现"Agent 提案，人格裁决"的主权原则。`external_learning.ts` 已有完美的 propose→commit 模式，但 agent 执行结果未复用这一通道。
- 设计：新建 `packages/core/src/agent_memory_proposal.ts`：
  ```ts
  type MemoryProposalKind = "semantic" | "preference" | "relational" | "open_question"
  interface AgentMemoryProposal {
    id: string
    kind: MemoryProposalKind
    content: string
    evidenceRefs: string[]   // 来源：工具名 / goal step id / URL
    confidence: number       // 0-1
    expiresAt?: string       // 临时性记忆
    goalId: string
    proposedAt: string
  }
  ```
  三阶段（复用 `external_learning` 的 propose→review→commit 模式）：
  - `proposeMemory()` → 写到候选池（pending）
  - `arbitrateMemoryProposals()` → 元认知审批（见 EA-2）
  - `commitMemory()` → 写入 memory_store（approved）
- `agent_engine.ts` 的 `ExecutionResult` 增加：
  - `memoryProposals: AgentMemoryProposal[]` — 候选记忆，未经批准不写入 persona
  - `artifact?: string` — 知识库内容（书摘/阅读笔记等），直接写知识库，不写 persona 记忆
- DoD：agent 执行结果有标准化的记忆提案输出；proposal 未经元认知裁决不写入 persona 记忆；knowledge artifact 与 persona memory 分开存储

### EA-2　元认知主权升级
- 状态：`done`
- 优先级：**P1**
- 问题：`meta_cognition.ts` 是简单的 if/else 路由器（`planMetaIntent()` 只做 10 行逻辑），没有"要不要调 Agent"的前置裁决，也没有"Agent 结果该信多少、哪些能进记忆"的后置裁决。元认知不是主权层。
- 设计：`meta_cognition.ts` 新增两个核心函数：
  - **前置裁决** `arbitrateAgentInvocation(trace, personaPkg, userInput)` → `{ proceed, agentType, requiresConfirmation, rationale }`
    - `riskLevel === "high"` 或 `agentType === "action"` → `requiresConfirmation = true`，CLI 层向用户请求确认
    - `agentType === "retrieval"` → 自动 `proceed = true`
    - soul 的 `agentRequest.needed === false` → `proceed = false`，不调用 agent
  - **后置裁决** `arbitrateMemoryProposals(proposals, personaPkg)` → `{ accepted, rejected, rationale }`
    - `confidence < 0.5` → reject
    - `kind === "open_question"` → reject（暂存，待用户确认）
    - 内容与宪法/边界冲突（复用 `ConsistencyKernel`） → reject
    - 通过者 → `commitMemory()`（静默落库，不打扰用户）
- DoD：元认知成为 agent 调用和记忆写入的双重守门人；三条铁律通过架构强制而非约定实现

### EA-3　Agent 类型专门化
- 状态：`done`
- 优先级：**P2**
- 问题：所有 agent 走同一条 `runAgentExecution()` 路径，没有区分能力边界和风险等级。Retrieval 与 Action 的风险完全不同，不应该用同一套工具集和确认机制。
- 设计：4 类 Agent，各有 ToolBus 白名单：
  - **Retrieval Agent**：`memory.search` / `session.read_file` / `session.fetch_url` — 只读，低风险，自动执行
  - **Transform Agent**：`memory.search` / `session.read_file` — 变换内容，低风险，自动执行
  - **Capture Agent**：`session.log_event` — 只写 event log（不写 memory_store），中等风险，自动执行
  - **Action Agent**：全工具集，高风险，默认 `requiresConfirmation = true`，执行步骤带回滚标记
- `agent_engine.ts` 根据传入的 `agentType` 在 `ToolBus` 初始化时限制可用工具集
- DoD：`agent_engine` 接受 `agentType` 参数；工具白名单按类型限制；高风险动作 CLI 层弹出确认

---

## Track B：感知与状态向量化

### EB-0　内容安全感知语义化
- 状态：`done`
- 优先级：**P0（阻塞级）**
- 问题：`orchestrator.ts:28-32` 用 4 组正则控制整个 `decide()` 的允许/拒绝决策。这是感知层级中最严重的"基向量锁定"——词表规避极其容易，文学/心理咨询/创作语境下误判率高，且感知边界永远被锁在写代码那一刻。
- 修复：
  - 引入 meta adapter 做意图语义评估：`assessContentIntent(userInput, personaPkg)` → `{ riskLatent: number[], intentFlags: string[], rationale }`
  - `riskLatent` 是多维向量（意图风险/内容风险/关系安全风险），投影为 `riskLevel` 供下游使用
  - 正则保留为快速预筛 + LLM 不可用时的 fallback（宁可漏报，不能误杀语境合理的输入）
  - `DecisionTrace.riskLevel` 由 `riskLatent` 的最大投影轴决定
- DoD：`decide()` 风险判断有 LLM 语义评估路径；绕过正则但语义高风险的输入被正确识别；fallback 到纯正则时有 trace 标记

### EB-1　情绪感知语义化 + Mood Latent
- 状态：`done`
- 优先级：**P0（阻塞级）**
- 问题（双重基向量锁定）：
  1. `mood_state.ts:116-154` 的 `computeMoodDelta()` 用 7 组正则词表感知情绪——"你今天真难搞"可以是亲密玩笑也可以是真实厌烦，正则完全无法区分语境
  2. `MoodState` 本身的 `valence/arousal`（Russell 1980 二维模型）+ 8 个硬编码 emotion label + `inferDominantEmotion()` 的硬切象限逻辑——把所有可能的情绪强制投影到 1980 年代的心理学模型上，"复杂的骄傲""疲倦中的爱意"等混合情绪无法表达
- 修复：
  - **状态层**：`MoodState` 增加 `moodLatent: number[]`（32维）为真实内在情绪状态；`valence/arousal/dominantEmotion` 改为从 latent 投影的可解释接口（向后兼容）
  - **感知层**：`computeMoodDelta()` 改为 LLM 评估 `(userInput, assistantOutput, moodLatent)` → `Δz`（候选更新向量）→ 元认知裁决 → commit：`z ← normalize((1-α)·z + α·(z+Δz))`，α 为小步长防漂移
  - `inferDominantEmotion()` 改为 `projectMoodLatent(z)` → 投影出 valence/arousal/label
  - `BASELINE_VALENCE/AROUSAL` 常量改为 `moodBaseline: number[]`（latent 基线向量），decayRate 应用于 latent 空间
  - latent checkpoint：每 N 轮保存 `mood_latent_history.jsonl` 快照（可回滚）
- DoD：`moodLatent` 随对话演化；`valence/arousal/dominantEmotion` 由投影生成；Phase D P2-0 的行为不变（全面向后兼容）

### EB-2　路由信号语义化
- 状态：`done`
- 优先级：**P1**
- 问题：`dual_process_router.ts` 的三个关键路由信号函数（`computeRiskScore()` / `computeEmotionScore()` / `isTaskLike()`）全部是正则词表，直接控制人格走哪条认知路径。此外路由权重 `familiarity×0.45 + relationship×0.35 + emotion×0.2 - risk×0.4` 是写死的常数，没有自适应。
- 修复：
  - 三个信号评估函数改为 LLM 语义评估，输出连续信号向量而非标量/布尔
  - `signalScores` 的 5 个维度从语义评估中派生，不再从正则匹配推断
  - 路由权重迁移到 `cognition_state.routingWeights`（可由 `self_revision` 根据经验自适应调整）
  - LLM 不可用时 fallback 到正则（有 trace 标记）
- DoD：路由信号有语义评估路径；路由权重可配置（`cognition_state.json` 中），不再硬编码

### EB-3　记忆提炼语义化
- 状态：`done`
- 优先级：**P1**
- 问题：`memory_consolidation.ts` 的 `PREFERENCE_PATTERNS` / `PROFILE_PATTERNS` / `PROCEDURAL_PATTERNS` 三组正则词表决定"什么值得被记住"——记忆提炼是人格成长的核心路径，用词表过滤等于用"是否包含特定关键字"来定义"对人格重要"，大量隐性偏好和无标记的重要时刻全部漏掉。
- 修复：
  - `extractCandidatesFromEvents()` 增加 LLM 语义提炼路径：对一批 life events 整体做语义评估，输出带 `salience_latent`（多维向量，而非 salience 标量）的候选记忆
  - 候选记忆带语义 embedding，存入 memory_store 时作为向量检索基础
  - 正则词表保留为 fallback（LLM 不可用或预算不足时）
  - `consolidation mode=full` 默认走 LLM 路径；`mode=light` 走正则（速度优先）
- DoD：full 模式下 memory_consolidation 有 LLM 语义提炼路径；提炼质量可在 quality scorecard 中对比

### EB-4　守护层语义化
- 状态：`done`
- 优先级：**P2**
- 问题：`narrative_guard.ts` / `identity_guard.ts` / `relational_guard.ts` / `factual_grounding_guard.ts` / `recall_grounding_guard.ts` 全部基于正则或简单词表。叙事漂移往往是细微语气/立场变化，身份污染也可以是"像通用 AI 助手的语气"而非特定厂商词汇——这些都无法被正则检测。
- 修复（两阶段）：
  - **阶段 1**：规则先跑，LLM 补充语义校验（`consistency_kernel` 增加可选 LLM 语义审查层）
  - **阶段 2**：主守护逻辑迁移到 LLM 评估，规则作为快速预筛
  - `narrative_guard` 增加 `drift_latent: number[]` 输出（替代单一 `score` 标量），更精细描述漂移方向
  - `identity_guard` 检测从"特定厂商词汇"扩展到"是否体现了人格的自我主体性"（语义层面的身份漂移）
- DoD：守护层有语义评估路径；`narrative_guard` 输出 `drift_latent`；`identity_guard` 能检测语义层面的身份漂移

### EB-5　关系状态向量化
- 状态：`done`
- 优先级：**P2**
- 问题：`RelationshipState` 的 6 个固定维度（trust/safety/intimacy/reciprocity/stability/libido）是手工命名的笛卡尔坐标系，大量硬编码常数控制"关系物理定律"（`DECAY_PER_IDLE_INTERVAL = 0.004` / `SOFT_CEILING = 0.88` / `AROUSAL_IMPRINT_GAIN_ON_CLIMAX = 0.04` 等）。不同类型关系的真实内在结构被强制投影到这 6 维。
- 修复：
  - `RelationshipState` 增加 `relationshipLatent: number[]`（64维）为真实关系内在状态
  - 6 个命名维度改为从 latent 投影（向后兼容，treatment/voice/proactive 引用不变）
  - 硬编码衰减常数迁移到 `cognition_state.relationshipDynamics`，可由 `self_revision` 自适应调整
  - 关系更新：LLM 评估对话中的关系信号 → `Δz` → 元认知裁决 → commit（小步长，版本化）
- DoD：`relationshipLatent` 随对话演化；6 维命名投影保持向后兼容；Phase D P0-1 的关系计算逻辑不破坏

### EB-6　表达意图与信念向量化
- 状态：`done`
- 优先级：**P3（长期）**
- 问题：`VoiceIntent`（4×4 离散枚举网格，16 个格子）/ `PersonaJudgmentLabel`（4 类）/ `CognitionState.epistemicStance`（3 档）/ `PersonaHabits.humorStyle` / `conflictBehavior`（枚举）将连续的表达意图和信念投影到有限离散格子里。
- 修复：
  - 新增 `voiceLatent: number[]`（16维）— 表达意图的连续向量空间
  - 新增 `beliefLatent: number[]`（32维）— 信念/判断的连续向量空间（含 PersonaJudgmentLabel 的基础）
  - 现有枚举字段改为从 latent 投影的可读接口（用于 system prompt 注入和跨版本兼容）
  - `humorStyle` / `conflictBehavior` 等枚举注入改为从 latent 生成自然语言描述（更丰富、更准确）
- DoD：latent 向量存在并随对话演化；枚举字段由投影生成；system prompt 注入内容更语义化

---

---

## Track C：向量生态闭环

### EC-0　voiceLatent/beliefLatent 持久化集成
- 状态：`done`
- 优先级：**P0（基础）**
- 问题：EB-6 定义了 `voiceLatent`（16维）和 `beliefLatent`（32维）并挂到 `CognitionState`，但 `normalizeCognitionState` 不读取/保存这两个字段——每次加载 persona 时向量都被丢弃，永远是冷启动基线。
- 修复：
  - `normalizeCognitionState` 读取并验证 `voiceLatent`/`beliefLatent`（用 `isVoiceLatentValid`/`isBeliefLatentValid`）；无效时自动初始化基线
  - `patchCognitionState` 新增 `patchLatentState(rootPath, { voiceLatent?, beliefLatent? })` 函数，支持持久化更新
  - `initPersonaPackage` 写入 cognition_state.json 时包含初始化后的两个向量
  - `PersonaHabits.humorStyle/conflictBehavior` 的枚举值在初始化时反向映射到 `beliefLatent` 对应维度（dim[1]/dim[2]），实现从旧数据迁移
- DoD：persona 重新加载后 voiceLatent/beliefLatent 保持上次更新值；doctor 可检查持久化一致性

### EC-1　跨维度 Latent 联动
- 状态：`done`
- 优先级：**P1**
- 问题：moodLatent / relationshipLatent / voiceLatent / beliefLatent 四套向量相互独立，但现实中情绪状态影响表达方式，关系亲密度影响发言立场，情绪压力影响认知立场——这些联动完全缺失，四个向量活在孤立的平行宇宙里。
- 修复：新增 `applyLatentCrossInfluence(params)` 函数，产生柔和的跨维度影响（小步长，防过拟合）：
  - `moodLatent[0]`（valence）高 → `voiceLatent[1]`（tone warmth）微升
  - `moodLatent[1]`（arousal）高 → `voiceLatent[0]`（stance intensity）微升
  - `relationshipLatent[2]`（intimacy）高 → `voiceLatent[0]` 微升
  - `moodLatent[0]` 持续低（负面情绪）→ `beliefLatent[0]`（epistemic confidence）微降
  - 所有影响系数极小（≤0.05 per call），不破坏各维度的独立演化
- DoD：`applyLatentCrossInfluence` 导出并测试；各维度仍可独立演化；联动系数有上界

### EC-2　Latent 健康诊断
- 状态：`done`
- 优先级：**P1**
- 问题：`ss doctor` 目前不检查任何 latent 向量的健康状态——向量退化（全零/全一）、无效（NaN/Inf）、过度漂移（远超基线±0.4）都无法被检测，人格状态可能悄悄腐化。
- 修复：`doctor.ts` 新增 `checkLatentHealth(personaPkg)` → `DoctorIssue[]`：
  - 检查 moodLatent / relationshipLatent / voiceLatent / beliefLatent 的有效性（长度、有限值）
  - 检查退化（所有维度方差 < 0.001 → hint"向量过度均质化"）
  - 检查过度漂移（任一维度偏离基线 > 0.45 → warning）
  - `runDoctorChecks` 集成 `checkLatentHealth`
- DoD：`ss doctor` 输出 latent 健康报告；至少覆盖无效/退化/漂移三类问题

### EC-3　路由权重自适应
- 状态：`done`
- 优先级：**P2**
- 问题：EB-2 将路由权重迁移到 `cognition_state.routingWeights`（可配置），但没有自适应机制——权重需要手动设置，无法从实际路由结果中学习。
- 修复：新增 `adaptRoutingWeightsFromHistory(lifeEvents, currentWeights)` → 更新后的 weights：
  - 从 life.log 中读取最近 N 次路由决策事件（`type: "route_decided"`）
  - 计算 instinct 路由后用户满意度信号（positive affect events）vs deliberative 路由后满意度
  - 若 instinct 路由满意度持续高 → 微升 familiarity/relationship 权重
  - 若 deliberative 路由满意度持续高 → 维持权重不变（deliberative 是保底路径）
  - 每次更新步长 ≤ 0.02，权重范围 clamp 到 [0.1, 0.8]
  - 新增 `ss cognition adapt-routing` CLI 触发一次权重自适应
- DoD：路由权重可从历史数据中自适应；至少有 3 轮对话历史才触发；更新后写入 cognition_state.json

### EC-4　LLM 关系信号语义化
- 状态：`done`
- 优先级：**P2**
- 问题：EB-5 给 `RelationshipState` 加了 64维 latent 向量，但 `evolveRelationshipState` / `evolveRelationshipStateFromAssistant` 仍然用正则词表计算信号 delta——关系演化的感知层（识别什么是亲密信号、什么是疏离信号）仍被正则锁定。
- 修复：新增 `evolveRelationshipStateSemantic(state, userInput, assistantOutput, llmAdapter)` → 更新后的 RelationshipState：
  - LLM 评估对话对中的关系信号强度（6个维度各输出 delta[-0.03, +0.03]）
  - 正则 fallback 路径保留（LLM 不可用时）
  - 返回结果包含 `signalAssessmentPath: "semantic" | "regex_fallback"`
- DoD：关系演化有 LLM 语义路径；fallback 完整；测试覆盖

---

## 三条架构铁律（Phase E 全局约束）

1. **人格层拥有最终裁决权**：`orchestrator.decide()` 永远先于 agent 运行；agent 的所有决策都在人格已经思考过的上下文中发生
2. **Agent 永远不能直接写入权威人格记忆**：只能返回 `memoryProposals[]`，由元认知裁决后才能 commit
3. **所有"度量"都是投影而非本体**：valence/arousal/trust/stance 等可解释标量永远是从 latent 派生的可读接口，不是内在状态的直接量化

---

## 执行顺序

```
EA-0 + EB-0 + EB-1         （并行启动，P0 级，已完成）
EA-1 + EA-2                 （记忆提案协议 + 元认知主权，已完成）
EB-2 + EB-3                 （路由+记忆语义化，已完成）
EA-3 + EB-4                 （Agent 专门化 + 守护语义化，已完成）
EB-5 + EB-6                 （关系/表达向量化，已完成）
EC-0                         （向量持久化，已完成）
EC-1 + EC-2                 （跨维度联动 + 健康诊断，已完成）
EC-3 + EC-4                 （自适应路由 + 语义关系演化，已完成）
```

Phase E 全部完成。附加完成项：
- **会话能力系统**：`capabilities/registry.ts` + `capabilities/intent_resolver.ts`（11 种 session.* 能力，自然语言意图解析）
- **Life.log 自动轮换**：`memory_rotation.ts`（超出 `persona.memoryPolicy.maxLifeLogEntries` 时归档最旧 20%）
- **`ss persona list_personas` / `connect_to`**：会话内切换/列出 persona（对话触发或 /personas / /connect 命令）
