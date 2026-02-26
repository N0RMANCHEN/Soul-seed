import type { DecisionTrace, McpCallRecord } from "../types.js";

export const DECISION_TRACE_SCHEMA_VERSION = "1.0";
const LEGACY_DECISION_TRACE_VERSION = "0.1.0";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStringArray(value: unknown, maxItems = 64): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeSelectedMemoryBlocks(value: unknown): DecisionTrace["selectedMemoryBlocks"] {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const blocks = value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }
      const id = typeof item.id === "string" ? item.id.trim() : "";
      const source = item.source;
      const content = typeof item.content === "string" ? item.content.trim() : "";
      const validSource = source === "user" || source === "assistant" || source === "system";
      if (!id || !validSource || !content) {
        return null;
      }
      return { id, source: source as "user" | "assistant" | "system", content };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .slice(0, 64);

  return blocks.length > 0 ? blocks : undefined;
}

function normalizeRiskLevel(value: unknown): "low" | "medium" | "high" {
  if (value === "medium" || value === "high") {
    return value;
  }
  return "low";
}

function normalizeMemoryBudget(
  value: unknown
): DecisionTrace["memoryBudget"] {
  if (!isRecord(value)) {
    return undefined;
  }
  const maxItems = Number(value.maxItems);
  const usedItems = Number(value.usedItems);
  if (!Number.isFinite(maxItems) || !Number.isFinite(usedItems)) {
    return undefined;
  }
  return {
    maxItems: Math.max(0, Math.floor(maxItems)),
    usedItems: Math.max(0, Math.floor(usedItems))
  };
}

function normalizeRetrievalBreakdown(
  value: unknown
): DecisionTrace["retrievalBreakdown"] {
  if (!isRecord(value)) {
    return undefined;
  }
  const profile = Number(value.profile);
  const pinned = Number(value.pinned);
  const lifeEvents = Number(value.lifeEvents);
  const summaries = Number(value.summaries);
  if (
    !Number.isFinite(profile) ||
    !Number.isFinite(pinned) ||
    !Number.isFinite(lifeEvents) ||
    !Number.isFinite(summaries)
  ) {
    return undefined;
  }
  return {
    profile: Math.max(0, Math.floor(profile)),
    pinned: Math.max(0, Math.floor(pinned)),
    lifeEvents: Math.max(0, Math.floor(lifeEvents)),
    summaries: Math.max(0, Math.floor(summaries))
  };
}

function normalizeMemoryWeights(
  value: unknown
): DecisionTrace["memoryWeights"] {
  if (!isRecord(value)) {
    return undefined;
  }
  const activation = Number(value.activation);
  const emotion = Number(value.emotion);
  const narrative = Number(value.narrative);
  const relationalRaw = value.relational;
  const relational = Number.isFinite(Number(relationalRaw)) ? Number(relationalRaw) : 0;
  if (!Number.isFinite(activation) || !Number.isFinite(emotion) || !Number.isFinite(narrative)) {
    return undefined;
  }
  const total = activation + emotion + narrative + relational;
  if (total <= 0) {
    return undefined;
  }
  return {
    activation: activation / total,
    emotion: emotion / total,
    narrative: narrative / total,
    relational: relational / total
  };
}

function normalizeMcpCall(value: unknown): DecisionTrace["mcpCall"] {
  if (!isRecord(value)) return undefined;
  const toolName = typeof value.toolName === "string" ? value.toolName : "";
  const callId = typeof value.callId === "string" ? value.callId : "";
  if (!toolName || !callId) return undefined;
  const snap = isRecord(value.budgetSnapshot)
    ? {
        cost: Math.max(0, Number(value.budgetSnapshot.cost) || 0),
        sessionCallCount: Math.max(0, Math.floor(Number(value.budgetSnapshot.sessionCallCount) || 0)),
        sessionMax: Math.max(1, Math.floor(Number(value.budgetSnapshot.sessionMax) || 1))
      }
    : { cost: 0, sessionCallCount: 0, sessionMax: 1 };
  return {
    toolName,
    callId,
    approvalReason: typeof value.approvalReason === "string" ? value.approvalReason : "",
    budgetSnapshot: snap
  } satisfies McpCallRecord;
}

