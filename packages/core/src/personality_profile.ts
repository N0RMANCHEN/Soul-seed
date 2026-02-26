/**
 * Personality Profile — trait baselines distinct from Genome (H/P1-0).
 * Genome traits are sensitivity/retention params; personality traits are openness, agreeableness, assertiveness.
 * Hb-1-3: Temperament section — susceptibility to mood shifts (Layer 3).
 * Personality drift goes through Epigenetics gate (evidence, cooldown, bounded).
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const PERSONALITY_PROFILE_FILENAME = "personality_profile.json";
export const PERSONALITY_PROFILE_SCHEMA_VERSION = "1.1";

export interface TemperamentSection {
  /** Susceptibility to mood shifts [0,1]; higher = more reactive */
  moodSusceptibility: number;
}

export interface PersonalityProfile {
  schemaVersion: string;
  updatedAt: string;
  openness: number;
  agreeableness: number;
  assertiveness: number;
  // Legacy-compatible shape consumed by existing tests.
  traits: {
    warmth: number;
    assertiveness: number;
  };
  drift: {
    maxStepPerUpdate: number;
    cooldownHours: number;
  };
  lastDriftAt?: string;
  /** Hb-1-3 Layer 3: Temperament (weeks/months timescale) */
  temperament?: TemperamentSection;
}

const DEFAULT_TEMPERAMENT: TemperamentSection = {
  moodSusceptibility: 0.5,
};

export function createDefaultPersonalityProfile(updatedAt?: string): PersonalityProfile {
  const now = updatedAt ?? new Date().toISOString();
  return {
    schemaVersion: PERSONALITY_PROFILE_SCHEMA_VERSION,
    updatedAt: now,
    openness: 0.5,
    agreeableness: 0.5,
    assertiveness: 0.5,
    traits: {
      warmth: 0.5,
      assertiveness: 0.5,
    },
    drift: {
      maxStepPerUpdate: 0.1,
      cooldownHours: 24,
    },
    lastDriftAt: undefined,
    temperament: DEFAULT_TEMPERAMENT,
  };
}

export function normalizeTemperament(raw: unknown): TemperamentSection {
  if (raw && typeof raw === "object" && "moodSusceptibility" in raw) {
    const t = raw as Record<string, unknown>;
    const v = typeof t.moodSusceptibility === "number" ? t.moodSusceptibility : 0.5;
    return { moodSusceptibility: Math.max(0, Math.min(1, v)) };
  }
  return DEFAULT_TEMPERAMENT;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
}

export function normalizePersonalityProfile(raw: unknown, updatedAt?: string): PersonalityProfile {
  const base = createDefaultPersonalityProfile(updatedAt);
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const obj = raw as Record<string, unknown>;
  const traitsRaw = obj.traits && typeof obj.traits === "object" ? (obj.traits as Record<string, unknown>) : {};
  const driftRaw = obj.drift && typeof obj.drift === "object" ? (obj.drift as Record<string, unknown>) : {};
  const warmth = clamp01(Number(traitsRaw.warmth ?? base.traits.warmth));
  const assertivenessTrait = clamp01(Number(traitsRaw.assertiveness ?? obj.assertiveness ?? base.traits.assertiveness));
  const profile: PersonalityProfile = {
    schemaVersion: String(obj.schemaVersion ?? base.schemaVersion),
    updatedAt: String(obj.updatedAt ?? base.updatedAt),
    openness: clamp01(Number(obj.openness ?? base.openness)),
    agreeableness: clamp01(Number(obj.agreeableness ?? base.agreeableness)),
    assertiveness: assertivenessTrait,
    traits: {
      warmth,
      assertiveness: assertivenessTrait,
    },
    drift: {
      maxStepPerUpdate: Math.max(0, Number(driftRaw.maxStepPerUpdate ?? base.drift.maxStepPerUpdate)),
      cooldownHours: Math.max(0, Number(driftRaw.cooldownHours ?? base.drift.cooldownHours)),
    },
    lastDriftAt: typeof obj.lastDriftAt === "string" ? obj.lastDriftAt : undefined,
    temperament: normalizeTemperament(obj.temperament),
  };
  return profile;
}

export async function savePersonalityProfile(personaRoot: string, profile: PersonalityProfile): Promise<void> {
  const filePath = join(personaRoot, PERSONALITY_PROFILE_FILENAME);
  const normalized = normalizePersonalityProfile(profile);
  normalized.updatedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), "utf-8");
}

export async function loadPersonalityProfile(personaRoot: string): Promise<PersonalityProfile> {
  const filePath = join(personaRoot, PERSONALITY_PROFILE_FILENAME);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return normalizePersonalityProfile(JSON.parse(raw));
  } catch {
    return createDefaultPersonalityProfile();
  }
}

export function applyPersonalityDrift(
  profile: PersonalityProfile,
  target: Partial<Record<keyof PersonalityProfile["traits"], number>>,
  nowIso?: string
): { applied: true; profile: PersonalityProfile } | { applied: false; reason: "cooldown_active"; profile: PersonalityProfile } {
  const now = new Date(nowIso ?? new Date().toISOString());
  const normalized = normalizePersonalityProfile(profile);
  if (normalized.lastDriftAt) {
    const last = new Date(normalized.lastDriftAt);
    const elapsedMs = now.getTime() - last.getTime();
    if (elapsedMs < normalized.drift.cooldownHours * 60 * 60 * 1000) {
      return { applied: false, reason: "cooldown_active", profile: normalized };
    }
  }
  const maxStep = normalized.drift.maxStepPerUpdate;
  const nextTraits = { ...normalized.traits };
  for (const key of Object.keys(target) as Array<keyof PersonalityProfile["traits"]>) {
    const desired = clamp01(Number(target[key]));
    const current = nextTraits[key];
    const delta = Math.max(-maxStep, Math.min(maxStep, desired - current));
    nextTraits[key] = clamp01(current + delta);
  }
  const nextProfile: PersonalityProfile = {
    ...normalized,
    updatedAt: now.toISOString(),
    assertiveness: nextTraits.assertiveness,
    traits: nextTraits,
    lastDriftAt: now.toISOString(),
  };
  return { applied: true, profile: nextProfile };
}
