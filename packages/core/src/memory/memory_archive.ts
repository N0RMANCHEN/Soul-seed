import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";

export interface MemoryArchiveOptions {
  minItems?: number;
  minColdRatio?: number;
  idleDays?: number;
  maxItems?: number;
  dryRun?: boolean;
}

export interface MemoryArchiveReport {
  ok: boolean;
  nowIso: string;
  trigger: {
    minItems: number;
    minColdRatio: number;
    idleDays: number;
    maxItems: number;
    dryRun: boolean;
  };
  stats: {
    totalActive: number;
    eligibleCold: number;
    eligibleRatio: number;
    selected: number;
    archived: number;
  };
  segment: {
    dir: string;
    file: string | null;
    filePath: string | null;
    segmentKey: string | null;
    checksum: string | null;
  };
  skippedReason?: "below_min_items" | "below_min_ratio" | "no_eligible_rows";
}

interface MemoryRow {
  id: string;
  memoryType: string;
  content: string;
  salience: number;
  state: string;
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  credibilityScore: number;
  originRole: string;
  speakerRole: string;
  speakerId: string | null;
  speakerLabel: string | null;
  evidenceLevel: string;
  reconsolidationCount: number;
  sourceEventHash: string;
  createdAt: string;
  updatedAt: string;
}

export async function archiveColdMemories(
  rootPath: string,
  options?: MemoryArchiveOptions
): Promise<MemoryArchiveReport> {
  await ensureMemoryStore(rootPath);

  const minItems = clampInt(options?.minItems ?? 50, 1, 5000);
  const minColdRatio = clampFloat(options?.minColdRatio ?? 0.35, 0, 1);
  const idleDays = clampInt(options?.idleDays ?? 14, 1, 3650);
  const maxItems = clampInt(options?.maxItems ?? 500, 1, 5000);
  const dryRun = options?.dryRun === true;
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000).toISOString();

  const totalActive = await queryCount(
    rootPath,
    "SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL AND excluded_from_recall=0;"
  );
  const eligibleCold = await queryCount(
    rootPath,
    [
      "SELECT COUNT(*) FROM memories",
      "WHERE deleted_at IS NULL",
      "AND excluded_from_recall=0",
      "AND state IN ('cold','archive')",
      `AND updated_at <= ${sqlText(cutoffIso)};`
    ].join(" ")
  );

  const eligibleRatio = totalActive > 0 ? eligibleCold / totalActive : 0;

  const baseReport: MemoryArchiveReport = {
    ok: true,
    nowIso,
    trigger: {
      minItems,
      minColdRatio,
      idleDays,
      maxItems,
      dryRun
    },
    stats: {
      totalActive,
      eligibleCold,
      eligibleRatio: round4(eligibleRatio),
      selected: 0,
      archived: 0
    },
    segment: {
      dir: path.join(rootPath, "summaries", "archive"),
      file: null,
      filePath: null,
      segmentKey: null,
      checksum: null
    }
  };

  if (eligibleCold < minItems) {
    return {
      ...baseReport,
      skippedReason: "below_min_items"
    };
  }

  if (eligibleRatio < minColdRatio) {
    return {
      ...baseReport,
      skippedReason: "below_min_ratio"
    };
  }

  const rows = await queryRows(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'memoryType', memory_type,",
      "'content', content,",
      "'salience', salience,",
      "'state', state,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'emotionScore', emotion_score,",
      "'narrativeScore', narrative_score,",
      "'credibilityScore', credibility_score,",
      "'originRole', origin_role,",
      "'speakerRole', COALESCE(speaker_role, origin_role),",
      "'speakerId', speaker_id,",
      "'speakerLabel', speaker_label,",
      "'evidenceLevel', evidence_level,",
      "'reconsolidationCount', reconsolidation_count,",
      "'sourceEventHash', source_event_hash,",
      "'createdAt', created_at,",
      "'updatedAt', updated_at",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL",
      "AND excluded_from_recall=0",
      "AND state IN ('cold','archive')",
      `AND updated_at <= ${sqlText(cutoffIso)}`,
      "ORDER BY updated_at ASC",
      `LIMIT ${maxItems};`
    ].join("\n")
  );

  if (rows.length === 0) {
    return {
      ...baseReport,
      skippedReason: "no_eligible_rows"
    };
  }

  const selected = rows.length;
  const archiveDir = path.join(rootPath, "summaries", "archive");
  const monthTag = nowIso.slice(0, 7).replace("-", "");
  const fileName = `segment-${monthTag}.jsonl`;
  const filePath = path.join(archiveDir, fileName);
  const batchId = randomUUID();

  const lines = rows.map((row) => {
    const linePayload = {
      schema: "soulseed.archive.segment.v1",
      archivedAt: nowIso,
      batchId,
      memory: row
    };
    return JSON.stringify(linePayload);
  });

  const segmentPayload = {
    schema: "soulseed.archive.batch.v1",
    batchId,
    file: path.join("summaries", "archive", fileName),
    count: rows.length,
    ids: rows.map((row) => row.id),
    cutoffIso,
    createdAt: nowIso
  };
  const segmentPayloadJson = JSON.stringify(segmentPayload);
  const checksum = sha256(segmentPayloadJson);
  const segmentKey = `memory_archive:${monthTag}:${batchId}`;

  if (!dryRun) {
    await mkdir(archiveDir, { recursive: true });
    const exists = await fileExists(filePath);
    const prefix = exists ? "" : "";
    await writeFile(filePath, `${prefix}${lines.join("\n")}\n`, {
      encoding: "utf8",
      flag: "a"
    });

    await runMemoryStoreSql(
      rootPath,
      [
        "INSERT OR REPLACE INTO archive_segments",
        "(id, segment_key, summary, payload_json, checksum, created_at)",
        "VALUES",
        `(${sqlText(randomUUID())}, ${sqlText(segmentKey)}, ${sqlText(
          `cold memory archive batch (${rows.length})`
        )}, ${sqlText(segmentPayloadJson)}, ${sqlText(checksum)}, ${sqlText(nowIso)});`
      ].join(" ")
    );

    const idsSql = rows.map((row) => sqlText(row.id)).join(",");
    const updates = rows.map((row) => {
      const summary = row.content.trim().replace(/\s+/g, " ").slice(0, 140);
      const ref = `[archived_ref] segment=${segmentKey} id=${row.id} checksum=${checksum} summary=${summary}`;
      return `WHEN id=${sqlText(row.id)} THEN ${sqlText(ref)}`;
    });

    await runMemoryStoreSql(
      rootPath,
      [
        "BEGIN;",
        "UPDATE memories",
        "SET",
        "content = CASE",
        ...updates,
        "ELSE content END,",
        "state='archive',",
        "excluded_from_recall=1,",
        `updated_at=${sqlText(nowIso)}`,
        `WHERE id IN (${idsSql});`,
        "COMMIT;"
      ].join("\n")
    );
  }

  return {
    ...baseReport,
    stats: {
      ...baseReport.stats,
      selected,
      archived: dryRun ? 0 : selected
    },
    segment: {
      dir: archiveDir,
      file: fileName,
      filePath,
      segmentKey,
      checksum
    }
  };
}

