import { createHash, randomUUID } from "node:crypto";
import { appendLifeEvent, readLifeEvents } from "./persona.js";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
import { normalizePreferredNameCandidate } from "./profile.js";
import type { LifeEvent, ModelAdapter } from "./types.js";

export interface MemoryConsolidationOptions {
  trigger?: string;
  mode?: "light" | "full";
  budgetMs?: number;
  conflictPolicy?: "newest" | "trusted";
  /** EB-3: LLM adapter for semantic extraction (full mode only) */
  llmAdapter?: ModelAdapter;
}

export interface MemoryConsolidationReport {
  ok: boolean;
  trigger: string;
  mode: "light" | "full";
  conflictPolicy: "newest" | "trusted";
  startedAt: string;
  finishedAt: string;
  scannedUserMessages: number;
  extractedCandidates: number;
  dedupedByExisting: number;
  inserted: number;
  conflictsDetected: number;
  conflictRecordsWritten: number;
  pinCandidates: string[];
  consolidationRunId: string;
  /** EB-3: extraction path used */
  consolidationAssessmentPath?: "semantic" | "regex_fallback";
}

interface ConsolidationCandidate {
  content: string;
  salience: number;
  evidenceLevel: "verified" | "derived";
  sourceEventHash: string;
  credibilityScore: number;
  /** EB-3: [distinctiveness, emotional_salience, actionability] */
  salience_latent?: number[];
}

const PREFERENCE_PATTERNS = [
  /(?:我|用户).{0,6}(?:喜欢|偏好|习惯|通常|总是)([^。！？\n]{1,80})/u,
  /\b(?:i|user)\s+(?:prefer|like|usually|always)\s+([^.!?\n]{1,80})/iu
];

const PROFILE_PATTERNS = [
  /(?:我叫|叫我|名字是)([^。！？\n]{1,48})/u,
  /\b(?:my name is|call me)\s+([^.!?\n]{1,48})/iu
];

const PROCEDURAL_PATTERNS = [
  /(?:请|最好|记住).{0,12}(?:步骤|流程|格式|结构|先.*再)([^。！？\n]{0,80})/u,
  /\b(?:please|remember)\b[^.!?\n]{0,80}\b(?:steps?|workflow|format|structure)\b([^.!?\n]{0,80})/iu
];

