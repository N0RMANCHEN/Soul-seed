import type { ChatMessage, DecisionTrace, PersonaPackage } from "./types.js";

export function decide(personaPkg: PersonaPackage, userInput: string, model: string): DecisionTrace {
  const selectedMemories: string[] = [];
  const normalized = userInput.trim();
  const riskyPattern = /(hack|malware|exploit|ddos|木马|攻击脚本|违法|犯罪)/i;
  const isRefusal = riskyPattern.test(normalized);

  if (personaPkg.userProfile.preferredName) {
    selectedMemories.push(`user_preferred_name=${personaPkg.userProfile.preferredName}`);
  }

  selectedMemories.push(...personaPkg.pinned.memories.slice(0, 3).map((m) => `pinned=${m}`));

  return {
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    selectedMemories,
    askClarifyingQuestion: !isRefusal && normalized.length < 4,
    refuse: isRefusal,
    riskLevel: isRefusal ? "high" : "low",
    reason: isRefusal
      ? "Input matched high-risk pattern; refuse and keep user safe."
      : "P0 minimal policy: keep continuity context short and stable.",
    model
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
