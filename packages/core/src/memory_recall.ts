import { randomUUID } from "node:crypto";
import { classifyMemoryState, scoreMemoryFromStoreRow } from "./memory_lifecycle.js";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
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
  candidateSource?: "salience" | "keyword" | "both";
  keywordHits?: number;
  diversityPenaltyApplied?: boolean;
  scoreBreakdown?: {
    salience: number;
    retrievalStrength: number;
    typeBoost: number;
    stateBoost: number;
    keywordScore: number;
    keywordHardBoost: number;
    recency: number;
    credibility: number;
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
  candidateSource: "salience" | "keyword" | "both";
  keywordHits: number;
  diversityPenalty: number;
  scoreBreakdown: RecallTraceItem["scoreBreakdown"];
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
      content: item.row.content
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
  const likeParts = keywords
    .slice(0, 8)
    .map((keyword) => `lower(content) LIKE ${sqlText(sqlLikePattern(keyword))}`);
  if (likeParts.length === 0) {
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
      "WHERE deleted_at IS NULL AND excluded_from_recall = 0",
      `AND (${likeParts.join(" OR ")})`,
      "ORDER BY updated_at DESC, salience DESC",
      `LIMIT ${limit};`
    ].join("\n")
  );

  return parseRows(raw);
}

async function fetchMergedCandidateRows(
  rootPath: string,
  salienceLimit: number,
  keywordLimit: number,
  keywords: string[]
): Promise<Array<{ row: MemoryRow; source: "salience" | "keyword" | "both" }>> {
  const [salienceRows, keywordRows] = await Promise.all([
    fetchCandidateRows(rootPath, salienceLimit),
    fetchKeywordCandidateRows(rootPath, keywordLimit, keywords)
  ]);
  const merged = new Map<string, { row: MemoryRow; source: "salience" | "keyword" | "both" }>();

  for (const row of salienceRows) {
    merged.set(row.id, { row, source: "salience" });
  }
  for (const row of keywordRows) {
    const prev = merged.get(row.id);
    if (!prev) {
      merged.set(row.id, { row, source: "keyword" });
      continue;
    }
    merged.set(row.id, {
      row: prev.row.salience >= row.salience ? prev.row : row,
      source: "both"
    });
  }

  return [...merged.values()];
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
  candidate: { row: MemoryRow; source: "salience" | "keyword" | "both" },
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
  const queryMissPenalty = keywords.length > 0 && keywordHits === 0 ? 0.2 : 0;
  const recency = recencyScore(row.updatedAt);
  const originMultiplier = row.originRole === "assistant" ? 0.88 : row.originRole === "user" ? 1 : 0.92;
  const repeatedCount = recentSelectedCounts.get(row.id) ?? 0;
  const diversityPenalty = Math.min(0.12, repeatedCount * 0.02);

  const base = clamp01(
    row.salience * 0.2 +
      retrievalStrength * 0.18 +
      typeBoost * 0.15 +
      stateBoost * 0.1 +
      keywordScore * 0.25 +
      keywordHardBoost +
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
      recency: roundScore(recency),
      credibility: roundScore(row.credibilityScore),
      originMultiplier: roundScore(originMultiplier),
      diversityPenalty: roundScore(diversityPenalty),
      queryMissPenalty: roundScore(queryMissPenalty)
    }
  };
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
  const rerankMax = clampIntWithFallback(input?.rerankMax, DEFAULT_BUDGET.rerankMax, 1, 30);
  const injectMax = clampIntWithFallback(input?.injectMax, DEFAULT_BUDGET.injectMax, 1, 8);
  const injectCharMax = clampIntWithFallback(input?.injectCharMax, DEFAULT_BUDGET.injectCharMax, 200, 2200);
  return {
    candidateMax,
    rerankMax: Math.max(injectMax, rerankMax),
    injectMax,
    injectCharMax
  };
}

function sqlLikePattern(keyword: string): string {
  const escaped = keyword.toLowerCase();
  return `%${escaped}%`;
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
