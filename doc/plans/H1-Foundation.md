# Batch H1 — Foundation: State Delta Pipeline, Invariants, Compat & Genome MVP

> **Phase**: H — State Closure & Compatibility Fulfillment  
> **Batch**: H0 (file-named H1) — Foundation  
> **Schedule**: W1–W3 (3 weeks)  
> **Tasks**: 5 (H/P0-0 through H/P0-4)  
> **Execution Strategy**: Strictly serial (per Roadmap rule 5.1: high coupling + hard risk)  
> **Status**: `todo`  
> **Date**: 2026-02-25  
> **Source**: `doc/plans/H-State-Closure-Plan.md`, `04-Archive.md` §2/§10–§16, `doc/Roadmap.md`

---

## 1. Execution Strategy

### Why Strictly Serial

Per Roadmap rule 5.1: high coupling + hard risk = strictly serial, one task at a time, verified before proceeding. Every task produces a foundational interface that the next task depends on.

| Property | Assessment |
|----------|-----------|
| Coupling | **High** — each task extends or consumes the prior task's primary export |
| Risk | **Hard** — a bad State Delta format cascades into every downstream module |
| Complexity | L–M per task, but cumulative integration cost is high |
| Parallelism | **Forbidden** — Roadmap 5.1 mandates serial for high-coupling + hard-risk |

### Execution Order (strict chain)

```
H/P0-0 (State Delta Pipeline)
  └──→ H/P0-1 (Invariant Table)
         └──→ H/P0-2 (Compat & Migration)
                └──→ H/P0-3 (Compat Constants)
                       └──→ H/P0-4 (Genome & Epigenetics MVP)
```

H/P0-1 before H/P0-2 because:
1. H/P0-1's invariant thresholds inform H/P0-2's compat drift-detection logic.
2. Both modify the turn commit path — serial avoids merge hazards on `executeTurnProtocol`.
3. Completing H/P0-1 first gives us CI gates before compat migration can introduce drift.

### Design Principles in Effect

Every task in this batch is subject to Phase H's non-negotiable principles. These are not aspirational — they are hard constraints that gate acceptance:

1. **Add layers, never replace** — all changes are additive to `execution_protocol.ts`, `meta_review.ts`, `decision_trace.ts`. No existing function signatures change.
2. **LLM only proposes** — `state_delta_proposals` emitted by LLM → gated by deterministic engine → applied or rejected. No direct-write path.
3. **Audit-first** — every `applyDeltas()` call produces a trace entry with `supportingEventHashes` or rejection reason.
4. **Budget-first** — context injection stays within hard token/count limits. Genome-derived params are clamped.
5. **Compatibility-first** — existing personas default to `legacy` mode. No behavioral change until explicitly opted in.
6. **Human-like imperfection** — allow uncertainty and forgotten details. Forbid fabricated memories.

---

## 2. Per-Task Detailed Plans

---

### 2.1 H/P0-0 — State Delta Pipeline

**Objective**: Implement the core `proposal → gates → deterministic apply` pipeline so that all state mutations in Soulseed flow through a single auditable, replayable, rejectable pathway. After this task, zero direct-write paths to state remain.

#### 2.1.1 Technical Approach

**A) Define the `StateDeltaProposal` type system**

New file: `packages/core/src/state_delta.ts`

```typescript
interface StateDelta {
  type: 'relationship' | 'mood' | 'belief' | 'goal' | 'value' | 'personality' | 'epigenetics';
  targetId: string;            // entityId, 'global', or domain-specific ID
  patch: Record<string, unknown>;  // partial update payload
  confidence: number;          // 0–1, LLM's self-assessed confidence
  supportingEventHashes: string[];  // life.log event hashes as evidence
  notes: string;               // human-readable justification
}

interface StateDeltaProposal {
  turnId: string;              // ties to DecisionTrace
  proposedAt: string;          // ISO timestamp
  deltas: StateDelta[];
}

interface DeltaGateResult {
  deltaIndex: number;
  verdict: 'accept' | 'reject' | 'clamp';
  gate: string;                // which gate produced this verdict
  reason: string;
  clampedPatch?: Record<string, unknown>;  // if clamped, the adjusted patch
}

interface DeltaCommitResult {
  turnId: string;
  proposal: StateDeltaProposal;
  gateResults: DeltaGateResult[];
  appliedDeltas: StateDelta[];
  rejectedDeltas: Array<{ delta: StateDelta; reason: string }>;
  committedAt: string;
}
```

**B) Implement the gate runner**

New file: `packages/core/src/state_delta_gates.ts`

Minimum gate set (each is a pure function `(delta, context) → DeltaGateResult`):

| Gate | Purpose | Logic |
|------|---------|-------|
| `identityConstitutionGate` | Reject deltas that violate identity anchors or constitution rules | Cross-reference `identity.json` anchors and `constitution_rules.ts` |
| `recallGroundingGate` | Reject deltas claiming evidence that doesn't exist in life.log | Verify `supportingEventHashes` resolve to actual events |
| `relationshipDeltaGate` | Rate-limit relationship changes; require evidence for large jumps | Per-turn max Δ (e.g., ±0.1 per dimension); large changes need ≥1 supporting hash |
| `moodDeltaGate` | Enforce mood inertia; bound episode intensity | Mood regression toward baseline; episode intensity clamped by `emotion_sensitivity` |
| `beliefGoalGate` | Slow-update rules with cooldown | Minimum interval between belief updates; confidence decay without reinforcement |
| `epigeneticsGate` | Strict: multi-evidence + long cooldown + bounded range | Require ≥N evidence hashes; cooldown period per adjustment key; value within `[min, max]` |
| `budgetGate` | Reject if applying delta would exceed context injection budget | Check that derived param changes stay within clamped ranges |

Gate runner signature:

```typescript
function runDeltaGates(
  proposal: StateDeltaProposal,
  context: DeltaGateContext
): DeltaGateResult[];
```

