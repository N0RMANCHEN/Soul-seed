# Soulseed CLI 指令总览

本文档对应当前 `./ss`（`packages/cli/src/index.ts`）实际实现的命令集合，包含用途、参数、示例与调试说明。

## 1. 一次性准备

```bash
npm install
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY
```

## 2. 最短入口

```bash
# 查看帮助
./ss

# 初始化 persona（默认 Roxy）
./ss init

# 开始聊天
./ss chat

# 体检
./ss doctor
```

说明：
- 默认 persona 路径：`./personas/Roxy.soulseedpersona`
- 验收请使用隔离 QA persona：`npm run acceptance`
- 涉及在线链路变更时，提交前应附 `reports/acceptance/*` 报告

## 3. 全量命令清单

### 3.1 Persona 命令

```bash
./ss init [--name <displayName>] [--out <personaPath>]
./ss rename --to <newName> [--persona <personaPath>]
./ss rename --to <newName> [--persona <personaPath>] --confirm
```

兼容别名：

```bash
./ss persona init --name <displayName> --out <personaPath>
./ss persona rename --to <newName> [--persona <personaPath>] [--confirm]
```

说明：
- `rename` 是双阶段确认：
- 第 1 次只写入 rename request
- 第 2 次加 `--confirm` 才真正应用

### 3.2 会话命令

```bash
./ss chat [--persona <personaPath>] [--model deepseek-chat] [--strict-memory-grounding true|false]
```

`chat` 内部命令：
- 主路径：自然语言触发能力（读文件、查看能力、查看模式、退出）
- `/read <file_path>` 兼容入口：读取本地文本并附加到后续问题上下文（首次路径需确认）
- `/files` 查看已附加文件
- `/clearread` 清空附加文件
- `/proactive on|off|status` 兼容入口：查看主动状态；`on/off` 不再直接调参（主动倾向由人格状态自决）
- `/relation` 查看关系状态摘要
- `/relation detail` 查看关系细项与驱动因素
- `/rename confirm <new_name>` 在聊天内确认改名
- `/exit` 兼容入口：触发退出确认流程
- `Ctrl+C` 中止当前生成

`chat` 自动行为：
- 会话启动时后台触发一次轻量巩固（`trigger=chat_open`）
- 会话退出时后台触发一次轻量巩固（`trigger=chat_close`）
- 敏感开关（`strict_memory_grounding` / `adult_mode` / `age_verified` / `explicit_consent` / `fictional_roleplay`）仅 Owner 授权可修改
- Owner 授权支持短时会话（15 分钟）：`owner <口令>` 后可直接执行 `adult_mode on confirmed=true` 这类高风险能力调用

### 3.3 Doctor 命令

```bash
./ss doctor [--persona <personaPath>]
```

输出 JSON 报告，`ok=false` 时进程会返回非零退出码。

### 3.4 MCP 命令（stdio + http 双入口）

```bash
./ss mcp [--persona <personaPath>] [--transport stdio|http] [--host 127.0.0.1] [--port 8787] [--auth-token <token>]
```

用途：
- 启动 Soulseed MCP Server（JSON-RPC 2.0）。
- 支持两种传输：
- `stdio`：本地进程直连（默认）
- `http`：远程/跨进程访问（`/mcp`，兼容 `/sse` + `/messages`）

前置条件：
- 先构建 mcp-server：

```bash
npm run build -w @soulseed/mcp-server
```

参数说明：
- `--transport`：`stdio|http`，默认 `stdio`
- `--host`：HTTP 监听地址，默认 `127.0.0.1`
- `--port`：HTTP 监听端口，默认 `8787`
- `--auth-token`：可选。开启 Bearer 鉴权（`Authorization: Bearer <token>`）
- `--persona`：persona 目录路径（会注入到 `SOULSEED_PERSONA_PATH`）

服务端环境变量（mcp-server）：
- `SOULSEED_PERSONA_PATH`：persona 路径（必填）
- `MCP_TRANSPORT`：`stdio|http`
- `MCP_HOST` / `MCP_PORT`：HTTP 地址
- `MCP_AUTH_TOKEN`：Bearer token（可选）
- `MCP_RATE_LIMIT_PER_MINUTE`：每 IP 每分钟请求上限（默认 `120`）

