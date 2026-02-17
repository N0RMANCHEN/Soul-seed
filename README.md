# Soulseed (CLI / TypeScript) — local-first Persona / Identity Runtime

> **阶段（P0）**：先做 CLI 薄壳，验证“灵魂内核 + 驱动闭环”的价值；UI/iOS 等客户端后置。  
> **命名策略**：仓库当前使用 **Soulseed（codename）**。如果你想更“产品化”，推荐候选名见下文 *Naming*（你可随时替换，代码与目录结构不依赖名字）。

---

## 你在做什么（一句话）

你在做一层可移植的 **人格资产（Persona Package）** + 一个可审计、可回放的 **决策闭环（Orchestrator）**，让它可以挂到任何 LLM API 上作为“肉体”，并跨时间保持“同一个它”。

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

## 快速开始（占位，P0-0 会把它变成真实可跑）

> 本段是目标状态；当 P0-0 完成后必须与仓库真实命令一致。

```bash
# 1) 安装依赖（推荐 pnpm，也可 npm/bun）
pnpm install

# 2) 验证入口（单一入口）
./scripts/verify.sh

# 3) 创建一个 persona（目录包）
pnpm soulseed persona init --name "Aster" --out ./personas/Aster.soulseedpersona

# 4) 进入聊天（会写入 life.log.jsonl）
pnpm soulseed chat --persona ./personas/Aster.soulseedpersona

# 5) 资产体检/迁移提示（P0-1 后逐步实现）
pnpm soulseed doctor --persona ./personas/Aster.soulseedpersona
```

---

## CLI 设计（P0 只做必要命令）

> 目标：让“驱动闭环”可被最小成本验证。

### Persona
- `persona init`：创建 persona package（只做 seed；不写死 MBTI/性格）
- `persona inspect`：查看 persona 概览（默认只显示 name/avatar；`--dev` 才显示内部字段）
- `persona rename`：更名（写入事件；personaId 不变）
- `persona export` / `persona import`：本质是复制目录（保持可迁移）

### Chat / Session
- `chat`：进入会话（支持 streaming；支持 Ctrl+C 中止）
- `session list` / `session open`：可选（P0 可先用单 session）

### Doctor
- `doctor`：Persona 资产体检 + schema 迁移提示 + life log 完整性检查（P0-1 后逐步实现）

---

## Persona Package（人格资产结构）

```
<PersonaName>.soulseedpersona/
  persona.json              # id、displayName、schemaVersion、paths
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

## Roadmap（执行版，先跑通闭环）

### P0-0 CLI Verify + CI（协作基础设施）
交付：`./scripts/verify.sh` + CI（Linux runner）  
DoD：verify 0 退出；CI 全绿。

### P0-1 驱动闭环：load → decide → generate → writeback
交付：
- Persona Loader（读写 package）
- Orchestrator（最小 DecisionTrace schema + context compiler）
- ModelAdapter（真实接入 LLM；支持 streaming）+ Mock
- life log append-only

### P0-1a DecisionTrace 回放与回归
交付：
- Replay harness（mock adapter 下可回放）
- 关键路径单测（至少：追问/拒绝/正常回复三类 trace）

### P0-1b life log 防篡改证据链
交付：
- `prevHash/hash` 链式写入
- 校验失败触发 scar event（不做“悄悄修复”）

### P0-1c Persona Doctor（体检 + 迁移提示）
交付：
- package 完整性检查
- schema migration 提示/最小迁移器（能跑、可测）

### P0-2 Profile Memory：用户名必记（跨重启/跨会话）
交付：`user_profile.json` + 每轮强制注入 + 最小抽取规则。

### P0-3 自由演化：MBTI/性格/名字都是可变的（但有门槛）
交付：更名事件、习惯演化事件、（可选）性格向量更新规则。

### P0-4 Attachments：头像/图片可正确加载与迁移
交付：相对路径引用；复制后仍可解析。

### P0-x （可选）MCP 兼容层 / 外部集成
交付：把“决策/记忆编译”暴露为可调用接口（不抢渠道生态）。

---

## Dev AI 协作规则

- 读 `AGENT.md` 与 `contributing_ai.md`。
- 一次只做一个任务，交付整文件，不给 diff。
- 不删旧代码：迁移则归档到 `packages/legacy-*`。

---

## License

TBD
