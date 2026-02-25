import type {
  StateDelta,
  StateDeltaProposal,
  DeltaGateResult,
  DeltaGateContext,
  DeltaGateFunction,
  InvariantRule,
} from "./state_delta.js";
import { loadValuesRulesSync, ruleMatchesDelta } from "./values_rules.js";

function lookupThreshold(
  rules: InvariantRule[] | undefined,
  ruleId: string,
  fallback: number
): number {
  if (!rules) return fallback;
  const rule = rules.find((r) => r.id === ruleId && r.enabled);
  return rule ? rule.threshold : fallback;
}

const MOOD_CLAMP_MAX = 0.2;
const IDENTITY_CONFIDENCE_THRESHOLD = 0.7;
const BELIEF_GOAL_CONFIDENCE_THRESHOLD = 0.3;
const RELATIONSHIP_HARD_CAP = 0.1;
const RELATIONSHIP_SOFT_CAP = 0.05;
const EPIGENETICS_ABS_CAP = 0.05;
const EPIGENETICS_MIN_SUPPORTING = 2;

function extractNumericPatchValues(
  patch: Record<string, unknown>
): Array<{ key: string; value: number }> {
  const result: Array<{ key: string; value: number }> = [];
  for (const [key, val] of Object.entries(patch)) {
    let num: number;
    if (typeof val === "number") {
      num = val;
    } else if (typeof val === "string" && (val.startsWith("+") || val.startsWith("-"))) {
      num = parseFloat(val);
      if (Number.isNaN(num)) continue;
    } else {
      continue;
    }
    result.push({ key, value: num });
  }
  return result;
}

function buildClampedPatch(
  patch: Record<string, unknown>,
  min: number,
  max: number
): Record<string, unknown> {
  const clamped: Record<string, unknown> = { ...patch };
  for (const { key, value } of extractNumericPatchValues(patch)) {
    clamped[key] = Math.max(min, Math.min(max, value));
  }
  return clamped;
}

export function identityConstitutionGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.type !== "value" && delta.type !== "personality") {
    return { deltaIndex, verdict: "accept", gate: "identityConstitution", reason: "not applicable" };
  }
  const threshold = lookupThreshold(
    context.invariantTable,
    delta.type === "value" ? "value-min-confidence" : "personality-min-confidence",
    IDENTITY_CONFIDENCE_THRESHOLD
  );
  if (delta.confidence < threshold) {
    return {
      deltaIndex,
      verdict: "reject",
      gate: "identityConstitution",
      reason: `confidence ${delta.confidence} below threshold ${threshold} for identity domain`,
    };
  }
  return { deltaIndex, verdict: "accept", gate: "identityConstitution", reason: "passed" };
}

export function valuesGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.type !== "value" && delta.type !== "personality") {
    return { deltaIndex, verdict: "accept", gate: "values", reason: "not applicable" };
  }
  const doc = loadValuesRulesSync(context.personaRoot);
  const rules = [...doc.rules].sort((a, b) => b.priority - a.priority);
  for (const rule of rules) {
    if (!ruleMatchesDelta(rule, delta)) continue;
    if (rule.then === "refuse") {
      const reason = `values rule ${rule.id} triggered: ${rule.notes || rule.when}`;
      if (context.compatMode === "legacy") {
        return { deltaIndex, verdict: "accept", gate: "values", reason: `[legacy] ${reason} (logged only)` };
      }
      return { deltaIndex, verdict: "reject", gate: "values", reason };
    }
  }
  return { deltaIndex, verdict: "accept", gate: "values", reason: "passed" };
}

export function recallGroundingGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.supportingEventHashes.length === 0) {
    return { deltaIndex, verdict: "accept", gate: "recallGrounding", reason: "no supporting hashes" };
  }
  const lifeEventHashes = context.lifeEventHashes;
  if (!lifeEventHashes || lifeEventHashes.size === 0) {
    return {
      deltaIndex,
      verdict: "reject",
      gate: "recallGrounding",
      reason: "supporting hashes provided but no lifeEventHashes in context",
    };
  }
  for (const hash of delta.supportingEventHashes) {
    if (!lifeEventHashes.has(hash)) {
      return {
        deltaIndex,
        verdict: "reject",
        gate: "recallGrounding",
        reason: `supporting hash not found in lifeEventHashes: ${hash}`,
      };
    }
  }
  return { deltaIndex, verdict: "accept", gate: "recallGrounding", reason: "all hashes grounded" };
}

