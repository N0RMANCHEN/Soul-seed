# Hc-1-1 — Relationship Continuity Regression

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-1-1  
> **Task**: H/P1-8  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-1-Regression-Suites.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §18.1, `doc/plans/H3-Validation-and-Guards.md` §4.1

---

## 1. Objective

Prove Relationship first-class state (H/P1-3) delivers stable, long-term relationship continuity: the system knows who someone is, what the relationship is, and what happened recently — without relying on memory search hits.

---

## 2. Regression Dimensions (Archive §18.1)

| Dimension | Metric | Threshold |
|-----------|--------|-----------|
| Entity hit rate | Name/alias mention → entityId resolution | ≥ 99% on known entities |
| Card injection accuracy | Entity hit → relationship card injected with correct data | ≥ 95% |
| Cross-session identity stability | Same person across N sessions → same entityId | 100% for entities with ≥ 3 interactions |
| Relationship dimension accuracy | trust/closeness/familiarity within ±0.1 of expected | ≥ 90% of test cases |
| Cold-start graceful degradation | New entity → no hallucinated relationship history | 0 false claims |

---

## 3. Key Deliverables

- [ ] Scenario corpus: `test/regression/relationship/scenarios/*.json` (min 20 sequences)
- [ ] Scoring script: `scripts/regression/relationship_continuity.ts`
- [ ] Threshold config: `config/regression/relationship_thresholds.json`
- [ ] CI job: `ci:regression:relationship` (nightly + PR-subset)
- [ ] Baseline report committed

---

## 4. Scenario Design (min 5 types)

1. Alias resolution (full name, nickname, pronoun → same entityId)
2. Relationship evolution (30-turn trust increase)
3. Cooling/decay (50-turn gap, entity persists)
4. Conflict handling (negative interaction → trust drop)
5. Multi-entity disambiguation

---

## 5. DoD

- All five dimensions at or above threshold
- Metrics stable across 3 consecutive runs
- CI job green and wired

---

## 6. Rollback

Revert to manual spot-check. Scripts remain but not CI-blocking.
