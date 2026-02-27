# Soulseed Architecture & Folder Governance Standard

> 更新日期：2026-02-26  
> 作用：定义项目架构边界、目录职责、文件命名与门禁规则。  
> 定位：长期治理标准（What is allowed / not allowed），不替代任务执行文档。  
> 适用范围：整个仓库（`packages/*`, `scripts`, `config`, `doc`, `datasets`, `schemas`, `test`, `reports`, `personas`）。

---

## 1. 规则优先级（冲突处理）

冲突时按以下优先级执行（高 > 低）：

1. `AGENT.md`（仓库最高协作规则）
2. 本文档（架构与目录治理）
3. `doc/Product-Standards.md`（产品通用实施标准）
4. `doc/Quality-Evaluation.md`（质量评测与门禁）
5. 其他协作与执行文档

说明：本文档负责“怎么组织代码和目录才合规”。

---

## 2. 架构分层与边界

### 2.1 Core-first（硬约束）

- 所有人格/记忆/决策/存储逻辑优先在 `packages/core`。
- `packages/cli`、`packages/mcp-server` 是壳层，不得沉淀不可复用核心能力。

### 2.2 包职责

- `packages/core`：领域逻辑、状态协议、守卫、存储、类型与稳定接口。
- `packages/cli`：命令交互、参数解析、会话入口、用户 I/O。
- `packages/mcp-server`：MCP 协议适配与工具暴露。

### 2.3 依赖方向

- 允许：`cli -> core`、`mcp-server -> core`
- 禁止：`core -> cli`、`core -> mcp-server`、`cli <-> mcp-server` 互相直接依赖

### 2.4 导出面治理

- `packages/core/src/index.ts` 只导出稳定 API。
- 新增模块默认不自动 `export *`，需显式评审后加入稳定导出面。
- 壳层禁止依赖 internal-only 模块路径（必须经稳定导出面）。

---

## 3. 目录职责与放置规则

### 3.1 顶层目录约定

- `packages/`：生产代码（按包分层）
- `scripts/`：门禁、验证、工具脚本
- `config/`：规则与阈值配置（可审计 JSON）
- `schemas/`：结构契约（JSON Schema）
- `datasets/`：评测数据集
- `test/`：跨包或集成回归测试
- `doc/`：规范与手册
- `reports/`：评测/验收产物（报告）
- `personas/`：人格资产（运行态）

### 3.2 `packages/core/src` 分层规则（强制）

- `runtime/`：执行协议、路由、编排与模型适配
- `memory/`：记忆检索、生命周期、存储与预算
- `persona/`：人格包读写、迁移、lint、compile、身份资产
- `state/`：state delta、状态域、genome/epigenetics、不变量
- `guards/`：一致性与风险守卫
- `governance/`：doctor、metrics、replay、trace、评估
- `capabilities/`：能力注册与意图解析
- `proactive/`：主动消息引擎

根目录白名单仅允许：`index.ts`、`types.ts`。新增根层业务文件一律视为违规并被门禁阻断。

### 3.3 文档目录规则

- 规范类：放 `doc/` 根目录（长期标准）
- 路线类：如需维护，请使用受控内部渠道，不纳入仓库文档
- 计划类：如需维护，请使用受控内部渠道，不纳入仓库文档
- 检查表：`doc/checklists/*`

---

## 4. 文件命名与组织规则

### 4.1 命名

- TypeScript 文件：`snake_case.ts`（与现有风格一致）
- 文档文件：`Pascal-Case-Kebab.md` 或既有前缀体系（保持一致，不混用）
- 配置文件：`snake_case.json`

### 4.2 单文件体量控制

- 生产代码文件建议上限：`<= 800` 行；超过需说明理由并拆分计划。
- 超过 `1200` 行视为高风险，必须给出拆分方案。

### 4.3 同域文件聚合

