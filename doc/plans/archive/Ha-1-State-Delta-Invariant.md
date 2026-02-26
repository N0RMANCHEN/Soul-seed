# Ha-1 — State Delta Pipeline & Invariant Table

> **Phase**: Ha — State Infrastructure & Compat Foundation  
> **Subplan**: Ha-1 (State Core)  
> **Schedule**: W1 (first half of Ha)  
> **Tasks**: 2 (H/P0-0, H/P0-1)  
> **Execution Strategy**: Strictly serial  
> **Status**: `done`  
> **Parent**: `doc/plans/Ha-State-Infra-Plan.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §10–§11, `01-Spec` §11

---

## 1. Subplan Objective

Implement the core state mutation pathway and CI-enforced thresholds so that all subsequent state modules (Phase Hb) and compat/genome work (Ha-2) can plug in.

1. **H/P0-0**: `proposal → gates → deterministic apply` pipeline — zero direct-write paths.
2. **H/P0-1**: Invariant table for 6 state domains, wired into CI.

---

## 2. Execution Strategy

**Strictly serial.** H/P0-1 depends on H/P0-0 (gate framework, proposal types). Per Roadmap rule 5.1: high coupling + hard risk.

```
H/P0-0 (State Delta Pipeline) → H/P0-1 (Invariant Table)
```

---

## 3. Task Detail

### 3.1 H/P0-0 — State Delta Pipeline (AB co-build)

**Objective**: Implement the core `proposal → gates → deterministic apply` pipeline. All state mutations flow through this path.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Type definitions | `packages/core/src/state_delta.ts` | `StateDeltaProposal`, `DeltaGateResult`, `DeltaCommitResult` |
| Gate runner | `packages/core/src/state_delta_gates.ts` | 7 gates + `runDeltaGates()` |
| Apply engine | `packages/core/src/state_delta_apply.ts` | `applyDeltas()` with atomic writes |
| Protocol update | `packages/core/src/execution_protocol.ts` | Integration after meta-review, before commit |
| Trace extension | `packages/core/src/types.ts` | `DecisionTrace` extended with delta fields |

#### Sub-tasks (from Roadmap)

- [ ] `.1` [AB] Define `StateDeltaProposal` type (type / targetId / patch / confidence / supportingEventHashes / notes)
- [ ] `.2` [A] Implement `applyDeltas()` engine: clamp + rate-limit + evidence-check + compat-check
- [ ] `.3` [B] Implement 7 gate framework (identity / relational / recall / mood / belief / epigenetics / budget) → `01-Spec §11.1`
- [ ] `.4` [A] Wire into turn pipeline: meta-review 之后、commit 之前 → `01-Spec 附录B §3`
- [ ] `.5` [B] Gate reject audit events → life.log + DecisionTrace

#### DoD

- Delta auditable (traceId + evidenceIds), replayable, rejectable.
- Zero direct-write paths remain.
- Gate reject has reason + trace.

#### Rollback

Old path kept in parallel; feature flag `useStateDeltaPipeline` to switch.

---

### 3.2 H/P0-1 — Invariant Table (A)

**Objective**: Codify hard thresholds for Relationship / Beliefs / Mood / Engagement / Proactive / Group Chat. Wire into CI.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Invariant types + checker | `packages/core/src/invariant_table.ts` | Schema, checker, completeness validator |
| Invariant config | `packages/core/config/invariant_table.json` | Initial threshold set |
| Gate integration | `packages/core/src/state_delta_gates.ts` | Gates read thresholds from invariant table |
| CI tests | `packages/core/tests/invariant_table.test.ts` | Breach detection |
| CI lint | `packages/core/tests/invariant_completeness.test.ts` | All domains covered |

#### Sub-tasks (from Roadmap)

- [ ] `.1` [A] Relationship invariants: |Δtrust| ≤ 0.03/turn, audit if ≥ 0.10, evidence ≥ 2 → `03-Engineering §3.1`
- [ ] `.2` [A] Beliefs invariants: cooldown ≥ 7 days, |Δconf| ≤ 0.10, sources bound → `03-Engineering §3.2`
- [ ] `.3` [A] Mood/Affect invariants: baseline regression [0.02, 0.08]/hr, 外显频率门禁 → `03-Engineering §3.3`
- [ ] `.4` [B] Engagement / Proactive / Group Chat invariants → `03-Engineering §3.4-§3.6`
- [ ] `.5` [B] Config-driven invariant engine + CI integration (violation = block)

#### DoD

- Any invariant breach = CI fail.
- Each invariant has domain + actual-vs-threshold audit.

#### Rollback

Thresholds config-driven; revert config. Missing table → permissive defaults.

---

## 4. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Delta pipeline adds >50ms per turn | Medium | High | Pure-function gates (<10ms total); async flush for file I/O |
| R2 | LLM structured output unreliable | High | Medium | Schema validation; parse failure = zero proposals; reply proceeds |
| R3 | Invariant thresholds too strict/loose | Medium | Medium | Config-driven; start loose and tighten based on observed data |

---

## 5. Dependency on Ha-2

Ha-2 (Compat & Genome) depends on Ha-1:

- H/P0-2 (Compat) consumes `applyDeltas()` and gate framework.
- H/P0-1 invariant thresholds inform H/P0-2 drift-detection.

---

## 6. Ha-1 Exit Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| E1 | State Delta Pipeline operational | `runDeltaGates() → applyDeltas()` wired in turn protocol |
| E2 | Zero direct-write paths | CI static analysis |
| E3 | Invariant table green | All domains covered; breach = CI fail |
| E4 | Gate reject trace | Rejection logged with reason |
