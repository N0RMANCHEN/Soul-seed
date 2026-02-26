/**
 * H/P1-6: Imperfection Signal Extractor.
 * Reads state (salience, causeConfidence, relationship) → produces signals for response generation.
 * Archive §12, doc/plans/Hb-1-4-Imperfection-DoD.md
 */

import {
  loadImperfectionRules,
  resetImperfectionRulesCache,
} from "./imperfection_rules.js";

export { resetImperfectionRulesCache };
import type {
  DecisionTrace,
  PersonaPackage,
  RelationshipState,
} from "./types.js";
import type { DeltaCommitResult } from "./state_delta.js";

export interface ImperfectionSignal {
  ruleId: string;
  signalKey: string;
  description: string;
  suggestedHints: string[];
}

export interface ImperfectionExtractorInput {
  personaPkg: PersonaPackage;
  trace: DecisionTrace;
  /** Optional: average salience of recalled memories (stub until H/P1-2) */
  avgSalience?: number;
  /** Optional: cause confidence for current episode (stub until H/P1-3) */
  causeConfidence?: number;
  /** Optional: entity mentioned in user input without relationship card */
  entityWithoutRelationship?: string;
  /** Optional: memory was compressed/summarized (stub until H/P1-2); when true, IMP-06 applies */
  hasCompressedMemory?: boolean;
}

const SALIENCE_LOW_THRESHOLD = 0.3;
const CONFIDENCE_LOW_THRESHOLD = 0.5;
const MIN_MEMORIES_FOR_STRONG_RECALL = 3;
const RELATIONSHIP_COOLING_INTIMACY = 0.4;

/**
 * Extracts imperfection signals from current state for response generation.
 * Signals are hints; LLM chooses natural expression.
 */
export function extractImperfectionSignals(
  input: ImperfectionExtractorInput
): ImperfectionSignal[] {
  const signals: ImperfectionSignal[] = [];
  const rules = loadImperfectionRules();

  const { personaPkg, trace } = input;
  const blocks = trace.selectedMemoryBlocks ?? [];
  const memoriesCount = trace.selectedMemories?.length ?? 0;
  const deltaResult = trace.deltaCommitResult;
  const moodState = personaPkg.moodState;
  const relationshipState = personaPkg.relationshipState;

  // IMP-01: Uncertainty expression when evidence weak
  const evidenceWeak = isEvidenceWeak(
    deltaResult,
    trace,
    input.causeConfidence ?? 1
  );
  if (evidenceWeak && rules.some((r) => r.id === "IMP-01")) {
    signals.push({
      ruleId: "IMP-01",
      signalKey: "hedge_language",
      description: "Evidence weak; prefer hedge language",
      suggestedHints: [
        "I'm not sure",
        "I think",
        "perhaps",
        "it might be",
        "could be",
      ],
    });
  }

  // IMP-02: Memory gaps when salience low
  const salienceLow =
    input.avgSalience != null
      ? input.avgSalience < SALIENCE_LOW_THRESHOLD
      : memoriesCount < MIN_MEMORIES_FOR_STRONG_RECALL && blocks.length < 2;
  if (salienceLow && rules.some((r) => r.id === "IMP-02")) {
    signals.push({
      ruleId: "IMP-02",
      signalKey: "memory_gap",
      description: "Low salience or few memories; acknowledge gaps",
      suggestedHints: [
        "I don't remember the details",
        "I'm not sure I recall",
        "it's a bit fuzzy",
      ],
    });
  }

  // IMP-03: Unnamed emotion — mood present without forcing narration
  const moodDrifted =
    moodState &&
    (moodState.valence !== 0.5 || moodState.arousal !== 0.3) &&
    moodState.dominantEmotion === "calm";
  if (moodDrifted && rules.some((r) => r.id === "IMP-03")) {
    signals.push({
      ruleId: "IMP-03",
      signalKey: "unnamed_emotion",
      description: "Mood present; tone may drift without explicit labels",
      suggestedHints: [],
    });
  }

  // IMP-04: Uncertain attribution when causeConfidence low
  const causeConf = input.causeConfidence ?? inferCauseConfidence(trace);
  if (causeConf < CONFIDENCE_LOW_THRESHOLD && rules.some((r) => r.id === "IMP-04")) {
    signals.push({
      ruleId: "IMP-04",
      signalKey: "uncertain_attribution",
      description: "Low cause confidence; uncertain why",
      suggestedHints: ["maybe", "hard to say why", "uncertain what caused it"],
    });
  }

  // IMP-05: Relationship cooling
  const cooling = isRelationshipCooling(relationshipState);
  if (cooling && rules.some((r) => r.id === "IMP-05")) {
    signals.push({
      ruleId: "IMP-05",
      signalKey: "relationship_cooling",
      description: "Relationship may have cooled; avoid forced warmth",
      suggestedHints: [],
    });
  }

  // IMP-06: Detail forgetting — prefer summaries over fabricated specifics when memory compressed
  if (input.hasCompressedMemory && rules.some((r) => r.id === "IMP-06")) {
    signals.push({
      ruleId: "IMP-06",
      signalKey: "detail_forgetting",
      description: "Memory compressed; prefer summaries over invented details",
      suggestedHints: [
        "I remember the gist but not the specifics",
        "it's a bit hazy on the details",
      ],
    });
  }

  // IMP-07: Evidence requirement — enforced by gates; signal for context
  const hadRejections = (deltaResult?.rejectedDeltas?.length ?? 0) > 0;
  if (hadRejections && rules.some((r) => r.id === "IMP-07")) {
    signals.push({
      ruleId: "IMP-07",
      signalKey: "evidence_required",
      description: "State changes rejected for insufficient evidence",
      suggestedHints: [
        "I'm not sure I have enough to go on",
        "I'd need more evidence to say",
      ],
    });
  }

  // Entity without relationship card (IMP-02 variant)
  if (input.entityWithoutRelationship && rules.some((r) => r.id === "IMP-02")) {
    signals.push({
      ruleId: "IMP-02",
      signalKey: "memory_gap",
      description: "Mentioned entity without strong recall",
      suggestedHints: [
        "I'm not sure I remember them well",
        "I don't have a clear picture of them",
      ],
    });
  }

  return deduplicateByRuleId(signals);
}

