# Hc-1-3 — Governance Regression

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-1-3  
> **Task**: H/P1-10  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-1-Regression-Suites.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §18.3, `doc/plans/H3-Validation-and-Guards.md` §4.3

---

## 1. Objective

Build a unified governance verification suite that checks all governance mechanisms (gates, budgets, compat, rollback) as a single coherent system. Every governance item must be automatically checkable with no blocking gaps.

---

## 2. Governance Categories

| Category | Items | Source |
|----------|-------|--------|
| **Gates** | Identity, Recall Grounding, Relationship Delta, Mood Delta, Belief/Goal, Epigenetics | H/P0-0, H/P1-0, H/P1-1, H/P1-3, H/P1-5, H/P0-4 |
| **Budgets** | Context injection within limits | H/P0-1 |
| **Compat** | Legacy behavior parity, upgrade path, rollback full→legacy | H/P0-2, H/P0-3 |
| **Invariants** | Threshold enforcement in CI | H/P0-1 |
| **Rollback** | Per-module rollback | H0/H1 |
| **Trace** | Gate rejection logging, state change provenance | H/P0-0 |

---

## 3. Key Deliverables

- [ ] Verification harness: `scripts/regression/governance.ts`
- [ ] Item registry: `config/regression/governance_items.json`
- [ ] Fixture personas: `test/regression/governance/fixtures/` (legacy + full)
- [ ] CI job: `ci:regression:governance` (PR-blocking)
- [ ] Gap analysis report (any item not auto-verifiable → documented workaround + Phase I ticket)

---

## 4. Integration

- Reads from: All H0 deliverables, all H1 state modules, H/P1-7 compat checklist
- Cross-references: H/P1-8 relationship metrics, H/P1-9 emotional metrics

---

## 5. DoD

- All governance items in registry auto-checkable
- Zero blocking gaps (or documented workaround)
- CI job runs on every PR and blocks merge on failure

---

## 6. Rollback

Split into per-module verification (individual gate tests).
