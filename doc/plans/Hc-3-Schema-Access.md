# Hc-3 — Schema Contracts & Access-Point Checklist

> **Phase**: Hc — Verification & Governance  
> **Subplan**: Hc-3 (Schema & Access)  
> **Schedule**: W7–W8  
> **Tasks**: 3 (H/P1-17, H/P1-18, H/P1-19)  
> **Execution Strategy**: Serial (H/P1-17 → H/P1-18). H/P1-19 independent.  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-Verification-Governance.md`  
> **Source**: `doc/Roadmap.md`, `01-Spec.md` §28/§29, `04-Archive.md` Appendix A/B

---

## 1. Subplan Objective

Formalize data structures and access points for downstream phases:

1. **H/P1-17**: Appendix example structures → schema contracts + version validation.
2. **H/P1-18**: Spec Appendix A (A1–A4) — versioned schemas for `engagement_plan`, `interests`, `topic_state`, `proactive_plan`.
3. **H/P1-19**: Spec Appendix B — access-point checklist with code anchors and regression cases.

---

## 2. Execution Strategy

**Serial within schema chain.** H/P1-18 depends on H/P1-17. H/P1-19 is independent (depends on H/P0-0, F/P0-3).

```
H/P1-17 (Schema Contracts) ──→ H/P1-18 (Appendix A Schemas)

H/P1-19 (Access-Point Checklist) — independent
```

### Nested Subplans

| File | Tasks | Description |
|------|-------|-------------|
| `Hc-3-1-Schema-Contracts.md` | H/P1-17 | Appendix example structures → schema + version rules |
| `Hc-3-2-Appendix-A-Schemas.md` | H/P1-18 | A1–A4 versioned schemas, lint/compile validation |
| `Hc-3-3-Access-Point-Checklist.md` | H/P1-19 | Appendix B → engineering checklist, code anchors |

---

## 3. Dependency Graph

```
H/P1-4 (Persona Package) ──→ H/P1-17
H/P1-17 ───────────────────→ H/P1-18
F/P0-2, F/P0-4 ────────────→ H/P1-18

H/P0-0 (Pipeline) ───────────→ H/P1-19
F/P0-3 ─────────────────────→ H/P1-19
```

---

## 4. Task Summary

| Task | Complexity | Coupling | Owner | Key Deliverables |
|------|-----------|----------|-------|-------------------|
| H/P1-17 | M | medium | B | Schema contract framework, version validation rules |
| H/P1-18 | M | medium | B | engagement_plan, interests, topic_state, proactive_plan schemas |
| H/P1-19 | M | medium | B | Access-point checklist, code anchors, regression cases |

---

## 5. Appendix A Structures (H/P1-18)

| ID | File | Key Fields |
|----|------|------------|
| A1 | engagement_plan.json | schemaVersion, turnId, mode, engagementTier, replyBudget, contextBudget |
| A2 | interests.json | schemaVersion, updatedAt, topics |
| A3 | topic_state.json | schemaVersion, activeTopic, threads |
| A4 | proactive_plan.json | schemaVersion, intent, target, why, constraints |

---

## 6. Appendix B Access Points (H-scope for Hc)

| # | Access Point | H-scope Verification |
|---|--------------|------------------------|
| 2 | Context Budget | Code anchor + invariant-table budget enforcement |
| 3 | State Delta Pipeline | Code anchor + wiring + no direct writes |
| 6 | Emotion Expression Policy | Code anchor + wiring + conversation_policy frequency gate |

J/K-scope points (#1 Engagement Controller, #4 Proactive Planner, #5 Group Arbitration) → contract stubs only in Hc.
