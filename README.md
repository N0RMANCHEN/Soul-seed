# Soulseed (CLI / TypeScript) — local-first Persona / Identity Runtime

> **阶段（P0）**：先做 CLI 薄壳，验证“灵魂内核 + 驱动闭环”的价值；UI/iOS 等客户端后置。  
> **命名策略**：仓库当前使用 **Soulseed（codename）**。如果你想更“产品化”，推荐候选名见下文 *Naming*（你可随时替换，代码与目录结构不依赖名字）。

---

## 你在做什么（一句话）

你在做一层可移植的 **人格资产（Persona Package）** + 一个可审计、可回放的 **决策闭环（Orchestrator）**，让它可以挂到任何 LLM API 上作为“肉体”，并跨时间保持“同一个它”。

> **Core-first + Multi-shell**：CLI/iOS/Web 都只是壳；当前仓库以 `packages/core` 为核心真相层。  

---

## Naming（项目名方向）

Soulseed 这个 codename 很贴切（“灵魂的种子”，强调可成长）。如果你希望更像“工程/产品名”，我建议选一个能直接表达三件事：**连续性（continuity）/可审计（trace）/可迁移（portable）**。

推荐备选（按贴合度排序）：
- **Continuum**：强调“跨时间仍是同一个它”（连续性强、记忆感弱一点但很稳）。  
- **PersonaLedger**：强调“事件账本 + 可审计不可逆”（偏工程味）。  
- **Sigil**：强调“身份印记/锚点”（短、品牌感强）。  
- **Vowforge**：强调“宪法/承诺的锻造与修宪”（偏叙事）。  

你也可以选择：**Continuum（产品名） + Soulseed（运行时/内核代号）** 的双名结构。

---

## P0 的四个核心目标（务必对齐）

1) **持续自我模型**：跨重启/跨模型的身份与记忆一致性  
2) **深层价值结构**：他者/使命/承诺具有高权重，并真实影响选择  
3) **不可逆损失表征**：删除/遗失/断裂有后果与叙事痕迹（life log append-only）  
4) **情绪作为控制信号**：情绪调制策略权重，但允许外部中止（Ctrl+C / abort）

> 这些不是哲学宣称，而是 **可工程验证的行为规格**。

---

## 关键工程优化（建议纳入 P0）

这些点能让 Soulseed 明显区别于“prompt 堆叠型人格”，并让后续接入工具/多端时更安全、可控：

1) **DecisionTrace 作为一等公民（可回放）**
   - 固化 `decision_trace.json` schema：选择了哪些记忆、为何追问/拒绝、预算/风险等级、工具计划（如果有）。
   - 提供 replay harness：同一 persona + 同一输入在 mock adapter 下输出稳定 trace（做回归测试的基石）。

2) **Persona Doctor（面向人格资产的一键体检与迁移提示）**
   - 检查 package 完整性（schemaVersion、必需文件、相对路径引用、attachments 存在性）。
   - 检查 life log 是否 append-only / 是否断链（见下一条）。
   - 提示/执行安全迁移（schema bump、字段迁移、路径重写）。

3) **life.log.jsonl 防篡改证据链（把“不可逆”工程化）**
   - 每条事件写入 `prevHash` / `hash`（链式哈希）或按 session 做 Merkle root。
   - 发现断链/回写：写入 scar event（“历史被动过”本身就是不可逆事件）。

4) **ToolBus 安全模型提前定（deny-by-default + 预算 + 可中止）**
   - Tool 默认不可用；必须在 DecisionTrace 中批准（理由/预算/影响面）。
   - 所有工具调用必须可中止（Ctrl+C 立即停止 tool 执行与 streaming）。
   - 默认脱敏日志：不输出绝对路径/原文长段。

5) **（可选）兼容 MCP，把 Soulseed 做成“可插拔灵魂”**
   - Soulseed 输出“身份/记忆编译/决策”能力；外部 agent 框架负责渠道/工具生态。
   - 这样你不需要与平台型 bot 拼渠道，而是成为更稀缺的“人格内核”。