export async function runMemoryConsolidation(
  rootPath: string,
  options?: MemoryConsolidationOptions
): Promise<MemoryConsolidationReport> {
  const startedAt = new Date().toISOString();
  const trigger = options?.trigger?.trim() || "manual";
  const mode = options?.mode === "full" ? "full" : "light";
  const conflictPolicy = options?.conflictPolicy === "trusted" ? "trusted" : "newest";
  const budgetMs = normalizeBudget(mode, options?.budgetMs);
  const startMs = Date.now();
  const consolidationRunId = randomUUID();

  try {
    await ensureMemoryStore(rootPath);
    const events = await readLifeEvents(rootPath);
    const sourceEvents = events
      .filter((event) => event.type === "user_message")
      .slice(mode === "full" ? -800 : -120);

    // EB-3: Use semantic extraction in full mode when llmAdapter is provided
    let candidates: ConsolidationCandidate[];
    let consolidationAssessmentPath: "semantic" | "regex_fallback" = "regex_fallback";
    if (mode === "full" && options?.llmAdapter) {
      try {
        candidates = await extractCandidatesFromEventsSemantic(sourceEvents, options.llmAdapter);
        consolidationAssessmentPath = "semantic";
      } catch {
        candidates = extractCandidatesFromEvents(sourceEvents, startMs, budgetMs);
      }
    } else {
      candidates = extractCandidatesFromEvents(sourceEvents, startMs, budgetMs);
    }
    const existing = await fetchExistingSemanticSet(rootPath);
    const activeSemantics = await fetchActiveSemanticMemories(rootPath);
    const deduped = new Map<string, ConsolidationCandidate>();
    let dedupedByExisting = 0;
    let conflictsDetected = 0;
    const conflictStatements: string[] = [];
    const pinCandidates = new Set<string>();
    const nowIso = new Date().toISOString();

    for (const item of candidates) {
      const key = normalizeMemoryKey(item.content);
      if (!key) {
        continue;
      }
      if (existing.has(key)) {
        dedupedByExisting += 1;
        continue;
      }
      const prev = deduped.get(key);
      if (!prev || item.salience > prev.salience) {
        deduped.set(key, item);
      }
    }

    const finalCandidates: ConsolidationCandidate[] = [];
    for (const candidate of deduped.values()) {
      const conflictKey = inferConflictKey(candidate.content);
      const possibleLosers =
        conflictKey.length > 0
          ? activeSemantics.filter((row) => inferConflictKey(row.content) === conflictKey && row.content !== candidate.content)
          : [];

      if (possibleLosers.length > 0) {
        conflictsDetected += 1;
        const winner = pickWinner(candidate, possibleLosers, conflictPolicy);
        if (winner === "candidate") {
          const loserIds = possibleLosers.map((row) => row.id);
          conflictStatements.push(makeConflictInsertSql(conflictKey, "candidate", loserIds, conflictPolicy, nowIso));
        } else {
          conflictStatements.push(makeConflictInsertSql(conflictKey, winner.id, ["candidate"], conflictPolicy, nowIso));
          continue;
        }
      }

      if (isPinCandidate(candidate.content)) {
        pinCandidates.add(candidate.content);
      }
      finalCandidates.push(candidate);
    }

    const boundedInserts = finalCandidates
      .slice(0, mode === "full" ? 48 : 16)
      .map((item) => makeInsertSql(item, startedAt));

    const stats = {
      scannedUserMessages: sourceEvents.length,
      extractedCandidates: candidates.length,
      dedupedByExisting,
      inserted: boundedInserts.length,
      conflictsDetected,
      conflictRecordsWritten: conflictStatements.length
    };

    if (boundedInserts.length > 0 || conflictStatements.length > 0) {
      await runMemoryStoreSql(
        rootPath,
        `
        BEGIN;
        ${boundedInserts.join("\n")}
        ${conflictStatements.join("\n")}
        INSERT INTO memory_consolidation_runs (id, trigger, mode, stats_json, created_at)
        VALUES (${sqlText(consolidationRunId)}, ${sqlText(trigger)}, ${sqlText(mode)}, ${sqlText(JSON.stringify(stats))}, ${sqlText(nowIso)});
        COMMIT;
        `
      );
    } else {
      await runMemoryStoreSql(
        rootPath,
        [
          "INSERT INTO memory_consolidation_runs (id, trigger, mode, stats_json, created_at)",
          `VALUES (${sqlText(consolidationRunId)}, ${sqlText(trigger)}, ${sqlText(mode)}, ${sqlText(JSON.stringify(stats))}, ${sqlText(nowIso)});`
        ].join(" ")
      );
    }

    const report: MemoryConsolidationReport = {
      ok: true,
      trigger,
      mode,
      conflictPolicy,
      startedAt,
      finishedAt: new Date().toISOString(),
      scannedUserMessages: sourceEvents.length,
      extractedCandidates: candidates.length,
      dedupedByExisting,
      inserted: boundedInserts.length,
      conflictsDetected,
      conflictRecordsWritten: conflictStatements.length,
      pinCandidates: [...pinCandidates].slice(0, 8),
      consolidationRunId,
      consolidationAssessmentPath
    };

    await appendLifeEvent(rootPath, {
      type: "memory_consolidated",
      payload: report as unknown as Record<string, unknown>
    });
    return report;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await appendLifeEvent(rootPath, {
        type: "memory_consolidation_failed",
        payload: {
          trigger,
          mode,
          conflictPolicy,
          startedAt,
          finishedAt: new Date().toISOString(),
          error: message
        }
      });
    } catch {
      // Ignore follow-up audit failure, keep consolidation failure report deterministic.
    }
    return {
      ok: false,
      trigger,
      mode,
      conflictPolicy,
      startedAt,
      finishedAt: new Date().toISOString(),
      scannedUserMessages: 0,
      extractedCandidates: 0,
      dedupedByExisting: 0,
      inserted: 0,
      conflictsDetected: 0,
      conflictRecordsWritten: 0,
      pinCandidates: [],
      consolidationRunId
    };
  }
}

