/**
 * Personality Profile — trait baselines distinct from Genome (H/P1-0).
 * Genome traits are sensitivity/retention params; personality traits are openness, agreeableness, assertiveness.
 * Hb-1-3: Temperament section — susceptibility to mood shifts (Layer 3).
 * Personality drift goes through Epigenetics gate (evidence, cooldown, bounded).
 */
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
