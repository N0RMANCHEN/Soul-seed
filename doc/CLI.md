# Soulseed CLI 完整命令参考

> 对应 `packages/cli/src/index.ts` 实际实现。二进制入口：`./ss`

---

## 1. 一次性准备

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
npm run build
```

---

## 2. 最短入口

```bash
./ss                         # 查看帮助
./ss new Teddy               # 创建 persona（交互向导）
./ss Teddy                   # 直接进入 Teddy 对话
./ss doctor                  # 全量健康检查
./ss explain --last          # 解释上一轮决策
```

说明：
- 未指定 `--persona` 时自动发现 `./personas/*.soulseedpersona`
- 推荐主路径：`./ss new <name>` + `./ss <name>`
- 验收请使用隔离 QA persona：`npm run acceptance`

---

## 3. 全量命令清单

---

### 3.1 Persona 创建与管理

#### `new`

```bash
./ss new <name> [--out <personaPath>] [--template friend|peer|intimate|neutral] [--model <model>] [--quick]
```

交互式创建新 persona 包，采集模板、世界观、使命、价值观、风格等。`--quick` 按模板默认值快速创建，跳过交互。

#### `init`（兼容入口）

```bash
./ss init [--name Soulseed] [--out ./personas/<name>.soulseedpersona]
```

等同于 `persona init`，保留旧脚本兼容性。

#### `rename`

```bash
# 第 1 步：写入改名请求（10 分钟内有效）
./ss rename --to <newName> [--persona <path>]

# 第 2 步：确认执行
./ss rename --to <newName> [--persona <path>] --confirm
```

双阶段确认防误操作。`personaId` 不变。

#### `persona init`（兼容别名）

```bash
./ss persona init --name <displayName> --out <personaPath>
```

#### `persona rename`（兼容别名）

```bash
./ss persona rename --to <newName> [--persona <path>] [--confirm]
```

#### `persona reproduce`

```bash
./ss persona reproduce --name <childName> [--persona <path>] [--out <path>] [--force-all]
```

从父 persona 繁衍子 persona，提取精神遗产写入 `spiritual_legacy.txt`。
- `--force-all`：跳过 libido / consent / safety_boundary 条件检查
- 输出：子 persona 路径 + `child_persona_id`

#### `persona inspect`

```bash
./ss persona inspect [--persona <path>]
```

输出：`displayName`、`personaId`、文件数、总大小（MB）、生命日志事件数、附件数、所有文件清单（含大小和 SHA-256 前缀）。

#### `persona export`

```bash
./ss persona export --out <dir> [--persona <path>]
```

带 `MANIFEST.json`（SHA-256 哈希）的完整人格包导出。输出：`{ok, outPath, personaId, displayName, filesExported}`。

#### `persona import`

```bash
./ss persona import --in <srcDir> --out <destDir>
```

SHA-256 哈希校验后导入，失败自动回滚并列出错误。输出：`{ok, destPath, personaId, displayName, filesImported}`。

#### `persona model-routing`

```bash
./ss persona model-routing [--show] [--instinct <model>] [--deliberative <model>] [--meta <model>] [--reset] [--persona <path>]
```

管理三路模型配置（instinct / deliberative / meta 各可独立设置不同模型）。
- 无修改参数：显示当前路由配置
- `--reset`：将三路由全部重置为 `defaultModel`

---

### 3.2 会话（Chat）

#### 主入口

```bash
./ss <personaName> [--model <model>] [--strict-memory-grounding true|false] [--adult-mode true|false] [--age-verified true|false] [--explicit-consent true|false] [--fictional-roleplay true|false]
```

自动解析 `./personas/<name>.soulseedpersona`，不存在时提示创建。

#### 兼容入口

```bash
./ss chat [--persona <path>] [--model <model>] [同上参数...]
```

模型优先级：`--model` > persona `defaultModel` > `deepseek-chat`

**自动行为**：
- 会话启动时后台触发轻量记忆整合（`trigger=chat_open`）
- 会话退出时后台触发轻量记忆整合（`trigger=chat_close`）
- 每轮调用 `extractUserFactsFromTurn()` 提取用户事实

**Owner 授权**（敏感能力门控）：
- 会话内输入 `owner <口令>` 激活 15 分钟 owner 权限
- 授权后可执行 `adult_mode on confirmed=true` 等高风险能力调用

#### 会话内 / 命令

| 命令 | 说明 |
|------|------|
| `/exit` | 退出会话 |
| `/files` | 列出已附加文件和已抓取网址 |
| `/clearread` | 清空所有附加内容（文件/网址/阅读上下文） |
| `/paste on` | 开始粘贴模式（逐行累积） |
| `/paste off` | 结束粘贴并一次性提交全部内容 |
| `/read <file_path>` | 附加本地文本文件到当前会话上下文 |
| `/relation` | 查看关系状态（state + confidence） |
| `/relation detail` | 查看关系状态详情（六维评分 + 认知平衡 + 驱动因素） |
| `/proactive status` | 查看主动消息触发概率（%/tick）与静默时段 |
| `/proactive quiet <HH-HH>` | 设置静默时段（例 `22-8`）；`quiet off` 取消 |
| `/proactive on\|off` | 兼容命令（实际不修改参数，主动倾向由人格自决） |
| `/rename confirm <newName>` | 在聊天内确认改名请求 |
| `/reproduce force <childName>` | 强制触发繁衍（绕过所有条件检查） |

---

### 3.3 Doctor 体检

```bash
./ss doctor [--persona <path>] [--check-constitution] [--check-drift]
```

- **无 flag**：调用 `doctorPersona()`，全量 persona 健康检查，输出 JSON 报告；失败时 exitCode=2
- **`--check-constitution`**：调用 `scoreConstitutionQuality()`，输出宪法质量评分（0-100，等级 A/B/C/D）；D 级时 exitCode=2
- **`--check-drift`**：调用 `computeBehaviorMetrics()` + `detectBehaviorDrift()`，检测行为漂移维度；有漂移时 exitCode=2

Doctor 检查项（全量模式）：
- persona 文件完整性（必需文件是否齐全）
- schemaVersion 合法性
- life.log.jsonl hash 链完整性（无断链）
- memory.db schema/version/table 完整性
- 事件 payload 合法性
- 记忆生命周期指标（memory_dynamics）
- 关系/声音配置（relationship_voice）
- 自我修正记录（self_revision）

---

### 3.4 Explain 决策解释

```bash
./ss explain --last [--persona <path>]
# 等效别名:
./ss explain last [--persona <path>]
```

读取上一轮 `assistant_message` 的 DecisionTrace，输出四块自然语言解释：
1. **路由路径**：走直觉路径还是深思路径，原因是什么
2. **记忆依据**：调用了哪些记忆，为什么选这些
3. **边界检查**：宪法边界是否命中，如何影响回复
4. **语气立场**：声音/立场选择的理由

若无记录（未对话过）则提示先开始一次对话。

---

### 3.5 Refine 宪法精炼

#### `refine constitution|habits|worldview`

```bash
./ss refine constitution|habits|worldview [--persona <path>] [--trigger manual|auto]
```

调用 `proposeConstitutionCrystallization()`，从记忆行为模式提炼精炼提案，列出 before/after 差异。无差异时输出"无需精炼"；有差异时提示用 `refine apply` 或 `refine reject`。

#### `refine list`

```bash
./ss refine list [--persona <path>] [--domain constitution|habits|worldview] [--status pending|applied|rejected]
```

列出所有精炼记录（默认 limit=20），每行：`[status] id domain trigger diffs created`。

#### `refine apply`

```bash
./ss refine apply --id <runId> [--persona <path>]
```

应用精炼提案，写入对应 JSON 文件（constitution / habits / worldview）。

#### `refine reject`

```bash
./ss refine reject --id <runId> [--persona <path>]
```

标记精炼提案为已拒绝，不修改任何文件。

#### `refine rollback`

```bash
./ss refine rollback --id <runId> [--persona <path>]
```

撤销已应用的精炼提案，恢复字段原值。

#### `refine diff`

```bash
./ss refine diff --id <runId> [--persona <path>]
```

逐字段打印：field / 原因 / 变更前（截120字）/ 变更后（截120字）。

#### `refine review list`

```bash
./ss refine review list [--persona <path>]
```

列出所有宪法审查请求：`[status] reviewHash ts 原因 触发`。

#### `refine review approve`

```bash
./ss refine review approve --id <reviewHash> [--reviewer <name>] [--persona <path>]
```

批准指定审查请求（调用 `approveConstitutionReview()`）。

#### `refine review reject`

```bash
./ss refine review reject --id <reviewHash> [--reviewer <name>] [--reason <text>] [--persona <path>]
```

拒绝指定审查请求。

#### `refine sizes`

```bash
./ss refine sizes [--persona <path>]
```

检查精炼目标文件的实际字节数：`constitution.json`（限 2048B）、`habits.json`（限 1024B）、`worldview.json`（限 1024B），标注是否超限。

---

### 3.6 Memory 记忆控制面

#### `memory status`

```bash
./ss memory status [--persona <path>]
```

输出 memory.db 元信息（exists / schemaVersion / missingTables）及各状态（hot/warm/cold/archive/scar/total/active/deleted/excluded）计数。

#### `memory budget`

```bash
./ss memory budget [--persona <path>] [--target-mb 300]
```

输出存储预算快照：当前 DB 体积（MB）、年化预测体积、recall 缓存命中率、进程内存用量（rss/heapTotal/heapUsed）。

#### `memory list`

```bash
./ss memory list [--persona <path>] [--limit 20] [--state hot|warm|cold|archive|scar] [--deleted]
```

列出记忆条目（默认不含已软删除），按 `updated_at DESC` 排序，输出 id / memoryType / content / salience / state / activationCount / credibilityScore 等字段。

#### `memory inspect`

```bash
./ss memory inspect --id <memoryId> [--persona <path>]
```

精确查询单条记忆的完整字段。

#### `memory forget`

```bash
./ss memory forget --id <memoryId> [--mode soft|hard] [--persona <path>]
```

- `soft`（默认）：设置 `deleted_at` 软删除，可恢复；写入 `memory_soft_forgotten` 事件
- `hard`：物理 DELETE，不可恢复

#### `memory recover`

```bash
./ss memory recover --id <memoryId> [--persona <path>]
```

清除 `deleted_at`，恢复被软删除的记忆；写入 `memory_recovered` 事件。

#### `memory fiction repair`

```bash
./ss memory fiction repair [--persona <path>] [--dry-run]
```

扫描含伪造/外部内容关键词的记忆，标记为 `excluded_from_recall=1 / credibility_score≤0.25 / evidence_level=uncertain`。`--dry-run` 仅统计不修改。

#### `memory unstick`

```bash
./ss memory unstick [--persona <path>] [--phrase <text>] [--min-occurrences 3] [--max-content-length 1200] [--dry-run]
```

检测 assistant 来源的重复回复记忆（按归一化内容分组），保留最新版本，软删除其余副本。`--phrase` 精确定位，`--dry-run` 仅预览。

#### `memory compact`

```bash
./ss memory compact [--persona <path>]
```

执行 `life.log + working_set → memory.db` 压缩迁移，输出迁移报告与备份路径。

#### `memory archive`

```bash
./ss memory archive [--persona <path>] [--min-items 50] [--min-cold-ratio 0.35] [--idle-days 14] [--max-items 500] [--dry-run]
```

将满足阈值的 cold 记忆写入 `summaries/archive/segment-YYYYMM.jsonl`，主表保留摘要引用并从召回中排除。

参数说明：
- `--min-items`：触发归档最小条数（默认 50）
- `--min-cold-ratio`：冷记忆比例阈值（默认 0.35）
- `--idle-days`：超过 N 天未更新才归档（默认 14）
- `--max-items`：单次最多处理条数（默认 500）
- `--dry-run`：仅评估条件，不实际写入

#### `memory index build` / `memory index rebuild`

```bash
./ss memory index build [--persona <path>] [--provider deepseek|local] [--batch-size 16]
./ss memory index rebuild [--persona <path>] [--provider deepseek|local] [--batch-size 16]
```

- `build`：为现有记忆批量生成向量嵌入
- `rebuild`：先清空 `memory_embeddings`，再全量重建

`--provider deepseek`：调用 DeepSeek 嵌入 API（失败自动回退 local）。

#### `memory search`

```bash
./ss memory search --query <q> [--persona <path>] [--max-results 12] [--debug-trace]
```

Hybrid RAG 检索（FTS + 向量 + salience 融合），输出 `{query, traceId, count, selectedIds, results}`。`--debug-trace` 附加完整 trace 数据。

#### `memory recall-trace`

```bash
./ss memory recall-trace --trace-id <traceId> [--persona <path>]
```

按 trace id 回放单次召回操作的完整明细。

#### `memory consolidate`

```bash
./ss memory consolidate [--persona <path>] [--mode light|full] [--timeout-ms 1200] [--conflict-policy newest|trusted]
```

触发记忆整合：
- `light`：轻量快速（关键词提炼），默认 timeout 1200ms
- `full`：深度合并（LLM 语义整合），默认 timeout 5000ms

审计事件：`memory_consolidated`（成功）/ `memory_consolidation_failed`（失败）

#### `memory eval recall`

```bash
./ss memory eval recall --dataset <file.json> [--persona <path>] [--k 8] [--out report.json]
```

运行召回回归评测，输出：`Recall@K`、`MRR`、`wrongRecallRate`、`injectionHitRate`、`avgLatencyMs`。

#### `memory eval budget`

```bash
./ss memory eval budget [--persona <path>] [--target-mb 300] [--days 180] [--events-per-day 24] [--recall-queries 120] [--growth-checkpoints 12] [--out report.json]
```

模拟指定天数内的数据库增长，输出多检查点的容量预测报告（年化体积、缓存命中率、进程内存等）。

#### `memory export` / `memory import`

```bash
./ss memory export --out <file.json> [--persona <path>] [--include-deleted]
./ss memory import --in <file.json> [--persona <path>]
```

- `export`：导出记忆快照到 JSON（格式 `soulseed.memory.export.v1`），默认不含软删除
- `import`：从 JSON 快照批量 `INSERT OR REPLACE INTO memories`

#### `memory pin add` / `memory pin list` / `memory pin remove` / `memory unpin`

```bash
./ss memory pin add --text <memory> [--persona <path>]    # 添加固定记忆（上限 240 字符）
./ss memory pin list [--persona <path>]                   # 查看固定记忆
./ss memory pin remove --text <memory> [--persona <path>] # 删除固定记忆
./ss memory unpin --text <memory> [--persona <path>]      # pin remove 的别名
```

Pinned Memory 在每次对话中始终注入上下文（硬注入，不受预算限制）。

#### `memory reconcile`

```bash
./ss memory reconcile [--persona <path>]
```

以 `life.log.jsonl` 为准校正 memory store，修复不一致条目，输出 `{rowsUpdated, ...}` 报告。

#### `memory facts list` / `memory facts add` / `memory facts remove` / `memory facts graduate`

```bash
./ss memory facts list [--persona <path>] [--limit 20]
./ss memory facts add --key <key> --value <value> [--persona <path>]
./ss memory facts remove --key <key> [--persona <path>]
./ss memory facts graduate [--persona <path>]
```

管理用户自述事实（key-value）：
- `list`：列出所有事实（`[✓|次数] key = value`，`✓` 表示已晶化）
- `add`：插入或更新一条用户事实
- `remove`：删除指定 key 的事实
- `graduate`：从高频记忆中自动提取并晋升为用户事实

#### `memory learn status`

```bash
./ss memory learn status [--persona <path>]
```

输出外部知识库状态（candidate 计数、entry 计数等）。

#### `memory learn stage`

```bash
./ss memory learn stage --source <uri> [--source-type website|file|manual] [--text <content> | --from-file <path>] [--confidence 0.0-1.0] [--persona <path>]
```

将外部内容（网页/文件/手动输入）暂存为待审核候选。`source-type` 可从 URI 自动推断。

#### `memory learn candidates`

```bash
./ss memory learn candidates [--status pending|approved|rejected] [--limit 20] [--persona <path>]
```

列出外部知识候选列表。

#### `memory learn review`

```bash
./ss memory learn review --id <candidateId> --approve true|false --owner-token <token> [--reason <text>] [--reviewer <name>] [--persona <path>]
```

审核外部知识候选（需要 `SOULSEED_OWNER_KEY` 环境变量与 `--owner-token` 匹配）。
- 批准：写入外部知识库
- 拒绝：标记并丢弃

#### `memory learn entries`

```bash
./ss memory learn entries [--limit 20] [--persona <path>]
```

列出已批准并写入的外部知识条目。

#### `memory learn search`

```bash
./ss memory learn search --query <q> [--limit 8] [--persona <path>]
```

关键词检索外部知识库。

---

### 3.7 Social 社交关系图谱

```bash
./ss social list [--persona <path>]
./ss social add --name <name> --relationship <rel> [--facts <fact1,fact2>] [--persona <path>]
./ss social remove --name <name> [--persona <path>]
./ss social search --query <q> [--persona <path>]
```

管理 persona 认识的第三方人物（最多 20 人）：
- `list`：列出所有成员（`[mention_count×] name (relationship) | facts`）
- `add`：添加关系人，facts 为逗号分隔字符串
- `remove`：按名称删除
- `search`：按名称或 facts 关键词检索

社交图谱上下文在每轮对话中自动注入（`compileRelatedPersonContext`）。

---

### 3.8 Examples 示例库管理

```bash
./ss examples list [--persona <path>]
./ss examples add --user <text> --assistant <text> [--label <label>] [--expires <ISO8601>] [--persona <path>]
./ss examples remove --id <idPrefix> [--persona <path>]
```

管理 few-shot 示例库（`golden_examples.jsonl`）：
- `list`：列出所有示例及统计（总数 / 上限 50 / 活跃 / 已过期 / 来源分布）+ 当前 char 预算估计
- `add`：添加示例（每条上限 300 字符，总数限 50 条，可设过期时间）
- `remove`：通过 ID 前缀匹配删除

示例会自动注入对话系统提示词（字符预算 3000 chars）。Meta-Review quality ≥ 0.85 时自动晶化（`addedBy: "meta_review"`）。

---

### 3.9 Finetune SFT 数据导出

```bash
./ss finetune export-dataset --out <path.jsonl> [--min-turns <n>] [--max-turns <n>] [--persona <path>]
```

从 `life.log.jsonl` 配对 user/assistant 消息，过滤后输出标准 SFT JSONL：
- 过滤条件：`refuse=true` / `riskLevel=high` / `consistencyVerdict≠allow` / `proactive=true` / 空内容 / 污染标记
- `--min-turns`：最小有效轮次门槛，不满足时 exitCode=2 并提示
- `--max-turns`：导出轮次上限

输出：`{ok, outputPath, totalLifeEvents, totalTurnCandidates, exportedTurns, skippedTurns}`

每条记录格式（SFT）：
```json
{
  "messages": [
    {"role": "system", "content": "..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "meta": {
    "userEventHash": "...",
    "assistantEventHash": "...",
    "consistencyVerdict": "allow",
    "riskLevel": "low",
    "model": "..."
  }
}
```

---

### 3.10 Goal / Agent / Trace

#### `goal create`

```bash
./ss goal create --title <text> [--persona <path>]
```

创建新目标（source="user"），输出 goal 对象 JSON。

#### `goal list`

```bash
./ss goal list [--persona <path>] [--status pending|active|blocked|completed|canceled|suspended] [--limit 20]
```

按状态过滤列出目标，输出 JSON 数组。

#### `goal get`

```bash
./ss goal get --id <goalId> [--persona <path>]
```

输出指定目标的完整 JSON，包含所有步骤和执行历史。

#### `goal cancel`

```bash
./ss goal cancel --id <goalId> [--persona <path>]
```

将目标标记为 canceled。

#### `agent run`

```bash
./ss agent run --input <taskText> [--goal-id <goalId>] [--max-steps 4] [--persona <path>]
```

以 Agent 模式执行多步任务（Planner/Executor 循环），最多 `max-steps` 步（默认 4）。每步输出 stepId / action / result，最终输出 execution summary JSON。

#### `trace get`

```bash
./ss trace get --id <traceId> [--persona <path>]
```

输出指定 execution trace 的完整 JSON（一致性/执行步骤追踪）。

---

### 3.11 MCP 服务器

```bash
./ss mcp [--persona <path>] [--transport stdio|http] [--host 127.0.0.1] [--port 8787] [--auth-token <token>]
```

以子进程启动 `packages/mcp-server`，通过环境变量透传配置。

| 参数 | 说明 | 默认 |
|------|------|------|
| `--transport` | `stdio`（本地直连）或 `http`（跨进程） | `stdio` |
| `--host` | HTTP 监听地址 | `127.0.0.1` |
| `--port` | HTTP 监听端口 | `8787` |
| `--auth-token` | Bearer 鉴权 token（可选） | 无 |

**HTTP 端点**：
- `GET /health` — 健康检查
- `POST /mcp` — Streamable HTTP MCP
- `GET /sse` + `POST /messages?sessionId=<id>` — 兼容 SSE

**工具列表**（`tools/list`）：
- `persona.get_context` — 编译系统提示词 + 选中记忆（不调用 LLM）
- `conversation.save_turn` — 写回一轮对话到 life.log（含守卫链）
- `memory.search` / `memory.search_hybrid` — 记忆检索
- `memory.recall_trace_get` — 回放 recall trace
- `memory.inspect` — 查看单条记忆
- `goal.create` / `goal.list` / `goal.get` / `goal.cancel` — 目标管理
- `agent.run` — Agent 执行
- `consistency.inspect` — 一致性检查
- `trace.get` — 获取 trace

---

## 4. 常用示例

```bash
# 创建 persona
./ss new Teddy
./ss new Teddy --quick --template peer --model deepseek-reasoner

# 对话
./ss Teddy
./ss Teddy --model deepseek-chat
./ss chat --persona ./personas/Teddy.soulseedpersona   # 兼容入口

# 改名
./ss rename --persona ./personas/Teddy.soulseedpersona --to Nova
./ss rename --persona ./personas/Teddy.soulseedpersona --to Nova --confirm

# 体检
./ss doctor
./ss doctor --check-constitution
./ss doctor --check-drift

# 决策解释
./ss explain --last

# 宪法精炼
./ss refine constitution
./ss refine apply --id <runId>
./ss refine rollback --id <runId>
./ss refine diff --id <runId>

# 记忆操作
./ss memory list --persona ./personas/Teddy.soulseedpersona --limit 50 --state warm
./ss memory search --query "你最喜欢的颜色" --debug-trace
./ss memory forget --id <memoryId> --mode soft
./ss memory consolidate --mode full
./ss memory facts list
./ss memory facts add --key "favorite_color" --value "蓝色"

# 社交图谱
./ss social add --name "小林" --relationship "同学" --facts "爱打篮球,在北京"
./ss social list

# Few-shot 示例
./ss examples add --user "你好！" --assistant "你好呀，今天有什么想聊的？" --label "greeting"
./ss examples list

# 微调数据集
./ss finetune export-dataset --out ./sft_data.jsonl --min-turns 100

# MCP
./ss mcp --persona ./personas/Teddy.soulseedpersona
./ss mcp --transport http --host 127.0.0.1 --port 8787 --auth-token your-secret

# Agent
./ss agent run --input "帮我整理今天的待办事项"
./ss goal list

# 繁衍
./ss persona reproduce --name Kira --persona ./personas/Teddy.soulseedpersona
```

---

## 5. MCP 接入流程（外部模型）

推荐调用顺序（避免"聊了但没入魂"）：

1. `persona.get_context` → 获取 systemPrompt + recentConversation + selectedMemories
2. 外部大模型（ChatGPT / Claude 等）基于以上上下文生成回复
3. `conversation.save_turn` → 写回 userMessage + assistantMessage（含守卫链）
4. 可选：`memory.search` / `memory.search_hybrid` 做额外检索

最小 JSON-RPC 示例（stdio）：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0.1.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"persona.get_context","arguments":{"userInput":"你好"}}}
```

**注意**：只调用 `persona.get_context` / `memory.search` 而不调用 `conversation.save_turn`，本轮对话不会沉淀到记忆。

---

## 6. ChatGPT 远程 MCP 配置

```bash
# 步骤 1：启动 HTTP MCP
./ss mcp --persona ./personas/Teddy.soulseedpersona --transport http --host 127.0.0.1 --port 8787 --auth-token your-secret

# 步骤 2：验证服务
curl http://127.0.0.1:8787/health
# 期望: {"ok":true}
```

步骤 3：在 ChatGPT 配置 MCP 连接：
- URL：`http://<host>:<port>/mcp`
- Header（若设置了 token）：`Authorization: Bearer <token>`

---

## 7. 记忆状态与生命周期

`memoryMeta` 关键字段：

| 字段 | 说明 |
|------|------|
| `state` | `hot \| warm \| cold \| archive \| scar` |
| `decayClass` | `fast \| standard \| slow \| sticky` |
| `salienceScore` | 综合显著度评分 |
| `activationCount` | 激活次数 |
| `lastActivatedAt` | 最近激活时间 |
| `emotionScore` | 情绪关联评分 |
| `narrativeScore` | 叙事关联评分 |
| `relationalScore` | 关系关联评分 |
| `credibilityScore` | 可信度评分 |
| `evidence_level` | `verified \| uncertain \| unverified` |

行为摘要：
- 召回默认过滤软删除（`deleted_at IS NULL`）和排除项（`excluded_from_recall=0`）
- 命中记忆在召回时写 trace 并激活强化（reconsolidation）
- 生命周期评分由四信号（emotion / narrative / relational / activation）驱动，受 `decayClass` 时间衰减

---

## 8. MCP 排障清单

| 现象 | 原因 | 检查方法 |
|------|------|----------|
| `401 unauthorized` | 启用了 token 但请求未带或不一致 | 确认 `--auth-token` 与 Header `Authorization: Bearer` 完全一致 |
| `tools/list` 为空 | 会话未正确 initialize | 先走 `initialize` + `notifications/initialized` 再 `tools/list` |
| URL 连接失败 | 路径错误 | 确认 URL 为 `/mcp`，不是 `/` 或 `/rpc` |
| persona 错误 | 路径不存在或结构不完整 | 先 `./ss new <name>`，再用 `--persona` 指向真实路径 |
| 记忆没增长 | 只读工具被调用，未调 `save_turn` | 每轮外部回复后补一条 `conversation.save_turn` |
| `429 rate_limited` | 触发 `MCP_RATE_LIMIT_PER_MINUTE`（默认 120） | 降低频率或按部署环境提高阈值 |

---

## 9. 验收

```bash
npm run acceptance
```

产物：
- `reports/acceptance/acceptance-*.json`
- `reports/acceptance/acceptance-*.md`
- `reports/acceptance/mcp-integration-*.json`
- `reports/acceptance/mcp-integration-*.md`
- `reports/acceptance/mcp-http-*.md`