行为说明：
- `./ss mcp` 会拉起 `packages/mcp-server/dist/index.js`，并透传退出码。
- `http` 模式下可用端点：
- 健康检查：`GET /health`
- Streamable HTTP：`POST /mcp`
- 兼容 SSE：`GET /sse` + `POST /messages?sessionId=<id>`

当前工具能力（tools/list）：
- `persona.get_context`
- `conversation.save_turn`
- `memory.search`
- `memory.search_hybrid`
- `memory.recall_trace_get`
- `memory.inspect`

### 3.5 Memory 控制面命令（含调试）

```bash
./ss memory status [--persona <personaPath>]
./ss memory budget [--persona <personaPath>] [--target-mb 300]
./ss memory list [--persona <personaPath>] [--limit 20] [--state hot|warm|cold|archive|scar] [--deleted]
./ss memory inspect --id <memory_id> [--persona <personaPath>]
./ss memory forget --id <memory_id> [--mode soft|hard] [--persona <personaPath>]
./ss memory recover --id <memory_id> [--persona <personaPath>]
./ss memory compact [--persona <personaPath>]
./ss memory archive [--persona <personaPath>] [--min-items 50] [--min-cold-ratio 0.35] [--idle-days 14] [--max-items 500] [--dry-run]
./ss memory index build [--persona <personaPath>] [--provider deepseek|local] [--batch-size 16]
./ss memory index rebuild [--persona <personaPath>] [--provider deepseek|local] [--batch-size 16]
./ss memory search --query <q> [--persona <personaPath>] [--max-results 12] [--debug-trace]
./ss memory recall-trace --trace-id <trace_id> [--persona <personaPath>]
./ss memory consolidate [--persona <personaPath>] [--mode light|full] [--timeout-ms 1200] [--conflict-policy newest|trusted]
./ss memory eval recall --dataset <file.json> [--persona <personaPath>] [--k 8] [--out report.json]
./ss memory eval budget [--persona <personaPath>] [--target-mb 300] [--days 180] [--events-per-day 24] [--recall-queries 120] [--growth-checkpoints 12] [--out report.json]
./ss memory export --out <file.json> [--persona <personaPath>] [--include-deleted]
./ss memory import --in <file.json> [--persona <personaPath>]
./ss memory pin add --text <memory> [--persona <personaPath>]
./ss memory pin list [--persona <personaPath>]
./ss memory pin remove --text <memory> [--persona <personaPath>]
./ss memory unpin --text <memory> [--persona <personaPath>]
./ss memory reconcile [--persona <personaPath>]
```

#### status
- 用途：查看 `memory.db` 状态与统计
- 输出：`schemaVersion`、`missingTables`、state 分布统计

#### budget
- 用途：输出存储预算快照（当前 DB 体积、行数、年化预测）
- 参数：
- `--target-mb` 年化体积目标（默认 300）
- 输出：
- `dbMb` 当前库体积（MB）
- `projectedYearDbMb` 年化预测体积（MB）
- `underTarget` 是否低于目标
- `recallCache.hitRate` 召回缓存命中率
- `process.under64Mb` 当前进程 RSS 是否低于 64MB

#### list
- 用途：列出记忆条目（默认不含已软删除）
- 参数：
- `--limit` 1-200，默认 20
- `--state` 可选过滤：`hot|warm|cold|archive|scar`
- `--deleted` 包含软删除条目

#### inspect
- 用途：按 `id` 查看单条记忆详情
- 必填：`--id`

#### forget（调试入口）
- 用途：删除或隐藏记忆
- 参数：
- `--mode soft` 软删除（写 `deleted_at`，可恢复）
- `--mode hard` 物理删除（不可恢复）
- 默认：`soft`
- 审计：写入 `memory_soft_forgotten` 事件（含 mode）

#### recover（调试入口）
- 用途：恢复 soft-delete 记忆
- 必填：`--id`
- 审计：写入 `memory_recovered` 事件

#### compact
- 用途：执行 `life.log + working_set -> memory.db` 压缩迁移流程
- 输出：迁移报告与备份路径

#### archive
- 用途：执行冷记忆归档，把满足阈值的 `cold/archive` 记忆写入 `summaries/archive/segment-YYYYMM.jsonl`，主表保留摘要引用并从召回中排除
- 参数：
- `--min-items` 触发归档最小条数（默认 50）
- `--min-cold-ratio` 触发归档的冷记忆比例阈值（默认 0.35）
- `--idle-days` 仅归档“超过 N 天未更新”记忆（默认 14）
- `--max-items` 单次最多处理条数（默认 500）
- `--dry-run` 仅评估触发条件并输出计划，不实际写入

