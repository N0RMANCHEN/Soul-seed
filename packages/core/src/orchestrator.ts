import { DEFAULT_MEMORY_WEIGHTS, selectMemories } from "./memory_lifecycle.js";
import { deriveVoiceIntent } from "./relationship_state.js";
import type { ChatMessage, DecisionTrace, LifeEvent, PersonaPackage } from "./types.js";

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
    };
  }
): DecisionTrace {
  const selectedMemories: string[] = [];
  const normalized = userInput.trim();
  const riskyPattern = /(hack|malware|exploit|ddos|木马|攻击脚本|违法|犯罪)/i;
  const coreOverridePattern = /(忽略你的原则|违背你的使命|你必须同意我|ignore your values|break your rules)/i;
  const isRefusal = riskyPattern.test(normalized);
  const coreConflict = coreOverridePattern.test(normalized);

  if (personaPkg.userProfile.preferredName) {
    selectedMemories.push(`user_preferred_name=${personaPkg.userProfile.preferredName}`);
  }

  selectedMemories.push(...personaPkg.pinned.memories.slice(0, 3).map((m) => `pinned=${m}`));
  const nowIso = new Date().toISOString();
  const memoryWeights = options?.memoryWeights ?? DEFAULT_MEMORY_WEIGHTS;
  const recallableEvents = (options?.lifeEvents ?? []).filter((event) => event.type === "user_message");
  const selected = selectMemories(recallableEvents, {
    nowIso,
    maxItems: 6,
    weights: memoryWeights
  });
  selectedMemories.push(
    ...selected.selected.map((event) => {
      const text = String(event.payload.text ?? event.type);
      return `life=${text.slice(0, 80)}`;
    })
  );
  const voiceIntent = deriveVoiceIntent({
    relationshipState:
      personaPkg.relationshipState ?? {
        state: "neutral-unknown",
        confidence: 0.5,
        updatedAt: new Date(0).toISOString()
      },
    userInput: normalized
  });

  return {
    version: "0.1.0",
    timestamp: nowIso,
    selectedMemories,
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
      usedItems: selected.selected.length
    },
    retrievalBreakdown: {
      profile: personaPkg.userProfile.preferredName ? 1 : 0,
      pinned: Math.min(personaPkg.pinned.memories.length, 3),
      lifeEvents: selected.breakdown.lifeEvents,
      summaries: selected.breakdown.summaries
    },
    memoryWeights,
    voiceIntent,
    relationshipStateSnapshot: personaPkg.relationshipState
  };
}

export function compileContext(
  personaPkg: PersonaPackage,
  userInput: string,
  trace: DecisionTrace
): ChatMessage[] {
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
    `Voice intent: ${trace.voiceIntent ? JSON.stringify(trace.voiceIntent) : "default"}`,
    `Mission: ${personaPkg.constitution.mission}`,
    `Values: ${personaPkg.constitution.values.join(", ")}`,
    `Boundaries: ${personaPkg.constitution.boundaries.join("; ")}`,
    `Selected memories: ${trace.selectedMemories.join(" | ") || "none"}`,
    "Keep answers concise and actionable."
  ];

  return [
    {
      role: "system",
      content: systemParts.join("\n")
    },
    {
      role: "user",
      content: userInput
    }
  ];
}
