# Hc-3-2 — Spec Appendix A Schemas (A1–A4)

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-3-2  
> **Task**: H/P1-18  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-3-Schema-Access.md`  
> **Source**: `doc/Roadmap.md`, `01-Spec.md` §28, `04-Archive.md` Appendix A, `doc/plans/H3-Validation-and-Guards.md` §6.2

---

## 1. Objective

Create versioned, validated JSON Schemas for the four Appendix A data structures. Validate on both sample and real data.

---

## 2. Appendix A Structures

| ID | File | Key Fields |
|----|------|-------------|
| A1 | engagement_plan.json | schemaVersion, turnId, mode, engagementTier, replyBudget, contextBudget, expressiveness, reasons |
| A2 | interests.json | schemaVersion, updatedAt, topics |
| A3 | topic_state.json | schemaVersion, activeTopic, threads |
| A4 | proactive_plan.json | schemaVersion, intent, target, why, constraints |

---

## 3. Key Deliverables

- [ ] JSON Schemas: `schemas/v1/engagement_plan.schema.json`, `interests.schema.json`, `topic_state.schema.json`, `proactive_plan.schema.json`
- [ ] Sample fixtures: `test/schemas/fixtures/appendix_a/` (valid + invalid)
- [ ] Lint/compile integration (structure validation)
- [ ] Version migration round-trip tests

---

## 4. Dependencies

- H/P1-17 (Schema Contracts)
- F/P0-2, F/P0-4

---

## 5. DoD

- All four schemas validate on sample + real data
- Version upgrade round-trips
- CI test green

---

## 6. Rollback

Retain legacy schema read adapter.
