# Soulseed Roadmap（P0-P5 执行版）

## 基线
- 更新日期：2026-02-18
- 目标：本地优先、四类类人记忆、强可解释、可长期运行、在线检索额外时延 P95 `<=150ms`
- 任务编号规则：`P{优先级}-{序号}`，数字越小优先级越高
- 状态：`done` / `in_progress` / `todo` / `blocked`

## P0（必须优先完成，阻塞主线）

### P0-1 记忆主存落地（SQLite）
- 状态：`done`
- 交付：
  - 新建 `personas/<id>.soulseedpersona/memory.db`
  - 建表：`memories`、`memory_edges`、`recall_traces`、`archive_segments`
  - schema version 与迁移入口
- DoD：
  - 初始化 persona 时可自动建库
  - doctor 可检查 schema/version 完整性
- 拆分任务（已完成）：
  - 定义 `memory.db` 初始 schema 与索引策略
  - 实现 persona 初始化时的建库入口
  - 实现 schema version 读取与迁移入口
  - 将 schema/version 校验接入 `doctor`

### P0-2 记忆写入链路（ingest + store）
- 状态：`done`
- 交付：
  - 从对话事件提取候选记忆并分类（`episodic|semantic|relational|procedural`）
  - 写入 `memory.db` 并记录 `source_event_hash`
- DoD：
  - 抽样回放中每类记忆都有可写入样本
  - `source_event_hash` 可在 `life.log` 追溯
- 拆分任务（已完成）：
  - 从对话事件抽取候选记忆并生成规范化结构
  - 实现四类记忆分类器与最小置信过滤
  - 写入 `memories` 并携带 `source_event_hash`
  - 增加抽样回放验证与追溯测试

### P0-3 召回链路 v1（无 RAG）
- 状态：`done`
- 交付：
  - 输入解析 -> 意图标签 -> 结构化检索 -> 打分 -> 预算裁剪 -> 注入
  - 默认预算：候选 `<=100`，精排 `<=30`，注入 `<=8`，字符 `<=2200`
- DoD：
  - 每轮产出 recall trace（命中、分数、淘汰原因、预算）
  - 无 soft-deleted 记忆被注入
- 拆分任务（已完成）：
  - 输入解析与意图标签器实现
  - 结构化检索与候选集上限控制
  - 精排评分（时效/关系/显著性）与淘汰原因记录
  - 注入预算裁剪（条数与字符双预算）
  - recall trace 落库与 `DecisionTrace` 关联
- 完成记录（2026-02-17）：
  - 新增 `packages/core/src/memory_recall.ts`，实现意图标签、评分精排与预算裁剪
  - 每轮召回写入 `recall_traces`（包含 selected ids / score+reason / budget+intent）
  - chat 主流程改为调用召回管线，并将 `recallTraceId` 固化到 `DecisionTrace`
  - 新增测试覆盖预算裁剪与 soft-delete 注入保护

### P0-4 迁移脚手架（life.log + working_set -> memory.db）
- 状态：`done`
- 交付：
  - 迁移脚本与备份目录：`migration-backups/<ts>/`
  - 报告：`memory-migration-report.json`
- DoD：
  - 可一键迁移与回滚
  - 报告包含条目数、哈希摘要、失败样本
- 拆分任务（已完成）：
  - 设计迁移流程：预检、备份、迁移、校验、收尾
  - 增加 `memory compact` 命令作为迁移入口
  - 迁移报告落盘并包含失败样本
  - 失败路径自动回滚与备份恢复
- 完成记录（2026-02-17）：
  - 新增 `memory compact` CLI：`ss memory compact --persona <path>`
  - 迁移过程自动备份 `life.log.jsonl` 与 `working_set.json`
  - 迁移报告落盘到 `migration-backups/<ts>/memory-migration-report.json`
  - 失败自动回滚 `life.log` 与 `working_set` 文件

### P0-5 CLI 交互修正（AI 标签与主动消息）
- 状态：`done`
- 交付：
  - `assistant>` 改为动态 `AI名称>`（来自 persona displayName）
  - 新增主动消息控制：`/proactive on [minutes]`、`/proactive off`、`/proactive status`
