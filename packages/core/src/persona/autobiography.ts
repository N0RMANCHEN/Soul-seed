/**
 * P2-2: 自传体叙事（autobiography.json）
 * 把零散的 life.log 事件组织成 persona 的"人生叙述"。
 * chapters 只追加不改写（历史不可修订）；
 * selfUnderstanding 每次蒸馏时更新。
 */
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const AUTOBIOGRAPHY_FILENAME = "autobiography.json";

export interface AutobiographyChapter {
  id: string;
  /** 这段时期的名字（如"最初的相遇"）*/
  title: string;
  period: { from: string; to: string };
  /** ≤200字的叙述性摘要 */
  summary: string;
  /** 最多5个 life.log hash */
  keyEventHashes: string[];
  /** 这段时期的情感基调 */
  emotionalTone: string;
  /** P5-0: 这段时期的主要变化方向（≤80字）*/
  growthVector?: string;
}

export interface Autobiography {
  chapters: AutobiographyChapter[];
  /** Roxy 对自己当下状态的第一人称理解（≤300字）*/
  selfUnderstanding: string;
  lastDistilledAt: string | null;
}

export function createInitialAutobiography(): Autobiography {
  return {
    chapters: [],
    selfUnderstanding: "",
    lastDistilledAt: null
  };
}

export function normalizeAutobiography(raw: Record<string, unknown>): Autobiography {
  const chapters = Array.isArray(raw.chapters)
    ? raw.chapters
        .filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
        .map(normalizeChapter)
    : [];
  const selfUnderstanding =
    typeof raw.selfUnderstanding === "string" ? raw.selfUnderstanding.slice(0, 300) : "";
  const lastDistilledAt =
    typeof raw.lastDistilledAt === "string" ? raw.lastDistilledAt : null;
  return { chapters, selfUnderstanding, lastDistilledAt };
}

function normalizeChapter(raw: Record<string, unknown>): AutobiographyChapter {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    title: typeof raw.title === "string" ? raw.title.slice(0, 80) : "",
    period: {
      from: isRecord(raw.period) && typeof raw.period.from === "string" ? raw.period.from : "",
      to: isRecord(raw.period) && typeof raw.period.to === "string" ? raw.period.to : ""
    },
    summary: typeof raw.summary === "string" ? raw.summary.slice(0, 200) : "",
    keyEventHashes: Array.isArray(raw.keyEventHashes)
      ? raw.keyEventHashes.filter((h): h is string => typeof h === "string").slice(0, 5)
      : [],
    emotionalTone: typeof raw.emotionalTone === "string" ? raw.emotionalTone : "neutral",
    ...(typeof raw.growthVector === "string" ? { growthVector: raw.growthVector.slice(0, 80) } : {})
  };
}

export async function loadAutobiography(rootPath: string): Promise<Autobiography | null> {
  const p = path.join(rootPath, AUTOBIOGRAPHY_FILENAME);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(await readFile(p, "utf8")) as Record<string, unknown>;
    return normalizeAutobiography(raw);
  } catch {
    return null;
  }
}

export async function writeAutobiography(rootPath: string, auto: Autobiography): Promise<void> {
  await writeFile(path.join(rootPath, AUTOBIOGRAPHY_FILENAME), JSON.stringify(auto, null, 2), "utf8");
}

/**
 * 追加一个新 chapter（只追加，不修改历史）
 */
export async function appendAutobiographyChapter(
  rootPath: string,
  chapter: Omit<AutobiographyChapter, "id">
): Promise<Autobiography> {
  const current = (await loadAutobiography(rootPath)) ?? createInitialAutobiography();
  const newChapter: AutobiographyChapter = {
    id: `chapter_${Date.now()}`,
    ...chapter,
    summary: chapter.summary.slice(0, 200),
    title: chapter.title.slice(0, 80),
    keyEventHashes: chapter.keyEventHashes.slice(0, 5),
    ...(chapter.growthVector ? { growthVector: chapter.growthVector.slice(0, 80) } : {})
  };
  const updated: Autobiography = {
    ...current,
    chapters: [...current.chapters, newChapter]
  };
  await writeAutobiography(rootPath, updated);
  return updated;
}

/**
 * 更新 selfUnderstanding（由 LLM 蒸馏后调用）
 */
export async function updateSelfUnderstanding(
  rootPath: string,
  selfUnderstanding: string
): Promise<Autobiography> {
  const current = (await loadAutobiography(rootPath)) ?? createInitialAutobiography();
  const updated: Autobiography = {
    ...current,
    selfUnderstanding: selfUnderstanding.slice(0, 300),
    lastDistilledAt: new Date().toISOString()
  };
  await writeAutobiography(rootPath, updated);
  return updated;
}

/**
 * P5-0: 生成发展弧的文本摘要（用于 arc show）
 * ≥3 个 chapter 时，可在 selfUnderstanding 中描述成长轨迹
 */
export function generateArcSummary(auto: Autobiography): string {
  if (auto.chapters.length === 0) return "尚无发展弧数据（需要至少一个章节）。";
  const lines: string[] = [];
  const earliest = auto.chapters[0];
  const latest = auto.chapters[auto.chapters.length - 1];
  lines.push(`时间跨度：${earliest.period.from} → ${latest.period.to}`);
  lines.push(`章节数：${auto.chapters.length}`);
  lines.push("");
  auto.chapters.forEach((ch, i) => {
    const growth = ch.growthVector ? `  ↗ ${ch.growthVector}` : "";
    lines.push(`第${i + 1}章 [${ch.period.from}] ${ch.title}（${ch.emotionalTone}）${growth}`);
  });
  if (auto.selfUnderstanding) {
    lines.push("");
    lines.push(`当前自我理解：${auto.selfUnderstanding}`);
  }
  return lines.join("\n");
}

export function isAutobiographyValid(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.chapters) && typeof raw.selfUnderstanding === "string";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
