# Soulseed Roadmap (Execution-Oriented, Reindexed, Archive-Complete)

## 文档规则总纲
- 更新日期：2026-02-24
- 核验范围：`/Users/hirohi/Soul-seed` + `/Users/hirohi/Downloads/Soul-seed-2.24.03/doc/`
- 状态定义：`todo` / `in_progress` / `blocked` / `done` / `deferred` / `historical`

### 1) Phase 展示与优先级规则
- Phase 可无限扩展：`Phase F -> G -> H -> I -> J ...`。
- 当前执行优先级（跨 Phase）：`Phase F > Phase G > Phase H > Phase I`。
- 同一时刻默认只允许一个 Phase 进入主开发态，后续 Phase 以前序 Phase 的出口条件为门禁。

### 2) 任务编号规则
- 本次执行一次性重编号（2026-02-24），用于清理历史混编编号。
- 重编号后规则生效：任务 ID 冻结，不再改号；新增任务仅追加编号。
- 格式：`{Phase}/P{priority}-{seq}`，例如 `F/P0-0`。
- 排序规则：`P0（阻塞） -> P1（核心） -> P2（优化）`，每档内部按 `seq` 升序。

### 3) 任务信息完整性规则
- 每个任务必须包含：`原编号`、`来源需求`、`实现方式`、`测试/DoD`、`依赖`、`回滚`。
- 来源文件更新后，必须联动排查：`README.md`、`AGENT.md`、`contributing_ai.md`、`doc/Product-Standards.md`、`doc/Quality-Evaluation.md`、`doc/Roadmap.md`。

### 4) 归档规则
- `done` 任务迁入归档账本，不再参与 active 排序。
- Phase 归档条件：该 Phase 的 `Must` 全部 `done` 且无 `blocked`。

## 已完成任务归档（不参与重排）

### ARCH-001（原 `G/P0-2`）First-run 成功率：doctor 前置 + 依赖自检
- 状态：`done`
- 摘要：启动前依赖自检和入口 gate 已落地。

### ARCH-002（原 `G/P0-3`）Pinned 预算与分层
- 状态：`done`
- 摘要：pinned 预算上限与分层策略已落地。

### ARCH-003（原 `G/P0-4`）mood 范围一致性修复 + 回归用例
- 状态：`done`
- 摘要：mood 范围统一与回归脚本已落地。

### ARCH-004（原 `G/P0-5`）MCP 默认安全：最小权限 + 显式写入开关
- 状态：`done`
- 摘要：默认只读与写开关门禁已落地。

## 重编号映射（旧 -> 新）
- `G/P0-0` -> `F/P0-0`
- `G/P0-6` -> `F/P0-1`
- `G/P1-1` -> `F/P0-2`
- `G/P1-0` -> `F/P0-3`
- `G/P1-2` -> `F/P0-4`
- `G/P1-3` -> `F/P0-5`
- `F/P0-0` -> `F/P1-0`
- `F/P1-0` -> `F/P1-1`
- `F/P2-0` -> `F/P2-0`
- `G/P1-4` -> `G/P0-0`
- `G/P1-5` -> `G/P0-1`
- `G/P1-8` -> `G/P0-2`
- `G/P1-9` -> `G/P0-3`
- `G/P1-6` -> `G/P0-4`
- `G/P1-10` -> `G/P0-5`
- `G/P1-7` -> `G/P1-0`
- `F/P1-1` -> `G/P1-1`
- `G/P2-3` -> `H/P0-0`
- `G/P2-6` -> `H/P0-1`
- `G/P2-5` -> `H/P0-2`
- `G/P2-7` -> `H/P0-3`
- `G/P2-4` -> `H/P0-4`
- `G/P2-8` -> `H/P1-0`
- `G/P2-9` -> `H/P1-1`
- `G/P2-10` -> `H/P1-2`
- `G/P2-11` -> `H/P1-3`
- `G/P2-12` -> `H/P1-4`
- `新增（Affect 分离需求）` -> `H/P1-5`
- `新增（A12 人类化不完美）` -> `H/P1-6`
- `新增（A17 架构兼容说明）` -> `H/P1-7`
- `新增（A18.1 关系连续性验收）` -> `H/P1-8`
- `新增（A18.2 情绪厚度验收）` -> `H/P1-9`
- `新增（A18.3 一致性治理验收）` -> `H/P1-10`
- `新增（A18.4 可观测性验收）` -> `H/P1-11`
- `新增（A20.1 过度数值化风险）` -> `H/P1-12`
- `新增（A20.2 Relationship 注入噪音）` -> `H/P1-13`
- `新增（A20.3 Epigenetics 暗门）` -> `H/P1-14`
- `新增（A20.4 Genome trait 失控）` -> `H/P1-15`
- `新增（A20.5 LLM 直写状态）` -> `H/P1-16`
- `新增（A52 附录结构契约）` -> `H/P1-17`
- `新增（spec/28 附录A schema 契约）` -> `H/P1-18`
- `新增（spec/29 最小侵入接入点核查）` -> `H/P1-19`
- `G/P0-1` -> `I/P0-0`
- `G/P2-1` -> `I/P0-1`
- `G/P2-2` -> `I/P0-2`
- `新增（A21 OK定义）` -> `I/P0-3`
- `G/P2-0` -> `I/P1-0`
- `G/P3-0` -> `I/P2-0`

