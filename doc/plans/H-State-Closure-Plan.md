# Phase H — State Closure & Compatibility Fulfillment (状态闭环与兼容兑现)

> High-Level Execution Plan  
> Date: 2026-02-26 (updated)  
> Status: `in_progress` — H/P0 全部已完成；H/P1-0..H/P1-3 已启动并落地首批 scaffold（模块+测试）；H/P1-4..H/P1-19 待继续推进  
> Source: `doc/Roadmap.md` (Phase H) + `04-Archive.md` (v0.3.1 / v0.4 specs)  
> Scope: 24 tasks (H/P0-0..4 + H/P1-0..10, H/P1-12..19); H/P1-11 moved to Phase I, 8 weeks (W1–W8)  
> Note: H/P0-4 was implemented ahead of H/P0-0/H/P0-1 (execution order deviation). Genome wiring goes directly into existing code paths; will need routing through State Delta Pipeline once H/P0-0 lands.

---

## 1. Phase Objective

Build the **state core** and **compatibility foundation** so that Soulseed transitions from "strong-memory generator" to "human-like long-term conversational individual":

1. **State Delta Pipeline** — All state mutations flow through `proposal → gates → deterministic apply`. No LLM direct writes.
2. **Invariants & Compatibility** — Thresholds, compat migration, and Genome/Epigenetics MVP with guarantees for existing personas.
3. **State Modules** — Values, Personality, Goals, Beliefs, Memory forgetting, Relationships, and Affect become first-class state machines.
4. **Governance** — Regression suites, risk guards, schema contracts, and access-point verification.

### Entry Conditions
- Phase G fully archived (done).
- Four-layer semantic routing gates operational (done, from Phase F).
- `F/P0-2`, `F/P0-3`, `F/P0-4` exit conditions met.

### Exit Conditions
- All 24 Phase H tasks pass their DoD.
- CI invariant table green.
- Compat migration tested on existing personas with drift below threshold.
- Minor version bump triggered per Roadmap rule 1.1 (all tasks complete and archived).

> **H/P1-11 note**: H/P1-11 (Observability Regression) depends on `I/P0-2` which is Phase I scope. Per Roadmap rule 1.1 ("all tasks complete" = minor bump), H/P1-11 is **moved to Phase I** as task `I/P1-11`. It is no longer a Phase H task. Phase H closes with 24 tasks, all complete.

---

## 2. Design Principles (from Archive, non-negotiable)

These are Phase H's load-bearing constraints. Violating any one turns the system into a "drift machine":

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **Add layers, never replace** | Reuse existing memory stack / turn protocol / commit / doctor. New modules plug in as rollback-capable additions. |
| 2 | **LLM only proposes** | `state_delta_proposals → gates → deterministic apply`. No exceptions. |
| 3 | **Audit-first** | Every key state change traces back to `life.log event hash` or `memory ids`. Gate rejections logged with reason. |
| 4 | **Budget-first** | Context injection (cards, recall topK, summaries) has hard token/count budgets. Genome-derived params are clamped. |
| 5 | **Compatibility-first** | Existing personas default to `legacy` (genome auto-inferred at 0.5). No hybrid tier — personas are either legacy or `full`. Prove behavior parity on regression set before `full`. |
| 6 | **Human-like imperfection** | Allow "unsure / can't remember / unknown cause". Forbid fabricated memories or ungrounded assertions. |

---

## 3. Architecture Overview

### 3.1 What Phase H Builds (new layers on existing foundation)

