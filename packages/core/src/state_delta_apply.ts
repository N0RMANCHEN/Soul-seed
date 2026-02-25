import type {
  StateDeltaProposal,
  DeltaGateResult,
  DeltaCommitResult,
  StateDelta,
} from "./state_delta.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";

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
    // file doesn't exist yet — start fresh
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

async function appendDeltaTrace(
  personaRoot: string,
  result: DeltaCommitResult
): Promise<void> {
  const tracePath = join(personaRoot, "delta_trace.jsonl");
  const line = JSON.stringify(result) + "\n";
  await fs.appendFile(tracePath, line, "utf-8");
}
