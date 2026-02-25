/**
 * Beliefs State Module — first-class state for world-model propositions.
 * H/P1-1: Goals / Beliefs State Module.
 * Schema per doc/plans/H2-State-Modules.md §3.2.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const BELIEFS_SCHEMA_VERSION = "1.0";

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