function normalizeVoiceIntent(value: unknown): DecisionTrace["voiceIntent"] {
  if (!isRecord(value)) {
    return undefined;
  }
  const stance = value.stance;
  const tone = value.tone;
  const serviceMode = value.serviceMode;
  const language = value.language;
  const validStance =
    stance === "friend" || stance === "peer" || stance === "intimate" || stance === "neutral";
  const validTone =
    tone === "warm" || tone === "plain" || tone === "reflective" || tone === "direct";
  const validLanguage = language === "zh" || language === "en" || language === "mixed";
  if (!validStance || !validTone || serviceMode !== false || !validLanguage) {
    return undefined;
  }
  return {
    stance,
    tone,
    serviceMode,
    language
  };
}

function normalizeConversationControl(value: unknown): DecisionTrace["conversationControl"] {
  if (!isRecord(value)) {
    return undefined;
  }
  const engagementTier = value.engagementTier;
  const topicAction = value.topicAction;
  const responsePolicy = value.responsePolicy;
  const validTier =
    engagementTier === "IGNORE" ||
    engagementTier === "REACT" ||
    engagementTier === "LIGHT" ||
    engagementTier === "NORMAL" ||
    engagementTier === "DEEP";
  const validTopicAction = topicAction === "maintain" || topicAction === "clarify" || topicAction === "switch";
  const validResponsePolicy =
    responsePolicy === "safety_refusal" ||
    responsePolicy === "minimal_ack" ||
    responsePolicy === "reactive_brief" ||
    responsePolicy === "light_response" ||
    responsePolicy === "normal_response" ||
    responsePolicy === "deep_response";
  if (!validTier || !validTopicAction || !validResponsePolicy) {
    return undefined;
  }
  const groupParticipation = normalizeGroupParticipation(value.groupParticipation);
  const budget = normalizeControlBudget(value.budget);
  const topicScheduler = normalizeTopicScheduler(value.topicScheduler);
  const engagementPolicyVersion =
    typeof value.engagementPolicyVersion === "string" && value.engagementPolicyVersion.trim().length > 0
      ? value.engagementPolicyVersion.trim().slice(0, 32)
      : undefined;
  const phaseJMode =
    value.phaseJMode === "enabled" || value.phaseJMode === "record_only" || value.phaseJMode === "disabled"
      ? value.phaseJMode
      : undefined;
  const engagementTrace = normalizeEngagementTrace(value.engagementTrace);
  return {
    engagementTier,
    topicAction,
    responsePolicy,
    reasonCodes: normalizeStringArray(value.reasonCodes, 16),
    ...(engagementPolicyVersion ? { engagementPolicyVersion } : {}),
    ...(phaseJMode ? { phaseJMode } : {}),
    ...(budget ? { budget } : {}),
    ...(engagementTrace ? { engagementTrace } : {}),
    ...(topicScheduler ? { topicScheduler } : {}),
    ...(groupParticipation ? { groupParticipation } : {})
  };
}

function normalizeControlBudget(
  value: unknown
): NonNullable<DecisionTrace["conversationControl"]>["budget"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const turnBudgetMax = Number(value.turnBudgetMax);
  const turnBudgetUsed = Number(value.turnBudgetUsed);
  const proactiveBudgetMax = Number(value.proactiveBudgetMax);
  const proactiveBudgetUsed = Number(value.proactiveBudgetUsed);
  const turnBudgetRemainingRaw = Number(value.turnBudgetRemaining);
  const proactiveBudgetRemainingRaw = Number(value.proactiveBudgetRemaining);
  const cooldownRemainingMsRaw = Number(value.cooldownRemainingMs);
  if (
    !Number.isFinite(turnBudgetMax) ||
    !Number.isFinite(turnBudgetUsed) ||
    !Number.isFinite(proactiveBudgetMax) ||
    !Number.isFinite(proactiveBudgetUsed)
  ) {
    return undefined;
  }
  const turnBudgetRemaining = Number.isFinite(turnBudgetRemainingRaw)
    ? turnBudgetRemainingRaw
    : Math.max(0, Math.floor(turnBudgetMax) - Math.floor(turnBudgetUsed));
  const proactiveBudgetRemaining = Number.isFinite(proactiveBudgetRemainingRaw)
    ? proactiveBudgetRemainingRaw
    : Math.max(0, Math.floor(proactiveBudgetMax) - Math.floor(proactiveBudgetUsed));
  const cooldownRemainingMs = Number.isFinite(cooldownRemainingMsRaw) ? cooldownRemainingMsRaw : 0;
  return {
    turnBudgetMax: Math.max(1, Math.floor(turnBudgetMax)),
    turnBudgetUsed: Math.max(0, Math.floor(turnBudgetUsed)),
    turnBudgetRemaining: Math.max(0, Math.floor(turnBudgetRemaining)),
    proactiveBudgetMax: Math.max(1, Math.floor(proactiveBudgetMax)),
    proactiveBudgetUsed: Math.max(0, Math.floor(proactiveBudgetUsed)),
    proactiveBudgetRemaining: Math.max(0, Math.floor(proactiveBudgetRemaining)),
    degradedByBudget: value.degradedByBudget === true,
    cooldownActive: value.cooldownActive === true,
    cooldownRemainingMs: Math.max(0, Math.floor(cooldownRemainingMs)),
    budgetReasonCodes: normalizeStringArray(value.budgetReasonCodes, 16)
  };
}

