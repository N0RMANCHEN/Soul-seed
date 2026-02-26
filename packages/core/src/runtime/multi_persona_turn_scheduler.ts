/**
 * K/P0-2: Multi-persona turn scheduler — prevents any single persona
 * from monopolizing the conversation. Three scheduling modes with
 * anti-monopoly enforcement.
 */
import type {
  MultiPersonaGroupPolicy,
  MultiPersonaSpeakerRegistry
} from "./multi_persona_registry.js";
import type { ArbitrationResult } from "./multi_persona_arbitration.js";

const HISTORY_MAX = 50;

// ── Types ───────────────────────────────────────────────────

export interface TurnSchedulerState {
  history: TurnRecord[];
  roundRobinPointer: number;
  nextTurnIndex: number;
  lastUpdatedAt: string;
}

export interface TurnRecord {
  actorId: string;
  turnIndex: number;
  timestamp: string;
}

export interface TurnSchedulerInput {
  state: TurnSchedulerState;
  policy: MultiPersonaGroupPolicy;
  registry: MultiPersonaSpeakerRegistry;
  arbitrationResult: ArbitrationResult;
  now?: string;
}

export interface TurnSchedulerOutput {
  selectedActorId: string | null;
  nextState: TurnSchedulerState;
  reasonCodes: string[];
  antiMonopolyApplied: boolean;
}

// ── Factory ─────────────────────────────────────────────────

export function createInitialTurnState(now?: string): TurnSchedulerState {
  return {
    history: [],
    roundRobinPointer: 0,
    nextTurnIndex: 0,
    lastUpdatedAt: now ?? ""
  };
}

// ── Helpers ─────────────────────────────────────────────────

export function getConsecutiveTurns(
  history: TurnRecord[],
  actorId: string
): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].actorId === actorId) count++;
    else break;
  }
  return count;
}

function isEligible(
  history: TurnRecord[],
  actorId: string,
  maxConsecutive: number
): boolean {
  return getConsecutiveTurns(history, actorId) < maxConsecutive;
}

function appendAndTrim(
  history: TurnRecord[],
  actorId: string | null,
  turnIndex: number,
  now: string
): { history: TurnRecord[]; nextTurnIndex: number } {
  if (!actorId) return { history: history.slice(-HISTORY_MAX), nextTurnIndex: turnIndex };
  return {
    history: [
      ...history,
      { actorId, turnIndex, timestamp: now }
    ].slice(-HISTORY_MAX),
    nextTurnIndex: turnIndex + 1
  };
}

// ── Mode handlers ───────────────────────────────────────────

function scheduleStrictRoundRobin(
  state: TurnSchedulerState,
  entries: { actorId: string }[],
  reasonCodes: string[]
): { selectedActorId: string; nextPointer: number } {
  reasonCodes.push("mode_strict_round_robin");
  const pointer = state.roundRobinPointer % entries.length;
  const selected = entries[pointer].actorId;
  reasonCodes.push(`pointer_selected_${selected}`);
  return {
    selectedActorId: selected,
    nextPointer: (pointer + 1) % entries.length
  };
}

function scheduleRoundRobinPriority(
  state: TurnSchedulerState,
  entries: { actorId: string }[],
  arbitrationResult: ArbitrationResult,
  maxConsecutive: number,
  reasonCodes: string[]
): {
  selectedActorId: string | null;
  nextPointer: number;
  antiMonopolyApplied: boolean;
} {
  reasonCodes.push("mode_round_robin_priority");
  let antiMonopolyApplied = false;
  const winner = arbitrationResult.selectedActorId;

  if (winner && isEligible(state.history, winner, maxConsecutive)) {
    reasonCodes.push(`arbitration_winner_${winner}`);
    const idx = entries.findIndex((e) => e.actorId === winner);
    return {
      selectedActorId: winner,
      nextPointer: idx >= 0 ? (idx + 1) % entries.length : state.roundRobinPointer,
      antiMonopolyApplied: false
    };
  }

  if (winner) {
    reasonCodes.push(`monopoly_blocked_${winner}`);
    antiMonopolyApplied = true;
  }

  const sorted = [...arbitrationResult.decisions].sort(
    (a, b) => b.score - a.score
  );
  for (const d of sorted) {
    if (d.actorId === winner) continue;
    if (isEligible(state.history, d.actorId, maxConsecutive)) {
      reasonCodes.push(`fallback_selected_${d.actorId}`);
      const idx = entries.findIndex((e) => e.actorId === d.actorId);
      return {
        selectedActorId: d.actorId,
        nextPointer: idx >= 0 ? (idx + 1) % entries.length : state.roundRobinPointer,
        antiMonopolyApplied
      };
    }
  }

  const pointer = state.roundRobinPointer % entries.length;
  for (let i = 0; i < entries.length; i++) {
    const idx = (pointer + i) % entries.length;
    if (isEligible(state.history, entries[idx].actorId, maxConsecutive)) {
      reasonCodes.push(`rr_fallback_${entries[idx].actorId}`);
      return {
        selectedActorId: entries[idx].actorId,
        nextPointer: (idx + 1) % entries.length,
        antiMonopolyApplied
      };
    }
  }

  reasonCodes.push("no_eligible_speaker");
  return {
    selectedActorId: null,
    nextPointer: state.roundRobinPointer,
    antiMonopolyApplied
  };
}

