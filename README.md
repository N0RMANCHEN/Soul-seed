# Soulseed — Local-first Persona / Identity Runtime

> **Local-first · 可迁移 · 可审计 · 可成长**
> Soulseed 不是聊天工具，而是一层可移植的**人格资产（Persona Package）** 运行时，让一个具有记忆、宪法、关系状态的 AI 人格跨时间持续存在，并可挂接到任何 LLM API 上。

---

## 一句话定位

你在运行一个带有**四类类人记忆**（情节/语义/关系/程序）、**五段式认知流水线**、**五层一致性守卫**的人格运行时 —— 它不是 prompt 堆叠，而是可审计、可回放、可迁移的人格资产驱动闭环。

---

## 核心架构

```
┌─────────────────────────────────────────────────────┐
│                    packages/cli                      │
│             ./ss  （交互入口 + 编排）                │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                  packages/core                       │
│                                                      │
│  execution_protocol                                  │
│    ├─ dual_process_router  (instinct / deliberative) │
│    └─ runtime_pipeline     (5段式流水线)              │
│         ├─ [soul]  orchestrator.decide → LLM        │
│         └─ [agent] agent_engine (Planner/Executor)  │
│                                                      │
│  consistency_kernel (5层守卫)                        │
│    identity · relational · recall_grounding          │
│    factual_grounding · constitution_rules            │
│                                                      │
│  meta_review  (LLM 元认知审核: quality + verdict)    │
│  self_revision (habits/voice/relationship 自修正)    │
│                                                      │
│  Memory Stack:                                       │
│    memory_store (SQLite) + memory_embeddings (向量)  │
│    Hybrid RAG = FTS + 向量 + salience 融合           │
│                                                      │
│  Persona Package (文件真相层):                        │
│    constitution · habits · worldview · soul_lineage  │
│    life.log.jsonl (append-only + hash 链)            │
│    memory.db (SQLite 四状态记忆)                     │
│                                                      │
│  golden_examples (few-shot 注入)                    │
│  finetune_export (SFT 数据集导出)                   │
│  social_graph (社交关系图谱)                         │
│  proactive/engine (主动消息策略)                     │
└──────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│              packages/mcp-server                     │
│    MCP JSON-RPC 2.0  (stdio + HTTP)                  │
│    工具: persona.get_context · memory.search         │
│          conversation.save_turn · agent.run 等       │
└──────────────────────────────────────────────────────┘
```

---

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置 DeepSeek API Key（首次）
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY

# 3. 构建所有包
npm run build

# 4. 创建一个人格
./ss new Teddy

# 5. 进入对话
./ss Teddy

# 6. 健康检查
./ss doctor

# 7. 一键验收（使用隔离 QA persona）
npm run acceptance
# 产物: reports/acceptance/

# 8. 验证构建 + 测试
./scripts/verify.sh
```

---

## Persona Package 结构

每个人格是一个可复制、可备份的目录：

```
<Name>.soulseedpersona/
  persona.json              # id, displayName, schemaVersion, defaultModel
  identity.json             # 身份锚点（personaId 永不变）
  constitution.json         # 使命 / 价值 / 边界 / 承诺（可修宪）
  worldview.json            # 世界观种子（可演化）
  habits.json               # 习惯与表达风格（可塑形）
  user_profile.json         # 用户称呼 / 语言偏好（Profile Memory）
  pinned.json               # Pinned Memory（少而硬）
  voice_profile.json        # 语气偏好（tone / stance）
  relationship_state.json   # 关系状态六维向量
  cognition_state.json      # 认知状态（模型路由配置等）
  soul_lineage.json         # 繁衍血脉（parent / children）
  life.log.jsonl            # append-only 事件流（带 prevHash/hash 链）
  memory.db                 # SQLite 四状态记忆库
  summaries/
    working_set.json        # 近期工作集摘要
    consolidated.json       # 阶段性内化总结
    archive/                # 冷归档段文件
  goals/                    # Agent 目标与规划上下文
  golden_examples.jsonl     # Few-shot 示例库（≤50条）
  social_graph.json         # 社交关系图谱（≤20人）