- DoD：
  - 改名后标签实时切换
  - 主动消息默认关闭，开启后按间隔推送并可关闭
- 拆分任务（已完成）：
  - CLI prompt 改为 persona `displayName`
  - `rename` 后会话内 prompt 实时刷新
  - 增加 `/proactive on|off|status` 命令
  - 增加默认关闭与间隔参数校验

### P0-6 DecisionTrace 固化与回放基线
- 状态：`done`
- 交付：
  - 固化 `DecisionTrace` schema（字段、版本、兼容策略）
  - replay harness：mock adapter 下可复现关键决策（记忆选择、拒绝/追问分支）
- DoD：
  - 关键决策路径具备稳定回放测试
  - schema 变更必须伴随版本与迁移说明
- 拆分任务（已完成）：
  - 固化 `DecisionTrace` schema 与版本号
  - 提供旧版本 trace 迁移/兼容逻辑
  - 将 `orchestrator` 输出统一收敛到 schema
  - 建立 replay harness 覆盖追问/拒绝/记忆选择分支
- 完成记录（2026-02-18）：
  - 新增 `packages/core/src/decision_trace.ts`，固化 `DecisionTrace` schema 版本为 `1.0`，并提供对 `0.1.0` 的兼容迁移
  - `orchestrator.decide` 统一通过 schema 规范化输出 trace，避免漂移字段进入日志
  - `replay` 新增 harness：支持按用例校验“追问/拒绝/记忆选择”关键决策分支
  - 新增测试：`decision_trace_schema.test.mjs`、`decision_replay.test.mjs`（harness 分支验证）

### P0-7 life.log 断链处理（scar event）
- 状态：`done`
- 交付：
  - doctor/运行时发现 hash 链断裂时写入 `scar` 事件
  - `scar` 事件包含断裂位置、检测时间、处置动作
- DoD：
  - 可复现断链并生成可追溯 scar 记录
  - 后续决策可读取 scar 作为风险信号
- 拆分任务（已完成）：
  - 增加 hash 链断裂检测入口
  - 新增 `scar` 事件结构与写入逻辑
  - doctor 与 chat 启动时统一检测
  - 增加去重策略避免重复刷写 scar
- 完成记录（2026-02-18）：
  - 新增 `ensureScarForBrokenLifeLog`（`packages/core/src/persona.ts`），在检测到断链时写入 `scar` 事件
  - `doctor` 检测链路改为调用该函数，断链会自动记录 `breakReason / breakLine / detectedAt / action`
  - chat 运行时启动即执行断链检测并写 scar（去重，避免同原因重复刷写）
  - 新增测试：`lifelog_scar.test.mjs`，覆盖“可写 scar + 重复检测不重复写”

## P1（高优先，形成可用闭环）

### P1-1 生命周期 v3（激活/情感/叙事/关系）
- 状态：`done`
- 交付：
  - `memory_lifecycle_v3`：四信号统一评分
  - 状态流转与衰减策略（含 `decayClass`）
- DoD：
  - 评分边界与状态迁移有单元测试
  - 回放中无明显“短期噪声压制长期事实”回归
- 拆分任务：
  - 定义四信号评分公式（activation/emotion/narrative/relational）
  - 引入 `decayClass` 与时间衰减曲线
  - 定义状态机：hot/warm/cold/archive 与迁移阈值
  - 将 lifecycle 评分接入 ingest 与 recall 的共用路径
  - 增加边界测试与回放回归样例
- 完成记录（2026-02-18）：
  - `memory_lifecycle` 升级为四信号评分：`activation + emotion + narrative + relational`
  - 新增 `decayClass`（`fast|standard|slow|sticky`）并接入激活衰减曲线
  - 生命周期状态机扩展为 `hot/warm/cold/archive`（兼容 `scar`）
  - recall 强化路径改为按 `memoryType/state` 计算生命周期分值并回写状态
  - 补充测试：`memory_lifecycle_scoring.test.mjs` 覆盖状态边界、decay 差异与 relational 提升

