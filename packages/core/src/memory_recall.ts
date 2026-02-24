import { randomUUID } from "node:crypto";
import { searchMemoryVectors } from "./memory_embeddings.js";
import { classifyMemoryState, scoreMemoryFromStoreRow } from "./memory_lifecycle.js";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
import { projectSubjectiveEmphasis } from "./semantic_projection.js";
import type { MemoryEvidenceBlock } from "./types.js";

export interface RecallBudget {
  candidateMax: number;
  rerankMax: number;
  injectMax: number;
  injectCharMax: number;
}

export interface RecallTraceItem {
  id: string;
  score: number;
  reason: "selected" | "rerank_budget" | "inject_item_budget" | "inject_char_budget";
  candidateSource?: "pinned" | "salience" | "fts" | "vector" | "hybrid";
  keywordHits?: number;
  diversityPenaltyApplied?: boolean;
  scoreBreakdown?: {
    salience: number;
    retrievalStrength: number;
    typeBoost: number;
    stateBoost: number;
    keywordScore: number;
    keywordHardBoost: number;
    emphasisBoost?: number;
    recency: number;
    credibility: number;
    ftsScore: number;
    vectorScore: number;
    hybridScore?: number;
    fusionWeights?: {
      fts: number;
      vector: number;
      salience: number;
      recency: number;
      credibility: number;
    };
    originMultiplier: number;
    diversityPenalty: number;
    queryMissPenalty: number;
  };
}

export interface RecallTrace {
  query: string;
  intents: string[];
  budget: RecallBudget & {
    candidates: number;
    reranked: number;
    injected: number;
    injectedChars: number;
  };
  items: RecallTraceItem[];
}

export interface RecallPipelineResult {
  memories: string[];
  memoryBlocks: MemoryEvidenceBlock[];
  selectedIds: string[];
  traceId: string;
  trace: RecallTrace;
}

export interface HybridSearchItem {
  id: string;
  content: string;
  memoryType: string;
  state: string;
  salience: number;
  score: number;
  candidateSource?: RecallTraceItem["candidateSource"];
  ftsScore: number;
  vectorScore: number;
  hybridScore: number;
}

export interface HybridSearchResult {
  query: string;
  traceId: string;
  selectedIds: string[];
  items: HybridSearchItem[];
  trace: RecallTrace;
}

export interface RecallTraceRecord {
  id: string;
  query: string;
  selectedIds: string[];
  scores: Array<Record<string, unknown>>;
  budget: Record<string, unknown>;
  createdAt: string;
}

interface MemoryRow {
  id: string;
  content: string;
  memoryType: string;
  salience: number;
  state: string;
  updatedAt: string;
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  credibilityScore: number;
  reconsolidationCount: number;
  originRole: "user" | "assistant" | "system";
}

const DEFAULT_BUDGET: RecallBudget = {
  candidateMax: 180,
  rerankMax: 30,
  injectMax: 8,
  injectCharMax: 2200
};

/**
 * P4-0: 记忆不确定性分级
 * credibility < 0.6 or age > 60 days → "uncertain"
 */
export function computeMemoryUncertainty(row: {
  credibilityScore?: number;
  reconsolidationCount?: number;
  updatedAt?: string;
}): "certain" | "uncertain" {
  const credibility = row.credibilityScore ?? 1.0;
  if (credibility < 0.6) return "uncertain";
  if (row.updatedAt) {
    const ageMs = Date.now() - Date.parse(row.updatedAt);
    const ageDays = ageMs / 86_400_000;
    if (ageDays > 60) return "uncertain";
  }
  return "certain";
}

const WORD_PATTERN = /[\p{L}\p{N}_]+/gu;
const SIMILARITY_THRESHOLD = 0.85;
const INTERFERENCE_PENALTY = 0.08;

const INTENT_RULES: Array<{ tag: string; pattern: RegExp }> = [
  { tag: "identity", pattern: /(你是谁|你还记得我|我是谁|名字|叫我|name|who am i|remember me)/i },
  { tag: "relationship", pattern: /(关系|朋友|信任|我们|陪伴|relationship|friend|trust)/i },
  { tag: "procedural", pattern: /(怎么|如何|步骤|流程|命令|how to|steps|workflow|command)/i },
  { tag: "preference", pattern: /(偏好|喜欢|习惯|通常|prefer|preference|usually)/i },
  { tag: "factual", pattern: /(事实|定义|是什么|what is|definition|fact)/i },
  { tag: "emotional", pattern: /(难过|开心|焦虑|害怕|情绪|sad|happy|anxious|emotion)/i }
];

const TYPE_HALF_LIFE_DAYS: Record<string, number> = {
  episodic: 14,
  procedural: 30,
  relational: 45,
  semantic: 60
};


interface ScoredCandidate {
  row: MemoryRow;
  score: number;
  candidateSource: "salience" | "fts" | "vector" | "hybrid";
  keywordHits: number;
  diversityPenalty: number;
  scoreBreakdown: RecallTraceItem["scoreBreakdown"];
}

interface RecallQueryCacheEntry {
  value: Array<{ row: MemoryRow; source: "salience" | "fts" | "vector" | "hybrid"; vectorScore: number }>;
  bytes: number;
  expiresAt: number;
}

