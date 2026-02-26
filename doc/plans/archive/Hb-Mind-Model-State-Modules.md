# Phase Hb — Mind Model State Modules

> High-Level Execution Plan  
> Date: 2026-02-26  
> Status: `done`（Phase 级，进度以 Roadmap 为准）  
> Progress: 以 `doc/Roadmap.md` 为准（本计划仅描述 scope，不做逐任务快照）  
> Source: `doc/Roadmap.md` (Phase Hb) + `04-Archive.md` §5–§12, §17  
> Scope: 8 tasks (H/P1-0..7), W4–W6  
> Subplans: `Hb-1-State-Core.md`, `Hb-2-Package-Compat.md`  
> Nested: `Hb-1-1-Identity-Beliefs.md`, `Hb-1-2-Memory-Relationships.md`, `Hb-1-3-Affect-Module.md`, `Hb-1-4-Imperfection-DoD.md`, `Hb-2-1-Persona-Package.md`, `Hb-2-2-Compat-Checklist.md`

---

## 1. Phase Objective

Upgrade the seven mind-model domains into **first-class state machines** that plug into the State Delta Pipeline (`proposal → gates → apply`), plus human-like imperfection DoD and a compatibility checklist.

1. **Values / Personality** — Runnable gate rules; personality slow drift via Epigenetics.
2. **Goals / Beliefs** — State modules with slow-update rules and evidence binding.
3. **Memory Forgetting** — Decay + interference + compression pipeline (life.log untouched).
4. **Relationship State** — Externalized people registry + relationship state + card injection.
5. **Persona Package v0.4** — Layout, metadata, migration snapshots, rollback.
6. **Affect 3-Layer** — Mood baseline + emotion episodes + temperament influence.
7. **Imperfection DoD** — Testable rules for uncertainty, forgetting, non-perfect replies.
8. **Compat Checklist** — Engineering checklist for entry/storage/recall/rollback.

### Entry Conditions

- Phase Ha exit conditions met (State Delta Pipeline, Invariant Table, Compat, Genome MVP).
- `H/P0-0` through `H/P0-4` complete.

### Exit Conditions

- All state modules plug into `proposal → gates → apply` pipeline.
- Imperfection expressible and testable.
- Persona Package v0.4 layout stable.
- Compat checklist complete with evidence paths.
- Minor version bump triggered per Roadmap rule 1.1 (on Phase Hb completion).

---

## 2. Design Principles (from Archive, non-negotiable)

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **Add layers, never replace** | Reuse existing memory stack / turn protocol / commit / doctor. New modules plug in as rollback-capable additions. |
| 2 | **LLM only proposes** | All state mutations go through `StateDeltaProposal → gates → deterministic apply`. |
| 3 | **Audit-first** | Every key state change traces back to `life.log event hash` or `memory ids`. Gate rejections logged with reason. |
| 4 | **Budget-first** | Context injection (cards, recall topK) has hard token/count budgets. Genome-derived params are clamped. |
| 5 | **Compatibility-first** | Legacy personas default to `legacy` (genome auto-inferred at 0.5). Prove behavior parity on regression set before `full`. |
| 6 | **Human-like imperfection** | Allow "unsure / can't remember / unknown cause". Forbid fabricated memories or ungrounded assertions. |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Phase Ha (Foundation) — done                            │
│  - State Delta Pipeline (H/P0-0)                         │
│  - Invariant Table (H/P0-1)                               │
│  - Compat & Migration (H/P0-2..3)                       │
│  - Genome & Epigenetics MVP (H/P0-4)                     │
└──────────────────────┬──────────────────────────────────┘
                       │ Phase Hb adds ↓