### P1-2 软遗忘与恢复（CLI 调试能力）
- 状态：`done`
- 交付：
  - `forget --mode soft|hard`（默认 soft）
  - `recover --id <memory_id>`
  - 事件：`memory_soft_forgotten`、`memory_recovered`
- DoD：
  - soft forget 不物理删除，可恢复
  - recall trace 不应出现 soft-deleted
- 拆分任务（已完成）：
  - 扩展事件类型，支持遗忘/恢复审计事件
  - 实现 `memory forget`（soft/hard）与参数校验
  - 实现 `memory recover --id`
  - 将 soft-deleted 记忆从 list 默认视图隐藏
  - 保持 recall 侧 `deleted_at IS NULL` 过滤

### P1-3 记忆控制面 CLI（完整命令集）
- 状态：`done`
- 交付：
  - `ss memory status|list|inspect|pin|unpin|forget|recover|compact|export|import`
- DoD：
  - 全命令具备参数校验与错误码
  - 核心命令有 CLI 集成测试
- 拆分任务（已完成）：
  - 设计命令路由与统一输出格式（table/json）
  - 实现 `status|list|inspect|pin|unpin`
  - 实现 `forget|recover|compact|export|import`
  - 统一错误码与可读报错文案
  - 增加 CLI 集成测试覆盖核心路径
- 完成记录（2026-02-18）：
  - CLI 新增 `memory status|list|inspect|forget|recover|export|import`
  - `memory list` 支持 `--state` 与 `--deleted` 过滤
  - `memory export/import` 支持本地 JSON 快照导入导出，便于调试与回放
  - 现有 `memory pin`、`memory compact`、`memory reconcile` 保持兼容

### P1-4 ToolBus 安全边界落地（deny-by-default）
- 状态：`done`
- 交付：
  - 工具默认禁用，需在决策中显式批准
  - 每次调用声明预算与影响面（读/写路径、次数、时长）
  - 统一中止：`Ctrl+C` 同时中断 streaming 与工具调用
- DoD：
  - 工具调用全量写入可审计事件
  - 存在越权调用时可被拒绝并返回明确原因
- 拆分任务（已完成）：
  - 建立工具注册表与默认禁用策略
  - 在决策层增加显式批准字段（原因/预算/作用域）
  - 实现读写路径、调用次数、时长预算检查
  - 打通 `Ctrl+C` 到 streaming 与工具执行的统一中止
  - 输出审计事件并覆盖越权拒绝测试
- 完成记录（2026-02-18）：
  - 新增 `packages/core/src/toolbus.ts`，实现默认拒绝、显式批准、预算与路径作用域校验
  - CLI `chat /read` 接入 ToolBus（`fs.read_text`），所有调用写入 `mcp_tool_called/mcp_tool_rejected` 审计事件
  - `Ctrl+C` 统一中止 streaming 与正在执行的工具调用
  - 新增测试 `packages/core/test/toolbus.test.mjs` 覆盖拒绝策略、预算上限、作用域拒绝与中止路径

### P1-5 MCP 接入基线（Persona Runtime as MCP Server）
- 状态：`done`
- 交付：
  - 新增 MCP server 入口，暴露 persona 会话与记忆相关能力
  - 首批能力：`persona.get_context`、`conversation.save_turn`、`memory.search`、`memory.inspect`
  - 将 ToolBus 决策边界映射到 MCP 工具调用（deny-by-default + budget）
- DoD：
  - 外部 MCP client 可稳定调用并拿到结构化结果
  - DecisionTrace 可记录 MCP 调用请求、批准理由、执行结果与中止原因
- 拆分任务（已完成）：
  - 新建 MCP server 启动入口与基础握手能力
  - 实现 `persona.get_context` + `conversation.save_turn` 工具（会话上下文编译 + 会话回写）
  - 实现 `memory.search`、`memory.inspect` 只读工具
  - 将 ToolBus 审批与预算校验映射到 MCP 调用
  - 增加本地 client smoke 脚本验证协议与输出
