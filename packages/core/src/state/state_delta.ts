import type { GenomeConfig, EpigeneticsConfig } from "./genome.js";
import type { MoodState, RelationshipState } from "../types.js";

export type StateDeltaDomain =
  | "relationship"
  | "mood"
  | "belief"
  | "goal"
  | "value"
  | "personality"
  | "epigenetics"
  | "interests"
  | "topic_state"
  | "cognition"
  | "voice"
  | "social_graph";

export interface StateDelta {
  type: StateDeltaDomain;
  targetId: string;
  patch: Record<string, unknown>;
  confidence: number;
  supportingEventHashes: string[];
  notes: string;
}

export interface StateDeltaProposal {
  turnId: string;
  proposedAt: string;
  deltas: StateDelta[];
}

export interface DeltaGateResult {
  deltaIndex: number;
  verdict: "accept" | "reject" | "clamp";
  gate: string;
  reason: string;
  clampedPatch?: Record<string, unknown>;
}

export interface DeltaCommitResult {
  turnId: string;
  proposal: StateDeltaProposal;
  gateResults: DeltaGateResult[];
  appliedDeltas: StateDelta[];
  rejectedDeltas: Array<{ delta: StateDelta; reason: string }>;
  committedAt: string;
}

export interface DeltaGateContext {
  personaRoot: string;
  currentMood?: MoodState;
  currentRelationship?: RelationshipState;
  genome?: GenomeConfig;
  epigenetics?: EpigeneticsConfig;
  constitutionRules?: string[];
  lifeEventHashes?: Set<string>;
  invariantTable?: InvariantRule[];
  /** When "legacy", ValuesGate logs violations but does not reject (H/P1-0 compat). */
  compatMode?: "legacy" | "full";
  /** H/P1-1: Current goals state for commitment evidence gate */
  currentGoals?: import("./goals_state.js").GoalsState;
  /** H/P1-1: Current beliefs state for cooldown gate */
  currentBeliefs?: import("./beliefs_state.js").BeliefsState;
}

export type DeltaGateFunction = (
  delta: StateDelta,
  index: number,
  context: DeltaGateContext
) => DeltaGateResult;

export interface InvariantRule {
  id: string;
  domain: StateDeltaDomain | "engagement" | "proactive" | "group_chat";
  metric: string;
  threshold: number;
  comparator: "lte" | "gte" | "eq" | "lt" | "gt";
  description: string;
  severity: "error" | "warn";
  enabled: boolean;
}

export interface InvariantCheckResult {
  rule: InvariantRule;
  actual: number;
  passed: boolean;
  message: string;
}

export function createEmptyProposal(turnId: string): StateDeltaProposal {
  return {
    turnId,
    proposedAt: new Date().toISOString(),
    deltas: [],
  };
}

export function createEmptyCommitResult(turnId: string): DeltaCommitResult {
  return {
    turnId,
    proposal: createEmptyProposal(turnId),
    gateResults: [],
    appliedDeltas: [],
    rejectedDeltas: [],
    committedAt: new Date().toISOString(),
  };
}
