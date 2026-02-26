/**
 * P3-1: 周期性自我反思日志（self_reflection.json）
 * 定期让 persona 以第一人称检视自己的变化，发现漂移时联动 constitution review 请求。
 * 实际 LLM 调用由外部触发（CLI 或 cron 脚本），本模块管理文件结构与 trigger 判断。
 */
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { LifeEvent } from "../types.js";

export const SELF_REFLECTION_FILENAME = "self_reflection.json";

export interface SelfReflectionEntry {
  id: string;
  period: { from: string; to: string };
  /** 这段时间我有什么变化（≤150字）*/
  whatChanged: string;
  /** 什么感觉对了（≤100字）*/
  whatFeelsRight: string;
  /** 什么感觉不对（≤100字）*/
  whatFeelsOff: string;
  /** behavior_drift 报告摘要（机器数据）*/
  driftSignals: string[];
  generatedAt: string;
}

export interface SelfReflectionData {
  entries: SelfReflectionEntry[];
}

export function createInitialSelfReflection(): SelfReflectionData {
  return { entries: [] };
}

export function normalizeSelfReflection(raw: Record<string, unknown>): SelfReflectionData {
  const entries = Array.isArray(raw.entries)
    ? raw.entries
        .filter((e): e is Record<string, unknown> => e !== null && typeof e === "object")
        .map(normalizeEntry)
    : [];
  return { entries };
}

function normalizeEntry(raw: Record<string, unknown>): SelfReflectionEntry {
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    period: {
      from: isRecord(raw.period) && typeof raw.period.from === "string" ? raw.period.from : "",
      to: isRecord(raw.period) && typeof raw.period.to === "string" ? raw.period.to : ""
    },
    whatChanged: typeof raw.whatChanged === "string" ? raw.whatChanged.slice(0, 150) : "",
    whatFeelsRight: typeof raw.whatFeelsRight === "string" ? raw.whatFeelsRight.slice(0, 100) : "",
    whatFeelsOff: typeof raw.whatFeelsOff === "string" ? raw.whatFeelsOff.slice(0, 100) : "",
    driftSignals: Array.isArray(raw.driftSignals)
      ? raw.driftSignals.filter((s): s is string => typeof s === "string")
      : [],
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString()
  };
}

export async function loadSelfReflection(rootPath: string): Promise<SelfReflectionData | null> {
  const p = path.join(rootPath, SELF_REFLECTION_FILENAME);
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(await readFile(p, "utf8")) as Record<string, unknown>;
    return normalizeSelfReflection(raw);
  } catch {
    return null;
  }
}

export async function writeSelfReflection(rootPath: string, data: SelfReflectionData): Promise<void> {
  await writeFile(path.join(rootPath, SELF_REFLECTION_FILENAME), JSON.stringify(data, null, 2), "utf8");
}

/**
 * 追加一条自我反思记录
 */
export async function appendSelfReflectionEntry(
  rootPath: string,
  entry: Omit<SelfReflectionEntry, "id" | "generatedAt">
): Promise<SelfReflectionData> {
  const current = (await loadSelfReflection(rootPath)) ?? createInitialSelfReflection();
  const newEntry: SelfReflectionEntry = {
    id: `reflection_${Date.now()}`,
    ...entry,
    whatChanged: entry.whatChanged.slice(0, 150),
    whatFeelsRight: entry.whatFeelsRight.slice(0, 100),
    whatFeelsOff: entry.whatFeelsOff.slice(0, 100),
    generatedAt: new Date().toISOString()
  };
  const updated: SelfReflectionData = {
    entries: [...current.entries, newEntry]
  };
  await writeSelfReflection(rootPath, updated);
  return updated;
}

/**
 * 判断是否应触发自我反思（每 100 轮对话或每7天至少一次）
 */
export function shouldTriggerSelfReflection(
  data: SelfReflectionData,
  params: {
    totalTurns: number;
    nowMs?: number;
    intervalTurns?: number;
    intervalDays?: number;
  }
): boolean {
  const intervalTurns = params.intervalTurns ?? 100;
  const intervalDays = params.intervalDays ?? 7;
  const nowMs = params.nowMs ?? Date.now();

  if (data.entries.length === 0) {
    // First reflection after minimum turns
    return params.totalTurns >= intervalTurns;
  }

  const last = data.entries[data.entries.length - 1];
  const lastMs = Date.parse(last.generatedAt);
  const daysSinceLast = (nowMs - lastMs) / 86_400_000;

  if (daysSinceLast >= intervalDays) return true;

  // Count turns since last reflection (approximation: totalTurns mod intervalTurns)
  // In practice the caller should track turns since last reflection
  const turnsModulo = params.totalTurns % intervalTurns;
  return turnsModulo === 0 && params.totalTurns > 0;
}

/**
 * 判断最近的反思是否有严重漂移，需要联动 constitution review
 */
export function shouldRequestReviewFromReflection(data: SelfReflectionData): boolean {
  if (data.entries.length === 0) return false;
  const last = data.entries[data.entries.length - 1];
  // 如果 whatFeelsOff 非空且 driftSignals 有内容，建议 review
  return last.whatFeelsOff.length > 10 && last.driftSignals.length > 0;
}

/**
 * 提取最近 N 轮 life.log 事件中的 narrative_drift 信号
 */
export function extractDriftSignalsFromEvents(events: LifeEvent[], windowSize = 50): string[] {
  const recent = events.slice(-windowSize);
  const signals: string[] = [];
  for (const e of recent) {
    if (e.type === "narrative_drift_detected" && e.payload) {
      const score = Number(e.payload.score ?? 0);
      const reasons = Array.isArray(e.payload.reasons) ? e.payload.reasons as string[] : [];
      if (score >= 0.3) {
        signals.push(`drift@${e.ts.slice(0, 10)}: score=${score.toFixed(2)}, reasons=${reasons.join(",")}`);
      }
    }
  }
  return signals;
}

export function isSelfReflectionValid(raw: Record<string, unknown>): boolean {
  return Array.isArray(raw.entries);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}