function normalizeEngagementTrace(
  value: unknown
): NonNullable<DecisionTrace["conversationControl"]>["engagementTrace"] | undefined {
  if (!isRecord(value)) return undefined;
  const triggerType = value.triggerType;
  const validTriggerType =
    triggerType === "reply" || triggerType === "proactive" || triggerType === "followup" || triggerType === "closure";
  const triggerReason =
    typeof value.triggerReason === "string" && value.triggerReason.trim().length > 0
      ? value.triggerReason.trim().slice(0, 80)
      : "";
  if (!validTriggerType || !triggerReason || !isRecord(value.budgetBefore) || !isRecord(value.budgetAfter)) {
    return undefined;
  }
  const beforeTurn = Number(value.budgetBefore.turnBudgetRemaining);
  const beforeProactive = Number(value.budgetBefore.proactiveBudgetRemaining);
  const afterTurn = Number(value.budgetAfter.turnBudgetRemaining);
  const afterProactive = Number(value.budgetAfter.proactiveBudgetRemaining);
  if (!Number.isFinite(beforeTurn) || !Number.isFinite(beforeProactive) || !Number.isFinite(afterTurn) || !Number.isFinite(afterProactive)) {
    return undefined;
  }
  const preemptedBy = typeof value.preemptedBy === "string" ? value.preemptedBy.trim().slice(0, 64) : "";
  return {
    triggerType,
    triggerReason,
    budgetBefore: {
      turnBudgetRemaining: Math.max(0, Math.floor(beforeTurn)),
      proactiveBudgetRemaining: Math.max(0, Math.floor(beforeProactive))
    },
    budgetAfter: {
      turnBudgetRemaining: Math.max(0, Math.floor(afterTurn)),
      proactiveBudgetRemaining: Math.max(0, Math.floor(afterProactive))
    },
    cooldownApplied: value.cooldownApplied === true,
    ...(preemptedBy ? { preemptedBy } : {}),
    recordOnly: value.recordOnly === true
  };
}

function normalizeTopicScheduler(
  value: unknown
): NonNullable<DecisionTrace["conversationControl"]>["topicScheduler"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const activeTopic = typeof value.activeTopic === "string" ? value.activeTopic.trim().slice(0, 64) : "";
  const selectedBy = value.selectedBy;
  const validSelectedBy =
    selectedBy === "addressing" ||
    selectedBy === "task" ||
    selectedBy === "interest" ||
    selectedBy === "clarify" ||
    selectedBy === "active" ||
    selectedBy === "starvation_boost";
  if (!activeTopic || !validSelectedBy) {
    return undefined;
  }
  const bridgeFromTopic = typeof value.bridgeFromTopic === "string" ? value.bridgeFromTopic.trim().slice(0, 64) : "";
  const recycleAction =
    value.recycleAction === "none" || value.recycleAction === "keep_active" || value.recycleAction === "recycle_oldest"
      ? value.recycleAction
      : undefined;
  return {
    activeTopic,
    candidateTopics: normalizeStringArray(value.candidateTopics, 8),
    queueSnapshot: normalizeStringArray(value.queueSnapshot, 8),
    selectedBy,
    starvationBoostApplied: value.starvationBoostApplied === true,
    ...(bridgeFromTopic ? { bridgeFromTopic } : {}),
    ...(recycleAction ? { recycleAction } : {})
  };
}