- 完成记录（2026-02-18）：
  - 新建 `packages/mcp-server` 包（`@soulseed/mcp-server`），使用 `@modelcontextprotocol/sdk@^1.0.0`
  - 实现 `ToolRegistry` allow-list + 每工具 session budget + `mcp_tool_called/mcp_tool_rejected` 审计事件
  - 实现 `persona.get_context`（外部模型上下文编译）、`conversation.save_turn`（回写会话与守卫链）、`memory.search`、`memory.inspect`
  - CLI 新增 `ss mcp` 子命令（支持 `--transport stdio|http --host --port --auth-token`，默认 stdio）
  - 全量 `@soulseed/mcp-server` 测试通过（budget/reject/tools/handshake/http initialize+list+call），并完成 `ss mcp` 实链握手验收
  - 联调验收报告：`reports/acceptance/mcp-integration-20260218-193340.json`、`reports/acceptance/mcp-integration-20260218-193340.md`

#### P1-5 里程碑（M1/M2/M3）
- `M1` HTTP 启动 + initialize/tools/list：`done`
- `M2` tools/call + 鉴权：`done`
- `M3` 测试全绿 + ChatGPT 接入文档：`done`
- 里程碑完成明细（2026-02-18）：
  - 新增 HTTP 启动入口：`packages/mcp-server/src/http.ts`（`/mcp`、`/health`、兼容 `/sse`+`/messages`）
  - 复用 `ToolRegistry`，并抽离 `server_factory` 共享 stdio/http RPC 注册逻辑
  - 增加最小鉴权：`Authorization: Bearer <token>`（`MCP_AUTH_TOKEN`）
  - 增加基础限流：`MCP_RATE_LIMIT_PER_MINUTE`（按 IP）
  - 增加调用日志：工具名、耗时、拒绝原因；HTTP 请求日志：method/url/duration
  - 回归结果：
  - `npm test -w @soulseed/mcp-server` -> `15/15` pass
  - `npm test -w @soulseed/core` -> `85/85` pass
  - `npm test -w @soulseed/cli` -> `12/12` pass

## P2（中高优先，规模化与成本控制）

### P2-1 冷归档与分段压缩
- 状态：`todo`
- 交付：
  - `summaries/archive/segment-YYYYMM.jsonl`
  - 归档触发：事件数/冷记忆占比/时间窗口阈值
- DoD：
  - 主表保留摘要+引用，归档段可验 checksum
  - doctor 可发现引用断裂
- 拆分任务：
  - 设计 segment 文件格式与命名规则
  - 定义归档触发器（事件数/冷记忆占比/时间窗）
  - 实现主表降维保留（摘要+引用）
  - 为归档段生成 checksum 与清单索引
  - 增加 doctor 引用断裂检测与修复建议

### P2-2 working_set 降级与缓存视图化
- 状态：`done`
- 交付：
  - `working_set.json` 仅缓存视图，不再唯一事实源
  - 内部读路径优先 `memory.db`
- DoD：
  - 兼容期一个版本周期不破坏旧流程
  - 读取逻辑切换可回滚
- 拆分任务（已完成）：
  - working_set 写入策略改为去重与限额
  - 增加摘要哈希与 life hash 映射
  - chat 召回主读切换为 `memory.db`，保留回退路径
  - 验证兼容期行为一致与回滚可行
- 进展（2026-02-17）：
  - `working_set` 写入已改为去重+限额+摘要哈希，显著降载
  - `memory compact` 迁移会重写并压缩历史 `working_set`，并同步 life hash 映射
  - chat 召回主读路径已切换为优先 `memory.db`，无结果时回退 `life.log`

### P2-3 存储/内存预算治理
- 状态：`todo`
- 交付：
  - 预算目标：`memory.db <300MB/年/重度 persona`
  - 进程缓存 `<64MB`，LRU 最近召回缓存
- DoD：
  - 压测报告包含空间增长曲线与缓存命中率
