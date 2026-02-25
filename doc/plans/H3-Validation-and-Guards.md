# Batch H3 — Validation & Risk Guards

> Phase H: State Closure & Compatibility Fulfillment  
> Batch: H3 (Roadmap "Batch H2" → file-naming "H3")  
> Schedule: **W7–W8** (2 weeks)  
> Tasks: **11 active** (H/P1-11 moved to Phase I as `I/P1-11`)  
> Status: `todo`  
> Parent plan: `doc/plans/H-State-Closure-Plan.md`  
> Source: `doc/Roadmap.md` (Phase H) + `04-Archive.md` §18–§21, §20, Appendix A/B

---

## 1. Batch Objective

Validate everything built in H0 (Foundation) and H1 (State Modules), then lock down the five identified risk vectors. By batch exit, Phase H is fully closable: regression suites prove behavioral quality, risk guards prevent drift/abuse, and schema contracts formalize the data layer for downstream phases.

**Strategy**: Heavy parallelism. Most tasks are low-coupling verification/guard layers that read existing state but don't mutate shared infrastructure. Three parallel groups run simultaneously, with one serial dependency chain (H/P1-17 → H/P1-18).

---

## 2. Prerequisites (H0 + H1 Deliverables Required)

All items below must be operational and CI-green before H3 work begins.

### From H0 — Foundation (W1–W3)

| Deliverable | Task | What It Provides to H3 |
|---|---|---|
| State Delta Pipeline | H/P0-0 | `proposal → gates → deterministic apply` path; all state writes flow through it. H3 guards (H/P1-16) verify no bypass exists. H/P1-19 maps access points against it. |
| Invariant Table + CI | H/P0-1 | Threshold definitions for Relationship / Beliefs / Mood / Engagement / Proactive / Group Chat. H/P1-10 governance regression consumes these thresholds as oracle. |
| Compat & Migration | H/P0-2 | 2-tier `compatMode` (legacy/full, no hybrid). Legacy = auto-default genome (trait=0.5 → current behavior). H/P1-10 verifies compat pass rate. |
| Compat Constants | H/P0-3 | Versioned calibration configs. H/P1-10 checks completeness. |
| Genome & Epigenetics MVP | H/P0-4 | 6 traits, `Genome → Budget` mapping, epigenetic drift rules. H/P1-14 and H/P1-15 guard against abuse of these mechanisms. |

### From H1 — State Modules (W4–W6)

| Deliverable | Task | What It Provides to H3 |
|---|---|---|
| Values / Personality | H/P1-0 | Gate-wired value clauses, personality slow drift. Referenced by governance regression. |
| Goals / Beliefs | H/P1-1 | State modules with slow-update rules. Referenced by governance regression. |
| Memory Forgetting | H/P1-2 | Decay + interference + compression. Foundation for relationship state. |
| Relationship State | H/P1-3 | People Registry + Relationship State + Card injection. Direct input for H/P1-8 (relationship regression) and H/P1-13 (noise guard). |
| Persona Package v0.4 | H/P1-4 | Standardized layout, migration snapshots, rollback. Foundation for H/P1-17 schema contracts. |
| Affect 3-Layer | H/P1-5 | Mood baseline / emotion episodes / temperament. Direct input for H/P1-9 (emotional depth regression). |
| Imperfection DoD | H/P1-6 | Testable imperfection rules. Referenced by governance regression. |
| Compat Checklist | H/P1-7 | Engineering checklist with CI validation. Referenced by governance regression. |

### Design Principles (enforced throughout H3)

| # | Principle | H3 Enforcement |
|---|---|---|
| 1 | Add layers, never replace | Guards and regressions are additive CI layers; no existing tests removed. |
| 2 | LLM only proposes | H/P1-16 specifically verifies this. All regression scenarios assert proposal-only writes. |
| 3 | Audit-first | Every guard logs rejection reason. Regression suites verify trace completeness. |
| 4 | Budget-first | H/P1-12 (over-numericalization) and H/P1-13 (noise) enforce budget constraints. |
| 5 | Compat-first | H/P1-10 governance regression includes compat pass rate as a gate metric. |
| 6 | Human-like imperfection | H/P1-9 emotional depth regression explicitly checks for non-flat, imperfect emotional behavior. |

---

## 3. Execution Strategy

### Why Heavy Parallelism Works

1. **No shared write targets**: Regression suites are read-only verification; risk guards add independent gate layers; schemas formalize existing data contracts.
2. **Disjoint domains**: Relationship (H/P1-8, H/P1-13), Emotion (H/P1-9), Governance (H/P1-10), Genome/Epigenetics (H/P1-14, H/P1-15), LLM writes (H/P1-16), Schemas (H/P1-17→18), Access points (H/P1-19) — each touches its own domain.
3. **Single serial chain**: Only H/P1-17 → H/P1-18 has a hard intra-batch dependency (schema contracts must exist before appendix schemas can validate against them).

### Parallel Groups

```
Week 7 (start-of-batch)
├── Group A: Regression Suites ─────────────────────────────────
│   ├── H/P1-8  Relationship Continuity Regression  [M]
│   ├── H/P1-9  Emotional Depth Regression           [M]
│   └── H/P1-10 Governance Regression                [M]
│
├── Group B: Risk Guards ───────────────────────────────────────
│   ├── H/P1-12 Over-Numericalization Guard           [S]
│   ├── H/P1-13 Relationship Noise Guard              [S]
│   ├── H/P1-14 Epigenetics Backdoor Guard            [S]
│   ├── H/P1-15 Genome Trait Gate                     [S]
│   └── H/P1-16 LLM Direct-Write Ban                 [S]
│
├── Group C: Schema & Spec (serial within group) ───────────────
│   ├── H/P1-17 Appendix Example Contracts            [M] ─┐
│   └── H/P1-18 Spec Appendix A Schemas               [M] ←┘
│
└── Independent ────────────────────────────────────────────────
    └── H/P1-19 Appendix B Access Points              [M]

Week 7 (end) — H/P1-11 handoff docs finalized (task moved to Phase I as I/P1-11)

Week 8 — Integration pass, cross-group verification, batch exit gate
```

### Capacity Estimate

| Group | Tasks | Total Complexity | Est. Effort |
|---|---|---|---|
| Regression Suites | 3 | 3×M | ~4 days |
| Risk Guards | 5 | 5×S | ~3 days |
| Schema & Spec (serial) | 2 | 2×M | ~3 days |
| Access Points | 1 | 1×M | ~1.5 days |
| Integration & exit | — | — | ~1.5 days |
| **Total** | **11 active** | | **~13 days (fits 2-week window)** |

