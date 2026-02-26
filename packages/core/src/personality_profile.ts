import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const PERSONALITY_PROFILE_FILENAME = "personality_profile.json";
export const PERSONALITY_PROFILE_SCHEMA_VERSION = "1.0";

export interface PersonalityProfile {
  schemaVersion: string;
  updatedAt: string;
  traits: {
    warmth: number;
    assertiveness: number;
    playfulness: number;
    patience: number;
  };
  drift: {
    maxStepPerUpdate: number;
    cooldownHours: number;
    lastDriftAt: string | null;
  };
}

function isoNow(): string {
  return new Date().toISOString();
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createDefaultPersonalityProfile(): PersonalityProfile {
  return {
    schemaVersion: PERSONALITY_PROFILE_SCHEMA_VERSION,
    updatedAt: isoNow(),
    traits: {
      warmth: 0.6,
      assertiveness: 0.45,
      playfulness: 0.35,
      patience: 0.65,
    },
    drift: {
      maxStepPerUpdate: 0.03,
      cooldownHours: 24,
      lastDriftAt: null,
    },
  };
}

export async function loadPersonalityProfile(rootPath: string): Promise<PersonalityProfile> {
  const filePath = path.join(rootPath, PERSONALITY_PROFILE_FILENAME);
  if (!existsSync(filePath)) {
    return createDefaultPersonalityProfile();
  }
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PersonalityProfile>;
    return normalizeProfile(parsed);
  } catch {
    return createDefaultPersonalityProfile();
  }
}

export async function savePersonalityProfile(rootPath: string, profile: PersonalityProfile): Promise<void> {
  const filePath = path.join(rootPath, PERSONALITY_PROFILE_FILENAME);
  const normalized = normalizeProfile(profile);
  normalized.updatedAt = isoNow();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export function applyPersonalityDrift(
  profile: PersonalityProfile,
  patch: Partial<PersonalityProfile["traits"]>,
  nowIso = isoNow(),
): { profile: PersonalityProfile; applied: boolean; reason?: string } {
  const normalized = normalizeProfile(profile);

  const cooldownMs = normalized.drift.cooldownHours * 60 * 60 * 1000;
  if (normalized.drift.lastDriftAt) {
    const last = Date.parse(normalized.drift.lastDriftAt);
    const now = Date.parse(nowIso);
    if (Number.isFinite(last) && Number.isFinite(now) && now - last < cooldownMs) {
      return {
        profile: normalized,
        applied: false,
        reason: "cooldown_active",
      };
    }
  }

  const maxStep = Math.max(0.005, Math.min(0.05, normalized.drift.maxStepPerUpdate));
  const nextTraits = { ...normalized.traits };
  let changed = false;

  for (const key of ["warmth", "assertiveness", "playfulness", "patience"] as const) {
    const target = patch[key];
    if (typeof target !== "number" || !Number.isFinite(target)) continue;

    const current = nextTraits[key];
    const delta = Math.max(-maxStep, Math.min(maxStep, target - current));
    if (Math.abs(delta) < 1e-6) continue;

    nextTraits[key] = clamp01(current + delta);
    changed = true;
  }

  if (!changed) {
    return { profile: normalized, applied: false, reason: "no_effective_change" };
  }

  return {
    profile: {
      ...normalized,
      updatedAt: nowIso,
      traits: nextTraits,
      drift: {
        ...normalized.drift,
        lastDriftAt: nowIso,
      },
    },
    applied: true,
  };
}

function normalizeProfile(raw: Partial<PersonalityProfile> | undefined): PersonalityProfile {
  const fallback = createDefaultPersonalityProfile();
  const traits = (raw?.traits ?? {}) as Partial<PersonalityProfile["traits"]>;
  const drift = (raw?.drift ?? {}) as Partial<PersonalityProfile["drift"]>;

  return {
    schemaVersion:
      typeof raw?.schemaVersion === "string" && raw.schemaVersion.trim().length > 0
        ? raw.schemaVersion
        : PERSONALITY_PROFILE_SCHEMA_VERSION,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : isoNow(),
    traits: {
      warmth: clamp01(toNum(traits.warmth, fallback.traits.warmth)),
      assertiveness: clamp01(toNum(traits.assertiveness, fallback.traits.assertiveness)),
      playfulness: clamp01(toNum(traits.playfulness, fallback.traits.playfulness)),
      patience: clamp01(toNum(traits.patience, fallback.traits.patience)),
    },
    drift: {
      maxStepPerUpdate: Math.max(0.005, Math.min(0.05, toNum(drift.maxStepPerUpdate, fallback.drift.maxStepPerUpdate))),
      cooldownHours: Math.max(1, Math.min(24 * 30, Math.round(toNum(drift.cooldownHours, fallback.drift.cooldownHours)))),
      lastDriftAt: typeof drift.lastDriftAt === "string" ? drift.lastDriftAt : null,
    },
  };
}

function toNum(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
