# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] — Phase H (State Closure & Compatibility Fulfillment)

### Added
- Adaptive decision trace metadata (optional, backward-compatible): `reasoningDepth`, `l3Triggered`, `l3TriggerReason`, `coreConflictMode`, `implicitCoreTension`.
- Turn latency audit enrichment: `turn_latency_profiled` now carries `reasoningDepth` and `slowHintEmitted`.
- **Genome system** (`packages/core/src/genome.ts`): 6 fixed traits (`emotion_sensitivity`, `emotion_recovery`, `memory_retention`, `memory_imprint`, `attention_span`, `social_attunement`) with typed `GenomeConfig` / `EpigeneticsConfig`, validation, and persistent storage.
- **Genome-derived parameters** (`packages/core/src/genome_derived.ts`): Formula table mapping traits to system params (`recallTopK`, `moodDeltaScale`, `baselineRegressionSpeed`, `memoryHalfLifeDays`, `archiveThreshold`, `salienceGain`, `stickyProbability`, `entityCandidateCount`) with clamping.
- **Reproducible daily jitter** (`packages/core/src/genome_randomness.ts`): Seed-based PRNG with inertial smoothing (±0.02 bounded).
- **Genome test suite** (`packages/core/test/genome.test.mjs`): Covers default creation, validation, derived param computation, and daily jitter.
- Phase H execution plans: `doc/plans/H-State-Closure-Plan.md`, `H1-Foundation.md`, `H2-State-Modules.md`, `H3-Validation-and-Guards.md`.
- Phase Ha sub-phase plans: `doc/plans/Ha-State-Infra-Plan.md` (high-level), `Ha-1-State-Delta-Invariant.md` (H/P0-0,1), `Ha-2-Compat-Genome.md` (H/P0-2,3,4).
- Backlog item for Genome → Memory Lifecycle wiring (4 derived params computed but not yet consumed by `memory_lifecycle.ts`).
- Cursor rule `progress-tracking.mdc` for session protocol and verification gates.
- **State Delta Pipeline** (`packages/core/src/state_delta.ts`, `state_delta_gates.ts`, `state_delta_apply.ts`): `proposal → gates → deterministic apply` mechanism for state mutations. 7 gates (identity, recall grounding, relationship, mood, belief, epigenetics, budget). Atomic writes with append-only trace. 12 tests.
- **Invariant Table** (`packages/core/src/invariant_table.ts`, `config/h0/invariant_table.json`): Config-driven threshold rules for all state domains. Completeness checker ensures required domains are covered. 11 tests.
- **Compat Mode** (`packages/core/src/compat_mode.ts`): Explicit 2-tier `legacy`/`full` mode inference from genome state. Feature flag `useStateDeltaPipeline`.
- **Compat Migration** (`packages/core/src/compat_migration.ts`): Legacy→full migration path with pre-migration snapshot, backup, idempotency check, and rollback. 10 tests.
- **Compat Calibration** (`packages/core/src/compat_calibration.ts`): Versioned calibration config with inference from life.log events, lock mechanism, and validation. 8 tests.
- **Genome Presets** (`config/genome_presets.json`): 4 personality presets (balanced, empathetic, analytical, social) with `loadGenomePresets()` and `createGenomeFromPreset()`.
- **Persona Lint genome rules** (`packages/core/src/persona_lint.ts`): `genome_schema_invalid`, `genome_trait_out_of_range`, `epigenetics_adjustment_out_of_range`.
- **Values rules module** (`packages/core/src/values_rules.ts`): value-rule config load/save/evaluate path with priority-based matching.
- **Personality profile module** (`packages/core/src/personality_profile.ts`): bounded slow-drift helper with cooldown gate.
- **Goals/Beliefs state modules** (`packages/core/src/goals_state.ts`, `beliefs_state.ts`): goal lifecycle transition checks and belief confidence/cooldown/evidence update checks.
- **Memory forgetting helpers** (`packages/core/src/memory_forgetting.ts`): decay/interference/compression heuristics aligned to genome-derived policy inputs.
- **People registry module** (`packages/core/src/people_registry.ts`): people registry storage and person-card context compilation.
- New core tests: `values_personality_state.test.mjs`, `goals_beliefs_state.test.mjs`, `memory_forgetting.test.mjs`, `people_registry.test.mjs`, `persona_state_files_init.test.mjs`.

