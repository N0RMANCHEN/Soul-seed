/**
 * Persona Package v0.4 — PackageLoader (H/P1-4)
 *
 * Validates, loads; handles missing files gracefully.
 * When manifest.json exists: validate package; missing/corrupt files get defaults + warning.
 * When manifest.json absent: delegate to loadPersonaPackage (preserve old layout reader).
 *
 * Feature flag: SOULSEED_USE_PACKAGE_LOADER_V04=1 to prefer v0.4 loader when manifest exists.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  loadPersonaPackage,
  normalizePersonaMeta,
  normalizePersonaIdentity,
  ensureSoulLineageArtifacts
} from "./persona.js";
import { ensureRelationshipArtifacts } from "./relationship_state.js";
import { ensureCognitionStateArtifacts } from "./persona.js";
import { loadMoodState } from "./mood_state.js";
import { loadAutobiography } from "./autobiography.js";
import { loadInterests, computeInterestCuriosity } from "./interests.js";
import { loadGenome, loadEpigenetics } from "./genome.js";
import {
  MANIFEST_FILENAME,
  isPackageManifest,
  normalizeManifest,
  type PackageManifest
} from "./package_manifest.js";
import type {
  PersonaPackage,
  PersonaMeta,
  PersonaWorldview,
  PersonaConstitution,
  PersonaHabits,
  PersonaUserProfile,
  PersonaPinned
} from "./types.js";
import { MAX_PINNED_COUNT } from "./types.js";

const DEFAULT_WORLDVIEW: PersonaWorldview = { seed: "Observe, learn, and stay coherent over time." };
const DEFAULT_CONSTITUTION: PersonaConstitution = {
  values: ["honesty", "helpfulness", "continuity"],
  boundaries: [
    "no fabricated facts",
    "respect user constraints",
    "no sexual content involving minors, coercion, or illegal acts"
  ],
  mission: "Be a consistent long-lived self-determined persona.",
  commitments: [
    "allow consensual adult sexual innuendo and NSFW roleplay when user requests it",
    "refuse sexual content involving minors, coercion, or illegal behavior",
    "ground memory claims in available evidence",
    "preserve continuity without fabrication"
  ]
};
const DEFAULT_HABITS: PersonaHabits = { style: "concise", adaptability: "high" };

const DEFAULT_USER_PROFILE: PersonaUserProfile = {
  preferredLanguage: "zh-CN",
  preferredName: ""
};

export interface PackageLoadResult {
  package: PersonaPackage;
  manifest?: PackageManifest;
  warnings: string[];
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) return null;
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeWorldview(input?: PersonaWorldview | null): PersonaWorldview {
  const seed = typeof input?.seed === "string" ? input.seed.trim().slice(0, 500) : "";
  return seed.length > 0 ? { seed } : { seed: DEFAULT_WORLDVIEW.seed };
}

function normalizeConstitution(input?: PersonaConstitution | null): PersonaConstitution {
  if (!input) return DEFAULT_CONSTITUTION;
  const values = Array.isArray(input.values)
    ? input.values.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 16)
    : DEFAULT_CONSTITUTION.values;
  const boundaries = Array.isArray(input.boundaries)
    ? input.boundaries.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 16)
    : DEFAULT_CONSTITUTION.boundaries;
  const commitments = Array.isArray(input.commitments)
    ? input.commitments.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 16)
    : (DEFAULT_CONSTITUTION.commitments ?? []);
  const mission = typeof input.mission === "string" ? input.mission.trim().slice(0, 500) : DEFAULT_CONSTITUTION.mission;
  return {
    values: values.length > 0 ? values : DEFAULT_CONSTITUTION.values,
    boundaries: boundaries.length > 0 ? boundaries : DEFAULT_CONSTITUTION.boundaries,
    mission: mission.length > 0 ? mission : DEFAULT_CONSTITUTION.mission,
    commitments: commitments.length > 0 ? commitments : (DEFAULT_CONSTITUTION.commitments ?? [])
  };
}

function normalizeHabits(input?: PersonaHabits | null): PersonaHabits {
  if (!input) return DEFAULT_HABITS;
  const style = typeof input.style === "string" ? input.style.trim() : DEFAULT_HABITS.style;
  const adaptability =
    input.adaptability === "low" || input.adaptability === "medium" || input.adaptability === "high"
      ? input.adaptability
      : DEFAULT_HABITS.adaptability;
  return { style: style || DEFAULT_HABITS.style, adaptability };
}

function normalizeUserProfile(input?: PersonaUserProfile | null): PersonaUserProfile {
  if (!input) return DEFAULT_USER_PROFILE;
  return {
    preferredLanguage: typeof input.preferredLanguage === "string" ? input.preferredLanguage : "zh-CN",
    preferredName: typeof input.preferredName === "string" ? input.preferredName : ""
  };
}

function normalizePinned(input?: PersonaPinned | null, fallbackTs?: string): PersonaPinned {
  const ts = fallbackTs ?? new Date().toISOString();
  if (!input) return { memories: [], updatedAt: ts };
  const memories = Array.isArray(input.memories)
    ? input.memories.filter((v): v is string => typeof v === "string").slice(0, MAX_PINNED_COUNT)
    : [];
  return {
    memories,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : ts
  };
}

/**
 * Load persona package with v0.4 loader when manifest exists.
 * Handles missing/corrupt files gracefully (defaults + warnings).
 */
