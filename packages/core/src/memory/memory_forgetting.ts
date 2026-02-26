/**
 * H/P1-2 — Memory Forgetting & Compression Pipeline
 *
 * Decay + interference + compression. life.log NEVER modified.
 * Genome: memory_retention → decay_rate; memory_imprint → salience gain.
 */

import { randomUUID } from "node:crypto";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
import type { GenomeConfig, EpigeneticsConfig } from "../state/genome.js";
import { computeDerivedParams } from "../state/genome_derived.js";
import { loadGenome, loadEpigenetics } from "../state/genome.js";
import { classifyMemoryState } from "./memory_lifecycle.js";

export interface MemoryDecayOptions {
  /** Decay rate per day: salience *= exp(-rate * days). Default from genome memoryHalfLifeDays. */
  decayRatePerDay?: number;
  /** Only decay memories not activated in last N days */
  minIdleDays?: number;
  /** Never decay below this salience */
  floorSalience?: number;
  /** Skip scar memories */
  skipScar?: boolean;
  dryRun?: boolean;
}

export interface MemoryDecayReport {
  ok: boolean;
  nowIso: string;
  decayRatePerDay: number;
  updated: number;
  skipped: number;
  dryRun: boolean;
}

/**
 * MemoryDecayJob: Apply salience decay over time.
 * salience *= exp(-decay_rate * days_since_last_access)
 * Genome: memory_retention → memoryHalfLifeDays → decay_rate = ln(2) / halfLifeDays
 */
export async function runMemoryDecayJob(
  rootPath: string,
  options?: MemoryDecayOptions
): Promise<MemoryDecayReport> {
  await ensureMemoryStore(rootPath);
  const nowIso = new Date().toISOString();
  const minIdleDays = Math.max(0, options?.minIdleDays ?? 1);
  const floorSalience = clamp01(options?.floorSalience ?? 0.05);
  const skipScar = options?.skipScar !== false;
  const dryRun = options?.dryRun === true;

  let decayRatePerDay = options?.decayRatePerDay;
  if (decayRatePerDay == null || !Number.isFinite(decayRatePerDay)) {
    const genome = await loadGenome(rootPath);
    const epigenetics = await loadEpigenetics(rootPath);
    const derived = computeDerivedParams(genome, epigenetics);
    // decay_rate = ln(2) / halfLifeDays so that salience halves in halfLifeDays
    decayRatePerDay = Math.log(2) / Math.max(7, derived.memoryHalfLifeDays);
  }

  const cutoffIso = new Date(
    Date.now() - minIdleDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'salience', salience,",
      "'lastActivatedAt', last_activated_at,",
      "'state', state",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL",
      "AND excluded_from_recall = 0",
      skipScar ? "AND state != 'scar'" : "",
      `AND last_activated_at <= ${sqlText(cutoffIso)}`,
      "AND salience > 0;"
    ]
      .filter(Boolean)
      .join("\n")
  );

  const rows = parseDecayRows(raw);
  let updated = 0;

  if (!dryRun && rows.length > 0) {
    const updates: string[] = [];
    for (const row of rows) {
      const days = daysSince(row.lastActivatedAt, nowIso);
      if (days <= 0) continue;
      const decayed = row.salience * Math.exp(-decayRatePerDay * days);
      const nextSalience = Math.max(floorSalience, clamp01(decayed));
      if (Math.abs(nextSalience - row.salience) < 0.0001) continue;
      const nextState = classifyMemoryState(nextSalience);
      updates.push(
        [
          "UPDATE memories",
          `SET salience = ${nextSalience},`,
          `state = ${sqlText(nextState)},`,
          `updated_at = ${sqlText(nowIso)}`,
          `WHERE id = ${sqlText(row.id)};`
        ].join(" ")
      );
      updated += 1;
    }
    if (updates.length > 0) {
      await runMemoryStoreSql(rootPath, `BEGIN;\n${updates.join("\n")}\nCOMMIT;`);
    }
  }

  return {
    ok: true,
    nowIso,
    decayRatePerDay,
    updated,
    skipped: rows.length - updated,
    dryRun
  };
}

export interface InterferenceScoreInput {
  id: string;
  content: string;
  score: number;
}

/**
 * InterferenceScorer: Similarity-based suppression during recall.
 * When two memories are too similar, suppress the older/lower-scoring one.
 */
