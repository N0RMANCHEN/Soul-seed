# Phase Hc — Verification, Risk Guards & Schema Contracts

> High-Level Execution Plan  
> Date: 2026-02-26  
> Status: `todo`  
> Source: `doc/Roadmap.md` (Phase Hc) + `04-Archive.md` §18, §20, Appendix A/B  
> Scope: 11 tasks (H/P1-8..10, H/P1-12..19), W7–W8  
> Subplans: `Hc-1-Regression-Suites.md`, `Hc-2-Risk-Guards.md`, `Hc-3-Schema-Access.md`  
> Nested: `Hc-1-1-Relationship-Regression.md`, `Hc-1-2-Emotional-Depth-Regression.md`, `Hc-1-3-Governance-Regression.md`, `Hc-2-1-Output-Guards.md`, `Hc-2-2-State-Guards.md`, `Hc-3-1-Schema-Contracts.md`, `Hc-3-2-Appendix-A-Schemas.md`, `Hc-3-3-Access-Point-Checklist.md`  
> Note: H/P1-11 (Observability Regression) moved to Phase I as `I/P1-11`

---

## 1. Phase Objective

Ensure Ha/Hb deliverables pass **regression validation**, are protected by **risk guards**, and have **schema contracts** and **access-point verification**. Phase Hc closes the governance loop so Phase H is fully closable.

1. **Regression Suites** — Relationship continuity, emotional depth, governance (gate/budget/compat/rollback).
2. **Risk Guards** — Over-numericalization, relationship noise, epigenetics backdoors, genome trait expansion, LLM direct writes.
3. **Schema Contracts** — Appendix example structures → schema contracts; Spec Appendix A (A1–A4) versioned schemas.
4. **Access-Point Checklist** — Appendix B access points → engineering checklist with code anchors and regression cases.

### Entry Conditions

- **Phase Ha** exit conditions met (State Delta Pipeline, Invariant Table, Compat, Genome MVP).
- **Partial entry**: H/P1-10, H/P1-14, H/P1-15, H/P1-16, H/P1-19 only depend on Ha — can start in parallel with Phase Hb.
- **Full entry**: H/P1-8 depends on H/P1-3 (Relationship State); H/P1-9 depends on H/P1-5 (Affect 3-Layer); H/P1-13 depends on H/P1-3; H/P1-17 depends on H/P1-4; H/P1-18 depends on H/P1-17.

### Exit Conditions

- 3 regression suites green (relationship, emotional depth, governance).
- 5 risk guards CI-active.
- Schema contracts binding (H/P1-17, H/P1-18).
- Access-point checklist mapped with code evidence and regression cases.
- Minor version bump triggered per Roadmap rule 1.1 (on Phase Hc completion).

---

## 2. Design Principles (from Archive, non-negotiable)

| # | Principle | Hc Enforcement |
|---|-----------|-----------------|
| 1 | **Add layers, never replace** | Regressions and guards are additive CI layers; no existing tests removed. |
| 2 | **LLM only proposes** | H/P1-16 verifies no direct-write bypass. All regression scenarios assert proposal-only writes. |
| 3 | **Audit-first** | Every guard logs rejection reason. Regression suites verify trace completeness. |
| 4 | **Budget-first** | H/P1-12 (over-numericalization) and H/P1-13 (noise) enforce budget constraints. |
| 5 | **Compat-first** | H/P1-10 governance regression includes compat pass rate as a gate metric. |
| 6 | **Human-like imperfection** | H/P1-9 emotional depth regression checks for non-flat, imperfect emotional behavior. |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Phase Ha (Foundation) — done                            │
│  - State Delta Pipeline (H/P0-0)                         │
│  - Invariant Table (H/P0-1)                               │
│  - Compat & Migration (H/P0-2..3)                        │
│  - Genome & Epigenetics MVP (H/P0-4)                     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│  Phase Hb (State Modules) — prerequisite for Hc-1 subset  │
│  - H/P1-3 Relationship State → H/P1-8, H/P1-13          │
│  - H/P1-5 Affect 3-Layer → H/P1-9                        │
│  - H/P1-4 Persona Package → H/P1-17                       │
└──────────────────────┬──────────────────────────────────┘
                       │ Phase Hc adds ↓
┌──────────────────────▼──────────────────────────────────┐
│  Hc-1: Regression Suites (A/B)                           │
│  Hc-1-1: Relationship Continuity (H/P1-8)               │
│  Hc-1-2: Emotional Depth (H/P1-9)                        │
│  Hc-1-3: Governance (H/P1-10)                            │
├─────────────────────────────────────────────────────────┤
│  Hc-2: Risk Guards (A/B)                                 │
│  Hc-2-1: Output Guards (H/P1-12, H/P1-13)                │
│  Hc-2-2: State Guards (H/P1-14, H/P1-15, H/P1-16)        │
├─────────────────────────────────────────────────────────┤
│  Hc-3: Schema & Access (B)                               │
│  Hc-3-1: Schema Contracts (H/P1-17)                       │
│  Hc-3-2: Appendix A Schemas (H/P1-18)                    │
│  Hc-3-3: Access-Point Checklist (H/P1-19)                │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Task Grouping & Execution Strategy

