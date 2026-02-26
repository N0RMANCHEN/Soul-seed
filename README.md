# Soulseed

**An AI persona that remembers, grows, and stays true to itself.**

**有记忆、有灵魂、跨时间持续成长的 AI 伙伴。**

[![License: CC%20BY--NC--ND%204.0](https://img.shields.io/badge/License-CC%20BY--NC--ND%204.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green)](https://nodejs.org/)
![Version](https://img.shields.io/badge/version-0.5.0-orange)

---

Soulseed is not a chatbot. It is a **portable persona runtime** — a soul that persists across conversations, carries its own memory, holds to its own values, and connects to any LLM API.

> Soulseed 不是聊天工具。它是一个**可移植的人格运行时** — 一个能跨越对话持续存在、拥有自己记忆与价值观、并可接入任意 LLM API 的 AI 灵魂。

---

## Quick Start / 快速开始

```bash
# 1) Install / 安装
npm install

# 2) Configure API / 配置 API
cp .env.example .env
# Edit .env: SOULSEED_API_KEY + SOULSEED_BASE_URL + SOULSEED_MODEL

# 3) Build / 构建
npm run build

# 4) Create persona / 创建人格
./ss new Aria

# 5) Start chat / 开始对话
./ss Aria
```

> **Windows users:** See [doc/Windows.md](doc/Windows.md) — WSL2 or Git Bash required, plus `sqlite3` CLI.
> **Windows 用户：** 参见 [doc/Windows.md](doc/Windows.md) — 需要 WSL2 或 Git Bash，以及 `sqlite3` CLI。

### Onboarding Pack / 上手资料包

- 快速上手（完整安装/初始化/首轮对话/验收/排障）：[`doc/Quickstart.md`](doc/Quickstart.md)
- 完整命令参考：[`doc/CLI.md`](doc/CLI.md)

---

## Installation / 安装

README 只保留 5 步摘要；完整步骤请直接看：

- [`doc/Quickstart.md`](doc/Quickstart.md)（推荐，含 15 分钟验收清单）
- [`doc/Windows.md`](doc/Windows.md)（Windows 环境）
- [`doc/CLI.md`](doc/CLI.md)（完整命令手册）

---

## API Configuration / API 配置

主路径配置：`SOULSEED_API_KEY` / `SOULSEED_BASE_URL` / `SOULSEED_MODEL`。  
详细 provider 配置、兼容变量（`DEEPSEEK_*`）与排障统一放在 [`doc/Quickstart.md`](doc/Quickstart.md)。

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

- **Provider-agnostic LLM adapter** — works with any OpenAI-compatible API; auto-detects provider from URL; model fallback chain for resilience
  *提供方无关的 LLM 适配器 — 兼容任意 OpenAI 接口；从 URL 自动识别提供方；支持模型候选链容错*
- **Four-type memory** — episodic · semantic · relational · procedural; SQLite + hybrid RAG
  *四类记忆 — 情节、语义、关系、程序；SQLite + 混合 RAG 检索*
- **Five-stage cognitive pipeline** — perception → idea → deliberation → meta-review → commit
  *五阶段认知流水线 — 感知 → 构想 → 审议 → 元审查 → 提交*
- **Adaptive reasoning depth** — defaults to fast path, escalates to deep only when complexity/ambiguity requires it
  *自适应思考深度 — 默认 fast，仅在复杂/歧义场景提升到 deep*
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
│  Execution:                                            │
│    dual-process routing (instinct / deliberative)     │
│    5-stage pipeline (perception -> commit)            │
│    soul-first: orchestrator decides before agent acts │
│                                                      │
│  Cognitive Safety:                                     │
│    5-layer consistency guard                           │
│    meta-review + self-revision loop                   │
│                                                      │
│  Runtime & Models:                                     │
│    provider-agnostic adapter + fallback chain         │
│                                                      │
│  Memory & State:                                       │
│    SQLite memory store + hybrid recall (FTS+vector)   │
│    latent state + state-delta protocol + audit trace  │
│                                                      │
│  Persona Package:                                      │
│    portable persona assets + append-only life log     │
└──────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              packages/mcp-server                     │
│    MCP JSON-RPC 2.0  (stdio + HTTP)                  │
│    Tools: persona.get_context · memory.search        │
│           conversation.save_turn · agent.run · ...   │
└──────────────────────────────────────────────────────┘
```

Folder/layer governance (source-of-truth) is defined in `doc/Architecture-Folder-Governance.md` and enforced by `npm run governance:check`.

---

## Persona Package / 人格包

Each persona is a self-contained, portable directory you fully own.

> 每个人格都是一个完全自主、可移植的目录 — 你完全拥有它。  
> **Single source of truth**: Full layout spec → `doc/Persona-Package-Layout.md`

Core files: `persona.json`, `identity.json`, `constitution.json`, `worldview.json`, `habits.json`, `user_profile.json`, `voice_profile.json`, `relationship_state.json`, `cognition_state.json`, `mood_state.json`, `genome.json`, `epigenetics.json`, `life.log.jsonl`, `memory.db`, `summaries/`, `latent/`, `goals/`, `golden_examples.jsonl`, `social_graph.json`. See spec for complete structure.

Model selection is runtime-managed via environment/config (`SOULSEED_PROVIDER`, `SOULSEED_MODEL`, optional `SOULSEED_MODEL_CANDIDATES`), not stored in persona assets.

> 模型选型由运行时环境配置管理（`SOULSEED_PROVIDER`、`SOULSEED_MODEL`、可选 `SOULSEED_MODEL_CANDIDATES`），不写入 persona 资产文件。

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
./ss new <Name> --quick             # Instant create with defaults / 极速创建
./ss doctor                         # Health check / 健康检查

# Persona management / 人格管理
./ss persona inspect [--persona <path>]
./ss persona lint [--persona <path>] [--strict]
./ss persona compile [--persona <path>] [--out <file>]
./ss persona export --out <dir> [--persona <path>]
./ss persona import --in <src_dir> --out <dest_dir>

# Memory / 记忆
./ss memory search --query <q> [--persona <path>]
./ss memory consolidate [--persona <path>]
./ss memory pin add|list|remove [--text <memory>] [--persona <path>]

# Advanced / 进阶
./ss explain --last [--persona <path>]
./ss finetune export-dataset --out <path.jsonl> [--persona <path>]
./ss mcp [--persona <path>] [--transport stdio|http] [--host 127.0.0.1] [--port 8787] [--auth-token <token>]
```

Full reference: [`doc/CLI.md`](doc/CLI.md)

---

## MCP Server / MCP 服务器

```bash
# Read-only mode (default) / 只读模式（默认）
./ss mcp

# Enable write tools / 启用写入工具
SOULSEED_MCP_ALLOW_WRITES=true ./ss mcp

# HTTP transport with auth token / HTTP 传输 + 鉴权
./ss mcp --transport http --host 127.0.0.1 --port 8787 --auth-token <token>
```

Available tools: `persona.get_context`, `memory.search`, `memory.search_hybrid`, `conversation.save_turn`, `agent.run`, `goal.create/list/get/cancel`, `trace.get`, `consistency.inspect`, and more.

---

## Environment Variables / 环境变量

| Variable | Default | Description / 说明 |
|---|---|---|
| `SOULSEED_PROVIDER` | inferred from base URL | Provider key / 提供方标识 |
| `SOULSEED_API_KEY` | — | LLM API key (required) / LLM API 密钥（必填） |
| `SOULSEED_BASE_URL` | — | OpenAI-compatible base URL (required) / 兼容 OpenAI 的接口地址（必填） |
| `SOULSEED_MODEL` | `deepseek-chat` (for DeepSeek) | Model name / 模型名称 |
| `SOULSEED_MODEL_CANDIDATES` | — | Optional fallback chain (comma-separated) / 可选候选链（逗号分隔） |
| `SOULSEED_ANTHROPIC_MAX_TOKENS` | `2048` | Anthropic native `max_tokens` / Anthropic 原生输出上限 |
| `SOULSEED_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model / 嵌入模型 |
| `SOULSEED_EMBEDDING_DIM` | `1024` | Embedding dimension / 嵌入维度 |
| `SOULSEED_LLM_RETRIES` | `2` | Max retries (0–5) / 最大重试次数 |
| `SOULSEED_LLM_TIMEOUT_MS` | `35000` | Request timeout in ms / 请求超时（毫秒） |
| `SOULSEED_ADAPTIVE_REASONING` | `1` | Adaptive fast/deep reasoning gate / 自适应 fast/deep 思考开关 |
| `SOULSEED_THINKING_PREVIEW` | follows persona profile | Enable slow-turn preview utterance / 启用慢回合思考前置短提示 |
| `SOULSEED_THINKING_PREVIEW_THRESHOLD_MS` | `1000` | Preview threshold in ms / 前置提示触发阈值（毫秒） |
| `SOULSEED_THINKING_PREVIEW_MODEL_FALLBACK` | `0` | Allow LLM fallback for preview text / 是否允许用模型生成前置提示 |
| `SOULSEED_THINKING_PREVIEW_MAX_MODEL_MS` | `220` | Max preview LLM time in ms / 前置提示模型最大耗时（毫秒） |
| `SOULSEED_MCP_ALLOW_WRITES` | `false` | Enable write tools in MCP / 启用 MCP 写入工具 |
| `SOULSEED_OWNER_KEY` | — | Owner-level auth / 所有者级别鉴权 |
| `DEEPSEEK_API_KEY` | — | Legacy: falls back if `SOULSEED_API_KEY` not set / 旧版兼容 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | Legacy: falls back if `SOULSEED_BASE_URL` not set / 旧版兼容 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | Legacy: falls back if `SOULSEED_MODEL` not set / 旧版兼容 |

---

## Project Structure / 项目结构

```
packages/
  core/           # Core domain modules
    src/
      runtime/    # execution protocol / routing / adapters
      memory/     # memory store / recall / consolidation / budget
      persona/    # package read-write / lint / compile / migration
      state/      # state delta / domain states / genome / invariants
      guards/     # consistency and risk guards
      governance/ # doctor / replay / trace / eval helpers
      capabilities/ # capability registry & intent/policy
      proactive/  # proactive engine
  cli/            # CLI shell: ./ss entry + interactive logic
  mcp-server/     # MCP JSON-RPC 2.0 server
scripts/
  verify.sh              # Single verification entry (lint + h0 + direct-writes + changelog + typecheck + test + build)
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
npm run governance:check # Architecture/folder governance gate / 架构与目录治理门禁
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
| [`doc/Architecture-Folder-Governance.md`](doc/Architecture-Folder-Governance.md) | Architecture/folder governance standard / 架构与文件夹治理标准 |
| [`doc/Runtime-Report-Asset-Governance.md`](doc/Runtime-Report-Asset-Governance.md) | personas/ & reports/ retention/archive policy / 运行态与报告资产治理 |
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
- New latent dimensions → add to `governance/doctor.ts` + `types.ts`

---

## License / 许可证

CC BY-NC-ND 4.0 — see [LICENSE](LICENSE) for details.

Copyright (c) 2026 hirohi