## 04-Archive 逐条覆盖矩阵（A-0..A-21 + 附录）
- `A-0 背景与问题` -> `F/P0-1` `G/P0-0`
- `A-1 目标与非目标` -> 全 Phase DoD 约束
- `A-2 设计原则` -> `F/P0-1` `H/P0-0` `H/P1-10`
- `A-3 体系总览(7块模型/三层机制)` -> `H/P0-4` `H/P1-0` `H/P1-1` `H/P1-5`
- `A-4 分层与裁切` -> `G/P0-3` `H/P1-2`
- `A-5 关系层` -> `H/P1-3` `H/P1-8`
- `A-6 情绪层` -> `H/P1-5` `H/P1-9`
- `A-7 Values/Personality` -> `H/P1-0`
- `A-8 Goals/Beliefs` -> `H/P1-1`
- `A-9 记忆遗忘` -> `H/P1-2`
- `A-10 Turn Pipeline` -> `H/P0-0`
- `A-11 Gates/Budgets` -> `F/P0-1` `H/P0-1`
- `A-12 人类化不完美` -> `H/P1-6`
- `A-13 Genome/天赋` -> `H/P0-4`
- `A-14 遗传与繁衍` -> `I/P2-0`
- `A-15 Persona Package` -> `F/P0-4` `H/P1-4`
- `A-16 兼容与迁移` -> `H/P0-2` `H/P0-3`
- `A-17 与现有架构兼容说明` -> `H/P1-7`
- `A-18 评估与验收` -> `H/P1-8` `H/P1-9` `H/P1-10` `H/P1-11`
- `A-19 推荐 Rollout 顺序` -> 本文统一执行顺序
- `A-20 风险清单与对策` -> `H/P1-12` `H/P1-13` `H/P1-14` `H/P1-15` `H/P1-16`
- `A-21 OK 定义` -> `I/P0-3`
- `A-APP-STRUCT 附录示例结构` -> `H/P1-17`
- `A-APP-CHANGELOG 附录变更记录` -> `historical`（审计保留，不转执行任务）

## 2.24.03 其余文件覆盖矩阵（00/01/02/03）
- `00-Start-Here`（阅读顺序/唯一 Phase 口径/防走偏约束） -> `文档规则总纲` + `F/P0-1` + `G/P0-0..G/P1-1` + `H/P0-0..H/P1-19`
- `01-Spec/0..27` -> 已覆盖到 `F/G/H/I` 主任务（会话控制、状态闭环、兼容迁移、风险护栏、OK 门禁）
- `01-Spec/附录A（A1~A4 数据结构草案）` -> `H/P1-18`
- `01-Spec/附录B（最小侵入接入点）` -> `H/P1-19`
- `02-Phases/H0..H8` -> `F/P0-1` `G/P0-0..G/P1-0` `H/P0-0..H/P0-4` `I/P2-0`
- `03-Engineering/1..7` -> `F/P0-1` `G/P0-0` `G/P0-1` `H/P0-1` `H/P0-3` `H/P1-8..H/P1-11`

## 本次漏项闭环（新增独立任务）
- `H/P1-6`：A12 人类化不完美
- `H/P1-7`：A17 架构兼容说明
- `H/P1-8`：A18.1 关系连续性验收
- `H/P1-9`：A18.2 情绪厚度验收
- `H/P1-10`：A18.3 一致性与治理验收
- `H/P1-11`：A18.4 可观测性验收
- `H/P1-12`：A20.1 过度数值化风险护栏
- `H/P1-13`：A20.2 Relationship 注入噪音护栏
- `H/P1-14`：A20.3 Epigenetics 暗门防护
- `H/P1-15`：A20.4 Genome trait 扩张闸门
- `H/P1-16`：A20.5 LLM 直写状态封禁
- `H/P1-17`：A52 附录结构契约化
- `H/P1-18`：Spec 附录A（A1~A4）schema 契约化
- `H/P1-19`：Spec 附录B最小侵入接入点核查
- `I/P0-3`：A21 OK 定义产品化门禁

## 当前执行总览（重排后）
- `in_progress`：`F/P0-0` `F/P1-0` `I/P0-1` `I/P1-0`
- `blocked`：`F/P0-1`
- `todo`：其余 active 任务

## Phase F（最高优先级：运行稳定与治理底座）