---

## 快速开始（当前可跑）

```bash
# 1) 安装依赖（TypeScript 必需）
npm install

# 2) 配置 DeepSeek（首次）
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 3) 验证入口（单一入口）
./scripts/verify.sh

# 4) 构建 CLI
npm run build

# 5) 最短入口（推荐）
./ss new Teddy   # 交互创建 Teddy（含模板与模型初始化）
./ss rename --to Nova
./ss rename --to Nova --confirm
./ss Teddy       # 直接进入 Teddy 会话
./ss doctor      # 默认体检自动发现的 persona

# 6) 退出会话
# 输入 /exit，或在生成中按 Ctrl+C 中止本轮

# 7) 详细用法入口
# 见 doc/CLI.md

# 8) 一键验收（使用隔离 QA persona，不污染日常 persona）
npm run acceptance
# 验收报告输出到 reports/acceptance/

# 9) 质量与评测体系
# 见 doc/Quality-Evaluation.md
```

---

## CLI 设计（P0 只做必要命令）

> 目标：让“驱动闭环”可被最小成本验证。

### Persona
- `new <name>`：创建 persona package（默认交互向导；支持 `--quick`）
- `persona init`：兼容入口（保留旧脚本调用）
- `persona inspect`：查看 persona 概览（默认只显示 name/avatar；`--dev` 才显示内部字段）
- `persona rename`：更名（写入事件；personaId 不变）
- `persona export` / `persona import`：本质是复制目录（保持可迁移）

### Chat / Session
- `<name>`：主入口，直接进入对应 persona 会话（支持 streaming；支持 Ctrl+C 中止）
- `chat`：兼容入口
- `session list` / `session open`：可选（P0 可先用单 session）

### Doctor
- `doctor`：Persona 资产体检 + schema 迁移提示 + life log 完整性检查（P0-1 后逐步实现）

---

## Persona Package（人格资产结构）

```
<PersonaName>.soulseedpersona/
  persona.json              # id、displayName、schemaVersion、defaultModel、initProfile、paths
  identity.json             # anchors（personaId 不变）
  worldview.json            # 世界观种子（可演化）
  constitution.json         # 价值/边界/使命/承诺（可修宪）
  habits.json               # 习惯与表达风格（可塑形）
  user_profile.json         # Profile Memory（用户称呼/语言偏好）
  pinned.json               # Pinned Memory（少而硬）
  life.log.jsonl            # append-only 事件流（真相，建议带 hash 链）
  summaries/
    working_set.json
    consolidated.json
  attachments/
    avatar.jpg
```

**硬规则**
- life log append-only（禁止篡改历史）。
- 二进制附件不进 JSON（attachments 引用）。
- schema 变更必须 bump `schemaVersion` 并提供迁移策略。

---

## Roadmap（迁移说明）

Roadmap 已迁移到 `doc/Roadmap.md`，避免 README 过长与重复维护。  
其中包含：
- 产品理解与 CLI 版本边界（Soulseed 是人格资产运行时，不是普通聊天壳）
- 分阶段里程碑、交付物、DoD、风险与回滚策略
- **“先用 DeepSeek API 跑通全链路”** 的强制优先级与验收标准

请直接查看：`doc/Roadmap.md`

## 质量与评测体系（迁移说明）

质量治理与评测方案已整理到 `doc/Quality-Evaluation.md`。  
其中包含：
- 分层评测框架（L0-L5）与指标字典
- PR/Nightly/Release 门禁策略
- 数据集分层规范与 90 天实施路线

请直接查看：`doc/Quality-Evaluation.md`

---

## Dev AI 协作规则

- 读 `AGENT.md` 与 `contributing_ai.md`。
- 一次只做一个任务，交付整文件，不给 diff。
- 不删旧代码：迁移则归档到 `packages/legacy-*`。

---

## License

TBD