```
┌─────────────────────────────────────────────────────────┐
│  Existing Foundation (untouched)                        │
│  - life.log (append-only)                               │
│  - memory.db + hybrid recall                            │
│  - executeTurnProtocol / meta_review / commit           │
│  - doctor / consistency guards                          │
│  - 4-layer semantic routing gates (Phase F)             │
└──────────────────────┬──────────────────────────────────┘
                       │ Phase H adds ↓
┌──────────────────────▼──────────────────────────────────┐
│  State Delta Pipeline (H/P0-0)                          │
│  proposal → gates → deterministic apply → trace         │
├─────────────────────────────────────────────────────────┤
│  Invariant Table (H/P0-1)                               │
│  CI-enforced thresholds for all state domains           │
├─────────────────────────────────────────────────────────┤
│  Compat & Migration (H/P0-2..3)                         │
│  2-tier compatMode: legacy / full (no hybrid)           │
│  Legacy = default genome (0.5) → same behavior          │
├─────────────────────────────────────────────────────────┤
│  Genome & Epigenetics (H/P0-4)                          │
│  6 traits → derived budgets/params                      │
│  Slow epigenetic drift with evidence gates              │
├─────────────────────────────────────────────────────────┤
│  State Modules (H/P1-0..5)                              │
│  Values · Personality · Goals · Beliefs                 │
│  Memory forgetting · Relationships · Affect (3-layer)   │
├─────────────────────────────────────────────────────────┤
│  Governance & Risk Guards (H/P1-6..19)                  │
│  Human imperfection DoD · Compat checklist              │
│  Regression suites · Risk guards · Schema contracts     │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Seven Mind-Model Domains (from Archive §3/§5)

| # | Domain | Phase H Task(s) | Change Mechanism |
|---|--------|-----------------|------------------|
| 1 | Memory / History | H/P1-2 (forgetting & compression) | State (fast decay) + Genome (half-life param) |
| 2 | Values / Constitution | H/P1-0 | Gate rules (slow) |
| 3 | Personality / Temperament | H/P1-0, H/P1-5 | Epigenetics (very slow) |
| 4 | Affect | H/P1-5 (3-layer state machine) | State (mood/episode) + Genome (sensitivity/recovery) |
| 5 | Relationships | H/P1-3 (first-class state) | State (per-turn) + Evidence binding |
| 6 | Goals / Commitments | H/P1-1 | State (slow update) |
| 7 | Beliefs / World Model | H/P1-1 | State (slow + evidence + cooldown) |

### 3.3 Three-Layer Change Mechanism

- **Genome (天赋)**: Near-immutable. 6 MVP traits. Inheritable, auditable.
- **Epigenetics (表观学习)**: Slow, bounded, evidence-driven, cooldown-gated, rollback-capable.
- **State (状态)**: Per-turn fast fluctuations, constrained by gates and budgets.

### 3.4 Genome MVP — 6 Traits (from Archive §13)

| Trait | Derived Params |
|-------|---------------|
| `emotion_sensitivity` | mood delta scale |
| `emotion_recovery` | baseline regression speed |
| `memory_retention` | half-life multiplier, archive threshold |
| `memory_imprint` | salience gain, sticky probability |
| `attention_span` | cards cap, recall K, recent window |
| `social_attunement` | entity linking threshold, candidate count |

---

## 4. Task Grouping Assessment (per Roadmap rule 5.1)

### Batch H0 — Foundation (W1–W3)

**Strategy: Strictly serial.** High coupling, hard risk. Per Roadmap rule 5.1, high-coupling + hard-risk tasks must be serial, one at a time, verified before proceeding.

| Task | Complexity | Coupling | Risk | Owner | Description |
|------|-----------|----------|------|-------|-------------|
| H/P0-0 | L | high | hard | AB | State Delta Pipeline: `proposal → gates → deterministic apply` |
| H/P0-1 | M | high | hard | A | Invariant Table: thresholds for all state domains, wired into CI |
| H/P0-2 | L | high | hard | B | Compat & Migration: 2-tier compatMode (legacy/full), auto-default genome for legacy |
| H/P0-3 | M | high | hard | B | Compat constants & calibration config, versioned |
| H/P0-4 | L | high | hard | B | Genome & Epigenetics MVP: 6 traits, budget mapping, slow drift |

**Execution order**: `H/P0-0 → H/P0-1 → H/P0-2 → H/P0-3 → H/P0-4`

### Batch H1 — State Modules (W4–W6)

**Strategy: Serial primary, small parallelism allowed.** Medium coupling.

| Task | Complexity | Coupling | Risk | Owner | Description |
|------|-----------|----------|------|-------|-------------|
| H/P1-0 | M | medium | soft | A | Values/Personality as runnable gate + slow drift |
| H/P1-1 | M | medium | soft | A | Goals/Beliefs state modules + slow-update rules |
| H/P1-2 | M | medium | soft | A | Memory forgetting: decay + interference + compression |
| H/P1-3 | M | medium | soft | A | Relationship first-class state (depends on H/P1-2) |
| H/P1-4 | M | medium | soft | B | Persona Package v0.4 layout, migration snapshots, rollback |
| H/P1-5 | L | high | hard | A | Affect 3-layer state machine (depends on H/P0-4 — sync point) |
| H/P1-6 | S | low | soft | A | Human-like imperfection DoD suite |
| H/P1-7 | M | medium | soft | B | Compat checklist engineering & CI validation |

**Execution order**:
- **A track**: `H/P1-0 → H/P1-1 → H/P1-2 → H/P1-3` then wait for sync → `H/P1-5`
- **B track**: `H/P1-4 → H/P1-7` (parallel with A's track after H/P0-4)
- **H/P1-6** (Imperfection DoD): Can start as soon as H/P0-1 is done; does not depend on H/P1-5. Runs in parallel with either track.

### Batch H2 — Validation & Risk Guards (W7–W8)

**Strategy: Grouped parallelism.** Low coupling, most tasks are independent regression suites or guards.

| Task | Complexity | Coupling | Risk | Owner | Description |
|------|-----------|----------|------|-------|-------------|
| H/P1-8 | M | low | soft | A | Relationship continuity regression |
| H/P1-9 | M | low | soft | A | Emotional depth regression |
| H/P1-10 | M | medium | soft | B | Governance regression (sync: waits for H/P0-1) |
| ~~H/P1-11~~ | — | — | — | — | Observability regression — **moved to Phase I** as `I/P1-11` (depends on `I/P0-2`) |
| H/P1-12 | S | low | soft | A | Risk guard: over-numericalization |
| H/P1-13 | S | low | soft | A | Risk guard: relationship noise injection |
| H/P1-14 | S | low | soft | B | Risk guard: epigenetics backdoors |
| H/P1-15 | S | low | soft | B | Risk guard: genome trait expansion gate |
| H/P1-16 | S | low | soft | B | Risk guard: LLM direct-write ban |
| H/P1-17 | M | medium | soft | B | Appendix example structure as schema contracts |
| H/P1-18 | M | medium | soft | B | Spec Appendix A (A1–A4) schema validation |
| H/P1-19 | M | medium | soft | B | Spec Appendix B access-point checklist |

**Parallel groups**:
- **A group**: `{H/P1-8, H/P1-12}` then `{H/P1-9, H/P1-13}`
- **B group**: `{H/P1-10, H/P1-14, H/P1-15, H/P1-16}` then `{H/P1-17 → H/P1-18}` then `H/P1-19`

---

## 5. Dependency Graph & Sync Points

```
H/P0-0 (State Delta Pipeline) ─────────────────────────────────┐
  │                                                             │
  ├──→ H/P0-1 (Invariant Table) ──→ H/P1-6 (Imperfection DoD) │
  │     │                                                       │
  │     └──→ H/P1-10 (Governance Regression) ⚠ sync-2          │
  │                                                             │
  ├──→ H/P0-2 (Compat & Migration)                             │
  │     ├──→ H/P0-3 (Compat Constants)                         │
  │     │     └──→ H/P0-4 (Genome & Epigenetics)               │
  │     │           ├──→ H/P1-5 (Affect 3-Layer) ⚠ sync-1      │
  │     │           ├──→ H/P1-14 (Epigenetics Guard)            │
  │     │           └──→ H/P1-15 (Genome Trait Gate)            │
  │     ├──→ H/P1-4 (Persona Package)                          │
  │     │     └──→ H/P1-17 → H/P1-18 (Schema Contracts)        │
  │     └──→ H/P1-7 (Compat Checklist)                         │
  │                                                             │
  ├──→ H/P1-0 (Values/Personality)                              │
  ├──→ H/P1-1 (Goals/Beliefs)                                  │
  ├──→ H/P1-2 (Memory Forgetting)                              │
  │     └──→ H/P1-3 (Relationship State)                       │
  │           ├──→ H/P1-8 (Relationship Regression)             │
  │           └──→ H/P1-13 (Relationship Noise Guard)           │
  ├──→ H/P1-16 (LLM Direct-Write Ban)                          │
  └──→ H/P1-19 (Access-Point Checklist)                        │
                                                                │
  H/P1-5 ──→ H/P1-9 (Emotional Depth Regression)               │
  H/P1-12 (Over-Numericalization Guard) — no internal deps      │
  H/P1-11 — MOVED to Phase I as I/P1-11 (needs I/P0-2)         │
