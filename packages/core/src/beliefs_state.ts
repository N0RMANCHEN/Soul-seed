import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BELIEFS_STATE_FILENAME = "beliefs.json";
export const BELIEFS_STATE_SCHEMA_VERSION = "1.0";
export const BELIEF_MAX_CONFIDENCE_STEP = 0.1;

export interface BeliefItem {
  id: string;
  proposition: string;
  confidence: number;
  evidenceRefs: string[];
  updatedAt: string;
  cooldownUntil: string | null;
}

export interface BeliefsState {
  schemaVersion: string;
  updatedAt: string;
  items: BeliefItem[];
}

function isoNow(): string {
  return new Date().toISOString();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createEmptyBeliefsState(): BeliefsState {
  return {
    schemaVersion: BELIEFS_STATE_SCHEMA_VERSION,
    updatedAt: isoNow(),
    items: [],
  };
}

export async function loadBeliefsState(rootPath: string): Promise<BeliefsState> {
  const filePath = path.join(rootPath, BELIEFS_STATE_FILENAME);
  if (!existsSync(filePath)) return createEmptyBeliefsState();

  try {
    const raw = await readFile(filePath, "utf8");
    return normalizeBeliefsState(JSON.parse(raw) as Partial<BeliefsState>);
  } catch {
    return createEmptyBeliefsState();
  }
}

export async function saveBeliefsState(rootPath: string, state: BeliefsState): Promise<void> {
  const filePath = path.join(rootPath, BELIEFS_STATE_FILENAME);
  const normalized = normalizeBeliefsState(state);
  normalized.updatedAt = isoNow();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export function upsertBelief(
  state: BeliefsState,
  patch: {
    id: string;
    proposition: string;
    confidence: number;
    evidenceRefs?: string[];
    cooldownHours?: number;
  },
  nowIso = isoNow(),
): { state: BeliefsState; ok: boolean; reason?: string } {
  const normalized = normalizeBeliefsState(state);
  const idx = normalized.items.findIndex((item) => item.id === patch.id);
  const nextConfidenceTarget = clamp01(patch.confidence);

  if (idx < 0) {
    const nextItem: BeliefItem = {
      id: patch.id,
      proposition: patch.proposition.trim().slice(0, 280),
      confidence: nextConfidenceTarget,
      evidenceRefs: (patch.evidenceRefs ?? []).filter((x) => typeof x === "string").slice(0, 12),
      updatedAt: nowIso,
      cooldownUntil: addHours(nowIso, patch.cooldownHours ?? 24),
    };
    return {
      ok: true,
      state: {
        ...normalized,
        updatedAt: nowIso,
        items: [...normalized.items, nextItem],
      },
    };
  }

  const current = normalized.items[idx];
  if (current.cooldownUntil && Date.parse(nowIso) < Date.parse(current.cooldownUntil)) {
    return { state: normalized, ok: false, reason: "cooldown_active" };
  }

  const delta = nextConfidenceTarget - current.confidence;
  if (Math.abs(delta) > BELIEF_MAX_CONFIDENCE_STEP) {
    return { state: normalized, ok: false, reason: "confidence_step_too_large" };
  }

  if ((patch.evidenceRefs ?? []).length === 0) {
    return { state: normalized, ok: false, reason: "missing_evidence" };
  }

  const nextItems = [...normalized.items];
  nextItems[idx] = {
    ...current,
    proposition: patch.proposition.trim().slice(0, 280),
    confidence: nextConfidenceTarget,
    evidenceRefs: (patch.evidenceRefs ?? []).filter((x) => typeof x === "string").slice(0, 12),
    updatedAt: nowIso,
    cooldownUntil: addHours(nowIso, patch.cooldownHours ?? 24),
  };

  return {
    ok: true,
    state: {
      ...normalized,
      updatedAt: nowIso,
      items: nextItems,
    },
  };
}

function normalizeBeliefsState(raw: Partial<BeliefsState> | undefined): BeliefsState {
  const items = Array.isArray(raw?.items)
    ? raw.items.map((item) => normalizeBeliefItem(item)).filter((item): item is BeliefItem => item !== null).slice(0, 200)
    : [];

  return {
    schemaVersion:
      typeof raw?.schemaVersion === "string" && raw.schemaVersion.trim().length > 0
        ? raw.schemaVersion
        : BELIEFS_STATE_SCHEMA_VERSION,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : isoNow(),
    items,
  };
}

function normalizeBeliefItem(raw: unknown): BeliefItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<BeliefItem>;
  if (typeof row.id !== "string" || row.id.trim().length === 0) return null;
  if (typeof row.proposition !== "string" || row.proposition.trim().length === 0) return null;

  return {
    id: row.id,
    proposition: row.proposition.trim().slice(0, 280),
    confidence: clamp01(typeof row.confidence === "number" ? row.confidence : 0.5),
    evidenceRefs: Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((x): x is string => typeof x === "string").slice(0, 12)
      : [],
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : isoNow(),
    cooldownUntil: typeof row.cooldownUntil === "string" ? row.cooldownUntil : null,
  };
}

function addHours(baseIso: string, hours: number): string {
  const baseTs = Date.parse(baseIso);
  if (!Number.isFinite(baseTs)) return isoNow();
  return new Date(baseTs + Math.max(1, hours) * 60 * 60 * 1000).toISOString();
}
