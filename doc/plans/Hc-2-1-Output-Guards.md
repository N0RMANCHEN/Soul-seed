# Hc-2-1 — Output Guards (Over-Numericalization + Relationship Noise)

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-2-1  
> **Tasks**: H/P1-12, H/P1-13  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-2-Risk-Guards.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §20.1–§20.2, `doc/plans/H3-Validation-and-Guards.md` §5.1–§5.2

---

## 1. H/P1-12 — Over-Numericalization Guard

### Objective

Prevent raw numeric parameters (mood, trust, traits) from appearing in user-facing output. Replies must stay natural-language dominant.

### Approach (Archive §20.1)

- Post-generation scan for numeric parameter patterns (trust: 0.x, mood 0.x, trait values)
- Metrics: Numeric overload rate < 2%; dashboard-style rate < 1%
- Mode: block or warn (configurable)

### Key Deliverables

- [ ] Output scanner: `src/guards/overNumericalization.ts`
- [ ] Config: `config/guards/over_numericalization.json`
- [ ] Tests: `test/guards/over_numericalization.test.ts`
- [ ] CI integration

### Rollback

Degrade to warn-only mode.

---

## 2. H/P1-13 — Relationship Noise Guard

### Objective

Control relationship card injection frequency and weight. Prevent "noise" from excessive or irrelevant cards.

### Approach (Archive §20.2)

- Confidence threshold for entity linking
- Hard cap: 1–2 cards per turn
- Cards must be short and "relevant to this turn"

### Key Deliverables

- [ ] Card injection gate: `src/guards/relationshipNoise.ts`
- [ ] Config: `config/guards/relationship_noise.json` (confidence threshold, max cards)
- [ ] Tests: `test/guards/relationship_noise.test.ts`
- [ ] CI integration

### Rollback

Relax thresholds (config-driven).

---

## 3. Dependency

- H/P1-12: 四层语义路由门禁 (done)
- H/P1-13: H/P1-3 (Relationship State)
