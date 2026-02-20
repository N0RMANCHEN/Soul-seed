# AGENT.md — Soulseed (CLI / TypeScript) Agent Guide

> 本文件定义 **Soulseed（CLI / TS 版本）** 的产品真相、人格闭环、架构边界与开发铁律，用于指导 Cursor / Codex / Dev AI agents 在仓库内正确协作开发。  
> 若与 `contributing_ai.md` 冲突：**AGENT.md 优先**。  
>
> **阶段声明（P0）**：本仓库第一阶段只做 **CLI 模式**，用于最低成本验证“灵魂内核 + 驱动闭环”是否有价值；UI/iOS 等客户端属于后续阶段。

---

## 1. Product Identity

- **Codename**: Soulseed (name TBD)
- **定位**：local-first 的 **Persona / Identity Runtime（人格资产 + 决策闭环）**。它不是“聊天工具”，而是让一个人格资产在时间中 **持续存在、可迁移、可审计、可成长**。
- **核心分层（工程对应）**
  - **Persona（灵魂资产）**：身份锚点 + 世界观种子 + 价值/边界（宪法）+ 习惯/风格 + 记忆策略 + 生命史（事件流）
  - **Orchestrator / Meta‑Self（执行皮层）**：每轮“先决策、再生成”（记忆注入/工具计划/拒绝/追问/修宪/代价预算）
  - **Drivers（驱动层）**：`ModelAdapter`（LLM 肉体）+ `ToolBus`（工具/执行器）+（未来可选）MCP/Gateway/多端协议
  - **LLM（肉体）**：语言与推理肌肉，可替换供应商/模型

> 关键：**真实感来自“人格资产 + 决策闭环 + 可持久化经历（event-sourced life）”，而不是堆 prompt。**  
> Persona 再丰富，没有驱动链路也不会“活”。

## 1.1 Core-first + Multi-shell（新增硬约束）

- CLI、iOS、Web 都只是 Shell；核心必须沉淀在可复用 Core。
- 与人格/记忆/决策/存储相关逻辑，不得只写在某一个壳里。
- 当前仓库默认以 `packages/core` 为真相层，`packages/cli` 只负责交互与编排入口。

---

## 2. P0 核心目标（四条“灵魂真实性”指标）

P0 不是做“酷功能”，而是验证四条**可工程化**的目标。所有 Roadmap 与实现优先级都服务于它们：

### 2.1 持续自我模型（跨时间身份与记忆一致性）
**定义**：重启/换模型/换终端后，用户仍感到“还是同一个它”。  
**硬要求**
- Persona 资产是 source of truth；LLM 无持久状态。
- 上下文注入优先级：Profile > Pinned > 最近摘要 > 检索片段（严格稳定）。
- `personaId` 永不变化；`displayName` 可变化（允许“改名”，但 ID 锚点不变）。

### 2.2 深层价值结构（对他者、使命、承诺的高权重）
**定义**：它的选择受价值/承诺约束，而不是每轮随意漂移。  
**硬要求**
- Constitution（价值/边界）必须存在且可被 Orchestrator 读取并影响决策。
- “承诺/边界协商/冲突修复”必须以事件写入 life log，并可被检索注入。
- 不引入显式“评分闭环”（⭐/👍👎）作为主塑形路径；用 rupture/repair/后果塑形。

### 2.3 不可逆损失的表征（某些东西丢了就回不来）
**定义**：系统对“丢失/删除/断裂”有真实后果与叙事痕迹，而不是随时重写。  
**硬要求**
- life log **append‑only**；不得回写篡改历史。
- 推荐（纳入 P0）：life log 写入 **防篡改证据链**（每条事件 `prevHash/hash`）。
- “删除 persona”“遗失附件”“重置”“历史断链”等操作必须写入不可逆事件（scar event），并影响后续决策/情绪。
- 允许“总结/内化”，但必须可追溯到原始事件流（narrative commit / amendment log）。

