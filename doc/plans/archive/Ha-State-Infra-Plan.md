# Phase Ha — State Infrastructure & Compat Foundation

> High-Level Execution Plan  
> Date: 2026-02-25  
> Status: `done`（Phase 级，进度以 Roadmap 为准）  
> Progress: 以 `doc/Roadmap.md` 为准（本计划仅描述 scope，不做逐任务快照）  
> Source: `doc/Roadmap.md` (Phase Ha) + `04-Archive.md` §10–§16  
> Scope: 5 tasks (H/P0-0..4), W1–W3  
> Subplans: `Ha-1-State-Delta-Invariant.md`, `Ha-2-Compat-Genome.md`

---

## 1. Phase Objective

Build the **state core** and **compatibility foundation** so that all subsequent state modules (Phase Hb) and governance (Phase Hc) can plug in:

1. **State Delta Pipeline** — All state mutations flow through `proposal → gates → deterministic apply`. No LLM direct writes.
2. **Invariant Table** — CI-enforced thresholds for all state domains.
3. **Compat & Migration** — 2-tier compatMode (legacy/full), auto-default genome for existing personas.
4. **Compat Constants** — Versioned calibration config, trait=0.5 → legacy defaults.
5. **Genome & Epigenetics MVP** — 6 traits, derived params, slow epigenetic drift with evidence gates.

### Entry Conditions

- Phase G fully archived (done).
- Four-layer semantic routing gates operational (done, from Phase F).
- `F/P0-2`, `F/P0-3`, `F/P0-4` exit conditions met.

### Exit Conditions

- `proposal → gates → apply` pipeline operational.
- Invariant CI green.
- Compat migration validated on legacy persona (drift below threshold).
- Genome-derived params online; epigenetics gate enforced.
- Minor version bump triggered per Roadmap rule 1.1 (on Phase Ha completion).

---

## 2. Design Principles (non-negotiable)

| # | Principle | Enforcement |
|---|-----------|-------------|
| 1 | **Add layers, never replace** | Reuse existing memory stack / turn protocol / commit / doctor. New modules plug in as rollback-capable additions. |
| 2 | **LLM only proposes** | `state_delta_proposals → gates → deterministic apply`. No exceptions. |
| 3 | **Audit-first** | Every key state change traces back to `life.log event hash` or `memory ids`. Gate rejections logged with reason. |
| 4 | **Budget-first** | Context injection has hard token/count budgets. Genome-derived params are clamped. |
| 5 | **Compatibility-first** | Existing personas default to `legacy` (genome auto-inferred at 0.5). Prove behavior parity on regression set before `full`. |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Existing Foundation (untouched)                        │
│  - life.log (append-only)                               │
│  - memory.db + hybrid recall                            │
│  - executeTurnProtocol / meta_review / commit           │
│  - doctor / consistency guards                          │
│  - 4-layer semantic routing gates (Phase F)             │
└──────────────────────┬──────────────────────────────────┘
                       │ Phase Ha adds ↓
┌──────────────────────▼──────────────────────────────────┐
│  Ha-1: State Delta Pipeline (H/P0-0)                    │
│  proposal → gates → deterministic apply → trace         │
├─────────────────────────────────────────────────────────┤
│  Ha-1: Invariant Table (H/P0-1)                         │
│  CI-enforced thresholds for all state domains           │
├─────────────────────────────────────────────────────────┤
│  Ha-2: Compat & Migration (H/P0-2..3)                   │
│  2-tier compatMode: legacy / full (no hybrid)           │
│  Legacy = default genome (0.5) → same behavior           │
├─────────────────────────────────────────────────────────┤
│  Ha-2: Genome & Epigenetics (H/P0-4)                   │
│  6 traits → derived budgets/params                       │
│  Slow epigenetic drift with evidence gates              │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Task Grouping & Subplans

### Execution Strategy

**Strictly serial.** Per Roadmap rule 5.1: high coupling + hard risk = one task at a time, verified before proceeding.

| Subplan | Tasks | Owner | Description |
|---------|-------|-------|-------------|
| **Ha-1** | H/P0-0, H/P0-1 | AB共建, A | State Delta Pipeline + Invariant Table |
| **Ha-2** | H/P0-2, H/P0-3, H/P0-4 | B | Compat & Migration + Constants + Genome MVP |