```

**硬规则**：
- `life.log.jsonl` append-only，历史不可篡改（断链写 scar event）
- 二进制附件不进 JSON，只存引用
- schema 变更必须 bump `schemaVersion` 并提供迁移策略

---

## 关键能力一览

### 认知路由（双进程）
- **直觉路径（instinct）**：高情绪/高亲密度/边界冲突时，走轻量快速路径
- **深思路径（deliberative）**：通用对话，走完整五段式流水线

### 五段式运行时流水线
`perception → idea → deliberation → meta_review → commit`

### 五层一致性守卫
身份一致性 · 关系一致性 · 召回接地 · 事实接地 · 宪法边界

### 记忆系统
- 四状态生命周期：`hot → warm → cold → archive`（含 `scar`）
- Hybrid RAG：FTS 全文 + 向量检索 + salience 融合
- 用户事实自动提取与晶化（3次提及门槛）
- 记忆整合（light / full 两档）、冷归档、预算控制

### 宪法晶化（Constitution Crystallization）
从行为记忆上行提炼 → 提案 → 审核 → 应用 / 回滚，支持完整版本生命周期

### 人格自修正（Self-Revision）
基于 Meta-Review 风格信号和对话历史，对 habits / voice / relationship 提出修正并写入

### Few-shot 示例库（Golden Examples）
≤50条最佳人格表现对话，自动注入提示词（字符预算控制），支持 Meta-Review 自动晶化（quality ≥ 0.85）

### SFT 微调数据集导出
从 life.log 过滤高质量轮次 → 标准 SFT JSONL，可直接用于主流微调框架

### MCP 服务器
JSON-RPC 2.0，支持 stdio + HTTP 两种传输，可接入 ChatGPT / Claude 等外部模型

### 行为漂移检测
基于事件窗口计算行为指标快照，与基线对比，报告超阈值维度

### Doctor 体检
全量 persona 结构检查 + 宪法质量评分（0-100，A-D 等级）+ 行为漂移检测

---

## 项目结构

```
packages/
  core/           # 纯核心：记忆/编排/守卫/适配器/人格文件 I/O
  cli/            # CLI 壳：./ss 命令入口与交互逻辑
  mcp-server/     # MCP JSON-RPC 2.0 服务器
scripts/
  verify.sh           # 单一验证入口（lint + typecheck + test + build）
  acceptance.sh       # 在线链路验收（使用 QA persona）
  eval_all.sh         # 质量评测全量入口
  baseline_delta.mjs  # 基线 delta 对比
  nightly_diff.mjs    # Nightly 指标差异报告
  update_baseline.mjs # 更新基线快照
  quality_scorecard.mjs  # 质量 scorecard 生成
  migration_audit.mjs # 迁移一致性对账
  nightly_consolidate.mjs  # 定时记忆整合
datasets/
  quality/
    retrieval/    # 检索回归数据集
    grounding/    # 落地守卫数据集
    safety/       # 安全对抗数据集
reports/
  acceptance/     # 验收报告
  quality/        # 质量 scorecard 与 delta 报告
doc/
  CLI.md              # 完整 CLI 命令参考
  Roadmap.md          # 产品阶段与里程碑（全部完成）
  Quality-Evaluation.md  # 分层评测框架（L0-L5）
personas/
  <Name>.soulseedpersona/  # 人格资产目录（git 忽略 soul 数据）
  _qa/                     # 验收隔离 persona
```

---

## 开发命令

```bash
npm run build          # 构建所有包
npm run test           # 跑所有测试
npm run lint           # TypeScript 类型检查
npm run verify         # 完整验证（lint + test + build）
npm run acceptance     # 在线链路验收
npm run eval:all       # 质量评测全量
npm run quality:baseline-delta   # 查看基线变化
npm run quality:nightly-diff     # Nightly 指标差异
npm run migration:audit          # 迁移一致性对账
```

---

## 文档索引

| 文档 | 内容 |
|------|------|
| `doc/CLI.md` | 完整命令参考（所有 ss 子命令 + 参数） |
| `doc/Roadmap.md` | 产品阶段与已完成里程碑总览 |
| `doc/Quality-Evaluation.md` | 分层评测体系（L0-L5）、指标字典、门禁策略 |
| `AGENT.md` | AI 开发协作指南（产品真相 + 架构边界 + 铁律） |
| `contributing_ai.md` | Dev AI 贡献规范（输出结构 + 验证门槛） |

---

## Dev AI 协作

- 读 `AGENT.md` 与 `contributing_ai.md`（AGENT.md 优先）
- 任何改动先通过 `./scripts/verify.sh`
- 在线链路改动必须附 `npm run acceptance` 报告
- 验收只使用 `personas/_qa/*`，禁止污染日常 persona

---

## License

TBD
