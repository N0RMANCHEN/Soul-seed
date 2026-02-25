/**
 * Personality Profile — trait baselines distinct from Genome (H/P1-0).
 * Genome traits are sensitivity/retention params; personality traits are openness, agreeableness, assertiveness.
 * Personality drift goes through Epigenetics gate (evidence, cooldown, bounded).
 */
export const PERSONALITY_PROFILE_FILENAME = "personality_profile.json";
export const PERSONALITY_PROFILE_SCHEMA_VERSION = "1.0";

export interface PersonalityProfile {
  schemaVersion: string;
  updatedAt: string;
  openness: number;
  agreeableness: number;
  assertiveness: number;
}

export function createDefaultPersonalityProfile(updatedAt?: string): PersonalityProfile {
  const now = updatedAt ?? new Date().toISOString();
  return {
    schemaVersion: PERSONALITY_PROFILE_SCHEMA_VERSION,
    updatedAt: now,
    openness: 0.5,
    agreeableness: 0.5,
    assertiveness: 0.5,
  };
}