### F/P0-0 SQLite 并发稳定：busy_timeout + 重试 + persona 写锁
- 原编号：`G/P0-0`
- 状态：`in_progress`，必要性：`Must`
- 来源需求：`external roadmap` `spec/21` `engineering/1`
- 实现方式：将 `withPersonaLock()` 接入全部写路径，统一 busy 指数退避与重试上限，补写事务审计字段。
- 测试/DoD：并发压测（同 persona/跨 persona）无死锁，`SQLITE_BUSY` 失败率达标。
- 依赖：无；回滚：按模块关闭写锁接入。

#### 实施步骤（代码级）
1. 盘点写路径：`memory_store`、persona 持久化、状态落盘等所有写入口，形成写路径清单。
2. 在每个写入口接入 `withPersonaLock(personaId, fn)`，锁粒度固定为 persona 级。
3. 统一 `SQLITE_BUSY` 重试策略：指数退避、最大重试次数、总超时上限。
4. 抽取共享重试封装，避免不同模块参数漂移。
5. 写事务补审计字段：`personaId`、`op`、`traceId`、`retryCount`。

#### 数据与接口变更
- 固定并发策略配置项：`busyTimeoutMs`、`retryMaxAttempts`、`retryBackoffBaseMs`、`retryBackoffMaxMs`。
- 对外行为不变，仅加强写路径并发控制与可观测字段。

#### 测试步骤（命令级）
1. 运行同 persona 高并发写压测（N 并发写同一 persona）。
2. 运行跨 persona 并发写压测（N 并发写多个 persona）。
3. 运行现有核心回归测试，确认无行为回归。

#### 验收阈值（DoD量化）
- 无死锁、无写丢失。
- `SQLITE_BUSY` 最终失败率低于基线阈值。
- 吞吐下降不超过可接受阈值。
- 关键写请求具备完整审计字段。

#### 风险点与保护措施
- 风险：锁范围过大导致吞吐下降。
- 保护：仅 persona 级锁，禁止全局锁。
- 风险：重试参数过激引发尾延迟放大。
- 保护：设置总超时与退避上限。

#### 回滚步骤（可操作）
1. 通过 feature flag 关闭 lock 接入路径。
2. 回退到旧重试参数集。
3. 保留审计字段，不回滚观测能力。

#### 前置检查清单
- 写路径清单已完成且经代码检索确认。
- `withPersonaLock` 在核心模块可复用。
- 压测脚本已可重复运行。

### F/P0-1 MindModel 轨道硬前置（H0）
- 原编号：`G/P0-6`
- 状态：`blocked`，必要性：`Must`
- 来源需求：`phases/H0` `engineering/1,7` `spec/12`
- 实现方式：形成 H0 产物包（不变量表、budget 基线、compat 常数清单、回归入口）。
- 测试/DoD：CI 增加 H0 gate，未通过不得进入 G/H Phase。
- 依赖：`F/P0-0`；回滚：仅校验层变更，可独立回撤。

#### 实施步骤（代码级）
1. 定义 H0 产物目录与命名规范（不变量表、budget 基线、compat 常数、回归入口）。
2. 把 H0 检查项转成 CI 可执行规则（必须通过/可告警分层）。
3. 将 G/H 阶段入口与 H0 gate 绑定，未通过直接阻断。
4. 产出文档锚点与代码锚点对照表，保证审计可追溯。

#### 数据与接口变更
- 新增 H0 基线配置结构：`invariants`、`budgets`、`compat_constants`、`regression_index`。
- CI 增加 H0 结果输出格式（结构化通过/失败原因）。

#### 测试步骤（命令级）
1. 本地执行 H0 gate dry-run（通过/失败各一组）。
2. CI 预检验证 gate 阻断逻辑。
3. 验证 G/H 阶段任务在 gate fail 时不可执行。

#### 验收阈值（DoD量化）
- H0 四类产物齐全，且都有版本与更新时间。
- CI 中 H0 gate 稳定执行并能阻断下游阶段。
- 失败输出可直接定位缺项。

#### 风险点与保护措施
- 风险：一次性引入过多硬门禁影响迭代速度。
- 保护：分级 gate（warning -> blocking）灰度收紧。

#### 回滚步骤（可操作）
1. 将 blocking gate 临时降级为 warning。
2. 保留产物生成，不回退治理资产。

#### 前置检查清单
- `F/P0-0` 并发基线已稳定。
- H0 产物清单已在文档中固定。