async function queryCount(rootPath: string, sql: string): Promise<number> {
  const raw = await runMemoryStoreSql(rootPath, sql);
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : 0;
}

async function queryRows(rootPath: string, sql: string): Promise<MemoryRow[]> {
  const raw = await runMemoryStoreSql(rootPath, sql);
  if (!raw.trim()) {
    return [];
  }
  const rows: MemoryRow[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      if (!id) {
        continue;
      }
      rows.push({
        id,
        memoryType: asString(parsed.memoryType),
        content: asString(parsed.content),
        salience: asNumber(parsed.salience),
        state: asString(parsed.state),
        activationCount: Math.max(1, Math.floor(asNumber(parsed.activationCount, 1))),
        lastActivatedAt: asString(parsed.lastActivatedAt),
        emotionScore: asNumber(parsed.emotionScore),
        narrativeScore: asNumber(parsed.narrativeScore),
        credibilityScore: asNumber(parsed.credibilityScore, 1),
        originRole: asString(parsed.originRole),
        speakerRole: asString(parsed.speakerRole) || asString(parsed.originRole),
        speakerId: asNullableString(parsed.speakerId),
        speakerLabel: asNullableString(parsed.speakerLabel),
        evidenceLevel: asString(parsed.evidenceLevel),
        reconsolidationCount: Math.max(0, Math.floor(asNumber(parsed.reconsolidationCount, 0))),
        sourceEventHash: asString(parsed.sourceEventHash),
        createdAt: asString(parsed.createdAt),
        updatedAt: asString(parsed.updatedAt)
      });
    } catch {
      continue;
    }
  }
  return rows;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clampFloat(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
