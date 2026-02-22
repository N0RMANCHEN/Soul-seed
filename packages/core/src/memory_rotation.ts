import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export interface MemoryRotationPolicy {
  maxLifeLogEntries?: number;
}

/**
 * Rotate life.log.jsonl if entry count exceeds policy.maxLifeLogEntries.
 *
 * Strategy:
 *   1. Count lines in life.log.jsonl.
 *   2. If count <= limit, return early.
 *   3. Append the oldest ~20% of entries to summaries/life_archive.jsonl.
 *   4. Rewrite life.log.jsonl with only the newest entries (up to keepCount).
 *   5. Prepend a life_log_rotated scar event at the top of the new file.
 */
export async function rotateLifeLogIfNeeded(
  rootPath: string,
  policy: MemoryRotationPolicy | undefined
): Promise<void> {
  if (!policy?.maxLifeLogEntries) {
    return;
  }
  const limit = policy.maxLifeLogEntries;
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  if (!existsSync(lifeLogPath)) {
    return;
  }

  const raw = await readFile(lifeLogPath, "utf-8").catch(() => "");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);

  if (lines.length <= limit) {
    return;
  }

  // Archive oldest 20%, keep newest 80% up to limit
  const archiveCount = Math.ceil(lines.length * 0.2);
  const keepCount = Math.min(limit - 1, lines.length - archiveCount); // -1 for scar event
  const toArchive = lines.slice(0, archiveCount);
  const toKeep = lines.slice(lines.length - keepCount);

  // Ensure summaries directory exists
  const summariesDir = path.join(rootPath, "summaries");
  if (!existsSync(summariesDir)) {
    await mkdir(summariesDir, { recursive: true });
  }

  // Append archived entries to life_archive.jsonl
  const archivePath = path.join(summariesDir, "life_archive.jsonl");
  const archiveContent = toArchive.join("\n") + "\n";
  await writeFile(archivePath, archiveContent, { flag: "a", encoding: "utf-8" });

  // Write scar event
  const scarEvent = JSON.stringify({
    type: "life_log_rotated",
    ts: new Date().toISOString(),
    payload: {
      archivedCount: toArchive.length,
      keptCount: toKeep.length,
      archivePath: "summaries/life_archive.jsonl"
    }
  });

  // Rewrite life.log.jsonl: scar event first, then kept lines
  const newContent = scarEvent + "\n" + toKeep.join("\n") + "\n";
  await writeFile(lifeLogPath, newContent, { encoding: "utf-8" });
}
