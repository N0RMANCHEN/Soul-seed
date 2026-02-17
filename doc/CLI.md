# Soulseed CLI 快速入口

## 1. 一次性准备

```bash
npm install
cp .env.example .env
# 在 .env 填 DEEPSEEK_API_KEY
```

## 2. 最短命令入口

本仓库提供短命令：`./ss`

说明：
- 日常 persona 用 `./personas/Roxy.soulseedpersona`
- 验收请用 `scripts/acceptance.sh`，它会自动创建 `./personas/_qa/RoxyQA-*`
- 不要用日常 `Roxy` 跑验收，避免记忆污染
- 涉及在线模型链路改动时，提交前必须附 `npm run acceptance` 报告路径

```bash
# 查看帮助
./ss

# 创建第一个 Roxy（默认名就是 Roxy）
./ss init

# 开始聊天（默认走 ./personas/Roxy.soulseedpersona）
./ss chat

# 改名（双确认）
./ss rename --to Nova
./ss rename --to Nova --confirm

# 体检
./ss doctor
```

## 3. 常用参数

```bash
# 自定义名字和路径
./ss init --name Roxy --out ./personas/Roxy.soulseedpersona

# 指定 persona 聊天
./ss chat --persona ./personas/Roxy.soulseedpersona

# 指定模型
./ss chat --model deepseek-chat

# 指定 persona 改名
./ss rename --persona ./personas/Roxy.soulseedpersona --to Nova
./ss rename --persona ./personas/Roxy.soulseedpersona --to Nova --confirm
```

## 4. 会话操作

- 输入普通文本：与 persona 对话
- AI 输出标签会使用 persona 当前名（例如 `Roxy>`）；改名后会即时切换
- 输入 `/read <本地文件路径>`：把文件内容附加进后续提问上下文（适合 `.md`、`.txt`、代码文件等文本）
- 输入 `/files`：查看当前已附加的文件列表
- 输入 `/clearread`：清空已附加文件
- 输入 `/proactive on [minutes]`：开启 AI 主动消息（1-180 分钟，默认 10）
- 输入 `/proactive off`：关闭 AI 主动消息
- 输入 `/proactive status`：查看主动消息状态
- 输入 `/exit`：退出会话
- `Ctrl+C`：中止当前生成
- `rename` 需要两步：先发起，再 `--confirm` 确认

## 5. 最小日常流程

```bash
./ss init
./ss rename --to Nova
./ss rename --to Nova --confirm
./ss chat
./ss doctor
```

## 6. 一键验收（隔离 QA persona）

```bash
npm run acceptance
```

验收脚本会检查：
- DeepSeek 真实回复
- `life.log.jsonl` 已追加事件
- `doctor` 通过
- 连续性：设置称呼后重载仍记住（示例：博飞）
- 身份防污染：不允许自称“DeepSeek 开发的助手”
- 本地兜底：即使模型偶发污染，CLI 会在展示前进行身份守卫修正

并生成报告文件：
- `reports/acceptance/acceptance-*.json`
- `reports/acceptance/acceptance-*.md`

连续性报告关键字段：
- `continuity.input`
- `continuity.reloadedPreferredName`
- `continuity.reply`
- `continuity.pass`

如果验收失败：
- 仍会生成报告文件
- 必须记录失败归因（网络 / API / 配置 / doctor）

## 7. 事件中的记忆元数据（Memory Economics V1）

`life.log.jsonl` 中的核心对话事件会追加 `payload.memoryMeta`：
- `tier`: `highlight | pattern | error`
- `source`: `chat | system | acceptance`
- `storageCost`: 存储成本估算（非负数）
- `retrievalCost`: 检索成本估算（非负数）

说明：
- 普通对话通常是 `pattern`
- 明确“请记住/我叫...”等锚点更可能是 `highlight`
- 拒绝冲突、身份污染修正等冲突事件是 `error`
- `./ss doctor` 会校验 `memoryMeta` 合法性

## 8. 人类式遗忘与记忆状态（V2）

系统不再使用“仅按时间 TTL 过期删除”的策略，而是采用三模型融合：
- 激活衰减：被反复提及/调用的记忆更难遗忘
- 情感权重：冲突、承诺、强情绪事件保留更久
- 叙事一致性：支撑 persona 身份主线的记忆优先保留

对应新增字段（`payload.memoryMeta`）：
- `activationCount`
- `lastActivatedAt`
- `emotionScore`
- `narrativeScore`
- `salienceScore`
- `state` (`hot|warm|cold|scar`)

运行行为：
- `./ss chat` 每轮会根据会话结果在线微调记忆权重
- 权重变化会写入 `memory_weight_updated` 事件（可审计）
- 低显著记忆达到阈值会压缩到 `summaries/working_set.json`，并写入 `memory_compacted` 事件