const RECALL_CACHE_MAX_BYTES = clampIntWithFallback(
  Number(process.env.SOULSEED_RECALL_CACHE_MAX_BYTES ?? 16 * 1024 * 1024),
  16 * 1024 * 1024,
  1024 * 1024,
  64 * 1024 * 1024
);
const RECALL_CACHE_TTL_MS = clampIntWithFallback(
  Number(process.env.SOULSEED_RECALL_CACHE_TTL_MS ?? 30_000),
  30_000,
  1_000,
  300_000
);

const recallQueryCache = new Map<string, RecallQueryCacheEntry>();
let recallQueryCacheBytes = 0;
let recallQueryCacheHits = 0;
let recallQueryCacheMisses = 0;
let recallQueryCacheEvictions = 0;

export function getRecallQueryCacheStats(): {
  entries: number;
  bytes: number;
  maxBytes: number;
  ttlMs: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
} {
  const total = recallQueryCacheHits + recallQueryCacheMisses;
  return {
    entries: recallQueryCache.size,
    bytes: recallQueryCacheBytes,
    maxBytes: RECALL_CACHE_MAX_BYTES,
    ttlMs: RECALL_CACHE_TTL_MS,
    hits: recallQueryCacheHits,
    misses: recallQueryCacheMisses,
    evictions: recallQueryCacheEvictions,
    hitRate: total > 0 ? roundScore(recallQueryCacheHits / total) : 0
  };
}

export function resetRecallQueryCache(): void {
  recallQueryCache.clear();
  recallQueryCacheBytes = 0;
  recallQueryCacheHits = 0;
  recallQueryCacheMisses = 0;
  recallQueryCacheEvictions = 0;
}

function buildRecallQueryCacheKey(
  rootPath: string,
  salienceLimit: number,
  keywordLimit: number,
  keywords: string[]
): string {
  const normalizedKeywords = [...keywords]
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .sort();
  return [rootPath, String(salienceLimit), String(keywordLimit), normalizedKeywords.join("|")].join("::");
}

function getRecallQueryCache(
  key: string
): Array<{ row: MemoryRow; source: "salience" | "fts" | "vector" | "hybrid"; vectorScore: number }> | null {
  const entry = recallQueryCache.get(key);
  if (!entry) {
    recallQueryCacheMisses += 1;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    deleteRecallQueryCacheEntry(key);
    recallQueryCacheMisses += 1;
    return null;
  }
  // refresh LRU order on hit
  recallQueryCache.delete(key);
  recallQueryCache.set(key, entry);
  recallQueryCacheHits += 1;
  return entry.value;
}

function setRecallQueryCache(
  key: string,
  value: Array<{ row: MemoryRow; source: "salience" | "fts" | "vector" | "hybrid"; vectorScore: number }>
): void {
  const bytes = estimateRecallQueryCacheBytes(value);
  if (bytes > RECALL_CACHE_MAX_BYTES) {
    return;
  }
  const existing = recallQueryCache.get(key);
  if (existing) {
    recallQueryCacheBytes -= existing.bytes;
    recallQueryCache.delete(key);
  }
  const entry: RecallQueryCacheEntry = {
    value,
    bytes,
    expiresAt: Date.now() + RECALL_CACHE_TTL_MS
  };
  recallQueryCache.set(key, entry);
  recallQueryCacheBytes += bytes;
  trimRecallQueryCacheToBudget();
}

function trimRecallQueryCacheToBudget(): void {
  if (recallQueryCacheBytes <= RECALL_CACHE_MAX_BYTES) {
    return;
  }
  for (const [key, entry] of recallQueryCache.entries()) {
    recallQueryCache.delete(key);
    recallQueryCacheBytes -= entry.bytes;
    recallQueryCacheEvictions += 1;
    if (recallQueryCacheBytes <= RECALL_CACHE_MAX_BYTES) {
      break;
    }
  }
  if (recallQueryCacheBytes < 0) {
    recallQueryCacheBytes = 0;
  }
}

function deleteRecallQueryCacheEntry(key: string): void {
  const entry = recallQueryCache.get(key);
  if (!entry) {
    return;
  }
  recallQueryCache.delete(key);
  recallQueryCacheBytes -= entry.bytes;
  if (recallQueryCacheBytes < 0) {
    recallQueryCacheBytes = 0;
  }
}

function estimateRecallQueryCacheBytes(
  value: Array<{ row: MemoryRow; source: "salience" | "fts" | "vector" | "hybrid"; vectorScore: number }>
): number {
  try {
    return Math.max(64, Buffer.byteLength(JSON.stringify(value), "utf8"));
  } catch {
    return 64;
  }
}

