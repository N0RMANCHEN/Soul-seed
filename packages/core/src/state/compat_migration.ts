import { promises as fs } from "node:fs";
import { join } from "node:path";
import { loadGenome, saveGenome, loadEpigenetics, saveEpigenetics } from "./genome.js";
import type { GenomeConfig, EpigeneticsConfig } from "./genome.js";
import { runDeltaGates } from "./state_delta_gates.js";
import type { StateDeltaProposal, DeltaGateContext, DeltaGateResult, StateDelta } from "./state_delta.js";

export interface MigrationSnapshot {
  version: string;
  migratedAt: string;
  fromMode: "legacy";
  toMode: "full";
  backupPaths: string[];
  genomeBefore: GenomeConfig | null;
  epigeneticsBefore: EpigeneticsConfig | null;
}

export interface MigrationResult {
  success: boolean;
  snapshot: MigrationSnapshot;
  errors: string[];
}

export async function migrateToFull(personaRoot: string): Promise<MigrationResult> {
  const migratedAt = new Date().toISOString();
  const backupDir = join(personaRoot, "migration-backups", migratedAt.replace(/[:.]/g, "-"));
  const backupPaths: string[] = [];
  const errors: string[] = [];

  let genomeBefore: GenomeConfig | null = null;
  let epigeneticsBefore: EpigeneticsConfig | null = null;

  try {
    genomeBefore = await loadGenome(personaRoot);
    epigeneticsBefore = await loadEpigenetics(personaRoot);
  } catch {}

  await fs.mkdir(backupDir, { recursive: true });

  const filesToBackup = ["genome.json", "epigenetics.json", "mood_state.json", "relationship_state.json"];
  for (const file of filesToBackup) {
    const src = join(personaRoot, file);
    try {
      await fs.access(src);
      const dst = join(backupDir, file);
      await fs.copyFile(src, dst);
      backupPaths.push(dst);
    } catch {}
  }

  try {
    const genome = await loadGenome(personaRoot);
    genome.source = "migrated";
    await saveGenome(personaRoot, genome);
  } catch (err) {
    errors.push(`genome migration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const epi = await loadEpigenetics(personaRoot);
    await saveEpigenetics(personaRoot, epi);
  } catch (err) {
    errors.push(`epigenetics migration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const snapshot: MigrationSnapshot = {
    version: "1.0",
    migratedAt,
    fromMode: "legacy",
    toMode: "full",
    backupPaths,
    genomeBefore,
    epigeneticsBefore,
  };

  await fs.writeFile(
    join(personaRoot, "migration_snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf-8"
  );

  return { success: errors.length === 0, snapshot, errors };
}

export async function isMigrated(personaRoot: string): Promise<boolean> {
  try {
    await fs.access(join(personaRoot, "migration_snapshot.json"));
    return true;
  } catch {
    return false;
  }
}

export async function rollbackMigration(personaRoot: string): Promise<boolean> {
  try {
    const raw = await fs.readFile(join(personaRoot, "migration_snapshot.json"), "utf-8");
    const snapshot: MigrationSnapshot = JSON.parse(raw);

    for (const backupPath of snapshot.backupPaths) {
      const fileName = backupPath.split("/").pop()!;
      const dst = join(personaRoot, fileName);
      await fs.copyFile(backupPath, dst);
    }

    if (!snapshot.genomeBefore) {
      try { await fs.unlink(join(personaRoot, "genome.json")); } catch {}
    }

    await fs.unlink(join(personaRoot, "migration_snapshot.json"));

    return true;
  } catch {
    return false;
  }
}

// ─── Shadow Mode ─────────────────────────────────────────────────────────────

export interface ShadowRunResult {
  turnId: string;
  proposalCount: number;
  accepted: number;
  rejected: number;
  clamped: number;
  gateResults: DeltaGateResult[];
  wouldHaveApplied: StateDelta[];
}

/**
 * Run the delta pipeline in trace-only mode: evaluates gates but does not
 * apply any state changes. Useful for comparing proposed behavior before
 * activating the full pipeline.
 */
export function runShadowMode(
  proposal: StateDeltaProposal,
  context: DeltaGateContext
): ShadowRunResult {
  const gateResults = runDeltaGates(proposal, context);

  let accepted = 0;
  let rejected = 0;
  let clamped = 0;
  const wouldHaveApplied: StateDelta[] = [];

  for (let i = 0; i < proposal.deltas.length; i++) {
    const result = gateResults.find((r) => r.deltaIndex === i);
    if (!result || result.verdict === "reject") {
      rejected++;
    } else if (result.verdict === "clamp") {
      clamped++;
      wouldHaveApplied.push({ ...proposal.deltas[i], patch: result.clampedPatch ?? proposal.deltas[i].patch });
    } else {
      accepted++;
      wouldHaveApplied.push(proposal.deltas[i]);
    }
  }

  return {
    turnId: proposal.turnId,
    proposalCount: proposal.deltas.length,
    accepted,
    rejected,
    clamped,
    gateResults,
    wouldHaveApplied,
  };
}
