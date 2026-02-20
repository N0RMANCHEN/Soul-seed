import type { ProactiveDecisionTrace, ProactiveStateSnapshot, RelationshipState } from "../types.js";
import { createInitialRelationshipState, deriveCognitiveBalanceFromLibido, isExtremeProactiveWindowActive } from "../relationship_state.js";

export interface ProactiveEngineInput {
  relationshipState?: RelationshipState;
  curiosity: number;
  annoyanceBias: number;
  silenceMinutes: number;
  quietHoursStart?: number; // 0-23 静默开始小时（本地时间）
  quietHoursEnd?: number;   // 0-23 静默结束小时（本地时间）
  hasPendingGoal?: boolean; // 是否有未完成目标（用于调整主动消息关联性）
  taskContextHint?: string; // 最近任务上下文提示
}

function computeIsInQuietHours(start?: number, end?: number): boolean {
  if (start === undefined || end === undefined) {
    return false;
  }
  const currentHour = new Date().getHours();
  if (start <= end) {
    return currentHour >= start && currentHour < end;
  }
  // Wraps midnight: e.g. start=22, end=8
  return currentHour >= start || currentHour < end;
}

export function computeProactiveStateSnapshot(input: ProactiveEngineInput): ProactiveStateSnapshot {
  const relationship = input.relationshipState ?? createInitialRelationshipState();
  const dims = relationship.dimensions;
  const arousal = deriveCognitiveBalanceFromLibido(relationship);
  const isInQuietHours = computeIsInQuietHours(input.quietHoursStart, input.quietHoursEnd);
  let probabilityRaw =
    0.03 +
    dims.intimacy * 0.12 +
    dims.reciprocity * 0.08 +
    dims.libido * 0.12 +
    (isExtremeProactiveWindowActive(relationship) ? 0.2 : 0) +
    (arousal.arousalState === "low" ? 0 : 0.04) +
    Math.min(0.1, Math.max(0, input.silenceMinutes) / 30) +
    input.curiosity * 0.12 +
    input.annoyanceBias;
  if (isInQuietHours) {
    probabilityRaw = 0.005;
  } else if (input.hasPendingGoal) {
    probabilityRaw += 0.05;
  }
  const probability = Math.max(0.01, Math.min(0.92, probabilityRaw));
  return {
    ts: new Date().toISOString(),
    probability,
    curiosity: input.curiosity,
    annoyanceBias: input.annoyanceBias,
    isInQuietHours
  };
}

export function decideProactiveEmission(snapshot: ProactiveStateSnapshot, rand: number = Math.random()): ProactiveDecisionTrace {
  const emitted = rand < snapshot.probability;
  let suppressReason: string | undefined;
  if (!emitted) {
    suppressReason = snapshot.isInQuietHours ? "quiet_hours" : "probability_sample_miss";
  }
  return {
    ts: new Date().toISOString(),
    emitted,
    probability: snapshot.probability,
    reason: emitted ? "probability_sample_hit" : "probability_sample_miss",
    suppressReason
  };
}
