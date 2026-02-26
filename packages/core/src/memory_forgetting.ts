import { scoreMemoryFromStoreRow } from "./memory_lifecycle.js";

export interface ForgettingRow {
  id: string;
  memoryType?: string;
  state?: string;
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  credibilityScore?: number;
}

export interface ForgettingPolicy {
  nowIso: string;
  memoryHalfLifeDays: number;
  archiveThreshold: number;
  salienceGain: number;
  stickyProbability: number;
}

export interface ForgettingScore {
  id: string;
  baseScore: number;
  decayedScore: number;
  archiveCandidate: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function elapsedDays(fromIso: string, toIso: string): number {
  const fromTs = Date.parse(fromIso);
  const toTs = Date.parse(toIso);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) return 0;
  return (toTs - fromTs) / (1000 * 60 * 60 * 24);
}

export function decayMultiplier(days: number, halfLifeDays: number): number {
  if (!Number.isFinite(days) || days <= 0) return 1;
  const hl = clamp(halfLifeDays, 3, 180);
  return Math.exp(-Math.log(2) * (days / hl));
}

export function applyForgettingPolicy(rows: ForgettingRow[], policy: ForgettingPolicy): ForgettingScore[] {
  const halfLife = clamp(policy.memoryHalfLifeDays, 3, 180);
  const archiveThreshold = clamp(policy.archiveThreshold, 0.01, 0.95);
  const salienceGain = clamp(policy.salienceGain, 0.5, 2.5);

  return rows.map((row) => {
    const baseScore = scoreMemoryFromStoreRow(
      {
        activationCount: row.activationCount,
        lastActivatedAt: row.lastActivatedAt,
        emotionScore: row.emotionScore,
        narrativeScore: row.narrativeScore,
        memoryType: row.memoryType,
        state: row.state,
        credibilityScore: row.credibilityScore,
      },
      policy.nowIso,
    );

    const days = elapsedDays(row.lastActivatedAt, policy.nowIso);
    const decay = decayMultiplier(days, halfLife);
    const boosted = clamp(baseScore * salienceGain, 0, 1);
    const decayedScore = clamp(boosted * decay, 0, 1);

    const sticky = row.memoryType === "relational" || row.state === "scar";
    const stickyFloor = sticky ? clamp(policy.stickyProbability, 0.02, 0.4) : 0;
    const effectiveScore = Math.max(decayedScore, stickyFloor);

    return {
      id: row.id,
      baseScore,
      decayedScore: effectiveScore,
      archiveCandidate: effectiveScore < archiveThreshold,
    };
  });
}

export function applyInterferencePenalty(
  score: number,
  similarity: number,
  recencyRank: number,
): number {
  const sim = clamp(similarity, 0, 1);
  const rank = Math.max(0, recencyRank);
  const penalty = sim * Math.min(0.4, 0.08 * rank);
  return clamp(score - penalty, 0, 1);
}

export function shouldCompressMemory(args: {
  decayedScore: number;
  idleDays: number;
  activationCount: number;
  minIdleDays?: number;
  maxActivationCount?: number;
}): boolean {
  const minIdleDays = Math.max(1, args.minIdleDays ?? 14);
  const maxActivationCount = Math.max(0, args.maxActivationCount ?? 2);
  return args.decayedScore < 0.25 && args.idleDays >= minIdleDays && args.activationCount <= maxActivationCount;
}
