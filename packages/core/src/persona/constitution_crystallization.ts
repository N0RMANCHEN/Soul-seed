import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, stat, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runMemoryStoreSql } from "../memory/memory_store.js";
import { appendLifeEvent, readLifeEvents } from "./persona.js";
import type { ModelAdapter } from "../types.js";

// Hard file size limits (bytes)
const MAX_CONSTITUTION_BYTES = 2048;
const MAX_HABITS_BYTES = 1024;
const MAX_WORLDVIEW_BYTES = 1024;

export type CrystallizationDomain = "constitution" | "habits" | "worldview";
export type CrystallizationStatus = "pending" | "applied" | "rejected";

export interface CrystallizationDiff {
  field: string;
  before: unknown;
  after: unknown;
  rationale: string;
}

export interface CrystallizationRun {
  id: string;
  domain: CrystallizationDomain;
  trigger: "auto" | "manual";
  candidateDiff: CrystallizationDiff[];
  status: CrystallizationStatus;
  reviewer?: string;
  reviewedAt?: string;
  appliedAt?: string;
  rationale: string;
  sampledEventHashes: string[];
  schemaVersion: "1.0";
  createdAt: string;
}

export interface CrystallizationFileSizeReport {
  constitutionBytes: number;
  habitsBytes: number;
  worldviewBytes: number;
  constitutionOverLimit: boolean;
  habitsOverLimit: boolean;
  worldviewOverLimit: boolean;
}

export async function checkCrystallizationFileSizes(rootPath: string): Promise<CrystallizationFileSizeReport> {
  const getSize = async (filename: string): Promise<number> => {
    try {
      const s = await stat(path.join(rootPath, filename));
      return s.size;
    } catch {
      return 0;
    }
  };
  const [constitutionBytes, habitsBytes, worldviewBytes] = await Promise.all([
    getSize("constitution.json"),
    getSize("habits.json"),
    getSize("worldview.json")
  ]);
  return {
    constitutionBytes,
    habitsBytes,
    worldviewBytes,
    constitutionOverLimit: constitutionBytes > MAX_CONSTITUTION_BYTES,
    habitsOverLimit: habitsBytes > MAX_HABITS_BYTES,
    worldviewOverLimit: worldviewBytes > MAX_WORLDVIEW_BYTES
  };
}

export async function listCrystallizationRuns(
  rootPath: string,
  options?: { domain?: CrystallizationDomain; status?: CrystallizationStatus; limit?: number }
): Promise<CrystallizationRun[]> {
  const limit = options?.limit ?? 20;
  const clauses: string[] = [];
  if (options?.domain) {
    clauses.push(`domain = '${options.domain}'`);
  }
  if (options?.status) {
    clauses.push(`status = '${options.status}'`);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await runMemoryStoreSql(
    rootPath,
    `SELECT id, domain, trigger, candidate_diff_json, status, reviewer, reviewed_at, applied_at, rationale, sampled_event_hashes_json, schema_version, created_at FROM crystallization_runs ${where} ORDER BY created_at DESC LIMIT ${limit};`
  );
  if (!rows.trim()) return [];
  return rows
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      return {
        id: parts[0] ?? "",
        domain: (parts[1] ?? "constitution") as CrystallizationDomain,
        trigger: (parts[2] ?? "manual") as "auto" | "manual",
        candidateDiff: safeParseJson<CrystallizationDiff[]>(parts[3] ?? "[]", []),
        status: (parts[4] ?? "pending") as CrystallizationStatus,
        reviewer: parts[5] || undefined,
        reviewedAt: parts[6] || undefined,
        appliedAt: parts[7] || undefined,
        rationale: parts[8] ?? "",
        sampledEventHashes: safeParseJson<string[]>(parts[9] ?? "[]", []),
        schemaVersion: "1.0" as const,
        createdAt: parts[11] ?? ""
      };
    });
}

