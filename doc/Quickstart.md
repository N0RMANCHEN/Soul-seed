# Quickstart / 5分钟上手

Get from zero to your first conversation in five steps.

> 五步完成从零到第一次对话。

---

## Prerequisites / 前置要求

- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **sqlite3 CLI** — bundled on macOS/Linux; Windows users see [Windows.md](Windows.md)
- **An API key** — any OpenAI-compatible API works (DeepSeek, OpenAI, Anthropic via proxy, etc.)
  *任何兼容 OpenAI 接口的 API 均可（DeepSeek、OpenAI、通过代理的 Anthropic 等）*

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
# Generic (any OpenAI-compatible provider)
SOULSEED_API_KEY=sk-xxxxxxxxxxxxxxxx
SOULSEED_BASE_URL=https://your-openai-compatible-api-provider/v1
SOULSEED_MODEL=claude-sonnet-4-6

# Or use legacy DeepSeek config (still works)
# DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL=deepseek-chat
```

> Any OpenAI-compatible endpoint works. Legacy `DEEPSEEK_*` vars are still supported.
> 任何兼容 OpenAI 的接口都可以用。旧版 `DEEPSEEK_*` 变量仍然支持。

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

---

## 15-Min Validation Checklist / 15 分钟验收清单

目标：在 15 分钟内完成安装、创建、首轮对话与基础验证。

### 1) 环境准备（约 5 分钟）

```bash
npm install
cp .env.example .env
# 编辑 .env，填写 DEEPSEEK_API_KEY
npm run build
./ss doctor
```

期望：`doctor` 输出核心检查通过，且没有阻塞错误。

### 2) 创建第一个人格（约 3 分钟）

```bash
./ss new Aria --quick
```

期望：终端输出 `已创建 persona`，并生成 `./personas/Aria.soulseedpersona/`。

### 3) 首轮对话（约 5 分钟）

```bash
./ss Aria
```

可直接输入：
- `你好，我们先定一个对话风格：简洁+明确结论。`
- `记住：我叫 Hiro。`
- `你刚才记住了什么？`

期望：
- 人格有稳定称呼与上下文连续性。
- 不出现明显你/我主语错位。

### 4) 常用验证命令（约 2 分钟）

```bash
./ss persona lint --persona ./personas/Aria.soulseedpersona
./ss persona compile --persona ./personas/Aria.soulseedpersona --out /tmp/aria.snapshot.json
./ss explain --last --persona ./personas/Aria.soulseedpersona
```

---

## First Session Example / 首轮会话示例

场景目标：演示首次会话里的风格设定、事实记忆与追问。

输入示例：
1. `你好，我们说中文，回答尽量先给结论。`
2. `记住：我叫 Hiro，我在东京。`
3. `你刚才记住了什么？`
4. `如果我明天说“我改名了”，你会怎么处理？`

期望行为：
- 第 1 轮：确认语言与输出风格偏好。
- 第 2 轮：提取并记录用户事实（名字、地点）。
- 第 3 轮：可复述已记录事实，不乱编。
- 第 4 轮：说明会更新新事实并保留变更上下文。

对应命令：

```bash
./ss Aria
./ss memory facts list --persona ./personas/Aria.soulseedpersona
./ss explain --last --persona ./personas/Aria.soulseedpersona
```

---

## Troubleshooting / 常见故障排查

### 1) `./ss doctor` 报依赖缺失
现象：提示缺少 `sqlite3` 或 API Key。

处理：
1. 确认 `sqlite3` 可执行：`sqlite3 --version`
2. 检查 `.env` 是否已填写 `DEEPSEEK_API_KEY`
3. 重新执行：`./ss doctor`

### 2) 启动聊天时报模型连接失败
现象：会话中出现“模型连接波动/回复失败”。

处理：
1. 检查网络与 API 配置（`DEEPSEEK_BASE_URL` / `DEEPSEEK_API_KEY`）
2. 使用 `./ss doctor` 复检
3. 重启会话并重试

### 3) 人格文件异常或版本不一致
现象：`persona lint` 失败或 `persona compile` 失败。

处理：
1. 执行 `./ss persona lint --persona <path>` 查看具体字段错误
2. 修正后重新执行 `./ss persona compile --persona <path>`
3. 如为历史包，优先用 `persona export/import` 走一次标准化流程

### 4) 对话里出现代词/主语错位
现象：你/我/他/她归因不稳定。

处理：
1. 升级到最新版本（包含主语归因守卫修复）
2. 在输入里明确主语，例如“我昨天做了 X”“她刚刚说了 Y”
3. 使用 `./ss explain --last` 检查该轮决策与守卫信息

### 5) 回归验证建议

```bash
npm run verify
```

若失败：
1. 先看失败测试名
2. 再定位对应模块（`packages/core` 或 `packages/cli`）
3. 修复后重新执行 `npm run verify`
