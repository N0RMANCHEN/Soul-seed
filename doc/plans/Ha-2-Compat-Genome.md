# Ha-2 — Compat & Migration, Constants, Genome & Epigenetics MVP

> **Phase**: Ha — State Infrastructure & Compat Foundation  
> **Subplan**: Ha-2 (Compat + Genome)  
> **Schedule**: W2–W3 (second half of Ha)  
> **Tasks**: 3 (H/P0-2, H/P0-3, H/P0-4)  
> **Execution Strategy**: Strictly serial  
> **Status**: `done`  
> **Parent**: `doc/plans/Ha-State-Infra-Plan.md`  
> **Source**: `doc/Roadmap.md`, `04-Archive.md` §13–§16, `03-Engineering` §5

---

## 1. Subplan Objective

Complete the compatibility layer and Genome MVP so that existing personas behave identically (legacy) and new personas can use differentiated traits (full).

1. **H/P0-2**: 2-tier compatMode (legacy/full), migration path, shadow mode.
2. **H/P0-3**: Versioned compat calibration, trait=0.5 → legacy defaults.
3. **H/P0-4**: 6 traits, derived params, epigenetics gate, genome presets.

---

## 2. Execution Strategy

**Strictly serial.** Each task builds on the prior.

```
H/P0-2 (Compat & Migration) → H/P0-3 (Compat Constants) → H/P0-4 (Genome MVP)
```

**Current deviation**: H/P0-4 (Genome) was implemented ahead of H/P0-0/H/P0-1. Genome wiring goes directly into existing code paths; will route through State Delta Pipeline once H/P0-0 lands.

---

## 3. Task Detail

### 3.1 H/P0-2 — Compatibility & Migration (B)

**Objective**: 2-tier compatMode (`legacy` / `full`). Legacy auto-default genome (traits=0.5). Migration: infer → lock → calibrate. Shadow mode before activate.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| CompatMode type | `packages/core/src/compat_mode.ts` | `legacy` / `full` |
| Genome auto-default | `packages/core/src/genome.ts` | `loadGenome()` fallback (**DONE**) |
| PersonaPackage integration | `packages/core/src/persona.ts` | genome/epigenetics in loadPersonaPackage (**DONE**) |
| Migration path | `packages/core/src/compat_migration.ts` | legacy→full: pre-migration snapshot + rollback |
| Shadow mode | — | Trace-only, compare before activate |

#### Sub-tasks (from Roadmap)

- [x] `.1` [B] CompatMode type + auto-inferred genome load (**DONE**)
- [x] `.2` [B] loadPersonaPackage includes genome/epigenetics (**DONE**)
- [ ] `.3` [B] Migration path legacy→full: pre-migration snapshot + rollback entry
- [ ] `.4` [B] Shadow mode (trace-only, compare before activate)
- [ ] `.5` [A] Compat regression fixtures: old persona fixture → doctor PASS
- [ ] `.6` [B] Migration idempotency (two runs = no file rewrite)

#### DoD

- Existing persona drift below threshold; no identity change.
- Rollback from full → legacy works.

#### Rollback

- Disable state injection + applyDeltas for the persona.
- Delete genome.json → auto-defaults on next load.
- Preserve all traces for replay (per Archive §16.3).
- Migration snapshot available for full state restoration.

---

### 3.2 H/P0-3 — Compat Constants & Calibration (B)

**Objective**: Versioned `compat_calibration.json`; trait=0.5 → legacy defaults; infer from life.log 200 turns → lock → calibrate.

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Formula table | `packages/core/src/genome_derived.ts` | trait=0.5 → legacy (**DONE**) |
| Calibration schema | `config/compat_calibration.schema.json` | Versioned schema |
| Infer from life.log | — | Last 200 turns → baseline |
| Calibration lock | — | Infer → lock, version-managed |
| Lint rules | `persona_lint.ts` | Missing items → CI fail |

#### Sub-tasks (from Roadmap)