export async function recallMemoriesWithTrace(
  rootPath: string,
  userInput: string,
  options?: { budget?: Partial<RecallBudget> }
): Promise<RecallPipelineResult> {
  const budget = normalizeBudget(options?.budget);
  await ensureMemoryStore(rootPath);

  const query = userInput.trim();
  const intents = deriveIntentTags(query);
  const keywords = extractKeywords(query);
  const keywordCandidateMax = keywords.length > 0 ? Math.max(24, Math.floor(budget.candidateMax * 0.6)) : 0;
  const [candidates, recentSelectedCounts] = await Promise.all([
    fetchMergedCandidateRows(rootPath, budget.candidateMax, keywordCandidateMax, keywords),
    fetchRecentSelectedIdCounts(rootPath, 6)
  ]);

  const scored: ScoredCandidate[] = candidates.map((candidate) => {
    return scoreRow(candidate, intents, keywords, recentSelectedCounts);
  });

  const reranked = applyInterferencePenalty(scored).slice(0, budget.rerankMax);
  const rerankedIds = new Set(reranked.map((item) => item.row.id));
  const keywordPriority = [...scored]
    .filter((item) => item.keywordHits > 0)
    .sort((a, b) => b.score - a.score);

  const injectedRows: ScoredCandidate[] = [];
  let injectedChars = 0;
  const itemReasons = new Map<string, RecallTraceItem["reason"]>();
  const injectedIds = new Set<string>();
  const minKeywordSlots = keywords.length > 0 ? Math.min(2, budget.injectMax) : 0;

  // Reserve 1-2 slots for query-matching memories when available.
  for (const item of keywordPriority) {
    if (injectedRows.length >= minKeywordSlots) {
      break;
    }
    if (injectedIds.has(item.row.id)) {
      continue;
    }
    const rendered = renderInjectedMemory(item.row);
    if (injectedChars + rendered.length > budget.injectCharMax) {
      itemReasons.set(item.row.id, "inject_char_budget");
      continue;
    }
    injectedRows.push(item);
    injectedIds.add(item.row.id);
    injectedChars += rendered.length;
    itemReasons.set(item.row.id, "selected");
  }

  for (const item of reranked) {
    if (injectedIds.has(item.row.id)) {
      continue;
    }
    const rendered = renderInjectedMemory(item.row);
    if (injectedRows.length >= budget.injectMax) {
      itemReasons.set(item.row.id, "inject_item_budget");
      continue;
    }
    if (injectedChars + rendered.length > budget.injectCharMax) {
      itemReasons.set(item.row.id, "inject_char_budget");
      continue;
    }
    injectedRows.push(item);
    injectedIds.add(item.row.id);
    injectedChars += rendered.length;
    itemReasons.set(item.row.id, "selected");
  }

  const traceItems: RecallTraceItem[] = scored.map((item) => {
    if (!itemReasons.has(item.row.id) && !rerankedIds.has(item.row.id)) {
      return {
        id: item.row.id,
        score: roundScore(item.score),
        reason: "rerank_budget",
        candidateSource: item.candidateSource,
        keywordHits: item.keywordHits,
        diversityPenaltyApplied: item.diversityPenalty > 0,
        scoreBreakdown: item.scoreBreakdown
      };
    }
    return {
      id: item.row.id,
      score: roundScore(itemReasons.has(item.row.id)
        ? (injectedRows.find((injected) => injected.row.id === item.row.id)?.score ?? item.score)
        : item.score),
      reason: itemReasons.get(item.row.id) ?? "rerank_budget",
      candidateSource: item.candidateSource,
      keywordHits: item.keywordHits,
      diversityPenaltyApplied: item.diversityPenalty > 0,
      scoreBreakdown: item.scoreBreakdown
    };
  });

  const trace: RecallTrace = {
    query,
    intents,
    budget: {
      ...budget,
      candidates: candidates.length,
      reranked: reranked.length,
      injected: injectedRows.length,
      injectedChars
    },
    items: traceItems
  };

  const traceId = randomUUID();
  const now = new Date().toISOString();
  await persistRecallTrace(rootPath, traceId, injectedRows, trace, now);
  await strengthenRetrievedMemories(rootPath, injectedRows.map((item) => item.row), now);

  return {
    memories: injectedRows.map((item) => renderInjectedMemory(item.row)),
    memoryBlocks: injectedRows.map((item) => ({
      id: item.row.id,
      source: item.row.originRole,
      content: item.row.content,
      uncertaintyLevel: computeMemoryUncertainty(item.row)
    })),
    selectedIds: injectedRows.map((item) => item.row.id),
    traceId,
    trace
  };
}

export async function recallMemoriesFromStore(
  rootPath: string,
  options?: { maxItems?: number; userInput?: string }
): Promise<string[]> {
  const maxItems = Math.max(1, Math.min(20, Math.floor(options?.maxItems ?? 6)));
  const result = await recallMemoriesWithTrace(rootPath, options?.userInput ?? "", {
    budget: {
      injectMax: maxItems,
      rerankMax: Math.max(maxItems, 30)
    }
  });
  return result.memories;
}

export async function searchMemoriesHybrid(
  rootPath: string,
  query: string,
  options?: { maxResults?: number; budget?: Partial<RecallBudget> }
): Promise<HybridSearchResult> {
  const maxResults = Math.max(1, Math.min(100, Math.floor(options?.maxResults ?? 12)));
  const recall = await recallMemoriesWithTrace(rootPath, query, {
    budget: {
      ...options?.budget,
      injectMax: Math.max(maxResults, options?.budget?.injectMax ?? 0),
      rerankMax: Math.max(maxResults, options?.budget?.rerankMax ?? 0)
    }
  });
  const rows = await fetchRowsByIds(rootPath, recall.trace.items.map((item) => item.id));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const items: HybridSearchItem[] = [];
  for (const item of recall.trace.items) {
    const row = byId.get(item.id);
    if (!row) {
      continue;
    }
    const scoreBreakdown = item.scoreBreakdown;
    const ftsScore = Number(scoreBreakdown?.ftsScore ?? 0);
    const vectorScore = Number(scoreBreakdown?.vectorScore ?? 0);
    const hybridScore = Number(scoreBreakdown?.hybridScore ?? item.score);
    items.push({
      id: item.id,
      content: row.content,
      memoryType: row.memoryType,
      state: row.state,
      salience: roundScore(row.salience),
      score: roundScore(item.score),
      candidateSource: item.candidateSource,
      ftsScore: roundScore(ftsScore),
      vectorScore: roundScore(vectorScore),
      hybridScore: roundScore(hybridScore)
    });
    if (items.length >= maxResults) {
      break;
    }
  }

  return {
    query,
    traceId: recall.traceId,
    selectedIds: recall.selectedIds,
    items,
    trace: recall.trace
  };
}

