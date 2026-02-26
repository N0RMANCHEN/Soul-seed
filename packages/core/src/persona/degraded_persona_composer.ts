import type { RelationshipState } from "../types.js";
import { runSafetyFallbackGateway } from "../runtime/safety_fallback_gateway.js";

type DegradedMode = "greeting" | "proactive" | "farewell" | "exit_confirm" | "reply";

export interface DegradedPersonaComposerInput {
  mode: DegradedMode;
  relationshipState?: RelationshipState;
  lastUserInput?: string;
  lastAssistantOutput?: string;
  temporalHint?: "just_now" | "earlier";
}

function cleanSeed(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 36);
}

function byRelationship(
  relationshipState: RelationshipState | undefined
): "neutral" | "peer" | "intimate" {
  const state = relationshipState?.state;
  if (state === "intimate") return "intimate";
  if (state === "peer") return "peer";
  return "neutral";
}

export function composeDegradedPersonaReply(input: DegradedPersonaComposerInput): string {
  const relationship = byRelationship(input.relationshipState);
  const temporal = input.temporalHint === "just_now" ? "刚才" : "之前";
  const seed = cleanSeed(input.lastUserInput ?? "");
  const assistantSeed = cleanSeed(input.lastAssistantOutput ?? "");

  if (input.mode === "farewell") {
    if (relationship === "intimate") {
      return "好，我先安静在这。你回来我就接上。";
    }
    return "好，我先在这等你。你回来我们继续。";
  }

  if (input.mode === "exit_confirm") {
    return "你要是想先离开，我会在这等你。回复“确认退出”我就先安静退下；想继续就说“继续”。";
  }

  if (input.mode === "greeting") {
    if (relationship === "peer") {
      return seed ? `我在。${temporal}你提到“${seed}”，我们直接接着走。` : "我在。你想先推进哪一段？";
    }
    if (relationship === "intimate") {
      return seed ? `我在呢。${temporal}那件“${seed}”我们慢慢接上。` : "我在呢。你想从哪一小段开始，我陪你。";
    }
    return seed ? `我在。${temporal}你说的“${seed}”，我们继续。` : "我在。你现在最想聊哪一点？";
  }

  if (input.mode === "proactive") {
    if (relationship === "intimate") {
      return seed ? `我想到你${temporal}说的“${seed}”，想先接住这件事。` : "我想主动问一句，你现在最在意的是哪件事？";
    }
    return seed ? `我刚整理了你${temporal}提到的“${seed}”，要不要我继续展开？` : "我在，想继续的话我可以给你下一步。";
  }

  const fallback = seed
    ? `我先接住你${temporal}提到的“${seed}”，我们从这接。`
    : assistantSeed
      ? `我们就从${temporal}那段继续往下走。`
      : "我们从这接。";
  return runSafetyFallbackGateway({
    stage: input.mode,
    text: fallback,
    reason: "degraded_persona_path"
  }).text;
}
