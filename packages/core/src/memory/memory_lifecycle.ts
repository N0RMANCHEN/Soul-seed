import type { LifeEvent, MemoryMeta } from "../types.js";

export interface MemoryWeights {
  activation: number;
  emotion: number;
  narrative: number;
  relational: number;
}

export interface StoreMemorySignals {
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  memoryType?: string;
  state?: string;
  credibilityScore?: number;
}

export const DEFAULT_MEMORY_WEIGHTS: MemoryWeights = {
  activation: 0.32,
  emotion: 0.2,
  narrative: 0.2,
  relational: 0.28
};

interface NormalizedMemoryMeta extends MemoryMeta {
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  relationalScore: number;
  decayClass: "fast" | "standard" | "slow" | "sticky";
  salienceScore: number;
  state: "hot" | "warm" | "cold" | "archive" | "scar";
}

export function scoreMemory(
  meta: MemoryMeta | undefined,
  nowIso: string,
  weights: MemoryWeights = DEFAULT_MEMORY_WEIGHTS
): number {
  const normalized = normalizeMeta(meta);
  const activation = activationSignal(
    normalized.activationCount,
    normalized.lastActivatedAt,
    nowIso,
    normalized.decayClass
  );
  const emotion = clamp01(normalized.emotionScore);
  const narrative = clamp01(normalized.narrativeScore);
  const relational = clamp01(normalized.relationalScore);
  const score =
    weights.activation * activation +
    weights.emotion * emotion +
    weights.narrative * narrative +
    weights.relational * relational;
  return clamp01(score);
}

export function scoreMemoryFromStoreRow(
  row: StoreMemorySignals,
  nowIso: string,
  weights: MemoryWeights = DEFAULT_MEMORY_WEIGHTS
): number {
  return scoreMemory(
    {
      tier: "pattern",
      storageCost: 1,
      retrievalCost: 1,
      source: "system",
      activationCount: row.activationCount,
      lastActivatedAt: row.lastActivatedAt,
      emotionScore: row.emotionScore,
      narrativeScore: row.narrativeScore,
      relationalScore: inferRelationalScore(row.memoryType, row.state),
      decayClass: inferDecayClass(undefined, row.memoryType),
      credibilityScore: row.credibilityScore
    },
    nowIso,
    weights
  );
}

export function updateActivation(meta: MemoryMeta | undefined, tsIso: string): MemoryMeta {
  const normalized = normalizeMeta(meta);
  const next: NormalizedMemoryMeta = {
    ...normalized,
    activationCount: normalized.activationCount + 1,
    lastActivatedAt: tsIso
  };
  next.salienceScore = scoreMemory(next, tsIso);
  next.state = normalized.state === "scar" ? "scar" : classifyMemoryState(next.salienceScore);
  return next;
}

export function classifyMemoryState(score: number): "hot" | "warm" | "cold" | "archive" | "scar" {
  if (score >= 0.78) {
    return "hot";
  }
  if (score >= 0.45) {
    return "warm";
  }
  if (score >= 0.18) {
    return "cold";
  }
  return "archive";
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
    .filter((item) => item.state !== "cold" && item.state !== "archive")
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
    relationalDelta?: number;
  }
): MemoryWeights {
  const base = current ?? DEFAULT_MEMORY_WEIGHTS;
  const step = 0.02;
  const nextRaw: MemoryWeights = {
    activation: base.activation + clamp(feedback.activationDelta ?? 0, -step, step),
    emotion: base.emotion + clamp(feedback.emotionDelta ?? 0, -step, step),
    narrative: base.narrative + clamp(feedback.narrativeDelta ?? 0, -step, step),
    relational: base.relational + clamp(feedback.relationalDelta ?? 0, -step, step)
  };
  const bounded: MemoryWeights = {
    activation: clamp(nextRaw.activation, 0.1, 0.6),
    emotion: clamp(nextRaw.emotion, 0.1, 0.6),
    narrative: clamp(nextRaw.narrative, 0.1, 0.6),
    relational: clamp(nextRaw.relational, 0.1, 0.6)
  };
  const sum = bounded.activation + bounded.emotion + bounded.narrative + bounded.relational;
  return {
    activation: bounded.activation / sum,
    emotion: bounded.emotion / sum,
    narrative: bounded.narrative / sum,
    relational: bounded.relational / sum
  };
}

export function compactColdMemories(events: LifeEvent[]): {
  compactedIds: string[];
  summary: string;
} {
  const nowIso = new Date().toISOString();
  const cold = events.filter((event) => {
    const meta = normalizeMeta(event.payload.memoryMeta);
    const score = scoreMemory(meta, nowIso);
    const staleDays = elapsedDays(meta.lastActivatedAt, nowIso);
    return (classifyMemoryState(score) === "cold" || classifyMemoryState(score) === "archive") &&
      meta.activationCount <= 2 &&
      staleDays >= 30;
  });

  if (cold.length === 0) {
    return { compactedIds: [], summary: "" };
  }

  const groups = new Map<string, string[]>();
  for (const event of cold.slice(-80)) {
    const key = event.type;
    const list = groups.get(key) ?? [];
    list.push(String(event.payload.text ?? event.type).slice(0, 80));
    groups.set(key, list);
  }
  const summary = [...groups.entries()]
    .map(([key, samples]) => `${key}(${samples.length}): ${samples.slice(0, 2).join(" / ")}`)
    .slice(0, 5)
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
    relationalScore: clamp01(meta?.relationalScore ?? inferRelationalScore(undefined, meta?.state)),
    decayClass: inferDecayClass(meta, undefined),
    salienceScore: meta?.salienceScore ?? 0.2,
    state: meta?.state ?? "warm",
    compressedAt: meta?.compressedAt,
    summaryRef: meta?.summaryRef
  };
}

function activationSignal(
  count: number,
  lastActivatedAt: string,
  nowIso: string,
  decayClass: "fast" | "standard" | "slow" | "sticky"
): number {
  const c = clamp(count, 1, 100);
  const days = elapsedDays(lastActivatedAt, nowIso);
  const halfLifeDays = decayClassHalfLifeDays(decayClass);
  const recency = Math.exp(-Math.log(2) * (days / halfLifeDays));
  return clamp01(0.6 * Math.log1p(c) / Math.log(101) + 0.4 * recency);
}

function decayClassHalfLifeDays(decayClass: "fast" | "standard" | "slow" | "sticky"): number {
  switch (decayClass) {
    case "fast":
      return 10;
    case "slow":
      return 60;
    case "sticky":
      return 120;
    default:
      return 30;
  }
}

function inferDecayClass(meta: MemoryMeta | undefined, memoryType?: string): "fast" | "standard" | "slow" | "sticky" {
  if (meta?.decayClass === "fast" || meta?.decayClass === "standard" || meta?.decayClass === "slow" || meta?.decayClass === "sticky") {
    return meta.decayClass;
  }
  if (meta?.state === "scar") {
    return "sticky";
  }
  if (memoryType === "relational") {
    return "slow";
  }
  if (memoryType === "procedural") {
    return "slow";
  }
  if (meta?.tier === "highlight") {
    return "slow";
  }
  if (meta?.tier === "error") {
    return "fast";
  }
  return "standard";
}

function inferRelationalScore(memoryType?: string, state?: string): number {
  let base = 0.2;
  if (memoryType === "relational") {
    base = 0.9;
  } else if (memoryType === "semantic") {
    base = 0.4;
  } else if (memoryType === "episodic") {
    base = 0.3;
  } else if (memoryType === "procedural") {
    base = 0.25;
  }
  if (state === "scar") {
    base += 0.1;
  }
  return clamp01(base);
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