function isEvidenceWeak(
  deltaResult: DeltaCommitResult | undefined,
  trace: DecisionTrace,
  causeConfidence: number
): boolean {
  if (causeConfidence < CONFIDENCE_LOW_THRESHOLD) return true;
  const blocks = trace.selectedMemoryBlocks ?? [];
  if (blocks.length === 0 && (trace.selectedMemories?.length ?? 0) < 2) {
    return true;
  }
  const rejected = deltaResult?.rejectedDeltas ?? [];
  const evidenceRejected = rejected.some((r) =>
    /evidence|confidence/i.test(r.reason)
  );
  return evidenceRejected;
}

function inferCauseConfidence(trace: DecisionTrace): number {
  const blocks = trace.selectedMemoryBlocks ?? [];
  const uncertainCount = blocks.filter(
    (b) => b.uncertaintyLevel === "uncertain"
  ).length;
  if (uncertainCount > 0 && blocks.length > 0) {
    return 1 - uncertainCount / blocks.length;
  }
  return 0.7; // default
}

function isRelationshipCooling(
  relationshipState?: RelationshipState
): boolean {
  if (!relationshipState) return false;
  const intimacy = relationshipState.dimensions?.intimacy ?? 0.5;
  const trust = relationshipState.dimensions?.trust ?? 0.5;
  return intimacy < RELATIONSHIP_COOLING_INTIMACY || trust < 0.5;
}

function deduplicateByRuleId(signals: ImperfectionSignal[]): ImperfectionSignal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    if (seen.has(s.ruleId)) return false;
    seen.add(s.ruleId);
    return true;
  });
}

/**
 * Builds a context block string for injection into compileContext.
 * Signals are hints; LLM chooses natural expression.
 */
export function buildImperfectionContextBlock(signals: ImperfectionSignal[]): string {
  if (signals.length === 0) return "";

  const lines = signals.map((s) => {
    const hints =
      s.suggestedHints.length > 0
        ? ` (e.g. ${s.suggestedHints.slice(0, 3).join(", ")})`
        : "";
    return `- ${s.signalKey}: ${s.description}${hints}`;
  });

  return `Imperfection signals:\n${lines.join("\n")}\nUse these as hints; express naturally, don't force templates.`;
}
