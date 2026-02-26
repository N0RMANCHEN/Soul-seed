# Hb-1-1 — Values / Personality & Goals / Beliefs

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-1-1 (Identity & Beliefs)  
> **Parent**: `doc/plans/Hb-Mind-Model-State-Modules.md`  
> **Tasks**: 2 (H/P1-0, H/P1-1)  
> **Execution Strategy**: Serial  
> **Status**: `todo`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §7–§8

---

## 1. Objective

Implement Values/Personality as runnable gate rules and Goals/Beliefs as first-class state modules with slow-update rules.

---

## 2. Task Detail

### 2.1 H/P1-0 — Values / Personality Runnable Constraint System

**Objective**: Transform values from static text into executable rule-clauses wired into gates; personality slow drift via Epigenetics.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| ValuesRule type | `packages/core/src/values_rules.ts` | Rule schema: id, priority, when, then, notes |
| values_rules.json | Persona Package | Seed rules for default persona |
| personality_profile.json | Persona Package | Trait baselines (distinct from Genome) |
| ValuesGate | `packages/core/src/state_delta_gates.ts` | Evaluates rules against proposals + response |
| PersonalityDriftHandler | — | Channels personality changes through Epigenetics gate |

#### Sub-tasks (from Roadmap)

- [ ] Define ValuesRule type and values_rules.json schema
- [ ] Implement ValuesGate (evaluate rules, reject with reason)
- [ ] Implement PersonalityDriftHandler (Epigenetics gate integration)
- [ ] Compat: legacy mode — values gate logs only, doesn't block

#### DoD

- Out-of-bounds replies intercepted with reason.
- Personality stability: 100-turn session with no growth events → profile unchanged.

#### Rollback

Switch to warn-only mode (gate logs violations but does not reject).

---

### 2.2 H/P1-1 — Goals / Beliefs State Module

**Objective**: Add first-class state for goals (direction, commitments, drives) and beliefs (world-model propositions with confidence and evidence).

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| goals.json schema | Persona Package | goals, commitments, drives |
| beliefs.json schema | Persona Package | beliefs with confidence, evidence, cooldown |
| GoalBeliefGate | `packages/core/src/state_delta_gates.ts` | Commitment evidence; belief cooldown; confidence clamp |
| Proposal handlers | State Delta Pipeline | type `"goal"`, type `"belief"` |

#### Sub-tasks (from Roadmap)

- [ ] Define goals.json and beliefs.json schemas
- [ ] Implement GoalBeliefGate
- [ ] Wire proposal handlers into pipeline
- [ ] Context Compile: inject goals/commitments as context cards (budget-constrained)

#### DoD

- Cross-session continuity: goal in session 1 → present in session 2.
- Belief cooldown: rapid update → rejected with reason.
- Commitment lifecycle: create → fulfill with evidence → trace.

#### Rollback

Goals/beliefs become read-only (displayed but not updated).

---

## 3. Execution Order

```
H/P1-0 (Values/Personality) → H/P1-1 (Goals/Beliefs)
```

Both share State Delta Pipeline and Invariant Table. H/P1-1 can reuse gate patterns from H/P1-0.

---

## 4. Storage / Schema Gate (contributing_ai.md §5.3)

- New state files (`values_rules.json`, `personality_profile.json`, `goals.json`, `beliefs.json`) must be registered in `StateDeltaDomain` and `DOMAIN_FILE_MAP` (`state_delta.ts`, `state_delta_apply.ts`).
- Add to `scripts/check_direct_writes.mjs` ALLOWED_FILES if any module writes directly (prefer `state_delta_apply.ts` only).
- Schema changes require `schemaVersion` and migration strategy.

## 5. Integration Points

- State Delta Pipeline (H/P0-0): ValuesGate, GoalBeliefGate in gate chain
- Invariant Table (H/P0-1): personality drift bounds, belief cooldown/shift bounds
- Epigenetics gate (H/P0-4): personality drift proposals

---

## 6. Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Values gate operational | ≥3 rule-violation scenarios passing |
| E2 | Personality drift bounded | Growth event → bounded change + trace |
| E3 | Goals/Beliefs cross-session continuity | Continuity test green |
| E4 | Belief cooldown enforced | Rapid update rejected with reason |
