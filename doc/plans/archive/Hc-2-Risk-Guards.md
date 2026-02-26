# Hc-2 — Risk Guards

> **Phase**: Hc — Verification & Governance  
> **Subplan**: Hc-2 (Risk Guards)  
> **Schedule**: W7–W8  
> **Tasks**: 5 (H/P1-12, H/P1-13, H/P1-14, H/P1-15, H/P1-16)  
> **Execution Strategy**: Parallel. All can start on Ha completion (P1-13 needs H/P1-3).  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-Verification-Governance.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §20.1–§20.5

---

## 1. Subplan Objective

Implement five risk guards that prevent identified drift/abuse vectors:

1. **H/P1-12**: Over-numericalization — replies stay natural-language dominant.
2. **H/P1-13**: Relationship noise — card injection frequency/weight controlled.
3. **H/P1-14**: Epigenetics backdoors — no silent personality changes; evidence required.
4. **H/P1-15**: Genome trait expansion — MVP stays at 6 traits; new traits require review.
5. **H/P1-16**: LLM direct writes — only `proposal → gates → apply`; direct writes fail and are audited.

---

## 2. Execution Strategy

**Parallel.** H/P1-12 has no internal deps. H/P1-13 depends on H/P1-3. H/P1-14, H/P1-15 depend on H/P0-4. H/P1-16 depends on H/P0-0.

```
(H/P1-12) ─────────────────┐
(H/P1-13, after H/P1-3) ───┤
(H/P1-14 || H/P1-15 || H/P1-16) ──→ All parallel
```

### Nested Subplans

| File | Tasks | Description |
|------|-------|-------------|
| `Hc-2-1-Output-Guards.md` | H/P1-12, H/P1-13 | Over-numericalization + Relationship noise (output/context layer) |
| `Hc-2-2-State-Guards.md` | H/P1-14, H/P1-15, H/P1-16 | Epigenetics + Genome + LLM direct-write (state layer) |

---

## 3. Dependency Graph

```
H/P0-0 (Pipeline) ──────→ H/P1-16
H/P0-4 (Genome) ────────→ H/P1-14, H/P1-15
H/P1-3 (Relationship) ──→ H/P1-13
四层语义路由门禁 ────────→ H/P1-12
```

---

## 4. Task Summary

| Task | Complexity | Coupling | Owner | Key Deliverables |
|------|-----------|----------|-------|-------------------|
| H/P1-12 | S | low | A | Numeric overload detector, threshold config, CI gate |
| H/P1-13 | S | low | A | Card injection gate, frequency/weight limits, CI gate |
| H/P1-14 | S | low | B | Epigenetics evidence gate, audit trail, CI gate |
| H/P1-15 | S | low | B | Trait whitelist, expansion review gate, CI gate |
| H/P1-16 | S | low | B | Direct-write detector, check_direct_writes.mjs, CI gate |

---

## 5. Archive References

| Task | Archive § | Mitigation |
|------|-----------|------------|
| H/P1-12 | §20.1 | 解释默认内化; 用户追问/自证才展开; 对外不报数 |
| H/P1-13 | §20.2 | 命中置信度门槛; 每轮 1~2 张硬上限; 卡片短且与本轮有关 |
| H/P1-14 | §20.3 | 多证据+长 cooldown; bounded; 可回滚; 审计必需 |
| H/P1-15 | §20.4 | MVP 固守 6 trait; 上线稳定后再扩展 |
| H/P1-16 | §20.5 | 强制"提案→确定性落地"; 无例外 |
