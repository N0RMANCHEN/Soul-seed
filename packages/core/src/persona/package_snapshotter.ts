/**
 * Persona Package v0.4 — Snapshotter & Rollback (H/P1-4)
 *
 * PackageSnapshotter: create/restore snapshots (bundle all state files).
 * rollbackToSnapshot(snapshotId): restore from snapshot, delete genome.json for legacy revert.
 */

import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { GENOME_FILENAME } from "../state/genome.js";
import { logMigrationRollback } from "../governance/migration_logger.js";

export const SNAPSHOTS_DIR = "snapshots";

/** State files to snapshot (mutable JSON). Excludes life.log, memory.db, and binary. */
export const SNAPSHOT_STATE_FILES = [
  "persona.json",
  "identity.json",
  "worldview.json",
  "constitution.json",
  "habits.json",
  "user_profile.json",
  "pinned.json",
  "cognition_state.json",
  "soul_lineage.json",
  "relationship_state.json",
  "voice_profile.json",
  "mood_state.json",
  "genome.json",
  "epigenetics.json",
  "interests.json",
  "topic_state.json",
  "social_graph.json",
  "autobiography.json",
  "self_reflection.json",
  "temporal_landmarks.json",
  "summaries/working_set.json",
  "summaries/consolidated.json"
] as const;

export interface SnapshotBundle {
  snapshotId: string;
  createdAt: string;
  files: Record<string, unknown>;
}

function generateSnapshotId(): string {
  return `snap_${Date.now()}`;
}

function computeChecksum(files: Record<string, unknown>): string {
  const canonical = JSON.stringify(files, Object.keys(files).sort());
  return createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 16);
}

export async function createSnapshot(personaRoot: string): Promise<SnapshotBundle> {
  const snapshotId = generateSnapshotId();
  const createdAt = new Date().toISOString();
  const files: Record<string, unknown> = {};

  for (const rel of SNAPSHOT_STATE_FILES) {
    const fullPath = path.join(personaRoot, rel);
    if (existsSync(fullPath)) {
      try {
        const raw = await readFile(fullPath, "utf8");
        files[rel] = JSON.parse(raw) as unknown;
      } catch {
        // Skip corrupt files; they won't be in snapshot
      }
    }
  }

  const bundle: SnapshotBundle = {
    snapshotId,
    createdAt,
    files
  };

  const snapDir = path.join(personaRoot, SNAPSHOTS_DIR);
  await mkdir(snapDir, { recursive: true });
  const snapPath = path.join(snapDir, `${snapshotId}.json`);
  await writeFile(snapPath, JSON.stringify(bundle, null, 2), "utf8");

  return bundle;
}

export async function restoreSnapshot(
  personaRoot: string,
  snapshotId: string
): Promise<{ ok: boolean; reason?: string }> {
  const snapPath = path.join(personaRoot, SNAPSHOTS_DIR, `${snapshotId}.json`);
  if (!existsSync(snapPath)) {
    return { ok: false, reason: `Snapshot not found: ${snapshotId}` };
  }

  let bundle: SnapshotBundle;
  try {
    const raw = await readFile(snapPath, "utf8");
    bundle = JSON.parse(raw) as SnapshotBundle;
  } catch (e) {
    return { ok: false, reason: `Snapshot file corrupt: ${String(e)}` };
  }

  if (bundle.snapshotId !== snapshotId) {
    return { ok: false, reason: "Snapshot ID mismatch" };
  }

  for (const [rel, data] of Object.entries(bundle.files)) {
    if (data === undefined) continue;
    const fullPath = path.join(personaRoot, rel);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(data, null, 2), "utf8");
  }

  return { ok: true };
}

/**
 * rollbackToSnapshot(snapshotId): restore from snapshot, delete genome.json for legacy revert.
 * Preserves traces (never deletes audit history). Logs rollback event to migration_log.jsonl.
 */
export async function rollbackToSnapshot(
  personaRoot: string,
  snapshotId: string,
  reason = "user_requested_rollback"
): Promise<{ ok: boolean; reason?: string }> {
  const result = await restoreSnapshot(personaRoot, snapshotId);
  if (!result.ok) return result;

  const genomePath = path.join(personaRoot, GENOME_FILENAME);
  if (existsSync(genomePath)) {
    try {
      unlinkSync(genomePath);
    } catch {
      // ignore; continue with rollback
    }
  }

  await logMigrationRollback(personaRoot, {
    from: "full",
    to: "legacy",
    reason,
    snapshotId,
    rollbackAvailable: false
  });

  return { ok: true };
}

export async function listSnapshots(personaRoot: string): Promise<{ snapshotId: string; createdAt: string }[]> {
  const snapDir = path.join(personaRoot, SNAPSHOTS_DIR);
  if (!existsSync(snapDir)) return [];

  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(snapDir, { withFileTypes: true });
  const snapshots: { snapshotId: string; createdAt: string }[] = [];

  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".json")) continue;
    const fullPath = path.join(snapDir, e.name);
    try {
      const raw = readFileSync(fullPath, "utf8");
      const bundle = JSON.parse(raw) as SnapshotBundle;
      if (bundle.snapshotId && bundle.createdAt) {
        snapshots.push({
          snapshotId: bundle.snapshotId,
          createdAt: bundle.createdAt
        });
      }
    } catch {
      // skip corrupt
    }
  }

  snapshots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return snapshots;
}

export { computeChecksum };
