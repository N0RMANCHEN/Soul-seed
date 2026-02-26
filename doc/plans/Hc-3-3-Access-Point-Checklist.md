# Hc-3-3 — Spec Appendix B Access-Point Checklist

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-3-3  
> **Task**: H/P1-19  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-3-Schema-Access.md`  
> **Source**: `doc/Roadmap.md`, `01-Spec.md` §29, `04-Archive.md` Appendix B, `doc/plans/Hc-Verification-Governance.md` §7

---

## 1. Objective

Convert Appendix B access-point list into an engineering checklist. Each item must have a code anchor and regression case. Prevents "接错层/侵入过深".

---

## 2. H-Scope Access Points (verify in Hc)

| # | Access Point | Verification |
|---|--------------|---------------|
| 2 | Context Budget (in Context Compile) | Code anchor + invariant-table budget enforcement |
| 3 | State Delta Pipeline (after meta-review, before commit) | Code anchor + wiring + no direct writes |
| 6 | Emotion Expression Policy (conversation_policy output) | Code anchor + wiring + emoji/emotion frequency controlled by policy |

---

## 3. J/K-Scope (contract stubs only in Hc)

| # | Access Point | Hc Treatment |
|---|--------------|---------------|
| 1 | Engagement Controller | Contract stub + expected insertion point documented |
| 4 | Proactive Planner | Contract stub + expected insertion point documented |
| 5 | Group Arbitration | Contract stub + expected insertion point documented |

---

## 4. Key Deliverables

- [ ] Access-point checklist: `config/access_point_checklist.json` (or equivalent)
- [ ] Code anchors for H-scope points (#2, #3, #6)
- [ ] Regression cases for each H-scope point
- [ ] Contract stubs for J/K-scope points
- [ ] CI: checklist items pass with evidence

---

## 5. Dependencies

- H/P0-0 (State Delta Pipeline)
- F/P0-3 (四层语义路由门禁)

---

## 6. DoD

- All checklist items pass
- Each item has code evidence + regression case
- J/K-scope stubs documented for Phase J/K handoff

---

## 7. Rollback

Revert to manual architecture review.