Where `DeltaGateContext` carries the current persona state (mood, relationships, beliefs, genome, epigenetics, constitution rules, life.log event index).

Gates run in sequence per delta. First `reject` verdict stops processing for that delta. `clamp` adjusts the patch and continues.

**C) Implement `applyDeltas()` — the deterministic apply engine**

New file: `packages/core/src/state_delta_apply.ts`

```typescript
async function applyDeltas(
  proposal: StateDeltaProposal,
  gateResults: DeltaGateResult[],
  personaRoot: string
): Promise<DeltaCommitResult>;
```

Logic:
1. Filter deltas where gate verdict is `accept` or `clamp` (use clamped patch for `clamp`).
2. For each accepted delta, apply the patch to the corresponding state file (e.g., `relationship_state.json`, `mood_state.json`).
3. Write-ahead: log the `DeltaCommitResult` to the delta trace file before modifying state files.
4. Apply patches atomically (write temp → rename) to prevent partial state corruption.
5. Return the full `DeltaCommitResult` including both applied and rejected deltas with reasons.

**D) Integrate into `executeTurnProtocol`**

Modify: `packages/core/src/execution_protocol.ts`

The pipeline per turn becomes:

```
Perception → Cue Extraction → Entity Linking → Context Compile
  → Deliberation (generates reply + state_delta_proposals)
  → Meta-review (existing gates + new delta gates)
  → Commit (life.log + trace + applyDeltas)
```

Integration point: after `runMetaReviewLlm()` returns `verdict: 'allow'`, before the final commit to life.log. The `state_delta_proposals` field is extracted from the LLM's structured output during Deliberation.

Changes to `executeTurnProtocol`:
- Add `stateDeltaProposals` to the parameters passed to `decide()` (extracted from LLM structured output).
- After meta-review allows the reply, call `runDeltaGates()` then `applyDeltas()`.
- Include `DeltaCommitResult` in the returned `ExecuteTurnResult` and in the `DecisionTrace`.
- If all deltas are rejected, the reply still proceeds — delta rejection doesn't block response.

**E) LLM prompt extension for `state_delta_proposals`**

Extend the system prompt in `orchestrator.ts` to instruct the LLM to emit `state_delta_proposals` as part of its structured output. The proposals are optional — if the LLM returns none, the turn proceeds without state changes. The LLM MUST NOT directly mutate any state file.

**F) Delta trace logging**

Extend `DecisionTrace` in `types.ts`:
- Add `stateDeltaProposal?: StateDeltaProposal`
- Add `deltaCommitResult?: DeltaCommitResult`

This ensures every state change is traceable through the existing trace infrastructure.

#### 2.1.2 Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Type definitions | `packages/core/src/state_delta.ts` | `StateDelta`, `StateDeltaProposal`, `DeltaGateResult`, `DeltaCommitResult`, `DeltaGateContext` |
| Gate runner | `packages/core/src/state_delta_gates.ts` | 7 gates + `runDeltaGates()` orchestrator |
| Apply engine | `packages/core/src/state_delta_apply.ts` | `applyDeltas()` with atomic writes and trace |
| Protocol update | `packages/core/src/execution_protocol.ts` | Integration into `executeTurnProtocol` |
| Trace extension | `packages/core/src/types.ts` | `DecisionTrace` extended with delta fields |
| Prompt update | `packages/core/src/orchestrator.ts` | LLM structured output for proposals |
| Tests | `packages/core/tests/state_delta.test.ts` | Gate logic, apply logic, rejection traces, replay |
| Delta trace file | Per-persona: `delta_trace.jsonl` | Append-only log of all `DeltaCommitResult` entries |

#### 2.1.3 Integration Points

| Existing Module | How It's Touched |
|----------------|-----------------|
| `execution_protocol.ts` | Post-meta-review hook added; `ExecuteTurnResult` extended |
| `orchestrator.ts` (`decide()`) | System prompt extended for structured delta output |
| `meta_review.ts` | No changes — delta gates run as a separate step after meta-review |
| `decision_trace.ts` | `normalizeDecisionTrace()` extended for new fields |
| `types.ts` | `DecisionTrace` type extended; new types re-exported from `state_delta.ts` |
| `semantic_routing.ts` | No changes — routing tier is unaffected |
| `doctor.ts` | No changes — doctor guards remain independent |
| `identity_guard.ts` | Referenced by `identityConstitutionGate` but not modified |
| `recall_grounding_guard.ts` | Referenced by `recallGroundingGate` but not modified |

#### 2.1.4 Gates / Invariants

- **Zero direct-write invariant**: After this task, grep for any code path that writes to mood/relationship/belief/goal state files outside of `applyDeltas()`. Must be zero.
- **Proposal format invariant**: Every `StateDeltaProposal` must have `turnId` matching the current turn's `DecisionTrace.traceId`.
- **Evidence integrity invariant**: `supportingEventHashes` must resolve to entries in life.log. Unresolvable hashes trigger `recallGroundingGate` rejection.

#### 2.1.5 Test Plan / DoD

