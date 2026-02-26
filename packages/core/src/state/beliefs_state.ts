/**
 * Beliefs State Module — first-class state for world-model propositions.
 * H/P1-1: Goals / Beliefs State Module.
 * Schema per doc/plans/Hb-Mind-Model-State-Modules.md §3.2.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const BELIEFS_SCHEMA_VERSION = "1.0";
export const BELIEFS_STATE_FILENAME = "beliefs.json";

export interface BeliefEntry {
  beliefId: string;
  domain: string;
  proposition: string;
  confidence: number;
  lastUpdated: string;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  cooldownUntil: string | null;
}

export interface BeliefsState {
  schemaVersion: string;
  updatedAt: string;
  beliefs: BeliefEntry[];
}

function clampConfidence(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
}

export function createDefaultBeliefsState(updatedAt?: string): BeliefsState {
  const now = updatedAt ?? new Date().toISOString();
  return {
    schemaVersion: BELIEFS_SCHEMA_VERSION,
    updatedAt: now,
    beliefs: [],
  };
}

export function normalizeBeliefsState(raw: unknown, updatedAt?: string): BeliefsState {
  const now = updatedAt ?? new Date().toISOString();
  if (!raw || typeof raw !== "object") {
    return createDefaultBeliefsState(now);
  }
  const obj = raw as Record<string, unknown>;
  const beliefs = Array.isArray(obj.beliefs)
    ? (obj.beliefs as BeliefEntry[]).filter(
        (b) =>
          b &&
          typeof b.beliefId === "string" &&
          typeof b.proposition === "string" &&
          typeof b.domain === "string"
      )
    : [];
  for (const b of beliefs) {
    b.confidence = clampConfidence(b.confidence);
    b.supportingEvidence = Array.isArray(b.supportingEvidence) ? b.supportingEvidence : [];
    b.contradictingEvidence = Array.isArray(b.contradictingEvidence) ? b.contradictingEvidence : [];
    b.cooldownUntil = typeof b.cooldownUntil === "string" ? b.cooldownUntil : null;
    b.lastUpdated = typeof b.lastUpdated === "string" ? b.lastUpdated : now;
  }
  return {
    schemaVersion: String(obj.schemaVersion ?? BELIEFS_SCHEMA_VERSION),
    updatedAt: String(obj.updatedAt ?? now),
    beliefs,
  };
}

export async function loadBeliefs(personaRoot: string): Promise<BeliefsState> {
  const filePath = join(personaRoot, "beliefs.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeBeliefsState(parsed);
  } catch {
    return createDefaultBeliefsState();
  }
}

export async function saveBeliefs(personaRoot: string, state: BeliefsState): Promise<void> {
  const filePath = join(personaRoot, "beliefs.json");
  const normalized = normalizeBeliefsState(state);
  normalized.updatedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), "utf-8");
}

// Legacy-compatible beliefs API used by existing tests.
export const BELIEF_MAX_CONFIDENCE_STEP = 0.1;

export interface LegacyBelief {
  id: string;
  proposition: string;
  confidence: number;
  evidenceRefs: string[];
  cooldownUntil: string | null;
}

export interface LegacyBeliefsState {
  beliefs: LegacyBelief[];
}

export function createEmptyBeliefsState(): LegacyBeliefsState {
  return { beliefs: [] };
}

function toIsoOrNow(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString();
  }
  return d.toISOString();
}

export function upsertBelief(
  state: LegacyBeliefsState,
  input: {
    id: string;
    proposition: string;
    confidence: number;
    evidenceRefs?: string[];
    cooldownHours?: number;
  },
  nowIso?: string
): { ok: true; state: LegacyBeliefsState } | { ok: false; reason: "cooldown_active" | "confidence_step_too_large" } {
  const now = new Date(toIsoOrNow(nowIso));
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const idx = state.beliefs.findIndex((b) => b.id === input.id);

  if (idx >= 0) {
    const prev = state.beliefs[idx];
    if (prev.cooldownUntil && new Date(prev.cooldownUntil).getTime() > now.getTime()) {
      return { ok: false, reason: "cooldown_active" };
    }
    if (Math.abs(confidence - prev.confidence) > BELIEF_MAX_CONFIDENCE_STEP + 1e-9) {
      return { ok: false, reason: "confidence_step_too_large" };
    }
  }

  const cooldownHours = Math.max(0, input.cooldownHours ?? 24);
  const cooldownUntil = new Date(now.getTime() + cooldownHours * 60 * 60 * 1000).toISOString();
  const beliefs = state.beliefs.slice();
  const next: LegacyBelief = {
    id: input.id,
    proposition: input.proposition,
    confidence,
    evidenceRefs: input.evidenceRefs ?? [],
    cooldownUntil,
  };
  if (idx >= 0) {
    beliefs[idx] = next;
  } else {
    beliefs.push(next);
  }
  return { ok: true, state: { beliefs } };
}
