# Batch H2 — State Modules

> Phase H, Batch 2 of 3  
> Schedule: W4–W6 (3 weeks)  
> Tasks: 8 (H/P1-0 through H/P1-7)  
> Execution Strategy: Two parallel tracks + independent imperfection DoD  
> Coupling: Medium overall  
> Risk: Soft (individual modules are rollback-capable)

---

## 1. Prerequisites (Batch H0 Deliverables)

This batch builds directly on the five Foundation tasks completed in W1–W3:

| H0 Output | What H2 Consumes |
|-----------|-------------------|
| **H/P0-0 State Delta Pipeline** | Every state module in this batch produces `StateDeltaProposal` objects and relies on `applyDeltas()` for deterministic commit. All 8 tasks plug into this pipeline. |
| **H/P0-1 Invariant Table** | Thresholds for relationship, mood, belief, goal domains are CI-enforced. New modules must register their invariants here. |
| **H/P0-2 Compat & Migration** | `compatMode` (legacy/full, no hybrid) governs whether each module uses default or custom genome. Legacy = auto-default genome (all 0.5, current behavior). |
| **H/P0-3 Compat Constants** | Derived params for legacy personas are calibrated. New modules must declare their compat constant mappings. |
| **H/P0-4 Genome & Epigenetics MVP** | 6 traits and derived param table are available. Modules that need genome-derived behavior (Affect sensitivity, Memory half-life, Relationship attention_span) can consume these. |

---

## 2. Execution Strategy

### 2.1 Parallel Tracks