- 拆分任务：
  - 建立存储容量预算模型与年度预测脚本
  - 引入进程内缓存上限与 LRU 淘汰策略
  - 增加召回缓存命中率指标与埋点
  - 构建重度 persona 压测数据集与基准流程
  - 输出增长曲线、命中率与阈值告警报告

## P3（中优先，工程可靠性）

### P3-1 doctor 扩展（记忆专项）
- 状态：`todo`
- 交付：
  - schema/version 校验
  - `source_event_hash` 存在性校验
  - 归档 checksum 与 recall trace 完整性校验
- DoD：
  - 错误分级明确（error/warning）
  - 每类错误有修复建议
- 拆分任务：
  - 增加 schema/version 深度校验
  - 增加 `source_event_hash` 存在性与可追溯校验
  - 增加 archive checksum 与 recall trace 完整性校验
  - 定义错误分级规范与建议修复动作
  - 输出 machine-readable doctor 报告

### P3-2 CI 与回归门禁
- 状态：`todo`
- 交付：
  - `.github/workflows` 跑 `./scripts/verify.sh`
  - 在线链路相关改动强制附带 `npm run acceptance` 报告（`reports/acceptance/*`）
  - 最小门禁：typecheck + test
- DoD：
  - PR 无绿灯不可合并
  - 主分支可复现实验结果
  - CI/本地验收命令与 `AGENT.md` 约束一致
- 拆分任务：
  - 新建/更新 CI workflow 跑 `./scripts/verify.sh`
  - 增加 `npm run acceptance` 工件上传与归档
  - 建立最小门禁（typecheck + test）与分支保护
  - 对在线链路改动增加必填验收报告校验
  - 对齐本地与 CI 命令入口，避免双标准

### P3-3 迁移一致性审计
- 状态：`todo`
- 交付：
  - 迁移前后对账：数量、哈希、关键记忆可召回一致性
- DoD：
  - 提供自动化对账脚本与报告
- 拆分任务：
  - 设计迁移前后对账指标（数量/哈希/召回一致性）
  - 实现自动化对账脚本与差异分类
  - 增加关键记忆抽样召回对比测试
  - 产出审计报告并支持失败阻断

### P3-4 MCP 兼容性与回归门禁
- 状态：`done`
- 交付：
  - 增加 MCP 集成测试（协议握手、工具调用、错误码、超时/中止）
  - 在 CI 中加入 MCP smoke test（不依赖外网）
  - 提供 `reports/acceptance/*` 中的 MCP 验收报告
- DoD：
  - MCP 链路改动无回归时才可合并
  - 中止、拒绝、超时路径均有可复现用例
- 拆分任务（已完成）：
  - 建立 MCP 协议握手与能力声明测试
  - 建立工具调用成功/拒绝/超时/中止测试矩阵
  - 将 MCP smoke test 纳入 CI 必跑集合
  - 将 MCP 验收结果输出到 `reports/acceptance/*`
  - 增加回归失败时的最小定位日志
- 完成记录（2026-02-18）：
  - `packages/mcp-server/test/mcp_handshake.test.mjs`：协议握手 + tools/list 声明验证
  - `packages/mcp-server/test/mcp_tools.test.mjs`：chat.send 正常/拒绝、memory.search、memory.inspect 找到/找不到
  - `packages/mcp-server/test/mcp_budget.test.mjs`：session budget 上限与跨工具独立计数
  - `packages/mcp-server/test/mcp_reject.test.mjs`：deny-by-default、adapter 抛错 → error 块而非 uncaught exception
  - `scripts/mcp_smoke.sh`：一键 smoke test，输出到 `reports/acceptance/mcp-smoke-<ts>.json`
  - 根 `package.json` lint/typecheck/build/test 全部加入 `@soulseed/mcp-server`

## P4（中低优先，体验增强）

### P4-1 主动消息策略升级（从模板到模型驱动）
- 状态：`todo`
- 交付：
  - 基于关系态、近期事件、任务上下文生成主动消息
  - 频率限制、静默时段、手动打断策略
- DoD：
  - 不打扰（可配置）与可解释（触发原因记录）
  - 误触发率在验收阈值内