**Execution order**: `H/P0-0 → H/P0-1 → H/P0-2 → H/P0-3 → H/P0-4`

### Dependency Graph

```
H/P0-0 (State Delta Pipeline)
  └──→ H/P0-1 (Invariant Table)
         └──→ H/P0-2 (Compat & Migration)
                └──→ H/P0-3 (Compat Constants)
                       └──→ H/P0-4 (Genome & Epigenetics MVP)
```

---

## 5. Division of Labor (A / B)

| Person A | Person B |
|----------|----------|
| **H/P0-0 AB共建** State Delta Pipeline | **H/P0-0 AB共建** |
| H/P0-1 Invariant Table | H/P0-2 Compat & Migration |
| | H/P0-3 Compat Constants |
| | H/P0-4 Genome & Epigenetics |

- **Sync point (B→A)**: H/P0-4 depends on H/P0-2 + H/P0-3.

---

## 6. Subplan Index

| File | Scope | Tasks |
|------|-------|-------|
| `Ha-1-State-Delta-Invariant.md` | State core | H/P0-0, H/P0-1 |
| `Ha-2-Compat-Genome.md` | Compat + Genome | H/P0-2, H/P0-3, H/P0-4 |

---

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Delta pipeline overhead too high (per-turn latency) | Medium | High | Profile at each step; gate evaluation is pure functions (<10ms); `applyDeltas()` uses write-ahead + async flush |
| R2 | LLM doesn't reliably produce structured delta proposals | High | Medium | Strict JSON schema; parse failure = zero proposals (reply still proceeds); iterative prompt tuning |
| R3 | Compat migration causes subtle persona identity drift | Medium | Critical | Shadow mode first (trace-only, no apply); compare over 50+ turns before activating |
| R4 | Gate thresholds too strict (system feels "frozen") | Medium | Medium | Start loose, tighten gradually; all thresholds config-driven |
| R5 | Gate thresholds too loose (drift defeats purpose) | Medium | High | Pair with regression tests over 100-turn sequences; invariant table CI |
| R6 | Epigenetics accumulates invisible personality changes | Medium | High | Multi-evidence + cooldown + bounded + audit trail; risk guard H/P1-14 in Phase Hc |

> **Archive §16 reconciliation**: Archive defines 3-tier compat (`legacy/hybrid/full`). Roadmap simplifies to 2-tier (`legacy/full`) because default genome at trait=0.5 produces identical derived params to current hardcoded constants, making `hybrid` unnecessary. This is an intentional Roadmap override; Archive §16 is treated as historical reference for Ha scope.

---

## 8. Phase Ha Exit Criteria

| # | Criterion | Verification |
|---|-----------|---------------|
| E1 | State Delta Pipeline operational | `executeTurnProtocol` invokes `runDeltaGates() → applyDeltas()` on every turn. Trace includes `DeltaCommitResult`. |
| E2 | Zero direct-write paths | CI static analysis: no state file writes outside `state_delta_apply.ts`. |
| E3 | Invariant table green in CI | All required domains covered; threshold breach = CI failure. |
| E4 | Compat auto-default proven | Legacy persona without `genome.json` → auto-default genome → derived params match legacy constants. |
| E5 | Compat constants complete | Versioned calibration; trait=0.5 → legacy defaults;缺项 lint fail. |
| E6 | Genome MVP live | 6 traits, derived params clamped, epigenetics gate enforced, randomness reproducible. |

---

## 9. Rollback Strategy

| Level | Rollback Action |
|-------|-----------------|
| **Per-task** | Each task defines rollback in Roadmap entry |
| **Per-persona** | Disable state injection + applyDeltas; delete genome.json → auto-defaults on next load; preserve all traces for replay |
| **Phase-level** | Feature-flag off; personas remain on legacy; all traces preserved |

---

## 10. What Phase Ha Does NOT Cover

- State modules (Values, Personality, Goals, Beliefs, Memory, Relationships, Affect) → Phase Hb
- Regression suites, risk guards, schema contracts → Phase Hc
- Interest-Attention, Proactive Planner, Engagement Plan → Phase J
- Multi-persona session graph → Phase K