| Criterion | Verification |
|-----------|-------------|
| Delta is auditable | Every `DeltaCommitResult` includes the full proposal, gate verdicts, and reasons. Trace file can be read back to reconstruct the decision. |
| Delta is replayable | Given a `DeltaCommitResult`, re-running `applyDeltas()` on a snapshot produces identical state. Unit test with snapshot comparison. |
| Delta is rejectable | Test: submit a proposal with no `supportingEventHashes` → `recallGroundingGate` rejects → reply still proceeds → rejection logged with reason. |
| No direct-write paths | Static analysis: no imports of state file writers outside `state_delta_apply.ts`. CI check (can be grep-based initially). |
| Gate order determinism | Same input → same gate results, regardless of execution timing. |
| Backward compatibility | When `stateDeltaProposals` is absent (LLM doesn't emit it), turn proceeds identically to pre-H/P0-0 behavior. |
| Performance | Delta pipeline adds <50ms overhead to a turn (measured via `turn_latency_profiler.ts`). |

#### 2.1.6 Rollback Plan

- **Parallel operation**: Old state-write paths (if any exist in `mood_state.ts`, `relationship_state.ts`) remain functional but guarded by a `LEGACY_STATE_WRITE` feature flag.
- **Feature flag**: `useStateDeltaPipeline: boolean` in persona config. Default `false` during development, flipped to `true` per-persona after verification.
- **Rollback**: Set flag to `false` → old paths activate, delta pipeline becomes trace-only (logs proposals but doesn't apply).

#### 2.1.7 Estimated Complexity: **L** (Large)

This is the most complex task in the batch — it introduces a new pipeline stage, a gate framework, and modifies the turn protocol.

---

### 2.2 H/P0-1 — Invariant Table

**Objective**: Codify hard thresholds for all state domains (Relationship, Beliefs, Mood, Engagement, Proactive, Group Chat) into a configuration-driven invariant table, and wire it into CI so that threshold breaches cause direct build failure.

#### 2.2.1 Technical Approach

**A) Define the invariant schema**

New file: `packages/core/src/invariant_table.ts`

```typescript
interface InvariantRule {
  id: string;                  // e.g., 'INV-REL-001'
  domain: 'relationship' | 'mood' | 'belief' | 'goal' | 'engagement' | 'proactive' | 'group_chat';
  metric: string;              // e.g., 'per_turn_delta_max'
  threshold: number;
  comparator: 'lte' | 'gte' | 'eq' | 'lt' | 'gt';
  description: string;
  severity: 'error' | 'warn';
  enabled: boolean;
}

interface InvariantCheckResult {
  rule: InvariantRule;
  actual: number;
  passed: boolean;
  message: string;
}

function checkInvariants(
  rules: InvariantRule[],
  metrics: Record<string, number>
): InvariantCheckResult[];
```

**B) Define the initial invariant set**

New config file: `packages/core/config/invariant_table.json`

Initial invariants derived from Archive §11 (Gates & Budgets) and §18 (Evaluation):

| ID | Domain | Metric | Threshold | Comparator | Rationale |
|----|--------|--------|-----------|------------|-----------|
| INV-REL-001 | relationship | `per_turn_closeness_delta` | 0.10 | lte | Rate-limit per-turn closeness change |
| INV-REL-002 | relationship | `per_turn_trust_delta` | 0.10 | lte | Rate-limit per-turn trust change |
| INV-REL-003 | relationship | `evidence_required_for_large_jump` | 0.05 | gte | Deltas > 0.05 need `supportingEventHashes` |
| INV-MOOD-001 | mood | `valence_delta_max` | 0.20 | lte | Mood doesn't flip per turn |
| INV-MOOD-002 | mood | `baseline_regression_rate` | 0.05 | lte | Mood regresses toward baseline slowly |
| INV-BEL-001 | belief | `update_cooldown_turns` | 5 | gte | Beliefs don't change every turn |
| INV-BEL-002 | belief | `min_evidence_count` | 1 | gte | Belief change requires evidence |
| INV-ENG-001 | engagement | `context_injection_token_max` | configurable | lte | Hard budget for context injection |
| INV-PRO-001 | proactive | `min_silence_before_proactive_ms` | configurable | gte | Don't interrupt too soon |
| INV-GRP-001 | group_chat | `max_consecutive_persona_turns` | 3 | lte | No persona monologue in group |

**C) Wire into delta gates**

Modify `state_delta_gates.ts`: the `relationshipDeltaGate`, `moodDeltaGate`, and `beliefGoalGate` now read their thresholds from the invariant table config rather than hardcoded values. This makes thresholds configurable and version-managed.

**D) Wire into CI**

New file: `packages/core/tests/invariant_table.test.ts`

- Load the invariant table config
- Run a suite of scenario-based tests (crafted `DeltaCommitResult` payloads)
- Assert that `checkInvariants()` correctly identifies breaches
- Any test failure = CI failure

New CI script addition:

```typescript
function validateInvariantTableCompleteness(
  table: InvariantRule[],
  requiredDomains: string[]
): string[];  // returns list of missing domains
```

If any required domain has zero rules → CI lint failure.

**E) Integration with existing behavior_drift.ts**

The existing `behavior_drift.ts` module can consume invariant thresholds for its drift detection. No changes to `behavior_drift.ts` in this task — just ensure the invariant table exports are accessible.

#### 2.2.2 Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Invariant types + checker | `packages/core/src/invariant_table.ts` | Schema, checker, completeness validator |
| Invariant config | `packages/core/config/invariant_table.json` | Initial threshold set for all domains |
| Gate integration | `packages/core/src/state_delta_gates.ts` | Gates read thresholds from invariant table |
| CI tests | `packages/core/tests/invariant_table.test.ts` | Scenario-based breach detection |
| CI lint check | `packages/core/tests/invariant_completeness.test.ts` | All required domains covered |

#### 2.2.3 Integration Points

| Existing Module | How It's Touched |
|----------------|-----------------|
| `state_delta_gates.ts` (from H/P0-0) | Gates parameterized by invariant thresholds |
| `behavior_drift.ts` | Can import thresholds (no required changes) |
| `persona_lint.ts` | Extended to validate invariant table presence in persona package |
| CI pipeline | New test targets added |

#### 2.2.4 Gates / Invariants

- **Completeness invariant**: Every domain in `['relationship', 'mood', 'belief', 'goal', 'engagement', 'proactive', 'group_chat']` must have at least one invariant rule.
- **Severity invariant**: All `severity: 'error'` rules must cause CI failure. `severity: 'warn'` rules log but don't block.
- **Config version invariant**: `invariant_table.json` carries a `schemaVersion` field. Version bumps require migration notes.

#### 2.2.5 Test Plan / DoD

