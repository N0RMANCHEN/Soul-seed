import { randomUUID } from "node:crypto";
import { runMemoryStoreSql } from "./memory_store.js";
import { appendLifeEvent } from "./persona.js";
import type { ModelAdapter, PersonaPackage } from "./types.js";
import { MAX_PINNED_COUNT } from "./types.js";

/** Maximum number of user facts in always-inject layer */
export const MAX_USER_FACTS = 50;

/** Fact graduation threshold: fact mentioned this many times gets auto-graduated */
export const FACT_GRADUATION_THRESHOLD = 3;

/** Always-inject layer character budget (≤15% of ~8000 char context = 1200) */
export const ALWAYS_INJECT_CHAR_BUDGET = 1200;

export interface UserFact {
  id: string;
  key: string;
  value: string;
  confidence: number;
  mentionCount: number;
  sourceMemoryIds: string[];
  crystallized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlwaysInjectContext {
  userFacts: UserFact[];
  pinnedMemories: string[];
  relationshipSummary: string;
  totalChars: number;
  overBudget: boolean;
}

export async function getUserFacts(
  rootPath: string,
  options?: { crystallizedOnly?: boolean; limit?: number }
): Promise<UserFact[]> {
  const limit = options?.limit ?? MAX_USER_FACTS;
  const where = options?.crystallizedOnly ? "WHERE crystallized = 1" : "";
  const rows = await runMemoryStoreSql(
    rootPath,
    `SELECT id, key, value, confidence, mention_count, source_memory_ids_json, crystallized, created_at, updated_at FROM user_facts ${where} ORDER BY mention_count DESC, updated_at DESC LIMIT ${limit};`
  );
  if (!rows.trim()) return [];
  return rows
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      return {
        id: parts[0] ?? "",
        key: parts[1] ?? "",
        value: parts[2] ?? "",
        confidence: Number(parts[3] ?? 1),
        mentionCount: Number(parts[4] ?? 1),
        sourceMemoryIds: safeParseJson<string[]>(parts[5] ?? "[]", []),
        crystallized: parts[6] === "1",
        createdAt: parts[7] ?? "",
        updatedAt: parts[8] ?? ""
      };
    });
}