export async function getRecallTraceById(
  rootPath: string,
  traceId: string
): Promise<RecallTraceRecord | null> {
  await ensureMemoryStore(rootPath);
  const id = traceId.trim();
  if (!id) {
    return null;
  }
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'query', query,",
      "'selectedIds', selected_ids_json,",
      "'scores', scores_json,",
      "'budget', budget_json,",
      "'createdAt', created_at",
      ")",
      "FROM recall_traces",
      `WHERE id = ${sqlText(id)}`,
      "LIMIT 1;"
    ].join("\n")
  );
  const line = raw.trim();
  if (!line) {
    return null;
  }
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const selectedIds = parseJsonArray(parsed.selectedIds);
    const scores = parseJsonRecords(parsed.scores);
    const budget = parseJsonRecord(parsed.budget);
    return {
      id: typeof parsed.id === "string" ? parsed.id : id,
      query: typeof parsed.query === "string" ? parsed.query : "",
      selectedIds,
      scores,
      budget,
      createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : ""
    };
  } catch {
    return null;
  }
}

async function persistRecallTrace(
  rootPath: string,
  traceId: string,
  injectedRows: ScoredCandidate[],
  trace: RecallTrace,
  now: string
): Promise<void> {
  const selectedIdsJson = JSON.stringify(injectedRows.map((item) => item.row.id));
  const scoresJson = JSON.stringify(
    trace.items.map((item) => ({
      id: item.id,
      score: item.score,
      reason: item.reason,
      candidateSource: item.candidateSource,
      keywordHits: item.keywordHits,
      diversityPenaltyApplied: item.diversityPenaltyApplied,
      scoreBreakdown: item.scoreBreakdown
    }))
  );
  const budgetJson = JSON.stringify({
    ...trace.budget,
    intents: trace.intents
  });

  await runMemoryStoreSql(
    rootPath,
    [
      "INSERT INTO recall_traces (id, query, selected_ids_json, scores_json, budget_json, created_at)",
      `VALUES (${sqlText(traceId)}, ${sqlText(trace.query)}, ${sqlText(selectedIdsJson)}, ${sqlText(scoresJson)}, ${sqlText(budgetJson)}, ${sqlText(now)});`
    ].join(" ")
  );
}

async function fetchCandidateRows(rootPath: string, limit: number): Promise<MemoryRow[]> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'memoryType', memory_type,",
      "'salience', salience,",
      "'state', state,",
      "'updatedAt', updated_at,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'emotionScore', emotion_score,",
      "'narrativeScore', narrative_score,",
      "'credibilityScore', credibility_score,",
      "'reconsolidationCount', reconsolidation_count,",
      "'originRole', origin_role",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL AND excluded_from_recall = 0",
      "ORDER BY salience DESC, updated_at DESC",
      `LIMIT ${limit};`
    ].join("\n")
  );

  if (!raw.trim()) {
    return [];
  }

  const rows: MemoryRow[] = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!id || !content) {
        continue;
      }
      rows.push({
        id,
        content,
        memoryType: typeof parsed.memoryType === "string" ? parsed.memoryType : "episodic",
        salience: clamp01(Number(parsed.salience)),
        state: typeof parsed.state === "string" ? parsed.state : "warm",
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        activationCount: normalizeInt(parsed.activationCount, 1),
        lastActivatedAt: typeof parsed.lastActivatedAt === "string" ? parsed.lastActivatedAt : "",
        emotionScore: clamp01(Number(parsed.emotionScore)),
        narrativeScore: clamp01(Number(parsed.narrativeScore)),
        credibilityScore: clamp01(Number(parsed.credibilityScore)),
        reconsolidationCount: normalizeInt(parsed.reconsolidationCount, 0),
        originRole: normalizeOriginRole(parsed.originRole)
      });
    } catch {
      continue;
    }
  }

  return rows;
}

