# Hc-2-2 — State Guards (Epigenetics + Genome + LLM Direct-Write)

> **Phase**: Hc — Verification & Governance  
> **Nested Subplan**: Hc-2-2  
> **Tasks**: H/P1-14, H/P1-15, H/P1-16  
> **Status**: `todo`  
> **Parent**: `doc/plans/Hc-2-Risk-Guards.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §20.3–§20.5, `doc/plans/Hc-Verification-Governance.md` §5.3–§5.5

---

## 1. H/P1-14 — Epigenetics Backdoor Guard

### Objective

All Epigenetics updates must have evidence + audit trail. No silent personality changes.

### Approach (Archive §20.3)

- Stricter gate: multi-evidence + long cooldown; bounded; must be rollback-capable; audit required
- DoD: Zero updates without evidence

### Key Deliverables

- [ ] Evidence gate in `state_delta_gates.ts` (epigenetics domain)
- [ ] Audit trail for all epigenetics updates
- [ ] Tests: assert no evidence → rejection
- [ ] CI integration

### Rollback

Degrade to warn-only mode.

---

## 2. H/P1-15 — Genome Trait Expansion Gate

### Objective

MVP stays at 6 traits. New traits require review gate + regression proof.

### Approach (Archive §20.4)

- Whitelist: 6 fixed traits (emotion_sensitivity, emotion_recovery, memory_retention, memory_imprint, attention_span, social_attunement)
- Unapproved trait → reject at load/apply

### Key Deliverables

- [ ] Trait whitelist: `config/genome_trait_whitelist.json`
- [ ] Expansion gate in genome loader / state delta apply
- [ ] Tests: unapproved trait rejected
- [ ] CI integration

### Rollback

Temporary freeze on trait expansion (config flag).

---

## 3. H/P1-16 — LLM Direct-Write Ban

### Objective

Only `proposal → gates → apply` path. Direct-write attempts fail and are audited.

### Approach (Archive §20.5, spec/12)

- All state writes must flow through State Delta Pipeline
- Direct write detection: `scripts/check_direct_writes.mjs` (or equivalent)
- DoD: All direct-write attempts fail and are audited

### Key Deliverables

- [ ] Direct-write detector / CI check
- [ ] Update `scripts/check_direct_writes.mjs` with full coverage
- [ ] Audit log for any detected direct writes
- [ ] CI blocks on direct-write violation

### Rollback

Whitelist temporary bypass (emergency only).

---

## 4. Dependencies

- H/P1-14, H/P1-15: H/P0-4 (Genome & Epigenetics)
- H/P1-16: H/P0-0 (State Delta Pipeline)