export function applyInterferenceScoring<T extends InterferenceScoreInput>(
  items: T[],
  options?: { similarityThreshold?: number; penalty?: number }
): T[] {
  const threshold = options?.similarityThreshold ?? 0.85;
  const penalty = options?.penalty ?? 0.08;
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const picked: Array<{ item: T; tokens: Set<string> }> = [];

  for (const item of sorted) {
    const tokens = tokenize(item.content);
    let totalPenalty = 0;
    for (const candidate of picked) {
      const overlap = jaccardSimilarity(tokens, candidate.tokens);
      if (overlap > threshold) {
        totalPenalty = Math.max(totalPenalty, penalty);
      }
    }
    const newScore = Math.max(0, item.score - totalPenalty);
    picked.push({
      item: { ...item, score: newScore } as T,
      tokens
    });
  }

  return picked
    .map((p) => p.item)
    .sort((a, b) => b.score - a.score);
}

export interface MemoryCompressorOptions {
  /** Min salience to consider for compression */
  maxSalience?: number;
  /** Min age in days */
  minAgeDays?: number;
  /** Max memories to compress per run */
  maxPerRun?: number;
  /** Cluster by memory_type */
  clusterByType?: boolean;
  dryRun?: boolean;
}

export interface MemoryCompressionReport {
  ok: boolean;
  nowIso: string;
  compressed: number;
  summaryRef: string | null;
  dryRun: boolean;
}

/**
 * MemoryCompressor: Merge low-salience clusters into summaries.
 * Originals marked excluded_from_recall=1, content replaced with summary ref.
 */
export async function runMemoryCompression(
  rootPath: string,
  options?: MemoryCompressorOptions
): Promise<MemoryCompressionReport> {
  await ensureMemoryStore(rootPath);
  const nowIso = new Date().toISOString();
  const maxSalience = clamp01(options?.maxSalience ?? 0.18);
  const minAgeDays = Math.max(7, options?.minAgeDays ?? 14);
  const maxPerRun = Math.min(50, Math.max(5, options?.maxPerRun ?? 20));
  const dryRun = options?.dryRun === true;

  const cutoffIso = new Date(
    Date.now() - minAgeDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'memoryType', memory_type,",
      "'salience', salience,",
      "'state', state",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL",
      "AND excluded_from_recall = 0",
      "AND state != 'scar'",
      `AND salience <= ${maxSalience}`,
      `AND updated_at <= ${sqlText(cutoffIso)}`,
      "ORDER BY salience ASC, updated_at ASC",
      `LIMIT ${maxPerRun};`
    ].join("\n")
  );

  const rows = parseCompressionRows(raw);
  if (rows.length < 2) {
    return { ok: true, nowIso, compressed: 0, summaryRef: null, dryRun };
  }

  const clusterKey = options?.clusterByType !== false ? "memoryType" : "all";
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = clusterKey === "all" ? "all" : (row.memoryType || "episodic");
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const toCompress = [...groups.values()].flat().slice(0, maxPerRun);
  const summaryParts = toCompress
    .map((r) => r.content.trim().replace(/\s+/g, " ").slice(0, 80))
    .filter(Boolean)
    .slice(0, 5);
  const summary = summaryParts.join(" | ").slice(0, 300);
  const batchId = randomUUID();
  const summaryRef = `[compressed] batch=${batchId} count=${toCompress.length} summary=${summary.slice(0, 100)}`;

  if (!dryRun && toCompress.length > 0) {
    const idsSql = toCompress.map((r) => sqlText(r.id)).join(",");
    await runMemoryStoreSql(
      rootPath,
      [
        "BEGIN;",
        "UPDATE memories",
        `SET content = ${sqlText(summaryRef)},`,
        "state = 'archive',",
        "excluded_from_recall = 1,",
        `updated_at = ${sqlText(nowIso)}`,
        `WHERE id IN (${idsSql});`,
        "COMMIT;"
      ].join("\n")
    );
  }

  return {
    ok: true,
    nowIso,
    compressed: dryRun ? 0 : toCompress.length,
    summaryRef: dryRun ? null : summaryRef,
    dryRun
  };
}

export interface DeepRecallOptions {
  /** Max evidence blocks to return */
  maxBlocks?: number;
  /** Max chars per block */
  maxCharsPerBlock?: number;
  /** Query for semantic match (optional) */
  query?: string;
}

export interface DeepRecallResult {
  blocks: Array<{ id: string; content: string; source: "archive" | "active" }>;
  traceId: string;
}

/**
 * DeepRecallHandler: Budget-gated evidence retrieval from archive.
 * Used when normal recall misses key evidence; fetches from archive_segments.
 */