async function fetchKeywordCandidateRows(rootPath: string, limit: number, keywords: string[]): Promise<MemoryRow[]> {
  if (limit <= 0 || keywords.length === 0) {
    return [];
  }
  const ftsQuery = buildFtsMatchQuery(keywords.slice(0, 8));
  if (!ftsQuery) {
    return [];
  }

  let raw = "";
  let usedFallback = false;
  try {
    raw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT json_object(",
        "'id', m.id,",
        "'content', m.content,",
        "'memoryType', m.memory_type,",
        "'salience', m.salience,",
        "'state', m.state,",
        "'updatedAt', m.updated_at,",
        "'activationCount', m.activation_count,",
        "'lastActivatedAt', m.last_activated_at,",
        "'emotionScore', m.emotion_score,",
        "'narrativeScore', m.narrative_score,",
        "'credibilityScore', m.credibility_score,",
        "'reconsolidationCount', m.reconsolidation_count,",
        "'originRole', m.origin_role",
        ")",
        "FROM memories_fts f",
        "JOIN memories m ON m.id = f.memory_id",
        "WHERE m.deleted_at IS NULL AND m.excluded_from_recall = 0",
        `AND memories_fts MATCH ${sqlText(ftsQuery)}`,
        "ORDER BY bm25(memories_fts), m.updated_at DESC, m.salience DESC",
        `LIMIT ${limit};`
      ].join("\n")
    );
  } catch {
    usedFallback = true;
  }

  if (!usedFallback && parseRows(raw).length > 0) {
    return parseRows(raw);
  }

  // Fallback path for older sqlite runtime/builds without FTS5 support or zero-hit FTS tokenization.
  {
    const likeParts = keywords
      .slice(0, 8)
      .map((keyword) => `lower(content) LIKE ${sqlText(`%${keyword.toLowerCase()}%`)}`);
    if (likeParts.length === 0) {
      return [];
    }
    raw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT json_object(",
        "'id', id,",
        "'content', content,",
        "'memoryType', memory_type,",
        "'salience', salience,",
        "'state', state,",
        "'updatedAt', updated_at,",
        "'activationCount', activation_count,",
        "'lastActivatedAt', last_activated_at,",
        "'emotionScore', emotion_score,",
        "'narrativeScore', narrative_score,",
        "'credibilityScore', credibility_score,",
        "'reconsolidationCount', reconsolidation_count,",
        "'originRole', origin_role",
        ")",
        "FROM memories",
        "WHERE deleted_at IS NULL AND excluded_from_recall = 0",
        `AND (${likeParts.join(" OR ")})`,
        "ORDER BY updated_at DESC, salience DESC",
        `LIMIT ${limit};`
      ].join("\n")
    );
  }

  return parseRows(raw);
}

async function fetchMergedCandidateRows(
  rootPath: string,
  salienceLimit: number,
  keywordLimit: number,
  keywords: string[]
): Promise<Array<{ row: MemoryRow; source: "salience" | "fts" | "vector" | "hybrid"; vectorScore: number }>> {
  const cacheKey = buildRecallQueryCacheKey(rootPath, salienceLimit, keywordLimit, keywords);
  const cached = getRecallQueryCache(cacheKey);
  if (cached) {
    return cached;
  }

  const [salienceRows, keywordRows, vectorRows] = await Promise.all([
    fetchCandidateRows(rootPath, salienceLimit),
    fetchKeywordCandidateRows(rootPath, keywordLimit, keywords),
    fetchVectorCandidateRows(rootPath, Math.max(24, keywordLimit), keywords.join(" "))
  ]);
  const merged = new Map<string, {
    row: MemoryRow;
    channels: Set<"salience" | "fts" | "vector">;
    vectorScore: number;
  }>();

  for (const row of salienceRows) {
    merged.set(row.id, { row, channels: new Set(["salience"]), vectorScore: 0 });
  }
  for (const row of keywordRows) {
    const prev = merged.get(row.id);
    if (!prev) {
      merged.set(row.id, { row, channels: new Set(["fts"]), vectorScore: 0 });
      continue;
    }
    prev.channels.add("fts");
    prev.row = prev.row.salience >= row.salience ? prev.row : row;
  }
  for (const item of vectorRows) {
    const prev = merged.get(item.row.id);
    if (!prev) {
      merged.set(item.row.id, {
        row: item.row,
        channels: new Set(["vector"]),
        vectorScore: item.score
      });
      continue;
    }
    prev.channels.add("vector");
    prev.vectorScore = Math.max(prev.vectorScore, item.score);
    if (item.row.salience > prev.row.salience) {
      prev.row = item.row;
    }
  }

  const result = [...merged.values()].map((item) => {
    let source: "salience" | "fts" | "vector" | "hybrid" = "salience";
    if (item.channels.size >= 2) {
      source = "hybrid";
    } else if (item.channels.has("vector")) {
      source = "vector";
    } else if (item.channels.has("fts")) {
      source = "fts";
    }
    return {
      row: item.row,
      source,
      vectorScore: item.vectorScore
    };
  });
  setRecallQueryCache(cacheKey, result);
  return result;
}

async function fetchVectorCandidateRows(
  rootPath: string,
  limit: number,
  query: string
): Promise<Array<{ row: MemoryRow; score: number }>> {
  const hits = await searchMemoryVectors(rootPath, query, { maxResults: limit });
  if (hits.length === 0) {
    return [];
  }
  const ids = hits.map((item) => item.id).filter(Boolean);
  if (ids.length === 0) {
    return [];
  }
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'memoryType', memory_type,",
      "'salience', salience,",
      "'state', state,",
      "'updatedAt', updated_at,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'emotionScore', emotion_score,",
      "'narrativeScore', narrative_score,",
      "'credibilityScore', credibility_score,",
      "'reconsolidationCount', reconsolidation_count,",
      "'originRole', origin_role",
      ")",
      "FROM memories",
      `WHERE id IN (${ids.map((id) => sqlText(id)).join(",")})`,
      "AND deleted_at IS NULL AND excluded_from_recall = 0;"
    ].join("\n")
  );
  const rows = parseRows(raw);
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const out: Array<{ row: MemoryRow; score: number }> = [];
  for (const item of hits) {
    const row = rowMap.get(item.id);
    if (!row) {
      continue;
    }
    out.push({
      row,
      score: item.score
    });
  }
  return out;
}