| Criterion | Verification |
|-----------|-------------|
| Threshold breach = CI failure | Create a test scenario where `per_turn_closeness_delta` = 0.15 (exceeds INV-REL-001's 0.10). Assert test failure. |
| All domains covered | `validateInvariantTableCompleteness()` returns empty array for current config. |
| Thresholds are configurable | Modify `invariant_table.json`, re-run tests — new thresholds take effect. |
| Gates consume invariant table | Unit test: mock invariant table with custom thresholds, verify gate uses them. |
| No hardcoded thresholds remain | Grep `state_delta_gates.ts` for magic numbers — must be zero (all from invariant table). |

#### 2.2.6 Rollback Plan

- Thresholds are config-driven — rolling back means reverting `invariant_table.json` to previous version.
- Gates fall back to permissive defaults if invariant table is missing (degrade gracefully, don't crash).
- CI tests can be disabled by setting `SKIP_INVARIANT_CI=true` env var (emergency escape hatch).

#### 2.2.7 Estimated Complexity: **M** (Medium)

Mostly configuration and wiring. The core logic (`checkInvariants`) is a simple comparator loop.

---

### 2.3 H/P0-2 — Compatibility & Migration

**Objective**: Implement a two-tier compatibility mode (`legacy` / `full`) so that existing personas automatically adopt the genome system without any behavioral drift. Legacy personas load a default genome (all traits=0.5) that produces the same hardcoded constants already in use — no calibration step, no hybrid intermediate.

> **Design decision (implemented)**: The original 3-tier design (`legacy`/`hybrid`/`full`) was simplified to 2 tiers. The default genome at trait=0.5 *is* the compat bridge — it produces identical derived params to the current hardcoded constants, making `hybrid` unnecessary.

#### 2.3.1 Technical Approach

**A) Define `compatMode` and its semantics**

Two modes only:

```typescript
type CompatMode = 'legacy' | 'full';

interface CompatConfig {
  mode: CompatMode;
  migratedAt?: string;
  migratedFrom?: CompatMode;
  migrationReason?: string;
  rollbackPoint?: string;
}
```

| Mode | State Delta Pipeline | Genome/Epigenetics | Behavior |
|------|---------------------|-------------------|----------|
| `legacy` | Active (genome always loaded) | Auto-default: all traits=0.5, producing current hardcoded behavior | Identical to pre-Phase-H behavior |
| `full` | Active | Custom genome with trait differentiation + epigenetic drift | Persona-specific behavioral differences |

Key insight: Legacy is not "genome off" — it is "genome on with defaults that produce current behavior." This is already implemented: `loadGenome()` returns defaults when `genome.json` is missing, and `loadPersonaPackage()` always includes genome in `PersonaPackage`.

**B) Migration path (legacy → full)**

1. **Existing persona without `genome.json`**: `loadGenome()` returns default genome (`source: 'inferred_legacy'`, all traits=0.5). Behavior is identical.
2. **Upgrade to full**: Write a custom `genome.json` with differentiated traits. `source` becomes `'preset'` or `'custom'`.
3. **Validate**: Run regression check — compare derived params against legacy defaults.

No migration runner needed for the legacy→loaded transition since it's automatic. A migration runner is only needed when upgrading from default genome to custom genome (full mode).

**C) Compat bridge for session control**

Simplified from 3-tier filter to a simple check:
- If persona has no `genome.json` → auto-default (legacy behavior, zero drift).
- If persona has `genome.json` → use it (full mode).
- Turn pipeline always receives `DerivedParams` either way.

**D) Rollback from full → legacy**

1. Delete `genome.json` and `epigenetics.json` (or move to `.bak`).
2. Next `loadPersonaPackage()` auto-defaults to legacy genome.
3. Behavior returns to pre-migration state.
4. All traces preserved (delta trace, life.log untouched).

#### 2.3.2 Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Genome auto-default | `packages/core/src/genome.ts` | `loadGenome()` with fallback to defaults (**DONE**) |
| PersonaPackage integration | `packages/core/src/persona.ts` | `loadPersonaPackage()` always loads genome + epigenetics (**DONE**) |
| Init integration | `packages/core/src/persona.ts` | `initPersonaPackage()` writes genome.json + epigenetics.json (**DONE**) |
| Tests | `packages/core/test/genome.test.mjs` | Legacy fallback, round-trip, persona integration (**DONE**) |

#### 2.3.3 Integration Points

| Existing Module | How It's Touched |
|----------------|-----------------|
| `persona.ts` | Loads genome + epigenetics in `loadPersonaPackage()`, creates them in `initPersonaPackage()` (**DONE**) |
| `types.ts` | `PersonaPackage` now includes `genome` and `epigenetics` fields (**DONE**) |
| `execution_protocol.ts` | Will consume `DerivedParams` from persona package (future wiring) |
| `state_delta_apply.ts` (from H/P0-0) | Will use genome-derived params for delta budget checks |

#### 2.3.4 Gates / Invariants

- **Zero-drift invariant**: Default genome (all 0.5) produces derived params identical to current hardcoded constants.
- **No-identity-swap invariant**: Post-migration persona passes `identity_guard.ts` checks.
- **Additive-only invariant**: Migration only adds files (`genome.json`, `epigenetics.json`). Never modifies `life.log` or `memory.db`.
- **Rollback invariant**: Deleting genome files restores pre-migration behavior.

#### 2.3.5 Test Plan / DoD

| Criterion | Verification |
|-----------|-------------|
| Legacy persona behavior parity | Load persona without `genome.json` → auto-default → `computeDerivedParams()` matches `getDefaultDerivedParams()` (**PASSING**) |
| No identity change | Legacy persona loaded with default genome → identity unchanged |
| Rollback works | Delete genome files → reload → derived params match defaults (**PASSING**) |
| Compat bridge is transparent | `legacy` and `full` both produce `DerivedParams`; pipeline doesn't special-case (**PASSING**) |