export async function upsertUserFact(
  rootPath: string,
  params: {
    key: string;
    value: string;
    confidence?: number;
    sourceMemoryId?: string;
  }
): Promise<UserFact> {
  const nowIso = new Date().toISOString();
  const confidence = params.confidence ?? 1.0;

  // Check if fact exists
  const existing = await runMemoryStoreSql(
    rootPath,
    `SELECT id, mention_count, source_memory_ids_json FROM user_facts WHERE key = '${escSql(params.key)}' LIMIT 1;`
  );

  if (existing.trim()) {
    const parts = existing.trim().split("|");
    const id = parts[0] ?? "";
    const mentionCount = Number(parts[1] ?? 0) + 1;
    const sourceIds = safeParseJson<string[]>(parts[2] ?? "[]", []);
    if (params.sourceMemoryId && !sourceIds.includes(params.sourceMemoryId)) {
      sourceIds.push(params.sourceMemoryId);
    }
    const crystallized = mentionCount >= FACT_GRADUATION_THRESHOLD ? 1 : 0;
    await runMemoryStoreSql(
      rootPath,
      `UPDATE user_facts SET value = '${escSql(params.value)}', confidence = ${confidence}, mention_count = ${mentionCount}, source_memory_ids_json = '${escSql(JSON.stringify(sourceIds))}', crystallized = ${crystallized}, updated_at = '${nowIso}' WHERE id = '${escSql(id)}';`
    );

    // Emit crystallized event on threshold crossing
    if (crystallized === 1 && Number(parts[1] ?? 0) < FACT_GRADUATION_THRESHOLD) {
      await appendLifeEvent(rootPath, {
        type: "memory_crystallized",
        payload: {
          factId: id,
          key: params.key,
          value: params.value,
          mentionCount,
          trigger: "fact_graduation"
        }
      });
    }

    return {
      id,
      key: params.key,
      value: params.value,
      confidence,
      mentionCount,
      sourceMemoryIds: sourceIds,
      crystallized: crystallized === 1,
      createdAt: "",
      updatedAt: nowIso
    };
  } else {
    const id = randomUUID();
    const sourceIds = params.sourceMemoryId ? [params.sourceMemoryId] : [];
    await runMemoryStoreSql(
      rootPath,
      `INSERT INTO user_facts (id, key, value, confidence, mention_count, source_memory_ids_json, crystallized, created_at, updated_at) VALUES ('${escSql(id)}', '${escSql(params.key)}', '${escSql(params.value)}', ${confidence}, 1, '${escSql(JSON.stringify(sourceIds))}', 0, '${nowIso}', '${nowIso}');`
    );
    return {
      id,
      key: params.key,
      value: params.value,
      confidence,
      mentionCount: 1,
      sourceMemoryIds: sourceIds,
      crystallized: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }
}

export async function deleteUserFact(rootPath: string, key: string): Promise<boolean> {
  const existing = await runMemoryStoreSql(
    rootPath,
    `SELECT id FROM user_facts WHERE key = '${escSql(key)}' LIMIT 1;`
  );
  if (!existing.trim()) return false;
  await runMemoryStoreSql(rootPath, `DELETE FROM user_facts WHERE key = '${escSql(key)}';`);
  return true;
}

/**
 * LLM-based per-turn user fact extraction.
 * Called after each conversation turn to identify user self-disclosures.
 * Returns the number of facts upserted.
 *
 * This is the primary extraction mechanism. It uses the LLM to understand
 * natural language disclosures across all languages, replacing brittle regex patterns.
 */
export async function extractUserFactsFromTurn(params: {
  userInput: string;
  assistantReply: string;
  adapter: ModelAdapter;
  rootPath: string;
}): Promise<number> {
  // Skip extraction for very short or purely reactive inputs
  if (params.userInput.trim().length < 4) return 0;

  const systemPrompt =
    "你是用户信息提取助手。从对话中识别用户关于自己的持久性事实（姓名、所在地、职业、兴趣爱好、偏好等）。" +
    "只提取用户明确陈述的事实，不要推断或猜测。" +
    "以 JSON 数组返回，每项格式：{\"key\":\"中文键名\",\"value\":\"值\",\"confidence\":0.0-1.0}。" +
    "如无新事实，返回 []。不要输出 JSON 之外的文字。";

  const userPrompt =
    `用户说：${params.userInput.slice(0, 500)}\n` +
    `助手说：${params.assistantReply.slice(0, 300)}`;

  try {
    const result = await params.adapter.streamChat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      { onToken: () => {} }
    );

    const facts = parseLlmFactsJson(result.content);
    let upserted = 0;
    for (const fact of facts) {
      if (
        typeof fact.key === "string" &&
        typeof fact.value === "string" &&
        fact.key.trim() &&
        fact.value.trim() &&
        Number(fact.confidence) >= 0.7
      ) {
        await upsertUserFact(params.rootPath, {
          key: normalizeFactKey(fact.key.trim()),
          value: fact.value.trim().slice(0, 200),
          confidence: Number(fact.confidence)
        });
        upserted++;
      }
    }
    return upserted;
  } catch {
    return 0;
  }
}

/**
 * Scan episodic memories for structured key=value facts and auto-graduate to user_facts.
 * Handles only explicit structured formats (key=value, key:value, preferred_name=X).
 * Natural language disclosures are handled by extractUserFactsFromTurn (LLM-based).
 */
