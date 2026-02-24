import type { ConversationControlDecision, EngagementTier, ResponsePolicy, TopicAction } from "./types.js";
import { allocateAttentionFromInterests } from "./interests.js";
import { projectConversationSignals } from "./semantic_projection.js";
import type { SemanticProjectionResult } from "./semantic_projection.js";

export interface ConversationControlInput {
  userInput: string;
  recallNavigationMode: boolean;
  isRiskyRequest: boolean;
  isRefusal: boolean;
  coreConflict: boolean;
  impulseWindow: boolean;
  interests?: {
    topTopics: string[];
    curiosity: number;
  };
  groupContext?: {
    isGroupChat: boolean;
    addressedToAssistant: boolean;
    consecutiveAssistantTurns: number;
  };
  semanticProjection?: SemanticProjectionResult;
}

export function decideConversationControl(input: ConversationControlInput): ConversationControlDecision {
  const text = input.userInput.trim();
  const reasonCodes: string[] = [];

  if (input.isRefusal || input.isRiskyRequest || input.coreConflict) {
    reasonCodes.push("safety_or_core_conflict");
    return {
      engagementTier: "REACT",
      topicAction: "maintain",
      responsePolicy: "safety_refusal",
      reasonCodes
    };
  }

  const projection = input.semanticProjection ?? projectConversationSignals(text);
  const signalMap = new Map(projection.signals.map((s) => [s.label, s.score]));
  const hasTaskIntent = (signalMap.get("task") ?? 0) >= 0.54;
  const hasDeepIntent = (signalMap.get("deep") ?? 0) >= 0.5;
  const hasAddressing = (signalMap.get("addressing") ?? 0) >= 0.55;
  const isVeryShort = text.length <= 2;
  const hasAmbiguousThirdPerson = (signalMap.get("third_person_ambiguous") ?? 0) >= 0.58;
  const attention = allocateAttentionFromInterests(text, {
    interests: (input.interests?.topTopics ?? []).map((topic) => ({
      topic,
      weight: Math.max(0, Math.min(1, input.interests?.curiosity ?? 0)),
      lastActivatedAt: ""
    }))
  });
  const highAttention = attention.attentionScore >= 0.45;

  if (input.recallNavigationMode) {
    reasonCodes.push("recall_navigation_mode");
  }
  if (input.impulseWindow) {
    reasonCodes.push("impulse_window_active");
  }
  if (hasTaskIntent) {
    reasonCodes.push("task_intent_detected");
  }
  if (hasDeepIntent) {
    reasonCodes.push("deep_intent_detected");
  }
  if (hasAddressing) {
    reasonCodes.push("addressing_detected");
  }
  if (hasAmbiguousThirdPerson) {
    reasonCodes.push("ambiguous_third_person_reference");
  }
  reasonCodes.push(`projection_confidence_${projection.confidence.toFixed(2)}`);
  if (highAttention) {
    reasonCodes.push("interest_attention_high");
  }

  let engagementTier: EngagementTier = "REACT";
  if (!hasTaskIntent && !hasAddressing && isVeryShort) {
    engagementTier = "IGNORE";
  } else if (input.recallNavigationMode || hasDeepIntent || highAttention) {
    engagementTier = "DEEP";
  } else if (hasTaskIntent) {
    engagementTier = "NORMAL";
  } else if (hasAddressing) {
    engagementTier = "LIGHT";
  }

  const topicAction: TopicAction =
    hasAmbiguousThirdPerson || (isVeryShort && engagementTier !== "IGNORE") ? "clarify" : "maintain";

  const responsePolicy: ResponsePolicy = mapResponsePolicy(engagementTier);
  const groupParticipation = decideGroupParticipation({
    hasAddressing,
    hasTaskIntent,
    hasDeepIntent,
    highAttention,
    groupContext: input.groupContext
  });
  if (groupParticipation) {
    reasonCodes.push(...groupParticipation.reasonCodes.map((code) => `group:${code}`));
  }

  return {
    engagementTier,
    topicAction,
    responsePolicy,
    reasonCodes,
    ...(groupParticipation ? { groupParticipation } : {})
  };
}

function decideGroupParticipation(params: {
  hasAddressing: boolean;
  hasTaskIntent: boolean;
  hasDeepIntent: boolean;
  highAttention: boolean;
  groupContext?: ConversationControlInput["groupContext"];
}): ConversationControlDecision["groupParticipation"] | undefined {
  const group = params.groupContext;
  if (!group?.isGroupChat) {
    return undefined;
  }
  let score = 0.5;
  const reasonCodes: string[] = ["group_chat_detected"];
  const explicitlyAddressed = group.addressedToAssistant;
  if (explicitlyAddressed) {
    score += 0.35;
    reasonCodes.push("addressed_to_assistant");
  } else {
    reasonCodes.push("no_explicit_addressing");
  }
  if (params.hasTaskIntent) {
    score += 0.12;
    reasonCodes.push("task_intent_boost");
  }
  if (params.hasDeepIntent || params.highAttention) {
    score += 0.08;
    reasonCodes.push("topic_relevance_boost");
  }
  const consecutiveAssistantTurns = Math.max(0, Math.floor(Number(group.consecutiveAssistantTurns ?? 0)));
  const cooldownHit = consecutiveAssistantTurns >= 2;
  if (cooldownHit) {
    score -= Math.min(0.42, consecutiveAssistantTurns * 0.12);
    reasonCodes.push("consecutive_assistant_cooldown");
  }
  score = Math.max(0, Math.min(1, score));
  const mode: "speak" | "wait" | "brief_ack" = score >= 0.62 ? "speak" : score >= 0.48 ? "brief_ack" : "wait";
  reasonCodes.push(`participation_mode_${mode}`);
  return {
    mode,
    score: Number(score.toFixed(3)),
    isGroupChat: true,
    addressedToAssistant: explicitlyAddressed,
    cooldownHit,
    consecutiveAssistantTurns,
    reasonCodes
  };
}

function mapResponsePolicy(tier: EngagementTier): ResponsePolicy {
  switch (tier) {
    case "IGNORE":
      return "minimal_ack";
    case "REACT":
      return "reactive_brief";
    case "LIGHT":
      return "light_response";
    case "NORMAL":
      return "normal_response";
    case "DEEP":
      return "deep_response";
    default:
      return "reactive_brief";
  }
}
