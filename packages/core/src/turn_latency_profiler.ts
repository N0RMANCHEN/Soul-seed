export const LATENCY_STAGES = [
  "routing",
  "recall",
  "planning",
  "llm_primary",
  "llm_meta",
  "guard",
  "rewrite",
  "emit"
] as const;

export type LatencyStage = (typeof LATENCY_STAGES)[number];

export type TurnLatencyBreakdown = Partial<Record<LatencyStage, number>>;

export interface TurnLatencySummary {
  breakdown: TurnLatencyBreakdown;
  totalMs: number;
  shares: Partial<Record<LatencyStage, number>>;
}

function clampNonNegative(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

export function buildTurnLatencySummary(input: {
  breakdown: TurnLatencyBreakdown;
  totalMs?: number;
}): TurnLatencySummary {
  const breakdown: TurnLatencyBreakdown = {};
  let summed = 0;
  for (const stage of LATENCY_STAGES) {
    const value = clampNonNegative(Number(input.breakdown[stage] ?? 0));
    if (value > 0) {
      breakdown[stage] = value;
    }
    summed += value;
  }
  const totalMs = clampNonNegative(Number(input.totalMs ?? (summed || 0)));
  const denom = totalMs > 0 ? totalMs : summed;
  const shares: Partial<Record<LatencyStage, number>> = {};
  for (const stage of LATENCY_STAGES) {
    const value = Number(breakdown[stage] ?? 0);
    if (value <= 0 || denom <= 0) continue;
    shares[stage] = Number((value / denom).toFixed(4));
  }
  return {
    breakdown,
    totalMs,
    shares
  };
}