function normalizeGroupParticipation(
  value: unknown
): NonNullable<DecisionTrace["conversationControl"]>["groupParticipation"] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const mode = value.mode;
  if (mode !== "speak" && mode !== "wait" && mode !== "brief_ack") {
    return undefined;
  }
  const score = Number(value.score);
  if (!Number.isFinite(score)) {
    return undefined;
  }
  const consecutiveAssistantTurns = Math.max(0, Math.floor(Number(value.consecutiveAssistantTurns) || 0));
  return {
    mode,
    score: Math.max(0, Math.min(1, score)),
    isGroupChat: value.isGroupChat === true,
    addressedToAssistant: value.addressedToAssistant === true,
    cooldownHit: value.cooldownHit === true,
    consecutiveAssistantTurns,
    reasonCodes: normalizeStringArray(value.reasonCodes, 16)
  };
}

function normalizeExecutionMode(value: unknown): DecisionTrace["executionMode"] {
  return value === "agent" || value === "soul" ? value : undefined;
}

function normalizeReasoningDepth(value: unknown): DecisionTrace["reasoningDepth"] {
  return value === "fast" || value === "deep" ? value : undefined;
}

function normalizeConsistencyVerdict(value: unknown): DecisionTrace["consistencyVerdict"] {
  return value === "allow" || value === "rewrite" || value === "reject" ? value : undefined;
}

function normalizeRouteDecision(value: unknown): DecisionTrace["routeDecision"] {
  return value === "instinct" || value === "deliberative" ? value : undefined;
}

function normalizeRouteTag(value: unknown): DecisionTrace["routeTag"] {
  return value === "instinct" || value === "deliberative" || value === "meta" ? value : undefined;
}

function normalizeRouting(value: unknown): DecisionTrace["routing"] {
  if (!isRecord(value)) return undefined;
  const tier = value.tier;
  if (tier !== "L1" && tier !== "L2" && tier !== "L3" && tier !== "L4") {
    return undefined;
  }
  const fallbackReason =
    typeof value.fallbackReason === "string" && value.fallbackReason.trim()
      ? value.fallbackReason.trim()
      : undefined;
  return {
    tier,
    reasonCodes: normalizeStringArray(value.reasonCodes, 16),
    isBusinessPath: value.isBusinessPath !== false,
    fallbackReason,
    arbitrationTriggered: value.arbitrationTriggered === true
  };
}

function normalizePositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.floor(parsed));
}

function normalizeRecallBudgetPolicy(value: unknown): DecisionTrace["recallBudgetPolicy"] {
  if (!isRecord(value)) return undefined;
  const profile = typeof value.profile === "string" && value.profile.trim() ? value.profile.trim() : "";
  if (!profile) return undefined;
  return {
    profile,
    reasonCodes: normalizeStringArray(value.reasonCodes, 16)
  };
}

function normalizeLatencyBreakdown(value: unknown): DecisionTrace["latencyBreakdown"] {
  if (!isRecord(value)) return undefined;
  const stages = ["routing", "recall", "planning", "llm_primary", "llm_meta", "guard", "rewrite", "emit"] as const;
  const result: Record<string, number> = {};
  for (const stage of stages) {
    const n = Number(value[stage]);
    if (Number.isFinite(n) && n >= 0) {
      result[stage] = Math.round(n);
    }
  }
  return Object.keys(result).length > 0 ? (result as DecisionTrace["latencyBreakdown"]) : undefined;
}

export function isDecisionTraceVersionCompatible(version: unknown): boolean {
  return version === DECISION_TRACE_SCHEMA_VERSION || version === LEGACY_DECISION_TRACE_VERSION;
}

