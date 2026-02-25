/**
 * Genome & Epigenetics — H/P0-4
 *
 * Fixed 6-trait genome system that produces persona-specific behavioral
 * differences through deterministic Genome→Budget mapping. Epigenetics
 * allows slow, bounded, evidence-driven drift on top of the genome.
 *
 * Design invariants:
 *   - Exactly 6 traits. Adding a 7th requires review gate + version bump.
 *   - All trait values ∈ [0.0, 1.0].
 *   - locked=true → epigenetics gate rejects all drift proposals.
 *   - Legacy personas get default genome (traits=0.5) producing current
 *     hardcoded behavior — no hybrid tier needed.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const GENOME_FILENAME = "genome.json";
export const EPIGENETICS_FILENAME = "epigenetics.json";
export const GENOME_SCHEMA_VERSION = "1.0";
export const EPIGENETICS_SCHEMA_VERSION = "1.0";

export const GENOME_TRAIT_NAMES = [
  "emotion_sensitivity",
  "emotion_recovery",
  "memory_retention",
  "memory_imprint",
  "attention_span",
  "social_attunement",
] as const;

export type GenomeTraitName = (typeof GENOME_TRAIT_NAMES)[number];

export interface GenomeTrait {
  value: number;
}

export type GenomeTraits = Record<GenomeTraitName, GenomeTrait>;

export interface MutationEntry {
  trait: string;
  delta: number;
  reason: string;
  at: string;
}

export interface GenomeConfig {
  schemaVersion: string;
  genomeId: string;
  createdAt: string;
  source: "preset" | "inferred_legacy" | "inherited" | "custom";
  seed: number;
  locked: boolean;
  traits: GenomeTraits;
  parentGenomeHash: string | null;
  mutationLog: MutationEntry[];
}

export interface EpigeneticAdjustment {
  value: number;
  min: number;
  max: number;
  evidence: string[];
  lastUpdatedAt?: string;
  cooldownUntil?: string;
}

export interface EpigeneticsConfig {
  schemaVersion: string;
  updatedAt: string;
  adjustments: Record<string, EpigeneticAdjustment>;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_TRAIT_VALUE = 0.5;

export function createDefaultGenome(
  opts: { seed?: number; source?: GenomeConfig["source"] } = {}
): GenomeConfig {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 32);
  const traits: GenomeTraits = {} as GenomeTraits;
  for (const name of GENOME_TRAIT_NAMES) {
    traits[name] = { value: DEFAULT_TRAIT_VALUE };
  }
  return {
    schemaVersion: GENOME_SCHEMA_VERSION,
    genomeId: `gen_${Date.now().toString(36)}_${seed.toString(36)}`,
    createdAt: new Date().toISOString(),
    source: opts.source ?? "inferred_legacy",
    seed,
    locked: false,
    traits,
    parentGenomeHash: null,
    mutationLog: [],
  };
}

export function createDefaultEpigenetics(): EpigeneticsConfig {
  return {
    schemaVersion: EPIGENETICS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    adjustments: {},
  };
}

// ─── Validation ────────────────────────────────────────────────────────────────

export interface GenomeValidationIssue {
  code:
    | "missing_trait"
    | "extra_trait"
    | "trait_out_of_range"
    | "invalid_schema_version"
    | "missing_field";
  message: string;
}

export function validateGenome(g: GenomeConfig): GenomeValidationIssue[] {
  const issues: GenomeValidationIssue[] = [];

  if (!g.schemaVersion) {
    issues.push({ code: "invalid_schema_version", message: "missing schemaVersion" });
  }
  if (!g.genomeId) {
    issues.push({ code: "missing_field", message: "missing genomeId" });
  }
  if (typeof g.seed !== "number") {
    issues.push({ code: "missing_field", message: "missing or invalid seed" });
  }
  if (typeof g.locked !== "boolean") {
    issues.push({ code: "missing_field", message: "missing or invalid locked" });
  }
  if (!g.traits || typeof g.traits !== "object") {
    issues.push({ code: "missing_field", message: "missing traits object" });
    return issues;
  }

  const presentKeys = new Set(Object.keys(g.traits));
  for (const name of GENOME_TRAIT_NAMES) {
    if (!presentKeys.has(name)) {
      issues.push({ code: "missing_trait", message: `missing trait: ${name}` });
    } else {
      const v = g.traits[name]?.value;
      if (typeof v !== "number" || v < 0 || v > 1) {
        issues.push({
          code: "trait_out_of_range",
          message: `trait ${name} value ${v} out of [0, 1]`,
        });
      }
    }
  }

  for (const key of presentKeys) {
    if (!(GENOME_TRAIT_NAMES as readonly string[]).includes(key)) {
      issues.push({ code: "extra_trait", message: `unexpected trait: ${key}` });
    }
  }

  return issues;
}

export function validateEpigenetics(e: EpigeneticsConfig): GenomeValidationIssue[] {
  const issues: GenomeValidationIssue[] = [];
  if (!e.schemaVersion) {
    issues.push({ code: "invalid_schema_version", message: "missing schemaVersion" });
  }
  if (!e.adjustments || typeof e.adjustments !== "object") {
    issues.push({ code: "missing_field", message: "missing adjustments object" });
  }
  return issues;
}

// ─── Clamp helper ──────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clampTraitValue(value: number): number {
  return clamp(value, 0, 1);
}

// ─── Persistence ───────────────────────────────────────────────────────────────

export async function loadGenome(personaRoot: string): Promise<GenomeConfig> {
  const filePath = path.join(personaRoot, GENOME_FILENAME);
  if (!existsSync(filePath)) {
    const defaults = createDefaultGenome();
    try { await writeFile(filePath, JSON.stringify(defaults, null, 2), "utf-8"); } catch {}
    return defaults;
  }
  const raw = await readFile(filePath, "utf-8");
  const parsed: GenomeConfig = JSON.parse(raw);
  const issues = validateGenome(parsed);
  if (issues.some((i) => i.code === "missing_trait" || i.code === "missing_field")) {
    return createDefaultGenome();
  }
  for (const name of GENOME_TRAIT_NAMES) {
    parsed.traits[name].value = clampTraitValue(parsed.traits[name].value);
  }
  return parsed;
}

export async function saveGenome(
  personaRoot: string,
  genome: GenomeConfig
): Promise<void> {
  const filePath = path.join(personaRoot, GENOME_FILENAME);
  await writeFile(filePath, JSON.stringify(genome, null, 2), "utf-8");
}

export async function loadEpigenetics(
  personaRoot: string
): Promise<EpigeneticsConfig> {
  const filePath = path.join(personaRoot, EPIGENETICS_FILENAME);
  if (!existsSync(filePath)) {
    return createDefaultEpigenetics();
  }
  const raw = await readFile(filePath, "utf-8");
  const parsed: EpigeneticsConfig = JSON.parse(raw);
  const issues = validateEpigenetics(parsed);
  if (issues.length > 0) {
    return createDefaultEpigenetics();
  }
  return parsed;
}

export async function saveEpigenetics(
  personaRoot: string,
  epigenetics: EpigeneticsConfig
): Promise<void> {
  const filePath = path.join(personaRoot, EPIGENETICS_FILENAME);
  await writeFile(filePath, JSON.stringify(epigenetics, null, 2), "utf-8");
}
