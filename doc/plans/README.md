# Plan Documents (`doc/plans/`)

> **更新规则（强制）**：实现进度以 `doc/Roadmap.md` 为准；本目录下的计划文件仅描述 scope、依赖链、入口/出口条件，**不做逐任务快照式状态更新**。计划文件只在 scope 变更时更新。
>
> 来源：`doc/Roadmap.md` 规则 1.3；`doc/Architecture-Folder-Governance.md` §3.3

## 命名体系映射（H1/H2/H3 ↔ Ha/Hb/Hc）

主命名体系为 **Ha/Hb/Hc**（与 Roadmap 一致）。以下为旧 H1/H2/H3 文件与 Ha/Hb/Hc 的对应关系，引用时以主命名为准。

| 旧名（文件） | 主命名 | Phase 内容 |
|-------------|--------|------------|
| `H1-Foundation.md` | Ha | Foundation (H/P0-0..4) |
| `H2-State-Modules.md` | Hb | State Modules (H/P1-0..7) |
| `H3-Validation-and-Guards.md` | Hc | Validation & Risk Guards (H/P1-8..19) |

说明：H1/H2/H3 文件保留以兼容既有引用；新计划优先使用 Ha/Hb/Hc 命名。

## 文档命名约定

- 高层汇总：`{Phase}-{ShortTitle}.md`（如 `H-State-Closure-Plan.md`）
- Sub-phase：`{SubPhase}-{ShortTitle}.md`（如 `Ha-State-Infra-Plan.md`、`Hb-Mind-Model-State-Modules.md`）
- 嵌套子计划：`{SubPhase}-{N}-{Title}.md`（如 `Hb-1-1-Identity-Beliefs.md`）

## 计划文件必备字段

- 目标摘要
- 任务清单（含依赖链）
- 入口/出口条件
- A/B 分工（若适用）
- 风险与回滚策略

## 新建计划时

在文件头部加入：

```
> Progress: 以 doc/Roadmap.md 为准（本计划仅描述 scope，不做逐任务快照）
```
