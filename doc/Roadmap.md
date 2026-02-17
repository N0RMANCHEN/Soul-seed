# Soulseed Roadmap（P0-P5 执行版）

## 基线
- 更新日期：2026-02-17
- 目标：本地优先、四类类人记忆、强可解释、可长期运行、在线检索额外时延 P95 `<=150ms`
- 任务编号规则：`P{优先级}-{序号}`，数字越小优先级越高
- 状态：`done` / `in_progress` / `todo` / `blocked`

## P0（必须优先完成，阻塞主线）

### P0-1 记忆主存落地（SQLite）
- 状态：`todo`
- 交付：
  - 新建 `personas/<id>.soulseedpersona/memory.db`
  - 建表：`memories`、`memory_edges`、`recall_traces`、`archive_segments`
  - schema version 与迁移入口
- DoD：
  - 初始化 persona 时可自动建库
  - doctor 可检查 schema/version 完整性

### P0-2 记忆写入链路（ingest + store）
- 状态：`todo`
- 交付：
  - 从对话事件提取候选记忆并分类（`episodic|semantic|relational|procedural`）
  - 写入 `memory.db` 并记录 `source_event_hash`
- DoD：
  - 抽样回放中每类记忆都有可写入样本
  - `source_event_hash` 可在 `life.log` 追溯

### P0-3 召回链路 v1（无 RAG）
- 状态：`todo`
- 交付：
  - 输入解析 -> 意图标签 -> 结构化检索 -> 打分 -> 预算裁剪 -> 注入
  - 默认预算：候选 `<=100`，精排 `<=30`，注入 `<=8`，字符 `<=2200`
- DoD：
  - 每轮产出 recall trace（命中、分数、淘汰原因、预算）
  - 无 soft-deleted 记忆被注入

### P0-4 迁移脚手架（life.log + working_set -> memory.db）
- 状态：`todo`
- 交付：
  - 迁移脚本与备份目录：`migration-backups/<ts>/`
  - 报告：`memory-migration-report.json`
- DoD：
  - 可一键迁移与回滚
  - 报告包含条目数、哈希摘要、失败样本

### P0-5 CLI 交互修正（AI 标签与主动消息）
- 状态：`done`
- 交付：
  - `assistant>` 改为动态 `AI名称>`（来自 persona displayName）
  - 新增主动消息控制：`/proactive on [minutes]`、`/proactive off`、`/proactive status`
- DoD：
  - 改名后标签实时切换
  - 主动消息默认关闭，开启后按间隔推送并可关闭

## P1（高优先，形成可用闭环）

### P1-1 生命周期 v3（激活/情感/叙事/关系）
- 状态：`todo`
- 交付：
  - `memory_lifecycle_v3`：四信号统一评分
  - 状态流转与衰减策略（含 `decayClass`）
- DoD：
  - 评分边界与状态迁移有单元测试
  - 回放中无明显“短期噪声压制长期事实”回归

### P1-2 软遗忘与恢复
- 状态：`todo`
- 交付：
  - `forget --mode soft|hard`（默认 soft）
  - `recover --id <memory_id>`
  - 事件：`memory_soft_forgotten`、`memory_recovered`
- DoD：
  - soft forget 不物理删除，可恢复
  - recall trace 不应出现 soft-deleted

### P1-3 记忆控制面 CLI（完整命令集）
- 状态：`todo`
- 交付：
  - `ss memory status|list|inspect|pin|unpin|forget|recover|compact|export|import`
- DoD：
  - 全命令具备参数校验与错误码
  - 核心命令有 CLI 集成测试

## P2（中高优先，规模化与成本控制）

### P2-1 冷归档与分段压缩
- 状态：`todo`
- 交付：
  - `summaries/archive/segment-YYYYMM.jsonl`
  - 归档触发：事件数/冷记忆占比/时间窗口阈值
- DoD：
  - 主表保留摘要+引用，归档段可验 checksum
  - doctor 可发现引用断裂

### P2-2 working_set 降级与缓存视图化
- 状态：`todo`
- 交付：
  - `working_set.json` 仅缓存视图，不再唯一事实源
  - 内部读路径优先 `memory.db`
- DoD：
  - 兼容期一个版本周期不破坏旧流程
  - 读取逻辑切换可回滚

### P2-3 存储/内存预算治理
- 状态：`todo`
- 交付：
  - 预算目标：`memory.db <300MB/年/重度 persona`
  - 进程缓存 `<64MB`，LRU 最近召回缓存
- DoD：
  - 压测报告包含空间增长曲线与缓存命中率

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

### P3-2 CI 与回归门禁
- 状态：`todo`
- 交付：
  - `.github/workflows` 跑 `npm run verify`
  - 最小门禁：typecheck + test
- DoD：
  - PR 无绿灯不可合并
  - 主分支可复现实验结果

### P3-3 迁移一致性审计
- 状态：`todo`
- 交付：
  - 迁移前后对账：数量、哈希、关键记忆可召回一致性
- DoD：
  - 提供自动化对账脚本与报告

## P4（中低优先，体验增强）

### P4-1 主动消息策略升级（从模板到模型驱动）
- 状态：`todo`
- 交付：
  - 基于关系态、近期事件、任务上下文生成主动消息
  - 频率限制、静默时段、手动打断策略
- DoD：
  - 不打扰（可配置）与可解释（触发原因记录）
  - 误触发率在验收阈值内

### P4-2 会话资产迁移补齐
- 状态：`todo`
- 交付：
  - `persona inspect/export/import`
  - 附件 manifest 与一致性校验
- DoD：
  - 跨目录迁移后引用不失效

### P4-3 宪法审查闭环工具化
- 状态：`todo`
- 交付：
  - `constitution_review_requested` 到人工确认/拒绝流程
  - 宪法版本化、回滚与审计事件
- DoD：
  - 可执行一次完整审查与回滚演练

## P5（阶段 B：RAG 增强，增量接入）

### P5-1 本地向量索引接入
- 状态：`todo`
- 交付：
  - 本地 embedding + 向量索引（HNSW/SQLite VSS/轻量库）
  - 配置开关：`memory_config.json` 中 `rag.enabled=true`
- DoD：
  - 关闭 RAG 时行为与阶段 A 一致
  - 打开 RAG 后不破坏现有 CLI 接口

### P5-2 混合检索策略
- 状态：`todo`
- 交付：
  - `hybrid_score = α*vector + β*bm25 + γ*memory_salience`
  - 结构化过滤作为先决条件
- DoD：
  - 语义召回率提升（基线对比）
  - P95 延迟仍在目标预算内

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
- Week 5：`P2-3` + `P3-2~P3-3` + 回归稳定
- Week 6：阶段 A 验收发布
- 后续 2-4 周：`P5-1~P5-2`

## 验收总表
- 功能：四类记忆、软遗忘/恢复、完整 CLI memory 命令可用
- 一致性：life.log hash 链有效，迁移可回滚且对账通过
- 可解释：recall trace 全链路可审计
- 性能：Recall P95 `<=150ms`（不含模型推理）
- 回归：现有 `chat/rename/doctor` 不退化
