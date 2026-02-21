/**
 * P3-0: 内在好奇心 / 兴趣模型（interests.json）
 * 从记忆中自动涌现的话题兴趣分布，用于驱动 proactive curiosity。
 * 相同话题出现次数 × emotion_score 加权 = interest weight。
 */
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { runMemoryStoreSql } from "./memory_store.js";

export const INTERESTS_FILENAME = "interests.json";

export interface InterestEntry {
  topic: string;
  weight: number;
  lastActivatedAt: string;
}

export interface InterestsData {
  interests: InterestEntry[];
  updatedAt: string;
}

export function createInitialInterests(): InterestsData {
  return { interests: [], updatedAt: new Date().toISOString() };
}

export function normalizeInterests(raw: Record<string, unknown>): InterestsData {
  const interests = Array.isArray(raw.interests)
    ? raw.interests
        .filter(
          (e): e is Record<string, unknown> => e !== null && typeof e === "object" && !Array.isArray(e)
        )
        .map((e) => ({
          topic: typeof e.topic === "string" ? e.topic : "",
          weight: typeof e.weight === "number" ? clamp01(e.weight) : 0,
          lastActivatedAt: typeof e.lastActivatedAt === "string" ? e.lastActivatedAt : new Date().toISOString()
        }))
        .filter((e) => e.topic.length > 0)
    : [];
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString();
  return { interests, updatedAt };
}

export async function loadInterests(rootPath: string): Promise<InterestsData | null> {
  const p = path.join(rootPath, INTERESTS_FILENAME);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(await readFile(p, "utf8")) as Record<string, unknown>;
    return normalizeInterests(raw);
  } catch {
    return null;
  }
}

export async function writeInterests(rootPath: string, data: InterestsData): Promise<void> {
  await writeFile(path.join(rootPath, INTERESTS_FILENAME), JSON.stringify(data, null, 2), "utf8");
}

/**
 * 从 memory.db 中提取高 narrative_score 的语义记忆，统计 topic 词频并生成兴趣分布。
 * 权重 = 出现次数(归一化) × 平均 emotion_score。
 * 最多保留前 20 个兴趣。
 */
export async function crystallizeInterests(rootPath: string): Promise<{ updated: boolean; interests: InterestEntry[] }> {
  const rawText = await runMemoryStoreSql(rootPath, "SELECT json_object('content', content, 'emotion_score', emotion_score, 'narrative_score', narrative_score, 'ts', created_at) FROM memories WHERE narrative_score >= 0.5 ORDER BY narrative_score DESC LIMIT 200;");

  const lines = rawText.trim().split("\n").filter((l) => l.trim());
  if (lines.length === 0) {
    return { updated: false, interests: [] };
  }

  type MemRow = { content: string; emotion_score: number | null; narrative_score: number | null; ts: string };
  const rows: MemRow[] = lines.flatMap((line) => {
    try { return [JSON.parse(line.trim()) as MemRow]; } catch { return []; }
  });

  if (rows.length === 0) {
    return { updated: false, interests: [] };
  }

  // Simple keyword extraction: extract significant words from content
  const topicMap = new Map<string, { count: number; emotionSum: number; lastActivated: string }>();
  const nowIso = new Date().toISOString();

  for (const row of rows) {
    const emotion = typeof row.emotion_score === "number" ? row.emotion_score : 0.5;
    const rowTs = typeof row.ts === "string" && row.ts ? row.ts : nowIso;
    const keywords = extractTopicKeywords(row.content);
    for (const kw of keywords) {
      const existing = topicMap.get(kw);
      if (existing) {
        existing.count += 1;
        existing.emotionSum += emotion;
        if (rowTs > existing.lastActivated) existing.lastActivated = rowTs;
      } else {
        topicMap.set(kw, { count: 1, emotionSum: emotion, lastActivated: rowTs });
      }
    }
  }

  if (topicMap.size === 0) return { updated: false, interests: [] };

  const maxCount = Math.max(...[...topicMap.values()].map((v) => v.count));

  const entries: InterestEntry[] = [...topicMap.entries()]
    .map(([topic, data]) => ({
      topic,
      weight: clamp01((data.count / maxCount) * (data.emotionSum / data.count)),
      lastActivatedAt: data.lastActivated
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 20);

  const updated: InterestsData = { interests: entries, updatedAt: new Date().toISOString() };
  await writeInterests(rootPath, updated);
  return { updated: true, interests: entries };
}

/**
 * 计算当前兴趣驱动的 curiosity 值（用于 proactive engine）。
 * 取最近7天被激活最多的话题权重均值。
 */
export function computeInterestCuriosity(data: InterestsData): number {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const recent = data.interests.filter((e) => e.lastActivatedAt >= sevenDaysAgo);
  if (recent.length === 0) return 0;
  const avgWeight = recent.reduce((sum, e) => sum + e.weight, 0) / recent.length;
  return clamp01(avgWeight);
}

export function isInterestsValid(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.interests) && typeof raw.updatedAt === "string";
}

// ─── private helpers ──────────────────────────────────────────────────────────

/** Stop words that are too generic to be meaningful topics */
const STOP_WORDS = new Set([
  "的", "了", "是", "在", "和", "我", "你", "他", "她", "它", "们",
  "这", "那", "就", "也", "都", "不", "有", "人", "说", "会", "想",
  "用", "能", "可", "要", "到", "去", "来", "让", "把", "被",
  "a", "an", "the", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "of", "in",
  "to", "for", "with", "on", "at", "by", "from", "as", "into",
  "that", "this", "it", "i", "you", "he", "she", "we", "they",
  "not", "no", "but", "and", "or", "so", "if", "when", "what",
  "how", "why", "who", "which", "my", "your", "his", "her"
]);

function extractTopicKeywords(content: string): string[] {
  // Extract CJK words (2-4 chars) and English words (5+ chars)
  const cjk = content.match(/[\u4e00-\u9fa5]{2,4}/g) ?? [];
  const eng = content.match(/[a-zA-Z]{5,}/g)?.map((w) => w.toLowerCase()) ?? [];
  return [...cjk, ...eng].filter((w) => !STOP_WORDS.has(w));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