async function fetchRecentSelectedIdCounts(
  rootPath: string,
  rounds: number
): Promise<Map<string, number>> {
  if (rounds <= 0) {
    return new Map();
  }
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT selected_ids_json",
      "FROM recall_traces",
      "ORDER BY created_at DESC",
      `LIMIT ${rounds};`
    ].join("\n")
  );
  const counts = new Map<string, number>();
  if (!raw.trim()) {
    return counts;
  }
  for (const line of raw.split("\n")) {
    try {
      const ids = JSON.parse(line) as unknown[];
      if (!Array.isArray(ids)) {
        continue;
      }
      for (const id of ids) {
        if (typeof id !== "string" || id.length === 0) {
          continue;
        }
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    } catch {
      continue;
    }
  }
  return counts;
}

function scoreRow(
  candidate: { row: MemoryRow; source: "salience" | "fts" | "vector" | "hybrid"; vectorScore: number },
  intents: string[],
  keywords: string[],
  recentSelectedCounts: Map<string, number>
): ScoredCandidate {
  const row = candidate.row;
  const contentLower = row.content.toLowerCase();
  const retrievalStrength = retrievalStrengthScore(row.activationCount, row.lastActivatedAt, row.memoryType);
  const typeBoost = memoryTypeBoost(row.memoryType, intents);
  const stateBoost = stateWeight(row.state);
  const keywordHits = keywords.filter((k) => contentLower.includes(k)).length;
  const keywordScore = keywords.length === 0 ? 0 : keywordHits / keywords.length;
  const keywordHardBoost =
    keywords.length > 0 && keywordHits > 0
      ? Math.min(0.2, 0.08 + keywordHits * 0.03)
      : 0;
  const ftsScore = keywords.length === 0 ? 0 : keywordScore;
  const vectorScore = clamp01((candidate.vectorScore + 1) / 2);
  const emphasisBoost = subjectiveEmphasisBoost(row, intents, keywordHits);
  const queryMissPenalty = keywords.length > 0 && keywordHits === 0 ? 0.2 : 0;
  const recency = recencyScore(row.updatedAt);
  const originMultiplier = row.originRole === "assistant" ? 0.88 : row.originRole === "user" ? 1 : 0.92;
  const repeatedCount = recentSelectedCounts.get(row.id) ?? 0;
  const diversityPenalty = Math.min(0.12, repeatedCount * 0.02);
  const fusionWeights = {
    fts: 0.35,
    vector: 0.4,
    salience: 0.1,
    recency: 0.1,
    credibility: 0.05
  } as const;
  const hybridScore = clamp01(
    ftsScore * fusionWeights.fts +
      vectorScore * fusionWeights.vector +
      row.salience * fusionWeights.salience +
      recency * fusionWeights.recency +
      row.credibilityScore * fusionWeights.credibility
  );

  const base = clamp01(
    row.salience * 0.2 +
      retrievalStrength * 0.18 +
      typeBoost * 0.15 +
      stateBoost * 0.1 +
      ftsScore * 0.18 +
      vectorScore * 0.18 +
      keywordHardBoost +
      emphasisBoost +
      recency * 0.05 +
      row.credibilityScore * 0.2
  );
  const score = clamp01(base * originMultiplier - diversityPenalty - queryMissPenalty);
  return {
    row,
    score,
    candidateSource: candidate.source,
    keywordHits,
    diversityPenalty,
    scoreBreakdown: {
      salience: roundScore(row.salience),
      retrievalStrength: roundScore(retrievalStrength),
      typeBoost: roundScore(typeBoost),
      stateBoost: roundScore(stateBoost),
      keywordScore: roundScore(keywordScore),
      keywordHardBoost: roundScore(keywordHardBoost),
      emphasisBoost: roundScore(emphasisBoost),
      recency: roundScore(recency),
      credibility: roundScore(row.credibilityScore),
      ftsScore: roundScore(ftsScore),
      vectorScore: roundScore(vectorScore),
      hybridScore: roundScore(hybridScore),
      fusionWeights,
      originMultiplier: roundScore(originMultiplier),
      diversityPenalty: roundScore(diversityPenalty),
      queryMissPenalty: roundScore(queryMissPenalty)
    }
  };
}

function subjectiveEmphasisBoost(row: MemoryRow, intents: string[], keywordHits: number): number {
  if (row.originRole !== "user") {
    return 0;
  }
  const explicitEmphasis = projectSubjectiveEmphasis(row.content) >= 0.62;
  const strongIdentityLikeIntent = intents.includes("identity") || intents.includes("preference");
  const highSignalState = row.salience >= 0.88 && row.activationCount >= 3;
  if (explicitEmphasis && keywordHits > 0) {
    return 0.16;
  }
  if (explicitEmphasis) {
    return 0.1;
  }
  if (strongIdentityLikeIntent && highSignalState && keywordHits > 0) {
    return 0.08;
  }
  return 0;
}