export async function proposeConstitutionCrystallization(
  rootPath: string,
  options: {
    domain: CrystallizationDomain;
    trigger?: "auto" | "manual";
    sampledEventHashes?: string[];
    /** 可选 LLM adapter；提供时从记忆中归纳候选内容条目（上行管道）；未提供时退化为仅大小修剪 */
    adapter?: ModelAdapter;
  }
): Promise<CrystallizationRun> {
  const { domain, trigger = "manual", sampledEventHashes = [], adapter } = options;

  // Read current file
  const currentContent = await readCurrentDomainFile(rootPath, domain);

  // Generate candidate diff: trim over-limit entries + memory-derived additions (if adapter provided)
  const candidateDiff = await generateCandidateDiff(rootPath, domain, currentContent, adapter);

  const nowIso = new Date().toISOString();
  const run: CrystallizationRun = {
    id: randomUUID(),
    domain,
    trigger,
    candidateDiff,
    status: "pending",
    rationale: `Crystallization proposal for ${domain} (trigger: ${trigger})`,
    sampledEventHashes,
    schemaVersion: "1.0",
    createdAt: nowIso
  };

  await runMemoryStoreSql(
    rootPath,
    `INSERT INTO crystallization_runs (id, domain, trigger, candidate_diff_json, status, rationale, sampled_event_hashes_json, schema_version, created_at) VALUES ('${escSql(run.id)}', '${domain}', '${trigger}', '${escSql(JSON.stringify(run.candidateDiff))}', 'pending', '${escSql(run.rationale)}', '${escSql(JSON.stringify(sampledEventHashes))}', '1.0', '${nowIso}');`
  );

  await appendLifeEvent(rootPath, {
    type: "constitution_crystallization_proposed",
    payload: {
      runId: run.id,
      domain,
      trigger,
      diffCount: candidateDiff.length
    }
  });

  return run;
}

export async function applyCrystallizationRun(
  rootPath: string,
  runId: string
): Promise<{ ok: boolean; reason?: string }> {
  const runs = await listCrystallizationRuns(rootPath, { limit: 200 });
  const run = runs.find((r) => r.id === runId);
  if (!run) {
    return { ok: false, reason: `crystallization run ${runId} not found` };
  }
  if (run.status !== "pending") {
    return { ok: false, reason: `run status is ${run.status}, only pending runs can be applied` };
  }

  // Save before snapshot for rollback
  const currentContent = await readCurrentDomainFile(rootPath, run.domain);
  await saveBeforeSnapshot(rootPath, run.id, run.domain, currentContent);

  // Apply the diff to the file
  const result = await applyDiffToFile(rootPath, run.domain, run.candidateDiff);
  if (!result.ok) {
    return result;
  }

  // Check size limits after apply
  const sizes = await checkCrystallizationFileSizes(rootPath);
  if (run.domain === "constitution" && sizes.constitutionOverLimit) {
    return { ok: false, reason: `constitution.json exceeds ${MAX_CONSTITUTION_BYTES}B limit after apply` };
  }
  if (run.domain === "habits" && sizes.habitsOverLimit) {
    return { ok: false, reason: `habits.json exceeds ${MAX_HABITS_BYTES}B limit after apply` };
  }
  if (run.domain === "worldview" && sizes.worldviewOverLimit) {
    return { ok: false, reason: `worldview.json exceeds ${MAX_WORLDVIEW_BYTES}B limit after apply` };
  }

  const nowIso = new Date().toISOString();
  await runMemoryStoreSql(
    rootPath,
    `UPDATE crystallization_runs SET status = 'applied', applied_at = '${nowIso}' WHERE id = '${escSql(runId)}';`
  );

  await appendLifeEvent(rootPath, {
    type: "constitution_crystallization_applied",
    payload: {
      runId,
      domain: run.domain,
      diffCount: run.candidateDiff.length,
      appliedAt: nowIso
    }
  });

  return { ok: true };
}

