/**
 * EC-3: 路由权重自适应
 *
 * Analyzes cognition_state_updated events from life.log to adapt routing weights
 * based on observed instinct route success rates.
 *
 * Rules:
 * - Requires at least MIN_EVENTS routing decisions to trigger
 * - If instinct success rate is consistently high (>70%) → micro-increase familiarity/relationship weights
 * - If instinct success rate is low → maintain weights (deliberative is the safe path, never penalize)
 * - Max step per call: MAX_STEP (0.02)
 * - Weight range clamped to [WEIGHT_MIN, WEIGHT_MAX] = [0.1, 0.8]
 */

import type { CognitionState, LifeEvent } from "../types.js";

export type RoutingWeights = NonNullable<CognitionState["routingWeights"]>;

export const ROUTING_ADAPT_MIN_EVENTS = 3;
export const ROUTING_ADAPT_MAX_STEP = 0.02;
export const ROUTING_ADAPT_WEIGHT_MIN = 0.1;
export const ROUTING_ADAPT_WEIGHT_MAX = 0.8;
/** Instinct success rate above which we nudge weights up */
const INSTINCT_SUCCESS_THRESHOLD = 0.7;
/** Maximum number of recent routing events to consider */
const MAX_HISTORY_WINDOW = 50;

export interface RoutingAdaptResult {
  weights: RoutingWeights;
  adapted: boolean;
  reason: string;
  stats: {
    totalEvents: number;
    instinctEvents: number;
    instinctSuccessful: number;
    instinctSuccessRate: number;
  };
}

/**
 * EC-3: Adapt routing weights from historical routing decisions.
 *
 * Uses `cognition_state_updated` life events which include routeDecision,
 * guardCorrected, and refused fields written by the runtime after each turn.
 */
export function adaptRoutingWeightsFromHistory(
  lifeEvents: LifeEvent[],
  currentWeights: RoutingWeights
): RoutingAdaptResult {
  // Filter relevant routing events: cognition_state_updated with a routeDecision field
  const routingEvents = lifeEvents
    .filter(
      (e) =>
        e.type === "cognition_state_updated" &&
        (e.payload.routeDecision === "instinct" || e.payload.routeDecision === "deliberative")
    )
    .slice(-MAX_HISTORY_WINDOW);

  const stats = {
    totalEvents: routingEvents.length,
    instinctEvents: 0,
    instinctSuccessful: 0,
    instinctSuccessRate: 0
  };

  if (routingEvents.length < ROUTING_ADAPT_MIN_EVENTS) {
    return {
      weights: currentWeights,
      adapted: false,
      reason: `insufficient_history (${routingEvents.length}/${ROUTING_ADAPT_MIN_EVENTS})`,
      stats
    };
  }

  const instinctEvents = routingEvents.filter((e) => e.payload.routeDecision === "instinct");
  const instinctSuccessful = instinctEvents.filter(
    (e) => !e.payload.guardCorrected && !e.payload.refused
  );
  const instinctSuccessRate =
    instinctEvents.length > 0 ? instinctSuccessful.length / instinctEvents.length : 0;
  const instinctRatio = instinctEvents.length / routingEvents.length;

  stats.instinctEvents = instinctEvents.length;
  stats.instinctSuccessful = instinctSuccessful.length;
  stats.instinctSuccessRate = instinctSuccessRate;

  if (instinctSuccessRate > INSTINCT_SUCCESS_THRESHOLD && instinctRatio > 0.5) {
    // Instinct consistently succeeds → micro-increase familiarity and relationship weights
    const excess = instinctSuccessRate - INSTINCT_SUCCESS_THRESHOLD;
    const step = Math.min(ROUTING_ADAPT_MAX_STEP, excess * 0.1);
    const newWeights: RoutingWeights = {
      familiarity: clampWeight(currentWeights.familiarity + step),
      relationship: clampWeight(currentWeights.relationship + step),
      emotion: currentWeights.emotion,
      risk: currentWeights.risk
    };
    return {
      weights: newWeights,
      adapted: true,
      reason: `instinct_success_rate=${instinctSuccessRate.toFixed(2)} step=${step.toFixed(4)}`,
      stats
    };
  }

  // Deliberative path or mixed: maintain weights unchanged (deliberative is the safe path)
  return {
    weights: currentWeights,
    adapted: false,
    reason: `maintain_weights (instinct_success=${instinctSuccessRate.toFixed(2)} instinct_ratio=${instinctRatio.toFixed(2)})`,
    stats
  };
}

function clampWeight(v: number): number {
  return Math.max(ROUTING_ADAPT_WEIGHT_MIN, Math.min(ROUTING_ADAPT_WEIGHT_MAX, v));
}
