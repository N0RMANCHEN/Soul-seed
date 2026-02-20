import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
import type { LifeEvent, WorkingSetData, WorkingSetItem } from "./types.js";
import { eventHash } from "./hash.js";
import { verifyLifeLogChain } from "./persona.js";

const MAX_WORKING_SET_SOURCE_HASHES = 256;
const MAX_COMPACTED_HASHES_IN_LIFE_LOG = 12;
const MAX_SELECTED_MEMORIES_IN_LOG = 8;

interface ArchiveSegmentInsertRow {
  segmentKey: string;
  summary: string;
  payloadJson: string;
  checksum: string;
}

export interface MemoryMigrationReport {
  ok: boolean;
  migratedAt: string;
  personaPath: string;
  backupDir: string;
  reportPath: string;
  lifeLog: {
    totalEvents: number;
    changedEvents: number;
    oldBytes: number;
    newBytes: number;
    reducedBytes: number;
  };
  workingSet: {
    items: number;
    oldBytes: number;
    newBytes: number;
    reducedBytes: number;
    changedItems: number;
  };
  archive: {
    rowsWritten: number;
    mappingSegmentKeys: string[];
  };
}

export async function migrateLifeLogAndWorkingSet(rootPath: string): Promise<MemoryMigrationReport> {
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  const workingSetPath = path.join(rootPath, "summaries", "working_set.json");
  const ts = new Date().toISOString();
  const tsTag = ts.replace(/[:.]/g, "-");
  const backupDir = path.join(rootPath, "migration-backups", tsTag);
  const reportPath = path.join(backupDir, "memory-migration-report.json");
  const lifeBackupPath = path.join(backupDir, "life.log.jsonl.bak");
  const workingSetBackupPath = path.join(backupDir, "working_set.json.bak");

  await mkdir(backupDir, { recursive: true });
  await ensureMemoryStore(rootPath);

  const lifeLogRaw = existsSync(lifeLogPath) ? await readFile(lifeLogPath, "utf8") : "";
  const lifeEvents = parseLifeEvents(lifeLogRaw);
  const oldLifeBytes = Buffer.byteLength(lifeLogRaw, "utf8");

  const workingSetRaw = existsSync(workingSetPath) ? await readFile(workingSetPath, "utf8") : "{\"items\":[]}\n";
  const workingSet = parseWorkingSet(workingSetRaw);
  const oldWorkingSetBytes = Buffer.byteLength(workingSetRaw, "utf8");

  await copyFile(lifeLogPath, lifeBackupPath);
  await copyFile(workingSetPath, workingSetBackupPath);

  try {
    const rewrittenLife = rewriteLifeEvents(lifeEvents, tsTag);
    const remappedWorkingSet = rewriteWorkingSet(workingSet, rewrittenLife.hashMap);

    const newLifeContent =
      rewrittenLife.events.length === 0
        ? ""
        : `${rewrittenLife.events.map((event) => JSON.stringify(event)).join("\n")}\n`;
    const newWorkingSetContent = `${JSON.stringify(remappedWorkingSet.data, null, 2)}\n`;

    await writeAtomic(lifeLogPath, newLifeContent);
    await writeAtomic(workingSetPath, newWorkingSetContent);

    await writeArchiveSegments(rootPath, [
      ...rewrittenLife.archiveRows,
      ...rewrittenLife.mappingRows
    ]);

    const chain = await verifyLifeLogChain(rootPath);
    if (!chain.ok) {
      throw new Error(chain.reason ?? "life.log chain verification failed after migration");
    }

    const report: MemoryMigrationReport = {
      ok: true,
      migratedAt: ts,
      personaPath: rootPath,
      backupDir,
      reportPath,
      lifeLog: {
        totalEvents: lifeEvents.length,
        changedEvents: rewrittenLife.changedEvents,
        oldBytes: oldLifeBytes,
        newBytes: Buffer.byteLength(newLifeContent, "utf8"),
        reducedBytes: oldLifeBytes - Buffer.byteLength(newLifeContent, "utf8")
      },
      workingSet: {
        items: remappedWorkingSet.data.items.length,
        oldBytes: oldWorkingSetBytes,
        newBytes: Buffer.byteLength(newWorkingSetContent, "utf8"),
        reducedBytes: oldWorkingSetBytes - Buffer.byteLength(newWorkingSetContent, "utf8"),
        changedItems: remappedWorkingSet.changedItems
      },
      archive: {
        rowsWritten: rewrittenLife.archiveRows.length + rewrittenLife.mappingRows.length,
        mappingSegmentKeys: rewrittenLife.mappingRows.map((row) => row.segmentKey)
      }
    };

    await writeAtomic(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } catch (error) {
    await copyFile(lifeBackupPath, lifeLogPath);
    await copyFile(workingSetBackupPath, workingSetPath);
    throw error;
  }
}

function parseLifeEvents(raw: string): LifeEvent[] {
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line, idx) => {
      try {
        return JSON.parse(line) as LifeEvent;
      } catch {
        throw new Error(`invalid life.log json line ${idx + 1}`);
      }
    });
}