function applyInterferencePenalty(
  scored: ScoredCandidate[]
): ScoredCandidate[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const picked: Array<{ item: ScoredCandidate; tokens: Set<string> }> = [];

  for (const item of sorted) {
    const tokens = tokenize(item.row.content);
    let penalty = 0;
    for (const candidate of picked) {
      const overlap = jaccardSimilarity(tokens, candidate.tokens);
      if (overlap > SIMILARITY_THRESHOLD) {
        penalty = Math.max(penalty, INTERFERENCE_PENALTY);
      }
    }
    const score = clamp01(item.score - penalty);
    picked.push({
      item: {
        ...item,
        score,
        scoreBreakdown: item.scoreBreakdown
          ? {
              ...item.scoreBreakdown,
              diversityPenalty: roundScore((item.scoreBreakdown.diversityPenalty ?? 0) + penalty)
            }
          : item.scoreBreakdown
      },
      tokens
    });
  }

  return picked
    .map(({ item }) => item)
    .sort((a, b) => b.score - a.score);
}

async function strengthenRetrievedMemories(rootPath: string, rows: MemoryRow[], nowIso: string): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const updates: string[] = [];
  for (const row of rows) {
    const nextActivation = row.activationCount + 1;
    const nextReconsolidation = row.reconsolidationCount + 1;
    const nextSalience = scoreMemoryFromStoreRow(
      {
        activationCount: nextActivation,
        lastActivatedAt: nowIso,
        emotionScore: row.emotionScore,
        narrativeScore: row.narrativeScore,
        memoryType: row.memoryType,
        state: row.state,
        credibilityScore: row.credibilityScore
      },
      nowIso
    );
    const nextState = classifyMemoryState(nextSalience);

    updates.push(
      [
        "UPDATE memories",
        `SET activation_count = ${nextActivation},`,
        `last_activated_at = ${sqlText(nowIso)},`,
        `reconsolidation_count = ${nextReconsolidation},`,
        `salience = ${nextSalience},`,
        `state = ${sqlText(nextState)},`,
        `updated_at = ${sqlText(nowIso)}`,
        `WHERE id = ${sqlText(row.id)};`
      ].join(" ")
    );
  }

  await runMemoryStoreSql(
    rootPath,
    `
    BEGIN;
    ${updates.join("\n")}
    COMMIT;
    `
  );
}

function memoryTypeBoost(memoryType: string, intents: string[]): number {
  const table: Record<string, number> = {
    episodic: 0.3,
    semantic: 0.4,
    relational: 0.5,
    procedural: 0.35
  };

  let base = table[memoryType] ?? 0.3;
  if (intents.includes("identity") && (memoryType === "semantic" || memoryType === "relational")) {
    base += 0.35;
  }
  if (intents.includes("relationship") && memoryType === "relational") {
    base += 0.35;
  }
  if (intents.includes("procedural") && memoryType === "procedural") {
    base += 0.35;
  }
  if (intents.includes("preference") && memoryType === "semantic") {
    base += 0.3;
  }
  if (intents.includes("factual") && memoryType === "semantic") {
    base += 0.2;
  }
  if (intents.includes("emotional") && memoryType === "episodic") {
    base += 0.2;
  }
  return clamp01(base);
}

function stateWeight(state: string): number {
  if (state === "hot") {
    return 1;
  }
  if (state === "scar") {
    return 0.9;
  }
  if (state === "warm") {
    return 0.75;
  }
  if (state === "cold") {
    return 0.35;
  }
  if (state === "archive") {
    return 0.2;
  }
  return 0.5;
}

function retrievalStrengthScore(activationCount: number, lastActivatedAt: string, memoryType: string): number {
  const countSignal = Math.log1p(clampInt(activationCount, 1, 200)) / Math.log(201);
  const lastTs = Date.parse(lastActivatedAt);
  const days = Number.isFinite(lastTs)
    ? Math.max(0, (Date.now() - lastTs) / (24 * 60 * 60 * 1000))
    : 365;
  const halfLifeDays = TYPE_HALF_LIFE_DAYS[memoryType] ?? 30;
  const recencySignal = Math.exp(-Math.log(2) * (days / halfLifeDays));
  return clamp01(0.55 * countSignal + 0.45 * recencySignal);
}

function deriveIntentTags(input: string): string[] {
  const normalized = input.trim();
  if (!normalized) {
    return ["general"];
  }

  const tags = INTENT_RULES.filter((rule) => rule.pattern.test(normalized)).map((rule) => rule.tag);
  return tags.length > 0 ? tags : ["general"];
}

function extractKeywords(input: string): string[] {
  const lowered = input.toLowerCase();
  const found = lowered.match(WORD_PATTERN) ?? [];
  const deduped = new Set<string>();
  for (const token of found) {
    const t = token.trim();
    if (t.length < 2) {
      continue;
    }
    if (isLikelyCjkToken(t) && t.length > 4) {
      const grams = sliceCjkNgrams(t);
      for (const gram of grams) {
        deduped.add(gram);
        if (deduped.size >= 20) {
          break;
        }
      }
    } else {
      deduped.add(t);
    }
    if (deduped.size >= 20) {
      break;
    }
  }
  return [...deduped].sort((a, b) => b.length - a.length).slice(0, 12);
}

