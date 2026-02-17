# contributing_ai.md — Soulseed (CLI / TypeScript)

> 本文件约束 **Dev AI（开发协作）**：用于 Cursor / Codex / 其它 AI 编程工具如何改动本仓库。  
> 若与 `AGENT.md` 冲突：**以 `AGENT.md` 为准**。

---

## 0) Scope（范围）

- **Dev AI**：写代码、补测试、跑构建、更新文档。
- **Runtime AI**：产品内 Persona runtime / Orchestrator / ToolBus / ModelAdapter（属于产品能力）。

## 0.1 Core-first & Multi-shell（对齐）

- CLI / iOS / Web 都是壳，核心逻辑必须优先放在 `packages/core`。
- 若某项逻辑可复用，不得只写在 `packages/cli` 的交互层。

---

## 1) Default Working Protocol（强制输出结构）

任何任务（哪怕很小）都必须按以下结构输出；缺一项 = 视为未完成：

1) **Goal（目标）**  
2) **DoD（验收标准，PASS/FAIL）**  
3) **Plan（步骤，可回滚）**  
4) **Files to add/change（精确路径）**  
5) **Verification（验证命令/预期）**  
6) **Final Output（整文件交付，不给 diff）**  
7) **Self-check（逐条标注 DoD：PASS / NOT VERIFIED）**

---

## 2) Read Order（每次会话开始必须阅读）

1) `AGENT.md`  
2) `contributing_ai.md`  
3) `README.md`  
4) 若在排查构建：先看 `./scripts/verify.sh` 与 CI 日志

---

## 3) Non‑negotiables（铁律）

### 3.1 一次只做一个任务（最小变更集）
禁止“顺手重构”。

### 3.2 不允许偷换语义
- 不得引入显式评分闭环（⭐/👍👎）作为主塑形路径。
- 不得把 persona 退化为 prompt 模板；必须保留 Orchestrator 决策闭环与资产化存储。
- 不得把 MBTI/性格参数写死为永久；只允许作为初始化种子。
- “主动思考”不得假装：不允许只加“我很好奇…”文案；必须由 decision/tension/代价预算驱动。
- 不得拖后驱动链路：Chat + ModelAdapter + Persona(文件)读写是 MVP 必需品，必须靠前。
- 不得用“不可验证的玄学叙事”替代工程机制：不可逆要靠 event-sourcing + 校验链；连续性要靠注入顺序与回归。

### 3.3 绝不删除旧代码
替换则移动到 `packages/legacy-ios`（或 `src/legacy`）。

### 3.4 不泄露隐私/绝对路径
trace/日志禁止输出绝对路径与用户长段原文（可摘要/哈希/计数）。

### 3.5 File-first Persona（默认不共享）
- Persona 资产以文件为唯一真相与载体（可复制、可迁移、可备份）。
- 默认不对外暴露写权限；共享必须是用户显式动作。

### 3.6 输出风格约束
- CLI 默认只展示“对用户可见”的回复；Dev/Debug 才显示 decision trace。
- C 端（未来 UI）默认禁止括号情感旁白；Dev 模式可显示内部状态。

### 3.7 连续性是第一性需求（Same Persona Continuity）
- 关闭会话/重启/换模型后必须保持连续性体验。
- 注入优先级必须稳定：Profile > Pinned > WorkingSet > 检索片段。
- 变更 Orchestrator/记忆/存储时必须评估连续性影响并补回归用例。
- DecisionTrace schema 一旦发布必须向后兼容或提供迁移（它是回放与回归的基石）。

### 3.8 安全默认：ToolBus deny-by-default
- 默认无工具可用；必须显式批准（DecisionTrace）。
- 工具调用必须可中止（Ctrl+C / abort），并写入事件日志。
- 工具 side-effect 必须声明影响面（读/写范围）与预算（次数/时间/网络等）。

---

## 4) Secrets & API Keys（安全规则）

- API Key 不得提交进 git。
- 推荐：环境变量（`OPENAI_API_KEY` 等）或本地 config（必须 gitignore）。
- 若引入配置文件：必须更新 `.gitignore` + README 说明。

---

## 5) Verification Gates（验证门槛）

### 5.1 Always（任何改动都必须）
- `./scripts/verify.sh` 通过（单一入口，失败退出非 0）。
- 期望 verify.sh 覆盖：
  - `pnpm lint`（或 `npm run lint`）
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
- 若改动涉及在线模型链路（ModelAdapter / chat online path），必须额外运行 `npm run acceptance` 并记录报告路径。

### 5.2 Chat / ModelAdapter changes（改动驱动链路必须）
至少完成 3 项回归：
1) 选择一个 persona 目录 → 成功加载  
2) 发消息 → 模型返回（最好 streaming）  
3) 对话后 life log 追加写入（重新打开仍存在）

### 5.3 Storage / schema changes（改动 persona 文件结构必须）
- 确保 life log append-only；不得把二进制塞进 JSON（attachments 引用）。
- 若实现 hash 链：必须增加“断链检测”用例（fixture + test）。
- 增加/变更 schema 必须有 `schemaVersion` 与迁移策略，并提供迁移测试或 fixture。

### 5.4 Orchestrator / DecisionTrace changes（改动决策闭环必须）
- 至少新增/更新 1 个单元测试：mock ModelAdapter + mock ToolBus。
- DecisionTrace 必须结构化、可验证（schema 校验或类型约束）。
- 若改动决策逻辑：必须更新 replay fixture 或新增回放用例，保证关键决策可稳定复现（回归测试）。

### 5.5 Doctor changes（改动 doctor 必须）
- 至少提供 1 组坏数据 fixture（缺文件/断链/丢附件）+ 期望诊断输出。
- Doctor 不得“悄悄修复历史”：只能提示/生成迁移方案；任何修复必须写入事件（scar / migration event）。

### 5.6 ToolBus changes（改动工具系统必须）
- 默认 deny-by-default 不可破。
- 必须验证 Ctrl+C/abort 能中止工具与 streaming（至少 1 条自动化测试或脚本回归）。

---

## 6) Output Rules（交付格式）

- 只输出整文件（完整内容可复制粘贴），不要给 diff。
- 文件名必须写清楚：
  - `# FILE: packages/core/src/...`
  - `# FILE: README.md`

---

## 7) Definition of Done（一次贡献成功标准）

必须同时满足：
- 不违反 `AGENT.md`
- `./scripts/verify.sh` 通过 + CI 全绿
- 驱动闭环不被破坏（能加载 persona、能聊、能写回）
- Persona 存储可迁移、可审计、life log append-only（推荐 hash 链）
- DecisionTrace 结构化且可回放（至少 mock 回放）
- 不引入显式评分反馈作为主闭环
- 主动思考不是文案：由 decision/tension/代价预算驱动
- 四条 P0 指标（持续自我/价值结构/不可逆损失/情绪控制信号）的实现路径更清晰而不是更模糊
- 在线链路改动已通过 `npm run acceptance`，并提供报告文件（成功或失败归因）
- 验收未污染日常 persona（只使用 `personas/_qa/*`）