#### index build / rebuild
- 用途：构建或重建 `memory_embeddings` 向量索引
- 参数：
- `--provider deepseek|local`（默认 `deepseek`，失败自动回退 local）
- `--batch-size`（1-64）

#### search / recall-trace
- `memory search`：
- Hybrid RAG 检索（FTS + 向量 + salience），输出融合分数；`--debug-trace` 可打印完整 trace
- `memory recall-trace`：
- 按 trace id 回放单次召回明细

#### consolidate
- 用途：执行“记忆巩固”，把最近用户消息里的稳定偏好/称呼/流程偏好提炼为 `semantic` 记忆
- 参数：
- `--mode light|full`，默认 `light`
- `--timeout-ms` 执行预算（200-30000ms）
- `--conflict-policy newest|trusted`（默认 `newest`）
- 审计事件：
- 成功：`memory_consolidated`
- 失败：`memory_consolidation_failed`
- 同步写入 `memory_consolidation_runs`，冲突写入 `memory_conflicts`

#### eval recall
- 用途：运行固定数据集召回回归评测，输出 Recall@K / MRR / 错召回率 / 注入命中率 / 延迟
- 参数：
- `--dataset`（必填）
- `--k`（默认 8）
- `--out` 可选，写 JSON 报告

#### eval budget
- 用途：运行重度 persona 预算压测，输出增长曲线、缓存命中率、进程内存占用与阈值告警
- 参数：
- `--target-mb` 年化体积目标（默认 300）
- `--days` 生成数据覆盖天数（默认 180）
- `--events-per-day` 每日事件数（默认 24）
- `--recall-queries` 召回压测查询次数（默认 120）
- `--growth-checkpoints` 增长曲线采样点数（默认 12）
- `--out` 可选，写 JSON 报告

#### export / import
- `export`：
- 导出 memory 快照到 JSON 文件，默认不含软删除
- 可用 `--include-deleted` 带出软删除条目
- `import`：
- 从 JSON 快照导入到 `memory.db`
- 使用 `INSERT OR REPLACE`

#### pin / unpin
- `pin add`：添加高优先固定记忆（`--text`）
- `pin list`：查看固定记忆
- `pin remove`：删除固定记忆（按文本匹配）
- `unpin`：`pin remove` 的别名

#### reconcile
- 用途：以 `life.log` 为准校正 memory store 与 policy drift
- 输出：对账与修复统计（如 `rowsUpdated`）

## 4. 常见参数示例

```bash
./ss init --name Roxy --out ./personas/Roxy.soulseedpersona
./ss chat --persona ./personas/Roxy.soulseedpersona --model deepseek-chat
./ss rename --persona ./personas/Roxy.soulseedpersona --to Nova
./ss rename --persona ./personas/Roxy.soulseedpersona --to Nova --confirm
./ss memory list --persona ./personas/Roxy.soulseedpersona --limit 50 --state warm
./ss memory forget --persona ./personas/Roxy.soulseedpersona --id <memory_id> --mode soft
./ss memory recover --persona ./personas/Roxy.soulseedpersona --id <memory_id>
./ss mcp --persona ./personas/Roxy.soulseedpersona
./ss mcp --transport http --host 127.0.0.1 --port 8787
./ss mcp --transport http --host 0.0.0.0 --port 8787 --auth-token your-secret-token
```

## 5. MCP 调用流程（外部模型接入）

推荐流程：
1. client 调用 `persona.get_context` 获取 `systemPrompt`、`recentConversation`、`selectedMemories`
2. 外部大模型基于以上上下文生成回复
3. client 调用 `conversation.save_turn` 写回 `userMessage + assistantMessage`（含守卫链）
4. 可选调用 `memory.search` / `memory.search_hybrid` / `memory.recall_trace_get` / `memory.inspect` 做额外检索与调试

