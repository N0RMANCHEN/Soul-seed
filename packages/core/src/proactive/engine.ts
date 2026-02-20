import type { ProactiveDecisionTrace, ProactiveStateSnapshot, RelationshipState } from "../types.js";
import { createInitialRelationshipState, deriveCognitiveBalanceFromLibido, isExtremeProactiveWindowActive } from "../relationship_state.js";

export interface ProactiveEngineInput {
  relationshipState?: RelationshipState;
  curiosity: number;
  annoyanceBias: number;
  silenceMinutes: number;
}

export function computeProactiveStateSnapshot(input: ProactiveEngineInput): ProactiveStateSnapshot {
  const relationship = input.relationshipState ?? createInitialRelationshipState();
  const dims = relationship.dimensions;
  const arousal = deriveCognitiveBalanceFromLibido(relationship);
  const probabilityRaw =
    0.03 +
    dims.intimacy * 0.12 +
    dims.reciprocity * 0.08 +
    dims.libido * 0.12 +
    (isExtremeProactiveWindowActive(relationship) ? 0.2 : 0) +
    (arousal.arousalState === "low" ? 0 : 0.04) +
    Math.min(0.1, Math.max(0, input.silenceMinutes) / 30) +
    input.curiosity * 0.12 +
    input.annoyanceBias;
  const probability = Math.max(0.01, Math.min(0.92, probabilityRaw));
  return {
    ts: new Date().toISOString(),
    probability,
    curiosity: input.curiosity,
    annoyanceBias: input.annoyanceBias
  };
}

export function decideProactiveEmission(snapshot: ProactiveStateSnapshot, rand: number = Math.random()): ProactiveDecisionTrace {
  const emitted = rand < snapshot.probability;
  return {
    ts: new Date().toISOString(),
    emitted,
    probability: snapshot.probability,
    reason: emitted ? "probability_sample_hit" : "probability_sample_miss"
  };
}
