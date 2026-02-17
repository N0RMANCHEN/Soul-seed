import type { LifeEvent, MemoryMeta } from "./types.js";

export interface MemoryWeights {
  activation: number;
  emotion: number;
  narrative: number;
}

export const DEFAULT_MEMORY_WEIGHTS: MemoryWeights = {
  activation: 0.4,
  emotion: 0.3,
  narrative: 0.3
};

interface NormalizedMemoryMeta extends MemoryMeta {
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  salienceScore: number;
  state: "hot" | "warm" | "cold" | "scar";
}

export function scoreMemory(
  meta: MemoryMeta | undefined,
  nowIso: string,
  weights: MemoryWeights = DEFAULT_MEMORY_WEIGHTS
): number {
  const normalized = normalizeMeta(meta);
  const activation = activationSignal(normalized.activationCount, normalized.lastActivatedAt, nowIso);
  const emotion = clamp01(normalized.emotionScore);
  const narrative = clamp01(normalized.narrativeScore);
  const score = weights.activation * activation + weights.emotion * emotion + weights.narrative * narrative;
  return clamp01(score);
}

export function updateActivation(meta: MemoryMeta | undefined, tsIso: string): MemoryMeta {
  const normalized = normalizeMeta(meta);
  const next: NormalizedMemoryMeta = {
    ...normalized,
    activationCount: normalized.activationCount + 1,
    lastActivatedAt: tsIso
  };
  next.salienceScore = scoreMemory(next, tsIso);
  next.state = classifyMemoryState(next.salienceScore);
  return next;
}

export function classifyMemoryState(score: number): "hot" | "warm" | "cold" | "scar" {
  if (score >= 0.75) {
    return "hot";
  }
  if (score >= 0.45) {
    return "warm";
  }
  return "cold";
}

export function selectMemories(
  events: LifeEvent[],
  options: {
    nowIso: string;
    maxItems: number;
    weights?: MemoryWeights;
  }
): { selected: LifeEvent[]; breakdown: { lifeEvents: number; summaries: number } } {
  const scored = events
    .map((event) => {
      const meta = normalizeMeta(event.payload.memoryMeta);
      const score = scoreMemory(meta, options.nowIso, options.weights);
      const state = classifyMemoryState(score);
      return { event, score, state };
    })
    .filter((item) => item.state !== "cold")
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.event.ts.localeCompare(a.event.ts);
    });

  const selected = scored.slice(0, options.maxItems).map((item) => item.event);
  return {
    selected,
    breakdown: {
      lifeEvents: selected.length,
      summaries: 0
    }
  };
}

export function adaptWeights(
  current: MemoryWeights | undefined,
  feedback: {
    activationDelta?: number;
    emotionDelta?: number;
    narrativeDelta?: number;
  }
): MemoryWeights {
  const base = current ?? DEFAULT_MEMORY_WEIGHTS;
  const step = 0.02;
  const nextRaw: MemoryWeights = {
    activation: base.activation + clamp(feedback.activationDelta ?? 0, -step, step),
    emotion: base.emotion + clamp(feedback.emotionDelta ?? 0, -step, step),
    narrative: base.narrative + clamp(feedback.narrativeDelta ?? 0, -step, step)
  };
  const bounded: MemoryWeights = {
    activation: clamp(nextRaw.activation, 0.15, 0.7),
    emotion: clamp(nextRaw.emotion, 0.15, 0.7),
    narrative: clamp(nextRaw.narrative, 0.15, 0.7)
  };
  const sum = bounded.activation + bounded.emotion + bounded.narrative;
  return {
    activation: bounded.activation / sum,
    emotion: bounded.emotion / sum,
    narrative: bounded.narrative / sum
  };
}

export function compactColdMemories(events: LifeEvent[]): {
  compactedIds: string[];
  summary: string;
} {
  const cold = events.filter((event) => {
    const score = scoreMemory(event.payload.memoryMeta, new Date().toISOString());
    return classifyMemoryState(score) === "cold";
  });

  if (cold.length === 0) {
    return { compactedIds: [], summary: "" };
  }

  const summary = cold
    .slice(0, 5)
    .map((event) => String(event.payload.text ?? event.type))
    .join(" | ")
    .slice(0, 300);

  const compactedIds = cold.map((event) => event.hash);
  return { compactedIds, summary };
}

function normalizeMeta(meta: MemoryMeta | undefined): NormalizedMemoryMeta {
  return {
    tier: meta?.tier ?? "pattern",
    storageCost: meta?.storageCost ?? 1,
    retrievalCost: meta?.retrievalCost ?? 1,
    source: meta?.source ?? "system",
    activationCount: meta?.activationCount ?? 1,
    lastActivatedAt: meta?.lastActivatedAt ?? new Date(0).toISOString(),
    emotionScore: clamp01(meta?.emotionScore ?? 0.2),
    narrativeScore: clamp01(meta?.narrativeScore ?? 0.2),
    salienceScore: meta?.salienceScore ?? 0.2,
    state: meta?.state ?? "warm",
    compressedAt: meta?.compressedAt,
    summaryRef: meta?.summaryRef
  };
}

function activationSignal(count: number, lastActivatedAt: string, nowIso: string): number {
  const c = clamp(count, 1, 100);
  const days = elapsedDays(lastActivatedAt, nowIso);
  const recency = Math.exp(-days / 30);
  return clamp01(0.6 * Math.log1p(c) / Math.log(101) + 0.4 * recency);
}

function elapsedDays(olderIso: string, newerIso: string): number {
  const older = Date.parse(olderIso);
  const newer = Date.parse(newerIso);
  if (!Number.isFinite(older) || !Number.isFinite(newer) || newer < older) {
    return 0;
  }
  return (newer - older) / (1000 * 60 * 60 * 24);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}