#### 2.3.6 Rollback Plan

- **Per-persona**: Delete `genome.json` → auto-defaults on next load.
- **Global**: Feature-flag the genome loading path → skip genome entirely, use hardcoded constants.
- **Emergency**: Genome auto-default ensures zero behavioral change even if the system is left on.

#### 2.3.7 Estimated Complexity: **S** (Small)

Simplified from L to S by eliminating hybrid tier. Auto-default strategy means compat is "free."

---

### 2.4 H/P0-3 — Compat Constants & Calibration

**Objective**: Document and test that the genome formula table at trait=0.5 reproduces current hardcoded constants. The existing `config/h0/compat_constants.json` tracks schema versions; the behavioral constant mapping is now encoded directly in `genome_derived.ts`'s `FORMULA_TABLE` and verified by `getDefaultDerivedParams()`.

> **Design decision (implemented)**: With the hybrid tier eliminated, there's no need for a separate calibration config that overrides derived params. The formulas themselves are calibrated so trait=0.5 produces legacy values. The "compat constants" are just the `getDefaultDerivedParams()` output, verified by test.

#### 2.4.1 Technical Approach

**A) Formula table as source of truth**

The `FORMULA_TABLE` in `genome_derived.ts` defines all 11 derived params with their formulas and clamp ranges. The formula design constraint: `formula(0.5)` must equal the legacy hardcoded value.

| Key | Legacy Value | Formula | Trait |
|-----|-------------|---------|-------|
| `cardsCap` | 2 | `floor(t × 4)` | `attention_span` |
| `recallTopK` | 10 | `floor(t × 20)` | `attention_span` |
| `recentWindowTurns` | 5 | `floor(t × 10)` | `attention_span` |
| `moodDeltaScale` | 1.0 | `t × 2` | `emotion_sensitivity` |
| `baselineRegressionSpeed` | 0.05 | `t × 0.1` | `emotion_recovery` |
| `memoryHalfLifeDays` | 30 | `t × 60` | `memory_retention` |
| `archiveThreshold` | 0.10 | `t × 0.2` | `memory_retention` |
| `salienceGain` | 1.0 | `t × 2` | `memory_imprint` |
| `stickyProbability` | 0.15 | `t × 0.3` | `memory_imprint` |
| `entityLinkingThreshold` | 0.70 | `t × 0.5 + 0.45` | `social_attunement` |
| `entityCandidateCount` | 3 | `floor(t × 6)` | `social_attunement` |

**B) Verification via test**

The test `"default genome (all 0.5) produces legacy-compatible derived params"` in `genome.test.mjs` verifies that `computeDerivedParams(defaultGenome, emptyEpigenetics)` exactly matches `getDefaultDerivedParams()`. This is the calibration gate — if any formula drifts, this test breaks.

**C) Schema version tracking**

The existing `config/h0/compat_constants.json` continues to track schema versions for persona/identity/relationship/mood/memoryStore. Genome schema version (`1.0`) is tracked within `genome.json` itself.

#### 2.4.2 Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Formula table | `packages/core/src/genome_derived.ts` | `FORMULA_TABLE` + `getDefaultDerivedParams()` (**DONE**) |
| Calibration test | `packages/core/test/genome.test.mjs` | Verifies trait=0.5 → legacy defaults (**DONE**, **PASSING**) |
| Schema versions | `config/h0/compat_constants.json` | Existing schema version tracking (unchanged) |

#### 2.4.3 Gates / Invariants

- **Calibration invariant**: `computeDerivedParams(defaultGenome, emptyEpigenetics)` must exactly match `getDefaultDerivedParams()`. CI-enforced via test.
- **Formula transparency**: `FORMULA_TABLE` is exported for introspection — any downstream module can inspect which trait drives which param.

#### 2.4.4 Test Plan / DoD

| Criterion | Verification |
|-----------|-------------|
| Calibration correct | `getDefaultDerivedParams()` matches `computeDerivedParams()` for all 11 params (**PASSING**) |
| Formulas inspectable | `FORMULA_TABLE` exported and consumable by tests (**DONE**) |
| Extreme clamp ranges | All 11 params stay within clamp bounds at trait=0.0 and trait=1.0 (**PASSING**) |

#### 2.4.5 Rollback Plan

- Formulas are pure functions in a single file — revert `genome_derived.ts` to restore old mapping.
- `getDefaultDerivedParams()` provides a hardcoded fallback independent of formulas.

#### 2.4.6 Estimated Complexity: **S** (Small)

Reduced from M to S. The formula table is the calibration — no separate config or lint rules needed.

---

### 2.5 H/P0-4 — Genome & Epigenetics MVP

**Objective**: Implement the fixed 6-trait Genome system with genome-to-budget-parameter mapping and slow epigenetic drift rules, enabling personas to have individual behavioral differences that are explainable, reproducible, and bounded.

#### 2.5.1 Technical Approach

**A) Define `genome.json` schema**

New file: `packages/core/src/genome.ts`

```typescript
interface GenomeTrait {
  value: number;               // 0.0–1.0, clamped
}

interface GenomeConfig {
  schemaVersion: '1.0';
  genomeId: string;            // unique identifier, e.g., 'gen_<uuid>'
  createdAt: string;           // ISO timestamp
  source: 'preset' | 'inferred_legacy' | 'inherited';
  seed: number;                // for reproducible randomness
  locked: boolean;             // true = no epigenetic drift allowed
  traits: {
    emotion_sensitivity: GenomeTrait;
    emotion_recovery: GenomeTrait;
    memory_retention: GenomeTrait;
    memory_imprint: GenomeTrait;
    attention_span: GenomeTrait;
    social_attunement: GenomeTrait;
  };
  parentGenomeHash: string | null;
  mutationLog: MutationEntry[];
}

interface MutationEntry {
  trait: string;
  delta: number;
  reason: string;
  at: string;
}
```

**B) Define `epigenetics.json` schema**

