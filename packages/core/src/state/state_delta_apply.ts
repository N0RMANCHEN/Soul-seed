import type {
  StateDeltaProposal,
  DeltaGateResult,
  DeltaCommitResult,
  StateDelta,
} from "./state_delta.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { normalizeGoalsState } from "./goals_state.js";
import { normalizeBeliefsState } from "./beliefs_state.js";
import { VALUES_RULES_SCHEMA_VERSION } from "../persona/values_rules.js";
import { createDefaultPersonalityProfile } from "../persona/personality_profile.js";
import { normalizeMoodState, createInitialMoodState } from "./mood_state.js";

export const DOMAIN_FILE_MAP: Record<string, string> = {
  relationship: "relationship_state.json",
  mood: "mood_state.json",
  belief: "beliefs.json",
  goal: "goals.json",
  value: "values_rules.json",
  personality: "personality_profile.json",
  epigenetics: "epigenetics.json",
  interests: "interests.json",
  cognition: "cognition_state.json",
  voice: "voice_profile.json",
  social_graph: "social_graph.json",
};

export async function applyDeltas(
  proposal: StateDeltaProposal,
  gateResults: DeltaGateResult[],
  personaRoot: string
): Promise<DeltaCommitResult> {
  const appliedDeltas: StateDelta[] = [];
  const rejectedDeltas: Array<{ delta: StateDelta; reason: string }> = [];
  const committedAt = new Date().toISOString();

  for (let i = 0; i < proposal.deltas.length; i++) {
    const delta = proposal.deltas[i];
    const gateResult = gateResults.find((r) => r.deltaIndex === i);

    if (!gateResult || gateResult.verdict === "reject") {
      rejectedDeltas.push({
        delta,
        reason: gateResult?.reason ?? "no gate result found",
      });
      continue;
    }

    const effectivePatch =
      gateResult.verdict === "clamp" && gateResult.clampedPatch
        ? gateResult.clampedPatch
        : delta.patch;

    const effectiveDelta = { ...delta, patch: effectivePatch };

    try {
      await applyDeltaToFile(effectiveDelta, personaRoot);
      appliedDeltas.push(effectiveDelta);
    } catch (err) {
      rejectedDeltas.push({
        delta,
        reason: `apply failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const result: DeltaCommitResult = {
    turnId: proposal.turnId,
    proposal,
    gateResults,
    appliedDeltas,
    rejectedDeltas,
    committedAt,
  };

  await appendDeltaTrace(personaRoot, result);

  return result;
}

async function applyDeltaToFile(
  delta: StateDelta,
  personaRoot: string
): Promise<void> {
  const fileName = DOMAIN_FILE_MAP[delta.type];
  if (!fileName) return;

  const filePath = join(personaRoot, fileName);

  let current: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    current = JSON.parse(raw);
  } catch {
    // file doesn't exist yet — use defaults for personality/value
    if (delta.type === "personality") {
      current = createDefaultPersonalityProfile() as unknown as Record<string, unknown>;
    } else if (delta.type === "value") {
      current = { schemaVersion: VALUES_RULES_SCHEMA_VERSION, rules: [] };
    }
  }

  if (delta.type === "goal") {
    const merged = mergeGoalsState(current, delta.patch);
    merged._lastDeltaAt = new Date().toISOString();
    const tmpPath = filePath + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(merged, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath);
    return;
  }

  if (delta.type === "belief") {
    const merged = mergeBeliefsState(current, delta.patch, delta.targetId);
    merged._lastDeltaAt = new Date().toISOString();
    const tmpPath = filePath + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(merged, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath);
    return;
  }

  if (delta.type === "mood") {
    const merged = mergeMoodState(current, delta.patch);
    merged._lastDeltaAt = new Date().toISOString();
    const tmpPath = filePath + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify(merged, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath);
    return;
  }

  for (const [key, value] of Object.entries(delta.patch)) {
    if (
      typeof value === "string" &&
      (value.startsWith("+") || value.startsWith("-"))
    ) {
      const numValue = parseFloat(value);
      const currentValue =
        typeof current[key] === "number" ? (current[key] as number) : 0;
      current[key] = currentValue + numValue;
    } else {
      current[key] = value;
    }
  }

  current["_lastDeltaAt"] = new Date().toISOString();

  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, JSON.stringify(current, null, 2), "utf-8");
  await fs.rename(tmpPath, filePath);
}

function mergeGoalsState(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = normalizeGoalsState(current);
  const now = new Date().toISOString();

  if (Array.isArray(patch.goals)) {
    const byId = new Map(base.goals.map((g) => [g.goalId, g]));
    for (const p of patch.goals as Array<Record<string, unknown>>) {
      const id = p.goalId;
      if (typeof id === "string") {
        byId.set(id, { ...(byId.get(id) ?? {}), ...p } as never);
      }
    }
    base.goals = Array.from(byId.values());
  }
  if (Array.isArray(patch.commitments)) {
    const byId = new Map(base.commitments.map((c) => [c.commitmentId, c]));
    for (const p of patch.commitments as Array<Record<string, unknown>>) {
      const id = p.commitmentId;
      if (typeof id === "string") {
        byId.set(id, { ...(byId.get(id) ?? {}), ...p } as never);
      }
    }
    base.commitments = Array.from(byId.values());
  }
  if (patch.drives && typeof patch.drives === "object") {
    const d = patch.drives as Record<string, unknown>;
    const clamp = (v: unknown) => Math.max(0, Math.min(1, Number(v) || 0.5));
    base.drives = {
      exploration: clamp(d.exploration ?? base.drives.exploration),
      safety: clamp(d.safety ?? base.drives.safety),
      efficiency: clamp(d.efficiency ?? base.drives.efficiency),
      intimacy: clamp(d.intimacy ?? base.drives.intimacy),
    };
  }

  base.updatedAt = now;
  return base as unknown as Record<string, unknown>;
}

function mergeBeliefsState(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  targetId?: string
): Record<string, unknown> {
  const base = normalizeBeliefsState(current);
  const now = new Date().toISOString();

  if (Array.isArray(patch.beliefs)) {
    const byId = new Map(base.beliefs.map((b) => [b.beliefId, b]));
    for (const p of patch.beliefs as Array<Record<string, unknown>>) {
      const id = p.beliefId;
      if (typeof id === "string") {
        byId.set(id, { ...(byId.get(id) ?? {}), ...p } as never);
      }
    }
    base.beliefs = Array.from(byId.values());
  } else if (typeof patch.beliefId === "string" || (targetId && targetId !== "global")) {
    const id = (patch.beliefId as string) ?? targetId;
    const byId = new Map(base.beliefs.map((b) => [b.beliefId, b]));
    const existing = byId.get(id);
    const updated = { ...(existing ?? { beliefId: id, domain: "world", proposition: "", confidence: 0.5, lastUpdated: now, supportingEvidence: [], contradictingEvidence: [], cooldownUntil: null }), ...patch };
    (updated as Record<string, unknown>).lastUpdated = now;
    byId.set(id, updated as never);
    base.beliefs = Array.from(byId.values());
  }

  base.updatedAt = now;
  return base as unknown as Record<string, unknown>;
}

function mergeMoodState(
  current: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const base = Object.keys(current).length > 0
    ? normalizeMoodState(current)
    : createInitialMoodState();
  const now = new Date().toISOString();
  const result = { ...base } as Record<string, unknown>;

  for (const [key, value] of Object.entries(patch)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "string" && (value.startsWith("+") || value.startsWith("-"))) {
      const numValue = parseFloat(value);
      const currentVal = typeof (result as Record<string, unknown>)[key] === "number"
        ? (result as Record<string, unknown>)[key] as number
        : 0;
      (result as Record<string, unknown>)[key] = Math.max(0, Math.min(1, currentVal + numValue));
    } else if (typeof value === "number") {
      (result as Record<string, unknown>)[key] = Math.max(0, Math.min(1, value));
    } else if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  result.updatedAt = now;
  return result;
}

async function appendDeltaTrace(
  personaRoot: string,
  result: DeltaCommitResult
): Promise<void> {
  const tracePath = join(personaRoot, "delta_trace.jsonl");
  const line = JSON.stringify(result) + "\n";
  await fs.appendFile(tracePath, line, "utf-8");
}