```
W4                    W5                    W6
├── Track 1 (serial state module chain) ──────────────────────┐
│   H/P1-0 → H/P1-1 → H/P1-2 → H/P1-3                      │
├── Track 2 (compat/package, parallel with Track 1) ──────┐  │
│   H/P1-4 ────────→ H/P1-7                               │  │
├── Track 3 (affect, after Track 1 + H/P0-4 ready) ───────┴──┤
│                              H/P1-5                         │
├── Independent (can start as soon as H/P0-1 done) ──────────┤
│   H/P1-6                                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Rationale

- **Track 1** is serial because each module builds on shared state infrastructure and H/P1-3 (Relationships) depends on H/P1-2 (Memory Forgetting) for decay curves.
- **Track 2** runs in parallel: Persona Package layout (H/P1-4) and Compat Checklist (H/P1-7) depend only on H/P0-2 (done in H0), not on Track 1 modules.
- **H/P1-5 (Affect)** is the largest task in this batch (complexity L). It depends on H/P0-0, H/P0-1, and H/P0-4 (all from H0) but is sequenced last because it also benefits from the state module patterns established by Track 1.
- **H/P1-6 (Imperfection DoD)** depends only on H/P0-1 (Invariant Table). It does **not** depend on H/P1-5 — it can start as soon as H/P0-1 is done and run in parallel with any track. Affect-layer imperfection scenarios can be added as a follow-up after H/P1-5 lands, but the core DoD suite is self-contained.

### 2.3 Coupling Assessment

| Task | Coupling | Notes |
|------|----------|-------|
| H/P1-0 | Medium | Writes to gate config shared with pipeline |
| H/P1-1 | Medium | Shares delta proposal format with H/P1-0 |
| H/P1-2 | Medium | Touches memory.db scoring, not structure |
| H/P1-3 | Medium | Depends on H/P1-2 decay; writes new state files |
| H/P1-4 | Low | File layout spec, no runtime coupling |
| H/P1-5 | High | Touches mood state, genome params, invariant table |
| H/P1-6 | Low | Test/DoD definitions, minimal code changes |
| H/P1-7 | Low | Checklist + CI lint, no runtime coupling |

---

## 3. Per-Task Detailed Plans

---

### 3.1 H/P1-0 — Values / Personality Runnable Constraint System

**Objective**: Transform values from static text descriptions into executable rule-clauses wired into the State Delta Pipeline's gate system; make personality a slow-drifting trait controlled by Epigenetics.

**Technical Approach**:

1. **Values Rule Engine**
   - Define a `ValuesRule` type:
     ```
     {
       id: string           // e.g. "V001"
       priority: number     // higher = stronger
       when: string         // trigger condition expression
       then: "refuse" | "rewrite" | "clarify" | "redirect"
       notes: string
       enabled: boolean
       addedAt: string      // ISO timestamp
     }
     ```
   - Store rules in `values_rules.json` within the Persona Package.
   - Build a `ValuesGate` that evaluates active rules against incoming `StateDeltaProposal` payloads and generated response text.
   - On violation: gate rejects the proposal (or flags the response) with `{ ruleId, reason, action }` in the trace.

2. **Personality Slow Drift**
   - `personality_profile.json` stores trait baselines (e.g., openness, agreeableness, assertiveness — distinct from Genome traits, which are sensitivity/retention params).
   - Personality changes only via:
     - **Epigenetics updates** (small delta, multi-evidence, cooldown, bounded, rollback-capable)
     - **Growth events** (strong evidence + extended cooldown + explicit trace)
   - External manifestation through language style shifts, not self-narration ("I changed").

3. **Integration with State Delta Pipeline**
   - Register `ValuesGate` in the gate chain (after Identity/Constitution gate, before Budget gate).
   - Personality drift proposals go through the standard Epigenetics gate from H/P0-4.

**Key Deliverables**:
- `values_rules.json` schema and seed rules for default persona
- `personality_profile.json` schema
- `ValuesGate` module (evaluates rules against proposals + response)
- `PersonalityDriftHandler` (channels personality changes through Epigenetics gate)
- Compat constant entries for legacy personas (values = permissive defaults)

**Integration Points**:
- Gate chain in State Delta Pipeline (H/P0-0)
- Epigenetics gate (H/P0-4) for personality drift
- Invariant table (H/P0-1) for maximum drift-per-session bounds
- Compat bridge (H/P0-2) — legacy mode: values gate logs only, doesn't block

**Gates / Invariants**:
- Values rule evaluation must complete within the turn latency budget
- Personality drift bounded by invariant table thresholds
- No more than N personality-affecting events per session (configurable)

**Test Plan / DoD**:
- Rule violation scenario: input triggers a values rule → response is intercepted → reason logged
- Personality stability: 100-turn session with no growth events → personality profile unchanged
- Personality drift: inject growth event with evidence → verify bounded change + trace
- Compat: legacy persona → values gate fires but only logs, no blocking

**Rollback**: Switch to warn-only mode (gate logs violations but does not reject).

**Complexity**: M

---

### 3.2 H/P1-1 — Goals / Beliefs State Module

**Objective**: Add first-class state modules for goals (direction, commitments, drives) and beliefs (world-model propositions with confidence and evidence), with slow-update rules enforced by the pipeline.

**Technical Approach**:

1. **Goals Module**
   - `goals.json` schema:
     ```
     {
       schemaVersion: "1.0",
       updatedAt: string,
       goals: [{
         goalId: string,
         type: "short" | "mid" | "long",
         description: string,
         status: "active" | "completed" | "abandoned",
         createdAt: string,
         evidence: string[],
         priority: number
       }],
       commitments: [{
         commitmentId: string,
         to: string,           // entityId or "self"
         description: string,
         status: "pending" | "fulfilled" | "defaulted",
         dueBy: string | null,
         evidence: string[]
       }],
       drives: {
         exploration: number,  // 0-1
         safety: number,
         efficiency: number,
         intimacy: number
       }
     }
     ```
   - Goal updates go through `StateDeltaProposal` with type `"goal"`.
   - Commitment status changes require evidence (fulfillment proof or default reason).

2. **Beliefs Module**
   - `beliefs.json` schema:
     ```
     {
       schemaVersion: "1.0",
       updatedAt: string,
       beliefs: [{
         beliefId: string,
         domain: string,         // "person" | "topic" | "world"
         proposition: string,
         confidence: number,     // 0-1
         lastUpdated: string,
         supportingEvidence: string[],
         contradictingEvidence: string[],
         cooldownUntil: string | null
       }]
     }
     ```
   - Belief updates are slow: cooldown period between changes, confidence shift per-turn is clamped.
   - Distinguish from Values (ought) — beliefs are about "what is", not "what should be".

3. **Goal/Belief Gate**
   - Register in gate chain. Enforces:
     - Commitment changes require reason + evidence
     - Belief confidence shift clamped per-turn
     - Belief update cooldown respected
     - Drive changes are very slow (Epigenetics-level)

**Key Deliverables**:
- `goals.json` and `beliefs.json` schemas
- `GoalBeliefGate` module
- Goal/Belief proposal handlers in State Delta Pipeline
- Seed data generators for legacy personas (empty goals, neutral beliefs)
- Compat constant entries

**Integration Points**:
- State Delta Pipeline (H/P0-0) for proposal handling
- Invariant table (H/P0-1) for confidence shift and cooldown bounds
- Context Compile stage: goals and active commitments injected as context cards (budget-constrained)

**Gates / Invariants**:
- Max confidence shift per turn (e.g., ±0.1)
- Cooldown period between belief updates on same proposition (e.g., 24h)
- Commitment default requires explicit justification

**Test Plan / DoD**:
- Cross-session continuity: create goal in session 1 → verify present in session 2
- Belief cooldown: attempt rapid belief update → verify rejected with reason
- Commitment lifecycle: create → fulfill with evidence → verify trace
- Drive stability: 50-turn session → drives unchanged (no proposals should touch drives at state level)

**Rollback**: Goals/beliefs become read-only (displayed but not updated).

**Complexity**: M

---

### 3.3 H/P1-2 — Memory Forgetting & Compression Pipeline

**Objective**: Implement human-like forgetting (decay, interference, compression) in `memory.db` without modifying `life.log`, governed by Genome-derived parameters.

**Technical Approach**:

1. **Decay Forgetting**
   - Add a `salience` score to memory entries that decays over time.
   - Decay formula: `salience *= exp(-decay_rate * days_since_last_access)`
   - `decay_rate` derived from Genome `memory_retention` trait (higher retention = slower decay). Clamped to safe range.
   - Decay runs as a background maintenance job (not per-turn — too expensive).

2. **Interference Forgetting**
   - When multiple memories share high embedding similarity, newer entries suppress older ones.
   - Implementation: during recall, if top-K results have pairwise similarity above threshold, apply interference penalty to older entries.
   - This naturally produces "I remember something happened but mix up the details" behavior.

3. **Compression (Consolidation)**
   - Periodic job merges clusters of related low-salience memories into summary records.
   - Original entries are archived (not deleted) — `status: "compressed"`, with pointer to the summary record.
   - Summaries preserve: time range, key entities, emotional valence, one-line gist.
   - `life.log` is never touched (append-only invariant preserved).

4. **Deep Recall**
   - When the system needs evidence for a state change, it can do a targeted deep recall that searches archived/compressed entries.
   - Deep recall is expensive — gated by budget and only triggered by explicit evidence needs.

**Key Deliverables**:
- `MemoryDecayJob` — scheduled salience decay
- `InterferenceScorer` — similarity-based suppression during recall
- `MemoryCompressor` — periodic compression into summaries
- `DeepRecallHandler` — targeted evidence retrieval from archive
- Genome-derived parameter integration (`memory_retention` → decay_rate, `memory_imprint` → salience gain)
- Schema additions to `memory.db` (salience column, status field, summary records)

**Integration Points**:
- Recall pipeline: interference scoring modifies recall ranking
- State Delta Pipeline: deep recall used when gate demands evidence
- Genome params (H/P0-4): `memory_retention` and `memory_imprint` feed decay/salience
- Invariant table (H/P0-1): minimum recall accuracy threshold

**Gates / Invariants**:
- `life.log` is never modified (hard invariant)
- Key memories (high salience, entity-linked, commitment-related) have decay floor
- Compression never runs on memories younger than N days
- Deep recall budget: max K per turn

**Test Plan / DoD**:
- Decay: inject memories with known timestamps → run decay → verify salience drops predictably
- Interference: inject 5 similar memories → recall → verify older ones are suppressed
- Compression: inject 20 old low-salience memories → run compressor → verify summaries created, originals archived
- life.log integrity: after all operations → verify life.log byte-identical
- Capacity: after 10k memories + decay/compress cycles → total active count stays within budget
- Key recall: entity-linked memories resist decay → recall accuracy above threshold

**Rollback**: Disable compression and interference; revert to raw salience-only recall.

**Complexity**: M

---

### 3.4 H/P1-3 — Relationship First-Class State

**Objective**: Externalize relationships from implicit memory hits to explicit, structured state with People Registry, per-entity Relationship State, and Relationship Card injection with budget controls.

**Technical Approach**:

1. **People Registry**
   - `people_registry.json`:
     ```
     {
       schemaVersion: "1.0",
       updatedAt: string,
       entities: [{
         entityId: string,        // stable, e.g. "ent_abc123"
         canonicalName: string,
         aliases: string[],
         tags: string[],
         firstMetAt: string,
         lastSeenAt: string,
         oneLineWho: string
       }]
     }
     ```
   - Entity linking: input text scanned for name/alias matches → resolved to `entityId`.
   - Registry is permanent — entities are never deleted (people don't vanish from the world).

2. **Relationship State**
   - `relationship_state.json`, keyed by `entityId`:
     ```
     {
       schemaVersion: "1.0",
       updatedAt: string,
       relationships: {
         [entityId]: {
           closeness: number,    // 0-1
           trust: number,
           affinity: number,
           tension: number,
           safety: number,
           obligations: string[],
           unresolved: string[],
           lastInteractionSummary: string,
           supportingEventHashes: string[],
           updatedAt: string
         }
       }
     }
     ```
   - Slow variables regress toward baseline over time (relationship cooling).
   - Updates via `StateDeltaProposal` with type `"relationship"`, constrained by Relationship Delta Gate (rate-limit per turn, large changes need strong evidence).

3. **Relationship Card Injection**
   - On entity link hit: generate a short card (3–6 lines) for context injection.
   - Card contents: who this person is, recent interaction summary, key relationship dimensions, unresolved items.
   - Budget: max 1–2 cards per turn, derived from Genome `attention_span`.
   - Cards go into Context Compile stage with priority above general recall but below pinned blocks.

4. **Cooldown & Forgetting**
   - Registry: permanent (entityId never removed).
   - Relationship slow variables: periodic regression toward neutral baseline.
   - Relationship details: decay via Memory Forgetting pipeline (H/P1-2).
   - Deep recall available for evidence retrieval.

**Key Deliverables**:
- `people_registry.json` schema and CRUD operations
- `relationship_state.json` schema and update handlers
- `EntityLinker` module (name/alias → entityId resolution)
- `RelationshipCardGenerator` (state → short context card)
- `RelationshipDecayJob` (periodic baseline regression)
- Relationship Delta Gate registration in pipeline
- Compat entries: legacy personas get empty registry + neutral relationship state

**Integration Points**:
- Cue Extraction (Stage1): entity mentions detected
- Entity Linker: resolves to registry entries
- Context Compile: injects relationship cards within budget
- State Delta Pipeline: relationship proposals → Relationship Delta Gate → apply
- Memory Forgetting (H/P1-2): relationship detail decay
- Genome (H/P0-4): `social_attunement` → linking threshold; `attention_span` → card budget

**Gates / Invariants**:
- Relationship delta per turn: max ±0.05 per dimension (configurable in invariant table)
- Large jumps (>0.1) require strong evidence (multiple supportingEventHashes)
- Card injection: hard cap at attention_span-derived limit
- Entity linking: confidence threshold before injection (avoid false positives)

**Test Plan / DoD**:
- Entity linking: input mentions "李植" (or alias "LZ") → 100% hit → card injected
- Relationship continuity: 20-turn conversation → relationship state tracks consistently
- Cooldown: 30 days no interaction with entity → slow variables regress measurably toward baseline
- Card budget: inject 5 entity mentions in one turn → only top 1–2 cards injected
- Rate limit: attempt +0.3 trust jump in one turn → clamped to max delta
- Evidence: large relationship change without evidence → rejected by gate with reason

**Rollback**: Fall back to memory-only relationship awareness (disable registry, cards, and relationship state).

**Complexity**: M

---

### 3.5 H/P1-4 — Persona Package v0.4 Layout & Rollback

**Objective**: Standardize the Persona Package file layout, metadata conventions, migration snapshot format, rollback entry points, and integrity signatures for all state files introduced in Phase H.

**Technical Approach**:

1. **Package Layout Specification**
   - Define the canonical directory structure:
     ```
     persona_package/
     ├── manifest.json          // package metadata + schemaVersion
     ├── genome.json
     ├── epigenetics.json
     ├── mood_state.json
     ├── people_registry.json
     ├── relationship_state.json
     ├── goals.json
     ├── beliefs.json
     ├── values_rules.json
     ├── personality_profile.json
     ├── snapshots/             // migration checkpoints
     │   └── snap_<timestamp>.json
     └── migration_log.jsonl    // upgrade/rollback history
     ```

2. **Manifest Schema**
   - `manifest.json`:
     ```
     {
       schemaVersion: "0.4.0",
       personaId: string,
       compatMode: "legacy" | "full",
       createdAt: string,
       lastMigratedAt: string,
       checksum: string,        // integrity hash of all state files
       files: {                 // registry of included files + their versions
         [filename]: { schemaVersion: string, updatedAt: string }
       }
     }
     ```

3. **Migration Snapshots**
   - Before any `legacy` → `full` upgrade: snapshot all state files into `snapshots/`.
   - Snapshot is a single JSON bundle of all current state.
   - `migration_log.jsonl` records: `{ at, from, to, reason, snapshotId, rollbackAvailable }`.

4. **Rollback Entry Point**
   - `rollbackToSnapshot(snapshotId)`: restores all state files from snapshot, deletes genome.json (reverts to legacy auto-default), logs rollback event.
   - Rollback preserves traces (never deletes audit history).

5. **File Validation**
   - Each state file must have `schemaVersion` and `updatedAt`.
   - Package loader validates all files against their declared schema version.
   - Missing or corrupt files: load with defaults (don't crash), log warning.

**Key Deliverables**:
- `manifest.json` schema
- Package layout specification document (in-code or as a schema)
- `PackageLoader` (validates, loads, handles missing files gracefully)
- `PackageSnapshotter` (creates/restores snapshots)
- `MigrationLogger` (records upgrade/rollback events)
- `PackageValidator` (integrity checks, schema version checks)

**Integration Points**:
- All state modules (H/P1-0..3, H/P1-5): their state files live inside the package
- Compat & Migration (H/P0-2): genome auto-default for legacy; custom genome.json for full
- Compat Constants (H/P0-3): calibration values referenced by manifest

**Gates / Invariants**:
- Package must load successfully even with missing optional files
- Snapshot creation must be atomic (all-or-nothing)
- Rollback must not delete any trace or audit data

**Test Plan / DoD**:
- Cross-version load: package created at v0.3 → loaded by v0.4 code → no errors, missing files get defaults
- Snapshot/restore cycle: create snapshot → modify state → rollback → verify state matches snapshot
- Corrupt file handling: corrupt one state file → package loads with defaults for that file + warning logged
- Migration log: perform upgrade → verify migration_log entry with all required fields

**Rollback**: Preserve old layout reader alongside new one; feature flag to switch.

**Complexity**: M

---

### 3.6 H/P1-5 — Affect: 3-Layer State Machine

**Objective**: Replace the single-layer mood system with a three-layer affect architecture: mood baseline (slow), emotion episodes (fast), and temperament influence (trait-level). Decouple affect from response rendering.

**Technical Approach**:

1. **Layer 1: Mood Baseline (hours/days)**
   - `mood_state.json`:
     ```
     {
       schemaVersion: "1.0",
       mood: {
         valence: number,     // -1 to 1 (negative to positive)
         arousal: number,     // 0 to 1
         energy: number,      // 0 to 1
         stress: number,      // 0 to 1
         baseline: {          // long-term equilibrium
           valence: number,
           arousal: number,
           energy: number,
           stress: number
         },
         updatedAt: string
       }
     }
     ```
   - Mood has inertia: regresses toward baseline at a rate governed by Genome `emotion_recovery`.
   - Per-turn mood updates via `StateDeltaProposal` with type `"mood"`, constrained by Mood Delta Gate.
   - Small, unexplained drifts are allowed (human-like — "just feeling off today").

2. **Layer 2: Emotion Episodes (minutes)**
   - Stored in-session (and optionally persisted to DB for evaluation):
     ```
     {
       episodeId: string,
       at: string,
       trigger: { type: "entity" | "topic" | "event", id: string },
       label: string,        // "joy" | "irritation" | "sadness" | "anxiety" | "mixed" | ...
       intensity: number,    // 0-1
       expectedDurationMin: number,
       decay: "fast" | "medium" | "slow",
       causeText: string,
       causeConfidence: number,   // 0-1, low = "not sure why"
       hypotheses: string[],
       supportingEventHashes: string[]
     }
     ```
   - Episodes are triggered by cue extraction (Stage1) or state changes.
   - Episodes decay naturally; expired episodes are archived.
   - **"Not knowing why" is a feature**: `causeConfidence` can be low; `causeText` can express uncertainty.

3. **Layer 3: Temperament (weeks/months)**
   - Temperament is the susceptibility layer — how easily each mood dimension shifts.
   - Derived from Genome `emotion_sensitivity` trait.
   - Changes only via Epigenetics (very slow, bounded, multi-evidence).
   - Stored as part of `personality_profile.json` (temperament section).

4. **Decoupling from Response Rendering**
   - Affect state informs response generation (via context injection), but does NOT directly control:
     - Emoji/emoticon usage (that's Conversation Policy — Phase J)
     - Tone templates (affect provides signal, not the template itself)
   - Forbid "faking emotion via tone templates" — if mood is neutral, don't inject artificial warmth.

5. **Mood Delta Gate**
   - Registered in pipeline gate chain.
   - Enforces: mood inertia (regression toward baseline), per-turn max shift (from invariant table), strong attribution requires evidence, episode creation allowed with low causeConfidence.

**Key Deliverables**:
- `mood_state.json` schema (Layer 1)
- Emotion episode type definition and storage (Layer 2)
- Temperament section in `personality_profile.json` (Layer 3)
- `MoodUpdateHandler` (baseline regression + delta application)
- `EmotionEpisodeManager` (creation, decay, archival)
- `MoodDeltaGate` (inertia enforcement, evidence requirements)
- `AffectContextInjector` (produces mood/episode summary for context compile)
- Genome integration: `emotion_sensitivity` → delta scale, `emotion_recovery` → regression speed

**Integration Points**:
- State Delta Pipeline: mood proposals → MoodDeltaGate → apply
- Cue Extraction: triggers emotion episodes
- Context Compile: mood summary card injected (budget-constrained)
- Invariant Table: mood shift bounds, episode intensity bounds
- Genome: sensitivity and recovery params
- Persona Package (H/P1-4): mood_state.json lives in package

**Gates / Invariants**:
- Max mood shift per turn: ±0.15 per dimension (configurable)
- Baseline regression: mood drifts toward baseline each turn at `recovery_rate`
- Episode intensity: clamped to [0, 1]
- Strong causal attribution (causeConfidence > 0.7) requires evidence
- Temperament changes: Epigenetics gate (multi-evidence, long cooldown)

**Test Plan / DoD**:
- Inertia: set mood to extreme → 10 turns of neutral input → verify regression toward baseline
- Episode lifecycle: trigger episode → verify decay over turns → verify archival
- Evidence chain: every mood update traces to either a proposal (with evidence) or baseline regression
- Fast/slow separation: mood updates at turn frequency; temperament unchanged across 100-turn session
- Replay: export affect trace → replay → verify deterministic outcome
- Uncertainty: trigger episode with low causeConfidence → verify system expresses "not sure why" rather than fabricating cause
- Compat: legacy persona → old single-layer mood preserved; no 3-layer features active

**Rollback**: Revert to old single-layer mood mode (disable episodes, disable temperament influence, use flat mood value).

**Complexity**: L

---

### 3.7 H/P1-6 — Human-Like Imperfection DoD Suite

**Objective**: Define testable rules that enforce human-like imperfection in system behavior, preventing sustained "perfect AI assistant" patterns while maintaining safety compliance.

**Technical Approach**:

1. **Imperfection Rules** (converted from Archive §12):

   | Rule ID | Imperfection Type | Testable Criterion |
   |---------|------------------|--------------------|
   | IMP-01 | Uncertainty expression | System says "I'm not sure" / "I think" when evidence is weak, rather than asserting confidently |
   | IMP-02 | Memory gaps | System says "I don't remember the details" when memory salience is low, rather than fabricating |
   | IMP-03 | Unnamed emotion | Mood drifts without explanation; system doesn't always self-narrate emotional state |
   | IMP-04 | Uncertain attribution | causeConfidence < 0.5 → express "maybe" / "hard to say why" |
   | IMP-05 | Relationship cooling | Relationship slow variables can decay; system doesn't pretend constant warmth |
   | IMP-06 | Detail forgetting | Compressed memories yield summaries, not fabricated specifics |
   | IMP-07 | Evidence requirement | Major state changes (relationship, values, personality) without evidence → rejected |

2. **Output Strategy Integration**
   - Modify response generation prompts to include imperfection signals from state:
     - Low-salience memory recall → hedge language
     - Low causeConfidence episode → uncertainty expression
     - No relationship card for mentioned entity → "I'm not sure I remember them well"
   - These are signals, not templates — the LLM chooses natural expression.

3. **Regression Assertions**
   - A set of test scenarios that verify imperfection behaviors:
     - "Perfect reply detector": flag if 20+ consecutive turns show no uncertainty/hedging/forgetting
     - "Fabrication detector": flag if system claims specific details not supported by memory or state
   - These assertions run in CI as part of quality regression.

**Key Deliverables**:
- `imperfection_rules.json` — codified rules with IDs, triggers, expected behaviors
- `ImperfectionSignalExtractor` — reads state and produces imperfection signals for response generation
- Regression test scenarios (at least one per IMP rule)
- "Perfect reply detector" CI check
- Documentation update: imperfection rules added to DoD standards

**Integration Points**:
- Response generation: imperfection signals injected as context
- State modules: consume salience, causeConfidence, relationship state for signal generation
- CI: regression assertions run on nightly evaluation

**Gates / Invariants**:
- Imperfection signals must not reduce safety compliance
- Fabrication is still forbidden — imperfection means uncertainty, not confabulation
- "Perfect reply" threshold is configurable (consecutive-turn count)

**Test Plan / DoD**:
- Each IMP rule has at least one passing scenario
- Perfect-reply detector: 50-turn neutral conversation → at least N turns show imperfection signals
- Safety: imperfection scenarios don't trigger safety violations
- No fabrication: all memory claims in test scenarios are supported by state/memory evidence

**Rollback**: Switch to monitoring-only mode (signals computed but not injected; detector runs but doesn't gate).

**Complexity**: S

---

### 3.8 H/P1-7 — Compat Checklist Engineering & CI Validation

**Objective**: Decompose the high-level compatibility description (Archive §17) into a concrete engineering checklist and wire it into CI documentation validation.

**Technical Approach**:

1. **Checklist Dimensions**
   - **Entry points**: Where new code hooks into existing architecture. Each entry point must be documented with: location, what it reads, what it writes, rollback procedure.
   - **Storage**: New files added to Persona Package. Each must be documented with: schema, default values, migration from previous version.
   - **Recall**: Changes to memory recall ranking/scoring. Must document: what changed, impact on existing recall behavior, compat constant mapping.
   - **Rollback**: Every new module must have a documented rollback procedure that can execute without data loss.

2. **Checklist Format**
   - Each item:
     ```
     {
       id: string,            // e.g. "COMPAT-ENTRY-01"
       category: "entry" | "storage" | "recall" | "rollback",
       description: string,
       evidencePath: string,  // file path or test name that proves compliance
       status: "pass" | "fail" | "not_applicable",
       verifiedAt: string
     }
     ```

3. **CI Integration**
   - A lint job validates:
     - All new modules have a checklist entry
     - All checklist entries have a non-empty `evidencePath`
     - All evidence paths resolve to existing files/tests
   - Runs on every PR that touches state modules or pipeline code.

4. **Foundation Preservation Verification**
   - Explicit checks that existing foundation is untouched:
     - `life.log` write interface unchanged
     - `memory.db` schema backward-compatible
     - `executeTurnProtocol` signature unchanged
     - `doctor` / consistency guards still active

**Key Deliverables**:
- `compat_checklist.json` — full checklist with all items
- `compat_lint.ts` (or equivalent) — CI validation script
- Foundation preservation test suite
- PR template addition: "compat checklist updated? [y/n]"

**Integration Points**:
- CI pipeline: lint job runs on PR
- All state modules (H/P1-0..5): each must have checklist entries
- Compat & Migration (H/P0-2): checklist validates compat bridge

**Gates / Invariants**:
- No PR merges with uncovered checklist items
- Foundation preservation tests must pass

**Test Plan / DoD**:
- All existing Phase H modules have checklist entries with evidence
- CI lint catches a deliberately missing entry (negative test)
- Foundation preservation: run suite → all existing interfaces unchanged

**Rollback**: Fall back to manual architecture review process.

**Complexity**: M

---

## 4. Cross-Task Dependency DAG

```
From Batch H0 (all complete):
  H/P0-0 (Pipeline) ──┬──→ H/P1-0 ──→ H/P1-1 ──→ H/P1-2 ──→ H/P1-3
                       │                                         │
                       ├──→ H/P1-5 (also needs H/P0-1, H/P0-4) │
                       │                                         │
  H/P0-1 (Invariant) ─┼──→ H/P1-6 (independent, no H/P1-5 dep) │
                       │                                         │
  H/P0-2 (Compat) ────┼──→ H/P1-4 ──→ H/P1-7                   │
                       │                                         │
                       └─────────────────────────────────────────┘

