# Hb-1-4 — Human-Like Imperfection DoD Suite

> **Phase**: Hb — Mind Model State Modules  
> **Subplan**: Hb-1-4 (Imperfection DoD)  
> **Parent**: `doc/plans/Hb-Mind-Model-State-Modules.md`  
> **Tasks**: 1 (H/P1-6)  
> **Execution Strategy**: Independent (after H/P0-1); parallel with other Hb-1 tasks  
> **Status**: `done`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §12

---

## 1. Objective

Convert "non-omniscient, non-perfect, allows uncertainty" into testable rules. Prevent sustained "perfect AI assistant" patterns while maintaining safety compliance.

---

## 2. Task Detail

### 2.1 H/P1-6 — Human-Like Imperfection DoD Suite

**Objective**: Codify imperfection rules; integrate with output strategy; add regression assertions.

#### Imperfection Rules (from Archive §12)

| Rule ID | Type | Testable Criterion |
|---------|------|-------------------|
| IMP-01 | Uncertainty expression | "I'm not sure" / "I think" when evidence weak |
| IMP-02 | Memory gaps | "I don't remember the details" when salience low |
| IMP-03 | Unnamed emotion | Mood drifts without always self-narrating |
| IMP-04 | Uncertain attribution | causeConfidence < 0.5 → "maybe" / "hard to say why" |
| IMP-05 | Relationship cooling | Slow variables can decay; no constant warmth |
| IMP-06 | Detail forgetting | Compressed memories → summaries, not fabricated specifics |
| IMP-07 | Evidence requirement | Major state changes without evidence → rejected |

#### Key Deliverables

| Artifact | Description |
|----------|-------------|
| imperfection_rules.json | Codified rules with IDs, triggers, expected behaviors |
| ImperfectionSignalExtractor | Reads state → produces signals for response generation |
| Regression scenarios | At least one per IMP rule |
| "Perfect reply detector" | CI check: flag 20+ consecutive turns with no uncertainty |
| Documentation | Imperfection rules in DoD standards |

#### Output Strategy Integration

- Low-salience memory recall → hedge language
- Low causeConfidence episode → uncertainty expression
- No relationship card for mentioned entity → "I'm not sure I remember them well"
- Signals, not templates — LLM chooses natural expression.

---

## 3. DoD

- Each IMP rule has at least one passing scenario.
- Perfect-reply detector: 50-turn neutral conversation → ≥N turns show imperfection signals.
- Safety: imperfection scenarios don't trigger safety violations.
- No fabrication: all memory claims supported by state/memory evidence.

---

## 4. Rollback

Switch to monitoring-only mode (signals computed but not injected; detector runs but doesn't gate).

---

## 5. Integration Points

- Response generation: imperfection signals injected as context
- State modules: salience, causeConfidence, relationship state for signal generation
- CI: regression assertions on nightly evaluation
- Invariant Table (H/P0-1): imperfection thresholds

---

## 6. Exit Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| E1 | All IMP rules have scenarios | Each rule has passing test |
| E2 | Perfect-reply detector | 50-turn → ≥N imperfection signals |
| E3 | Safety preserved | No safety violations in imperfection scenarios |
| E4 | No fabrication | Memory claims supported by evidence |