export async function graduateFactsFromMemories(rootPath: string): Promise<number> {
  const rows = await runMemoryStoreSql(
    rootPath,
    `SELECT id, content FROM memories WHERE memory_type = 'episodic' AND deleted_at IS NULL AND excluded_from_recall = 0 ORDER BY created_at DESC LIMIT 500;`
  );
  if (!rows.trim()) return 0;

  const factCandidates = new Map<string, { value: string; memoryIds: string[] }>();

  const extractFact = (memId: string, key: string, value: string): void => {
    const normalizedKey = normalizeFactKey(key);
    const trimmedValue = value.trim().slice(0, 200);
    if (!normalizedKey || !trimmedValue) return;
    if (!factCandidates.has(normalizedKey)) {
      factCandidates.set(normalizedKey, { value: trimmedValue, memoryIds: [] });
    }
    const candidate = factCandidates.get(normalizedKey)!;
    candidate.value = trimmedValue;
    if (!candidate.memoryIds.includes(memId)) {
      candidate.memoryIds.push(memId);
    }
  };

  for (const line of rows.split("\n").filter(Boolean)) {
    const pipeIdx = line.indexOf("|");
    if (pipeIdx < 0) continue;
    const memId = line.slice(0, pipeIdx).trim();
    const content = line.slice(pipeIdx + 1).trim();

    // key=value 或 key:value 结构化格式（可靠，保留）
    const kvMatch = content.match(/^([a-zA-Z_\u4e00-\u9fff][a-zA-Z0-9_\u4e00-\u9fff\s]{0,40})\s*[=:]\s*(.+)$/);
    if (kvMatch) {
      extractFact(memId, kvMatch[1].trim(), kvMatch[2].trim());
    }
  }

  let graduated = 0;
  for (const [key, { value, memoryIds }] of factCandidates.entries()) {
    if (memoryIds.length >= FACT_GRADUATION_THRESHOLD) {
      const existing = await runMemoryStoreSql(
        rootPath,
        `SELECT id, crystallized FROM user_facts WHERE key = '${escSql(key)}' LIMIT 1;`
      );
      if (!existing.trim() || !existing.includes("|")) {
        await upsertUserFact(rootPath, { key, value, sourceMemoryId: memoryIds[0] });
        for (let i = 1; i < memoryIds.length; i++) {
          await upsertUserFact(rootPath, { key, value, sourceMemoryId: memoryIds[i] });
        }
        graduated++;
      }
    }
  }
  return graduated;
}

/**
 * Compile always-inject context: user_facts + pinned + relationship summary.
 * Total chars must fit within ALWAYS_INJECT_CHAR_BUDGET.
 */
export async function compileAlwaysInjectContext(
  rootPath: string,
  personaPkg: PersonaPackage
): Promise<AlwaysInjectContext> {
  const facts = await getUserFacts(rootPath, { limit: MAX_USER_FACTS });
  const pinnedMemories = personaPkg.pinned.memories.slice(0, MAX_PINNED_COUNT);
  const relState = personaPkg.relationshipState;
  const relationshipSummary = relState
    ? `state=${relState.state} trust=${relState.dimensions.trust.toFixed(2)} intimacy=${relState.dimensions.intimacy.toFixed(2)}`
    : "";

  // Budget check
  let totalChars = 0;
  const includedFacts: UserFact[] = [];
  for (const fact of facts) {
    const factStr = `${fact.key}: ${fact.value}`;
    if (totalChars + factStr.length > ALWAYS_INJECT_CHAR_BUDGET) break;
    includedFacts.push(fact);
    totalChars += factStr.length + 2; // +2 for separator
  }

  totalChars += pinnedMemories.reduce((s, m) => s + m.length + 2, 0);
  totalChars += relationshipSummary.length;

  return {
    userFacts: includedFacts,
    pinnedMemories,
    relationshipSummary,
    totalChars,
    overBudget: totalChars > ALWAYS_INJECT_CHAR_BUDGET
  };
}

/** Format always-inject context as a compact string for system prompt injection */
export function formatAlwaysInjectContext(ctx: AlwaysInjectContext): string {
  const parts: string[] = [];

  if (ctx.userFacts.length > 0) {
    parts.push(`User facts (always-remember): ${ctx.userFacts.map((f) => `${f.key}=${f.value}`).join(", ")}`);
  }

  if (ctx.pinnedMemories.length > 0) {
    parts.push(`Pinned memories: ${ctx.pinnedMemories.join(" | ")}`);
  }

  if (ctx.relationshipSummary) {
    parts.push(`Relationship: ${ctx.relationshipSummary}`);
  }

  return parts.join("\n");
}

// --- helpers ---

function normalizeFactKey(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "_").slice(0, 40);
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

function parseLlmFactsJson(content: string): Array<{ key: unknown; value: unknown; confidence: unknown }> {
  // 提取第一个 JSON 数组
  const fenceMatch = /```json\s*([\s\S]*?)```/i.exec(content);
  const raw = fenceMatch?.[1]?.trim() ?? content.trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed as Array<{ key: unknown; value: unknown; confidence: unknown }>;
  } catch {
    return [];
  }
}
