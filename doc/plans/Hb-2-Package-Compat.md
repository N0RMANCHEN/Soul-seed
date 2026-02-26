# Hb-2 — Persona Package v0.4 & Compat Checklist

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-2 (Package & Compat)  
> **Schedule**: W4–W6 (parallel with Hb-1)  
> **Tasks**: 2 (H/P1-4, H/P1-7)  
> **Execution Strategy**: Serial (H/P1-4 → H/P1-7)  
> **Status**: `done`  
> **Parent**: `doc/plans/Hb-Mind-Model-State-Modules.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §15, §17, `doc/plans/Hb-Mind-Model-State-Modules.md`

---

## 1. Subplan Objective

Complete the Persona Package layout and compatibility engineering checklist:

1. **H/P1-4**: Persona Package v0.4 — layout, metadata, migration snapshots, rollback.
2. **H/P1-7**: Compat Checklist — entry/storage/recall/rollback checklist with CI validation.

---

## 2. Execution Strategy

**Serial.** H/P1-7 consumes H/P1-4 layout and references all state modules.

```
H/P1-4 (Persona Package v0.4) → H/P1-7 (Compat Checklist)
```

**Parallel with Hb-1**: Hb-2 can run in parallel with Hb-1 (different owners, low coupling).

### Nested Subplans

| File | Tasks | Description |
|------|-------|--------------|
| `Hb-2-1-Persona-Package.md` | H/P1-4 | Package layout, manifest, snapshots, rollback |
| `Hb-2-2-Compat-Checklist.md` | H/P1-7 | Engineering checklist + CI validation |

---

## 3. Dependency Graph

```
H/P0-2 (Compat) ──→ H/P1-4
F/P0-4 ───────────→ H/P1-4
F/P0-3 ───────────→ H/P1-7
H/P0-2 ───────────→ H/P1-7
```

---

## 4. Task Summary

| Task | Complexity | Coupling | Owner | Key Deliverables |
|------|-----------|----------|-------|------------------|
| H/P1-4 | M | low | B | manifest.json, PackageLoader, PackageSnapshotter, MigrationLogger |
| H/P1-7 | M | medium | B | compat_checklist.json, compat_lint.ts, foundation preservation tests |

---

## 5. Risk Register

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Package migration breaks existing tooling | Old layout reader preserved; feature flag for new loader |
| R2 | Compat testing surface too large | Focus regression on top-3 most-used personas |

---

## 6. Hb-2 Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Persona Package v0.4 layout finalized | Cross-version load test; snapshot/restore test |
| E2 | Compat checklist complete | All items pass with evidence paths; CI lint green |
| E3 | Foundation preservation | Existing interfaces unchanged |