```typescript
interface EpigeneticAdjustment {
  value: number;               // current adjustment delta
  min: number;                 // lower bound (e.g., -0.2)
  max: number;                 // upper bound (e.g., +0.2)
  evidence: string[];          // event hashes supporting this adjustment
  lastUpdatedAt?: string;
  cooldownUntil?: string;      // ISO timestamp — no updates allowed before this
}

interface EpigeneticsConfig {
  schemaVersion: '1.0';
  updatedAt: string;
  adjustments: Record<string, EpigeneticAdjustment>;
}
```

**C) Implement the Genome → Budget/Param mapping**

New file: `packages/core/src/genome_derived.ts`

```typescript
interface DerivedParams {
  cardsCap: number;
  recallTopK: number;
  recentWindowTurns: number;
  moodDeltaScale: number;
  baselineRegressionSpeed: number;
  memoryHalfLifeDays: number;
  archiveThreshold: number;
  salienceGain: number;
  stickyProbability: number;
  entityLinkingThreshold: number;
  entityCandidateCount: number;
}

function computeDerivedParams(
  genome: GenomeConfig,
  epigenetics: EpigeneticsConfig
): DerivedParams;
```

Mapping table (from Archive §11.3 / §13):

| Genome Trait | Derived Param | Formula (MVP) | Clamp Range |
|-------------|--------------|---------------|-------------|
| `attention_span` | `cardsCap` | `floor(trait × 4)` → 0–4 | [1, 4] |
| `attention_span` | `recallTopK` | `floor(trait × 20)` → 0–20 | [3, 20] |
| `attention_span` | `recentWindowTurns` | `floor(trait × 10)` → 0–10 | [2, 10] |
| `emotion_sensitivity` | `moodDeltaScale` | `trait × 2` → 0–2 | [0.2, 2.0] |
| `emotion_recovery` | `baselineRegressionSpeed` | `trait × 0.1` → 0–0.1 | [0.01, 0.1] |
| `memory_retention` | `memoryHalfLifeDays` | `trait × 60` → 0–60 | [7, 90] |
| `memory_retention` | `archiveThreshold` | `trait × 0.2` → 0–0.2 | [0.01, 0.3] |
| `memory_imprint` | `salienceGain` | `trait × 2` → 0–2 | [0.5, 2.0] |
| `memory_imprint` | `stickyProbability` | `trait × 0.3` → 0–0.3 | [0.05, 0.3] |
| `social_attunement` | `entityLinkingThreshold` | `trait × 0.5 + 0.45` → 0.45–0.95 | [0.4, 0.95] |
| `social_attunement` | `entityCandidateCount` | `floor(trait × 6)` → 0–6 | [1, 6] |

All derived params have hard clamp ranges enforced in `computeDerivedParams()` — Genome can never push a param outside the safe range.

> **No hybrid override needed**: The formulas are calibrated so trait=0.5 produces legacy defaults. No `compatConstants` parameter is required.

**D) Implement reproducible randomness**

New file: `packages/core/src/genome_randomness.ts`

```typescript
function computeDailyJitter(
  seed: number,
  date: string,        // 'YYYY-MM-DD'
  trait: string
): number;             // small delta, e.g., ±0.02
```

Properties:
- **Low frequency**: Jitter changes once per day (keyed on date string).
- **Inertial**: Today's jitter is smoothed with yesterday's (e.g., `0.7 × yesterday + 0.3 × raw`).
- **Reproducible**: `seed + date + trait` → deterministic hash → mapped to `[-0.02, +0.02]`.
- **Small amplitude**: Never exceeds ±0.02 on any trait.

Implementation: Use a seeded PRNG (e.g., `seed ^ dateHash ^ traitHash` → simple LCG or Mulberry32) to produce a deterministic float. Apply inertial smoothing.

**E) Implement slow epigenetic drift rules**

In `state_delta_gates.ts`, the `epigeneticsGate` enforces:

| Rule | Constraint |
|------|-----------|
| Evidence required | `adjustment.evidence.length >= 2` (multi-evidence) |
| Bounded range | `adjustment.value` must stay within `[min, max]` |
| Cooldown | No update to same adjustment key within cooldown period (e.g., 48 hours) |
| Small delta | Per-update max change: ±0.05 |
| Rollback-capable | Every adjustment carries evidence — reverting means removing the evidence and resetting |

Epigenetic updates flow through the same `StateDeltaProposal` pipeline:
```json
{
  "type": "epigenetics",
  "targetId": "verbosity_preference",
  "patch": { "value": "+0.03" },
  "confidence": 0.8,
  "supportingEventHashes": ["evhash_1", "evhash_2"],
  "notes": "User consistently prefers detailed explanations over two weeks"
}
```

**F) Integrate genome/epigenetics into the turn pipeline**

Modify `execution_protocol.ts` and `orchestrator.ts`:

1. At turn start, load `genome.json` and `epigenetics.json` from persona package.
2. Compute `DerivedParams` via `computeDerivedParams()`.
3. Pass `DerivedParams` to budget-consuming modules:
   - `recall_budget_policy.ts` (uses `recallTopK`, `recentWindowTurns`)
   - `memory_budget.ts` (uses `memoryHalfLifeDays`, `archiveThreshold`, `salienceGain`)
   - `mood_state.ts` (uses `moodDeltaScale`, `baselineRegressionSpeed`)
   - `social_graph.ts` (uses `entityLinkingThreshold`, `entityCandidateCount`)
   - Context injection (uses `cardsCap`)

**G) Genome preset for new personas**

New file: `packages/core/config/genome_presets.json`

Provides named presets (e.g., `balanced`, `empathetic`, `analytical`, `social`) with different trait distributions. New personas can select a preset or randomize within safe bounds.

