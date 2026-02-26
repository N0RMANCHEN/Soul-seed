/**
 * K/P0-1: Multi-persona arbitration — selects which persona speaks
 * in a group chat turn. Deterministic scoring; addressing weight >
 * interest weight per Product Standards §3.4.
 */
import type {
  MultiPersonaSpeakerRegistry,
  MultiPersonaGroupPolicy
} from "./multi_persona_registry.js";

export const W_ADDRESSING = 0.55;
export const W_INTEREST = 0.25;
export const W_BASE_PRIORITY = 0.20;
export const DEFAULT_BASE_PRIORITY = 0.5;

const COOLDOWN_PER_TURN = 0.12;
const COOLDOWN_MAX = 0.42;

const THRESHOLD_SPEAK = 0.62;
const THRESHOLD_BRIEF_ACK = 0.48;

export interface ArbitrationCandidate {
  actorId: string;
  displayName: string;
  addressingScore: number;
  interestScore: number;
  recentTurnCount: number;
  /** Defaults to DEFAULT_BASE_PRIORITY (0.5) when omitted. */
  basePriority?: number;
}

export interface ArbitrationInput {
  userInput: string;
  registry: MultiPersonaSpeakerRegistry;
  policy: MultiPersonaGroupPolicy;
  candidates: ArbitrationCandidate[];
}

export interface ArbitrationDecision {
  actorId: string;
  mode: "speak" | "wait" | "brief_ack";
  score: number;
  reasonCodes: string[];
}

export interface ArbitrationResult {
  selectedActorId: string | null;
  decisions: ArbitrationDecision[];
  reasonCodes: string[];
}

export function arbitrateMultiPersonaTurn(
  input: ArbitrationInput
): ArbitrationResult {
  const { policy, candidates } = input;

  if (candidates.length === 0) {
    return { selectedActorId: null, decisions: [], reasonCodes: ["no_candidates"] };
  }

  const maxConsecutive = policy.turnScheduling.maxConsecutiveTurns;

  const decisions: ArbitrationDecision[] = candidates.map((c) => {
    const reasonCodes: string[] = [];
    const priority = c.basePriority ?? DEFAULT_BASE_PRIORITY;

    let score =
      c.addressingScore * W_ADDRESSING +
      c.interestScore * W_INTEREST +
      priority * W_BASE_PRIORITY;

    if (c.addressingScore >= 0.7) reasonCodes.push("strong_addressing");
    if (c.interestScore >= 0.7) reasonCodes.push("high_interest");

    if (c.recentTurnCount >= maxConsecutive) {
      const penalty = Math.min(COOLDOWN_MAX, c.recentTurnCount * COOLDOWN_PER_TURN);
      score -= penalty;
      reasonCodes.push("cooldown_penalty");
    }

    score = Math.max(0, Math.min(1, score));

    const mode: "speak" | "wait" | "brief_ack" =
      score >= THRESHOLD_SPEAK ? "speak"
        : score >= THRESHOLD_BRIEF_ACK ? "brief_ack"
          : "wait";

    reasonCodes.push(`mode_${mode}`);

    return { actorId: c.actorId, mode, score: Number(score.toFixed(4)), reasonCodes };
  });

  const speakCandidates = decisions
    .filter((d) => d.mode === "speak")
    .sort((a, b) => b.score - a.score || a.actorId.localeCompare(b.actorId));

  const globalReasons: string[] = [];

  if (speakCandidates.length === 0) {
    globalReasons.push("no_speaker_qualified");
    return { selectedActorId: null, decisions, reasonCodes: globalReasons };
  }

  const winner = speakCandidates[0];
  globalReasons.push(`selected_${winner.actorId}`);

  if (speakCandidates.length > 1) {
    globalReasons.push("conflict_resolved_by_score");
    for (const loser of speakCandidates.slice(1)) {
      const idx = decisions.findIndex((dd) => dd.actorId === loser.actorId);
      if (idx >= 0) {
        decisions[idx] = {
          ...decisions[idx],
          mode: "brief_ack",
          reasonCodes: [...decisions[idx].reasonCodes, "demoted_conflict_resolution"]
        };
      }
    }
  }

  return {
    selectedActorId: winner.actorId,
    decisions,
    reasonCodes: globalReasons
  };
}