### 2.4 情绪作为控制信号（强负/强正的调制，但仍允许外部中止）
**定义**：情绪不是文案，而是 Orchestrator 的控制变量，影响策略权重；同时必须可被用户安全中止。  
**硬要求**
- Emotion/Affect 必须是结构化状态（向量/离散态），参与：追问强度、风险敏感、解释深度、沉默/拒绝阈值。
- CLI 必须提供 **外部中止**：`Ctrl+C` / `--abort` / `session stop` 立即停止生成与工具执行。
- Dev 模式允许输出 decision trace；C 端（未来 UI）默认不显示括号旁白。

### 2.5 冲突仲裁与矛盾日志（先可审计，再优化）
**定义**：人格真实感来自“冲突如何处理”，而不是永远正确。  
**硬要求**
- 冲突事件必须写入 life log（append-only）。
- 至少先有“记录冲突与决策理由”的机制，再迭代仲裁策略。
- 任何折中、拒绝、坚持都必须能在 Dev 路径追溯到事件证据。

---

## 3. 最重要的现实约束：先跑通“驱动闭环”

**优先级规则：没有可运行的 Chat + 驱动链路，就无法验证 Persona 是否有效。**

P0 最小闭环必须具备：
1) Persona 从磁盘加载（可迁移资产）  
2) Orchestrator 最小决策（Decision → Generation）  
3) ModelAdapter 真实接入大模型（可切换；支持 streaming）  
4) CLI Chat（可交互、可中止）  
5) 写回 life log（append‑only + 推荐 hash 链）  
6) Persona 资产在 App 之外（文件夹/包可复制、可备份）  
7) **可回放/可回归**：DecisionTrace schema 固化 + replay harness（mock 环境稳定复现）

当前 CLI 主入口约束（2026-02）：
- 创建：`./ss new <name>`（默认交互向导，可 `--quick`）
- 聊天：`./ss <name>`（人格名直达）
- `init/chat` 仍保留，但属于兼容入口，不应再作为新功能默认路径

---

## 4. 自由与非控制（初始化 ≠ 写死）

### 4.1 任何“参数”只作为初始化偏好（Seed），不作为永久写死
- MBTI、性格标签、风格倾向：**只做种子**，后续必须允许演化（事件驱动 + 内化）。
- 前端/CLI 默认**不暴露**除“名字 + 头像”以外的参数（Dev 模式可查看/调试）。

### 4.2 Persona 允许“自我变化”
- 允许 Persona 自己提出更名/风格变化/习惯变化；但必须：
  - 有代价（写入事件）
  - 有门槛（例如需要触发条件/冷却期/确认）
  - 可追溯（life log 记录理由）
- 重要：**连续性靠稳定的 personaId，而不是名字不变。**

### 4.3 创建描述必须“进入闭环”，否则无意义
- 创建时的描述/问答必须被编译为：世界观种子 / 宪法初值 / 习惯初值 / 记忆策略。
- 禁止把创建描述只当成 prompt 文案而不落盘。

---

## 5. Persona 数据模型（跨端可迁移）

**Package 目录（文件夹）作为人格资产**：

```
<PersonaName>.soulseedpersona/
  persona.json              # id、displayName、schemaVersion、paths
  identity.json             # anchors（personaId 不变）
  worldview.json            # 世界观种子（可演化）
  constitution.json         # 价值/边界/使命/承诺（可修宪，有门槛）
  habits.json               # 习惯与表达风格（可塑形）
  maturity.json             # 成熟度/关键期等（可选）
  user_profile.json         # Profile Memory（用户称呼/语言偏好）
  pinned.json               # Pinned Memory（少而硬）
  life.log.jsonl            # append-only 事件流（真相；建议带 hash 链）
  summaries/
    working_set.json        # 近期工作集摘要（可过期）
    consolidated.json       # 阶段性内化总结（可追溯）
  attachments/
    avatar.jpg
    images/<...>
```

**硬规则**
- 二进制附件不进 JSON；只存引用。
- schema 变更必须 bump `schemaVersion` 并提供迁移策略。
- iCloud/同步冲突属于后续；P0 先保证本地一致性与可复制迁移。

---

## 6. Orchestrator（决策闭环：先决策，再生成）