### F/P0-2 Persona 规范化：`ss persona lint`
- 原编号：`G/P1-1`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/22` `spec/23` `extra/45`
- 实现方式：新增 lint 命令，校验 schema/version/budget/compat/voice_profile/library 引用。
- 测试/DoD：好坏样例回归通过，错误信息含路径与修复建议。
- 依赖：`F/P0-0`；回滚：先以 warning 模式上线。

#### 实施步骤（代码级）
1. 定义 lint 规则集：schema、版本、budget、compat、voice_profile、library 引用。
2. 实现 `ss persona lint` 命令入口与规则执行管线。
3. 统一错误结构：`code`、`path`、`message`、`suggestion`。
4. 增加输出分级：`error`、`warn`、`info`。
5. 建立样例库：通过样例与失败样例。

#### 数据与接口变更
- CLI 新命令：`ss persona lint [path] [--format text|json] [--strict]`。
- `--strict` 模式下 warning 升级为失败。

#### 测试步骤（命令级）
1. 对 good persona 运行 lint，期望 0 error。
2. 对 bad persona 运行 lint，期望精确命中路径和建议。
3. 在 `--strict` 与非 strict 两种模式执行回归。

#### 验收阈值（DoD量化）
- 规则覆盖所有 Must 字段。
- 错误定位精确到字段路径。
- bad case 检出率达到目标阈值。

#### 风险点与保护措施
- 风险：规则过严导致历史 persona 大面积失败。
- 保护：先 warning 默认，再逐步切 strict。

#### 回滚步骤（可操作）
1. 默认关闭 strict。
2. 分规则开关禁用高风险新规则。

#### 前置检查清单
- persona schema 基线版本已冻结。
- 样例集包含旧版/新版 persona。

### F/P0-3 SQLite Driver 抽象（scaffold）
- 原编号：`G/P1-0`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/14` `spec/29` `extra/47`
- 实现方式：引入 `MemoryStoreDriver` 接口与默认 SQLite driver，调用方改为依赖注入。
- 测试/DoD：核心回归零行为变化，driver 替换 smoke test 通过。
- 依赖：`F/P0-0`；回滚：保留旧直连路径开关。

#### 实施步骤（代码级）
1. 定义 `MemoryStoreDriver` 接口（读写、事务、检索、关闭）。
2. 实现默认 `SqliteMemoryStoreDriver`，行为与现有路径保持一致。
3. 在调用层引入 driver 注入（构造参数或工厂），不改外部调用方式。
4. 增加 `LegacyDirectDriver` 兼容层用于平滑回退。
5. 清理重复 SQL 执行入口，统一经 driver 层。

#### 数据与接口变更
- 新增 driver 抽象层，不改变 CLI/用户侧接口。
- 内部依赖关系从“直接 SQLite”改为“driver 接口”。

#### 测试步骤（命令级）
1. 使用默认 driver 跑全量核心测试。
2. 切换到 mock/替代 driver 做 smoke test。
3. 对比改造前后行为快照，确认结果一致。

#### 验收阈值（DoD量化）
- 核心行为无回归。
- driver 替换成功且不影响主路径。

#### 风险点与保护措施
- 风险：抽象层遗漏边角操作导致行为差异。
- 保护：接口最小化 + 行为快照对比。

#### 回滚步骤（可操作）
1. 切回 `LegacyDirectDriver`。
2. 暂停新 driver 注入，仅保留接口定义。

#### 前置检查清单
- 写路径并发改造（F/P0-0）已稳定。
- 现有 SQLite 调用入口已完整盘点。

### F/P0-4 Persona 编译快照：`ss persona compile`
- 原编号：`G/P1-2`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/22` `spec/28` `extra/52`
- 实现方式：persona 编译输出快照（默认值展开、预算固化、版本戳、hash）。
- 测试/DoD：相同输入 hash 稳定，可重复构建。
- 依赖：`F/P0-2`；回滚：保留源配置直接读取。

#### 实施步骤（代码级）
1. 定义快照结构（`schemaVersion`、`compiledAt`、`budgetExpanded`、`hash`）。
2. 实现 compile pipeline：读取源 persona -> 规范化 -> 默认值展开 -> 输出快照。
3. 把 lint 结果接入 compile 前置（lint fail 时阻断 compile）。
4. 输出 hash 计算规则固定（字段排序与序列化策略固定）。
5. 记录编译元数据用于审计与回滚。

#### 数据与接口变更
- CLI 新命令：`ss persona compile [path] --out <file>`。
- 新增编译快照文件格式（版本化）。

#### 测试步骤（命令级）
1. 同输入多次 compile，校验 hash 稳定。
2. 跨平台/不同机器 compile 结果一致性测试。
3. 用 compile 产物执行加载 smoke test。

#### 验收阈值（DoD量化）
- hash 稳定且可复现。
- compile 产物可直接驱动后续运行路径。

#### 风险点与保护措施
- 风险：序列化不稳定导致 hash 漂移。
- 保护：固定字段顺序与 canonical 序列化。

#### 回滚步骤（可操作）
1. 关闭 compile 必选，回到源配置直读。
2. 保留 compile 输出，仅不作为运行强依赖。

#### 前置检查清单
- lint 命令已可稳定执行。
- 快照 schema 与版本策略已冻结。

### F/P0-5 Persona library 检索注入（scaffold）
- 原编号：`G/P1-3`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/6` `spec/11` `spec/22`
- 实现方式：建立 library 索引+检索+注入链路，并加预算门禁。
- 测试/DoD：注入相关性与预算约束回归通过。
- 依赖：`F/P0-4`；回滚：注入链可独立关闭。