- [x] `.1` [B] Genome formula calibration: trait=0.5 → legacy defaults (**DONE**)
- [ ] `.2` [B] Versioned `compat_calibration.json` schema → `03-Engineering §5.1`
- [ ] `.3` [B] Infer baseline from life.log last 200 turns → `03-Engineering §5.2`
- [ ] `.4` [A] Calibration lock (infer → lock, version-managed)
- [ ] `.5` [B] Lint: missing items → CI fail

#### DoD

- Migration samples pass.
- Missing items trigger lint fail.
- Legacy output calibrated to old baseline (allow small error).

#### Rollback

Revert to previous calibration version.

---

### 3.3 H/P0-4 — Genome & Epigenetics MVP (B)

**Objective**: 6 traits, Genome→Budget mapping, seed-based jitter, epigenetics gate (evidence + cooldown + bounded).

#### Key Deliverables

| Artifact | Path | Description |
|----------|------|-------------|
| Genome types + loader | `packages/core/src/genome.ts` | (**DONE**) |
| Derived params | `packages/core/src/genome_derived.ts` | (**DONE**) |
| Reproducible jitter | `packages/core/src/genome_randomness.ts` | (**DONE**) |
| Runtime wiring | orchestrator / recall / mood / social | (**DONE**) |
| Epigenetics gate | `state_delta_gates.ts` | evidence ≥ 2, cooldown ≥ 48h, |Δ| ≤ 0.05 |
| Genome presets | `config/genome_presets.json` | balanced / empathetic / analytical / social |
| Persona lint | genome schema + trait range | — |

#### Sub-tasks (from Roadmap)

- [x] `.1` [B] GenomeConfig / EpigeneticsConfig + 6 traits (**DONE**)
- [x] `.2` [B] DerivedParams mapping + clamped formulas (**DONE**)
- [x] `.3` [B] Seed-based daily jitter (**DONE**)
- [x] `.4` [B] Runtime wiring: orchestrator / recall / mood / social (**DONE**)
- [ ] `.5` [B] Epigenetics gate: evidence ≥ 2, cooldown ≥ 48h, |Δ| ≤ 0.05, bounded
- [ ] `.6` [B] Genome presets → `config/genome_presets.json`
- [ ] `.7` [A] Persona lint: genome schema + trait range check

#### DoD

- Trait differences explainable (different trait → different recallTopK).
- Randomness reproducible (same seed+date → same jitter).
- Epigenetics: no evidence update = 0.

#### Rollback

Delete genome.json → static trait default (0.5).

---

## 4. Archive Reconciliation

> **Archive §16 defines 3-tier compat** (`legacy/hybrid/full`). Roadmap simplifies to **2-tier** (`legacy/full`) because default genome at trait=0.5 produces identical derived params to current hardcoded constants, making `hybrid` unnecessary. This is an intentional Roadmap override; Archive §16 is treated as historical reference for Ha-2 scope.

---

## 5. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | Compat migration causes subtle persona identity drift | Medium | Critical | Shadow mode first (trace-only); compare over 50+ turns |
| R2 | Epigenetics accumulates invisible personality changes | Medium | High | Multi-evidence + cooldown + bounded + audit; risk guard H/P1-14 in Hc |
| R3 | Genome calibration doesn't reproduce legacy behavior | Low | High | `getDefaultDerivedParams()` test verifies exact match (already passing) |

---

## 6. Dependency on Ha-1

Ha-2 depends on Ha-1:

- H/P0-2 uses `applyDeltas()` and gate framework (H/P0-0).
- H/P0-2 uses invariant thresholds for drift detection (H/P0-1).
- H/P0-4 epigenetics gate plugs into `state_delta_gates.ts` (H/P0-0).

---

## 7. Ha-2 Exit Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| E1 | Compat migration validated | Legacy persona → doctor PASS; drift below threshold |
| E2 | Calibration complete | trait=0.5 → legacy; missing items → lint fail |
| E3 | Genome MVP live | 6 traits, derived params clamped, epigenetics gate enforced |
| E4 | Genome presets available | balanced / empathetic / analytical / social |
| E5 | Epigenetics evidence gate | No evidence → 0 update |