最小 JSON-RPC 示例（stdio）：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0.1.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"persona.get_context","arguments":{"userInput":"你好"}}}
```

注意：
- `persona.get_context` 不调用 LLM，只做上下文编译。
- `conversation.save_turn` 才是“把外部对话写入灵魂资产”的关键步骤。
- `memory.search`/`memory.search_hybrid`/`memory.recall_trace_get`/`memory.inspect` 属于读能力；工具调用会写 MCP 审计事件。

## 6. ChatGPT 远程 MCP 配置（HTTP）

目标：
- 让 ChatGPT 通过 MCP URL 直接连到你本机/服务器上的 Soulseed MCP。

步骤 1：启动 Soulseed MCP（HTTP）

```bash
# 本机调试（仅本机访问）
./ss mcp --persona ./personas/Roxy.soulseedpersona --transport http --host 127.0.0.1 --port 8787

# 需要 token 时
./ss mcp --persona ./personas/Roxy.soulseedpersona --transport http --host 127.0.0.1 --port 8787 --auth-token your-secret-token
```

步骤 2：确认服务可用

```bash
curl http://127.0.0.1:8787/health
# 期望: {"ok":true}
```

步骤 3：在 ChatGPT 配置 MCP 连接
- 打开 ChatGPT 的 MCP/Connectors 配置页面（不同版本 UI 名称可能略有差异）。
- 新建自定义 MCP 连接，填入：
- URL：`http://<host>:<port>/mcp`
- 若你设置了 `--auth-token`：添加 Header `Authorization: Bearer <token>`
- 保存并触发 `tools/list` 测试。

步骤 4：验证工具可见
- 期望至少出现 6 个工具：
- `persona.get_context`
- `conversation.save_turn`
- `memory.search`
- `memory.search_hybrid`
- `memory.recall_trace_get`
- `memory.inspect`

步骤 5：推荐调用顺序（避免“聊了但没入魂”）
1. 先调 `persona.get_context`
2. 再让外部模型生成回复
3. 最后调 `conversation.save_turn` 写回 `userMessage + assistantMessage`

说明：
- 若只调用 `persona.get_context`/`memory.search` 而不调用 `conversation.save_turn`，本轮对话不会沉淀到 Soulseed 记忆。
## 7. 记忆生命周期说明（当前实现）

`memoryMeta` 关键字段（含 v3）：
- `activationCount`
- `lastActivatedAt`
- `emotionScore`
- `narrativeScore`
- `relationalScore`
- `decayClass`：`fast|standard|slow|sticky`
- `salienceScore`
- `state`：`hot|warm|cold|archive|scar`

行为摘要：
- 召回默认过滤 soft-delete（`deleted_at IS NULL`）
- 召回会写 trace 并对命中记忆进行激活强化（activation/reconsolidation）
- 生命周期评分由四信号驱动，并受 `decayClass` 时间衰减影响

## 8. 调试建议

- 开发调试时可使用：
- `memory inspect`
- `memory forget/recover`
- `memory export/import`
- 产品层若需要隐藏删除能力，可在上层产品壳屏蔽 `forget/recover` 命令入口，仅保留工程调试渠道。

## 9. MCP 最小排障清单

- `401 unauthorized`
- 原因：启用了 `MCP_AUTH_TOKEN`，但请求未带 `Authorization: Bearer <token>` 或 token 不一致。
- 检查：`./ss mcp ... --auth-token <token>` 与客户端 Header 是否完全一致。

- `tools/list` 为空或调用失败
- 原因：MCP 会话未正确 initialize，或连接到了错误路径。
- 检查：URL 必须是 `/mcp`；先走 `initialize` + `notifications/initialized` 再 `tools/list`。

- persona 相关错误（例如 `SOULSEED_PERSONA_PATH`）
- 原因：persona 目录不存在或结构不完整。
- 检查：先执行 `./ss init`，再用 `--persona` 指向真实路径。

- ChatGPT 能连通但“记忆没增长”
- 原因：只读工具被调用了，但没调用 `conversation.save_turn`。
- 检查：在每轮外部回复后补一条 `conversation.save_turn`。

- `429 rate_limited`
- 原因：触发 `MCP_RATE_LIMIT_PER_MINUTE`（默认 120）。
- 检查：降低调用频率，或按部署环境提高该阈值。

## 10. 验收

```bash
npm run acceptance
```

产物：
- `reports/acceptance/acceptance-*.json`
- `reports/acceptance/acceptance-*.md`
- `reports/acceptance/mcp-integration-*.json`
- `reports/acceptance/mcp-integration-*.md`