- 同一能力的类型、逻辑、IO、测试应在同域目录内聚合。
- 禁止跨目录散落同一领域的主逻辑与写路径。

---

## 5. 状态写入与存储治理

### 5.1 统一状态协议

所有持久化状态更新遵循：

`proposal -> gates -> deterministic apply -> audit trace`

禁止绕过 gate 直接写状态文件（除白名单迁移/快照路径）。

### 5.2 direct-write 门禁

- `scripts/check_direct_writes.mjs` 为强制门禁。
- 新增状态文件时，必须同时更新：
  - 状态域映射
  - 允许写入模块清单
  - 对应测试与文档

### 5.3 人格资产文件

- `life.log.jsonl` append-only 不可篡改
- schema 变更必须有版本号与迁移策略
- 迁移必须满足：可回滚、可幂等、可审计

---

## 6. 变更门禁（必须）

任何变更至少通过：

1. `npm run verify`
2. 文档联动排查（README / standards / relevant docs）
3. `CHANGELOG.md` 增量记录（当前版本节或 Unreleased）

涉及以下场景需追加门禁：

- 在线链路改动：`npm run acceptance`
- schema 改动：schema fixture + 校验脚本
- 状态域改动：direct-write gate + 回归测试

### 6.1 架构治理门禁（新增）

- 命令：`npm run governance:check`
- 脚本：`scripts/arch_governance_check.mjs`
- 规则源：`config/governance/architecture_rules.json`

当前检查项（首版）：
1. 必需规范文档存在性（缺失即失败）
2. 关键入口文件行数阈值（默认告警）
3. `core` 导出面宽度（`export *` 数量告警）
4. workspace 版本声明一致性（阻塞）
5. `core` 分层合规（阻塞）：根目录白名单 + 必需分层目录存在性

说明：当前采用“核心项阻塞 + 风险项告警”策略；`core` 分层合规已启用阻塞。

### 6.2 文档-代码一致性巡检（新增，非阻塞阶段）

- 命令：`npm run doc-consistency:check`
- 脚本：`scripts/check_doc_code_consistency.mjs`
- 规则源：`config/governance/doc_code_consistency_rules.json`
- verify 接入策略：先非阻塞（输出告警，不中断 `verify`），稳定后可提升为阻塞。

当前检查类型（首版）：
1. 路径一致性：关键文档中的代码/文档路径引用是否存在
2. 路径一致性：关键文档中的代码/文档路径引用是否存在
3. 字段一致性：关键文档字段声明是否与实现约定一致（如 `EXPORT_MANIFEST.json`）

---

## 7. 任务与分工落地规则（双人协同）

- 任务必须含：负责人、依赖、同步点、回滚归属。
- 高耦合或 hard 风险任务必须串行。
- 并行任务必须明确同步门槛（例如：接口冻结后再并行）。
- 任务编号冻结，不允许重排历史 ID。

---

## 8. 反模式（禁止）

- 在 `cli` 中实现核心领域逻辑且不沉淀到 `core`
- 通过临时脚本直接改写人格状态文件绕过协议
- 在多个文档复制同一“结构真相”导致分叉
- 新增大体量单文件且无拆分计划
- `core` 无差别扩大公共导出面

---

## 9. 例外与豁免流程

允许临时例外，但必须同时满足：

1. 例外说明（原因、范围、到期时间）
2. 风险评估（影响面、回滚方案）
3. 对应追踪记录（`CHANGELOG.md` 或 issue 记录）
4. 到期后必须回收，不得永久悬挂

---

## 10. 执行检查清单（PR 使用）

提交前逐条确认：

1. 目录放置是否符合职责边界？
2. 是否新增了不必要的跨层依赖？
3. 是否触发了状态写路径变更？若是，是否更新 gate？
4. 是否扩大了 `core` 导出面？是否有必要？
5. 文档是否同步更新且无冲突？
6. `npm run verify` 是否通过？
7. `npm run governance:check` 是否无失败并审阅告警？