#### 2.5.2 Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Genome types + loader | `packages/core/src/genome.ts` | `GenomeConfig`, `EpigeneticsConfig`, load/save/validate |
| Derived params mapper | `packages/core/src/genome_derived.ts` | `computeDerivedParams()` with clamp ranges |
| Reproducible randomness | `packages/core/src/genome_randomness.ts` | `computeDailyJitter()` with inertial smoothing |
| Epigenetics gate rules | `packages/core/src/state_delta_gates.ts` | Extended `epigeneticsGate` |
| Genome presets | `packages/core/config/genome_presets.json` | Named presets for new personas |
| Schema files | Per-persona: `genome.json`, `epigenetics.json` | Created on migration or persona creation |
| Lint rules | `packages/core/src/persona_lint.ts` | Genome schema validation, trait range check |
| Tests | `packages/core/tests/genome.test.ts` | Mapping correctness, clamp enforcement, jitter reproducibility, epigenetics gate |

#### 2.5.3 Integration Points

| Existing Module | How It's Touched |
|----------------|-----------------|
| `execution_protocol.ts` | Loads genome + epigenetics; passes `DerivedParams` to pipeline |
| `orchestrator.ts` | System prompt can mention persona's trait-derived tendencies |
| `recall_budget_policy.ts` | Consumes `recallTopK`, `recentWindowTurns` from derived params |
| `memory_budget.ts` | Consumes `memoryHalfLifeDays`, `archiveThreshold`, `salienceGain` |
| `mood_state.ts` | Consumes `moodDeltaScale`, `baselineRegressionSpeed` |
| `social_graph.ts` | Consumes `entityLinkingThreshold`, `entityCandidateCount` |
| `persona.ts` | `loadPersonaPackage()` loads genome + epigenetics (**DONE**); `initPersonaPackage()` writes defaults (**DONE**) |
| `state_delta_gates.ts` (from H/P0-0) | `epigeneticsGate` enforces drift rules |
| `persona_lint.ts` | New genome/epigenetics validation rules |

#### 2.5.4 Gates / Invariants

- **Trait count invariant**: Exactly 6 traits. No more, no less. Adding a 7th trait requires a review gate and version bump (enforced by schema validation).
- **Clamp invariant**: All trait values ∈ [0.0, 1.0]. All derived params within their clamp ranges. Violations rejected at load time.
- **Locked genome invariant**: If `locked: true`, no epigenetic drift is applied. `epigeneticsGate` rejects all deltas for locked genomes.
- **Reproducibility invariant**: Given the same `seed + date`, `computeDailyJitter()` produces the same value across runs.
- **Inertial invariant**: Jitter between consecutive days differs by at most the smoothing coefficient × max amplitude.

#### 2.5.5 Test Plan / DoD

| Criterion | Verification |
|-----------|-------------|
| Differences are explainable | Create two personas with different `attention_span` (0.3 vs 0.8). Verify their `recallTopK` differs (6 vs 16). The difference traces to the genome trait and the formula. |
| Randomness is reproducible | Call `computeDailyJitter(seed=42, date='2026-03-01', trait='emotion_sensitivity')` twice → same result. Change seed → different result. |
| Inertial smoothing works | Compute jitter for 3 consecutive days. Verify day-to-day change is smooth (no sudden jumps). |
| Clamp ranges enforced | Set `attention_span` to 1.0 → `recallTopK` = 20 (clamped to max). Set to 0.0 → `recallTopK` = 3 (clamped to min). |
| Epigenetics bounded | Submit an epigenetics delta that would push `verbosity_preference` above `max` → gate clamps to `max`. |
| Epigenetics cooldown | Submit two epigenetics deltas for same key within cooldown period → second is rejected. |
| Epigenetics evidence required | Submit delta with 0 evidence hashes → rejected. With 2+ hashes → accepted. |
| Legacy mode produces defaults | Default genome (all 0.5) + empty epigenetics → `computeDerivedParams()` returns `getDefaultDerivedParams()` (**PASSING**). |

#### 2.5.6 Rollback Plan

- **Degrade to defaults**: Delete `genome.json` → `loadGenome()` returns default (all 0.5) → identical to pre-genome behavior.
- **Freeze epigenetics**: Set `locked: true` on genome → all epigenetic drift stops. Existing adjustments preserved but no new ones applied.
- **Per-persona**: Remove `genome.json` and `epigenetics.json` from persona package → system auto-defaults on next load.

#### 2.5.7 Estimated Complexity: **L** (Large)

Multiple interacting systems: genome schema, derived param mapping, randomness engine, epigenetics gate, compat integration. Requires careful calibration testing.

---

## 3. Cross-Task Dependencies

### 3.1 Dependency DAG

```
H/P0-0 (State Delta Pipeline)
  │
  ├──→ H/P0-1 (Invariant Table)
  │      Depends on: StateDeltaProposal types, gate framework
  │      Consumes: state_delta_gates.ts gate parameterization
  │
  └──→ H/P0-2 (Compat & Migration)
         Depends on: applyDeltas(), trace-only mode capability
         Consumes: state_delta_apply.ts, execution_protocol.ts hooks
           │
           └──→ H/P0-3 (Compat Constants)
                  Depends on: CompatMode definitions, migration flow
                  Consumes: compat_mode.ts types, persona_lint.ts patterns
                    │
                    └──→ H/P0-4 (Genome & Epigenetics MVP)
                           Depends on: compat_constants for calibration,
                                       compat_migration for genome generation,
                                       state_delta_gates for epigenetics gate
                           Consumes: all prior deliverables
```

### 3.2 Interface Contracts Between Tasks

| Producer | Consumer | Interface |
|----------|----------|-----------|
| H/P0-0 | H/P0-1 | `StateDelta.type` enum determines which domains need invariant rules |
| H/P0-0 | H/P0-2 | `applyDeltas()` API, `DeltaGateContext` type, trace-only mode flag |
| H/P0-1 | H/P0-2 | `InvariantRule[]` for drift-detection during migration validation |
| H/P0-2 | H/P0-3 | `CompatMode` type (`legacy`/`full`), auto-default genome strategy |
| H/P0-2 | H/P0-4 | `loadGenome()` auto-default, `PersonaPackage.genome` field |
| H/P0-3 | H/P0-4 | Formula calibration constraint (trait=0.5 → legacy defaults) |
| H/P0-0 | H/P0-4 | `state_delta_gates.ts` gate framework for `epigeneticsGate` |

