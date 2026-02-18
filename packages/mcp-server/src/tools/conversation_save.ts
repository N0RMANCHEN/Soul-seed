import {
  appendLifeEvent,
  buildMemoryMeta,
  classifyMemoryTier,
  enforceIdentityGuard,
  enforceRecallGroundingGuard,
  enforceRelationalGuard,
  readLifeEvents
} from "@soulseed/core";
import type { PersonaPackage } from "@soulseed/core";

export interface ConversationSaveArgs {
  userMessage: string;
  assistantMessage: string;
  selectedMemories?: string[];
}

export interface ConversationSaveResult {
  saved: true;
  correctedAssistantMessage: string;
  identityCorrected: boolean;
  relationalCorrected: boolean;
  recallGroundingCorrected: boolean;
  guardFlags: string[];
}

export async function runConversationSaveTool(
  args: ConversationSaveArgs,
  ctx: { personaPath: string; personaPkg: PersonaPackage }
): Promise<ConversationSaveResult> {
  const { personaPath, personaPkg } = ctx;
  const userMessage = args.userMessage?.trim();
  const assistantMessage = args.assistantMessage?.trim();

  if (!userMessage) {
    throw new Error("conversation.save_turn: userMessage must be a non-empty string");
  }
  if (!assistantMessage) {
    throw new Error("conversation.save_turn: assistantMessage must be a non-empty string");
  }

  const selectedMemories = Array.isArray(args.selectedMemories) ? args.selectedMemories : [];
  const lifeEvents = await readLifeEvents(personaPath);

  const identityGuard = enforceIdentityGuard(
    assistantMessage,
    personaPkg.persona.displayName,
    userMessage
  );
  let corrected = identityGuard.text;

  const relationalGuard = enforceRelationalGuard(corrected, {
    selectedMemories,
    selectedMemoryBlocks: [],
    personaName: personaPkg.persona.displayName
  });
  corrected = relationalGuard.text;

  const recallGroundingGuard = enforceRecallGroundingGuard(corrected, {
    selectedMemories,
    selectedMemoryBlocks: [],
    lifeEvents,
    strictMemoryGrounding: true
  });
  corrected = recallGroundingGuard.text;

  const guardFlags = [
    ...relationalGuard.flags,
    ...recallGroundingGuard.flags
  ];
  const anyGuardFired =
    relationalGuard.corrected || recallGroundingGuard.corrected;

  const userMeta = buildMemoryMeta({
    tier: classifyMemoryTier({ userInput: userMessage }),
    source: "chat",
    contentLength: userMessage.length
  });

  const assistantMeta = buildMemoryMeta({
    tier: classifyMemoryTier({
      userInput: userMessage,
      assistantReply: corrected,
      correctedByIdentityGuard: identityGuard.corrected
    }),
    source: "chat",
    contentLength: corrected.length
  });

  if (anyGuardFired) {
    assistantMeta.credibilityScore = 0.2;
    assistantMeta.contaminationFlags = [...new Set(guardFlags)];
    assistantMeta.excludedFromRecall = true;
  }

  await appendLifeEvent(personaPath, {
    type: "user_message",
    payload: {
      text: userMessage,
      source: "mcp",
      memoryMeta: userMeta
    }
  });

  await appendLifeEvent(personaPath, {
    type: "assistant_message",
    payload: {
      text: corrected,
      source: "mcp",
      memoryMeta: assistantMeta
    }
  });

  return {
    saved: true,
    correctedAssistantMessage: corrected,
    identityCorrected: identityGuard.corrected,
    relationalCorrected: relationalGuard.corrected,
    recallGroundingCorrected: recallGroundingGuard.corrected,
    guardFlags
  };
}