┌──────────────────────▼──────────────────────────────────┐
│  Hb-1: State Core (A's track)                            │
│  Hb-1-1: Values / Personality (H/P1-0)                  │
│  Hb-1-1: Goals / Beliefs (H/P1-1)                        │
│  Hb-1-2: Memory Forgetting (H/P1-2)                     │
│  Hb-1-2: Relationship State (H/P1-3)                   │
│  Hb-1-3: Affect 3-Layer (H/P1-5) ⚠ sync-1               │
│  Hb-1-4: Imperfection DoD (H/P1-6)                      │
├─────────────────────────────────────────────────────────┤
│  Hb-2: Package & Compat (B's track)                     │
│  Hb-2-1: Persona Package v0.4 (H/P1-4)                 │
│  Hb-2-2: Compat Checklist (H/P1-7)                     │
└─────────────────────────────────────────────────────────┘
```

### 3.1 Seven Mind-Model Domains (from Archive §3)

| # | Domain | Hb Task | Change Mechanism |
|---|--------|---------|------------------|
| 1 | Memory / History | H/P1-2 | Decay + interference + compression |
| 2 | Values / Constitution | H/P1-0 | Gate rules (slow) |
| 3 | Personality / Temperament | H/P1-0, H/P1-5 | Epigenetics (very slow) |
| 4 | Affect | H/P1-5 | Mood baseline + emotion episodes + temperament |
| 5 | Relationships | H/P1-3 | State (per-turn) + evidence binding |
| 6 | Goals / Commitments | H/P1-1 | State (slow update) |
| 7 | Beliefs / World Model | H/P1-1 | State (slow + evidence + cooldown) |

---

## 4. Task Grouping & Subplans

### Execution Strategy

**Serial primary, small parallelism.** Per Roadmap rule 5.1: medium coupling.

| Subplan | Tasks | Owner | Description |
|---------|-------|-------|--------------|
| **Hb-1** | H/P1-0, H/P1-1, H/P1-2, H/P1-3, H/P1-5, H/P1-6 | A | State Core |
| **Hb-2** | H/P1-4, H/P1-7 | B | Package & Compat |

**Execution order** (logical dependency):

```
Hb-1: H/P1-0 → H/P1-1 → H/P1-2 → H/P1-3 ──────┐
                                               ├──→ H/P1-5 (after H/P0-4 sync)
Hb-1: H/P1-6 (independent, after H/P0-1) ─────┘

Hb-2: H/P1-4 → H/P1-7 (parallel with Hb-1)
```

### Dependency Graph

```
H/P0-0 (Pipeline) ──┬──→ H/P1-0 ──→ H/P1-1 ──→ H/P1-2 ──→ H/P1-3
                    │
H/P0-1 (Invariant) ─┼──→ H/P1-6 (independent)
                    │
H/P0-2 (Compat) ────┼──→ H/P1-4 ──→ H/P1-7
                    │
H/P0-4 (Genome) ────┴──→ H/P1-5 (Affect 3-Layer) ⚠ sync-1
```

### Critical Sync Point

| ID | Direction | Blocker → Blocked | Impact |
|----|-----------|-------------------|--------|
| sync-1 | B → A | B completes H/P0-4 → A starts H/P1-5 | A cannot build Affect 3-layer without Genome traits (emotion_sensitivity, emotion_recovery) |

---

## 5. Division of Labor (A / B)

| Person A | Person B |
|----------|----------|
| H/P1-0 Values / Personality | H/P1-4 Persona Package v0.4 |
| H/P1-1 Goals / Beliefs | H/P1-7 Compat Checklist |
| H/P1-2 Memory Forgetting | |
| H/P1-3 Relationship State | |
| H/P1-5 Affect 3-Layer ⚠sync | |
| H/P1-6 Imperfection DoD | |

- **Task count**: A=6 | B=2
- **Sync point (B→A)**: H/P1-5 depends on H/P0-4 (Genome & Epigenetics) from Phase Ha.

---

## 6. Subplan Index

| File | Scope | Tasks |
|------|-------|-------|
| `Hb-1-State-Core.md` | State core | H/P1-0, H/P1-1, H/P1-2, H/P1-3, H/P1-5, H/P1-6 |
| `Hb-2-Package-Compat.md` | Package & Compat | H/P1-4, H/P1-7 |
| `Hb-1-1-Identity-Beliefs.md` | Identity & Beliefs | H/P1-0, H/P1-1 |
| `Hb-1-2-Memory-Relationships.md` | Memory & Relationships | H/P1-2, H/P1-3 |
| `Hb-1-3-Affect-Module.md` | Affect 3-Layer | H/P1-5 |
| `Hb-1-4-Imperfection-DoD.md` | Imperfection DoD | H/P1-6 |
| `Hb-2-1-Persona-Package.md` | Persona Package | H/P1-4 |
| `Hb-2-2-Compat-Checklist.md` | Compat Checklist | H/P1-7 |

---

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | State module proliferation makes context compile too heavy | Medium | Medium | Each module's context injection is budget-gated; total injection budget is fixed |
| R2 | Memory forgetting too aggressive — key memories lost | Medium | High | Salience floor for entity-linked and commitment-related memories; decay rate clamped |
| R3 | Relationship card false positives (wrong entity linked) | Medium | Medium | Confidence threshold for entity linking; only inject on high-confidence match |
| R4 | Affect 3-layer complexity delays the batch | Medium | Medium | H/P1-5 sequenced last; other modules can stabilize while affect is being built |
| R5 | Gate chain ordering conflicts between modules | Low | High | Gate priority defined in invariant table; documented ordering |
| R6 | Sync-point delays (B blocks A on H/P0-4) | Low | Medium | B prioritizes H/P0-2→3→4 chain; A has H/P1-0..3 to fill wait time |

---

## 8. Phase Hb Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Values gate operational | Out-of-bounds replies intercepted with reason |
| E2 | Goals/Beliefs cross-session continuity | Continuity test green |
| E3 | Memory forgetting pipeline running | life.log untouched; capacity controlled; key recall达标 |
| E4 | Relationship state externalized | Traceable, explainable; card injection within budget |
| E5 | Persona Package v0.4 layout stable | Cross-version load; migration and rollback work |
| E6 | Affect 3-layer state machine operational | Evidence chain; fast/slow separation; replayable |
| E7 | Imperfection DoD rules codified | All IMP rules have passing scenarios |
| E8 | Compat checklist complete | All items pass with evidence paths |

---

## 9. Rollback Strategy

| Level | Rollback Action |
|-------|-----------------|
| **Per-task** | Each task defines rollback in Roadmap entry |
| **Per-module** | State modules can be individually disabled by `compatMode=legacy` for that domain |
| **Phase-level** | Feature-flag off; personas remain on legacy; all traces preserved |

---

## 10. What Phase Hb Does NOT Cover

- Regression suites (Relationship continuity, Emotional depth, Governance) → Phase Hc
- Risk guards (over-numericalization, relationship noise, epigenetics backdoor, etc.) → Phase Hc
- Schema contracts (Appendix A/B) → Phase Hc
- Interest-Attention, Proactive Planner, Engagement Plan → Phase J
- Multi-persona session graph → Phase K