#### 实施步骤（代码级）
1. 定义 library 索引结构（topic/tag/weight/source）。
2. 实现检索器：输入会话上下文，输出候选片段排序结果。
3. 在注入前执行 budget gate（token/条目数/优先级裁切）。
4. 将注入结果接入会话控制输入层（非直写 prompt 拼接）。
5. 增加注入审计日志（命中项、裁切原因、预算消耗）。

#### 数据与接口变更
- 新增 library 检索结果结构：`items[]`、`score`、`budgetUsed`、`dropReason`。
- 注入链路通过开关控制：`libraryInjectionEnabled`。

#### 测试步骤（命令级）
1. 相关性回归：给定主题集验证命中准确率。
2. 预算回归：极限输入下不超预算上限。
3. 关闭注入开关回归：功能可完全退化。

#### 验收阈值（DoD量化）
- 注入后相关性指标提升。
- 超预算率为 0。
- 关闭开关时系统行为稳定。

#### 风险点与保护措施
- 风险：注入噪音增加导致回答偏离。
- 保护：排序阈值 + 预算门禁 + drop reason 审计。

#### 回滚步骤（可操作）
1. 关闭 `libraryInjectionEnabled`。
2. 回退到仅基础上下文策略。

#### 前置检查清单
- compile 快照已落地并可被读取。
- budget gate 阈值与策略已冻结。

### F/P1-0 CLI 全量人格声化（第二批）
- 原编号：`F/P0-0`
- 状态：`in_progress`，必要性：`Should`
- 来源需求：`external roadmap` `spec/18`
- 实现方式：统一用户可见输出走 `voice_profile`，清理裸系统输出。
- 测试/DoD：用户面无裸 `console.log/[error]` 输出。
- 依赖：`F/P0-0`；回滚：`VOICE_STYLE=legacy`。

### F/P1-1 Agent 执行期间用户感知通道
- 原编号：`F/P1-0`
- 状态：`todo`，必要性：`Should`
- 来源需求：`external roadmap` `spec/18`
- 实现方式：pre/in/post 三段提示，显示执行阶段、风险级别与收束信息。
- 测试/DoD：长任务具备稳定中间反馈且不刷屏。
- 依赖：`F/P1-0`；回滚：退化为开始/结束两段提示。

### F/P2-0 死代码清理
- 原编号：`F/P2-0`
- 状态：`todo`，必要性：`Could`
- 来源需求：`external roadmap`
- 实现方式：清理未引用函数与旧路径，补最小回归。
- 测试/DoD：构建+测试全绿，入口无孤儿依赖。
- 依赖：`F/P1-0`；回滚：按 commit 粒度回退。

## Phase G（第二优先级：会话控制与交互闭环）

### G/P0-0 MindModel H1：Conversation Control MVP
- 原编号：`G/P1-4`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H1` `spec/16` `engineering/2`
- 实现方式：落地 `EngagementController/TopicManager/ResponsePolicy` 最小闭环，先决策后生成。
- 测试/DoD：同输入决策可复现，投入档位与回复风格一致。
- 依赖：`Phase F` 出口条件满足；回滚：feature flag 关闭控制面。

### G/P0-1 MindModel H2：Interests -> Attention -> Engagement
- 原编号：`G/P1-5`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H2` `spec/17` `engineering/4`
- 实现方式：reward 信号、更新衰减与 attention 分配确定性落地，LLM 仅提案。
- 测试/DoD：兴趣演进可解释，长会话投入波动符合阈值。
- 依赖：`G/P0-0`；回滚：冻结兴趣更新。

### G/P0-2 主观强化记忆通道（努力记忆）
- 原编号：`G/P1-8`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/3` `spec/17`
- 实现方式：建立“用户强调”高权重记忆通道，提高后续召回优先级。
- 测试/DoD：强调信息跨轮召回率显著提升。
- 依赖：`G/P0-1`；回滚：关闭强化通道。

### G/P0-3 回忆动态调度（Task-aware Recall Budget）
- 原编号：`G/P1-9`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/3` `spec/11` `extra/34`
- 实现方式：按任务类型动态分配 recall budget，相关优先，长尾抑制。
- 测试/DoD：token 成本下降且相关性不降。
- 依赖：`G/P0-1`；回滚：固定 recall budget。

### G/P0-4 MindModel H3：Proactive 主动系统
- 原编号：`G/P1-6`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H3` `spec/19`
- 实现方式：主动意图规划器（关心/跟进/提醒/分享）+ 频率门禁 + 关系约束。
- 测试/DoD：触发频率与主题相关率达标。
- 依赖：`G/P0-1`；回滚：降级为被动。

### G/P0-5 工具调用自然化与意图确认闭环
- 原编号：`G/P1-10`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/16` `spec/18`
- 实现方式：工具前确认、工具后人格化解释、失败重试建议闭环。
- 测试/DoD：工具调用全链路可理解。
- 依赖：`G/P0-0`；回滚：关闭确认层。