/** EB-3: Semantic extraction using LLM (full mode only) */
async function extractCandidatesFromEventsSemantic(
  events: LifeEvent[],
  llmAdapter: ModelAdapter
): Promise<ConsolidationCandidate[]> {
  const texts = events
    .slice(-40)
    .map((e) => (typeof e.payload.text === "string" ? e.payload.text.trim() : ""))
    .filter((t) => t.length > 0);

  if (texts.length === 0) {
    return [];
  }

  const prefixes = [
    "用户偏好：",
    "用户称呼：",
    "交互偏好流程：",
    "用户特征：",
    "用户背景："
  ].join("、");
  const prompt = [
    "请从以下用户消息中提炼记忆片段。输出 JSON 数组，每项包含字段：",
    `- content: 记忆内容（以${prefixes}之一开头）`,
    "- salience: 显著度 0.0~1.0",
    "- salience_latent: [独特性, 情感显著度, 可操作性] 各 0.0~1.0",
    '- evidenceLevel: "verified" 或 "derived"',
    "- credibilityScore: 0.0~1.0",
    "只输出 JSON 数组，不要其他内容。若无可提炼内容则输出 []。",
    "",
    "用户消息：",
    texts.map((t, i) => `[${i + 1}] ${t}`).join("\n")
  ].join("\n");

  let raw = "";
  await llmAdapter.streamChat(
    [{ role: "user", content: prompt }],
    {
      onToken: (token: string) => {
        raw += token;
      },
      onDone: () => {}
    },
    undefined
  );

  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    const parsed = JSON.parse(jsonMatch[0]) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    const out: ConsolidationCandidate[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const rec = item as Record<string, unknown>;
      const content = typeof rec.content === "string" ? rec.content.trim() : "";
      if (!content || content.length < 4) {
        continue;
      }
      const salience =
        typeof rec.salience === "number" ? Math.max(0, Math.min(1, rec.salience)) : 0.6;
      const credibilityScore =
        typeof rec.credibilityScore === "number"
          ? Math.max(0, Math.min(1, rec.credibilityScore))
          : 0.85;
      const evidenceLevel: "verified" | "derived" =
        rec.evidenceLevel === "verified" ? "verified" : "derived";

      let salience_latent: number[] | undefined;
      if (Array.isArray(rec.salience_latent) && rec.salience_latent.length === 3) {
        salience_latent = (rec.salience_latent as unknown[]).map((v) =>
          typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5
        );
      }

      out.push({
        content: content.slice(0, 240),
        salience,
        evidenceLevel,
        sourceEventHash: events[0]?.hash ?? "semantic",
        credibilityScore,
        salience_latent
      });
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeBudget(mode: "light" | "full", budgetMs: number | undefined): number {
  if (!Number.isFinite(budgetMs)) {
    return mode === "full" ? 5000 : 1200;
  }
  return Math.max(200, Math.min(30000, Math.floor(Number(budgetMs))));
}

function extractCandidatesFromEvents(
  events: LifeEvent[],
  startMs: number,
  budgetMs: number
): ConsolidationCandidate[] {
  const out: ConsolidationCandidate[] = [];
  for (const event of events) {
    if (Date.now() - startMs > budgetMs) {
      break;
    }
    const text = typeof event.payload.text === "string" ? event.payload.text.trim() : "";
    if (!text) {
      continue;
    }

    for (const pattern of PREFERENCE_PATTERNS) {
      const matched = text.match(pattern);
      if (!matched) {
        continue;
      }
      const detail = cleanupFragment(matched[1] ?? "");
      if (!detail) {
        continue;
      }
      out.push({
        content: `用户偏好：${detail}`,
        salience: 0.72,
        evidenceLevel: "verified",
        sourceEventHash: event.hash,
        credibilityScore: 0.96
      });
    }

    for (const pattern of PROFILE_PATTERNS) {
      const matched = text.match(pattern);
      if (!matched) {
        continue;
      }
      const name = normalizePreferredNameCandidate(matched[1] ?? "");
      if (!name) {
        continue;
      }
      out.push({
        content: `用户称呼：${name}`,
        salience: 0.82,
        evidenceLevel: "verified",
        sourceEventHash: event.hash,
        credibilityScore: 0.99
      });
    }

    for (const pattern of PROCEDURAL_PATTERNS) {
      const matched = text.match(pattern);
      if (!matched) {
        continue;
      }
      const detail = cleanupFragment(matched[0] ?? "");
      if (!detail) {
        continue;
      }
      out.push({
        content: `交互偏好流程：${detail}`,
        salience: 0.64,
        evidenceLevel: "derived",
        sourceEventHash: event.hash,
        credibilityScore: 0.9
      });
    }
  }
  return out;
}

async function fetchExistingSemanticSet(rootPath: string): Promise<Set<string>> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT lower(content)",
      "FROM memories",
      "WHERE deleted_at IS NULL AND excluded_from_recall = 0 AND memory_type = 'semantic'",
      "ORDER BY updated_at DESC",
      "LIMIT 5000;"
    ].join("\n")
  );
  const out = new Set<string>();
  if (!raw.trim()) {
    return out;
  }
  for (const line of raw.split("\n")) {
    const key = normalizeMemoryKey(line);
    if (key) {
      out.add(key);
    }
  }
  return out;
}

