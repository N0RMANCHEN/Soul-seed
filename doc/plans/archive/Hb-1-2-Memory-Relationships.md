# Hb-1-2 — Memory Forgetting & Relationship State

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-1-2 (Memory & Relationships)  
> **Parent**: `doc/plans/Hb-Mind-Model-State-Modules.md`  
> **Tasks**: 2 (H/P1-2, H/P1-3)  
> **Execution Strategy**: Serial (H/P1-3 depends on H/P1-2)  
> **Status**: `todo`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §5, §9

---

## 1. Objective

Implement human-like memory forgetting (decay, interference, compression) and externalize relationship state with people registry and card injection.

---

## 2. Task Detail

### 2.1 H/P1-2 — Memory Forgetting & Compression Pipeline

**Objective**: Decay + interference + compression pipeline. `life.log` never modified.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| MemoryDecayJob | `packages/core/src/memory_forgetting.ts` | Salience decay over time |
| InterferenceScorer | — | Similarity-based suppression during recall |
| MemoryCompressor | — | Merge low-salience clusters into summaries |
| DeepRecallHandler | — | Targeted evidence retrieval from archive |
| Schema additions | memory.db | salience column, status field, summary records |

#### Sub-tasks (from Roadmap)

- [ ] Implement decay: salience *= exp(-decay_rate * days_since_last_access)
- [ ] Implement interference: similarity threshold → suppress older entries
- [ ] Implement compression: cluster → summary; originals archived (status: "compressed")
- [ ] Genome integration: memory_retention → decay_rate; memory_imprint → salience gain
- [ ] Deep recall: budget-gated evidence retrieval

#### DoD

- life.log integrity: byte-identical after all operations.
- Capacity controlled; key recall accuracy above threshold.
- Decay/interference/compression tests pass.

#### Rollback

Disable compression and interference; revert to raw salience-only recall.

---

### 2.2 H/P1-3 — Relationship First-Class State

**Objective**: Externalize relationships — people registry, per-entity relationship state, card injection with budget.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| people_registry.json | Persona Package | entityId, canonicalName, aliases, tags |
| relationship_state.json | Persona Package | closeness, trust, affinity, tension, etc. per entityId |
| EntityLinker | — | name/alias → entityId resolution |
| RelationshipCardGenerator | — | state → short context card |
| RelationshipDecayJob | — | Periodic baseline regression |
| RelationshipDeltaGate | state_delta_gates.ts | Rate-limit; evidence for large jumps |

#### Sub-tasks (from Roadmap)

- [ ] Define people_registry.json and relationship_state.json schemas
- [ ] Implement EntityLinker (confidence threshold)
- [ ] Implement RelationshipCardGenerator (budget from attention_span)
- [ ] Implement RelationshipDecayJob (relationship cooling)
- [ ] Register RelationshipDeltaGate in pipeline

#### DoD

- Entity linking: input mentions name → 100% hit → card injected.
- Relationship continuity: 20-turn conversation → state tracks consistently.
- Rate limit: large trust jump without evidence → clamped/rejected.
- Card budget: max 1–2 cards per turn.

#### Rollback

Fall back to memory-only relationship awareness (disable registry, cards, relationship state).

---

## 3. Execution Order

```
H/P1-2 (Memory Forgetting) → H/P1-3 (Relationship State)
```

H/P1-3 depends on H/P1-2: relationship detail decay uses Memory Forgetting pipeline; decay curves inform relationship cooling.

---

## 4. Storage / Schema Gate (contributing_ai.md §5.3)

- `relationship_state.json` already in DOMAIN_FILE_MAP. If `people_registry.json` becomes a state file, register in `StateDeltaDomain` and `DOMAIN_FILE_MAP`.
- Memory.db schema changes: add schema version check and upgrade path.
- life.log: append-only invariant; never modify.

## 5. Integration Points

- Recall pipeline: interference scoring modifies recall ranking
- State Delta Pipeline: relationship proposals → RelationshipDeltaGate
- Genome (H/P0-4): memory_retention, memory_imprint, social_attunement, attention_span
- Invariant Table (H/P0-1): relationship delta bounds, recall accuracy threshold

---

## 6. Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | life.log untouched | Integrity check after decay/compression |
| E2 | Key recall达标 | Recall accuracy above threshold |
| E3 | Entity linking hit rate | 100% on test names |
| E4 | Relationship state traceable | 20-turn continuity test |
| E5 | Card budget enforced | Max 1–2 cards per turn |