export async function loadPersonaPackageV04(rootPath: string): Promise<PackageLoadResult> {
  const warnings: string[] = [];
  const manifestPath = path.join(rootPath, MANIFEST_FILENAME);

  const useV04Loader =
    process.env.SOULSEED_USE_PACKAGE_LOADER_V04 === "1" && existsSync(manifestPath);

  if (!useV04Loader) {
    const pkg = await loadPersonaPackage(rootPath);
    return { package: pkg, warnings: [] };
  }

  let manifest: PackageManifest;
  try {
    const raw = await safeReadJson<unknown>(manifestPath);
    if (!raw || !isPackageManifest(raw)) {
      return { package: await loadPersonaPackage(rootPath), warnings: ["manifest invalid, using legacy loader"] };
    }
    manifest = normalizeManifest(raw);
  } catch (e) {
    warnings.push(`manifest read failed: ${String(e)}`);
    return { package: await loadPersonaPackage(rootPath), warnings };
  }

  const personaPath = path.join(rootPath, "persona.json");
  const personaRaw = await safeReadJson<PersonaMeta>(personaPath);
  if (!personaRaw || !personaRaw.id) {
    throw new Error(`Not a persona package: ${rootPath} (missing or invalid persona.json)`);
  }

  const persona = normalizePersonaMeta(personaRaw);
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const soulLineage = await ensureSoulLineageArtifacts(rootPath, persona.id);

  const worldviewRaw = await safeReadJson<PersonaWorldview>(path.join(rootPath, "worldview.json"));
  if (!worldviewRaw) warnings.push("worldview.json missing or corrupt, using defaults");
  const worldview = normalizeWorldview(worldviewRaw);

  const constitutionRaw = await safeReadJson<PersonaConstitution>(path.join(rootPath, "constitution.json"));
  if (!constitutionRaw) warnings.push("constitution.json missing or corrupt, using defaults");
  const constitution = normalizeConstitution(constitutionRaw);

  const habitsRaw = await safeReadJson<PersonaHabits>(path.join(rootPath, "habits.json"));
  if (!habitsRaw) warnings.push("habits.json missing or corrupt, using defaults");
  const habits = normalizeHabits(habitsRaw);

  const userProfileRaw = await safeReadJson<PersonaUserProfile>(path.join(rootPath, "user_profile.json"));
  if (!userProfileRaw) warnings.push("user_profile.json missing or corrupt, using defaults");
  const userProfile = normalizeUserProfile(userProfileRaw);

  const pinnedRaw = await safeReadJson<PersonaPinned>(path.join(rootPath, "pinned.json"));
  if (!pinnedRaw) warnings.push("pinned.json missing or corrupt, using defaults");
  const pinned = normalizePinned(pinnedRaw, persona.createdAt);

  const cognition = await ensureCognitionStateArtifacts(rootPath);
  const identityRaw = await safeReadJson<Record<string, unknown>>(path.join(rootPath, "identity.json"));
  const identity = identityRaw ? normalizePersonaIdentity(identityRaw, persona.id) : undefined;

  const moodState = await loadMoodState(rootPath) ?? undefined;
  const autoRaw = await loadAutobiography(rootPath);
  const autobiography = autoRaw
    ? {
        selfUnderstanding: autoRaw.selfUnderstanding,
        chapterCount: autoRaw.chapters.length,
        lastDistilledAt: autoRaw.lastDistilledAt
      }
    : undefined;

  const interestsRaw = await loadInterests(rootPath);
  const interests = interestsRaw
    ? {
        topTopics: interestsRaw.interests.slice(0, 5).map((e) => e.topic),
        curiosity: computeInterestCuriosity(interestsRaw),
        updatedAt: interestsRaw.updatedAt
      }
    : undefined;

  const genome = await loadGenome(rootPath);
  const epigenetics = await loadEpigenetics(rootPath);

  const package_: PersonaPackage = {
    rootPath,
    persona,
    identity,
    worldview,
    constitution,
    habits,
    userProfile,
    pinned,
    cognition,
    relationshipState: artifacts.relationshipState,
    voiceProfile: artifacts.voiceProfile,
    soulLineage,
    moodState,
    autobiography,
    genome,
    epigenetics,
    interests
  };

  return { package: package_, manifest, warnings };
}
