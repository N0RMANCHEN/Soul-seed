import type { ConversationControlDecision, EngagementTier, ResponsePolicy, TopicAction } from "../types.js";
import { allocateAttentionFromInterests } from "../persona/interests.js";
import { projectConversationSignals } from "./semantic_projection.js";
import type { SemanticProjectionResult } from "./semantic_projection.js";

export interface ConversationControlInput {
  userInput: string;
  recallNavigationMode: boolean;
  isRiskyRequest: boolean;
  isRefusal: boolean;
  coreConflict: boolean;
  implicitCoreTension?: boolean;
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
  budgetContext?: {
    turnBudgetMax: number;
    turnBudgetUsed: number;
    proactiveBudgetMax: number;
    proactiveBudgetUsed: number;
    proactiveCooldownUntilMs?: number;
    nowMs?: number;
  };
  topicContext?: {
    activeTopic?: string;
    candidateTopics?: string[];
    starvationBoostApplied?: boolean;
    selectedBy?: "addressing" | "task" | "interest" | "clarify" | "active" | "starvation_boost";
    bridgeFromTopic?: string;
  };
  semanticProjection?: SemanticProjectionResult;
  phaseJFlags?: {
    enabled?: boolean;
    recordOnly?: boolean;
    topicScheduler?: boolean;
  };
}

