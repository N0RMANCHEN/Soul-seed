# Plan Documents (`doc/plans/`)

> **强制规则**：实现进度以 `doc/Roadmap.md` 为准；本目录计划文件仅描述 scope/依赖/入口出口，不做逐任务快照。

## 目录职责

- `doc/plans/`：active 计划（正在执行或即将执行）。
- `doc/plans/archive/`：historical 计划（已完成、已归档）。

## 生命周期规则（强制）

1. 新建计划：放在 `doc/plans/`，并更新本文件 Active Index。
2. 执行过程中：状态只在 `doc/Roadmap.md` 更新。
3. 计划完成：移动或归档到 `doc/plans/archive/`。
4. 归档完成后：
   - 在 `doc/plans/archive/README.md` 登记归档条目
   - 在 `doc/Roadmap.md` 仅保留历史索引（不保留执行细节）

## 命名约定

- 高层汇总：`{Phase}-{ShortTitle}.md`
- Sub-phase：`{SubPhase}-{ShortTitle}.md`
- 嵌套子计划：`{SubPhase}-{N}-{Title}.md`
- 归档文件：`{PhaseOrTrack}-{YYYY-MM}-{ShortTitle}.md`

## 计划文件必备字段

- 目标摘要
- 任务清单（含依赖链）
- 入口/出口条件
- A/B 分工（若适用）
- 风险与回滚策略

## 模板头

```md
> Progress: 以 doc/Roadmap.md 为准（本计划仅描述 scope，不做逐任务快照）
```

## Active Index

- （当前无 active 计划文件；以 `doc/Roadmap.md` 的 `in_progress` 为准）