- 拆分任务：
  - 定义模型驱动触发信号（关系态/近期事件/任务上下文）
  - 增加频率限制、静默时段、手动打断规则
  - 输出触发原因与抑制原因到审计日志
  - 建立误触发标注样本与验收阈值
  - 补充用户可配置项与默认策略

### P4-2 会话资产迁移补齐
- 状态：`todo`
- 交付：
  - `persona inspect/export/import`
  - 附件 manifest 与一致性校验
- DoD：
  - 跨目录迁移后引用不失效
- 拆分任务：
  - 实现 `persona inspect/export/import` 统一协议
  - 生成附件 manifest 并记录 hash
  - 实现导入后路径重写与引用修复
  - 增加跨目录、跨机器迁移验收用例
  - 提供迁移失败回滚与损坏提示

### P4-3 宪法审查闭环工具化
- 状态：`todo`
- 交付：
  - `constitution_review_requested` 到人工确认/拒绝流程
  - 宪法版本化、回滚与审计事件
- DoD：
  - 可执行一次完整审查与回滚演练
- 拆分任务：
  - 建立审查请求事件与状态机（requested/approved/rejected）
  - 实现人工确认/拒绝命令与审计记录
  - 实现宪法版本化存储与差异查看
  - 实现回滚命令与一致性校验
  - 增加一次端到端演练脚本

## P5（阶段 B：RAG 增强，增量接入）

### P5-1 本地向量索引接入
- 状态：`todo`
- 交付：
  - 本地 embedding + 向量索引（HNSW/SQLite VSS/轻量库）
  - 配置开关：`memory_config.json` 中 `rag.enabled=true`
- DoD：
  - 关闭 RAG 时行为与阶段 A 一致
  - 打开 RAG 后不破坏现有 CLI 接口
- 拆分任务：
  - 评估并选型本地向量方案（HNSW/SQLite VSS）
  - 定义 embedding 生成、存储、更新流程
  - 接入 `rag.enabled` 开关与灰度策略
  - 增加 RAG on/off 行为一致性回归测试
  - 增加索引构建与重建脚本

### P5-2 混合检索策略
- 状态：`todo`
- 交付：
  - `hybrid_score = α*vector + β*bm25 + γ*memory_salience`
  - 结构化过滤作为先决条件
- DoD：
  - 语义召回率提升（基线对比）
  - P95 延迟仍在目标预算内
- 拆分任务：
  - 设计 `vector/bm25/salience` 权重配置与默认值
  - 实现结构化过滤前置与混合打分重排
  - 建立离线评测集并对比纯结构化基线
  - 增加线上指标埋点（召回率、P95 延迟）
  - 做权重调参与回滚开关

## 关键接口变更（统一登记）
- `packages/core/src/types.ts`
  - 扩展 `MemoryMeta`
  - 扩展 `LifeEventType`
  - 新增 recall trace 类型
- `packages/core/src/index.ts`
  - 导出 `memory_store`、`memory_recall`、`memory_archive`
- `packages/cli/src/index.ts`
  - 新增 `memory` 子命令路由
  - 新增主动消息控制命令
- persona 目录
  - 新增 `memory.db`
  - 新增 `summaries/archive/`
  - 新增 `memory_config.json`

## 里程碑映射（6 周）
- Week 1-2：`P0-1~P0-4` + `P1-1` 启动
- Week 3-4：`P1-2~P1-3` + `P2-1~P2-2` + `P3-1`
- Week 5-6：`P1-4~P1-5` + `P3-2~P3-4` + `P5-1` 预研
- Week 5：`P2-3` + `P3-2~P3-3` + 回归稳定
- Week 6：阶段 A 验收发布
- 后续 2-4 周：`P5-1~P5-2`

## 验收总表
- 功能：四类记忆、软遗忘/恢复（调试能力）、完整 CLI memory 命令可用
- 一致性：life.log hash 链有效，迁移可回滚且对账通过
- 可解释：recall trace 全链路可审计
- 性能：Recall P95 `<=150ms`（不含模型推理）
- 回归：现有 `chat/rename/doctor` 不退化