export function decideConversationControl(input: ConversationControlInput): ConversationControlDecision {
  const text = input.userInput.trim();
  const reasonCodes: string[] = [];
  const phaseJEnabled = input.phaseJFlags?.enabled !== false;
  const phaseJRecordOnly = input.phaseJFlags?.recordOnly === true;
  const phaseJTopicSchedulerEnabled = phaseJEnabled && input.phaseJFlags?.topicScheduler !== false;
  const phaseJMode: ConversationControlDecision["phaseJMode"] = !phaseJEnabled
    ? "disabled"
    : phaseJRecordOnly
      ? "record_only"
      : "enabled";

  if (input.isRefusal || input.isRiskyRequest || input.coreConflict) {
    const budget = normalizeBudget(input.budgetContext);
    reasonCodes.push("safety_or_core_conflict");
    return {
      engagementTier: "REACT",
      topicAction: "maintain",
      responsePolicy: "safety_refusal",
      reasonCodes,
      phaseJMode,
      engagementPolicyVersion: "j-p1-0/v1",
      ...(budget ? { budget } : {})
    };
  }
  if (input.implicitCoreTension) {
    const budget = normalizeBudget(input.budgetContext);
    reasonCodes.push("implicit_core_tension_degrade");
    return {
      engagementTier: "LIGHT",
      topicAction: "clarify",
      responsePolicy: "light_response",
      reasonCodes,
      phaseJMode,
      engagementPolicyVersion: "j-p1-0/v1",
      ...(budget ? { budget } : {}),
      ...(phaseJTopicSchedulerEnabled
        ? {
            topicScheduler: buildTopicScheduler({
              topicAction: "clarify",
              hasTaskIntent: false,
              hasAddressing: false,
              highAttention: false,
              interests: input.interests,
              topicContext: input.topicContext
            })
          }
        : {})
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

  const budget = normalizeBudget(input.budgetContext);
  if (budget) {
    const budgetBefore = {
      turnBudgetRemaining: budget.turnBudgetRemaining,
      proactiveBudgetRemaining: budget.proactiveBudgetRemaining
    };
    if (budget.turnBudgetUsed >= budget.turnBudgetMax) {
      const degraded = degradeTierForBudget(engagementTier);
      if (!phaseJRecordOnly && degraded !== engagementTier) {
        reasonCodes.push(`budget_degraded_${engagementTier.toLowerCase()}_to_${degraded.toLowerCase()}`);
        budget.degradedByBudget = true;
        engagementTier = degraded;
      } else if (phaseJRecordOnly && degraded !== engagementTier) {
        reasonCodes.push(`record_only_budget_degraded_${engagementTier.toLowerCase()}_to_${degraded.toLowerCase()}`);
      }
      budget.budgetReasonCodes.push("turn_budget_exhausted");
    }
    if (budget.proactiveBudgetUsed >= budget.proactiveBudgetMax) {
      budget.budgetReasonCodes.push("proactive_budget_exhausted");
    }
    if (budget.cooldownActive) {
      budget.budgetReasonCodes.push("proactive_cooldown_active");
    }
    const budgetAfter = {
      turnBudgetRemaining: Math.max(0, budget.turnBudgetMax - budget.turnBudgetUsed),
      proactiveBudgetRemaining: Math.max(0, budget.proactiveBudgetMax - budget.proactiveBudgetUsed)
    };
    reasonCodes.push(
      `engagement_trace:reply(turn=${budgetBefore.turnBudgetRemaining}->${budgetAfter.turnBudgetRemaining},proactive=${budgetBefore.proactiveBudgetRemaining}->${budgetAfter.proactiveBudgetRemaining})`
    );
  }

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
    phaseJMode,
    engagementPolicyVersion: "j-p1-0/v1",
    ...(budget ? { budget } : {}),
    ...(budget
      ? {
          engagementTrace: {
            triggerType: "reply",
            triggerReason: reasonCodes[0] ?? "reply_turn",
            budgetBefore: {
              turnBudgetRemaining: Math.max(0, budget.turnBudgetMax - budget.turnBudgetUsed),
              proactiveBudgetRemaining: Math.max(0, budget.proactiveBudgetMax - budget.proactiveBudgetUsed)
            },
            budgetAfter: {
              turnBudgetRemaining: Math.max(0, budget.turnBudgetMax - budget.turnBudgetUsed),
              proactiveBudgetRemaining: Math.max(0, budget.proactiveBudgetMax - budget.proactiveBudgetUsed)
            },
            cooldownApplied: budget.cooldownActive,
            ...(budget.cooldownActive ? { preemptedBy: "cooldown_guard" } : {}),
            recordOnly: phaseJRecordOnly
          }
        }
      : {}),
    ...(phaseJTopicSchedulerEnabled
      ? {
          topicScheduler: buildTopicScheduler({
            topicAction,
            hasTaskIntent,
            hasAddressing,
            highAttention,
            interests: input.interests,
            topicContext: input.topicContext
          })
        }
      : {}),
    ...(groupParticipation ? { groupParticipation } : {})
  };
}

function normalizeBudget(
  value: ConversationControlInput["budgetContext"]
): ConversationControlDecision["budget"] | undefined {
  if (!value) {
    return undefined;
  }
  const turnBudgetMax = Math.max(1, Math.floor(Number(value.turnBudgetMax) || 1));
  const turnBudgetUsed = Math.max(0, Math.floor(Number(value.turnBudgetUsed) || 0));
  const proactiveBudgetMax = Math.max(1, Math.floor(Number(value.proactiveBudgetMax) || 1));
  const proactiveBudgetUsed = Math.max(0, Math.floor(Number(value.proactiveBudgetUsed) || 0));
  const nowMs = Number.isFinite(Number(value.nowMs)) ? Number(value.nowMs) : Date.now();
  const cooldownUntil = Number.isFinite(Number(value.proactiveCooldownUntilMs))
    ? Number(value.proactiveCooldownUntilMs)
    : 0;
  const cooldownRemainingMs = cooldownUntil > nowMs ? Math.max(0, Math.floor(cooldownUntil - nowMs)) : 0;
  return {
    turnBudgetMax,
    turnBudgetUsed,
    turnBudgetRemaining: Math.max(0, turnBudgetMax - turnBudgetUsed),
    proactiveBudgetMax,
    proactiveBudgetUsed,
    proactiveBudgetRemaining: Math.max(0, proactiveBudgetMax - proactiveBudgetUsed),
    degradedByBudget: false,
    cooldownActive: cooldownRemainingMs > 0,
    cooldownRemainingMs,
    budgetReasonCodes: []
  };
}

function degradeTierForBudget(tier: EngagementTier): EngagementTier {
  switch (tier) {
    case "DEEP":
      return "NORMAL";
    case "NORMAL":
      return "LIGHT";
    case "LIGHT":
      return "REACT";
    default:
      return tier;
  }
}

function buildTopicScheduler(params: {
  topicAction: TopicAction;
  hasTaskIntent: boolean;
  hasAddressing: boolean;
  highAttention: boolean;
  interests?: ConversationControlInput["interests"];
  topicContext?: ConversationControlInput["topicContext"];
}): NonNullable<ConversationControlDecision["topicScheduler"]> {
  const activeTopic =
    (params.topicContext?.activeTopic ?? params.interests?.topTopics?.[0] ?? "topic_open").trim().slice(0, 64) ||
    "topic_open";
  const candidateTopics = [
    ...(params.topicContext?.candidateTopics ?? []),
    ...(params.interests?.topTopics ?? [])
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const uniqueCandidates = [...new Set(candidateTopics)];
  const selectedBy: NonNullable<ConversationControlDecision["topicScheduler"]>["selectedBy"] =
    params.topicAction === "clarify"
      ? "clarify"
      : params.topicContext?.selectedBy
        ? params.topicContext.selectedBy
        : params.hasTaskIntent
          ? "task"
          : params.hasAddressing
            ? "addressing"
            : params.highAttention
              ? "interest"
              : "interest";
  return {
    activeTopic,
    candidateTopics: uniqueCandidates,
    queueSnapshot: uniqueCandidates,
    selectedBy,
    starvationBoostApplied: params.topicContext?.starvationBoostApplied === true,
    recycleAction: uniqueCandidates.length >= 8 ? "recycle_oldest" : activeTopic === uniqueCandidates[0] ? "keep_active" : "none",
    ...(typeof params.topicContext?.bridgeFromTopic === "string" && params.topicContext.bridgeFromTopic.trim().length > 0
      ? { bridgeFromTopic: params.topicContext.bridgeFromTopic.trim().slice(0, 64) }
      : {})
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