### G/P1-0 MindModel H4：AI 群聊参与控制
- 原编号：`G/P1-7`
- 状态：`todo`，必要性：`Should`
- 来源需求：`phases/H4` `spec/20`
- 实现方式：参与门槛 + 仲裁器，限制抢答/连发。
- 测试/DoD：打断率、刷屏率达标。
- 依赖：`G/P0-4`；回滚：回退轮询仲裁。

### G/P1-1 开场/结束语短语库（voice_profile 扩展）
- 原编号：`F/P1-1`
- 状态：`todo`，必要性：`Should`
- 来源需求：`spec/18` `spec/27`
- 实现方式：扩展 `greeting/farewell` 池，按关系/情绪/场景抽样。
- 测试/DoD：语料去重与人格一致性评测通过。
- 依赖：`G/P0-0`；回滚：回到固定模板。

## Phase H（第三优先级：状态闭环与兼容兑现）

### H/P0-0 MindModel H5：State Delta Pipeline
- 原编号：`G/P2-3`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H5` `spec/21` `extra/40`
- 实现方式：`proposal -> gates -> deterministic apply`，禁止 LLM 直写状态。
- 测试/DoD：delta 可审计、可回放、可拒绝。
- 依赖：`Phase G` 出口条件满足；回滚：保留旧路径并行。

### H/P0-1 Invariant Table 回归落地
- 原编号：`G/P2-6`
- 状态：`todo`，必要性：`Must`
- 来源需求：`engineering/3,6` `spec/24` `extra/48`
- 实现方式：固化 Relationship/Beliefs/Mood/Engagement/Proactive/Group Chat 不变量阈值并纳入 CI。
- 测试/DoD：阈值越界直接 fail。
- 依赖：`H/P0-0`；回滚：阈值可配置回退。

### H/P0-2 MindModel H7：Compatibility & Migration
- 原编号：`G/P2-5`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H7` `spec/23` `extra/46`
- 实现方式：compat 三档、推断+锁定+校准流程、会话控制兼容桥接。
- 测试/DoD：存量 persona 漂移在阈值内，无“换人”。
- 依赖：`H/P0-0`；回滚：可回滚迁移前快照。

### H/P0-3 compat 常数清单与校准文件
- 原编号：`G/P2-7`
- 状态：`todo`，必要性：`Must`
- 来源需求：`engineering/5` `spec/23`
- 实现方式：落地 compat 常数与校准配置，版本化管理。
- 测试/DoD：迁移样本通过，缺项触发 lint fail。
- 依赖：`H/P0-2`；回滚：回退上一个校准版本。

### H/P0-4 MindModel H6：Genome & Epigenetics MVP
- 原编号：`G/P2-4`
- 状态：`todo`，必要性：`Must`
- 来源需求：`phases/H6` `spec/15` `extra/43`
- 实现方式：固定 6 trait，建立 Genome->Budget 映射与慢漂移规则。
- 测试/DoD：差异可解释，随机可复现。
- 依赖：`H/P0-2` `H/P0-3`；回滚：降级静态 trait。

### H/P1-0 Values / Personality 可运行约束系统
- 原编号：`G/P2-8`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/37`
- 实现方式：将 values 条款化接 gate，personality 慢漂移。
- 测试/DoD：越界回复可拦截并给出原因。
- 依赖：`H/P0-0`；回滚：先告警后拦截。

### H/P1-1 Goals / Beliefs 状态模块
- 原编号：`G/P2-9`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/38` `spec/15`
- 实现方式：新增 goals/beliefs 状态与慢变量更新规则。
- 测试/DoD：跨会话连续性达标。
- 依赖：`H/P0-0`；回滚：只读展示。

### H/P1-2 记忆遗忘与压缩整合管线
- 原编号：`G/P2-10`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/39` `spec/3`
- 实现方式：衰减+干扰+压缩并行，不修改原始 `life.log`。
- 测试/DoD：容量受控且关键召回达标。
- 依赖：`H/P0-0`；回滚：关闭压缩。

### H/P1-3 Relationship first-class state
- 原编号：`G/P2-11`
- 状态：`todo`，必要性：`Should`
- 来源需求：`extra/35`
- 实现方式：关系状态外置，支持冷却/遗忘曲线与事件绑定。
- 测试/DoD：关系变化可追溯、可解释。
- 依赖：`H/P0-0` `H/P1-2`；回滚：回退 memory-only。

### H/P1-4 Persona Package v0.4 布局与回滚
- 原编号：`G/P2-12`
- 状态：`todo`，必要性：`Should`
- 来源需求：`spec/22` `extra/45` `extra/52`
- 实现方式：规范包布局、元数据、迁移快照、回滚入口与签名。
- 测试/DoD：跨版本加载稳定，可迁移可回滚。
- 依赖：`F/P0-4` `H/P0-2`；回滚：保留旧布局读取。

### H/P1-5 Affect 情绪层分离与三层状态机
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/15(Affect)` `engineering/3.3` `archive/6.情绪层(Affect)`
- 实现方式：将情绪系统拆分为 `mood baseline（慢）/emotion episodes（快）/temperament influence（特质）` 三层；与响应渲染层解耦，禁止“仅靠语气模板伪装情绪”。
- 测试/DoD：情绪更新有证据链；快慢变量更新速率分离；情绪层可回放可审计。
- 依赖：`H/P0-0` `H/P0-1` `H/P0-4`；回滚：切回旧 mood 单层模式。