export async function runDeepRecall(
  rootPath: string,
  options?: DeepRecallOptions
): Promise<DeepRecallResult> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  await ensureMemoryStore(rootPath);
  const maxBlocks = Math.min(6, Math.max(1, options?.maxBlocks ?? 3));
  const maxCharsPerBlock = Math.min(400, Math.max(80, options?.maxCharsPerBlock ?? 200));
  const traceId = randomUUID();

  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT payload_json",
      "FROM archive_segments",
      "ORDER BY created_at DESC",
      "LIMIT 5;"
    ].join("\n")
  );

  const blocks: DeepRecallResult["blocks"] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n").filter(Boolean)) {
    if (blocks.length >= maxBlocks) break;
    try {
      const parsed = JSON.parse(line) as { payload_json?: string };
      const payload = JSON.parse(parsed.payload_json ?? "{}") as {
        ids?: string[];
        file?: string;
      };
      const relFile = payload.file;
      if (!relFile || typeof relFile !== "string") continue;
      const filePath = path.join(rootPath, relFile);
      let segmentContent: string;
      try {
        segmentContent = await readFile(filePath, "utf8");
      } catch {
        continue;
      }
      for (const jsonLine of segmentContent.split("\n").filter(Boolean)) {
        if (blocks.length >= maxBlocks) break;
        try {
          const entry = JSON.parse(jsonLine) as { memory?: { id?: string; content?: string } };
          const mem = entry.memory;
          if (!mem?.id || !mem?.content) continue;
          const content = String(mem.content).trim();
          if (content.startsWith("[archived_ref]") || content.startsWith("[compressed]")) continue;
          if (seen.has(mem.id)) continue;
          seen.add(mem.id);
          blocks.push({
            id: mem.id,
            content: content.slice(0, maxCharsPerBlock),
            source: "archive"
          });
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return { blocks, traceId };
}

/**
 * Compute decay_rate from genome memory_retention (via memoryHalfLifeDays).
 * Exported for use by memory_lifecycle / ingest salience gain.
 */
export function getDecayRateFromGenome(
  genome: GenomeConfig,
  epigenetics: EpigeneticsConfig
): number {
  const derived = computeDerivedParams(genome, epigenetics);
  return Math.log(2) / Math.max(7, derived.memoryHalfLifeDays);
}

/**
 * Compute salience gain multiplier from genome memory_imprint.
 * Used when ingesting new memories.
 */
export function getSalienceGainFromGenome(
  genome: GenomeConfig,
  epigenetics: EpigeneticsConfig
): number {
  const derived = computeDerivedParams(genome, epigenetics);
  return derived.salienceGain;
}

// --- helpers ---

function parseDecayRows(raw: string): Array<{ id: string; salience: number; lastActivatedAt: string; state: string }> {
  const rows: Array<{ id: string; salience: number; lastActivatedAt: string; state: string }> = [];
  for (const line of raw.split("\n").filter(Boolean)) {
    try {
      const p = JSON.parse(line) as Record<string, unknown>;
      const id = String(p.id ?? "");
      if (!id) continue;
      rows.push({
        id,
        salience: clamp01(Number(p.salience)),
        lastActivatedAt: String(p.lastActivatedAt ?? ""),
        state: String(p.state ?? "warm")
      });
    } catch {
      continue;
    }
  }
  return rows;
}

function parseCompressionRows(
  raw: string
): Array<{ id: string; content: string; memoryType: string; salience: number; state: string }> {
  const rows: Array<{ id: string; content: string; memoryType: string; salience: number; state: string }> = [];
  for (const line of raw.split("\n").filter(Boolean)) {
    try {
      const p = JSON.parse(line) as Record<string, unknown>;
      const id = String(p.id ?? "");
      if (!id) continue;
      rows.push({
        id,
        content: String(p.content ?? ""),
        memoryType: String(p.memoryType ?? "episodic"),
        salience: clamp01(Number(p.salience)),
        state: String(p.state ?? "cold")
      });
    } catch {
      continue;
    }
  }
  return rows;
}

function daysSince(olderIso: string, newerIso: string): number {
  const older = Date.parse(olderIso);
  const newer = Date.parse(newerIso);
  if (!Number.isFinite(older) || !Number.isFinite(newer) || newer <= older) return 0;
  return (newer - older) / (24 * 60 * 60 * 1000);
}

const WORD_PATTERN = /[\p{L}\p{N}_]+/gu;

function tokenize(text: string): Set<string> {
  const found = (text ?? "").toLowerCase().match(WORD_PATTERN) ?? [];
  const tokens = new Set<string>();
  for (const t of found) {
    if (t.length >= 2) tokens.add(t);
  }
  return tokens;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function sqlText(value: string): string {
  return `'${String(value).replace(/'/g, "''")}'`;
}