function renderInjectedMemory(row: MemoryRow): string {
  return `[${row.memoryType}/${row.state}] ${row.content}`;
}

function recencyScore(updatedAt: string): number {
  const ts = Date.parse(updatedAt);
  if (!Number.isFinite(ts)) {
    return 0.5;
  }
  const ageDays = Math.max(0, (Date.now() - ts) / (24 * 60 * 60 * 1000));
  return clamp01(1 / (1 + ageDays / 7));
}

function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase();
  const found = normalized.match(WORD_PATTERN) ?? [];
  const tokens = new Set<string>();
  for (const token of found) {
    if (token.length < 2) {
      continue;
    }
    tokens.add(token);
  }
  return tokens;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }
  const union = a.size + b.size - intersection;
  if (union <= 0) {
    return 0;
  }
  return intersection / union;
}

function normalizeBudget(input?: Partial<RecallBudget>): RecallBudget {
  const candidateMax = clampIntWithFallback(input?.candidateMax, DEFAULT_BUDGET.candidateMax, 1, 300);
  const rerankMax = clampIntWithFallback(input?.rerankMax, DEFAULT_BUDGET.rerankMax, 1, 40);
  const injectMax = clampIntWithFallback(input?.injectMax, DEFAULT_BUDGET.injectMax, 1, 12);
  const injectCharMax = clampIntWithFallback(input?.injectCharMax, DEFAULT_BUDGET.injectCharMax, 200, 3600);
  return {
    candidateMax,
    rerankMax: Math.max(injectMax, rerankMax),
    injectMax,
    injectCharMax
  };
}

function buildFtsMatchQuery(keywords: string[]): string {
  const terms: string[] = [];
  for (const keyword of keywords) {
    const term = keyword.trim().replace(/"/g, "\"\"");
    if (!term) {
      continue;
    }
    terms.push(`"${term}"`);
  }
  if (terms.length === 0) {
    return "";
  }
  return terms.join(" OR ");
}

function parseRows(raw: string): MemoryRow[] {
  if (!raw.trim()) {
    return [];
  }
  const rows: MemoryRow[] = [];
  for (const line of raw.split("\n")) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const id = typeof parsed.id === "string" ? parsed.id : "";
      const content = typeof parsed.content === "string" ? parsed.content.trim() : "";
      if (!id || !content) {
        continue;
      }
      rows.push({
        id,
        content,
        memoryType: typeof parsed.memoryType === "string" ? parsed.memoryType : "episodic",
        salience: clamp01(Number(parsed.salience)),
        state: typeof parsed.state === "string" ? parsed.state : "warm",
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
        activationCount: normalizeInt(parsed.activationCount, 1),
        lastActivatedAt: typeof parsed.lastActivatedAt === "string" ? parsed.lastActivatedAt : "",
        emotionScore: clamp01(Number(parsed.emotionScore)),
        narrativeScore: clamp01(Number(parsed.narrativeScore)),
        credibilityScore: clamp01(Number(parsed.credibilityScore)),
        reconsolidationCount: normalizeInt(parsed.reconsolidationCount, 0),
        originRole: normalizeOriginRole(parsed.originRole)
      });
    } catch {
      continue;
    }
  }
  return rows;
}

async function fetchRowsByIds(rootPath: string, ids: string[]): Promise<MemoryRow[]> {
  const unique = [...new Set(ids.filter((id) => id.trim().length > 0))];
  if (unique.length === 0) {
    return [];
  }
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'memoryType', memory_type,",
      "'salience', salience,",
      "'state', state,",
      "'updatedAt', updated_at,",
      "'activationCount', activation_count,",
      "'lastActivatedAt', last_activated_at,",
      "'emotionScore', emotion_score,",
      "'narrativeScore', narrative_score,",
      "'credibilityScore', credibility_score,",
      "'reconsolidationCount', reconsolidation_count,",
      "'originRole', origin_role",
      ")",
      "FROM memories",
      `WHERE id IN (${unique.map((id) => sqlText(id)).join(",")})`,
      "AND deleted_at IS NULL AND excluded_from_recall = 0;"
    ].join("\n")
  );
  return parseRows(raw);
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function parseJsonRecords(value: unknown): Array<Record<string, unknown>> {
  if (typeof value !== "string") {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null && !Array.isArray(item)
    );
  } catch {
    return [];
  }
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function isLikelyCjkToken(token: string): boolean {
  return /[\u3400-\u9fff]/u.test(token);
}

function sliceCjkNgrams(token: string): string[] {
  const grams = new Set<string>();
  const chars = [...token];
  const minN = 2;
  const maxN = Math.min(6, chars.length);
  for (let n = maxN; n >= minN; n -= 1) {
    for (let i = 0; i + n <= chars.length; i += 1) {
      grams.add(chars.slice(i, i + n).join(""));
      if (grams.size >= 24) {
        return [...grams];
      }
    }
  }
  return [...grams];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampIntWithFallback(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(Number(value)) : fallback;
  return Math.max(min, Math.min(max, n));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function normalizeInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(0, Math.floor(n));
}

function normalizeOriginRole(value: unknown): "user" | "assistant" | "system" {
  return value === "user" || value === "assistant" || value === "system" ? value : "system";
}

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
