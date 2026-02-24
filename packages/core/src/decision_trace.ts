import type { DecisionTrace, McpCallRecord } from "./types.js";

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
  return {
    engagementTier,
    topicAction,
    responsePolicy,
    reasonCodes: normalizeStringArray(value.reasonCodes, 16)
  };
}

function normalizeExecutionMode(value: unknown): DecisionTrace["executionMode"] {
  return value === "agent" || value === "soul" ? value : undefined;
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

function normalizePositiveInteger(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return Math.max(0, Math.floor(parsed));
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
    routeTag: normalizeRouteTag(input.routeTag),
    modelUsed: typeof input.modelUsed === "string" && input.modelUsed.trim() ? input.modelUsed.trim() : undefined,
    agentRequest: normalizeAgentRequest(input.agentRequest),
    soulTraceId: typeof input.soulTraceId === "string" && input.soulTraceId ? input.soulTraceId : undefined,
    riskLatent: normalizeRiskLatent(input.riskLatent),
    riskAssessmentPath: (input.riskAssessmentPath === "semantic" || input.riskAssessmentPath === "regex_fallback")
      ? input.riskAssessmentPath
      : undefined
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
