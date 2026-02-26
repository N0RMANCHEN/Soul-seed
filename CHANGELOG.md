# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Phase J P1 closure**: `J/P1-0..P1-2` completed with runtime flags and trace hardening:
  - Added `SOULSEED_PHASE_J_ENABLE`, `SOULSEED_PHASE_J_RECORD_ONLY`, `SOULSEED_PHASE_J_TOPIC_SCHEDULER` runtime toggles in CLI path.
  - Extended `conversationControl` trace with `phaseJMode`, `engagementTrace`, budget remaining/cooldown fields, and topic scheduler `queueSnapshot`/`recycleAction`.
  - Wired cooldown context into conversation budget evaluation and added record-only budget observation mode.
  - Updated Phase J docs/roadmap status and added regression tests for phase-j flags + trace normalization.
- **AG/P2-4** Core export whitelist gate: Wired `config/governance/core_export_whitelist.json` into `arch_governance_check.mjs`; internal-only modules (e.g. `persona_write_lock`) must not be re-exported; new rule `internalModuleReExport` (error).
- **AG/P2-5** Plan naming unification: Removed H1/H2/H3 plan files; updated all references to Ha/Hb/Hc; `doc/plans/README.md` simplified; `planNamingMix` warning resolved.
- **Archive** Architecture Governance 12 项：Architecture-Governance-Roadmap 任务状态全部标记 done，风险总览更新为已闭环，归档说明已添加；Roadmap 当前执行总览补充 AG 完成记录。

### Fixed
- **CLI test** `chat can resume last goal and report progress without creating a new goal`: increased `intervalMs` to 420 to avoid flakiness when run in full suite.

### Changed
- **AG/P0-0** Plan doc update rules: Added `doc/plans/README.md` with fixed declaration (progress 以 Roadmap 为准); replaced granular status in `H-State-Closure-Plan.md`, `H2-State-Modules.md` with scope-level; added Progress declaration to Ha/Hb/Hc/H1/H3 plans; updated `doc/Architecture-Folder-Governance.md` §3.3 cross-ref.
- **AG/P1-2** Persona Package single truth source: Designated `doc/Persona-Package-Layout.md` as canonical; README and AGENT now reference it with brief summary; Hb-2-1 plan references canonical layout.
- **AG/P1-3** Plan naming unification: Added H1/H2/H3 ↔ Ha/Hb/Hc mapping to `doc/plans/README.md`; added mapping header to H1/H2/H3 plan files; H-State-Closure-Plan batch naming clarified.
- **AG/P2-2** Runtime/report asset governance: Added `doc/Runtime-Report-Asset-Governance.md`; README reference; personas/ and reports/ retention/archive policy documented.
- **AG/P2-1** Core export surface: Removed internal-only `persona_write_lock` from barrel; added export policy comment; `config/governance/core_export_whitelist.json`.
- **AG/P2-0** Core directory layering (batch 1): Migrated 6 guards to `guards/` (identity_guard, recall_grounding_guard, factual_grounding_guard, relational_guard, pronoun_role_guard, narrative_guard).

### Added
- Added `doc/Architecture-Governance-Roadmap.md` as an execution-oriented governance roadmap for architecture boundaries, folder/file management, A/B collaboration split, sync points, and acceptance gates.
- Added `doc/Architecture-Folder-Governance.md` as the repository-level architecture/folder governance standard (boundaries, naming, write-path rules, gates, and exception workflow).
- Added architecture governance gate: `scripts/arch_governance_check.mjs` + `config/governance/architecture_rules.json` + `npm run governance:check`; wired into `scripts/verify.sh` as a standard gate.
- Added direct-write registry source `config/governance/state_write_registry.json` and switched `scripts/check_direct_writes.mjs` to registry-driven validation (state files, domain mapping, allowed writers).
- Added direct-write gate tests `scripts/test_direct_writes_gate.mjs` and `npm run direct-writes:test` (allowlisted pass, unauthorized write fail, incomplete registry fail).
- Added CLI argument parser module `packages/cli/src/parser/args.ts`.
- Added CLI command routing modules under `packages/cli/src/commands/` (`router.ts`, `types.ts`, `persona_router.ts`, `memory_router.ts`, `misc_router.ts`) to split main dispatch responsibilities.
- Added doc-code consistency governance gate:
  - `scripts/check_doc_code_consistency.mjs`
  - `config/governance/doc_code_consistency_rules.json`
  - `npm run doc-consistency:check`
  - integrated into `scripts/verify.sh` as non-blocking phase gate.