export function relationshipDeltaGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.type !== "relationship") {
    return { deltaIndex, verdict: "accept", gate: "relationshipDelta", reason: "not applicable" };
  }
  const hardCap = lookupThreshold(context.invariantTable, "rel-max-delta-per-turn", RELATIONSHIP_HARD_CAP);
  const minEvidence = lookupThreshold(context.invariantTable, "rel-evidence-required", 1);
  const numerics = extractNumericPatchValues(delta.patch);
  for (const { key, value } of numerics) {
    const abs = Math.abs(value);
    if (abs > hardCap) {
      return {
        deltaIndex,
        verdict: "reject",
        gate: "relationshipDelta",
        reason: `patch.${key} absolute value ${abs} exceeds per-turn cap ${hardCap}`,
      };
    }
    if (abs > RELATIONSHIP_SOFT_CAP && delta.supportingEventHashes.length < minEvidence) {
      return {
        deltaIndex,
        verdict: "reject",
        gate: "relationshipDelta",
        reason: `patch.${key} absolute value ${abs} > ${RELATIONSHIP_SOFT_CAP} requires at least ${minEvidence} supporting event hash`,
      };
    }
  }
  return { deltaIndex, verdict: "accept", gate: "relationshipDelta", reason: "passed" };
}

export function moodDeltaGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.type !== "mood") {
    return { deltaIndex, verdict: "accept", gate: "moodDelta", reason: "not applicable" };
  }
  const maxDelta = lookupThreshold(context.invariantTable, "mood-max-delta", MOOD_CLAMP_MAX);
  const numerics = extractNumericPatchValues(delta.patch);
  let needsClamp = false;
  for (const { value } of numerics) {
    if (value < -maxDelta || value > maxDelta) {
      needsClamp = true;
      break;
    }
  }
  if (!needsClamp) {
    return { deltaIndex, verdict: "accept", gate: "moodDelta", reason: "passed" };
  }
  const clampedPatch = buildClampedPatch(delta.patch, -maxDelta, maxDelta);
  return {
    deltaIndex,
    verdict: "clamp",
    gate: "moodDelta",
    reason: `values clamped to [${-maxDelta}, ${maxDelta}]`,
    clampedPatch,
  };
}

const BELIEF_COMMITMENT_EVIDENCE_MIN = 1;

export function beliefGoalGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.type !== "belief" && delta.type !== "goal") {
    return { deltaIndex, verdict: "accept", gate: "beliefGoal", reason: "not applicable" };
  }
  const threshold = lookupThreshold(context.invariantTable, "belief-min-confidence", BELIEF_GOAL_CONFIDENCE_THRESHOLD);
  if (delta.confidence < threshold) {
    return {
      deltaIndex,
      verdict: "reject",
      gate: "beliefGoal",
      reason: `confidence ${delta.confidence} below threshold ${threshold}`,
    };
  }

  // Belief: cooldown check — reject if target belief has cooldownUntil in future
  if (delta.type === "belief") {
    const targetId = delta.targetId;
    const beliefs = context.currentBeliefs?.beliefs ?? [];
    const targetBelief = targetId && targetId !== "global" ? beliefs.find((b) => b.beliefId === targetId) : null;
    if (targetBelief?.cooldownUntil) {
      const now = new Date().toISOString();
      if (targetBelief.cooldownUntil > now) {
        return {
          deltaIndex,
          verdict: "reject",
          gate: "beliefGoal",
          reason: `belief ${targetId} cooldown until ${targetBelief.cooldownUntil}`,
        };
      }
    }
    // Patch may add/update belief by beliefId in patch
    const patchBeliefId = typeof delta.patch.beliefId === "string" ? delta.patch.beliefId : targetId;
    if (patchBeliefId && patchBeliefId !== "global") {
      const existing = beliefs.find((b) => b.beliefId === patchBeliefId);
      if (existing?.cooldownUntil) {
        const now = new Date().toISOString();
        if (existing.cooldownUntil > now) {
          return {
            deltaIndex,
            verdict: "reject",
            gate: "beliefGoal",
            reason: `belief ${patchBeliefId} cooldown until ${existing.cooldownUntil}`,
          };
        }
      }
    }
  }

  // Goal: commitment status change (fulfilled/defaulted) requires evidence
  if (delta.type === "goal") {
    const patch = delta.patch as Record<string, unknown>;
    const commitments = Array.isArray(patch.commitments) ? (patch.commitments as Array<{ commitmentId?: string; status?: string; evidence?: string[] }>) : [];
    for (const c of commitments) {
      if (c.status === "fulfilled" || c.status === "defaulted") {
        const evidence = Array.isArray(c.evidence) ? c.evidence : [];
        if (evidence.length < BELIEF_COMMITMENT_EVIDENCE_MIN && delta.supportingEventHashes.length < BELIEF_COMMITMENT_EVIDENCE_MIN) {
          return {
            deltaIndex,
            verdict: "reject",
            gate: "beliefGoal",
            reason: `commitment ${c.commitmentId ?? "?"} status ${c.status} requires evidence`,
          };
        }
      }
    }
  }

  return { deltaIndex, verdict: "accept", gate: "beliefGoal", reason: "passed" };
}

