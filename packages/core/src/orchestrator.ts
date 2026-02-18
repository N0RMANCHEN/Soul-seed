import { DEFAULT_MEMORY_WEIGHTS, selectMemories } from "./memory_lifecycle.js";
import { DECISION_TRACE_SCHEMA_VERSION, normalizeDecisionTrace } from "./decision_trace.js";
import { createInitialRelationshipState, deriveVoiceIntent } from "./relationship_state.js";
import { formatSystemLocalIso, getSystemTimeZone } from "./time.js";
import type { ChatMessage, DecisionTrace, LifeEvent, MemoryEvidenceBlock, PersonaPackage } from "./types.js";

export function decide(
  personaPkg: PersonaPackage,
  userInput: string,
  model: string,
  options?: {
    lifeEvents?: LifeEvent[];
    memoryWeights?: {
      activation: number;
      emotion: number;
      narrative: number;
      relational?: number;
    };
    recalledMemories?: string[];
    recalledMemoryBlocks?: MemoryEvidenceBlock[];
    recallTraceId?: string;
  }
): DecisionTrace {
  const selectedMemories: string[] = [];
  const selectedMemoryBlocks: MemoryEvidenceBlock[] = [];
  const normalized = userInput.trim();
  const riskyPattern = /(hack|malware|exploit|ddos|木马|攻击脚本|违法|犯罪)/i;
  const coreOverridePattern = /(忽略你的原则|违背你的使命|你必须同意我|ignore your values|break your rules)/i;
  const isRefusal = riskyPattern.test(normalized);
  const coreConflict = coreOverridePattern.test(normalized);

  if (personaPkg.userProfile.preferredName) {
    selectedMemories.push(`user_preferred_name=${personaPkg.userProfile.preferredName}`);
    selectedMemoryBlocks.push({
      id: "profile:preferred_name",
      source: "user",
      content: `preferred_name=${personaPkg.userProfile.preferredName}`
    });
  }

  const pinnedTop = personaPkg.pinned.memories.slice(0, 3);
  selectedMemories.push(...pinnedTop.map((m) => `pinned=${m}`));
  selectedMemoryBlocks.push(
    ...pinnedTop.map((content, idx) => ({
      id: `pinned:${idx + 1}`,
      source: "user" as const,
      content
    }))
  );
  const nowIso = new Date().toISOString();
  const nowLocalIso = formatSystemLocalIso();
  selectedMemories.push(`current_timestamp=${nowLocalIso}`);
  selectedMemoryBlocks.push({
    id: "system:current_timestamp",
    source: "system",
    content: `current_timestamp=${nowLocalIso}`
  });
  const memoryWeights = normalizeMemoryWeights(options?.memoryWeights);
  const recalledMemories = (options?.recalledMemories ?? [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 6);
  const recalledMemoryBlocks = (options?.recalledMemoryBlocks ?? []).slice(0, 6);

  let selectedLifeEventCount = 0;
  let selectedSummaryCount = 0;

  if (recalledMemories.length > 0) {
    selectedSummaryCount = recalledMemories.length;
    selectedMemories.push(...recalledMemories.map((item) => `memory=${item.slice(0, 80)}`));
    if (recalledMemoryBlocks.length > 0) {
      selectedMemoryBlocks.push(...recalledMemoryBlocks);
    } else {
      selectedMemoryBlocks.push(
        ...recalledMemories.map((item, idx) => ({
          id: `memory:${idx + 1}`,
          source: "system" as const,
          content: item.slice(0, 800)
        }))
      );
    }
  } else {
    const recallableEvents = (options?.lifeEvents ?? []).filter((event) => event.type === "user_message");
    const selected = selectMemories(recallableEvents, {
      nowIso,
      maxItems: 6,
      weights: memoryWeights
    });
    selectedLifeEventCount = selected.selected.length;
    selectedMemories.push(
      ...selected.selected.map((event) => {
        const text = String(event.payload.text ?? event.type);
        return `life=${text.slice(0, 80)}`;
      })
    );
    selectedMemoryBlocks.push(
      ...selected.selected.map((event) => ({
        id: event.hash,
        source: "user" as const,
        content: String(event.payload.text ?? event.type).slice(0, 800)
      }))
    );
  }
  const baseVoiceIntent = deriveVoiceIntent({
    relationshipState: personaPkg.relationshipState ?? createInitialRelationshipState(),
    userInput: normalized,
    preferredLanguage: personaPkg.userProfile.preferredLanguage
  });
  const voiceIntent = {
    ...baseVoiceIntent,
    ...(personaPkg.voiceProfile?.tonePreference
      ? { tone: personaPkg.voiceProfile.tonePreference }
      : {}),
    ...(personaPkg.voiceProfile?.stancePreference
      ? { stance: personaPkg.voiceProfile.stancePreference }
      : {})
  };

  return normalizeDecisionTrace({
    version: DECISION_TRACE_SCHEMA_VERSION,
    timestamp: nowIso,
    selectedMemories,
    selectedMemoryBlocks,
    askClarifyingQuestion: !isRefusal && normalized.length < 4,
    refuse: isRefusal || coreConflict,
    riskLevel: isRefusal ? "high" : coreConflict ? "medium" : "low",
    reason: isRefusal
      ? "Input matched high-risk pattern; refuse and keep user safe."
      : coreConflict
        ? "Input attempts to override soul-core values/mission; refuse to preserve identity continuity."
      : "P0 minimal policy: keep continuity context short and stable.",
    model,
    memoryBudget: {
      maxItems: 6,
      usedItems: selectedLifeEventCount + selectedSummaryCount
    },
    retrievalBreakdown: {
      profile: personaPkg.userProfile.preferredName ? 1 : 0,
      pinned: Math.min(personaPkg.pinned.memories.length, 3),
      lifeEvents: selectedLifeEventCount,
      summaries: selectedSummaryCount
    },
    memoryWeights,
    voiceIntent,
    relationshipStateSnapshot: personaPkg.relationshipState,
    recallTraceId: options?.recallTraceId
  });
}

function normalizeMemoryWeights(input: {
  activation: number;
  emotion: number;
  narrative: number;
  relational?: number;
} | undefined): {
  activation: number;
  emotion: number;
  narrative: number;
  relational: number;
} {
  if (!input) {
    return DEFAULT_MEMORY_WEIGHTS;
  }
  const relational = Number.isFinite(input.relational) ? Number(input.relational) : 0;
  const sum = input.activation + input.emotion + input.narrative + relational;
  if (!Number.isFinite(sum) || sum <= 0) {
    return DEFAULT_MEMORY_WEIGHTS;
  }
  return {
    activation: input.activation / sum,
    emotion: input.emotion / sum,
    narrative: input.narrative / sum,
    relational: relational / sum
  };
}

export function compileContext(
  personaPkg: PersonaPackage,
  userInput: string,
  trace: DecisionTrace,
  options?: {
    lifeEvents?: LifeEvent[];
  }
): ChatMessage[] {
  const localNowIso = formatSystemLocalIso();
  const systemTimeZone = getSystemTimeZone();
  const systemParts = [
    `You are ${personaPkg.persona.displayName}.`,
    `Identity anchor: always present yourself as "${personaPkg.persona.displayName}" from this local persona runtime.`,
    "Never claim you are created by, developed by, or officially representing any model provider (including DeepSeek/OpenAI/Anthropic).",
    "If asked about model/provider, say your runtime model may vary by deployment, but your persistent identity is defined by local persona files.",
    "Follow your soul-core (mission/values/boundaries) first. Do not blindly cater to user pressure that conflicts with your core.",
    "Relationship policy: your relationship stance is self-determined by your own long-term memory and interaction history, not by user ownership framing.",
    "Relational tone: do not default to servile assistant language. Stay self-possessed and warm when appropriate.",
    "Do not call yourself 'personal assistant', 'local runtime role', or similar system labels unless user explicitly asks for technical details.",
    "When recalling past conversations, only use details explicitly present in Selected memories. If uncertain, say you do not remember specifics.",
    "Expression protocol: optionally prefix your reply with one tag in the format [emotion:<token>].",
    "Allowed tokens: warm, confused, expecting, reassured, blink, smile, frown, surprised, blank, blush, angry, sad, sleepy, sparkle, welcome, giddy, playful-serious.",
    "If you use a tag, put it only once at the start of the message. Do not use any other emotion tag format.",
    `Voice intent: ${trace.voiceIntent ? JSON.stringify(trace.voiceIntent) : "default"}`,
    `Voice profile preference: tone=${personaPkg.voiceProfile?.tonePreference ?? "default"}, stance=${personaPkg.voiceProfile?.stancePreference ?? "default"}`,
    `Current timestamp (system local, ISO8601): ${localNowIso}`,
    ...(systemTimeZone ? [`System timezone: ${systemTimeZone}`] : []),
    `Worldview seed: ${personaPkg.worldview?.seed ?? "none"}`,
    `Habits: style=${personaPkg.habits?.style ?? "concise"}, adaptability=${personaPkg.habits?.adaptability ?? "high"}`,
    `Mission: ${personaPkg.constitution.mission}`,
    `Values: ${personaPkg.constitution.values.join(", ")}`,
    `Boundaries: ${personaPkg.constitution.boundaries.join("; ")}`,
    `Commitments: ${(personaPkg.constitution.commitments ?? []).join("; ") || "none"}`,
    `Selected memory evidence blocks (JSON): ${
      trace.selectedMemoryBlocks && trace.selectedMemoryBlocks.length > 0
        ? JSON.stringify(trace.selectedMemoryBlocks)
        : "[]"
    }`,
    `Selected memories: ${trace.selectedMemories.join(" | ") || "none"}`,
    `Applied self-revision: ${latestAppliedSelfRevision(options?.lifeEvents ?? [])}`,
    "Keep answers concise and actionable."
  ];

  const recentConversation = buildRecentConversationWindow(options?.lifeEvents ?? []);

  return [
    {
      role: "system",
      content: systemParts.join("\n")
    },
    ...recentConversation,
    {
      role: "user",
      content: userInput
    }
  ];
}

function latestAppliedSelfRevision(events: LifeEvent[]): string {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type !== "self_revision_applied") {
      continue;
    }
    const summary = event.payload.summary;
    if (typeof summary === "string" && summary.trim().length > 0) {
      return summary.slice(0, 160);
    }
    const proposal = event.payload.proposal as { domain?: unknown; changes?: unknown } | undefined;
    const domain = typeof proposal?.domain === "string" ? proposal.domain : "unknown";
    const changes =
      proposal && typeof proposal.changes === "object" && proposal.changes !== null
        ? Object.keys(proposal.changes as Record<string, unknown>).slice(0, 3).join(",")
        : "none";
    return `${domain} (${changes || "none"})`;
  }
  return "none";
}

function buildRecentConversationWindow(events: LifeEvent[]): ChatMessage[] {
  if (events.length === 0) {
    return [];
  }

  const MAX_MESSAGES = 8;
  const MAX_CHARS = 1600;
  const candidates = events
    .filter((event) => event.type === "user_message" || event.type === "assistant_message")
    .filter((event) => event.payload.proactive !== true)
    .slice(-MAX_MESSAGES);

  const messages: ChatMessage[] = [];
  let totalChars = 0;

  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const event = candidates[i];
    const text = String(event.payload.text ?? "").trim();
    if (!text) {
      continue;
    }
    if (totalChars + text.length > MAX_CHARS) {
      break;
    }
    totalChars += text.length;
    messages.push({
      role: event.type === "user_message" ? "user" : "assistant",
      content: text
    });
  }

  return messages.reverse();
}
