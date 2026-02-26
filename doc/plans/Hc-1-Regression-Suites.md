# Hc-1 — Regression Suites

> **Phase**: Hc — Verification & Governance  
> **Subplan**: Hc-1 (Regression Suites)  
> **Schedule**: W7–W8  
> **Tasks**: 3 (H/P1-8, H/P1-9, H/P1-10)  
> **Execution Strategy**: Parallel (A: H/P1-8, H/P1-9; B: H/P1-10). H/P1-10 can start on Ha-only.  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-Verification-Governance.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §18.1–§18.3

---

## 1. Subplan Objective

Build three regression suites that prove Ha/Hb deliverables meet behavioral and governance quality:

1. **H/P1-8**: Relationship continuity — long-term interaction without "失忆换人".
2. **H/P1-9**: Emotional depth — layered mood/episode/temperament, no flat single-layer emotion.
3. **H/P1-10**: Governance — gate coverage, budget enforcement, compat pass rate, rollback success.

---

## 2. Execution Strategy

**Parallel.** H/P1-8 and H/P1-9 depend on Hb (H/P1-3, H/P1-5). H/P1-10 depends only on Ha (H/P0-1, H/P0-2, H/P0-3) and can start early.

```
H/P1-8 (Relationship) ──┐
                        ├──→ Run in parallel
H/P1-9 (Emotional) ─────┤
                        │
H/P1-10 (Governance) ───┘  (can start on Ha completion)
```

### Nested Subplans

| File | Tasks | Description |
|------|-------|-------------|
| `Hc-1-1-Relationship-Regression.md` | H/P1-8 | Entity hit rate, card injection, cross-session identity |
| `Hc-1-2-Emotional-Depth-Regression.md` | H/P1-9 | Mood baseline, episode binding, recovery, explainability |
| `Hc-1-3-Governance-Regression.md` | H/P1-10 | Gate/budget/compat/rollback unified suite |

---

## 3. Dependency Graph

```
H/P1-3 (Relationship State) ──→ H/P1-8
H/P1-5 (Affect 3-Layer) ──────→ H/P1-9
H/P0-1, H/P0-2, H/P0-3 ───────→ H/P1-10
```

---

## 4. Task Summary

| Task | Complexity | Coupling | Owner | Key Deliverables |
|------|-----------|----------|-------|-------------------|
| H/P1-8 | M | low | A | Scenario corpus, relationship_continuity.ts, CI job |
| H/P1-9 | M | low | A | Emotional depth dimensions, scoring script, CI job |
| H/P1-10 | M | medium | B | Governance checklist, unified regression runner, CI job |

---

## 5. Archive References

| Task | Archive § | Key Metrics |
|------|----------|-------------|
| H/P1-8 | §18.1 | 输入提及实体 → 100% 命中; 关系卡注入; 跨会话身份稳定 |
| H/P1-9 | §18.2 | mood baseline 惯性; episode 绑定 trigger+证据; 恢复行为 |
| H/P1-10 | §18.3 | 关系值 rate-limit; identity/constitution 一致; 门禁/预算/兼容/回滚 |