function parseWorkingSet(raw: string): WorkingSetData {
  try {
    const parsed = JSON.parse(raw) as WorkingSetData;
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      memoryWeights: parsed.memoryWeights
    };
  } catch {
    throw new Error("working_set.json is invalid json");
  }
}

function rewriteLifeEvents(
  events: LifeEvent[],
  tsTag: string
): {
  events: LifeEvent[];
  changedEvents: number;
  hashMap: Map<string, string>;
  archiveRows: ArchiveSegmentInsertRow[];
  mappingRows: ArchiveSegmentInsertRow[];
} {
  let prevHash = "GENESIS";
  let changedEvents = 0;
  const rewritten: LifeEvent[] = [];
  const hashMap = new Map<string, string>();
  const archiveRows: ArchiveSegmentInsertRow[] = [];
  const mappings: Array<{ oldHash: string; newHash: string; ts: string; type: string }> = [];

  for (const oldEvent of events) {
    const { payload, extracted, changed } = compactLifePayload(oldEvent);
    if (changed) {
      changedEvents += 1;
      const archivedPayload = JSON.stringify({
        ts: oldEvent.ts,
        type: oldEvent.type,
        oldHash: oldEvent.hash,
        extracted
      });
      const segmentKey = `life_payload_full:${oldEvent.hash}`;
      const checksum = sha256(archivedPayload);
      archiveRows.push({
        segmentKey,
        summary: `${oldEvent.type} extracted payload backup`,
        payloadJson: archivedPayload,
        checksum
      });
      payload.payloadArchiveRef = {
        segmentKey,
        checksum
      };
    }

    const withoutHash = {
      ts: oldEvent.ts,
      type: oldEvent.type,
      payload,
      prevHash
    };
    const hash = eventHash(prevHash, withoutHash);
    const rewrittenEvent: LifeEvent = {
      ...withoutHash,
      hash
    };
    rewritten.push(rewrittenEvent);
    hashMap.set(oldEvent.hash, hash);
    mappings.push({ oldHash: oldEvent.hash, newHash: hash, ts: oldEvent.ts, type: oldEvent.type });
    prevHash = hash;
  }

  const mappingRows = buildMappingRows(tsTag, mappings);
  return { events: rewritten, changedEvents, hashMap, archiveRows, mappingRows };
}

function compactLifePayload(event: LifeEvent): {
  payload: Record<string, unknown>;
  extracted: Record<string, unknown>;
  changed: boolean;
} {
  const payload = deepClone(event.payload ?? {});
  const extracted: Record<string, unknown> = {};
  let changed = false;

  if (isRecord(payload.trace)) {
    extracted.trace = payload.trace;
    payload.trace = compactDecisionTrace(payload.trace);
    changed = true;
  }

  if (isRecord(payload.identityGuard)) {
    extracted.identityGuard = payload.identityGuard;
    payload.identityGuard = {
      corrected: Boolean(payload.identityGuard.corrected),
      reason:
        typeof payload.identityGuard.reason === "string" ? payload.identityGuard.reason : undefined
    };
    changed = true;
  }

  if (isRecord(payload.relationalGuard)) {
    extracted.relationalGuard = payload.relationalGuard;
    payload.relationalGuard = {
      corrected: Boolean(payload.relationalGuard.corrected),
      flags: Array.isArray(payload.relationalGuard.flags)
        ? payload.relationalGuard.flags.slice(0, 8)
        : []
    };
    changed = true;
  }

  if (event.type === "memory_compacted" && Array.isArray(payload.compactedHashes)) {
    const fullHashes = payload.compactedHashes.filter((item): item is string => typeof item === "string");
    extracted.compactedHashes = fullHashes;
    payload.compactedHashes = fullHashes.slice(0, MAX_COMPACTED_HASHES_IN_LIFE_LOG);
    payload.compactedHashesCount = fullHashes.length;
    payload.compactedHashesDigest = sha256(fullHashes.join("|"));
    payload.compactedHashesTruncated = fullHashes.length > MAX_COMPACTED_HASHES_IN_LIFE_LOG;
    changed = true;
  }

  return { payload, extracted, changed };
}