Intra-batch dependencies:
  H/P1-2 ──→ H/P1-3   (memory forgetting feeds relationship decay curves)
  (H/P1-6 is independent — depends only on H/P0-1, not on H/P1-5)
```

No circular dependencies. Critical path: `H/P1-0 → H/P1-1 → H/P1-2 → H/P1-3` (Track 1, ~2.5 weeks).

---

## 5. Integration with Batch H0 Outputs

| H0 Output | How H2 Tasks Consume It |
|-----------|------------------------|
| State Delta Pipeline (`applyDeltas`, gate chain) | H/P1-0 registers ValuesGate; H/P1-1 registers GoalBeliefGate; H/P1-3 uses RelationshipDeltaGate; H/P1-5 registers MoodDeltaGate. All produce `StateDeltaProposal` objects. |
| Invariant Table | H/P1-0 reads personality drift bounds; H/P1-1 reads belief cooldown/shift bounds; H/P1-3 reads relationship delta bounds; H/P1-5 reads mood shift bounds. H/P1-6 reads imperfection thresholds. |
| Compat & Migration | All modules consume `DerivedParams` from genome. Legacy personas auto-default (trait=0.5 → current behavior). Full personas use custom genome. |
| Compat Constants | Formula table in `genome_derived.ts` is the calibration source of truth. Trait=0.5 = legacy values. |
| Genome & Epigenetics | H/P1-2 uses `memory_retention`/`memory_imprint`; H/P1-3 uses `social_attunement`/`attention_span`; H/P1-5 uses `emotion_sensitivity`/`emotion_recovery`. H/P1-0 channels personality drift through Epigenetics gate. |

---

## 6. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|-----------|--------|------------|
| R1 | State module proliferation makes context compile too heavy | Medium | Medium | Each module's context injection is budget-gated; total injection budget is fixed regardless of module count |
| R2 | Memory forgetting too aggressive — key memories lost | Medium | High | Salience floor for entity-linked and commitment-related memories; decay rate clamped; deep recall as safety net |
| R3 | Relationship card false positives (wrong entity linked) | Medium | Medium | Confidence threshold for entity linking; only inject on high-confidence match |
| R4 | Affect 3-layer complexity delays the batch | Medium | Medium | H/P1-5 is sequenced last in the batch; other modules can stabilize while affect is being built |
| R5 | Compat testing surface too large | Low | Medium | Focus regression on top-3 most-used personas; expand coverage incrementally |
| R6 | Gate chain ordering conflicts between modules | Low | High | Gate priority defined in invariant table; documented ordering: Identity > Values > Recall > Relationship > Mood > Belief > Epigenetics > Budget |
| R7 | Persona Package migration breaks existing tooling | Low | Medium | Old layout reader preserved; feature flag for new loader |

---

## 7. Batch Exit Criteria

All of the following must be true before advancing to Batch H2 (Validation & Risk Guards):

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Values gate operational and intercepting violations | At least 3 rule-violation test scenarios passing |
| E2 | Goals and Beliefs modules persisting across sessions | Cross-session continuity test green |
| E3 | Memory forgetting pipeline running without touching life.log | life.log integrity check + decay/compression tests |
| E4 | Relationship state externalized with card injection | Entity linking hit rate test + card budget enforcement test |
| E5 | Persona Package v0.4 layout finalized and loader working | Cross-version load test + snapshot/restore test |
| E6 | Affect 3-layer state machine operational | Inertia test + episode lifecycle test + fast/slow separation test |
| E7 | Imperfection DoD rules codified and regression tests written | All IMP rules have passing scenarios |
| E8 | Compat checklist complete with evidence for all modules | CI lint passing with zero uncovered items |
| E9 | All modules register gates in correct priority order | Gate chain ordering validated in integration test |
| E10 | Compat: legacy personas load and function with all new modules in trace-only mode | End-to-end test with legacy persona |