### Changed
- Enforced workspace dependency consistency by switching `packages/cli` and `packages/mcp-server` `@soulseed/core` dependency to `workspace:*`.
- Tightened architecture governance severity: `workspaceVersionConsistency` promoted from `warn` to `error` in `config/governance/architecture_rules.json`.
- Updated `scripts/arch_governance_check.mjs` to apply rule-configured severity routing consistently across all checks.
- Refactored `packages/cli/src/index.ts` to delegate command dispatch to modular routers while preserving existing CLI behavior and test coverage.
- Updated `doc/Architecture-Governance-Roadmap.md` task status for completed A-track items: `AG/P0-1`, `AG/P0-2`, `AG/P0-3`, `AG/P1-0`, `AG/P1-1`.
- Updated `doc/Architecture-Governance-Roadmap.md` status for `AG/P2-3` to `done` and synchronized governance docs with new check strategy.
- Corrected CLI export manifest documentation in `doc/CLI.md` from `MANIFEST.json` to `EXPORT_MANIFEST.json`.

## [0.5.0] - 2026-02-26

### Phase Hc Complete (Verification & Governance)

All 11 Hc tasks done: H/P1-8 (Relationship continuity regression), H/P1-9 (Emotional depth regression), H/P1-10 (Governance harness), H/P1-12 (Over-numericalization guard), H/P1-13 (Relationship noise guard), H/P1-14 (Epigenetics gate), H/P1-15 (Genome trait whitelist), H/P1-16 (Direct-writes gate), H/P1-17 (Appendix schema contracts), H/P1-18 (Appendix A schemas), H/P1-19 (Appendix B access-point checklist).

### Added
- **Regression suites**: `scripts/regression/relationship_continuity.mjs`, `emotional_depth.mjs`, `governance.mjs`; scenarios under `test/regression/relationship/`, `emotional/`; thresholds in `config/regression/`.
- **Risk guards**: `guards/over_numericalization.ts`, `guards/relationship_noise.ts`; epigenetics gate (evidence required, genome trait whitelist); `scripts/check_direct_writes.mjs` extended (genome.json, epigenetics.json).
- **Schema contracts**: `schemas/v1/*.schema.json` (engagement_plan, interests, topic_state, proactive_plan); `scripts/validate_appendix_a.mjs`; `doc/checklists/appendix_b_access_points.md`.
- NPM scripts: `regression:governance`, `regression:relationship`, `regression:emotional`, `validate:appendix-a`.

## [0.4.0] - 2026-02-26

### Phase Hb Complete (Mind Model State Modules)

All 8 Hb tasks done: H/P1-0 (Values/Personality), H/P1-1 (Goals/Beliefs), H/P1-2 (Memory Forgetting), H/P1-3 (Relationship State), H/P1-4 (Persona Package v0.4), H/P1-5 (Affect 3-Layer), H/P1-6 (Imperfection DoD), H/P1-7 (Compat Checklist).