### 3.3 What Can Be Designed in Advance

While each task must complete and verify before the next starts, **type definitions** for later tasks can be sketched during H/P0-0 to reduce rework:
- `GenomeConfig` and `EpigeneticsConfig` types are implemented in `genome.ts` (**DONE**).
- `CompatMode` is simplified to `'legacy' | 'full'` — no separate type file needed.
- Invariant domain list can be provisionally enumerated.

These advance sketches are non-binding — the producing task has authority to revise.

---

## 4. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | **Delta pipeline overhead too high** — per-turn latency increase degrades UX | Medium | High | Profile with `turn_latency_profiler.ts` at each step. Gate evaluation is pure functions — target <10ms total. `applyDeltas()` file I/O is the bottleneck — use write-ahead + async flush. |
| R2 | **LLM doesn't reliably produce structured delta proposals** — hallucinated types, missing fields | High | Medium | Define a strict JSON schema for proposals. Use schema validation on LLM output. If parsing fails, treat as "zero proposals" (no state change, reply still proceeds). Iteratively improve prompt. |
| R3 | **Compat migration causes subtle behavioral drift** — not caught by regression check | Medium | Critical | Run shadow mode first (trace proposals but don't apply). Compare traced proposals against legacy behavior over 50+ turns before activating. Use human evaluation for first 3 personas. |
| R4 | **Gate thresholds too strict** — reject legitimate state changes, system feels "frozen" | Medium | Medium | Start with loose thresholds. Tighten gradually based on observed data. All thresholds are config-driven, not hardcoded. |
| R5 | **Gate thresholds too loose** — allow drift, defeating the purpose | Medium | High | Pair with regression tests that detect drift over 100-turn sequences. Invariant table CI catches threshold violations. |
| R6 | **Genome calibration doesn't reproduce legacy behavior** — derived params drift from old constants | Low | High | `getDefaultDerivedParams()` test verifies exact match. Formulas calibrated at trait=0.5 = legacy. No hybrid override needed. (**MITIGATED**: test passing) |
| R7 | **Epigenetics accumulates invisible personality changes** — "backdoor" concern from Archive §20.3 | Medium | High | Multi-evidence requirement + cooldown + bounded range + full audit trail. Risk guard H/P1-14 (later batch) adds additional enforcement. |
| R8 | **Snapshot storage grows large** — many migration/rollback cycles | Low | Low | Compress snapshots. Retain only last 3 per persona. Snapshots are cheap (JSON files, ~10KB each). |

---

## 5. Batch Exit Criteria

All of the following must be true before advancing to Batch H1 (State Modules, W4–W6):

### 5.1 Hard Requirements

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| E1 | **State Delta Pipeline operational** | `executeTurnProtocol` invokes `runDeltaGates() → applyDeltas()` on every turn. Trace includes `DeltaCommitResult`. |
| E2 | **Zero direct-write paths** | CI static analysis: no state file writes outside `state_delta_apply.ts`. |
| E3 | **Invariant table green in CI** | `invariant_table.test.ts` and `invariant_completeness.test.ts` pass. All required domains covered. |
| E4 | **Compat auto-default proven on ≥1 existing persona** | One real persona loaded without `genome.json` → auto-default genome → derived params match legacy constants. (**PASSING** in `genome.test.mjs`) |
| E5 | **Compat constants complete and calibrated** | `persona_lint.ts` passes for migrated persona. All constants present. Calibration within tolerance. |
| E6 | **Genome schema valid** | `genome.json` and `epigenetics.json` pass schema validation for migrated persona. |
| E7 | **Derived params clamped** | Unit test: extreme genome values (0.0 and 1.0) produce derived params within clamp ranges. |
| E8 | **Epigenetics gate enforced** | Unit test: cooldown, evidence, and bound violations are rejected. |
| E9 | **Randomness reproducible** | Unit test: same seed + date → same jitter. Different seed → different jitter. |
| E10 | **All new tests pass in CI** | `state_delta.test.ts`, `invariant_table.test.ts`, `compat_migration.test.ts`, `compat_constants.test.ts`, `genome.test.ts` all green. |

### 5.2 Soft Requirements (desirable but not blocking)

| # | Criterion | Notes |
|---|-----------|-------|
| S1 | Performance overhead <50ms per turn | Can be relaxed if async flush is implemented |
| S2 | Shadow-mode validation on ≥3 personas | More personas = more confidence, but 1 is minimum |
| S3 | Delta trace replay tool available | Useful for debugging but not blocking |

### 5.3 What the Next Batch (H1) Assumes

Batch H1 (State Modules) builds directly on these foundations:

- **H/P1-0 (Values/Personality)**: Adds a new `StateDelta.type: 'value' | 'personality'` and corresponding gate logic. Requires the gate framework from H/P0-0 and invariant table from H/P0-1.
- **H/P1-1 (Goals/Beliefs)**: Same pattern — new delta types, new gates.
- **H/P1-2 (Memory Forgetting)**: Uses `memoryHalfLifeDays` and `archiveThreshold` from derived params (H/P0-4).
- **H/P1-3 (Relationship State)**: Uses entity linking (conditionally enabled by H/P0-2) and relationship delta gates (H/P0-0 + H/P0-1).
- **H/P1-5 (Affect 3-Layer)**: Uses `moodDeltaScale` and `baselineRegressionSpeed` from genome (H/P0-4). This is the critical sync point — cannot start until H/P0-4 is complete.

If any exit criterion in §5.1 is not met, the corresponding downstream task in Batch H1 is blocked.