export async function rejectCrystallizationRun(
  rootPath: string,
  runId: string,
  reviewer?: string
): Promise<{ ok: boolean; reason?: string }> {
  const runs = await listCrystallizationRuns(rootPath, { limit: 200 });
  const run = runs.find((r) => r.id === runId);
  if (!run) {
    return { ok: false, reason: `crystallization run ${runId} not found` };
  }
  if (run.status !== "pending") {
    return { ok: false, reason: `run status is ${run.status}` };
  }
  const nowIso = new Date().toISOString();
  const reviewerSql = reviewer ? `'${escSql(reviewer)}'` : "NULL";
  await runMemoryStoreSql(
    rootPath,
    `UPDATE crystallization_runs SET status = 'rejected', reviewer = ${reviewerSql}, reviewed_at = '${nowIso}' WHERE id = '${escSql(runId)}';`
  );
  return { ok: true };
}

// ── Review request state machine ──────────────────────────────────────────────

export interface ConstitutionReviewRequest {
  reviewHash: string;
  ts: string;
  reason: string;
  triggeredBy: string;
  recommendedAction: string;
  status: "open" | "approved" | "rejected";
}

export async function listConstitutionReviewRequests(
  rootPath: string
): Promise<ConstitutionReviewRequest[]> {
  const events = await readLifeEvents(rootPath);
  const actedOn = new Set<string>();

  for (const ev of events) {
    if (ev.type === "constitution_review_approved" || ev.type === "constitution_review_rejected") {
      const refHash = String(ev.payload.reviewHash ?? "");
      if (refHash) actedOn.add(refHash);
    }
  }

  const results: ConstitutionReviewRequest[] = [];
  for (const ev of events) {
    if (ev.type !== "constitution_review_requested") continue;
    // Determine actual status
    const acted = events.find(
      (e) =>
        (e.type === "constitution_review_approved" || e.type === "constitution_review_rejected") &&
        String(e.payload.reviewHash ?? "") === ev.hash
    );
    results.push({
      reviewHash: ev.hash,
      ts: ev.ts,
      reason: String(ev.payload.reason ?? ""),
      triggeredBy: String(ev.payload.triggeredBy ?? ""),
      recommendedAction: String(ev.payload.recommendedAction ?? ""),
      status: acted ? (acted.type === "constitution_review_approved" ? "approved" : "rejected") : "open"
    });
  }
  return results;
}

export async function approveConstitutionReview(
  rootPath: string,
  reviewHash: string,
  reviewer?: string
): Promise<{ ok: boolean; reason?: string }> {
  const requests = await listConstitutionReviewRequests(rootPath);
  const request = requests.find((r) => r.reviewHash === reviewHash || r.reviewHash.startsWith(reviewHash));
  if (!request) {
    return { ok: false, reason: `review request ${reviewHash} not found` };
  }
  if (request.status !== "open") {
    return { ok: false, reason: `review request is already ${request.status}` };
  }
  const nowIso = new Date().toISOString();
  await appendLifeEvent(rootPath, {
    type: "constitution_review_approved",
    payload: {
      reviewHash: request.reviewHash,
      reviewer: reviewer ?? "user",
      approvedAt: nowIso,
      note: "Human confirmed constitution review approved"
    }
  });
  return { ok: true };
}

export async function rejectConstitutionReviewRequest(
  rootPath: string,
  reviewHash: string,
  reviewer?: string,
  reason?: string
): Promise<{ ok: boolean; reason?: string }> {
  const requests = await listConstitutionReviewRequests(rootPath);
  const request = requests.find((r) => r.reviewHash === reviewHash || r.reviewHash.startsWith(reviewHash));
  if (!request) {
    return { ok: false, reason: `review request ${reviewHash} not found` };
  }
  if (request.status !== "open") {
    return { ok: false, reason: `review request is already ${request.status}` };
  }
  const nowIso = new Date().toISOString();
  await appendLifeEvent(rootPath, {
    type: "constitution_review_rejected",
    payload: {
      reviewHash: request.reviewHash,
      reviewer: reviewer ?? "user",
      rejectedAt: nowIso,
      reason: reason ?? "user rejected"
    }
  });
  return { ok: true };
}