export function normalizeDecisionTrace(input: unknown): DecisionTrace {
  if (!isRecord(input)) {
    throw new Error("DecisionTrace must be an object");
  }

  const version = input.version;
  if (!isDecisionTraceVersionCompatible(version)) {
    throw new Error(`Unsupported DecisionTrace version: ${String(version)}`);
  }

  const timestampRaw = input.timestamp;
  const timestamp =
    typeof timestampRaw === "string" && Number.isFinite(Date.parse(timestampRaw))
      ? timestampRaw
      : new Date().toISOString();

  const reason = typeof input.reason === "string" ? input.reason : "no reason";
  const model = typeof input.model === "string" ? input.model : "unknown";

  const normalized: DecisionTrace = {
    version: DECISION_TRACE_SCHEMA_VERSION,
    timestamp,
    selectedMemories: normalizeStringArray(input.selectedMemories, 64),
    selectedMemoryBlocks: normalizeSelectedMemoryBlocks(input.selectedMemoryBlocks),
    askClarifyingQuestion: input.askClarifyingQuestion === true,
    refuse: input.refuse === true,
    riskLevel: normalizeRiskLevel(input.riskLevel),
    reason,
    model,
    memoryBudget: normalizeMemoryBudget(input.memoryBudget),
    retrievalBreakdown: normalizeRetrievalBreakdown(input.retrievalBreakdown),
    memoryWeights: normalizeMemoryWeights(input.memoryWeights),
    voiceIntent: normalizeVoiceIntent(input.voiceIntent),
    conversationControl: normalizeConversationControl(input.conversationControl),
    relationshipStateSnapshot: isRecord(input.relationshipStateSnapshot)
      ? (input.relationshipStateSnapshot as unknown as DecisionTrace["relationshipStateSnapshot"])
      : undefined,
    recallTraceId: typeof input.recallTraceId === "string" ? input.recallTraceId : undefined,
    mcpCall: normalizeMcpCall(input.mcpCall),
    metaTraceId: typeof input.metaTraceId === "string" ? input.metaTraceId : undefined,
    executionMode: normalizeExecutionMode(input.executionMode),
    goalId: typeof input.goalId === "string" ? input.goalId : undefined,
    stepId: typeof input.stepId === "string" ? input.stepId : undefined,
    planVersion: normalizePositiveInteger(input.planVersion),
    consistencyVerdict: normalizeConsistencyVerdict(input.consistencyVerdict),
    consistencyRuleHits: normalizeStringArray(input.consistencyRuleHits, 24),
    consistencyTraceId: typeof input.consistencyTraceId === "string" ? input.consistencyTraceId : undefined,
    routeDecision: normalizeRouteDecision(input.routeDecision),
    routeReasonCodes: normalizeStringArray(input.routeReasonCodes, 16),
    routing: normalizeRouting(input.routing),
    reasoningDepth: normalizeReasoningDepth(input.reasoningDepth),
    l3Triggered: input.l3Triggered === true,
    l3TriggerReason: typeof input.l3TriggerReason === "string" && input.l3TriggerReason.trim()
      ? input.l3TriggerReason.trim()
      : undefined,
    routeTag: normalizeRouteTag(input.routeTag),
    modelUsed: typeof input.modelUsed === "string" && input.modelUsed.trim() ? input.modelUsed.trim() : undefined,
    agentRequest: normalizeAgentRequest(input.agentRequest),
    soulTraceId: typeof input.soulTraceId === "string" && input.soulTraceId ? input.soulTraceId : undefined,
    recallBudgetPolicy: normalizeRecallBudgetPolicy(input.recallBudgetPolicy),
    riskLatent: normalizeRiskLatent(input.riskLatent),
    riskAssessmentPath: (input.riskAssessmentPath === "semantic" || input.riskAssessmentPath === "regex_fallback")
      ? input.riskAssessmentPath
      : undefined,
    coreConflictMode: input.coreConflictMode === "explicit_only" ? "explicit_only" : undefined,
    implicitCoreTension: input.implicitCoreTension === true,
    latencyBreakdown: normalizeLatencyBreakdown(input.latencyBreakdown),
    latencyTotalMs: normalizePositiveInteger(input.latencyTotalMs)
  };

  return normalized;
}

function normalizeRiskLatent(raw: unknown): [number, number, number] | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const clamp = (v: unknown) => Math.max(0, Math.min(1, Number(v) || 0));
  return [clamp(raw[0]), clamp(raw[1]), clamp(raw[2])];
}

function normalizeAgentRequest(raw: unknown): DecisionTrace["agentRequest"] {
  if (!isRecord(raw)) return undefined;
  const agentTypes = ["retrieval", "transform", "capture", "action"] as const;
  const riskLevels = ["low", "medium", "high"] as const;
  return {
    needed: raw.needed === true,
    agentType: (agentTypes as readonly unknown[]).includes(raw.agentType)
      ? (raw.agentType as "retrieval" | "transform" | "capture" | "action")
      : "retrieval",
    riskLevel: (riskLevels as readonly unknown[]).includes(raw.riskLevel)
      ? (raw.riskLevel as "low" | "medium" | "high")
      : "low",
    requiresConfirmation: raw.requiresConfirmation === true
  };
}