**Strategy**: Grouped parallelism. Per Roadmap rule 5.1: low coupling, S/M complexity.

### Execution Order (from Roadmap)

```
(H/P1-8 || H/P1-12) → (H/P1-9 || H/P1-13) → H/P1-10 → (H/P1-14 || H/P1-15 || H/P1-16) → H/P1-17 → H/P1-18 → H/P1-19
```

**Early-start (Ha-only deps)**: H/P1-10, H/P1-14, H/P1-15, H/P1-16, H/P1-19 can start as soon as Ha completes, in parallel with Phase Hb.

### Subplan Summary

| Subplan | Tasks | Owner | Description |
|---------|-------|-------|-------------|
| **Hc-1** | H/P1-8, H/P1-9, H/P1-10 | A (8,9), B (10) | Regression Suites |
| **Hc-2** | H/P1-12, H/P1-13, H/P1-14, H/P1-15, H/P1-16 | A (12,13), B (14,15,16) | Risk Guards |
| **Hc-3** | H/P1-17, H/P1-18, H/P1-19 | B | Schema & Access |

### Dependency Graph

```
H/P0-0 (Pipeline) ──┬──→ H/P1-16 (LLM Direct-Write Ban)
                    └──→ H/P1-19 (Access-Point Checklist)

H/P0-1 (Invariant) ──→ H/P1-10 (Governance Regression)
H/P0-2 (Compat) ──────→ H/P1-10
H/P0-3 (Compat Constants) → H/P1-10

H/P0-4 (Genome) ──────┬──→ H/P1-14 (Epigenetics Guard)
                     └──→ H/P1-15 (Genome Trait Gate)

H/P1-3 (Relationship) ──┬──→ H/P1-8 (Relationship Regression)
                         └──→ H/P1-13 (Relationship Noise Guard)

H/P1-5 (Affect) ────────→ H/P1-9 (Emotional Depth Regression)

H/P1-4 (Persona Package) → H/P1-17 (Schema Contracts) → H/P1-18 (Appendix A Schemas)

H/P1-12 (Over-numericalization) — no internal deps
```

---

## 5. Division of Labor (A / B)

### Person A — State Core (regression + output guards)

| Subplan | Tasks |
|---------|-------|
| Hc-1 | H/P1-8 (Relationship Regression), H/P1-9 (Emotional Depth Regression) |
| Hc-2 | H/P1-12 (Over-numericalization), H/P1-13 (Relationship Noise) |
| **Total** | **4 tasks** |

### Person B — Control Plane (governance + state guards + schema)

| Subplan | Tasks |
|---------|-------|
| Hc-1 | H/P1-10 (Governance Regression) |
| Hc-2 | H/P1-14 (Epigenetics Guard), H/P1-15 (Genome Trait Gate), H/P1-16 (LLM Direct-Write Ban) |
| Hc-3 | H/P1-17 (Schema Contracts), H/P1-18 (Appendix A Schemas), H/P1-19 (Access-Point Checklist) |
| **Total** | **7 tasks** |

Workload gap: A=4, B=7 (within 30% threshold per Roadmap rule 5.2).

---

## 6. Risk Register (Phase-Level)

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Regression suites insufficient coverage | Use Archive §18 scenarios as minimum baseline; expand with real conversation logs |
| R2 | Schema contracts too rigid for iteration | Version schema from 1.0 with explicit migration strategies; keep legacy adapter layer |
| R3 | Access-point checklist drift | Bind each item to code anchor + regression case; CI enforces evidence |
| R4 | Hb delays block Hc-1 subset | H/P1-10, H/P1-14..16, H/P1-19 can proceed on Ha-only; A waits for sync |

---

## 7. Success Criteria (Phase Hc "Done")

1. **Regression suites green**: Relationship continuity, emotional depth, governance all above threshold.
2. **Risk guards active**: All five guards (H/P1-12..16) passing in CI.
3. **Schema contracts binding**: Appendix example structures + Appendix A (A1–A4) schemas validate on sample and real data.
4. **Access-point checklist mapped**: H-scope points (#2 Context Budget, #3 State Delta Pipeline, #6 Emotion Expression Policy) with code anchors + wiring + boundary checks; J/K-scope points documented as contract stubs.

---

## 8. What Phase Hc Does NOT Cover

| Out of Scope | Belongs To |
|-------------|-----------|
| Observability regression | Phase I (`I/P1-11`, depends on `I/P0-2`) |
| Engagement Controller access point runtime wiring | Phase J |
| Proactive Planner access point runtime wiring | Phase J |
| Group Arbitration access point runtime wiring | Phase K |
| Interest-Attention, topic_state, proactive_plan runtime | Phase J |
