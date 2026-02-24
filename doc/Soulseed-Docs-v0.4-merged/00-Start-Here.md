# Soulseed MindModel 文档集（合并精简版）

> 合并日期：2026-02-24  
> 目标：把 v0.4（以及 v0.3.1 的补充材料）**融合成少量权威文档**，减少文件碎片，同时保证**所有有价值信息零丢失**。  
> 审计：每个源文件的 SHA-256 都记录在 `docs/05-Merge-Map.md`，可用于逐段对照核验。

---

## 你应该怎么读（推荐顺序）

1. `docs/02-Phases.md`：先看 H0–H8 的推进方法、依赖、DoD、接入点  
2. `docs/03-Engineering.md`：再看“不变量/门禁/兼容校准/回归集”的硬约束  
3. `docs/01-Spec.md`：最后通读规范正文（分层、数据结构、门禁预算、接入点清单）  
4. `docs/04-Archive.md`：历史存档与 v0.3.1 细拆材料（仅用于审计对照，不做权威来源）

---

## Phase 命名（唯一官方）

- 从 v0.4 起：以 **H0–H8** 为唯一官方 Phase 命名（写需求/写 PR/写 DoD 都用 H*）。
- 旧口径 Phase D/E/F 仅用于历史对照（在代码注释或旧文档里可能仍会出现）。

---

## 文件一览（精简后）

- `docs/00-Start-Here.md`（本文件）
- `docs/01-Spec.md`（合并：docs/spec/*）
- `docs/02-Phases.md`（合并：docs/phases/*）
- `docs/03-Engineering.md`（合并：docs/engineering/*）
- `docs/04-Archive.md`（合并：docs/archive/* + docs/extra_from_v0_3_1/*）
- `docs/05-Merge-Map.md`（源文件清单 + SHA-256，确保信息零丢失）

---

## 重要约束（防走偏）

- 合并版文档是 **权威来源**；历史存档仅用于对照。
- 任何涉及 persona/state/budget/compat 的语义判断，必须是 **full=LLM 语义评估或确定性规则**；正则只能作为 LLM 不可用时的临时 fallback，并在 trace 标记。
