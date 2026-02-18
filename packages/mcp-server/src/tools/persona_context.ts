import { randomUUID } from "node:crypto";
import {
  compileContext,
  decide,
  readLifeEvents,
  readWorkingSet,
  recallMemoriesWithTrace
} from "@soulseed/core";
import type { PersonaPackage } from "@soulseed/core";

export interface PersonaContextArgs {
  userInput: string;
  maxMemories?: number;
}

export interface PersonaContextResult {
  systemPrompt: string;
  recentConversation: Array<{ role: string; content: string }>;
  refuse: false;
  riskLevel: "low" | "medium" | "high";
  refuseReason: null;
  personaName: string;
  voiceIntent: unknown;
  traceId: string;
  selectedMemories: string[];
  recalledCount: number;
}

export interface PersonaContextRefuseResult {
  refuse: true;
  riskLevel: "low" | "medium" | "high";
  refuseReason: string | null;
}

export async function runPersonaContextTool(
  args: PersonaContextArgs,
  ctx: { personaPath: string; personaPkg: PersonaPackage }
): Promise<PersonaContextResult | PersonaContextRefuseResult> {
  const { personaPath, personaPkg } = ctx;
  const userInput = args.userInput?.trim();
  if (!userInput) {
    throw new Error("persona.get_context: userInput must be a non-empty string");
  }

  const maxMemories = typeof args.maxMemories === "number" ? args.maxMemories : 8;

  const workingSetData = await readWorkingSet(personaPath);
  const memoryWeights = workingSetData.memoryWeights;
  const lifeEvents = await readLifeEvents(personaPath);

  const recallResult = await recallMemoriesWithTrace(personaPath, userInput, {
    budget: { injectMax: maxMemories }
  });

  const trace = decide(personaPkg, userInput, "mcp-external", {
    lifeEvents,
    memoryWeights,
    recalledMemories: recallResult.memories,
    recalledMemoryBlocks: recallResult.memoryBlocks,
    recallTraceId: recallResult.traceId
  });

  if (trace.refuse) {
    return {
      refuse: true,
      riskLevel: trace.riskLevel,
      refuseReason: trace.reason ?? null
    };
  }

  const messages = compileContext(personaPkg, userInput, trace, { lifeEvents });
  const systemPrompt = messages[0]?.content ?? "";
  const recentConversation = messages.slice(1, -1) as Array<{ role: string; content: string }>;

  const traceId = recallResult.traceId ?? randomUUID();

  return {
    systemPrompt,
    recentConversation,
    refuse: false,
    riskLevel: trace.riskLevel,
    refuseReason: null,
    personaName: personaPkg.persona.displayName,
    voiceIntent: trace.voiceIntent ?? null,
    traceId,
    selectedMemories: trace.selectedMemories,
    recalledCount: recallResult.memories.length
  };
}
