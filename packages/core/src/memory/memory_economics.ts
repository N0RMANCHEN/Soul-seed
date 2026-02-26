import type { DecisionTrace, MemoryMeta, MemoryMetaSource, MemoryTier } from "../types.js";
import { classifyMemoryState, scoreMemory } from "./memory_lifecycle.js";

export function classifyMemoryTier(params: {
  userInput?: string;
  assistantReply?: string;
  trace?: DecisionTrace;
  conflictCategory?: string;
  correctedByIdentityGuard?: boolean;
}): MemoryTier {
  const userInput = params.userInput ?? "";
  const assistantReply = params.assistantReply ?? "";

  if (params.correctedByIdentityGuard || params.conflictCategory || params.trace?.refuse) {
    return "error";
  }

  const highlightPattern = /(我叫|叫我|记住|重要|锚点|always\s+remember|my\s+name\s+is)/i;
  if (highlightPattern.test(userInput) || highlightPattern.test(assistantReply)) {
    return "highlight";
  }

  return "pattern";
}

export function estimateMemoryCosts(
  tier: MemoryTier,
  contentLength: number
): { storageCost: number; retrievalCost: number } {
  const lenPenalty = contentLength > 300 ? 1 : 0;

  if (tier === "highlight") {
    return { storageCost: 3 + lenPenalty, retrievalCost: 2 };
  }

  if (tier === "error") {
    return { storageCost: 2 + lenPenalty, retrievalCost: 3 };
  }

  return { storageCost: 1 + lenPenalty, retrievalCost: 1 };
}

export function buildMemoryMeta(params: {
  tier: MemoryTier;
  source: MemoryMetaSource;
  contentLength: number;
  emotionScore?: number;
  narrativeScore?: number;
  activatedAt?: string;
}): MemoryMeta {
  const costs = estimateMemoryCosts(params.tier, params.contentLength);
  const activatedAt = params.activatedAt ?? new Date().toISOString();
  const base: MemoryMeta = {
    tier: params.tier,
    storageCost: costs.storageCost,
    retrievalCost: costs.retrievalCost,
    source: params.source,
    activationCount: 1,
    lastActivatedAt: activatedAt,
    emotionScore: params.emotionScore ?? (params.tier === "error" ? 0.8 : 0.3),
    narrativeScore: params.narrativeScore ?? (params.tier === "highlight" ? 0.8 : 0.4)
  };
  const salience = scoreMemory(base, activatedAt);
  return {
    ...base,
    salienceScore: salience,
    state: classifyMemoryState(salience)
  };
}