### H/P1-6 人类化不完美 DoD 套件
- 原编号：`新增（A12）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/12.人类化不完美`
- 实现方式：把“非全知、非稳定满分、允许不完美”转换成可测规则，加入输出策略与回归断言。
- 测试/DoD：禁止持续“完美答复”模式，允许合理不确定表达，且不降低安全合规。
- 依赖：`G/P0-0` `H/P0-1`；回滚：仅保留监控不做硬门禁。

### H/P1-7 与现有架构兼容说明落地校核
- 原编号：`新增（A17）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/17.兼容性说明`
- 实现方式：把 High-Level 兼容说明拆成工程检查单（入口、存储、召回、回滚）并纳入 CI 文档校核。
- 测试/DoD：兼容检查单全通过，且每项有证据路径。
- 依赖：`F/P0-3` `H/P0-2`；回滚：退回人工审查流程。

### H/P1-8 关系连续性验收回归集
- 原编号：`新增（A18.1）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.1`
- 实现方式：建设关系连续性回归场景与评分脚本，验证长期互动不“失忆换人”。
- 测试/DoD：关系连续性指标达标并稳定。
- 依赖：`H/P1-3`；回滚：保留人工抽检。

### H/P1-9 情绪厚度验收回归集
- 原编号：`新增（A18.2）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.2`
- 实现方式：建立情绪厚度回归维度（层次、触发、恢复、可解释性）与评分基线。
- 测试/DoD：情绪厚度指标达标，无单层扁平情绪。
- 依赖：`H/P1-5`；回滚：降级为观测指标。

### H/P1-10 一致性与治理验收回归集
- 原编号：`新增（A18.3）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.3`
- 实现方式：统一治理项（门禁、预算、兼容、回滚）验收套件。
- 测试/DoD：治理项全部可自动检查且无阻塞缺口。
- 依赖：`H/P0-1` `H/P0-2` `H/P0-3`；回滚：拆分为分模块校验。

### H/P1-11 可观测性验收回归集
- 原编号：`新增（A18.4）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/18.4`
- 实现方式：定义状态变化、门禁决策、异常路径的最小观测事件集。
- 测试/DoD：关键链路可追踪，故障可定位。
- 依赖：`I/P0-2`；回滚：保留核心事件集。

### H/P1-12 风险护栏：过度数值化（A20.1）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.1`
- 实现方式：限制面板化参数外显，要求回复保持自然语言主导。
- 测试/DoD：数值化过载率低于阈值。
- 依赖：`G/P0-0`；回滚：以告警替代拦截。

### H/P1-13 风险护栏：Relationship 注入噪音（A20.2）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.2`
- 实现方式：控制关系卡注入频次与权重，加入噪音抑制门禁。
- 测试/DoD：噪音注入率和无关注入率达标。
- 依赖：`H/P1-3`；回滚：放宽阈值。

### H/P1-14 风险护栏：Epigenetics 暗门防护（A20.3）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.3`
- 实现方式：所有 Epigenetics 更新必须带证据与审计记录，禁止静默改人格。
- 测试/DoD：无证据更新为 0。
- 依赖：`H/P0-4`；回滚：仅告警模式。

### H/P1-15 风险护栏：Genome trait 扩张闸门（A20.4）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.4`
- 实现方式：MVP 固守 6 trait，新增 trait 需评审开关与回归证明。
- 测试/DoD：未审批 trait 不可上线。
- 依赖：`H/P0-4`；回滚：临时冻结 trait 扩展。

### H/P1-16 风险护栏：LLM 直写状态封禁（A20.5）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/20.5` `spec/12`
- 实现方式：仅允许通过 `proposal -> gates -> apply` 写状态，封禁直写通道。
- 测试/DoD：直写尝试全部失败且可审计。
- 依赖：`H/P0-0`；回滚：白名单临时放行。

