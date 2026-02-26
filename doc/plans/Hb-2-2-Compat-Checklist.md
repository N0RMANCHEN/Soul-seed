# Hb-2-2 — Compat Checklist Engineering & CI Validation

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-2-2 (Compat Checklist)  
> **Parent**: `doc/plans/Hb-2-Package-Compat.md`  
> **Tasks**: 1 (H/P1-7)  
> **Execution Strategy**: After H/P1-4  
> **Status**: `done`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §17

---

## 1. Objective

Decompose high-level compatibility description (Archive §17) into concrete engineering checklist. Wire into CI documentation validation.

---

## 2. Task Detail

### 2.1 H/P1-7 — Compat Checklist Engineering & CI Validation

**Objective**: Entry/storage/recall/rollback checklist; CI validation; foundation preservation verification.

#### Checklist Dimensions

| Category | Description |
|----------|-------------|
| **Entry points** | Where new code hooks in. Each: location, reads, writes, rollback procedure. |
| **Storage** | New files in Persona Package. Each: schema, defaults, migration from previous version. |
| **Recall** | Changes to memory recall ranking/scoring. Document: what changed, impact, compat constant mapping. |
| **Rollback** | Every new module: documented rollback procedure, no data loss. |

#### Checklist Item Format

```json
{
  "id": "COMPAT-ENTRY-01",
  "category": "entry" | "storage" | "recall" | "rollback",
  "description": "string",
  "evidencePath": "file path or test name",
  "status": "pass" | "fail" | "not_applicable",
  "verifiedAt": "string"
}
```

#### CI Integration

- Lint job validates:
  - All new modules have checklist entry
  - All entries have non-empty evidencePath
  - All evidence paths resolve to existing files/tests
- Runs on every PR touching state modules or pipeline code.

#### Foundation Preservation Verification

Explicit checks that existing foundation is untouched:

- life.log write interface unchanged
- memory.db schema backward-compatible
- executeTurnProtocol signature unchanged
- doctor / consistency guards still active

#### Key Deliverables

| Artifact | Description |
|----------|-------------|
| compat_checklist.json | Full checklist with all items |
| compat_lint.ts | CI validation script |
| Foundation preservation test suite | Explicit interface checks |
| PR template addition | "compat checklist updated? [y/n]" |

---

## 3. DoD

- All existing Phase H modules have checklist entries with evidence.
- CI lint catches deliberately missing entry (negative test).
- Foundation preservation: run suite → all existing interfaces unchanged.

---

## 4. Rollback

Fall back to manual architecture review process.

---

## 5. Storage / Schema Gate (contributing_ai.md §5.3)

- Compat checklist validates that all state modules use state_delta_apply or state_delta_writer.
- Foundation preservation: life.log, memory.db, executeTurnProtocol, doctor interfaces unchanged.

## 6. Integration Points

- CI pipeline: lint job on PR
- All state modules (H/P1-0..5): each must have checklist entries
- Compat & Migration (H/P0-2): checklist validates compat bridge
- Persona Package (H/P1-4): layout references in checklist

---

## 7. Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | All modules have checklist entries | Zero uncovered items |
| E2 | Evidence paths resolve | All paths → existing files/tests |
| E3 | Foundation preservation | Suite passes; interfaces unchanged |
| E4 | CI lint catches missing entry | Negative test passes |
