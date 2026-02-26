/**
 * State Delta Writer — routes state writes through the pipeline when in full compat mode.
 * E2: Zero direct-write paths — all state mutations flow through proposal → gates → apply.
 */
import type { StateDeltaDomain, StateDeltaProposal, DeltaGateContext } from "./state_delta.js";
import { loadGenome, loadEpigenetics } from "./genome.js";
import { loadInvariantTable } from "./invariant_table.js";
import { runDeltaGates } from "./state_delta_gates.js";
import { applyDeltas } from "./state_delta_apply.js";

export async function shouldUseStateDeltaPipelineFromRoot(personaRoot: string): Promise<boolean> {
  try {
    const genome = await loadGenome(personaRoot);
    return genome.source !== "inferred_legacy";
  } catch {
    return false;
  }
}

export interface WriteStateDeltaOptions {
  confidence?: number;
  supportingEventHashes?: string[];
  lifeEventHashes?: Set<string>;
  turnId?: string;
  /** System-generated writes (mood evolution, relationship update) bypass gates; LLM proposals do not. */
  systemGenerated?: boolean;
}

export async function writeStateDelta(
  personaRoot: string,
  domain: StateDeltaDomain,
  patch: Record<string, unknown>,
  options?: WriteStateDeltaOptions
): Promise<void> {
  const turnId = options?.turnId ?? new Date().toISOString();
  const proposal: StateDeltaProposal = {
    turnId,
    proposedAt: new Date().toISOString(),
    deltas: [
      {
        type: domain,
        targetId: "global",
        patch,
        confidence: options?.confidence ?? 1.0,
        supportingEventHashes: options?.supportingEventHashes ?? [],
        notes: "",
      },
    ],
  };

  let genome;
  let epigenetics;
  try {
    genome = await loadGenome(personaRoot);
    epigenetics = await loadEpigenetics(personaRoot);
  } catch {
    genome = undefined;
    epigenetics = undefined;
  }

  const context: DeltaGateContext = {
    personaRoot,
    genome,
    epigenetics,
    lifeEventHashes: options?.lifeEventHashes,
    invariantTable: loadInvariantTable(),
  };

  const gateResults = options?.systemGenerated
    ? proposal.deltas.map((_, i) => ({ deltaIndex: i, verdict: "accept" as const, gate: "system", reason: "system-generated write" }))
    : runDeltaGates(proposal, context);
  await applyDeltas(proposal, gateResults, personaRoot);
}