### H/P1-17 附录示例结构契约化（A52）
- 原编号：`新增`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/附录示例结构` `spec/28`
- 实现方式：将附录示例结构转换为 schema 契约与版本校验规则。
- 测试/DoD：样例结构全部通过 schema 校验。
- 依赖：`F/P0-4` `H/P1-4`；回滚：允许 legacy schema 兼容读取。

### H/P1-18 Spec 附录A（A1~A4）Schema 契约化
- 原编号：`新增（spec/28）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/28`（`engagement_plan.json` `interests.json` `topic_state.json` `proactive_plan.json`）
- 实现方式：为 A1~A4 建立版本化 schema、兼容校验与迁移策略；在 lint/compile 阶段执行结构验证。
- 测试/DoD：四类结构在样例与真实数据上校验通过；版本升级可回滚。
- 依赖：`F/P0-2` `F/P0-4` `H/P1-17`；回滚：保留 legacy schema 读取适配层。

### H/P1-19 Spec 附录B 最小侵入接入点核查
- 原编号：`新增（spec/29）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/29` `archive/17`
- 实现方式：把附录B接入点列表转为工程检查单，逐项绑定代码锚点与回归用例，防止“接错层/侵入过深”。
- 测试/DoD：接入点检查单全通过，且每项都有代码证据与回归案例。
- 依赖：`F/P0-3` `G/P0-0` `H/P0-0`；回滚：回退到人工架构评审。

## Phase I（第四优先级：产品化与后置演进）

### I/P0-0 开源合规：LICENSE + SPDX 一致性
- 原编号：`G/P0-1`
- 状态：`todo`，必要性：`Must`
- 来源需求：`external roadmap`
- 实现方式：所有包与文档的 license 元数据统一到仓库当前 LICENSE（CC BY-NC-ND 4.0）并补 SPDX。
- 测试/DoD：license 扫描零不一致。
- 依赖：`Phase F` 主任务完成；回滚：元数据回退。

### I/P0-1 Release discipline：SemVer + CHANGELOG
- 原编号：`G/P2-1`
- 状态：`in_progress`，必要性：`Must`
- 来源需求：`external roadmap` `spec/25`
- 实现方式：建立 changelog 模板与 CI 发布门禁。
- 测试/DoD：发版前必须存在对应 changelog entry。
- 依赖：`I/P0-0`；回滚：保留手工流程。

### I/P0-2 性能与可观测：慢点定位
- 原编号：`G/P2-2`
- 状态：`todo`，必要性：`Must`
- 来源需求：`spec/24` `extra/48`
- 实现方式：引入 perf span、trace id 与 `--perf` 输出。
- 测试/DoD：关键链路 p95 可观测。
- 依赖：`I/P0-1`；回滚：埋点按环境开关。

### I/P0-3 OK 定义产品化门禁
- 原编号：`新增（A21）`
- 状态：`todo`，必要性：`Must`
- 来源需求：`archive/21.OK定义` `spec/27`
- 实现方式：把 OK 定义转为可执行发布门禁（关系连续性、情绪厚度、治理稳定、可观测性）。
- 测试/DoD：未满足 OK 门禁禁止发布。
- 依赖：`H/P1-8` `H/P1-9` `H/P1-10` `H/P1-11`；回滚：降级为发布告警。

### I/P1-0 上手路径文档 + 示例资产
- 原编号：`G/P2-0`
- 状态：`in_progress`，必要性：`Should`
- 来源需求：`external roadmap` `spec/25`
- 实现方式：补齐 quickstart、demo persona、故障排查路径。
- 测试/DoD：新用户 15 分钟完成首轮运行。
- 依赖：`I/P0-1`；回滚：文档独立回退。

### I/P2-0 MindModel H8：Inheritance（可选后置）
- 原编号：`G/P3-0`
- 状态：`todo`，必要性：`Could`
- 来源需求：`phases/H8` `extra/44`
- 实现方式：定义继承与微突变规则，补伦理与安全约束。
- 测试/DoD：继承结果可解释，不突破安全边界。
- 依赖：`Phase H` 全部 Must 任务完成；回滚：字段保留不启用。

## 统一执行顺序（工程落地顺序）
1. `Phase F`：`F/P0-0 -> F/P0-1 -> F/P0-2 -> F/P0-3 -> F/P0-4 -> F/P0-5 -> F/P1-0 -> F/P1-1 -> F/P2-0`
2. `Phase G`：`G/P0-0 -> G/P0-1 -> G/P0-2 -> G/P0-3 -> G/P0-4 -> G/P0-5 -> G/P1-0 -> G/P1-1`
3. `Phase H`：`H/P0-0 -> H/P0-1 -> H/P0-2 -> H/P0-3 -> H/P0-4 -> H/P1-0 -> H/P1-1 -> H/P1-2 -> H/P1-3 -> H/P1-4 -> H/P1-5 -> H/P1-6 -> H/P1-7 -> H/P1-8 -> H/P1-9 -> H/P1-10 -> H/P1-11 -> H/P1-12 -> H/P1-13 -> H/P1-14 -> H/P1-15 -> H/P1-16 -> H/P1-17 -> H/P1-18 -> H/P1-19`
4. `Phase I`：`I/P0-0 -> I/P0-1 -> I/P0-2 -> I/P0-3 -> I/P1-0 -> I/P2-0`

## 覆盖性与漏项结论
- `2.24.03` 的 `00/01/02/03/04` 已完成覆盖核对并映射到任务；`A-APP-CHANGELOG` 以 `historical` 审计保留。
- 本次按你的要求把漏项全部独立任务化，`missing=0`、`partial=0`（对 `2.24.03` 五个文件范围）。