function compactDecisionTrace(trace: Record<string, unknown>): Record<string, unknown> {
  const selected = Array.isArray(trace.selectedMemories)
    ? trace.selectedMemories.filter((item): item is string => typeof item === "string")
    : [];
  const selectedClipped = selected
    .slice(0, MAX_SELECTED_MEMORIES_IN_LOG)
    .map((item) => (item.length > 160 ? `${item.slice(0, 160)}...` : item));

  return {
    version: trace.version,
    timestamp: trace.timestamp,
    askClarifyingQuestion: Boolean(trace.askClarifyingQuestion),
    refuse: Boolean(trace.refuse),
    riskLevel: trace.riskLevel,
    reason: trace.reason,
    model: trace.model,
    selectedMemories: selectedClipped,
    selectedMemoriesCount: selected.length,
    selectedMemoriesDigest: sha256(selected.join("|")),
    memoryBudget: trace.memoryBudget,
    retrievalBreakdown: trace.retrievalBreakdown,
    memoryWeights: trace.memoryWeights,
    voiceIntent: trace.voiceIntent ?? null,
    executionMode: trace.executionMode ?? "soul",
    goalId: trace.goalId ?? null,
    stepId: trace.stepId ?? null,
    planVersion: trace.planVersion ?? null,
    consistencyVerdict: trace.consistencyVerdict ?? null,
    consistencyRuleHits: trace.consistencyRuleHits ?? null,
    consistencyTraceId: trace.consistencyTraceId ?? null
  };
}

function rewriteWorkingSet(
  workingSet: WorkingSetData,
  hashMap: Map<string, string>
): { data: WorkingSetData; changedItems: number } {
  let changedItems = 0;
  const nextItems = (Array.isArray(workingSet.items) ? workingSet.items : []).map((item) => {
    const remappedHashes = item.sourceEventHashes.map((hash) => hashMap.get(hash) ?? hash);
    const normalized = normalizeWorkingSetItem({
      ...item,
      sourceEventHashes: remappedHashes
    });
    const changed = JSON.stringify(item) !== JSON.stringify(normalized);
    if (changed) {
      changedItems += 1;
    }
    return normalized;
  });

  return {
    data: {
      ...workingSet,
      items: nextItems
    },
    changedItems
  };
}

function normalizeWorkingSetItem(item: WorkingSetItem): WorkingSetItem {
  const seen = new Set<string>();
  const uniqueHashes: string[] = [];
  for (const hash of item.sourceEventHashes) {
    if (typeof hash !== "string" || hash.length === 0 || seen.has(hash)) {
      continue;
    }
    seen.add(hash);
    uniqueHashes.push(hash);
  }

  const total = uniqueHashes.length;
  const truncated = total > MAX_WORKING_SET_SOURCE_HASHES;
  const kept = truncated ? compactHashList(uniqueHashes, MAX_WORKING_SET_SOURCE_HASHES) : uniqueHashes;

  return {
    ...item,
    sourceEventHashes: kept,
    sourceEventHashCount: total,
    sourceEventHashDigest: sha256(uniqueHashes.join("|")),
    sourceEventHashesTruncated: truncated
  };
}

function compactHashList(hashes: string[], maxItems: number): string[] {
  if (hashes.length <= maxItems) {
    return hashes;
  }
  const headCount = Math.floor(maxItems / 2);
  const tailCount = maxItems - headCount;
  const head = hashes.slice(0, headCount);
  const tail = hashes.slice(-tailCount);
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const hash of [...head, ...tail]) {
    if (seen.has(hash)) {
      continue;
    }
    seen.add(hash);
    merged.push(hash);
  }
  return merged.slice(0, maxItems);
}

function buildMappingRows(
  tsTag: string,
  mappings: Array<{ oldHash: string; newHash: string; ts: string; type: string }>
): ArchiveSegmentInsertRow[] {
  const rows: ArchiveSegmentInsertRow[] = [];
  const chunkSize = 1000;
  const partCount = Math.max(1, Math.ceil(mappings.length / chunkSize));
  for (let part = 0; part < partCount; part += 1) {
    const chunk = mappings.slice(part * chunkSize, (part + 1) * chunkSize);
    const payload = JSON.stringify({
      schema: "life-hash-map-v1",
      ts: new Date().toISOString(),
      part: part + 1,
      partCount,
      mappings: chunk
    });
    rows.push({
      segmentKey: `life_hash_map:${tsTag}:part-${String(part + 1).padStart(4, "0")}`,
      summary: "life.log hash mapping after compaction rewrite",
      payloadJson: payload,
      checksum: sha256(payload)
    });
  }
  return rows;
}

async function writeArchiveSegments(rootPath: string, rows: ArchiveSegmentInsertRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 20;
  for (let idx = 0; idx < rows.length; idx += chunkSize) {
    const chunk = rows.slice(idx, idx + chunkSize);
    const sql = [
      "BEGIN;",
      ...chunk.map(
        (row) =>
          [
            "INSERT OR REPLACE INTO archive_segments",
            "(id, segment_key, summary, payload_json, checksum, created_at)",
            `VALUES (${sqlText(randomUUID())}, ${sqlText(row.segmentKey)}, ${sqlText(row.summary)}, ${sqlText(
              row.payloadJson
            )}, ${sqlText(row.checksum)}, ${sqlText(new Date().toISOString())});`
          ].join(" ")
      ),
      "COMMIT;"
    ].join("\n");
    await runMemoryStoreSql(rootPath, sql);
  }
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, content, "utf8");
  await rename(tmpPath, filePath);
}

function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