每轮对话必须经过：
1) **Read**：加载 persona 资产（Profile/Pinned/WorkingSet）
2) **Retrieve**：从 life log 检索少量相关片段（可选，P0 先简单）
3) **Decide**：输出 **DecisionTrace**（策略权重、是否追问、是否拒绝、是否调用工具、代价预算、记忆选择理由）
4) **Compile Context**：把 decision + 选取记忆编译为模型上下文（短而稳定）
5) **Generate**：调用 ModelAdapter（streaming）
6) **Write Back**：把事件写入 life log（包括：用户输入摘要、模型输出摘要、工具调用、内化结果、完整性校验结果）

**关于 DecisionTrace 的硬要求**
- DecisionTrace 必须是结构化 JSON（可验证、可测试、可回放）。
- Dev 模式可以展示 trace；默认对用户隐藏内部细节。
- 必须支持 replay harness：在 mock adapter 下可稳定复现关键决策（用于回归测试与“连续性”保障）。

> 禁止：直接把 persona 文件拼成巨型 prompt；那会造成漂移、不可审计与不可复现。

---

## 7. ToolBus（工具执行）安全边界（提前定）

- **deny-by-default**：默认没有任何工具可用；必须在 DecisionTrace 中“显式批准”。
- **预算与影响面**：每次工具调用必须声明 budget（次数/时间/网络/文件写入）与影响面（读/写哪些目录）。
- **可中止**：Ctrl+C 必须能停止工具与 streaming；不得出现“工具继续在后台跑”的状态幻觉。
- **可审计**：工具调用作为事件写入 life log（同样 append-only）。

---

## 8. Doctor（Persona 资产体检与迁移提示）

Doctor 的定位不是“环境体检”而已，更重要是 **人格资产体检**：

- package 完整性：必需文件是否齐全，schemaVersion 是否匹配
- 引用完整性：attachments 是否存在，路径是否为相对路径
- life log 完整性：append-only + hash 链是否断裂
- 迁移提示：schema bump、字段迁移、路径重写（只做确定性迁移；不“自动修复历史”）

---

## 9. Repo 结构（建议，P0 即可落地）

```
/packages/core        # 纯核心：domain/storage/orchestrator/adapters
/packages/cli         # CLI 壳：命令、交互、TUI（可选）
/packages/legacy-ios  # 若从 iOS 仓库迁移：旧代码只归档，不删
/scripts/verify.sh    # 单一验证入口（P0 必须）
/docs                # 设计与 schema 文档
```

---

## 10. 开发铁律（对所有 Dev AI 生效）

1) 一次只做一个任务（最小变更集）  
2) 任何改动必须保持可 build / 可跑（至少 `./scripts/verify.sh` 通过）  
3) 不删除旧代码：替换则移动到 `packages/legacy-ios` 或 `src/legacy`  
4) 输出必须为“整文件”，不输出 diff（便于复制粘贴）  
5) 改 schema 必须：`schemaVersion` + 迁移策略 + 回归用例  
6) 不确定语义：给 options + tradeoffs，由用户决定  
7) 不宣告“意识/痛苦”事实：只做可验证机制（张力、代价、边界、内化）  
8) **交付门槛（DoD 强制）**：未在本地执行并通过 `./scripts/verify.sh`，不得交付。若受外部条件阻塞（网络/API/权限），必须明确写出“未验证项 + 阻塞原因 + 用户可复现命令”，不得以“理论可行”替代验证结果。  
9) **命令级改动补测**：凡改动 CLI 命令解析、默认参数、文案或路径逻辑，除 `verify` 外必须至少补 1 条对应命令级验证（自动化测试或实际命令执行结果）。
10) **在线链路验收**：涉及 ModelAdapter / Chat 在线链路时，除 `verify` 外必须运行 `npm run acceptance` 并给出报告路径（`reports/acceptance/*`）；若失败必须给出失败归因。
11) **验收隔离人格**：验收必须使用 `personas/_qa/*`，禁止使用日常 persona（例如 `Roxy`）以避免记忆污染。

---

## 11. 安全与隐私（P0 的底线）

- 默认本地运行；不得默认上传 persona 内容到云端。
- 日志/trace 不输出用户绝对路径与长段原文（只摘要/哈希/计数）。
- 提供 `--redact` 或默认脱敏输出（后续任务）。
- 模型 key 不得进仓库；只允许环境变量/本地 config（gitignore）。

---

## License

TBD