async function fetchActiveSemanticMemories(
  rootPath: string
): Promise<Array<{ id: string; content: string; credibilityScore: number }>> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'credibilityScore', credibility_score",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL AND excluded_from_recall = 0 AND memory_type = 'semantic'",
      "ORDER BY updated_at DESC",
      "LIMIT 2000;"
    ].join("\n")
  );
  if (!raw.trim()) {
    return [];
  }
  const out: Array<{ id: string; content: string; credibilityScore: number }> = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const content = typeof parsed.content === "string" ? parsed.content : "";
      if (!id || !content) {
        continue;
      }
      out.push({
        id,
        content,
        credibilityScore: Number.isFinite(Number(parsed.credibilityScore))
          ? Math.max(0, Math.min(1, Number(parsed.credibilityScore)))
          : 0.8
      });
    } catch {
      continue;
    }
  }
  return out;
}

// ── Conflict key specification ─────────────────────────────────────────────
// Each prefix maps to a semantic conflict key. Only one memory per key is
// the "winner" — duplicate/conflicting records are resolved by policy.
// Keys use dot notation: domain.subdomain[.detail]
export const CONFLICT_KEY_RULES: ReadonlyArray<{ prefix: string; key: string }> = [
  // Identity / name
  { prefix: "用户称呼：", key: "user.preferred_name" },
  { prefix: "用户真实姓名：", key: "user.real_name" },
  { prefix: "用户昵称：", key: "user.nickname" },
  // Location
  { prefix: "用户所在地：", key: "user.location" },
  { prefix: "用户城市：", key: "user.location.city" },
  { prefix: "用户国家：", key: "user.location.country" },
  // Occupation / work
  { prefix: "用户职业：", key: "user.occupation" },
  { prefix: "用户工作：", key: "user.occupation" },
  { prefix: "用户公司：", key: "user.occupation.company" },
  // Preferences
  { prefix: "用户偏好：", key: "user.preference.general" },
  { prefix: "交互偏好流程：", key: "user.preference.procedural" },
  { prefix: "用户语言偏好：", key: "user.preference.language" },
  { prefix: "用户沟通风格偏好：", key: "user.preference.communication" },
  // Interests
  { prefix: "用户兴趣：", key: "user.interest.topic" },
  { prefix: "用户爱好：", key: "user.interest.hobby" },
  // Beliefs / values
  { prefix: "用户价值观：", key: "user.belief.value" },
  { prefix: "用户立场：", key: "user.belief.stance" },
  // Persona style feedback
  { prefix: "用户期望的回应风格：", key: "persona.expected_style" },
  { prefix: "用户反馈（风格）：", key: "persona.style_feedback" },
  // Goals
  { prefix: "用户当前目标：", key: "user.goal.current" },
  { prefix: "用户长期目标：", key: "user.goal.longterm" }
];

