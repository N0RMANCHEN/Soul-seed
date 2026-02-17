# Soulseed CLI Roadmap（执行版）

## 执行状态（2026-02-17）

- 已完成：P0-0A 代码骨架（DeepSeekAdapter、`persona init`、`chat`、life log 追加写入、Ctrl+C 中止）
- 已完成：P0-0 验证基础（`./scripts/verify.sh` 可通过，含 lint/typecheck/build/test）
- 已完成：P0-1a 最小 replay harness 与三类回归用例（追问/拒绝/正常回复）
- 已完成：P0-1b life log `prevHash/hash` 链式写入与断链校验
- 已完成：P0-1c 最小 `doctor`（必需文件 + hash 链检查）
- 已完成：P0-2 Profile Memory（用户称呼/语言偏好抽取与持久化）
- 已完成：P0-3 自由演化（rename 双确认、冷却期、personaId 不变、事件可追溯）
- 已完成：连续性回归标准化（acceptance 增加“博飞”跨重载校验与结构化报告）
- 已完成：冲突日志先行（`conflict_logged` 事件：拒绝冲突 / 身份污染修正冲突）
- 已完成：P1-0 记忆经济学 V1（事件 `memoryMeta`：tier/source/storageCost/retrievalCost + doctor 校验）
- 阻塞项：DeepSeek 真实联调依赖有效 `DEEPSEEK_API_KEY` 与可访问 DeepSeek API 的网络

## 1. 产品理解（先统一“我们在做什么”）

Soulseed 的核心不是“聊天应用”，而是：
- 可迁移的人格资产（Persona Package）
- 可审计、可回放的决策闭环（Orchestrator）
- 可替换的大模型驱动层（ModelAdapter）

CLI 版本的目标是先把“灵魂内核 + 驱动闭环”跑通，并用可验证行为证明四件事：
- 持续自我模型：跨重启/跨模型仍是“同一个它”
- 深层价值结构：选择会被宪法/承诺约束
- 不可逆损失表征：历史不可悄悄重写
- 情绪作为控制信号：影响策略，同时可外部中止

## 2. 路线图迁移说明（来自 README）

本文件承接并扩展 README 原 Roadmap 内容。原有阶段被保留并细化：
- P0-0 CLI Verify + CI
- P0-1 驱动闭环（load → decide → generate → writeback）
- P0-1a DecisionTrace 回放与回归
- P0-1b life log 防篡改证据链
- P0-1c Persona Doctor（体检 + 迁移提示）
- P0-2 Profile Memory
- P0-3 自由演化（名字/习惯/性格可变）
- P0-4 Attachments
- P0-x MCP 兼容层（可选）

在此基础上新增硬优先级：**P0-0A 先用 DeepSeek API 跑通整条链路**。

## 3. 最高优先级：先用 DeepSeek API 跑通

### P0-0A DeepSeek First（强制第一里程碑）

目标：先让“真实模型调用 + CLI 会话 + 事件写回”端到端可用，不等其它优化。

交付：
- `ModelAdapter` 首个真实实现：`DeepSeekAdapter`
- 配置规范（例如环境变量）：`DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL`（可选）
- CLI 最小命令可跑：`persona init` + `chat`
- 支持 streaming 与 Ctrl+C 中止
- 会话后可见 `life.log.jsonl` 新增事件

DoD（全部满足才算完成）：
- 使用 DeepSeek API 进行一次真实对话并返回内容
- 中止指令可立即停止输出与后续工具动作
- 对话后 `life.log.jsonl` 仅追加，不覆盖历史
- 重启 CLI 后仍能读取同一 persona 并继续会话
- `./scripts/verify.sh` 与 CI 通过

非目标（本阶段不做）：
- 不先做多模型切换 UI
- 不先做复杂检索系统
- 不先做 Doctor 全量能力

## 4. P0 分阶段执行计划

### P0-0 CLI Verify + CI（协作基础设施）
交付：
- `./scripts/verify.sh`（lint/typecheck/test/build）
- CI（Linux）执行同一入口

DoD：
- 本地 verify 0 退出
- CI 全绿

### P0-1 驱动闭环：load → decide → generate → writeback
交付：
- Persona Loader（读写 package）
- Orchestrator（最小 DecisionTrace schema + context compiler）
- ModelAdapter（先 DeepSeek，再补 Mock）
- life log append-only 写回

DoD：
- 可以加载 persona、聊天、写回、重启后延续

### P0-1a DecisionTrace 回放与回归
交付：
- 固化 `decision_trace.json` schema
- Replay harness（mock adapter 可回放）
- 三类关键测试：追问/拒绝/正常回复

DoD：
- 回放输出稳定，回归可发现策略漂移

### P0-1b life log 防篡改证据链
交付：
- 每条事件写入 `prevHash/hash`
- 断链检测与 scar event 写入

DoD：
- 篡改可被检测；系统不做静默修复

### P0-1c Persona Doctor（体检 + 迁移提示）
交付：
- package 完整性检查
- 附件路径检查（相对路径）
- schema migration 提示与最小迁移器

DoD：
- 能对缺文件/断链/丢附件给出明确诊断

### P0-2 Profile Memory：用户名必记
交付：
- `user_profile.json`
- 每轮注入与最小抽取规则

DoD：
- 跨重启仍记住用户名、语言偏好等关键字段

### P0-3 自由演化：可变但有门槛
交付：
- 更名事件（personaId 不变）
- 习惯演化事件
- 可选：性格向量更新规则

DoD：
- “变化”有事件证据、有门槛、有可追溯理由

### P0-4 Attachments：头像/图片
交付：
- `attachments/` 相对路径引用与校验
- 复制 persona 包后仍可解析附件

DoD：
- 迁移目录后资源不丢失

### P0-x（可选）MCP 兼容层
交付：
- 暴露“决策/记忆编译”可调用接口

DoD：
- 不破坏 CLI 主闭环的前提下可被外部代理接入

## 5. 技术落地建议（针对“先跑通”）

建议先做最小包结构与最小命令：
- `packages/core`：domain/storage/orchestrator/adapters
- `packages/cli`：命令行入口与交互
- `scripts/verify.sh`：单一验证入口

建议最小命令集（先够用）：
- `soulseed persona init --name <name> --out <path>`
- `soulseed chat --persona <path>`

DeepSeek 接入建议：
- 先实现 OpenAI 兼容调用层（若采用兼容端点）
- 把 provider 抽象留在 `ModelAdapter`，避免后续重写 orchestration
- streaming 作为默认路径，非 streaming 仅做回退

## 6. 风险与应对

风险：
- 先做“人格参数”而不做驱动闭环，会导致价值无法验证
- 没有 DecisionTrace 回放，后续改动会引入不可见退化
- life log 若可回写，会破坏“不可逆损失”的核心承诺

应对：
- 里程碑顺序强制按本文件执行
- 每阶段都绑定 DoD 与最小回归测试
- DeepSeek 首跑通过前，不进入复杂功能开发

## 7. 里程碑验收清单（发布前）

- [ ] DeepSeek API 真实对话已跑通（非 mock）
- [ ] persona 可创建、可加载、可持续会话
- [ ] life log append-only，且可检测断链
- [ ] DecisionTrace 可回放并有回归测试
- [ ] Ctrl+C 可中止生成与工具执行
- [ ] `./scripts/verify.sh` 本地与 CI 全绿

## 8. 下一阶段优先方向（CLI 语境）

1. 记忆经济学（P1/P2）  
- 已落地 V1：写回分层元数据与成本预算。下一步聚焦 TTL/压缩/检索优先级联动。