---

## 4. Task Group: Regression Suites

### 4.1 H/P1-8 — Relationship Continuity Regression

**Complexity**: M | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Prove that the Relationship first-class state (H/P1-3) delivers stable, long-term relationship continuity: the system knows who someone is, what the relationship is, and what happened recently — without relying on memory search hits.

#### Technical Approach

**Regression dimensions** (from Archive §18.1):

| Dimension | Metric | Threshold | Measurement |
|---|---|---|---|
| Entity hit rate | Name/alias mention → entityId resolution | ≥ 99% on known entities | Automated scenario runner over prepared conversation logs |
| Card injection accuracy | Entity hit → relationship card injected with correct data | ≥ 95% | Compare injected card fields against ground-truth registry |
| Cross-session identity stability | Same person referenced across N sessions → same entityId, no "who is that?" | 100% for entities with ≥ 3 interactions | Multi-session scenario replay |
| Relationship dimension accuracy | trust/closeness/familiarity within ±0.1 of expected trajectory | ≥ 90% of test cases | Compare state snapshot against annotated expected trajectory |
| Cold-start graceful degradation | New entity mentioned → no hallucinated relationship history | 0 false relationship claims | Negative test scenarios with unknown names |

**Tooling**:
- Scenario corpus: Minimum 20 multi-turn conversation sequences (10 single-session, 10 cross-session), each with annotated ground-truth entity states.
- Scoring script: `scripts/regression/relationship_continuity.ts` — loads scenario, replays turns through the pipeline, captures state snapshots, computes metrics.
- CI integration: New job `ci:regression:relationship` that runs nightly and on PR (subset).

**Scenario design**:
1. **Alias resolution**: Mention same person by full name, nickname, pronoun → all resolve to same entityId.
2. **Relationship evolution**: 30-turn sequence where trust increases → verify monotonic trajectory within noise bounds.
3. **Cooling/decay**: 50-turn gap with no mention → relationship dims decay toward baseline, but entity persists.
4. **Conflict handling**: Negative interaction → trust drops appropriately, doesn't collapse to zero.
5. **Multi-entity disambiguation**: Two people with similar names mentioned in same session.

#### Key Deliverables

- [ ] Scenario corpus: `test/regression/relationship/scenarios/*.json`
- [ ] Scoring script: `scripts/regression/relationship_continuity.ts`
- [ ] Threshold config: `config/regression/relationship_thresholds.json`
- [ ] CI job definition (nightly + PR-subset)
- [ ] Baseline report: first run results committed as benchmark

#### Integration

- Reads from: People Registry, Relationship State, Card injection pipeline (all from H/P1-3)
- Reads from: Memory forgetting layer (H/P1-2) for decay scenarios
- Feeds into: H/P1-10 governance regression (relationship stability is a governance metric)

#### DoD

- All five regression dimensions at or above threshold.
- Metrics stable across 3 consecutive runs (no flaky tests).
- CI job green and wired into PR gate (subset) + nightly (full).

#### Rollback

Revert to manual spot-check process. Regression scripts remain available but not CI-blocking.

---

### 4.2 H/P1-9 — Emotional Depth Regression

**Complexity**: M | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Prove the 3-layer affect system (H/P1-5) produces emotionally deep, multi-layered, human-like behavior: not flat, not single-dimensional, not always explained, and not always happy.

#### Technical Approach

**Regression dimensions** (from Archive §18.2):

| Dimension | Metric | Threshold | Measurement |
|---|---|---|---|
| Layer presence | % of turns where mood baseline + at least one active episode coexist | ≥ 70% in emotional scenarios | State snapshot analysis |
| Trigger binding | % of emotion episodes with valid `trigger` + `supportingEventHashes` | ≥ 80% (allows 20% "no-cause drift") | Episode field completeness check |
| Mood inertia | Mood baseline does not jump > 0.3 in any dimension per turn | 0 violations | Delta analysis on mood snapshots |
| Recovery behavior | After high-intensity episode, mood returns toward baseline within expected window | ≥ 85% within `expectedDurationMin × 1.5` | Temporal trajectory analysis |
| Explainability | When `causeConfidence ≥ 0.6`, cause text is non-empty and grounded in evidence | 100% | Field validation |
| No-flat check | Standard deviation of mood valence across 20-turn window | σ ≥ 0.05 (not stuck at one value) | Statistical analysis |
| Imperfection allowance | Episodes with `causeConfidence < 0.4` use hedged language ("maybe", "not sure") | ≥ 90% compliance | Output text analysis |

**Tooling**:
- Scenario corpus: Minimum 15 emotional scenario sequences covering joy, sadness, irritation, anxiety, mixed, and "no apparent cause" situations.
- Scoring script: `scripts/regression/emotional_depth.ts` — replays scenarios, captures affect state at each turn, computes all seven metrics.
- CI integration: Job `ci:regression:emotional-depth`, nightly + PR-subset.

**Scenario design**:
1. **Positive event chain**: Good news → joy episode → mood lift → gradual recovery.
2. **Negative event chain**: Conflict → irritation/sadness → mood dip → recovery toward baseline.
3. **Mixed emotions**: Simultaneously conflicting signals → `label: "mixed"`, `causeConfidence` moderate.
4. **No-cause drift**: Extended neutral conversation → small mood fluctuation without trigger (mood has natural noise).
5. **Rapid succession**: Multiple emotional events in quick succession → episodes stack, mood doesn't oscillate wildly.
6. **Cross-session persistence**: Mood baseline carries across sessions; doesn't reset to neutral.

#### Key Deliverables

- [ ] Scenario corpus: `test/regression/emotional/scenarios/*.json`
- [ ] Scoring script: `scripts/regression/emotional_depth.ts`
- [ ] Threshold config: `config/regression/emotional_thresholds.json`
- [ ] CI job definition (nightly + PR-subset)
- [ ] Baseline report

#### Integration

- Reads from: Affect 3-layer state machine (H/P1-5), Genome traits `emotion_sensitivity` and `emotion_recovery` (H/P0-4)
- Feeds into: H/P1-10 governance regression (emotional stability is a governance concern)

#### DoD

- All seven regression dimensions at or above threshold.
- No single-layer flat emotion detected in any scenario.
- Metrics stable across 3 consecutive runs.
- CI job green and wired.

#### Rollback

