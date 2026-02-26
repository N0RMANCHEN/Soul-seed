> Archived: 2026-02-26
> Progress historical snapshot. Active progress source is `doc/Roadmap.md`.

# Phase K Multi-Persona Chat Plan (Archived)

## Scope Summary

Phase K established a full multi-persona chat capability:

1. `K0` Session layer: registry/graph artifacts and turn baseline
2. `K1` Governance layer: arbitration, isolation, cooperative planning
3. `K2` Product layer: CLI commands + evaluation/gating

Core goal: deterministic group arbitration (addressing-first), context isolation, and reproducible quality gates.

## Prerequisite Baseline Reused

- Life-event speaker attribution (`speaker_role/speaker_id/speaker_label`) across ingest/recall/archive
- Memory schema v10 migration/backfill compatibility
- CLI speaker labeling utilities
- Legacy compatibility coverage from Phase J closure

## Task Chain (Historical)

1. `K/P0-0` Multi-persona session graph + registry + artifact schemas  
2. `K/P0-1` Addressing-first arbitration  
3. `K/P0-2` Turn scheduling + anti-monopoly  
4. `K/P0-3` Compatibility/migration gates + feature flag  
5. `K/P1-0` Context bus + private memory isolation  
6. `K/P1-1` Cooperative planner  
7. `K/P1-2` CLI multi-persona commands and labels  
8. `K/P1-3` Evaluation track and scorecard archive

## Deliverable Snapshot

- Runtime modules:
  - `multi_persona_registry.ts`
  - `multi_persona_arbitration.ts`
  - `multi_persona_turn_scheduler.ts`
  - `multi_persona_feature_flag.ts`
  - `multi_persona_context_bus.ts`
  - `multi_persona_cooperation.ts`
  - `multi_persona_commands.ts`
- Schemas:
  - `schemas/v1/group_policy.schema.json`
  - `schemas/v1/session_graph.schema.json`
  - `schemas/v1/speaker_registry.schema.json`
- Eval:
  - `scripts/eval_multi_persona.mjs`
  - `test/fixtures/k_eval/scenarios.json`
  - `reports/quality/phase_k_scorecard.json` / `.md`

## Exit Criteria (Historical)

- K0: stable two-persona rotation + schema/compat gates green
- K1: private memory leakage blocked and auditable; CLI end-to-end behavior verified
- K2: evaluation integrated into gate chain with strict thresholds and legacy no-regression under flag-off

## Rollback Strategy (Historical)

- Feature flag default-off (`SOULSEED_PHASE_K_ENABLE=0`)
- Leak detection fail-closed to single-persona mode
- Deterministic scheduler fallback when arbitration conflicts occur
