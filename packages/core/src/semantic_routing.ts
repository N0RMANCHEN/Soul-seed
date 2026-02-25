import type { SemanticProjectionResult } from "./semantic_projection.js";

export interface SemanticRoutingInput {
  projectionSource: SemanticProjectionResult["source"];
  projectionConfidence: number;
  usedLatentEvaluation: boolean;
  usedRegexFallback: boolean;
  fallbackReason?: string;
  isBusinessPath?: boolean;
}

export interface SemanticRoutingResult {
  tier: "L1" | "L2" | "L3" | "L4";
  reasonCodes: string[];
  isBusinessPath: boolean;
  fallbackReason?: string;
  arbitrationTriggered: boolean;
}

export function resolveSemanticRouting(input: SemanticRoutingInput): SemanticRoutingResult {
  const reasonCodes: string[] = [];
  const isBusinessPath = input.isBusinessPath !== false;
  if (input.usedRegexFallback) {
    reasonCodes.push("regex_fallback_activated");
    return {
      tier: "L4",
      reasonCodes,
      isBusinessPath,
      fallbackReason: input.fallbackReason ?? "regex_fallback",
      arbitrationTriggered: false
    };
  }
  if (input.projectionSource === "meta_cognition") {
    reasonCodes.push("meta_cognition_arbitration");
    if (input.projectionConfidence < 0.6) {
      reasonCodes.push("low_projection_confidence");
    }
    return {
      tier: "L3",
      reasonCodes,
      isBusinessPath,
      arbitrationTriggered: true
    };
  }
  if (input.usedLatentEvaluation) {
    reasonCodes.push("latent_projection_evaluation");
    return {
      tier: "L2",
      reasonCodes,
      isBusinessPath,
      arbitrationTriggered: false
    };
  }
  reasonCodes.push("vector_projection_primary");
  return {
    tier: "L1",
    reasonCodes,
    isBusinessPath,
    arbitrationTriggered: false
  };
}