// ── Constitution versioning ────────────────────────────────────────────────────

const VERSIONS_DIR = "constitution_versions";

async function saveBeforeSnapshot(
  rootPath: string,
  runId: string,
  domain: CrystallizationDomain,
  content: Record<string, unknown>
): Promise<void> {
  const versionsDir = path.join(rootPath, VERSIONS_DIR);
  if (!existsSync(versionsDir)) {
    await mkdir(versionsDir, { recursive: true });
  }
  const snapshotPath = path.join(versionsDir, `${runId}.before.${domain}.json`);
  await writeFile(snapshotPath, JSON.stringify(content, null, 2), "utf8");
}

export async function getRollbackSnapshot(
  rootPath: string,
  runId: string,
  domain: CrystallizationDomain
): Promise<Record<string, unknown> | null> {
  const snapshotPath = path.join(rootPath, VERSIONS_DIR, `${runId}.before.${domain}.json`);
  if (!existsSync(snapshotPath)) return null;
  const raw = await readFile(snapshotPath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function rollbackCrystallizationRun(
  rootPath: string,
  runId: string
): Promise<{ ok: boolean; reason?: string }> {
  const runs = await listCrystallizationRuns(rootPath, { limit: 500 });
  const run = runs.find((r) => r.id === runId || r.id.startsWith(runId));
  if (!run) {
    return { ok: false, reason: `crystallization run ${runId} not found` };
  }
  if (run.status !== "applied") {
    return { ok: false, reason: `run status is ${run.status}, only applied runs can be rolled back` };
  }

  const snapshot = await getRollbackSnapshot(rootPath, run.id, run.domain);
  if (!snapshot) {
    return {
      ok: false,
      reason: `before snapshot not found for run ${run.id} — cannot rollback (snapshot file missing under ${VERSIONS_DIR}/)`
    };
  }

  // Restore the before snapshot
  const filePath = path.join(rootPath, `${run.domain}.json`);
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");

  // Update DB status to rolled back (use 'rejected' as canonical terminal state)
  const nowIso = new Date().toISOString();
  await runMemoryStoreSql(
    rootPath,
    `UPDATE crystallization_runs SET status = 'rejected', reviewer = 'rollback', reviewed_at = '${nowIso}' WHERE id = '${escSql(run.id)}';`
  );

  await appendLifeEvent(rootPath, {
    type: "constitution_crystallization_rollback",
    payload: {
      runId: run.id,
      domain: run.domain,
      rolledBackAt: nowIso,
      restoredFields: Object.keys(snapshot)
    }
  });

  return { ok: true };
}

// --- memory pattern extraction (LLM-based upward pipeline) ---

const MEMORY_LOOKBACK_DAYS = 90;
const MEMORY_PATTERN_SAMPLE_LIMIT = 30;

/**
 * 从 memory.db 中读取高显著度记忆，通过 LLM 归纳候选内容条目，
 * 作为 CrystallizationDiff 返回（上行管道：经历 → 人格）。
 *
 * constitution 域：归纳候选 values 追加项
 * worldview 域：归纳候选 worldview.seed 更新文本
 */
export async function extractMemoryPatternCandidates(
  rootPath: string,
  domain: "constitution" | "worldview",
  current: Record<string, unknown>,
  adapter: ModelAdapter
): Promise<CrystallizationDiff[]> {
  const cutoff = new Date(Date.now() - MEMORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = await runMemoryStoreSql(
    rootPath,
    `SELECT content FROM memories
     WHERE deleted_at IS NULL
       AND excluded_from_recall = 0
       AND state IN ('hot','warm')
       AND salience >= 0.4
       AND credibility_score >= 0.6
       AND created_at >= '${cutoff}'
     ORDER BY salience DESC, emotion_score DESC
     LIMIT ${MEMORY_PATTERN_SAMPLE_LIMIT};`
  );
  const memories = rows
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (memories.length < 3) {
    return [];
  }

  const memorySample = memories
    .slice(0, 20)
    .map((m, i) => `${i + 1}. ${m.slice(0, 120)}`)
    .join("\n");

  let systemPrompt: string;
  let currentContext: string;

  if (domain === "constitution") {
    const existingValues = Array.isArray(current.values)
      ? (current.values as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    currentContext = existingValues.join("，");
    systemPrompt = [
      "你是人格系统分析工具。从记忆样本中归纳 2-3 个候选条目，追加到人格的 values 列表中。",
      "只输出严格 JSON，格式：{\"candidates\":[\"string1\",\"string2\"]}",
      "候选条目要求：",
      "- 每条 ≤ 15 字",
      "- 代表从记忆中观察到的真实行为模式或价值倾向",
      "- 与现有条目不重复，不抽象",
      "- 若记忆样本不足以归纳新条目，返回空数组：{\"candidates\":[]}",
      "",
      `现有 values：${currentContext || "（空）"}`,
      "",
      "记忆样本：",
      memorySample
    ].join("\n");
  } else {
    const existingSeed = typeof current.seed === "string" ? current.seed : "";
    currentContext = existingSeed.slice(0, 200);
    systemPrompt = [
      "你是人格系统分析工具。从记忆样本中归纳一句新的 worldview seed（世界观核心句）。",
      "只输出严格 JSON，格式：{\"candidates\":[\"string\"]}",
      "要求：",
      "- 一句话，≤ 30 字",
      "- 代表从记忆中观察到的人格对世界的整体认知或立场",
      "- 若记忆样本不足以归纳，返回空数组：{\"candidates\":[]}",
      "",
      `现有 worldview seed：${currentContext || "（空）"}`,
      "",
      "记忆样本：",
      memorySample
    ].join("\n");
  }

  let llmOutput: string;
  try {
    const result = await adapter.streamChat(
      [{ role: "user", content: systemPrompt }],
      { onToken: () => {} }
    );
    llmOutput = result.content;
  } catch {
    return [];
  }

  const parsed = safeParseJson<{ candidates?: unknown }>(llmOutput, {});
  const candidates = Array.isArray(parsed.candidates)
    ? (parsed.candidates as unknown[])
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .map((c) => c.trim().slice(0, domain === "constitution" ? 60 : 120))
        .slice(0, 3)
    : [];

  if (candidates.length === 0) {
    return [];
  }

  if (domain === "constitution") {
    const existingValues = Array.isArray(current.values)
      ? (current.values as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    const novel = candidates.filter((c) => !existingValues.includes(c));
    if (novel.length === 0) {
      return [];
    }
    return [
      {
        field: "values_proposed_additions",
        before: [],
        after: novel,
        rationale: `Memory pattern extraction: ${novel.length} candidate value(s) derived from ${memories.length} recent memories`
      }
    ];
  } else {
    const newSeed = candidates[0];
    const currentSeed = typeof current.seed === "string" ? current.seed : "";
    if (newSeed === currentSeed) {
      return [];
    }
    return [
      {
        field: "worldview_seed_update",
        before: currentSeed,
        after: newSeed,
        rationale: `Memory pattern extraction: worldview seed candidate derived from ${memories.length} recent memories`
      }
    ];
  }
}

// --- internal helpers ---

async function readCurrentDomainFile(rootPath: string, domain: CrystallizationDomain): Promise<Record<string, unknown>> {
  const filename = `${domain}.json`;
  const raw = await readFile(path.join(rootPath, filename), "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function generateCandidateDiff(
  rootPath: string,
  domain: CrystallizationDomain,
  current: Record<string, unknown>,
  adapter?: ModelAdapter
): Promise<CrystallizationDiff[]> {
  const diff: CrystallizationDiff[] = [];

  // Trim array fields that are too long (keep most recent / highest priority items)
  const maxLengths: Record<CrystallizationDomain, Record<string, number>> = {
    constitution: { values: 8, boundaries: 10, commitments: 8 },
    habits: {},
    worldview: {}
  };
  const fieldLimits = maxLengths[domain] ?? {};

  for (const [field, limit] of Object.entries(fieldLimits)) {
    const val = current[field];
    if (Array.isArray(val) && val.length > limit) {
      diff.push({
        field,
        before: val,
        after: val.slice(0, limit),
        rationale: `Trim ${field} to ${limit} items to respect size limit`
      });
    }
  }

  // Truncate string fields that are too long
  if (domain === "constitution") {
    const mission = current.mission;
    if (typeof mission === "string" && mission.length > 300) {
      diff.push({
        field: "mission",
        before: mission,
        after: mission.slice(0, 300),
        rationale: "Trim mission to 300 chars"
      });
    }
  }

  if (domain === "worldview") {
    const seed = current.seed;
    if (typeof seed === "string" && seed.length > 400) {
      diff.push({
        field: "seed",
        before: seed,
        after: seed.slice(0, 400),
        rationale: "Trim worldview seed to 400 chars"
      });
    }
  }

  // Check for size compliance
  const fileSize = await getFileSize(rootPath, domain);
  const limits: Record<CrystallizationDomain, number> = {
    constitution: MAX_CONSTITUTION_BYTES,
    habits: MAX_HABITS_BYTES,
    worldview: MAX_WORLDVIEW_BYTES
  };
  if (fileSize > limits[domain] && diff.length === 0) {
    // Generic warning diff when no specific field to trim
    diff.push({
      field: "_size",
      before: fileSize,
      after: limits[domain],
      rationale: `File size ${fileSize}B exceeds ${limits[domain]}B limit. Manual review needed.`
    });
  }

  // Memory-derived content additions (requires LLM adapter)
  if (adapter && (domain === "constitution" || domain === "worldview")) {
    const patternDiffs = await extractMemoryPatternCandidates(rootPath, domain, current, adapter);
    diff.push(...patternDiffs);
  }

  return diff;
}

async function getFileSize(rootPath: string, domain: CrystallizationDomain): Promise<number> {
  try {
    const s = await stat(path.join(rootPath, `${domain}.json`));
    return s.size;
  } catch {
    return 0;
  }
}

async function applyDiffToFile(
  rootPath: string,
  domain: CrystallizationDomain,
  diffs: CrystallizationDiff[]
): Promise<{ ok: boolean; reason?: string }> {
  if (diffs.length === 0) return { ok: true };

  const filePath = path.join(rootPath, `${domain}.json`);
  const raw = await readFile(filePath, "utf8");
  const current = JSON.parse(raw) as Record<string, unknown>;

  for (const diff of diffs) {
    if (diff.field === "_size") continue; // size-only warning, not actionable

    // Memory-derived values additions: merge into existing array rather than replace
    if (diff.field === "values_proposed_additions") {
      const existing = Array.isArray(current.values)
        ? (current.values as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      const additions = Array.isArray(diff.after)
        ? (diff.after as unknown[]).filter((v): v is string => typeof v === "string")
        : [];
      const merged = [...new Set([...existing, ...additions])].slice(0, 16);
      current.values = merged;
      continue;
    }

    // Memory-derived worldview seed update: replace seed field
    if (diff.field === "worldview_seed_update") {
      if (typeof diff.after === "string" && diff.after.trim().length > 0) {
        current.seed = diff.after.trim().slice(0, 400);
      }
      continue;
    }

    current[diff.field] = diff.after;
  }

  await writeFile(filePath, JSON.stringify(current, null, 2), "utf8");
  return { ok: true };
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function escSql(s: string): string {
  return s.replace(/'/g, "''");
}