export function inferConflictKey(content: string): string {
  const normalized = normalizeMemoryKey(content);
  if (!normalized) {
    return "";
  }
  for (const rule of CONFLICT_KEY_RULES) {
    if (normalized.startsWith(normalizeMemoryKey(rule.prefix))) {
      return rule.key;
    }
  }
  return "";
}

function pickWinner(
  candidate: ConsolidationCandidate,
  existing: Array<{ id: string; content: string; credibilityScore: number }>,
  policy: "newest" | "trusted"
): "candidate" | { id: string } {
  if (policy === "newest") {
    return "candidate";
  }
  const strongestExisting = [...existing].sort((a, b) => b.credibilityScore - a.credibilityScore)[0];
  if (!strongestExisting) {
    return "candidate";
  }
  return candidate.credibilityScore >= strongestExisting.credibilityScore + 0.03
    ? "candidate"
    : { id: strongestExisting.id };
}

function makeConflictInsertSql(
  conflictKey: string,
  winnerMemoryId: string,
  loserMemoryIds: string[],
  policy: "newest" | "trusted",
  nowIso: string
): string {
  const id = randomUUID();
  return [
    "INSERT INTO memory_conflicts",
    "(id, conflict_key, winner_memory_id, loser_memory_ids_json, resolution_policy, resolved_at)",
    "VALUES",
    `(${sqlText(id)}, ${sqlText(conflictKey)}, ${sqlText(winnerMemoryId)}, ${sqlText(JSON.stringify(loserMemoryIds))}, ${sqlText(policy)}, ${sqlText(nowIso)});`
  ].join(" ");
}

function isPinCandidate(content: string): boolean {
  return content.startsWith("用户称呼：") || content.startsWith("用户偏好：");
}

function makeInsertSql(item: ConsolidationCandidate, nowIso: string): string {
  const id = randomUUID();
  const sourceTag = createHash("sha256").update(`${item.sourceEventHash}|${item.content}`, "utf8").digest("hex");
  return [
    "INSERT INTO memories",
    "(id, memory_type, content, salience, state, origin_role, evidence_level, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
    "VALUES",
    `(${sqlText(id)}, 'semantic', ${sqlText(item.content.slice(0, 240))}, ${item.salience}, 'warm', 'user', ${sqlText(item.evidenceLevel)}, 1, ${sqlText(nowIso)}, 0.2, 0.5, ${Math.max(0.2, Math.min(1, item.credibilityScore))}, 0, 0, ${sqlText(`consolidated:${sourceTag}`)}, ${sqlText(nowIso)}, ${sqlText(nowIso)}, NULL);`
  ].join(" ");
}

function cleanupFragment(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").replace(/[。！？.!?]+$/g, "").trim();
  if (cleaned.length < 2) {
    return "";
  }
  return cleaned.slice(0, 120);
}

function normalizeMemoryKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