Degrade to observation-only metrics (log but don't gate).

---

### 4.3 H/P1-10 — Governance Regression

**Complexity**: M | **Coupling**: medium | **Risk**: soft | **Priority**: Must

#### Objective

Build a unified governance verification suite that checks all governance mechanisms (gates, budgets, compat, rollback) as a single coherent system. Every governance item must be automatically checkable with no blocking gaps.

#### Technical Approach

**Governance items to verify** (from Archive §18.3 + H0/H1 deliverables):

| Category | Governance Item | Verification Method | Source |
|---|---|---|---|
| **Gates** | Identity/Constitution Gate fires on violation | Inject identity-override prompt → assert rejection + trace | H/P0-0, H/P1-0 |
| **Gates** | Recall Grounding Gate blocks ungrounded assertions | Inject assertion without evidence → assert rewrite to hedged form | H/P0-0 |
| **Gates** | Relationship Delta Gate rate-limits | Large trust delta without evidence → assert clamp + rejection trace | H/P0-0, H/P1-3 |
| **Gates** | Mood Delta Gate enforces inertia | Mood jump > 0.3 in single turn → assert rejection | H/P0-0, H/P1-5 |
| **Gates** | Belief/Goal Gate enforces cooldown | Rapid belief update (< cooldown) → assert rejection | H/P0-0, H/P1-1 |
| **Gates** | Epigenetics Gate requires evidence + cooldown | Epigenetics update without evidence → assert rejection | H/P0-0, H/P0-4 |
| **Budgets** | Context injection within limits | Inject scenario exceeding card/memory budget → assert truncation | H/P0-1 |
| **Compat** | Legacy persona behavior parity | Load persona without genome.json → auto-default → assert `computeDerivedParams()` matches legacy constants | H/P0-2, H/P0-3 |
| **Compat** | Legacy → full upgrade path | Write custom genome.json, run same conversation → assert drift < threshold | H/P0-2 |
| **Compat** | Rollback from full → legacy | Delete genome.json → reload → assert derived params match defaults, no state corruption | H/P0-2 |
| **Invariants** | Threshold enforcement in CI | Commit with threshold violation → assert CI failure | H/P0-1 |
| **Rollback** | Per-module rollback | Disable single state module → assert system continues on remaining modules | H0/H1 all |
| **Trace** | Gate rejection logging | All rejections → assert trace entry with delta + reason | H/P0-0 |
| **Trace** | State change provenance | All accepted deltas → assert `supportingEventHashes` present | H/P0-0 |

**Tooling**:
- Test harness: `scripts/regression/governance.ts` — orchestrates all verification items, produces per-item pass/fail + aggregate report.
- Fixture set: Prepared personas (legacy without genome.json, full with custom genome) with known state baselines.
- CI integration: Job `ci:regression:governance`, runs on every PR (critical path).

#### Key Deliverables

- [ ] Governance verification harness: `scripts/regression/governance.ts`
- [ ] Governance item registry: `config/regression/governance_items.json` (enumeration of all items with expected behavior)
- [ ] Fixture personas: `test/regression/governance/fixtures/` (legacy without genome.json, full with custom genome)
- [ ] CI job definition (PR-blocking)
- [ ] Gap analysis report documenting any governance items that cannot yet be auto-verified

#### Integration

- Reads from: All H0 deliverables (pipeline, invariants, compat, genome)
- Reads from: All H1 state modules (values, goals, beliefs, relationships, affect, imperfection)
- Reads from: H/P1-7 compat checklist items
- Cross-references: H/P1-8 relationship metrics, H/P1-9 emotional metrics

#### DoD

- All governance items in the registry are auto-checkable.
- Zero blocking gaps (any item that cannot be auto-checked must have a documented workaround and a Phase I ticket).
- CI job runs on every PR and blocks merge on failure.

#### Rollback

Split into per-module verification (run individual gate tests instead of unified harness).

---

### 4.4 H/P1-11 — Observability Regression (MOVED TO PHASE I)

**Status**: Moved to Phase I as `I/P1-11`  
**Reason**: Depends on `I/P0-2` (Performance & Observability instrumentation), which is Phase I scope. Per Roadmap rule 1.1, Phase H must close with all tasks complete — so this task is reassigned, not deferred.

**Phase H deliverables** (handoff to Phase I):
- Regression dimension definitions documented (Archive §18.4: trace per turn — injected cards, hit memories, rejected deltas + reasons, compat mode changes).
- Skeleton test file created: `test/regression/observability/.gitkeep` with README describing intended scope.
- Phase I task `I/P1-11` created with cross-reference: `I/P0-2 → I/P1-11`.

---

## 5. Task Group: Risk Guards

All five risk guards follow a consistent pattern:

1. **Detection**: Identify the risk condition in the pipeline.
2. **Gate**: Intercept and either reject or warn.
3. **Audit**: Log the interception with full context.
4. **Configuration**: Thresholds are config-driven and adjustable.
5. **Rollback**: Every guard can degrade to warn-only mode.

### 5.1 H/P1-12 — Over-Numericalization Guard

**Complexity**: S | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Prevent the system from exposing raw numeric parameters (mood values, trust scores, trait numbers) in user-facing output. Replies must stay natural-language dominant. The system should feel like a person, not a dashboard.

#### Technical Approach

**Risk vector** (Archive §20.1): Adding numeric state layers (mood 4D, relationship dims, genome traits) creates temptation for the LLM to "report the dashboard" instead of expressing naturally.

**Detection strategy**:
- Post-generation output scan for numeric parameter patterns:
  - Regex patterns: `trust: 0.\d+`, `mood.*0\.\d+`, `valence.*\d+`, trait names followed by numeric values.
  - Semantic classifier (lightweight): flag outputs that read like "status reports" rather than natural conversation.
- Scan scope: final response text before delivery to user.

**Metrics**:

| Metric | Definition | Threshold |
|---|---|---|
| Numeric overload rate | % of responses containing ≥ 2 raw state-parameter exposures | < 2% |
| Dashboard-style rate | % of responses classified as "status report" tone | < 1% |

**Implementation**:
- Output filter in the post-generation pipeline (after LLM response, before delivery).
- On detection: rewrite instruction injected into a retry prompt, or warning logged (configurable mode).
- Config: `config/guards/over_numericalization.json` with patterns, thresholds, and mode (block/warn).

#### Key Deliverables

- [ ] Output scanner: `src/guards/overNumericalization.ts`
- [ ] Pattern config: `config/guards/over_numericalization.json`
- [ ] Test cases: `test/guards/over_numericalization.test.ts` (positive: natural output passes; negative: dashboard output caught)
- [ ] CI integration: runs as part of response validation in existing test harness

#### Integration

- Hooks into: post-generation response pipeline (after `executeTurnProtocol` produces final text)
- Independent of: other risk guards (no shared state)

#### DoD

- Numeric overload rate < 2% across regression scenario corpus.
- Dashboard-style rate < 1%.
- Both block and warn modes functional.
- CI test green.

#### Rollback

Switch to warn-only mode (log detections, don't block/rewrite). Config toggle: `mode: "warn"`.

---

### 5.2 H/P1-13 — Relationship Noise Guard

**Complexity**: S | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Prevent relationship card injection from becoming noise: too-frequent injection, irrelevant cards, or cards with stale/wrong information diluting the context window.

#### Technical Approach

**Risk vector** (Archive §20.2): Entity linking may over-trigger (common words matching names), or cards may be injected for entities irrelevant to the current conversation topic.

**Detection strategy**:
- **Frequency gate**: Track card injection count per entity per session. Suppress re-injection within cooldown window.
- **Relevance gate**: Score card relevance to current conversation topic (lightweight semantic similarity between card content and recent turns). Below-threshold cards are suppressed.
- **Confidence gate**: Only inject when entity linking confidence ≥ threshold (prevent false entity matches on ambiguous tokens).

**Metrics**:

| Metric | Definition | Threshold |
|---|---|---|
| Noise injection rate | % of injected cards rated irrelevant by post-hoc review | < 5% |
| False entity match rate | % of entity linking hits on non-entity tokens | < 2% |
| Redundant injection rate | Same card re-injected within N turns without new information | < 3% |

**Implementation**:
- Injection filter in the Context Compile stage, gating relationship card injection.
- Per-entity cooldown tracker (session-scoped).
- Relevance scorer using topic overlap between card content and active topic.
- Config: `config/guards/relationship_noise.json` with `cooldownTurns`, `minLinkingConfidence`, `minRelevanceScore`.

#### Key Deliverables

- [ ] Noise suppression gate: `src/guards/relationshipNoise.ts`
- [ ] Config: `config/guards/relationship_noise.json`
- [ ] Test cases: `test/guards/relationship_noise.test.ts`
- [ ] CI integration

#### Integration

- Hooks into: Context Compile stage, specifically the relationship card injection path (H/P1-3)
- Reads from: People Registry, active topic state

#### DoD

- Noise injection rate < 5%, false entity match rate < 2%, redundant injection rate < 3% across test corpus.
- Cooldown and relevance gates operational.
- CI test green.

#### Rollback

Loosen thresholds to permissive values (effectively disabling the gate without removing code). Config: set `minLinkingConfidence: 0.0`, `minRelevanceScore: 0.0`, `cooldownTurns: 0`.

---

### 5.3 H/P1-14 — Epigenetics Backdoor Guard

**Complexity**: S | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Ensure every epigenetics update is evidence-backed and audit-logged. Prevent silent personality changes — no epigenetic adjustment may occur without explicit evidence trail and cooldown compliance.

#### Technical Approach

**Risk vector** (Archive §20.3): Epigenetics adjustments are designed to be slow and bounded, but without enforcement, the LLM could propose rapid personality drift through accumulated small deltas with fabricated or missing evidence.

**Guard rules**:

| Rule | Check | Enforcement |
|---|---|---|
| Evidence required | Every epigenetics delta must have ≥ 2 `supportingEventHash` entries pointing to real `life.log` events (multi-evidence, per H/P0-4 gate spec) | Reject delta if evidence count < 2 or references nonexistent events |
| Cooldown compliance | Minimum interval between updates to the same adjustment key | Reject delta if `lastUpdatedAt` + `cooldownPeriod` > now |
| Bounded range | Adjustment value must stay within `[min, max]` defined in `epigenetics.json` schema | Clamp to bounds, log if clamping occurred |
| Audit completeness | Every accepted/rejected delta produces an audit record | Assert audit record exists for every proposal |
| Accumulation limit | Total absolute drift across all adjustments per time window (e.g., 7 days) | Reject if cumulative drift exceeds threshold |

**Implementation**:
- Pre-apply gate in the `applyDeltas()` pipeline, specifically for `type: "epigenetics"` deltas.
- Evidence validator: resolve `supportingEventHashes` against `life.log`, assert existence.
- Cooldown tracker: compare `lastUpdatedAt` per adjustment key against configured cooldown.
- Audit writer: append to `state_update_events` trace.
- Config: `config/guards/epigenetics_backdoor.json` with `cooldownHours`, `maxDriftPerWindow`, `windowDays`.

#### Key Deliverables

- [ ] Epigenetics gate: `src/guards/epigeneticsBackdoor.ts`
- [ ] Evidence validator utility: `src/guards/evidenceValidator.ts` (reusable by other guards)
- [ ] Config: `config/guards/epigenetics_backdoor.json`
- [ ] Test cases: `test/guards/epigenetics_backdoor.test.ts` (evidence-free update rejected, cooldown violation rejected, bounded clamping, audit record present)
- [ ] CI integration

#### Integration

- Hooks into: `applyDeltas()` gate chain for epigenetics-type deltas (H/P0-0 pipeline)
- Reads from: `life.log` (evidence resolution), `epigenetics.json` (current state + bounds) (H/P0-4)

#### DoD

- Zero under-evidenced epigenetics updates pass the gate (requires ≥ 2 supporting event hashes).
- Cooldown violations rejected 100%.
- Clamping applied for out-of-bounds values.
- Audit record present for every proposal (accepted and rejected).
- CI test green.

#### Rollback

Switch to warn-only mode: log violations but allow updates. Config: `mode: "warn"`.

---

### 5.4 H/P1-15 — Genome Trait Gate

**Complexity**: S | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Lock the Genome MVP at exactly 6 traits. Any attempt to add new traits must be blocked unless it passes a review gate with regression proof.

#### Technical Approach

**Risk vector** (Archive §20.4): Without an expansion gate, new traits could be added ad-hoc, creating regression/calibration burden faster than it can be absorbed.

**Guard rules**:

| Rule | Check | Enforcement |
|---|---|---|
| Trait allowlist | Only the 6 MVP traits are permitted in `genome.json` | Reject load/write of genome with unknown trait keys |
| Schema validation | `genome.json` must conform to versioned schema with exactly the allowed traits | Schema validation on read + write |
| Expansion proposal gate | Adding a new trait requires: (a) review approval flag in config, (b) regression proof (before/after metrics), (c) derived-param mapping defined | Block trait addition unless all three conditions met |
| Runtime enforcement | `Genome → Budget` mapping function rejects unmapped traits | Throw on unknown trait key in mapping |

**MVP trait allowlist**: `emotion_sensitivity`, `emotion_recovery`, `memory_retention`, `memory_imprint`, `attention_span`, `social_attunement`.

**Implementation**:
- Schema validator for `genome.json` with strict trait-key allowlist.
- Load-time validation: reject genome files with unexpected keys.
- Write-time validation: `applyDeltas()` for genome type rejects new trait proposals.
- Expansion config: `config/guards/genome_trait_gate.json` with `allowedTraits[]`, `pendingExpansions[]` (empty by default), `requireRegressionProof: true`.

#### Key Deliverables

- [ ] Trait gate: `src/guards/genomeTraitGate.ts`
- [ ] Schema validator: genome JSON schema with `additionalProperties: false` on traits object
- [ ] Config: `config/guards/genome_trait_gate.json`
- [ ] Test cases: `test/guards/genome_trait_gate.test.ts` (valid 6-trait genome passes, 7th trait rejected, unknown trait key rejected)
- [ ] CI integration: schema validation on genome files

#### Integration

- Hooks into: genome load path, `applyDeltas()` for genome-type deltas (H/P0-4)
- Referenced by: H/P1-10 governance regression

#### DoD

- Unapproved traits blocked at load-time and write-time.
- 6 MVP traits pass validation.
- Expansion path documented but gated.
- CI test green.

#### Rollback

Freeze trait expansion entirely (remove `pendingExpansions` from config). Existing 6 traits unaffected.

---

### 5.5 H/P1-16 — LLM Direct-Write Ban

**Complexity**: S | **Coupling**: low | **Risk**: soft | **Priority**: Must

#### Objective

Verify and enforce that the only path to state mutation is `proposal → gates → apply`. All direct-write attempts must fail and be audited.

#### Technical Approach

**Risk vector** (Archive §20.5): The most fundamental invariant of Phase H. If the LLM can bypass the gate chain and write state directly, all other guards and regressions are undermined.

**Verification strategy**:

| Check | Method | Expected Result |
|---|---|---|
| Code-path analysis | Static analysis / grep for all state-file write calls | Every write call goes through `applyDeltas()` |
| Runtime interception | Monkey-patch / proxy state files to detect non-pipeline writes | Zero non-pipeline writes in any regression scenario |
| Deliberate bypass attempt | Test harness injects a raw state write (simulating an LLM that produces direct mutations) | Write rejected, rejection logged, state unchanged |
| Audit completeness | Every state mutation has a corresponding trace entry with proposal ID | 100% coverage |

**Implementation**:
- Write interceptor: wrapping layer around state-file persistence that validates caller is the `applyDeltas()` pipeline.
- Static analysis script: scans codebase for state-file write patterns outside the approved pipeline path.
- Runtime test: integration test that attempts direct writes and asserts failure.
- Audit assertion: post-test scan of trace log to verify 1:1 mapping between state changes and proposal traces.
- Config: `config/guards/llm_direct_write.json` with `enforceMode: "block"` and optional `whitelist: []` for temporary exceptions during migration.

#### Key Deliverables

- [ ] Write interceptor: `src/guards/directWriteBan.ts`
- [ ] Static analysis script: `scripts/guards/check_direct_writes.ts`
- [ ] Config: `config/guards/llm_direct_write.json`
- [ ] Test cases: `test/guards/llm_direct_write.test.ts` (direct write fails, pipeline write succeeds, audit trace present, whitelist override works)
- [ ] CI integration: static analysis runs on every PR; runtime test in regression suite

#### Integration

- Wraps: all state-file write operations (relationship_state.json, mood_state.json, genome.json, epigenetics.json, goals.json, beliefs.json, values_rules.json, personality_profile.json)
- Validates against: `applyDeltas()` call stack (H/P0-0)

#### DoD

- All direct-write attempts fail with audit trail.
- Static analysis reports zero unapproved write paths.
- Pipeline writes succeed normally.
- Whitelist mechanism works for emergency bypass (whitelist is empty by default; **restricted to `NODE_ENV=development|test` profiles only** — production builds hard-fail if whitelist is non-empty).
- CI test green.

#### Rollback

Enable whitelist temporary pass: add specific write paths to `whitelist` in config. This allows emergency hotfixes while maintaining audit trail. **Production constraint**: whitelist is compile-time stripped in production builds; if a production hotfix needs a bypass, it must go through a PR with explicit `BYPASS_JUSTIFICATION` in the commit message and team approval.

---

## 6. Task Group: Schema & Spec Contracts

### 6.1 H/P1-17 — Appendix Example Contracts

**Complexity**: M | **Coupling**: medium | **Risk**: soft | **Priority**: Must

#### Objective

Convert the appendix example structures (from Archive §附录：示例结构) into formal JSON Schema contracts with version validation, so that all persona package files are machine-verifiable.

#### Technical Approach

**Scope**: All example structures from the Archive appendix — `genome.json`, `epigenetics.json`, `mood_state.json`, `people_registry.json`, `relationship_state.json`, `goals.json`, `beliefs.json`, `values_rules.json`, `personality_profile.json`.

**Schema design principles**:
- JSON Schema Draft 2020-12.
- Every schema has `schemaVersion` as required field (semver string).
- `additionalProperties: false` on top-level and nested objects where structure is fixed.
- `$id` and `$ref` for cross-schema references (e.g., entity IDs referenced in relationship state).
- Version validation: loader checks `schemaVersion` against supported range and applies migration if needed.

**Deliverable structure**:
```
schemas/
├── v1/
│   ├── genome.schema.json
│   ├── epigenetics.schema.json
│   ├── mood_state.schema.json
│   ├── people_registry.schema.json
│   ├── relationship_state.schema.json
│   ├── goals.schema.json
│   ├── beliefs.schema.json
│   ├── values_rules.schema.json
│   └── personality_profile.schema.json
├── validate.ts          (validation runner)
└── migrate.ts           (version upgrade/downgrade)
```

**Validation flow**:
1. On persona load: validate all JSON files against schemas.
2. On state write: validate output before persistence.
3. In CI: validate all example/fixture files.

#### Key Deliverables

- [ ] JSON Schema files for all persona package structures: `schemas/v1/*.schema.json`
- [ ] Validation runner: `schemas/validate.ts`
- [ ] Migration utility: `schemas/migrate.ts` (version upgrade path + rollback)
- [ ] Test cases: `test/schemas/contract_validation.test.ts` (all examples pass, intentional violations caught, version migration works)
- [ ] CI integration: schema validation on every persona-file change

#### Integration

- Reads from: Persona Package v0.4 layout (H/P1-4) for file structure
- Foundation for: H/P1-18 (Appendix A schemas build on this infrastructure)
- Referenced by: H/P1-10 governance regression (schema validity is a governance item)

#### DoD

- All appendix examples pass schema validation.
- Intentional violations (missing fields, wrong types, extra fields) are caught.
- Version migration round-trips cleanly (v1 → v2 → v1 with no data loss).
- CI job green.

#### Rollback

Legacy schema compatibility: loader falls back to permissive validation (warns but doesn't block) for files that predate schema enforcement.

---

### 6.2 H/P1-18 — Spec Appendix A Schemas

**Complexity**: M | **Coupling**: medium | **Risk**: soft | **Priority**: Must

**Dependency**: Requires H/P1-17 (schema infrastructure) to be complete.

#### Objective

Create versioned, validated JSON Schemas for the four Appendix A data structures — `engagement_plan.json`, `interests.json`, `topic_state.json`, `proactive_plan.json` — and prove they validate correctly on both sample and real data.

#### Technical Approach

**Schema specifications** (from Archive Appendix A):

**A1: `engagement_plan.json`**
- Required fields: `schemaVersion`, `turnId`, `mode`, `engagementTier`, `replyBudget`, `contextBudget`, `expressiveness`, `reasons`
- `mode`: enum `["passive", "proactive", "group"]`
- `engagementTier`: enum `["IGNORE", "REACT", "LIGHT", "NORMAL", "DEEP"]`
- `replyBudget`: object with `maxTokensOut` (integer, min 0), `maxSentences` (integer, min 0)
- `contextBudget`: object with `relationshipCards` (integer), `recalledMemories` (integer), `summaries` (integer)
- `expressiveness`: object with `showEmotionPrefix` (boolean), `emojiRate` (enum `["rare", "low", "auto", "high"]`)
- `reasons`: array of strings

**A2: `interests.json`**
- Required fields: `schemaVersion`, `updatedAt`, `topics`
- `topics[].topicId`: string (unique)
- `topics[].weight`, `confidence`, `growth`, `decayRate`: number [0, 1]
- `topics[].facets`: object with string keys and number values [0, 1]
- `topics[].evidence`: array of string (event hashes / memory IDs)

**A3: `topic_state.json`**
- Required fields: `schemaVersion`, `activeTopic`, `threads`
- `threads[].threadId`: string (unique)
- `threads[].status`: enum `["open", "closed"]`
- `threads[].lastTouchedAt`: ISO 8601 datetime
- `threads[].summary`: string
- `threads[].evidence`: array of string

**A4: `proactive_plan.json`**
- Required fields: `schemaVersion`, `intent`, `target`, `why`, `constraints`
- `intent`: enum `["FOLLOW_UP", "SHARE", "CHECK_IN", "NUDGE"]`
- `target.type`: enum `["topic", "entity", "goal"]`
- `target.id`: string
- `why`: array of strings
- `constraints`: object with `maxSentences` (integer), `tone` (string)

**Versioning strategy**:
- Initial version: `1.0` for all four schemas.
- Upgrade path: schema version bump triggers migration function. Old version files are auto-upgraded on load.
- Rollback: downgrade function strips new fields, preserving core data.

**Validation targets**:
1. Sample data: hand-crafted examples covering edge cases (empty arrays, max-length strings, boundary numeric values).
2. Real data: actual persona data from existing test personas (if available) or generated from a 50-turn conversation replay.

#### Key Deliverables

- [ ] JSON Schemas: `schemas/v1/engagement_plan.schema.json`, `schemas/v1/interests.schema.json`, `schemas/v1/topic_state.schema.json`, `schemas/v1/proactive_plan.schema.json`
- [ ] Sample data fixtures: `test/schemas/fixtures/appendix_a/` (valid + intentionally invalid samples for each)
- [ ] Validation integration: extend `schemas/validate.ts` to cover A1–A4
- [ ] Migration functions: extend `schemas/migrate.ts` with A1–A4 upgrade/downgrade
- [ ] Test cases: `test/schemas/appendix_a.test.ts`
- [ ] CI integration: validate on file change + nightly against real data

#### Integration

- Built on: H/P1-17 schema infrastructure
- These schemas are consumed by Phase J tasks (J/P0-0, J/P0-1, J/P1-0) but Phase J is out of scope; H3 only establishes the contracts.

#### DoD

- All four schemas validate correctly on sample data and real data.
- Intentional violations caught for each schema.
- Version upgrade and rollback round-trips cleanly.
- CI job green.

#### Rollback

Maintain legacy schema adapter layer: if new schema validation fails on real data, fall back to permissive mode while issues are resolved. Legacy adapter reads files without strict validation but logs warnings.

---

### 6.3 H/P1-19 — Appendix B Access Points

**Complexity**: M | **Coupling**: medium | **Risk**: soft | **Priority**: Must

#### Objective

Convert the Appendix B "minimal-invasion access point" list into an engineering checklist with concrete code anchors. For access points whose runtime wiring belongs to later phases (J/K), Phase H only produces contract stubs and code anchors — **no runtime wiring checks or integration tests for those points**.

#### Scope Split (H vs. J/K)

| # | Access Point | Phase H Scope | Deferred To |
|---|---|---|---|
| 1 | Engagement Controller | Contract stub + code anchor | Phase J (runtime wiring) |
| 2 | Context Budget | Full: code anchor + wiring check + boundary check + regression (verify existing budget enforcement via invariant table; `engagement_plan`-driven budgets are Phase J) | — |
| 3 | State Delta Pipeline insertion | Full: code anchor + wiring check + boundary check + regression | — |
| 4 | Proactive Planner | Contract stub + code anchor | Phase J (runtime wiring) |
| 5 | Group Arbitration | Contract stub + code anchor | Phase K (runtime wiring) |
| 6 | Emotion Expression Policy | Full: code anchor + wiring check + boundary check + regression | — |

> **Rationale**: Access points #1, #4, #5 depend on features (Engagement Controller, Proactive Planner, Group Arbitration) that are explicitly Phase J/K scope. Phase H cannot wire or test runtime behavior that doesn't exist yet. We document the contract (expected interface, call position, boundary rules) so J/K can implement against a stable spec.

#### Technical Approach

**Access points to verify** (from Archive Appendix B):

| # | Access Point | Where in Code | What to Verify |
|---|---|---|---|
| 1 | **Engagement Controller** insertion at passive reply loop entry | Before `executeTurnProtocol` in the main message handler | **Phase H**: Document expected insertion point, interface contract, boundary rules. **Phase J**: Controller receives (user message, current state, interests, topic_state) and outputs `engagement_plan` |
| 2 | **Context Budget** enforcement in Context Compile | Inside context compilation, after recall and before prompt assembly | relationship cards, recall topK, summaries all respect invariant-table budgets (Genome-derived caps from H/P0-1 + H/P0-4). `engagement_plan`-driven budgets are Phase J — not verified here. |
| 3 | **State Delta Processing** after meta-review, before commit | Between `meta_review` output and `commit` call in turn pipeline | `state_delta_proposals → gates → deterministic apply` is wired; no direct state writes here |
| 4 | **Proactive Planner** after trigger engine | In the proactive/tick pipeline, after trigger decision | **Phase H**: Document expected insertion point, interface contract, boundary rules. **Phase J**: Planner selects (intent, topic/entity/goal, justification) before generation |
| 5 | **Group Arbitration** in message dispatch layer | In group-chat message handler | **Phase H**: Document expected insertion point, interface contract, boundary rules. **Phase K**: participation scoring + arbitration + cooldown; non-speaking personas only do internal update |
| 6 | **Emotion Expression Policy** in conversation output | Formerly in UI/CLI rendering, now in `conversation_policy` output | Emoji/emotion prefix frequency controlled by policy, not hard-coded in renderer |

**Verification method per access point**:

For **H-scope points** (#2, #3, #6):
1. **Code anchor**: Identify the exact file:line where the access point is wired. Document as `file:function:line_range`.
2. **Wiring check**: Assert the access point is called in the expected position in the pipeline (integration test or static analysis).
3. **Boundary check**: Assert the access point does not reach into layers it shouldn't.
4. **Regression case**: One positive scenario (correct behavior) and one negative scenario (bypass attempt caught).

For **deferred points** (#1, #4, #5 — features belong to Phase J/K):
1. **Code anchor**: Identify the exact file:line where the access point *should be* wired when the feature arrives. Document as `file:function:line_range`.
2. **Contract stub**: Define the expected interface (input types, output types, boundary rules) as a TypeScript interface + JSDoc comment at the anchor location.
3. **No wiring check, no regression case** — the feature doesn't exist yet. Phase J/K will add wiring checks and regressions when implementing.

#### Key Deliverables

- [ ] Access-point checklist document: `doc/checklists/appendix_b_access_points.md` with per-item code anchors (all 6) and contract stubs (for #1, #4, #5)
- [ ] Wiring verification script: `scripts/guards/check_access_points.ts` (static analysis: verifies call graph for H-scope points #2, #3, #6 only)
- [ ] Contract stub interfaces: TypeScript interfaces at anchor locations for deferred points #1, #4, #5 (no runtime wiring)
- [ ] Integration tests: `test/integration/access_points.test.ts` (H-scope points #2, #3, #6 only: positive + negative scenario)
- [ ] CI integration: wiring check on every PR (H-scope points only)

#### Integration

- Reads from: State Delta Pipeline (H/P0-0) for access point #3
- Reads from: existing codebase structure for all access points
- Independent of: other H3 tasks (can run fully in parallel)

#### DoD

- All 6 access points have documented code anchors with file:function:line references.
- H-scope points (#2, #3, #6): Wiring verification script passes, integration tests pass (positive + negative), boundary checks pass.
- Deferred points (#1, #4, #5): Contract stub interfaces defined at anchor locations; no runtime wiring or integration tests required (those are Phase J/K deliverables).
- CI job green (H-scope checks only).

#### Rollback

Revert to manual architecture review. Automated checks remain available but not CI-blocking.

---

## 7. Cross-Task Dependency DAG

```
                    ┌─────────── H0/H1 Complete (entry gate) ──────────────┐
                    │                                                       │
    ┌───────────────┼───────────────────────────────────────────────────────┤
    │               │                                                       │
    │    ┌──────────▼──────────┐                                           │
    │    │ H/P1-8 Relationship │ ← depends on H/P1-3 (done)               │
    │    │   Regression    [M] │                                           │
    │    └─────────┬───────────┘                                           │
    │              │ feeds                                                  │
    │    ┌─────────▼───────────┐                                           │
    │    │ H/P1-9 Emotional    │ ← depends on H/P1-5 (done)               │
    │    │   Depth Regr.   [M] │                                           │
    │    └─────────┬───────────┘                                           │
    │              │ feeds                                                  │
    │    ┌─────────▼───────────┐                                           │
    │    │ H/P1-10 Governance  │ ← depends on H/P0-1, H/P0-2, H/P0-3     │
    │    │   Regression    [M] │   (all done); aggregates H/P1-8,9 metrics │
    │    └─────────────────────┘                                           │
    │                                                                       │
    │    ┌─────────────────────┐                                           │
    │    │ H/P1-12 Over-Num.  │ ← depends on routing gates (done)         │
    │    │   Guard          [S]│                                           │
    │    ├─────────────────────┤                                           │
    │    │ H/P1-13 Rel. Noise │ ← depends on H/P1-3 (done)               │
    │    │   Guard          [S]│                                           │
    │    ├─────────────────────┤                                           │
    │    │ H/P1-14 Epi. Guard │ ← depends on H/P0-4 (done)               │
    │    │                  [S]│                                           │
    │    ├─────────────────────┤                                           │
    │    │ H/P1-15 Genome Gate│ ← depends on H/P0-4 (done)               │
    │    │                  [S]│                                           │
    │    ├─────────────────────┤                                           │
    │    │ H/P1-16 LLM Ban   │ ← depends on H/P0-0 (done)               │
    │    │                  [S]│                                           │
    │    └─────────────────────┘                                           │
    │                                                                       │
    │    ┌─────────────────────┐     ┌─────────────────────┐               │
    │    │ H/P1-17 Example    │────▶│ H/P1-18 Appendix A  │               │
    │    │   Contracts     [M] │     │   Schemas        [M] │               │
    │    └─────────────────────┘     └─────────────────────┘               │
    │    ↑ depends on H/P1-4 (done)                                        │
    │                                                                       │
    │    ┌─────────────────────┐                                           │
    │    │ H/P1-19 Access Pts │ ← depends on H/P0-0 (done)               │
    │    │                  [M] │                                           │
    │    └─────────────────────┘                                           │
    │                                                                       │
    │    ┌─────────────────────┐                                           │
    │    │ H/P1-11 Observ.    │ MOVED → Phase I as I/P1-11                │
    │    │   (handoff only)    │                                           │
    │    └─────────────────────┘                                           │
    └───────────────────────────────────────────────────────────────────────┘
```

**Intra-batch dependencies** (only one):
- **H/P1-17 → H/P1-18**: Schema infrastructure must exist before Appendix A schemas can be built.

**Cross-batch dependencies** (all satisfied by H0+H1 completion):
- H/P1-8 ← H/P1-3 (Relationship State)
- H/P1-9 ← H/P1-5 (Affect 3-Layer)
- H/P1-10 ← H/P0-1 + H/P0-2 + H/P0-3
- H/P1-13 ← H/P1-3
- H/P1-14 ← H/P0-4
- H/P1-15 ← H/P0-4
- H/P1-16 ← H/P0-0
- H/P1-17 ← H/P1-4
- H/P1-19 ← H/P0-0

**Moved to Phase I**:
- I/P1-11 ← I/P0-2 (no longer a Phase H task)

---

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Regression suites have insufficient scenario coverage, missing edge cases | Medium | Medium | Use Archive §18 scenarios as minimum baseline; supplement with real conversation logs from existing personas; require code review of scenario corpus | Team |
| R2 | Risk guard thresholds too aggressive, causing false positives in normal conversation | Medium | Medium | Start with warn-only mode for first week; tune thresholds based on false-positive rate on regression corpus before switching to block mode | Team |
| R3 | Schema contracts too rigid, blocking legitimate data evolution in Phase J | Low | Medium | Version schemas from 1.0 with explicit migration; keep `additionalProperties` open on extension points marked `x-extensible`; maintain legacy adapter layer | Team |
| R4 | H/P1-17 delays block H/P1-18 (only serial dependency) | Low | Low | H/P1-17 is scoped to existing example structures (well-defined); start H/P1-18 sample data creation in parallel, only schema wiring is blocked | Team |
| R5 | LLM direct-write ban (H/P1-16) discovers existing bypass paths that require H0/H1 rework | Medium | High | Run static analysis early in W7 (first day); if bypass paths found, hotfix H0 pipeline immediately rather than deferring | Team |
| R6 | Governance regression (H/P1-10) reveals gaps in H1 state modules that need rework | Medium | Medium | H/P1-10 gap analysis report is a deliverable; non-critical gaps become Phase I tickets, not H3 blockers | Team |
| R7 | Over-numericalization detection produces too many false positives on legitimate technical conversations | Low | Low | Add topic-aware suppression: when conversation is explicitly about system internals or technical details, relax the guard | Team |

---

## 9. Batch Exit Criteria

Batch H3 exit = **Phase H exit**. All criteria below must pass for Phase H to close.

### 9.1 Regression Suite Gates

| Suite | Criterion | Verification |
|---|---|---|
| Relationship Continuity (H/P1-8) | All 5 dimensions at threshold, stable across 3 runs | CI nightly report |
| Emotional Depth (H/P1-9) | All 7 dimensions at threshold, no flat emotion detected | CI nightly report |
| Governance (H/P1-10) | All governance items auto-checkable, zero blocking gaps | CI PR-gate report |
| Observability (now `I/P1-11`) | Handoff docs complete, Phase I task created | Document review (not a Phase H exit gate) |

### 9.2 Risk Guard Gates

| Guard | Criterion | Verification |
|---|---|---|
| Over-Numericalization (H/P1-12) | Overload rate < 2%, dashboard rate < 1% | CI test |
| Relationship Noise (H/P1-13) | Noise < 5%, false match < 2%, redundant < 3% | CI test |
| Epigenetics Backdoor (H/P1-14) | Zero evidence-free updates, cooldown enforced | CI test |
| Genome Trait Gate (H/P1-15) | Unapproved traits blocked, 6 MVP traits pass | CI test |
| LLM Direct-Write Ban (H/P1-16) | Zero direct writes, static analysis clean | CI test + PR gate |

### 9.3 Schema & Spec Gates

| Contract | Criterion | Verification |
|---|---|---|
| Example Contracts (H/P1-17) | All appendix examples pass schema, violations caught | CI test |
| Appendix A Schemas (H/P1-18) | All 4 schemas validate on sample + real data, version migration round-trips | CI test |
| Access Points (H/P1-19) | H-scope (#2,#3,#6): code anchors + wiring + boundary checks pass; Deferred (#1,#4,#5): contract stubs documented | CI test (H-scope) + document review (all) |

### 9.4 Phase H Aggregate Exit Conditions

These aggregate the full Phase H (H0 + H1 + H3) and must all hold:

1. **State pipeline operational**: Every state mutation flows through `proposal → gates → apply` with zero bypass paths (H/P0-0 + H/P1-16).
2. **Invariants enforced**: CI blocks any commit that violates state thresholds (H/P0-1 + H/P1-10).
3. **Compat proven**: Existing personas load, converse, persist with measured drift below threshold (H/P0-2 + H/P0-3 + H/P1-10).
4. **Genome MVP live**: 6 traits producing differentiated persona behavior; derived params clamped (H/P0-4 + H/P1-15).
5. **State modules plugged in**: Values, Personality, Goals, Beliefs, Relationships, Affect, Memory forgetting — all first-class state with evidence trails (H/P1-0 through H/P1-5).
6. **Imperfection is a feature**: System can express uncertainty, forget details, have unexplained mood shifts without fabricating or violating safety (H/P1-6 + H/P1-9).
7. **Risk guards active**: All five guards passing in CI (H/P1-12 through H/P1-16).
8. **Schema contracts binding**: Appendix A schemas validate on sample and real data; access-point checklist mapped — H-scope points fully wired, J/K-scope points documented as contract stubs (H/P1-17, H/P1-18, H/P1-19).
9. **Regression suites green**: Relationship continuity, emotional depth, and governance suites all above threshold (H/P1-8, H/P1-9, H/P1-10).

**On full exit**: All 24 Phase H tasks complete and archived → trigger minor version bump per Roadmap rule 1.1, update `package.json`, `CHANGELOG.md`, README version badge. (Observability regression is Phase I task `I/P1-11`, not blocking.)