### Added
- Adaptive decision trace metadata (optional, backward-compatible): `reasoningDepth`, `l3Triggered`, `l3TriggerReason`, `coreConflictMode`, `implicitCoreTension`.
- Turn latency audit enrichment: `turn_latency_profiled` now carries `reasoningDepth` and `slowHintEmitted`.
- **Genome system** (`packages/core/src/genome.ts`): 6 fixed traits (`emotion_sensitivity`, `emotion_recovery`, `memory_retention`, `memory_imprint`, `attention_span`, `social_attunement`) with typed `GenomeConfig` / `EpigeneticsConfig`, validation, and persistent storage.
- **Genome-derived parameters** (`packages/core/src/genome_derived.ts`): Formula table mapping traits to system params (`recallTopK`, `moodDeltaScale`, `baselineRegressionSpeed`, `memoryHalfLifeDays`, `archiveThreshold`, `salienceGain`, `stickyProbability`, `entityCandidateCount`) with clamping.
- **Reproducible daily jitter** (`packages/core/src/genome_randomness.ts`): Seed-based PRNG with inertial smoothing (±0.02 bounded).
- **Genome test suite** (`packages/core/test/genome.test.mjs`): Covers default creation, validation, derived param computation, and daily jitter.
- Phase H execution plans: `doc/plans/H-State-Closure-Plan.md`, `H1-Foundation.md`, `H2-State-Modules.md`, `H3-Validation-and-Guards.md`.
- Phase Ha sub-phase plans: `doc/plans/Ha-State-Infra-Plan.md` (high-level), `Ha-1-State-Delta-Invariant.md` (H/P0-0,1), `Ha-2-Compat-Genome.md` (H/P0-2,3,4).
- Phase Hb sub-phase plans: `doc/plans/Hb-Mind-Model-State-Modules.md` (high-level), `Hb-1-State-Core.md`, `Hb-2-Package-Compat.md` (subplans), `Hb-1-1-Identity-Beliefs.md`, `Hb-1-2-Memory-Relationships.md`, `Hb-1-3-Affect-Module.md`, `Hb-1-4-Imperfection-DoD.md`, `Hb-2-1-Persona-Package.md`, `Hb-2-2-Compat-Checklist.md` (nested subplans).
- **Persona migration**: Export manifest renamed to `EXPORT_MANIFEST.json` to avoid case-insensitive FS conflict with v0.4 `manifest.json` on macOS.
- **Hb-1-2**: Memory Forgetting (decay, interference, compression) + People Registry (EntityLinker, RelationshipCardGenerator, RelationshipDecayJob).
- **Hb-1-3**: Affect 3-Layer (mood baseline, emotion episodes, temperament); AffectContextInjector; MoodDeltaGate evidence chain.
- **Hb-2-2**: Compat checklist (`config/compat_checklist.json`), `compat_lint.mjs`, foundation preservation tests; wired into verify.sh.
- **Compat regression**: Shadow-mode test updated for Hb-1-3 mood gate (strong attribution requires evidence; oversized delta with evidence → clamp).
- Backlog item for Genome → Memory Lifecycle wiring (4 derived params computed but not yet consumed by `memory_lifecycle.ts`).
- Cursor rule `progress-tracking.mdc` for session protocol and verification gates.
- **State Delta Pipeline** (`packages/core/src/state_delta.ts`, `state_delta_gates.ts`, `state_delta_apply.ts`): `proposal → gates → deterministic apply` mechanism for state mutations. 7 gates (identity, recall grounding, relationship, mood, belief, epigenetics, budget). Atomic writes with append-only trace. 12 tests.
- **Invariant Table** (`packages/core/src/invariant_table.ts`, `config/h0/invariant_table.json`): Config-driven threshold rules for all state domains. Completeness checker ensures required domains are covered. 11 tests.
- **Compat Mode** (`packages/core/src/compat_mode.ts`): Explicit 2-tier `legacy`/`full` mode inference from genome state. Feature flag `useStateDeltaPipeline`.
- **Compat Migration** (`packages/core/src/compat_migration.ts`): Legacy→full migration path with pre-migration snapshot, backup, idempotency check, and rollback. 10 tests.
- **Compat Calibration** (`packages/core/src/compat_calibration.ts`): Versioned calibration config with inference from life.log events, lock mechanism, and validation. 8 tests.
- **Genome Presets** (`config/genome_presets.json`): 4 personality presets (balanced, empathetic, analytical, social) with `loadGenomePresets()` and `createGenomeFromPreset()`.
- **Persona Lint genome rules** (`packages/core/src/persona_lint.ts`): `genome_schema_invalid`, `genome_trait_out_of_range`, `epigenetics_adjustment_out_of_range`.
- **Persona Package v0.4** (H/P1-4, Hb-2-1): `manifest.json` schema, `PackageLoader` (loadPersonaPackageV04), `PackageSnapshotter`, `MigrationLogger`. Cross-version load (v0.3→v0.4), snapshot/restore cycle, corrupt file handling, migration log. `initPersonaPackage` now creates `manifest.json` for new packages.
- **Hb-1-1 (Identity & Beliefs) tests** (`packages/core/test/state_delta.test.mjs`): Values gate rule-violation scenarios (when=always, when=value, when=contains:keyword), legacy compat mode (log-only vs reject), belief cooldown, commitment evidence, goals/beliefs cross-session continuity.
- **Hb-1-3 (Affect 3-Layer State Machine)** (H/P1-5): Layer 1 — `mood_state.json` schema extended (valence, arousal, energy, stress, baseline); MoodUpdateHandler (`decayMoodTowardBaseline`) uses Genome `emotion_recovery` → baselineRegressionSpeed; MoodDeltaGate enhanced with inertia, per-turn max shift, evidence requirement for strong attribution (>0.12). Layer 2 — `EmotionEpisode` type (episodeId, trigger, label, intensity, causeConfidence); `EmotionEpisodeManager` (create, decay, archival); `triggerEpisodeFromCue` for Cue Extraction; "not knowing why" supported (low causeConfidence). Layer 3 — `personality_profile` temperament section (moodSusceptibility); Genome `emotion_sensitivity` for delta scale; Epigenetics gate for temperament. `AffectContextInjector` builds mood/episode summary for context; affect informs context, does NOT control emoji/tone templates. `emotion_episodes.jsonl` + `emotion_episode_manager.ts` in direct-writes allowlist.
- **Phase Hc plans** (`doc/plans/`): High-level `Hc-Verification-Governance.md`; subplans `Hc-1-Regression-Suites.md`, `Hc-2-Risk-Guards.md`, `Hc-3-Schema-Access.md`; nested subplans Hc-1-1..3 (regression), Hc-2-1..2 (guards), Hc-3-1..3 (schema/access). Roadmap and H-State-Closure-Plan updated with Hc plan references.
- **Hb-1-2 (Memory Forgetting & Relationship State)** (H/P1-2, H/P1-3): `memory_forgetting.ts` — MemoryDecayJob, InterferenceScorer, MemoryCompressor, DeepRecallHandler. Genome: memory_retention→decay_rate, memory_imprint→salience gain on ingest. `people_registry.ts` — people_registry.json, EntityLinker, RelationshipCardGenerator, RelationshipDecayJob. relationship_state.json first-class in DOMAIN_FILE_MAP. RelationshipDeltaGate in pipeline. check_direct_writes: people_registry.json + people_registry.ts.
- **Hb-2-2 (Compat Checklist)** (H/P1-7): `config/compat_checklist.json` with 32 entry/storage/recall/rollback items for Phase H modules; `scripts/compat_lint.mjs` CI validation (all modules have entry, evidencePath resolves); `packages/core/test/foundation_preservation.test.mjs` (life.log interface, memory.db schema, executeTurnProtocol signature, doctor/consistency guards); `packages/core/test/compat_checklist.test.mjs` (positive + negative lint tests); compat lint wired into `verify.sh`.
- **Hc (Verification & Governance)**: H/P1-16 — check_direct_writes extended (genome.json, epigenetics.json; genome.ts allowed). H/P1-15 — genome trait whitelist in epigenetics gate. H/P1-14 — epigenetics zero-evidence test. H/P1-12 — over-numericalization guard (`guards/over_numericalization.ts`). H/P1-10 — governance regression harness (`scripts/regression/governance.mjs`). H/P1-19 — Appendix B access-point checklist (`doc/checklists/appendix_b_access_points.md`). H/P1-8 — relationship continuity regression (`scripts/regression/relationship_continuity.mjs`, scenarios). H/P1-9 — emotional depth regression (`scripts/regression/emotional_depth.mjs`). H/P1-13 — relationship noise guard (`guards/relationship_noise.ts`). H/P1-17, H/P1-18 — Appendix A JSON schemas (`schemas/v1/*.schema.json`), `scripts/validate_appendix_a.mjs`, fixtures.