function scheduleFreeForm(
  state: TurnSchedulerState,
  arbitrationResult: ArbitrationResult,
  maxConsecutive: number,
  reasonCodes: string[]
): { selectedActorId: string | null; antiMonopolyApplied: boolean } {
  reasonCodes.push("mode_free_form");
  let antiMonopolyApplied = false;
  const winner = arbitrationResult.selectedActorId;

  if (winner && isEligible(state.history, winner, maxConsecutive)) {
    reasonCodes.push(`arbitration_winner_${winner}`);
    return { selectedActorId: winner, antiMonopolyApplied: false };
  }

  if (winner) {
    reasonCodes.push(`monopoly_blocked_${winner}`);
    antiMonopolyApplied = true;
  }

  const sorted = [...arbitrationResult.decisions].sort(
    (a, b) => b.score - a.score
  );
  for (const d of sorted) {
    if (d.actorId === winner) continue;
    if (isEligible(state.history, d.actorId, maxConsecutive)) {
      reasonCodes.push(`fallback_selected_${d.actorId}`);
      return { selectedActorId: d.actorId, antiMonopolyApplied };
    }
  }

  reasonCodes.push("no_eligible_speaker");
  return { selectedActorId: null, antiMonopolyApplied };
}

// ── Core scheduler ──────────────────────────────────────────

export function scheduleTurn(input: TurnSchedulerInput): TurnSchedulerOutput {
  const { state, policy, registry, arbitrationResult } = input;
  const { mode, maxConsecutiveTurns } = policy.turnScheduling;
  const entries = registry.entries;
  const reasonCodes: string[] = [];

  if (entries.length === 0) {
    reasonCodes.push("no_registered_personas");
    return {
      selectedActorId: null,
      nextState: state,
      reasonCodes,
      antiMonopolyApplied: false
    };
  }

  const now = input.now ?? new Date().toISOString();
  let selectedActorId: string | null = null;
  let nextPointer = state.roundRobinPointer;
  let antiMonopolyApplied = false;

  if (mode === "strict_round_robin") {
    const r = scheduleStrictRoundRobin(state, entries, reasonCodes);
    selectedActorId = r.selectedActorId;
    nextPointer = r.nextPointer;
  } else if (mode === "round_robin_priority") {
    const r = scheduleRoundRobinPriority(
      state, entries, arbitrationResult, maxConsecutiveTurns, reasonCodes
    );
    selectedActorId = r.selectedActorId;
    nextPointer = r.nextPointer;
    antiMonopolyApplied = r.antiMonopolyApplied;
  } else {
    const r = scheduleFreeForm(
      state, arbitrationResult, maxConsecutiveTurns, reasonCodes
    );
    selectedActorId = r.selectedActorId;
    antiMonopolyApplied = r.antiMonopolyApplied;
  }

  const trimmed = appendAndTrim(state.history, selectedActorId, state.nextTurnIndex, now);

  return {
    selectedActorId,
    nextState: {
      history: trimmed.history,
      roundRobinPointer: nextPointer,
      nextTurnIndex: trimmed.nextTurnIndex,
      lastUpdatedAt: now
    },
    reasonCodes,
    antiMonopolyApplied
  };
}
