# Quickstart / 5分钟上手

Get from zero to your first conversation in five steps.

> 五步完成从零到第一次对话。

---

## Prerequisites / 前置要求

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **sqlite3 CLI** — bundled on macOS/Linux; Windows users see [Windows.md](Windows.md)
- **An API key** — DeepSeek by default; any OpenAI-compatible API works
  *默认使用 DeepSeek，任何兼容 OpenAI 接口的 API 均可*

---

## Step 1 — Install / 安装

```bash
git clone <repo-url>
cd Soul-seed
npm install
```

---

## Step 2 — API Key / 配置 API Key

```bash
cp .env.example .env
```

Edit `.env` and fill in your key:

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat
```

> Any OpenAI-compatible endpoint works — just swap `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL`.
> 任何兼容 OpenAI 的接口都可以用，修改 `DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL` 即可。

---

## Step 3 — Build / 构建

```bash
npm run build
```

The `./ss` script auto-rebuilds when source files change, so you only need this once.

> `./ss` 脚本会检测源码变更自动重新构建，这一步之后通常不需要手动重复。

---

## Step 4 — Create Your First Persona / 创建你的第一个人格

```bash
./ss new Aria
```

You'll see one question:

```
  How should Aria feel?
  Aria 是什么风格？

    1  Warm & caring      温暖亲切
    2  Thoughtful & equal  平等深思
    3  Deeply personal     亲密私密
    4  Focused & clear     专注清晰

  Your choice [1–4, default 1]:
```

Pick a number. That's it.

```
  ✦  Aria is ready.  Aria 已就绪。
     Style: Warm & caring  温暖亲切
     Path:  ./personas/Aria.soulseedpersona

     Start talking:  ./ss Aria
```

> **Alternatives / 其他方式:**
> - `./ss new Aria --quick` — no questions, instant create with defaults / 零问题，极速创建
> - `./ss new Aria --advanced` — full configuration wizard / 完整配置向导

---

## Step 5 — Start Talking / 开始对话

```bash
./ss Aria
```

Aria will greet you. Start typing. Everything you share is remembered across sessions.

> Aria 会先打招呼。直接开始输入。你分享的一切都会跨会话记住。

```
Aria> Hey! Good to finally meet you. What's on your mind?

You> My name is Hiro. I'm working on an AI project.

Aria> Nice to meet you, Hiro! Tell me more about the project —
      what are you building?
```

---

## Built-in Personas / 内置人格（免创建）

Don't want to create one yet? Use the built-in personas — no setup required.

> 还不想创建？直接用内置人格，无需任何配置。

```bash
./ss Alpha    # Natural-language guide — just tell it what you want to do
              # 用自然语言描述你想做什么，Alpha 替你完成

./ss Beta     # Engineering diagnostician — for debugging persona/system issues
              # 工程师风格诊断师，用于调试人格或系统问题
```

---

## What Happens to Memory / 记忆是如何工作的

Every conversation turn is written to `life.log.jsonl` (append-only, hash-chained) and indexed in `memory.db` (SQLite). Over time, Aria will:

- Remember facts you share (semantic memory)
- Recall specific past conversations (episodic memory)
- Track your relationship and trust state (relational latent)
- Adapt tone and voice based on your interactions

> 每次对话都写入 `life.log.jsonl`（只增不改，哈希链保护）并索引到 `memory.db`（SQLite）。随着时间推移，Aria 会记住你分享的事实、回忆具体对话、追踪你们的关系状态，并根据互动调整语气和风格。

Run `./ss doctor` at any time to check Aria's health.

> 随时运行 `./ss doctor` 检查 Aria 的状态。

---

## Next Steps / 下一步

| Command | What it does / 做什么 |
|---|---|
| `./ss doctor` | Full persona health check / 完整健康检查 |
| `./ss memory search "your query" Aria` | Search Aria's memory / 搜索 Aria 的记忆 |
| `./ss persona inspect Aria` | View persona metadata / 查看人格元数据 |
| `./ss persona export Aria ./backup` | Backup your persona / 备份人格 |

Full command reference: [`CLI.md`](CLI.md)