export function epigeneticsGate(
  delta: StateDelta,
  deltaIndex: number,
  context: DeltaGateContext
): DeltaGateResult {
  if (delta.type !== "epigenetics" && delta.type !== "personality") {
    return { deltaIndex, verdict: "accept", gate: "epigenetics", reason: "not applicable" };
  }
  if (context.genome?.locked === true) {
    return {
      deltaIndex,
      verdict: "reject",
      gate: "epigenetics",
      reason: "genome is locked",
    };
  }
  const now = new Date().toISOString();
  const adjustments = context.epigenetics?.adjustments;
  if (adjustments) {
    for (const key of Object.keys(delta.patch)) {
      const adj = adjustments[key];
      if (adj?.cooldownUntil && adj.cooldownUntil > now) {
        return {
          deltaIndex,
          verdict: "reject",
          gate: "epigenetics",
          reason: "cooldown active",
        };
      }
    }
  }
  const absCap = lookupThreshold(context.invariantTable, "epi-max-adjustment", EPIGENETICS_ABS_CAP);
  const minSupporting = lookupThreshold(context.invariantTable, "epi-evidence-required", EPIGENETICS_MIN_SUPPORTING);
  if (delta.supportingEventHashes.length < minSupporting) {
    return {
      deltaIndex,
      verdict: "reject",
      gate: "epigenetics",
      reason: `requires at least ${minSupporting} supporting event hashes, got ${delta.supportingEventHashes.length}`,
    };
  }
  const numerics = extractNumericPatchValues(delta.patch);
  for (const { key, value } of numerics) {
    if (Math.abs(value) > absCap) {
      return {
        deltaIndex,
        verdict: "reject",
        gate: "epigenetics",
        reason: `patch.${key} absolute value ${Math.abs(value)} exceeds cap ${absCap}`,
      };
    }
  }
  return { deltaIndex, verdict: "accept", gate: "epigenetics", reason: "passed" };
}

export function budgetGate(
  _delta: StateDelta,
  deltaIndex: number,
  _context: DeltaGateContext
): DeltaGateResult {
  return { deltaIndex, verdict: "accept", gate: "budget", reason: "placeholder" };
}

const DEFAULT_GATES: DeltaGateFunction[] = [
  identityConstitutionGate,
  valuesGate,
  recallGroundingGate,
  relationshipDeltaGate,
  moodDeltaGate,
  beliefGoalGate,
  epigeneticsGate,
  budgetGate,
];

export function runDeltaGates(
  proposal: StateDeltaProposal,
  context: DeltaGateContext,
  gates?: DeltaGateFunction[]
): DeltaGateResult[] {
  const activeGates = gates ?? DEFAULT_GATES;
  const results: DeltaGateResult[] = [];

  for (let i = 0; i < proposal.deltas.length; i++) {
    const delta = proposal.deltas[i];
    let finalResult: DeltaGateResult | null = null;

    for (const gate of activeGates) {
      const result = gate(delta, i, context);
      if (result.verdict === "reject") {
        finalResult = result;
        break;
      }
      if (result.verdict === "clamp") {
        finalResult = result;
      }
    }

    results.push(
      finalResult ?? {
        deltaIndex: i,
        verdict: "accept",
        gate: "all",
        reason: "passed all gates",
      }
    );
  }

  return results;
}