```

### Critical Sync Points

| ID | Direction | Blocker → Blocked | Impact |
|----|-----------|-------------------|--------|
| sync-1 | B → A | B completes H/P0-4 → A starts H/P1-5 (Affect) | A cannot build 3-layer affect without Genome traits defining sensitivity/recovery params |
| sync-2 | A → B | A completes H/P0-1 → B starts H/P1-10 (Governance Regression) | B needs invariant thresholds to write governance verification |
| moved | cross-Phase | I/P0-2 → I/P1-11 (Observability) | Moved to Phase I; B owns |

---

## 6. Division of Labor (A / B)

### Person A — State Core (state, memory, emotion, relationships)

| Batch | Tasks |
|-------|-------|
| H0 | H/P0-0 (AB co-build), H/P0-1 |
| H1 | H/P1-0, H/P1-1, H/P1-2, H/P1-3, H/P1-5, H/P1-6 |
| H2 | H/P1-8, H/P1-9, H/P1-12, H/P1-13 |
| **Total** | **11 tasks + 1 co-build** |

### Person B — Control Plane (compat, schema, governance)

| Batch | Tasks |
|-------|-------|
| H0 | H/P0-0 (AB co-build), H/P0-2, H/P0-3, H/P0-4 |
| H1 | H/P1-4, H/P1-7 |
| H2 | H/P1-10, H/P1-14, H/P1-15, H/P1-16, H/P1-17, H/P1-18, H/P1-19 |
| **Total** | **12 tasks + 1 co-build** (H/P1-11 moved to Phase I) |

Workload gap: ~8% (within 30% threshold).

---

## 7. Per-Batch Execution Detail

### 7.1 Batch H0 — Foundation (W1–W3)

#### H/P0-0: State Delta Pipeline (AB co-build)
- **What**: Implement the core `proposal → gates → deterministic apply` pipeline that all subsequent state modules plug into.
- **Key deliverables**:
  - `StateDeltaProposal` type: `{ type, targetId, patch, confidence, supportingEventHashes, notes }`
  - `applyDeltas()` engine: clamp, rate-limit, evidence-check, compat-check
  - Gate rejection trace: rejected delta + reason logged
  - Integration point: after meta-review, before commit in `executeTurnProtocol`
- **DoD**: Deltas are auditable, replayable, and rejectable. Zero direct-write paths remain.
- **Rollback**: Old path kept running in parallel until verified.

#### H/P0-1: Invariant Table (A)
- **What**: Codify thresholds for Relationship / Beliefs / Mood / Engagement / Proactive / Group Chat and wire into CI.
- **Key deliverables**: Config-driven invariant definitions; CI job that fails on breach.
- **DoD**: Any threshold violation = CI failure.

#### H/P0-2: Compatibility & Migration (B)
- **What**: Implement 2-tier compatMode (`legacy` / `full`). Legacy personas auto-load default genome (all traits=0.5) producing current hardcoded behavior. No hybrid tier needed — the default genome *is* the compat bridge.
- **Key deliverables**: `loadGenome()` with auto-fallback; `loadPersonaPackage()` always includes genome; migration path from legacy to full.
- **DoD**: Existing personas show drift below threshold; no identity change. Legacy persona with default genome produces identical derived params to current hardcoded constants.

#### H/P0-3: Compat Constants & Calibration (B)
- **What**: Version-managed compat constants and calibration config files.
- **DoD**: Migration samples pass; missing items trigger lint failure.

#### H/P0-4: Genome & Epigenetics MVP (B)
- **What**: 6 fixed traits, `Genome → Budget` mapping, slow epigenetic drift rules.
- **Key deliverables**: `genome.json` and `epigenetics.json` schemas; derived-param mapping table; seed-based reproducible randomness.
- **DoD**: Trait differences are explainable; randomness is reproducible.

### 7.2 Batch H1 — State Modules (W4–W6)

#### H/P1-0: Values / Personality (A)
- **What**: Transform values from text to rule-clauses wired into gates; personality slow drift via Epigenetics.
- **Archive ref**: §7 — Values/Constitution rules with trigger/priority/strategy; personality trait baseline.
- **DoD**: Out-of-bounds replies intercepted with reason.

#### H/P1-1: Goals / Beliefs (A)
- **What**: New state modules for goals (short/mid/long + commitments + drives) and beliefs (confidence + evidence + update time).
- **Archive ref**: §8 — Goals/Commitments, Beliefs/World Model.
- **DoD**: Cross-session continuity passing.

#### H/P1-2: Memory Forgetting & Compression (A)
- **What**: Decay + interference + compression pipeline. `life.log` never modified.
- **Archive ref**: §9 — Three forgetting mechanisms.
- **DoD**: Capacity controlled; key recall accuracy above threshold.

#### H/P1-3: Relationship First-Class State (A)
- **What**: Externalize relationship state with cooldown/forgetting curves and event binding. People Registry + Relationship State + Relationship Card injection.
- **Archive ref**: §5 — People Registry, Relationship State, Card injection with budget.
- **DoD**: Relationship changes are traceable and explainable.

#### H/P1-4: Persona Package v0.4 (B)
- **What**: Standardize package layout, metadata, migration snapshots, rollback entry, signatures.
- **Archive ref**: §12/§15 — Storage layout, new files with `schemaVersion` + `updatedAt` + rollback.
- **DoD**: Cross-version load stable; migration and rollback work.

#### H/P1-5: Affect 3-Layer State Machine (A) — sync-1 blocker
- **What**: Split affect into mood baseline (slow) / emotion episodes (fast) / temperament influence (trait). Decouple from response rendering.
- **Archive ref**: §6 — Mood (valence/arousal/energy/stress), Emotion Episodes (trigger+label+intensity+evidence+decay), Temperament.
- **Key insight**: "Not knowing why" is a feature — `causeConfidence` can be low, and that's valid.
- **DoD**: Evidence chain for emotion updates; fast/slow update rates separated; affect layer replayable.

#### H/P1-6: Human-Like Imperfection DoD (A)
- **What**: Convert "non-omniscient, non-perfect, allows uncertainty" into testable rules.
- **Archive ref**: §12 — Six imperfection requirements (unsure OK, emotion unnamed OK, detail forgotten OK, etc.).
- **DoD**: Sustained "perfect answer" mode is flagged; safe uncertainty expressions allowed.

#### H/P1-7: Compat Checklist (B)
- **What**: Decompose high-level compat description into engineering checklist (entry, storage, recall, rollback) and wire into CI.
- **Archive ref**: §17 — High-Level compat notes.
- **DoD**: All checklist items pass with evidence paths.

### 7.3 Batch H2 — Validation & Risk Guards (W7–W8)

#### Regression Suites

| Task | What | Key Metrics | Archive Ref |
|------|------|-------------|-------------|
| H/P1-8 | Relationship continuity | Entity hit rate, cross-session identity stability | §18.1 |
| H/P1-9 | Emotional depth | Layer presence, trigger binding, recovery behavior, explainability | §18.2 |
| H/P1-10 | Governance | Gate coverage, budget enforcement, compat pass rate, rollback success | §18.3 |
| H/P1-11 | Observability | (Deferred to Phase I) | §18.4 |

#### Risk Guards

| Task | Risk | Mitigation | Archive Ref |
|------|------|------------|-------------|
| H/P1-12 | Over-numericalization | Limit numeric param exposure; replies stay natural-language dominant | §20.1 |
| H/P1-13 | Relationship noise | Control card injection frequency and weight; noise suppression gate | §20.2 |
| H/P1-14 | Epigenetics backdoors | All updates require evidence + audit trail; no silent personality changes | §20.3 |
| H/P1-15 | Genome trait expansion | MVP stays at 6; new traits require review gate + regression proof | §20.4 |
| H/P1-16 | LLM direct writes | Only `proposal → gates → apply`; direct-write attempts fail and are audited | §20.5 |

#### Schema & Spec

| Task | What | Depends On |
|------|------|-----------|
| H/P1-17 | Appendix examples → schema contracts + version validation | H/P1-4 |
| H/P1-18 | Spec Appendix A (A1–A4): versioned schemas for `engagement_plan`, `interests`, `topic_state`, `proactive_plan` | H/P1-17 |
| H/P1-19 | Spec Appendix B: access-point contract mapping + code anchors (runtime wiring for J/K access points deferred to those phases) | H/P0-0 |

---

## 8. Rollback Strategy

Every task has its own rollback path (detailed in Roadmap). The overarching principle:

| Level | Rollback Action |
|-------|----------------|
| **Per-task** | Each task defines rollback in its Roadmap entry (e.g., "fall back to old mood single-layer") |
| **Per-module** | State modules can be individually disabled by `compatMode=legacy` for that domain |
| **Per-persona** | Any persona can be rolled back from `full` to `legacy` in one step: delete genome.json (auto-defaults on next load), stop state injection, stop `applyDeltas`, preserve trace |
| **Phase-level** | If Phase H cannot stabilize, all personas remain on `legacy` and Phase H changes are feature-flagged off |

---

## 9. Key Risks & Mitigations (Phase-Level)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| State Delta Pipeline too complex to land cleanly | Medium | High | Start with relationship + mood deltas only; add belief/goal/values incrementally |
| Compat migration causes persona identity drift | Medium | Critical | Run shadow mode first (trace-only, no apply); compare before activating |
| Sync-point delays (B blocks A on H/P0-4) | Low | Medium | B prioritizes H/P0-2→3→4 chain; A has independent work (H/P1-0, P1-1, P1-2) to fill wait time |
| Regression suites insufficient coverage | Medium | Medium | Use Archive §18 scenarios as minimum baseline; expand with real conversation logs |
| Schema contracts too rigid for iteration | Low | Low | Version schema from 1.0 with explicit migration strategies; keep legacy adapter layer |

---

## 10. Success Criteria (Phase H "Done" Definition)

Adapted from Archive §21 ("OK Definition") scoped to Phase H deliverables:

1. **State pipeline operational**: Every state mutation flows through `proposal → gates → apply` with zero bypass paths.
2. **Invariants enforced**: CI blocks any commit that violates state thresholds.
3. **Compat proven**: Existing personas load, converse, and persist with measured drift below threshold.
4. **Genome MVP live**: 6 traits producing differentiated persona behavior; derived params clamped.
5. **State modules plugged in**: Values, Personality, Goals, Beliefs, Relationships, Affect, and Memory forgetting are all first-class state with evidence trails.
6. **Imperfection is a feature**: System can express uncertainty, forget details, and have unexplained mood shifts without fabricating or violating safety.
7. **Risk guards active**: All five risk guards (H/P1-12..16) passing in CI.
8. **Schema contracts binding**: Appendix A schemas validate on sample and real data; access-point checklist mapped with code anchors for H-scope points, contract stubs for J/K-scope points.
9. **Regression suites green**: Relationship continuity, emotional depth, and governance suites all above threshold. (Observability regression is Phase I task `I/P1-11`, not a Phase H exit condition.)

---

## 11. What Phase H Does NOT Cover (explicitly out of scope)

These belong to later phases and are not started in Phase H:

| Out of Scope | Belongs To | H/P1-19 Treatment |
|-------------|-----------|-------------------|
| Interest-Attention state closure (topic_state, threads) | Phase J | Contract stub only |
| Proactive Planner contractual enforcement | Phase J | Contract stub only |
| Non-polling conversation loop (human-like turn flow) | Phase J | Contract stub only |
| Engagement Plan + budget gates | Phase J | Contract stub only |
| Engagement Controller access point (Appendix B #1) runtime wiring | Phase J | Contract stub + code anchor, no runtime check |
| Proactive Planner access point (Appendix B #4) runtime wiring | Phase J | Contract stub + code anchor, no runtime check |
| Group Arbitration access point (Appendix B #5) runtime wiring | Phase K | Contract stub + code anchor, no runtime check |
| Multi-persona session graph and arbitration | Phase K | — |
| Performance / observability instrumentation | Phase I | — |
| Observability regression (now `I/P1-11`) | Phase I (after I/P0-2) | Moved out of Phase H |
| Open-source license compliance | Phase I | — |
| Inheritance & lineage (Genome breeding) | Phase I (optional) | — |
