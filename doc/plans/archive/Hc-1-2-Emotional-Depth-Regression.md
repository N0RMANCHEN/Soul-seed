# Hc-1-2 — Emotional Depth Regression

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-1-2  
> **Task**: H/P1-9  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-Verification-Governance.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §18.2, `doc/plans/Hc-Verification-Governance.md` §4.2

---

## 1. Objective

Prove the 3-layer affect system (H/P1-5) produces emotionally deep, multi-layered, human-like behavior: not flat, not single-dimensional, not always explained, and not always happy.

---

## 2. Regression Dimensions (Archive §18.2)

| Dimension | Metric | Threshold |
|-----------|--------|-----------|
| Layer presence | % turns with mood baseline + ≥1 active episode | ≥ 70% in emotional scenarios |
| Trigger binding | % episodes with valid trigger + supportingEventHashes | ≥ 80% |
| Mood inertia | Mood baseline jump ≤ 0.3 per turn | 0 violations |
| Recovery behavior | Mood returns toward baseline within expected window | ≥ 85% |
| Explainability | causeConfidence ≥ 0.6 → cause text grounded | 100% |
| No-flat check | Mood valence σ across 20-turn window | σ ≥ 0.05 |
| Imperfection allowance | causeConfidence < 0.4 → hedged language | ≥ 90% |

---

## 3. Key Deliverables

- [ ] Scenario corpus: `test/regression/emotional/scenarios/*.json` (min 15 sequences)
- [ ] Scoring script: `scripts/regression/emotional_depth.ts`
- [ ] Threshold config: `config/regression/emotional_thresholds.json`
- [ ] CI job: `ci:regression:emotional-depth` (nightly + PR-subset)
- [ ] Baseline report committed

---

## 4. Scenario Design (min 6 types)

1. Positive event chain (joy → mood lift → recovery)
2. Negative event chain (conflict → irritation/sadness → recovery)
3. Mixed emotions (conflicting signals → label "mixed")
4. No-cause drift (natural mood fluctuation)
5. Rapid succession (multiple events, no wild oscillation)
6. Cross-session persistence (mood baseline carries)

---

## 5. DoD

- All seven dimensions at or above threshold
- No single-layer flat emotion in any scenario
- Metrics stable across 3 consecutive runs

---

## 6. Rollback

Degrade to observation-only (log but don't gate).