### Changed
- Core conflict policy now uses **explicit-only refusal**: explicit core override still refuses; implicit semantic tension degrades to cautious clarify/brief response instead of hard refusal.
- Adaptive reasoning depth wired into turn protocol and chat runtime (`fast` by default, escalates to `deep` on complexity/ambiguity/low-confidence signals).
- Soul-mode meta-review is now conditionally triggered on risk/quality/deep-path signals to reduce unnecessary slow-path latency.
- Thinking preview default threshold adjusted to `1000ms` (persona defaults + CLI defaults), reusing existing `voice_profile.thinkingPreview` contract.
- **Persona init/load** (`packages/core/src/persona.ts`): New personas auto-create `genome.json` + `epigenetics.json`; `loadPersonaPackage` includes genome/epigenetics with fallback to defaults. New personas now also create `manifest.json` (v0.4 package layout).
- **PersonaPackage type** (`packages/core/src/types.ts`): Added optional `genome` and `epigenetics` fields; added `stateDeltaProposal` and `deltaCommitResult` to `DecisionTrace`; added `state_delta_committed` and `state_delta_rejected` life event types.
- **ExecuteTurnResult** (`packages/core/src/execution_protocol.ts`): Added optional `deltaCommitResult` field for pipeline output.
- **Orchestrator** (`packages/core/src/orchestrator.ts`): `selectedMemoryCap` now derived from `derivedParams.recallTopK` instead of hardcoded values (legacy parity: base 6, strong +6=12, soft +3=9).
- **Recall budget policy** (`packages/core/src/recall_budget_policy.ts`): Accepts `genomeDerived` param; `injectMax` baseline from `recallTopK + 1` (legacy=7); all profiles respect genome baseline via `Math.max`.
- **Mood state** (`packages/core/src/mood_state.ts`): `decayMoodTowardBaseline` and `evolveMoodStateFromTurn` accept genome-derived `moodDeltaScale` and `baselineRegressionSpeed`. Hb-1-3: energy, stress, baseline fields; decay uses baseline from state; `mergeMoodState` in state_delta_apply for mood-specific merge.
- **Memory recall** (`packages/core/src/memory_recall.ts`): `injectMax` clamp raised from 12 to 20 to support high-trait personas.
- **CLI wiring** (`packages/cli/src/index.ts`): Computes `genomeDerived` per turn and passes to recall budget, mood evolution, and social graph.
- **2-tier compat model**: Legacy personas auto-load default genome (all traits=0.5) with no behavior change; no hybrid tier.
- `DerivedParams` pruned: removed `cardsCap`, `recentWindowTurns`, `entityLinkingThreshold` (no clear consumer or miscalibrated).
- **Persona initialization** (`packages/core/src/persona.ts`): new persona package now seeds `values_rules.json`, `personality_profile.json`, `goals.json`, `beliefs.json`, `people_registry.json`.
- **Persona lint** (`packages/core/src/persona_lint.ts`): warns on missing optional H/P1 state files and errors on invalid JSON for those files.
- **CLI context injection** (`packages/cli/src/index.ts`): appends people-registry person-card context block alongside social graph block.
- **Roadmap/plan sync**: updated `doc/Roadmap.md`, `doc/plans/H2-State-Modules.md`, and `doc/plans/H-State-Closure-Plan.md` to reflect H/P1-0..H/P1-3 in-progress implementation status and progress notes.
- **Epigenetics gate**: Enhanced with cooldown enforcement — rejects adjustments when `cooldownUntil` is in the future.
- **E2: Zero direct-write paths**: All state writes (mood, relationship, interests, cognition, voice, social_graph) route through the State Delta Pipeline when persona is in full compat mode. Legacy personas retain direct writes. System-generated writes bypass gates via `systemGenerated` flag. New domains added to `StateDeltaDomain` and `DOMAIN_FILE_MAP`. `state_delta_writer.ts` provides `shouldUseStateDeltaPipelineFromRoot` and `writeStateDelta`. CI gate `scripts/check_direct_writes.mjs` enforces no unauthorized state file writes. Added `package_snapshotter.ts` and `goal_store.ts` to allowed writers (rollback restore, goals index).
- **Doc sync**: `contributing_ai.md` (§5.1 verify.sh coverage, §5.3 state file writes), `AGENT.md` (§6.4 E2 gate, §9 scripts), `README.md` (verify.sh description) updated for direct-writes gate and state delta pipeline.

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