### Changed
- Core conflict policy now uses **explicit-only refusal**: explicit core override still refuses; implicit semantic tension degrades to cautious clarify/brief response instead of hard refusal.
- Adaptive reasoning depth wired into turn protocol and chat runtime (`fast` by default, escalates to `deep` on complexity/ambiguity/low-confidence signals).
- Soul-mode meta-review is now conditionally triggered on risk/quality/deep-path signals to reduce unnecessary slow-path latency.
- Thinking preview default threshold adjusted to `1000ms` (persona defaults + CLI defaults), reusing existing `voice_profile.thinkingPreview` contract.
- **Persona init/load** (`packages/core/src/persona.ts`): New personas auto-create `genome.json` + `epigenetics.json`; `loadPersonaPackage` includes genome/epigenetics with fallback to defaults.
- **PersonaPackage type** (`packages/core/src/types.ts`): Added optional `genome` and `epigenetics` fields; added `stateDeltaProposal` and `deltaCommitResult` to `DecisionTrace`; added `state_delta_committed` and `state_delta_rejected` life event types.
- **ExecuteTurnResult** (`packages/core/src/execution_protocol.ts`): Added optional `deltaCommitResult` field for pipeline output.
- **Orchestrator** (`packages/core/src/orchestrator.ts`): `selectedMemoryCap` now derived from `derivedParams.recallTopK` instead of hardcoded values (legacy parity: base 6, strong +6=12, soft +3=9).
- **Recall budget policy** (`packages/core/src/recall_budget_policy.ts`): Accepts `genomeDerived` param; `injectMax` baseline from `recallTopK + 1` (legacy=7); all profiles respect genome baseline via `Math.max`.
- **Mood state** (`packages/core/src/mood_state.ts`): `decayMoodTowardBaseline` and `evolveMoodStateFromTurn` accept genome-derived `moodDeltaScale` and `baselineRegressionSpeed`.
- **Memory recall** (`packages/core/src/memory_recall.ts`): `injectMax` clamp raised from 12 to 20 to support high-trait personas.
- **CLI wiring** (`packages/cli/src/index.ts`): Computes `genomeDerived` per turn and passes to recall budget, mood evolution, and social graph.
- **2-tier compat model**: Legacy personas auto-load default genome (all traits=0.5) with no behavior change; no hybrid tier.
- `DerivedParams` pruned: removed `cardsCap`, `recentWindowTurns`, `entityLinkingThreshold` (no clear consumer or miscalibrated).
- **Persona initialization** (`packages/core/src/persona.ts`): new persona package now seeds `values_rules.json`, `personality_profile.json`, `goals.json`, `beliefs.json`, `people_registry.json`.
- **Persona lint** (`packages/core/src/persona_lint.ts`): warns on missing optional H/P1 state files and errors on invalid JSON for those files.
- **CLI context injection** (`packages/cli/src/index.ts`): appends people-registry person-card context block alongside social graph block.
- **Roadmap/plan sync**: updated `doc/Roadmap.md`, `doc/plans/H2-State-Modules.md`, and `doc/plans/H-State-Closure-Plan.md` to reflect H/P1-0..H/P1-3 in-progress implementation status and progress notes.
- **Epigenetics gate**: Enhanced with cooldown enforcement — rejects adjustments when `cooldownUntil` is in the future.
- **E2: Zero direct-write paths**: All state writes (mood, relationship, interests, cognition, voice, social_graph) route through the State Delta Pipeline when persona is in full compat mode. Legacy personas retain direct writes. System-generated writes bypass gates via `systemGenerated` flag. New domains added to `StateDeltaDomain` and `DOMAIN_FILE_MAP`. `state_delta_writer.ts` provides `shouldUseStateDeltaPipelineFromRoot` and `writeStateDelta`. CI gate `scripts/check_direct_writes.mjs` enforces no unauthorized state file writes.

### Fixed
- Fixed false-positive policy refusals for benign emotional check-in utterances (e.g. "今天很不对劲...你能感受到吗"), while preserving explicit override refusal behavior.
- `loadGenome` handles corrupted JSON and validation failures by persisting defaults (prevents random seed regeneration).
- Genome formula calibration: `recallTopK` at trait=0.5 produces 6 (matches legacy), `baselineRegressionSpeed` at trait=0.5 produces 0.08 (matches legacy `decayRate`).

## [0.3.0] - 2026-02-25

### Added
- Added roadmap governance rules for execution planning:
  complexity/coupling/risk-based task batching (`parallel` vs `serial`) before implementation.
- Added roadmap release discipline:
  when a full Phase is completed, bump the middle version number (minor).
- Added roadmap phase-onboarding rule:
  when starting a new Phase, complete phase-level ownership/work-split planning first.

### Changed
- Updated project/package versions to `0.3.0` across root/workspaces and lockfile references.
- Updated default persona schema references and H0 compat constants to `0.3.0`.
- Archived Phase G from active roadmap and retained completion record in changelog/Git history.
- Aligned workspace package metadata license with repository `LICENSE` to `CC-BY-NC-ND-4.0` (replacing stale `MIT` declarations).
- Added roadmap-level assessment and delivery plan for conversation experience gaps (interest/attention/proactive continuity), introducing `Phase J` with scheduled tasks.
- Added mandatory `Phase split rule` in roadmap to enforce domain-bounded phase scoping and split triggers by scale/coupling/verification boundary.
- Replanned the full active roadmap without task loss, adding a dedicated `Phase K` for multi-persona chat system delivery (arbitration, turn scheduling, context boundary, CLI flows, and quality gates).

## [0.2.0] - 2026-02-25

### Added
- Added semantic routing tier model (`L1/L2/L3/L4`) and persisted routing evidence in `DecisionTrace`.
- Added unified safety fallback gateway and prompt leak guard with structured trace fields:
  `leak_type`, `source_stage`, `rewrite_applied`.
- Added Lx quality metrics to scorecard path:
  `L1HitRate`, `L2HitRate`, `L3ArbitrationRate`, `L4RegexFallbackRate`, `BusinessPathRegexRate`.
- Added core-level autonomy utterance generator (`greeting/proactive/farewell/exit_confirm`) with
  LLM-first generation, normalization, anti-template guard, and degraded fallback reason codes.
- Added autonomy persistence coverage in chat interaction tests:
  greeting + exit_confirm + farewell are recorded into `life.log` as `assistant_message`.

### Changed
- Migrated capability intent/recall navigation/pronoun role checks to semantic-first path with regex fallback.
- Enhanced capability tool loop to include preflight confirmation explanation, post-success explanation, and failure retry guidance.
- Unified autonomy audit payload fields on assistant messages:
  `autonomyMode`, `autonomySource`, `autonomyReasonCodes`.
- Updated exit-confirm autonomy memory policy to be auditable but non-recallable
  (`memoryMeta.excludedFromRecall=true`) to avoid control-prompt pollution.
- Completed and archived Phase G roadmap scope (control-plane closure, safety fallback convergence, prompt leak governance, degraded persona integrity, latency profiling, group participation control, autonomy utterance naturalization).
