/**
 * Persona Package v0.4 — Migration Logger (H/P1-4)
 *
 * migration_log.jsonl: upgrade/rollback history.
 * Each line: { at, from, to, reason, snapshotId, rollbackAvailable }
 */

import { readFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const MIGRATION_LOG_FILENAME = "migration_log.jsonl";

export interface MigrationLogEntry {
  at: string;
  from: string;
  to: string;
  reason: string;
  snapshotId: string;
  rollbackAvailable: boolean;
}

export function parseMigrationLogEntry(line: string): MigrationLogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    if (
      typeof raw.at === "string" &&
      typeof raw.from === "string" &&
      typeof raw.to === "string" &&
      typeof raw.reason === "string" &&
      typeof raw.snapshotId === "string" &&
      typeof raw.rollbackAvailable === "boolean"
    ) {
      return {
        at: raw.at,
        from: raw.from,
        to: raw.to,
        reason: raw.reason,
        snapshotId: raw.snapshotId,
        rollbackAvailable: raw.rollbackAvailable
      };
    }
  } catch {
    // ignore malformed lines
  }
  return null;
}

export async function readMigrationLog(personaRoot: string): Promise<MigrationLogEntry[]> {
  const logPath = path.join(personaRoot, MIGRATION_LOG_FILENAME);
  if (!existsSync(logPath)) return [];
  const content = await readFile(logPath, "utf8");
  const lines = content.split("\n").filter(Boolean);
  const entries: MigrationLogEntry[] = [];
  for (const line of lines) {
    const entry = parseMigrationLogEntry(line);
    if (entry) entries.push(entry);
  }
  return entries;
}

export async function appendMigrationLog(
  personaRoot: string,
  entry: MigrationLogEntry
): Promise<void> {
  const logPath = path.join(personaRoot, MIGRATION_LOG_FILENAME);
  const line = JSON.stringify(entry) + "\n";
  await appendFile(logPath, line, "utf8");
}

export async function logMigrationUpgrade(
  personaRoot: string,
  params: {
    from: string;
    to: string;
    reason: string;
    snapshotId: string;
    rollbackAvailable: boolean;
  }
): Promise<void> {
  await appendMigrationLog(personaRoot, {
    at: new Date().toISOString(),
    from: params.from,
    to: params.to,
    reason: params.reason,
    snapshotId: params.snapshotId,
    rollbackAvailable: params.rollbackAvailable
  });
}

export async function logMigrationRollback(
  personaRoot: string,
  params: {
    from: string;
    to: string;
    reason: string;
    snapshotId: string;
    rollbackAvailable: boolean;
  }
): Promise<void> {
  await appendMigrationLog(personaRoot, {
    at: new Date().toISOString(),
    from: params.from,
    to: params.to,
    reason: params.reason,
    snapshotId: params.snapshotId,
    rollbackAvailable: params.rollbackAvailable
  });
}
