/**
 * Genome → Derived Params mapping — H/P0-4
 *
 * Pure, deterministic conversion from genome traits + epigenetic adjustments
 * to concrete budget/behavior parameters consumed by the turn pipeline.
 *
 * Design: formulas are calibrated so that trait=0.5 produces the current
 * hardcoded legacy defaults. Legacy personas load default genome (all 0.5)
 * and get identical behavior without any compat override layer.
 *
 * Every derived param has a hard clamp range — genome can never push a
 * parameter outside the safe zone.
 */

import type {
  GenomeConfig,
  EpigeneticsConfig,
  GenomeTraitName,
} from "./genome.js";
import { clamp } from "./genome.js";

// ─── Derived Params ────────────────────────────────────────────────────────────

export interface DerivedParams {
  /** Max relationship/context cards per turn */
  cardsCap: number;
  /** Top-K memories for recall */
  recallTopK: number;
  /** Recent conversation turns in context */
  recentWindowTurns: number;
  /** Multiplier on per-turn mood deltas */
  moodDeltaScale: number;
  /** Per-turn mood regression toward baseline */
  baselineRegressionSpeed: number;
  /** Days until memory salience halves */
  memoryHalfLifeDays: number;
  /** Salience below which memories are archived */
  archiveThreshold: number;
  /** Multiplier for salience gain on new memories */
  salienceGain: number;
  /** Probability of a memory becoming "sticky" (decay-resistant) */
  stickyProbability: number;
  /** Confidence threshold for entity linking */
  entityLinkingThreshold: number;
  /** Max entity candidates to consider per mention */
  entityCandidateCount: number;
}

// ─── Formula table ─────────────────────────────────────────────────────────────
//
//  trait=0.5 produces these "legacy" defaults:
//    cardsCap=2, recallTopK=10, recentWindowTurns=5,
//    moodDeltaScale=1.0, baselineRegressionSpeed=0.05,
//    memoryHalfLifeDays=30, archiveThreshold=0.10,
//    salienceGain=1.0, stickyProbability=0.15,
//    entityLinkingThreshold=0.70, entityCandidateCount=3

interface FormulaEntry {
  trait: GenomeTraitName;
  param: keyof DerivedParams;
  formula: (traitValue: number) => number;
  clampMin: number;
  clampMax: number;
  round: boolean;
}

const FORMULA_TABLE: FormulaEntry[] = [
  {
    trait: "attention_span",
    param: "cardsCap",
    formula: (t) => Math.floor(t * 4),
    clampMin: 1,
    clampMax: 4,
    round: true,
  },
  {
    trait: "attention_span",
    param: "recallTopK",
    formula: (t) => Math.floor(t * 20),
    clampMin: 3,
    clampMax: 20,
    round: true,
  },
  {
    trait: "attention_span",
    param: "recentWindowTurns",
    formula: (t) => Math.floor(t * 10),
    clampMin: 2,
    clampMax: 10,
    round: true,
  },
  {
    trait: "emotion_sensitivity",
    param: "moodDeltaScale",
    formula: (t) => t * 2,
    clampMin: 0.2,
    clampMax: 2.0,
    round: false,
  },
  {
    trait: "emotion_recovery",
    param: "baselineRegressionSpeed",
    formula: (t) => t * 0.1,
    clampMin: 0.01,
    clampMax: 0.1,
    round: false,
  },
  {
    trait: "memory_retention",
    param: "memoryHalfLifeDays",
    formula: (t) => t * 60,
    clampMin: 7,
    clampMax: 90,
    round: false,
  },
  {
    trait: "memory_retention",
    param: "archiveThreshold",
    formula: (t) => t * 0.2,
    clampMin: 0.01,
    clampMax: 0.3,
    round: false,
  },
  {
    trait: "memory_imprint",
    param: "salienceGain",
    formula: (t) => t * 2,
    clampMin: 0.5,
    clampMax: 2.0,
    round: false,
  },
  {
    trait: "memory_imprint",
    param: "stickyProbability",
    formula: (t) => t * 0.3,
    clampMin: 0.05,
    clampMax: 0.3,
    round: false,
  },
  {
    trait: "social_attunement",
    param: "entityLinkingThreshold",
    formula: (t) => t * 0.5 + 0.45,
    clampMin: 0.4,
    clampMax: 0.95,
    round: false,
  },
  {
    trait: "social_attunement",
    param: "entityCandidateCount",
    formula: (t) => Math.floor(t * 6),
    clampMin: 1,
    clampMax: 6,
    round: true,
  },
];

// ─── Core compute ──────────────────────────────────────────────────────────────

/**
 * Resolve effective trait value: genome base + epigenetic adjustment, clamped to [0,1].
 */
export function resolveTraitValue(
  genome: GenomeConfig,
  epigenetics: EpigeneticsConfig,
  trait: GenomeTraitName
): number {
  const base = genome.traits[trait].value;
  const adj = epigenetics.adjustments[trait];
  const delta = adj ? clamp(adj.value, adj.min, adj.max) : 0;
  return clamp(base + delta, 0, 1);
}

/**
 * Compute all derived params from genome + epigenetics.
 * Pure function — no side effects, fully deterministic.
 */
export function computeDerivedParams(
  genome: GenomeConfig,
  epigenetics: EpigeneticsConfig
): DerivedParams {
  const result = {} as Record<string, number>;

  for (const entry of FORMULA_TABLE) {
    const traitValue = resolveTraitValue(genome, epigenetics, entry.trait);
    let raw = entry.formula(traitValue);
    raw = clamp(raw, entry.clampMin, entry.clampMax);
    if (entry.round) raw = Math.floor(raw);
    result[entry.param] = raw;
  }

  return result as unknown as DerivedParams;
}

/**
 * Returns the default derived params (what trait=0.5 produces).
 * Useful for tests and as documentation of legacy-compatible values.
 */
export function getDefaultDerivedParams(): DerivedParams {
  return {
    cardsCap: 2,
    recallTopK: 10,
    recentWindowTurns: 5,
    moodDeltaScale: 1.0,
    baselineRegressionSpeed: 0.05,
    memoryHalfLifeDays: 30,
    archiveThreshold: 0.10,
    salienceGain: 1.0,
    stickyProbability: 0.15,
    entityLinkingThreshold: 0.70,
    entityCandidateCount: 3,
  };
}

/** Expose the formula table for introspection and testing. */
export { FORMULA_TABLE };
