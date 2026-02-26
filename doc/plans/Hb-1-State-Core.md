# Hb-1 — State Core (Values, Goals, Beliefs, Memory, Relationships, Affect, Imperfection)

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-1 (State Core)  
> **Schedule**: W4–W6 (primary track)  
> **Tasks**: 6 (H/P1-0, H/P1-1, H/P1-2, H/P1-3, H/P1-5, H/P1-6)  
> **Execution Strategy**: Serial primary; H/P1-6 parallel; H/P1-5 after sync-1  
> **Status**: `done`  
> **Parent**: `doc/plans/Hb-Mind-Model-State-Modules.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §5–§12, `doc/plans/H2-State-Modules.md`

---

## 1. Subplan Objective

Implement the six state-core modules that plug into the State Delta Pipeline:

1. **H/P1-0**: Values / Personality — runnable gate rules; personality slow drift.
2. **H/P1-1**: Goals / Beliefs — state modules with slow-update rules.
3. **H/P1-2**: Memory Forgetting — decay + interference + compression (life.log untouched).
4. **H/P1-3**: Relationship State — people registry + relationship state + card injection.
5. **H/P1-5**: Affect 3-Layer — mood baseline + emotion episodes + temperament.
6. **H/P1-6**: Imperfection DoD — testable rules for uncertainty, forgetting, non-perfect replies.

---

## 2. Execution Strategy

**Serial primary.** H/P1-3 depends on H/P1-2 (memory decay feeds relationship curves). H/P1-5 depends on H/P0-4 (sync-1). H/P1-6 is independent (only H/P0-1) and can run in parallel.

```
H/P1-0 → H/P1-1 → H/P1-2 → H/P1-3 ──────┐
                                         ├──→ H/P1-5 (after H/P0-4)
H/P1-6 (parallel, after H/P0-1) ──────────┘
```

### Nested Subplans

| File | Tasks | Description |
|------|-------|--------------|
| `Hb-1-1-Identity-Beliefs.md` | H/P1-0, H/P1-1 | Values/Personality + Goals/Beliefs |
| `Hb-1-2-Memory-Relationships.md` | H/P1-2, H/P1-3 | Memory Forgetting + Relationship State |
| `Hb-1-3-Affect-Module.md` | H/P1-5 | Affect 3-Layer state machine |
| `Hb-1-4-Imperfection-DoD.md` | H/P1-6 | Human-like imperfection DoD suite |

---

## 3. Dependency Graph

```
H/P0-0 (Pipeline) ──→ H/P1-0 ──→ H/P1-1 ──→ H/P1-2 ──→ H/P1-3
H/P0-1 (Invariant) ──→ H/P1-6
H/P0-4 (Genome) ──────→ H/P1-5 (sync-1)
```

---

## 4. Task Summary

| Task | Complexity | Coupling | Owner | Key Deliverables |
|------|-----------|----------|-------|------------------|
| H/P1-0 | M | medium | A | ValuesGate, values_rules.json, personality_profile.json |
| H/P1-1 | M | medium | A | goals.json, beliefs.json, GoalBeliefGate |
| H/P1-2 | M | medium | A | MemoryDecayJob, InterferenceScorer, MemoryCompressor |
| H/P1-3 | M | medium | A | people_registry.json, relationship_state.json, EntityLinker, RelationshipCardGenerator |
| H/P1-5 | L | high | A | mood_state.json, EmotionEpisodeManager, MoodDeltaGate |
| H/P1-6 | S | low | A | imperfection_rules.json, ImperfectionSignalExtractor, regression scenarios |

---

## 5. Risk Register

| # | Risk | Mitigation |
|---|------|------------|
| R1 | Memory forgetting too aggressive | Salience floor; decay rate clamped; deep recall safety net |
| R2 | Relationship card false positives | Confidence threshold for entity linking |
| R3 | Affect 3-layer complexity | H/P1-5 sequenced last; other modules stabilize first |
| R4 | Gate chain ordering conflicts | Gate priority in invariant table; documented ordering |

---

## 6. Hb-1 Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | Values gate operational | Rule-violation scenarios passing |
| E2 | Goals/Beliefs cross-session continuity | Continuity test green |
| E3 | Memory forgetting pipeline running | life.log untouched; decay/compression tests pass |
| E4 | Relationship state externalized | Entity linking + card budget tests pass |
| E5 | Affect 3-layer operational | Inertia + episode lifecycle + fast/slow separation tests |
| E6 | Imperfection DoD codified | All IMP rules have passing scenarios |
