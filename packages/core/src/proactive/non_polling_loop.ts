import type { RelationshipState } from "../types.js";
import { createInitialRelationshipState, deriveCognitiveBalanceFromLibido } from "../state/relationship_state.js";

export type LoopSignal =
  | "session_start"
  | "user_turn_committed"
  | "assistant_turn_committed"
  | "proactive_decision_miss"
  | "proactive_message_emitted";

export interface NonPollingLoopInput {
  signal: LoopSignal;
  nowMs: number;
  lastUserAtMs: number;
  lastAssistantAtMs: number;
  hasUserSpokenThisSession: boolean;
  proactiveCooldownUntilMs: number;
  lastUserInput: string;
  curiosity: number;
  relationshipState?: RelationshipState;
}

export interface NonPollingWakePlan {
  shouldArm: boolean;
  delayMs: number;
  gateReason: string;
}

export function deriveNonPollingWakePlan(input: NonPollingLoopInput): NonPollingWakePlan {
  if (!input.hasUserSpokenThisSession) {
    return { shouldArm: false, delayMs: 0, gateReason: "no_user_turn_yet" };
  }
  if (isLikelyUnfinishedThought(input.lastUserInput) && input.nowMs - input.lastUserAtMs < 90_000) {
    return { shouldArm: false, delayMs: 0, gateReason: "unfinished_user_thought" };
  }

  const relationship = input.relationshipState ?? createInitialRelationshipState();
  const silenceMin = Math.max(0, (input.nowMs - Math.max(input.lastUserAtMs, input.lastAssistantAtMs)) / 60_000);
  const talkativeBias = Math.max(0, Math.min(0.35, input.curiosity * 0.25 + relationship.dimensions.intimacy * 0.1));
  const arousalDelayMultiplier = getArousalDelayMultiplier(relationship);

  let minDelayMs = 18_000;
  let maxDelayMs = 90_000;
  if (silenceMin >= 2 && silenceMin < 8) {
    minDelayMs = 35_000;
    maxDelayMs = 130_000;
  } else if (silenceMin >= 8 && silenceMin < 25) {
    minDelayMs = 70_000;
    maxDelayMs = 260_000;
  } else if (silenceMin >= 25) {
    minDelayMs = 120_000;
    maxDelayMs = 520_000;
  }

  minDelayMs = Math.max(8_000, Math.floor(minDelayMs * (1 - talkativeBias)));
  maxDelayMs = Math.max(minDelayMs + 5_000, Math.floor(maxDelayMs * (1 - talkativeBias * 0.7)));
  minDelayMs = Math.max(5_000, Math.floor(minDelayMs * arousalDelayMultiplier));
  maxDelayMs = Math.max(minDelayMs + 4_000, Math.floor(maxDelayMs * arousalDelayMultiplier));

  const jitter = deterministicJitter(input.signal, input.nowMs, minDelayMs, maxDelayMs);
  const cooldownRemaining = Math.max(0, input.proactiveCooldownUntilMs - input.nowMs);
  const delayMs = Math.max(minDelayMs, cooldownRemaining, jitter);
  return { shouldArm: true, delayMs, gateReason: "armed" };
}

function getArousalDelayMultiplier(relationship: RelationshipState): number {
  const balance = deriveCognitiveBalanceFromLibido(relationship);
  if (balance.arousalState === "overridden") return 0.52;
  if (balance.arousalState === "aroused") return 0.64;
  if (balance.arousalState === "rising") return 0.8;
  return 1;
}

function deterministicJitter(signal: LoopSignal, nowMs: number, minDelayMs: number, maxDelayMs: number): number {
  const span = Math.max(1, maxDelayMs - minDelayMs);
  const coarse = Math.floor(nowMs / 1000);
  let seed = coarse % 2147483647;
  for (let i = 0; i < signal.length; i += 1) {
    seed = (seed * 31 + signal.charCodeAt(i)) % 2147483647;
  }
  const ratio = (seed % 10_000) / 10_000;
  return Math.floor(minDelayMs + ratio * span);
}

function isLikelyUnfinishedThought(input: string): boolean {
  const text = input.trim();
  if (!text) return false;
  const ellipsis = /(\.\.\.|…|，|、|—|-|\/)$/.test(text);
  const openParen = /[（(「『【]$/.test(text);
  return ellipsis || openParen;
}
