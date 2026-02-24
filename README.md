# Soulseed

**An AI persona that remembers, grows, and stays true to itself.**

**有记忆、有灵魂、跨时间持续成长的 AI 伙伴。**

[![License: CC%20BY--NC--ND%204.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org/)
![Version](https://img.shields.io/badge/version-0.2.0-orange)

---

Soulseed is not a chatbot. It is a **portable persona runtime** — a soul that persists across conversations, carries its own memory, holds to its own values, and connects to any LLM API.

> Soulseed 不是聊天工具。它是一个**可移植的人格运行时** — 一个能跨越对话持续存在、拥有自己记忆与价值观、并可接入任意 LLM API 的 AI 灵魂。

---

## Quick Start / 快速开始

```bash
# 1. Install dependencies / 安装依赖
npm install

# 2. Add your API key / 填入 API Key
cp .env.example .env
# Edit .env — set DEEPSEEK_API_KEY (any OpenAI-compatible API works)

# 3. Build / 构建
npm run build

# 4. Create your first persona / 创建你的第一个人格
./ss new Aria
# → One question. One answer. Done.
# → 只需一个选择，完成创建。

# 5. Start talking / 开始对话
./ss Aria
```

> **Windows users:** See [doc/Windows.md](doc/Windows.md) — WSL2 or Git Bash required, plus `sqlite3` CLI.
> **Windows 用户：** 参见 [doc/Windows.md](doc/Windows.md) — 需要 WSL2 或 Git Bash，以及 `sqlite3` CLI。

### Onboarding Pack / 上手资料包

- 快速上手（含 15 分钟验收、故障排查、首轮示例）：[`doc/Quickstart.md`](doc/Quickstart.md)
- 完整命令参考：[`doc/CLI.md`](doc/CLI.md)

---

## Installation / 安装

### Prerequisites / 前置条件

- **Node.js** >= 18.0
- **npm** >= 9.0 (or equivalent package manager)
- **sqlite3** (for development; usually pre-installed on macOS/Linux)
  - Windows users: see [doc/Windows.md](doc/Windows.md)

> **Node.js 版本:** >= 18.0
> **npm 版本:** >= 9.0
> **sqlite3:** 用于开发环境；macOS/Linux 通常预装

### Step 1: Clone Repository / 克隆仓库

```bash
git clone https://github.com/hirohi/soul-seed.git
cd soul-seed
```

### Step 2: Install Dependencies / 安装依赖

```bash
npm install
```

This installs all dependencies for `packages/core`, `packages/cli`, and `packages/mcp-server`.

> 这会安装 `packages/core`、`packages/cli` 和 `packages/mcp-server` 所有依赖。

### Step 3: Build / 构建

```bash
npm run build
```

Compiles TypeScript to JavaScript in each package.

> 在每个包中将 TypeScript 编译为 JavaScript。

---

## API Configuration / API 配置

Soulseed uses **OpenAI-compatible LLM APIs** (e.g., DeepSeek, OpenAI, Mistral, etc.).

> Soulseed 支持**兼容 OpenAI 的 LLM API**（如 DeepSeek、OpenAI、Mistral 等）。

### Step 1: Create `.env` File / 创建 `.env` 文件

```bash
cp .env.example .env
```

### Step 2: Add Your API Key / 添加 API 密钥

Open `.env` and fill in your credentials:

```bash
# Required / 必填
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional / 可选（通常不需要修改）
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

### Supported API Providers / 支持的 API 提供商

| Provider / 提供商 | Base URL | Default Model / 默认模型 | API Key |
|---|---|---|---|
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | [platform.deepseek.com](https://platform.deepseek.com) |

> **Current status / 当前状态：**  
> ✅ **DeepSeek is supported.**  
> ✅ **目前仅支持 DeepSeek。**  
> Other providers will be added later. / 其他供应商将在后续版本补充支持。
> 

### Step 3: Verify Configuration / 验证配置

```bash
# Quick health check / 快速健康检查
./ss doctor
```

If everything is configured correctly, you should see:
- ✓ Core directories initialized
- ✓ Default personas found
- ✓ API connectivity OK

> 如果配置正确，应该看到上述检查项全部通过。

### Step 4: (Optional) Test API Connection / 可选：测试 API 连接

```bash
# Use the built-in Alpha persona to test / 使用内置 Alpha 人格测试
./ss Alpha

# In the chat, type / 在对话中输入：
# "ping" or "测试连接" or "hello"
# The persona should respond normally
```

---

## Built-in Personas / 内置人格

No setup required. Just run. / 无需创建，直接使用。

```bash
./ss Alpha    # Your guide — operates Soulseed for you in plain language
              # 你的向导 — 用自然语言帮你操作整个系统

./ss Beta     # Your diagnostician — root-cause analysis for persona issues
              # 你的诊断师 — 系统与人格问题的专业排查
```

Alpha is designed for users with no CLI knowledge — just tell it what you want.
Beta is for developers debugging persona behavior or system issues.

> Alpha 面向完全不懂命令行的用户 — 用自然语言说出你想做的事，它会替你完成。
> Beta 面向开发者 — 像 QA 工程师一样，帮你定位人格行为和系统问题的根因。

---

## What Makes It Different / 它有什么不同

| | Chatbot / 聊天机器人 | Soulseed |
|---|---|---|
| Memory / 记忆 | Resets every session | Persistent, four-type, SQLite + vector |
| Identity / 身份 | Stateless | Anchored — personaId never changes |
| Values / 价值观 | None | Constitution with mission, values, boundaries |
| State / 状态 | None | Mood, relationship, belief — latent vectors |
| Portability / 可移植 | Cloud-locked | A directory you own and control |
| Trust / 可信 | Black box | Life.log hash chain, doctor audit, drift detection |

---

## Features / 核心能力

- **Four-type memory** — episodic · semantic · relational · procedural; SQLite + hybrid RAG
  *四类记忆 — 情节、语义、关系、程序；SQLite + 混合 RAG 检索*
- **Five-stage cognitive pipeline** — perception → idea → deliberation → meta-review → commit
  *五阶段认知流水线 — 感知 → 构想 → 审议 → 元审查 → 提交*
- **Five-layer consistency guard** — identity · relational · recall · factual · constitution
  *五层一致性守护 — 身份、关系、记忆接地、事实接地、宪法规则*
- **Soul-first execution** — orchestrator always decides before any agent acts
  *灵魂优先执行 — orchestrator 决策永远先于 Agent 行动*
- **Latent vector state** — mood, relationship, voice, belief live in high-dimensional vectors
  *隐向量状态 — 情绪、关系、声音、信念以高维向量形式存在*
- **Portable Persona Package** — one directory, backup-able, version-controllable, migratable
  *可移植人格包 — 一个目录，可备份、可版本控制、可迁移*
- **MCP server** — JSON-RPC 2.0 (stdio + HTTP), connect any external LLM to a running persona
  *MCP 服务器 — JSON-RPC 2.0，将任意外部 LLM 接入正在运行的人格*
- **Doctor & audit** — constitution scoring, drift detection, hash-chain integrity, latent health check
  *诊断与审计 — 宪法评分、行为漂移检测、哈希链完整性、隐向量健康检查*

---

## Architecture / 架构

```
┌─────────────────────────────────────────────────────┐
│                    packages/cli                      │
│                ./ss  (entry + orchestration)         │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  packages/core                       │
│                                                      │
│  execution_protocol                                  │
│    ├─ dual_process_router  (instinct / deliberative) │
│    └─ runtime_pipeline     (5-stage pipeline)        │
│         ├─ [soul]  orchestrator.decide → LLM        │
│         └─ [agent] agent_engine (Planner/Executor)  │
│                                                      │
│  consistency_kernel (5-layer guard)                  │
│    identity · relational · recall_grounding          │
│    factual_grounding · constitution_rules            │
│                                                      │
│  meta_review  (LLM meta-cognition: quality+verdict)  │
│  self_revision (habits/voice/relationship correction)│
│                                                      │
│  Memory Stack:                                       │
│    memory_store (SQLite) + memory_embeddings (vector)│
│    Hybrid RAG = FTS + vector + salience fusion       │
│                                                      │
│  Persona Package (file truth layer):                 │
│    constitution · habits · worldview · soul_lineage  │
│    life.log.jsonl (append-only + hash chain)         │
│    memory.db (SQLite, 4-state lifecycle)             │
└──────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              packages/mcp-server                     │
│    MCP JSON-RPC 2.0  (stdio + HTTP)                  │
│    Tools: persona.get_context · memory.search        │
│           conversation.save_turn · agent.run · ...   │
└──────────────────────────────────────────────────────┘
```

---

## Persona Package / 人格包

Each persona is a self-contained, portable directory you fully own.

> 每个人格都是一个完全自主、可移植的目录 — 你完全拥有它。

```
<Name>.soulseedpersona/
  persona.json              # id, displayName, schemaVersion, defaultModel
  identity.json             # identity anchor (personaId never changes)
  constitution.json         # mission / values / boundaries / commitments
  worldview.json            # worldview seed (evolvable)
  habits.json               # style, quirks, topics of interest
  user_profile.json         # user name / language preference
  voice_profile.json        # tone preference, phrasePool
  relationship_state.json   # relationshipLatent[64]
  cognition_state.json      # voiceLatent[16] / beliefLatent[32] / routingWeights
  mood_state.json           # moodLatent[32] (valence/arousal projection)
  soul_lineage.json         # parent/children lineage, consentMode
  life.log.jsonl            # append-only event stream (prevHash/hash chain)
  memory.db                 # SQLite 4-state memory store
  autobiography.json        # life narrative chapters
  interests.json            # memory-emergent interest weights
  self_reflection.json      # periodic self-reflection journal
  golden_examples.jsonl     # few-shot example library (≤50 entries)
  social_graph.json         # social relationship graph (≤20 people)
  summaries/
    life_archive.jsonl      # rotated life.log archive
  latent/                   # latent vector checkpoints (rollback-capable)
  goals/                    # agent goal and planning context
```

**Invariants / 不变量:**
- `life.log.jsonl` is append-only; history is immutable (broken chain writes a scar event)
  *`life.log.jsonl` 只增不改；历史不可篡改（链断则写入疤痕事件）*
- Binary attachments stored as references, never inline
  *二进制附件只存引用，不内嵌*
- Schema changes bump `schemaVersion` with a migration strategy
  *Schema 变更通过 `schemaVersion` + 迁移策略管理*

---

## CLI Reference / 命令参考

```bash
# Core / 核心
./ss <Name>                         # Start chat / 开始对话
./ss new <Name>                     # Create persona / 创建人格
./ss new <Name> --advanced          # Full setup wizard / 完整配置向导
./ss new <Name> --quick             # Instant create with defaults / 极速创建
./ss doctor                         # Health check / 健康检查

# Persona management / 人格管理
./ss persona list
./ss persona lint [Name]
./ss persona inspect <Name>
./ss persona export <Name> <out>
./ss persona import <file>
./ss persona arc show [Name]
./ss persona autobiography show|distill [Name]
./ss persona voice-phrases list|add|remove [Name]

# Memory / 记忆
./ss memory search <query> [Name]
./ss memory consolidate [Name]
./ss pinned list|add|remove [Name]
./ss examples list|add|remove [Name]

# Advanced / 进阶
./ss explain --last [Name]
./ss cognition adapt-routing [Name]
./ss finetune export-dataset [Name]
./ss space <Name> [--path <dir>] [--remove]
./ss mcp-server [--http]
```

Full reference: [`doc/CLI.md`](doc/CLI.md)

---

## MCP Server / MCP 服务器

```bash
# Read-only mode (default) / 只读模式（默认）
./ss mcp-server

# Enable write tools / 启用写入工具
SOULSEED_MCP_ALLOW_WRITES=true ./ss mcp-server

# HTTP transport with auth token / HTTP 传输 + 鉴权
SOULSEED_MCP_TOKEN=<token> ./ss mcp-server --http
```

Available tools: `persona.get_context`, `memory.search`, `memory.search_hybrid`, `conversation.save_turn`, `agent.run`, `goal.create/list/get/cancel`, `trace.get`, `consistency.inspect`, and more.

---

## Environment Variables / 环境变量

| Variable | Default | Description / 说明 |
|---|---|---|
| `DEEPSEEK_API_KEY` | — | LLM API key (required) / LLM API 密钥（必填） |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI-compatible base URL / 兼容 OpenAI 的接口地址 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Model name / 模型名称 |
| `SOULSEED_MCP_ALLOW_WRITES` | `false` | Enable write tools in MCP / 启用 MCP 写入工具 |
| `SOULSEED_MCP_TOKEN` | — | Auth token for HTTP MCP / HTTP MCP 鉴权 Token |
| `SOULSEED_OWNER_KEY` | — | Owner-level auth / 所有者级别鉴权 |

---

## Project Structure / 项目结构

```
packages/
  core/           # Pure core: memory / orchestration / guards / persona I/O
  cli/            # CLI shell: ./ss entry + interactive logic
  mcp-server/     # MCP JSON-RPC 2.0 server
scripts/
  verify.sh              # Single verification entry (lint + typecheck + test + build)
  acceptance.sh          # Online acceptance (uses QA persona)
  eval_mood.mjs          # Mood latent regression test
datasets/
  quality/        # Retrieval / grounding / safety regression datasets
  mood/           # Mood latent regression cases
doc/
  CLI.md                   # Complete CLI command reference
  Roadmap.md               # Product phases and milestones
  Quality-Evaluation.md    # Layered evaluation framework (L0–L5)
  Windows.md               # Windows-specific install notes
personas/
  <Name>.soulseedpersona/  # Your persona directories (soul data git-ignored)
  defaults/                # Built-in personas: Alpha · Beta
  _qa/                     # Acceptance-isolated QA persona
```

**Persona name resolution:** `./ss <name>` checks `personas/` first, then `personas/defaults/`. Use `./ss Alpha` or `./ss Beta` directly. New personas cannot use reserved names.

> **人格名称解析：** `./ss <name>` 先查 `personas/`，再查 `personas/defaults/`。`./ss Alpha` / `./ss Beta` 可直接使用。新建人格不能使用保留名称。

---

## Development / 开发

```bash
npm run build          # Build all packages / 构建所有包
npm run test           # Run all tests / 运行测试
npm run lint           # TypeScript type-check / 类型检查
npm run verify         # Full verification / 完整验证
npm run acceptance     # Online acceptance test / 在线验收测试
npm run eval:all       # Full quality evaluation / 完整质量评估
```

---

## Documentation / 文档

| Doc | Contents / 内容 |
|---|---|
| [`doc/Quickstart.md`](doc/Quickstart.md) | 5-minute onboarding guide / 5分钟上手指南 |
| [`doc/CLI.md`](doc/CLI.md) | Complete command reference / 完整命令参考 |
| [`doc/Roadmap.md`](doc/Roadmap.md) | Product phases and milestones / 产品阶段与里程碑 |
| [`doc/Product-Standards.md`](doc/Product-Standards.md) | Product-wide implementation standards / 全产品通用实施规范 |
| [`doc/Quality-Evaluation.md`](doc/Quality-Evaluation.md) | Layered evaluation system (L0–L5) / 分层评估体系 |
| [`doc/Windows.md`](doc/Windows.md) | Windows installation guide / Windows 安装指南 |
| [`AGENT.md`](AGENT.md) | AI collaboration guide / AI 协作指南 |

---

## Contributing / 贡献

- Read `AGENT.md` first (takes precedence over `contributing_ai.md`)
  *先读 `AGENT.md`（优先级高于 `contributing_ai.md`）*
- All changes must pass `./scripts/verify.sh`
  *所有变更必须通过 `./scripts/verify.sh`*
- Every change must run a documentation impact check (see `AGENT.md` Doc Sync Gate)
  *每次变更都必须执行文档影响排查（见 `AGENT.md` 的 Doc Sync Gate）*
- Online path changes require an `npm run acceptance` report
  *涉及在线路径的变更需附上 `npm run acceptance` 报告*
- New session capabilities → register in `capabilities/registry.ts` + `intent_resolver.ts`
- New latent dimensions → add to `doctor.ts` + `types.ts`

---

## License / 许可证

CC BY-NC-ND 4.0 — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 hirohi
