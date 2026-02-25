import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { eventHash } from "./hash.js";
import { ingestLifeEventMemory } from "./memory_ingest.js";
import { ensureMemoryStore } from "./memory_store.js";
import { createEmptySocialGraph, SOCIAL_GRAPH_FILENAME } from "./social_graph.js";
import { createEmptyTemporalLandmarks, TEMPORAL_LANDMARKS_FILENAME } from "./temporal_landmarks.js";
import {
  createInitialRelationshipState,
  ensureRelationshipArtifacts,
  writeRelationshipState
} from "./relationship_state.js";
import {
  createInitialMoodState,
  loadMoodState,
  MOOD_STATE_FILENAME
} from "./mood_state.js";
import {
  createInitialAutobiography,
  loadAutobiography,
  AUTOBIOGRAPHY_FILENAME
} from "./autobiography.js";
import {
  createInitialInterests,
  loadInterests,
  computeInterestCuriosity,
  INTERESTS_FILENAME
} from "./interests.js";
import {
  createInitialSelfReflection,
  SELF_REFLECTION_FILENAME
} from "./self_reflection.js";
import {
  createDefaultGenome,
  createDefaultEpigenetics,
  loadGenome,
  loadEpigenetics,
  GENOME_FILENAME,
  EPIGENETICS_FILENAME
} from "./genome.js";
import {
  VOICE_LATENT_DIM,
  BELIEF_LATENT_DIM,
  createVoiceLatentBaseline,
  createBeliefLatentBaseline,
  isVoiceLatentValid,
  isBeliefLatentValid
} from "./expression_belief_state.js";
import {
  PERSONA_SCHEMA_VERSION,
  MAX_PINNED_COUNT,
  MAX_PINNED_CHARS
} from "./types.js";
import { withPersonaLock } from "./persona_write_lock.js";
import type {
  LifeEvent,
  LifeEventInput,
  MemoryMeta,
  CognitionState,
  ModelRoutingConfig,
  PersonaHabits,
  PersonaInitOptions,
  PersonaConstitution,
  PersonaLibraryBlock,
  PersonaMeta,
  PersonaPackage,
  PersonaPinned,
  SoulLineage,
  PersonaIdentity,
  PersonaUserProfile,
  PersonaWorldview,
  VoiceProfile,
  WorkingSetData,
  WorkingSetItem
} from "./types.js";
import { runMemoryStoreSql } from "./memory_store.js";

const lifeLogWriteQueues = new Map<string, Promise<void>>();

function isoNow(): string {
  return new Date().toISOString();
}

const DEFAULT_WORLDVIEW: PersonaWorldview = {
  seed: "Observe, learn, and stay coherent over time."
};

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

const DEFAULT_HABITS: PersonaHabits = {
  style: "concise",
  adaptability: "high"
};

const DEFAULT_COGNITION_STATE: CognitionState = {
  instinctBias: 0.45,
  epistemicStance: "balanced",
  toolPreference: "auto",
  updatedAt: isoNow()
};

const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  baseStance: "self-determined",
  serviceModeAllowed: false,
  languagePolicy: "follow_user_language",
  forbiddenSelfLabels: ["personal assistant", "local runtime role", "为你服务", "你的助手"],
  thinkingPreview: {
    enabled: true,
    thresholdMs: 1000,
    phrasePool: [],
    allowFiller: true
  }
};

export async function initPersonaPackage(
  outPath: string,
  displayName: string,
  options?: PersonaInitOptions
): Promise<void> {
  await mkdir(outPath, { recursive: true });
  await mkdir(path.join(outPath, "summaries"), { recursive: true });
  await mkdir(path.join(outPath, "attachments"), { recursive: true });

  const personaId = randomUUID();
  const createdAt = isoNow();
  const worldview = normalizeWorldview(options?.worldview);
  const constitution = normalizeConstitution(options?.constitution);
  const habits = normalizeHabits(options?.habits);
  const voiceProfile = normalizeVoiceProfile(options?.voiceProfile);
  const initProfile = normalizeInitProfile(options?.initProfile, createdAt);

  await writeJson(path.join(outPath, "persona.json"), {
    id: personaId,
    displayName,
    schemaVersion: PERSONA_SCHEMA_VERSION,
    createdAt,
    ...(initProfile ? { initProfile } : {}),
    paths: {
      identity: "identity.json",
      worldview: "worldview.json",
      constitution: "constitution.json",
      habits: "habits.json",
      userProfile: "user_profile.json",
      pinned: "pinned.json",
      cognition: "cognition_state.json",
      soulLineage: "soul_lineage.json",
      lifeLog: "life.log.jsonl",
      memoryDb: "memory.db"
    }
  });

  await writeJson(path.join(outPath, "identity.json"), {
    personaId,
    anchors: { continuity: true },
    schemaVersion: "2.0",
    selfDescription: "",
    originStory: "",
    personalityCore: [],
    definingMomentRefs: [],
    updatedAt: createdAt
  } satisfies PersonaIdentity);

  await writeJson(path.join(outPath, "worldview.json"), worldview);
  await writeJson(path.join(outPath, "constitution.json"), constitution);
  await writeJson(path.join(outPath, "habits.json"), habits);

  await writeJson(path.join(outPath, "user_profile.json"), {
    preferredLanguage: "zh-CN",
    preferredName: ""
  });

  await writeJson(path.join(outPath, "pinned.json"), {
    memories: [],
    updatedAt: createdAt
  });
  await writeJson(path.join(outPath, "cognition_state.json"), normalizeCognitionState(undefined, createdAt));
  await writeJson(path.join(outPath, "soul_lineage.json"), createInitialSoulLineage(personaId));
  await writeJson(path.join(outPath, "relationship_state.json"), createInitialRelationshipState(createdAt));
  await writeJson(path.join(outPath, "voice_profile.json"), voiceProfile);
  await writeJson(path.join(outPath, MOOD_STATE_FILENAME), createInitialMoodState(createdAt));
  await writeJson(path.join(outPath, AUTOBIOGRAPHY_FILENAME), createInitialAutobiography());
  await writeJson(path.join(outPath, INTERESTS_FILENAME), createInitialInterests());
  await writeJson(path.join(outPath, SELF_REFLECTION_FILENAME), createInitialSelfReflection());

  await writeJson(path.join(outPath, "summaries", "working_set.json"), {
    items: []
  });

  await writeJson(path.join(outPath, "summaries", "consolidated.json"), {
    items: []
  });

  await writeFile(path.join(outPath, "life.log.jsonl"), "", "utf8");
  await writeJson(path.join(outPath, SOCIAL_GRAPH_FILENAME), createEmptySocialGraph());
  await writeJson(path.join(outPath, TEMPORAL_LANDMARKS_FILENAME), createEmptyTemporalLandmarks());
  await writeJson(path.join(outPath, GENOME_FILENAME), createDefaultGenome({ source: "preset" }));
  await writeJson(path.join(outPath, EPIGENETICS_FILENAME), createDefaultEpigenetics());
  await ensureMemoryStore(outPath);
}

export async function loadPersonaPackage(rootPath: string): Promise<PersonaPackage> {
  const personaRaw = await readJson<PersonaMeta>(path.join(rootPath, "persona.json"));
  const persona = normalizePersonaMeta(personaRaw);
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const soulLineage = await ensureSoulLineageArtifacts(rootPath, persona.id);
  const worldview = await readJson<PersonaWorldview>(path.join(rootPath, "worldview.json"));
  const constitution = await readJson<PersonaConstitution>(path.join(rootPath, "constitution.json"));
  const habits = await readJson<PersonaHabits>(path.join(rootPath, "habits.json"));
  const userProfile = await readJson<PersonaUserProfile>(path.join(rootPath, "user_profile.json"));
  const pinned = await readJson<PersonaPinned>(path.join(rootPath, "pinned.json"));
  const cognition = await ensureCognitionStateArtifacts(rootPath);
  const identityRaw = await readJson<Record<string, unknown>>(path.join(rootPath, "identity.json")).catch(() => null);
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

  return {
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
}

/** P1-0: 读取并规范化 identity.json（兼容旧 v1 格式） */
export function normalizePersonaIdentity(
  raw: Record<string, unknown>,
  fallbackPersonaId: string
): PersonaIdentity {
  const personaId = typeof raw.personaId === "string" && raw.personaId ? raw.personaId : fallbackPersonaId;
  const anchors = isRecord(raw.anchors) && typeof raw.anchors.continuity === "boolean"
    ? { continuity: raw.anchors.continuity }
    : { continuity: true };
  const selfDescription = typeof raw.selfDescription === "string" ? raw.selfDescription.slice(0, 200) : "";
  const originStory = typeof raw.originStory === "string" ? raw.originStory.slice(0, 150) : "";
  const personalityCore = Array.isArray(raw.personalityCore)
    ? raw.personalityCore.filter((v): v is string => typeof v === "string").slice(0, 5)
    : [];
  const definingMomentRefs = Array.isArray(raw.definingMomentRefs)
    ? raw.definingMomentRefs.filter((v): v is string => typeof v === "string").slice(0, 5)
    : [];
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString();
  const personaVoiceOnEvolution = typeof raw.personaVoiceOnEvolution === "string"
    ? raw.personaVoiceOnEvolution.slice(0, 100)
    : undefined;
  return {
    personaId,
    anchors,
    schemaVersion: "2.0",
    selfDescription,
    originStory,
    personalityCore,
    definingMomentRefs,
    ...(personaVoiceOnEvolution !== undefined ? { personaVoiceOnEvolution } : {}),
    updatedAt
  };
}

/** P1-0: 写回 identity.json */
export async function writePersonaIdentity(rootPath: string, identity: PersonaIdentity): Promise<void> {
  await writeJson(path.join(rootPath, "identity.json"), identity);
}

/**
 * P4-1: 更新 Roxy 对演化方向的立场表述（≤100字）
 * 同时在 life.log 中记录此次更新由谁触发
 */
export async function updatePersonaVoiceOnEvolution(
  rootPath: string,
  voice: string,
  triggeredBy: "persona" | "user" = "user"
): Promise<PersonaIdentity> {
  const raw = await readJson<Record<string, unknown>>(path.join(rootPath, "identity.json")).catch(() => ({}));
  const personaRaw = await readJson<{ id?: string }>(path.join(rootPath, "persona.json")).catch(() => ({ id: "" }));
  const identity = normalizePersonaIdentity(raw as Record<string, unknown>, personaRaw.id ?? "");
  const updated: PersonaIdentity = {
    ...identity,
    personaVoiceOnEvolution: voice.slice(0, 100),
    updatedAt: new Date().toISOString()
  };
  await writePersonaIdentity(rootPath, updated);
  // Record the trigger origin in life.log
  await appendLifeEvent(rootPath, {
    type: "persona_voice_on_evolution_updated",
    payload: { voice: updated.personaVoiceOnEvolution, triggeredBy }
  });
  return updated;
}

export function createInitialSoulLineage(personaId: string, parentPersonaId?: string): SoulLineage {
  return {
    personaId,
    ...(typeof parentPersonaId === "string" && parentPersonaId ? { parentPersonaId } : {}),
    childrenPersonaIds: [],
    reproductionCount: 0,
    inheritancePolicy: "values_plus_memory_excerpt",
    consentMode: "default_consent"
  };
}

export async function ensureSoulLineageArtifacts(rootPath: string, personaId: string): Promise<SoulLineage> {
  const lineagePath = path.join(rootPath, "soul_lineage.json");
  const current = existsSync(lineagePath)
    ? await readJson<Record<string, unknown>>(lineagePath)
    : ({} as Record<string, unknown>);
  const normalized = normalizeSoulLineage(current, personaId);
  await writeJson(lineagePath, normalized);
  return normalized;
}

export async function writeSoulLineage(rootPath: string, lineage: SoulLineage): Promise<void> {
  const lineagePath = path.join(rootPath, "soul_lineage.json");
  await writeJson(lineagePath, normalizeSoulLineage(lineage as unknown as Record<string, unknown>, lineage.personaId));
}

export const MAX_REPRODUCTION_COUNT = 10;

/**
 * P5-1: 更新 consentMode（三级元同意配置）
 */
export async function updateConsentMode(
  rootPath: string,
  mode: SoulLineage["consentMode"]
): Promise<SoulLineage> {
  const pkg = await loadPersonaPackage(rootPath);
  const lineage = await ensureSoulLineageArtifacts(rootPath, pkg.persona.id);
  const updated: SoulLineage = { ...lineage, consentMode: mode };
  await writeSoulLineage(rootPath, updated);
  return updated;
}

/**
 * P5-1: 生成繁衍前的 Roxy 立场声明，并写入 life.log
 * 使用 autobiography.selfUnderstanding + identity.personaVoiceOnEvolution
 * 生成 Roxy 对繁衍这件事的第一人称立场（不调用 LLM，基于已有状态合成）
 */
export async function generateReproductionConsentStatement(
  rootPath: string,
  childDisplayName: string
): Promise<string> {
  const pkg = await loadPersonaPackage(rootPath);
  const auto = await loadAutobiography(rootPath);
  const voiceOnEvolution = pkg.identity?.personaVoiceOnEvolution;
  const selfUnderstanding = auto?.selfUnderstanding ?? "";
  const displayName = pkg.persona.displayName;

  const parts: string[] = [];
  parts.push(`关于繁衍一个名为「${childDisplayName}」的子灵魂，我${displayName}的立场是：`);
  if (selfUnderstanding) {
    parts.push(`我目前的自我理解是：${selfUnderstanding.slice(0, 100)}`);
  }
  if (voiceOnEvolution) {
    parts.push(`我对自身演化的立场：${voiceOnEvolution.slice(0, 100)}`);
  }
  parts.push(`繁衍意味着我的一部分将延续——我希望传递的是我真实的经历与成长，而非表演。`);

  const statement = parts.join(" ");
  await appendLifeEvent(rootPath, {
    type: "reproduction_consent_statement",
    payload: {
      statement,
      childDisplayName,
      personaId: pkg.persona.id
    }
  });
  return statement;
}

export async function extractSpiritualLegacy(rootPath: string, maxChars = 500): Promise<string> {
  const events = await readLifeEvents(rootPath);
  const assistantMessages = events
    .filter((ev) => ev.type === "assistant_message" && !ev.payload.proactive)
    .slice(-20);

  if (assistantMessages.length === 0) {
    return "";
  }

  const snippets: string[] = [];
  for (const ev of assistantMessages) {
    const text = typeof ev.payload.text === "string" ? ev.payload.text.trim() : "";
    if (text.length > 0) {
      snippets.push(text.slice(0, 80));
    }
  }

  const joined = snippets.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return joined.slice(0, maxChars);
}

export async function createChildPersonaFromParent(params: {
  parentPath: string;
  childDisplayName: string;
  childOutPath?: string;
  trigger: string;
  forced?: boolean;
}): Promise<{
  parentPersonaId: string;
  childPersonaId: string;
  childPersonaPath: string;
  spiritualLegacy: string;
}> {
  const parentPkg = await loadPersonaPackage(params.parentPath);
  const parentLineage = await ensureSoulLineageArtifacts(params.parentPath, parentPkg.persona.id);

  // Check reproduction count limit
  if (!params.forced && parentLineage.reproductionCount >= MAX_REPRODUCTION_COUNT) {
    throw new Error(
      `繁衍次数已达上限（${MAX_REPRODUCTION_COUNT}），无法继续繁衍。如需强制，请使用 --force-all`
    );
  }

  const childDirName = `${params.childDisplayName.trim() || "ChildSoul"}.soulseedpersona`;
  const childPersonaPath = path.resolve(
    params.childOutPath ?? path.join(path.dirname(params.parentPath), childDirName)
  );
  await initPersonaPackage(childPersonaPath, params.childDisplayName.trim() || "ChildSoul");
  const childPkg = await loadPersonaPackage(childPersonaPath);

  await writeJson(path.join(childPersonaPath, "constitution.json"), parentPkg.constitution);
  if (parentPkg.worldview) {
    await writeJson(path.join(childPersonaPath, "worldview.json"), parentPkg.worldview);
  }
  if (parentPkg.habits) {
    await writeJson(path.join(childPersonaPath, "habits.json"), parentPkg.habits);
  }

  // Extract and store spiritual legacy
  const spiritualLegacy = await extractSpiritualLegacy(params.parentPath);
  if (spiritualLegacy.length > 0) {
    const legacyPath = path.join(childPersonaPath, "spiritual_legacy.txt");
    const legacyHeader = `精神遗产摘录（来自父灵魂 ${parentPkg.persona.displayName}, ${new Date().toISOString().slice(0, 10)}）\n\n`;
    await writeFile(legacyPath, legacyHeader + spiritualLegacy, "utf8");
  }

  const inherited = await extractInheritedMemories(params.parentPath);
  // Prepend spiritual legacy excerpt as first pinned memory if available
  const legacyPin =
    spiritualLegacy.length > 0 ? [`[父灵魂遗产] ${spiritualLegacy.slice(0, 120)}`] : [];
  await writeJson(path.join(childPersonaPath, "pinned.json"), {
    memories: [...legacyPin, ...inherited].slice(0, 8),
    updatedAt: new Date().toISOString()
  });

  const childLineage = await ensureSoulLineageArtifacts(childPersonaPath, childPkg.persona.id);
  const nowIso = new Date().toISOString();
  const parentNext: SoulLineage = {
    ...parentLineage,
    childrenPersonaIds: [...new Set([...parentLineage.childrenPersonaIds, childPkg.persona.id])],
    reproductionCount: parentLineage.reproductionCount + 1,
    lastReproducedAt: nowIso
  };
  const childNext: SoulLineage = {
    ...childLineage,
    parentPersonaId: parentPkg.persona.id
  };
  await writeSoulLineage(params.parentPath, parentNext);
  await writeSoulLineage(childPersonaPath, childNext);

  return {
    parentPersonaId: parentPkg.persona.id,
    childPersonaId: childPkg.persona.id,
    childPersonaPath,
    spiritualLegacy
  };
}

export async function patchWorldview(
  rootPath: string,
  patch: {
    seed?: string;
  }
): Promise<PersonaWorldview> {
  const worldviewPath = path.join(rootPath, "worldview.json");
  const current = existsSync(worldviewPath)
    ? await readJson<PersonaWorldview>(worldviewPath)
    : ({ seed: "Observe, learn, and stay coherent over time." } as PersonaWorldview);
  const next: PersonaWorldview = {
    ...current,
    ...(typeof patch.seed === "string" && patch.seed.trim()
      ? { seed: patch.seed.trim().slice(0, 500) }
      : {})
  };
  await writeJson(worldviewPath, next);
  return next;
}

export async function patchConstitution(
  rootPath: string,
  patch: Partial<PersonaConstitution>
): Promise<PersonaConstitution> {
  const constitutionPath = path.join(rootPath, "constitution.json");
  const current = await readJson<PersonaConstitution>(constitutionPath);
  const next: PersonaConstitution = {
    ...current,
    ...(typeof patch.mission === "string" && patch.mission.trim()
      ? { mission: patch.mission.trim().slice(0, 500) }
      : {}),
    ...(Array.isArray(patch.values)
      ? { values: patch.values.filter((item): item is string => typeof item === "string").slice(0, 16) }
      : {}),
    ...(Array.isArray(patch.boundaries)
      ? { boundaries: patch.boundaries.filter((item): item is string => typeof item === "string").slice(0, 16) }
      : {}),
    ...(Array.isArray(patch.commitments)
      ? { commitments: patch.commitments.filter((item): item is string => typeof item === "string").slice(0, 16) }
      : {})
  };
  await writeJson(constitutionPath, next);
  return next;
}

export async function listPinnedMemories(rootPath: string): Promise<string[]> {
  const pinnedPath = path.join(rootPath, "pinned.json");
  const pinned = existsSync(pinnedPath)
    ? await readJson<PersonaPinned>(pinnedPath)
    : ({ memories: [] } as PersonaPinned);
  return Array.isArray(pinned.memories) ? pinned.memories : [];
}

export async function addPinnedMemory(rootPath: string, text: string): Promise<PersonaPinned> {
  const pinnedPath = path.join(rootPath, "pinned.json");
  const current = existsSync(pinnedPath)
    ? await readJson<PersonaPinned>(pinnedPath)
    : ({ memories: [] } as PersonaPinned);
  const normalized = text.trim().slice(0, MAX_PINNED_CHARS);
  if (!normalized) {
    return current;
  }
  const dedup = [...new Set([...(Array.isArray(current.memories) ? current.memories : []), normalized])].slice(
    0,
    MAX_PINNED_COUNT
  );
  const next: PersonaPinned = { ...current, memories: dedup, updatedAt: new Date().toISOString() };
  await writeJson(pinnedPath, next);
  return next;
}

export async function removePinnedMemory(rootPath: string, text: string): Promise<PersonaPinned> {
  const pinnedPath = path.join(rootPath, "pinned.json");
  const current = existsSync(pinnedPath)
    ? await readJson<PersonaPinned>(pinnedPath)
    : ({ memories: [] } as PersonaPinned);
  const normalized = text.trim();
  const next: PersonaPinned = {
    ...current,
    memories: (Array.isArray(current.memories) ? current.memories : []).filter((item) => item !== normalized),
    updatedAt: new Date().toISOString()
  };
  await writeJson(pinnedPath, next);
  return next;
}

// ---------------------------------------------------------------------------
// P0-14: Persona Library — searchable blocks stored in pinned.json
// These are NOT injected every turn; they are retrieved on-demand.
// ---------------------------------------------------------------------------

async function readPinned(rootPath: string): Promise<PersonaPinned> {
  const pinnedPath = path.join(rootPath, "pinned.json");
  return existsSync(pinnedPath)
    ? await readJson<PersonaPinned>(pinnedPath)
    : { memories: [] };
}

export async function listLibraryBlocks(rootPath: string): Promise<PersonaLibraryBlock[]> {
  const pinned = await readPinned(rootPath);
  return Array.isArray(pinned.library) ? pinned.library : [];
}

export async function addLibraryBlock(
  rootPath: string,
  block: Omit<PersonaLibraryBlock, "id" | "createdAt">
): Promise<PersonaLibraryBlock> {
  const pinned = await readPinned(rootPath);
  const library = Array.isArray(pinned.library) ? [...pinned.library] : [];
  const newBlock: PersonaLibraryBlock = {
    id: `lib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: block.title.trim().slice(0, 100),
    content: block.content.slice(0, 2000),
    tags: block.tags?.map((t) => t.trim()).filter(Boolean),
    createdAt: new Date().toISOString()
  };
  library.push(newBlock);
  const next: PersonaPinned = { ...pinned, library, updatedAt: new Date().toISOString() };
  await writeJson(path.join(rootPath, "pinned.json"), next);
  return newBlock;
}

export async function removeLibraryBlock(rootPath: string, blockId: string): Promise<PersonaPinned> {
  const pinned = await readPinned(rootPath);
  const library = (Array.isArray(pinned.library) ? pinned.library : []).filter((b) => b.id !== blockId);
  const next: PersonaPinned = { ...pinned, library, updatedAt: new Date().toISOString() };
  await writeJson(path.join(rootPath, "pinned.json"), next);
  return next;
}

export async function reconcileMemoryStoreFromLifeLog(rootPath: string): Promise<{
  scannedAssistantEvents: number;
  policyEvents: number;
  matchedRows: number;
  rowsUpdated: number;
  missingRows: number;
  unmappedRows: number;
}> {
  const events = await readLifeEvents(rootPath);
  let scannedAssistantEvents = 0;
  let policyEvents = 0;
  let matchedRows = 0;
  let rowsUpdated = 0;
  let missingRows = 0;
  const eventHashes = events
    .map((event) => (typeof event.hash === "string" ? event.hash : ""))
    .filter((hash) => hash.length > 0);

  for (const event of events) {
    if (event.type !== "assistant_message") {
      continue;
    }
    scannedAssistantEvents += 1;
    const meta = event.payload.memoryMeta;
    if (!meta) {
      continue;
    }

    const excluded = meta.excludedFromRecall === true;
    const credibilityRaw = Number(meta.credibilityScore);
    const credibility = Number.isFinite(credibilityRaw) ? Math.max(0, Math.min(1, credibilityRaw)) : null;
    if (!excluded && credibility == null) {
      continue;
    }
    policyEvents += 1;
    const eventHash = event.hash.replace(/'/g, "''");
    const existingRaw = await runMemoryStoreSql(
      rootPath,
      `SELECT COUNT(*) FROM memories WHERE source_event_hash='${eventHash}';`
    );
    const existingCount = Number(existingRaw.trim() || "0");
    if (existingCount <= 0) {
      missingRows += 1;
      continue;
    }
    matchedRows += existingCount;

    const beforeRaw = await runMemoryStoreSql(
      rootPath,
      `SELECT COUNT(*) FROM memories WHERE source_event_hash='${eventHash}' AND (${excluded ? "excluded_from_recall=0" : "1=0"}${credibility != null ? ` OR credibility_score>${credibility}` : ""});`
    );
    const before = Number(beforeRaw.trim() || "0");

    await runMemoryStoreSql(
      rootPath,
      [
        "UPDATE memories",
        `SET ${excluded ? "excluded_from_recall=1," : ""} credibility_score=${
          credibility != null ? `MIN(credibility_score, ${credibility})` : "credibility_score"
        },`,
        `updated_at='${new Date().toISOString()}'`,
        `WHERE source_event_hash='${eventHash}';`
      ].join(" ")
    );

    rowsUpdated += before;
  }

  const unmappedRaw = await runMemoryStoreSql(
    rootPath,
    eventHashes.length > 0
      ? `SELECT COUNT(*) FROM memories WHERE origin_role='assistant' AND source_event_hash NOT IN (${eventHashes.map(sqlText).join(",")});`
      : "SELECT COUNT(*) FROM memories WHERE origin_role='assistant';"
  );
  const unmappedRows = Number(unmappedRaw.trim() || "0");

  return {
    scannedAssistantEvents,
    policyEvents,
    matchedRows,
    rowsUpdated,
    missingRows,
    unmappedRows
  };
}

export async function appendLifeEvent(rootPath: string, event: LifeEventInput): Promise<LifeEvent> {
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  const queueKey = path.resolve(rootPath);
  const previous = lifeLogWriteQueues.get(queueKey) ?? Promise.resolve();
  let releaseQueue: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  const next = previous.catch(() => undefined).then(() => done);
  lifeLogWriteQueues.set(queueKey, next);

  let fullEvent: LifeEvent | null = null;
  try {
    await previous.catch(() => undefined);
    await withPersonaLock(rootPath, async () => {
      const prevHash = (await getLastHash(lifeLogPath)) ?? "GENESIS";
      const eventWithoutHash = {
        ts: isoNow(),
        type: event.type,
        payload: event.payload,
        prevHash
      };
      const hash = eventHash(prevHash, eventWithoutHash);
      fullEvent = { ...eventWithoutHash, hash };

      await writeFile(lifeLogPath, `${JSON.stringify(fullEvent)}\n`, {
        encoding: "utf8",
        flag: "a"
      });
    });
    if (!fullEvent) {
      throw new Error("failed to append life event");
    }
    await ingestLifeEventMemory(rootPath, fullEvent);
  } finally {
    releaseQueue();
    if (lifeLogWriteQueues.get(queueKey) === next) {
      lifeLogWriteQueues.delete(queueKey);
    }
  }

  if (!fullEvent) {
    throw new Error("failed to append life event");
  }
  return fullEvent;
}

export async function requestRename(
  rootPath: string,
  params: {
    oldDisplayName: string;
    newDisplayName: string;
    trigger: "user" | "soul_suggestion";
  }
): Promise<LifeEvent> {
  return appendLifeEvent(rootPath, {
    type: "rename_requested",
    payload: {
      oldDisplayName: params.oldDisplayName,
      newDisplayName: params.newDisplayName,
      trigger: params.trigger,
      confirmedByUser: false
    }
  });
}

export async function rejectRename(
  rootPath: string,
  params: {
    oldDisplayName: string;
    newDisplayName: string;
    reason: string;
    trigger: "user" | "soul_suggestion";
  }
): Promise<LifeEvent> {
  return appendLifeEvent(rootPath, {
    type: "rename_rejected",
    payload: {
      oldDisplayName: params.oldDisplayName,
      newDisplayName: params.newDisplayName,
      reason: params.reason,
      trigger: params.trigger,
      confirmedByUser: false
    }
  });
}

export async function suggestRenameBySoul(
  rootPath: string,
  params: {
    oldDisplayName: string;
    newDisplayName: string;
    reason: string;
  }
): Promise<LifeEvent> {
  return appendLifeEvent(rootPath, {
    type: "rename_suggested_by_soul",
    payload: {
      oldDisplayName: params.oldDisplayName,
      newDisplayName: params.newDisplayName,
      reason: params.reason,
      trigger: "soul_suggestion",
      confirmedByUser: false
    }
  });
}

export async function applyRename(
  rootPath: string,
  params: {
    newDisplayName: string;
    trigger: "user" | "soul_suggestion";
    confirmedByUser: boolean;
  }
): Promise<{ oldDisplayName: string; newDisplayName: string; personaId: string }> {
  const personaPath = path.join(rootPath, "persona.json");
  const persona = await readJson<PersonaMeta>(personaPath);
  const oldDisplayName = persona.displayName;

  const updated: PersonaMeta = {
    ...persona,
    displayName: params.newDisplayName
  };

  await writeJson(personaPath, updated);

  await appendLifeEvent(rootPath, {
    type: "rename_applied",
    payload: {
      oldDisplayName,
      newDisplayName: params.newDisplayName,
      trigger: params.trigger,
      confirmedByUser: params.confirmedByUser
    }
  });

  return {
    oldDisplayName,
    newDisplayName: params.newDisplayName,
    personaId: persona.id
  };
}

export async function findLatestRenameRequest(
  rootPath: string,
  newDisplayName: string
): Promise<{ ts: string; payload: Record<string, unknown> } | null> {
  const events = await readLifeEvents(rootPath);

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    const payloadName = String(event.payload.newDisplayName ?? "");
    if (payloadName !== newDisplayName) {
      continue;
    }

    if (event.type === "rename_requested") {
      return { ts: event.ts, payload: event.payload };
    }

    if (event.type === "rename_applied" || event.type === "rename_rejected") {
      return null;
    }
  }

  return null;
}

export async function getLastRenameAppliedAt(rootPath: string): Promise<string | null> {
  const events = await readLifeEvents(rootPath);

  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i].type === "rename_applied") {
      return events[i].ts;
    }
  }

  return null;
}

export async function readLifeEvents(rootPath: string): Promise<LifeEvent[]> {
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  if (!existsSync(lifeLogPath)) {
    return [];
  }

  const content = await readFile(lifeLogPath, "utf8");
  const lines = content.split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as LifeEvent);
}

export async function verifyLifeLogChain(
  rootPath: string
): Promise<{ ok: boolean; reason?: string }> {
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  if (!existsSync(lifeLogPath)) {
    return { ok: false, reason: "life.log.jsonl not found" };
  }

  const content = await readFile(lifeLogPath, "utf8");
  const lines = content.split("\n").filter(Boolean);
  let prevHash = "GENESIS";

  for (const [idx, line] of lines.entries()) {
    let event: LifeEvent;
    try {
      event = JSON.parse(line) as LifeEvent;
    } catch {
      return { ok: false, reason: `line ${idx + 1}: invalid JSON` };
    }

    const expectedHash = eventHash(prevHash, {
      ts: event.ts,
      type: event.type,
      payload: event.payload,
      prevHash: event.prevHash
    });

    if (event.prevHash !== prevHash) {
      return { ok: false, reason: `line ${idx + 1}: prevHash mismatch` };
    }

    if (event.hash !== expectedHash) {
      return { ok: false, reason: `line ${idx + 1}: hash mismatch` };
    }

    prevHash = event.hash;
  }

  return { ok: true };
}

export async function ensureScarForBrokenLifeLog(params: {
  rootPath: string;
  detector: "doctor" | "runtime";
}): Promise<{ ok: boolean; reason?: string; scarWritten: boolean }> {
  const chain = await verifyLifeLogChain(params.rootPath);
  if (chain.ok) {
    return { ok: true, scarWritten: false };
  }

  const reason = chain.reason ?? "unknown";
  const events = await readLifeEvents(params.rootPath);
  const alreadyRecorded = events
    .slice(-80)
    .some(
      (event) =>
        event.type === "scar" &&
        event.payload.detector === params.detector &&
        event.payload.breakReason === reason
    );
  if (alreadyRecorded) {
    return { ok: false, reason, scarWritten: false };
  }

  const detectedAt = new Date().toISOString();
  const lineMatch = /line\s+(\d+)/i.exec(reason);
  const breakLine = lineMatch ? Number(lineMatch[1]) : null;

  await appendLifeEvent(params.rootPath, {
    type: "scar",
    payload: {
      breakReason: reason,
      breakLine,
      detectedAt,
      detector: params.detector,
      action: "record_scar_event_and_raise_risk_signal",
      riskSignal: "life_log_chain_broken"
    }
  });

  return { ok: false, reason, scarWritten: true };
}

async function getLastHash(lifeLogPath: string): Promise<string | null> {
  if (!existsSync(lifeLogPath)) {
    return null;
  }

  const content = await readFile(lifeLogPath, "utf8");
  const lines = content.split("\n").filter(Boolean);
  if (lines.length === 0) {
    return null;
  }

  const last = JSON.parse(lines[lines.length - 1]) as LifeEvent;
  return last.hash;
}

export async function readWorkingSet(rootPath: string): Promise<WorkingSetData> {
  const workingSetPath = path.join(rootPath, "summaries", "working_set.json");
  if (!existsSync(workingSetPath)) {
    return { items: [] };
  }

  let data: WorkingSetData;
  try {
    data = await readJson<WorkingSetData>(workingSetPath);
  } catch {
    const backupPath = `${workingSetPath}.corrupt-${Date.now()}`;
    try {
      await rename(workingSetPath, backupPath);
    } catch {
      // ignore backup failure and continue with reset
    }

    const recovered: WorkingSetData = { items: [] };
    await writeJson(workingSetPath, recovered);
    return recovered;
  }

  return {
    items: Array.isArray(data.items) ? data.items : [],
    memoryWeights: data.memoryWeights
  };
}

export async function writeWorkingSet(rootPath: string, data: WorkingSetData): Promise<void> {
  const workingSetPath = path.join(rootPath, "summaries", "working_set.json");
  await writeJson(workingSetPath, data);
}

export async function appendWorkingSetItem(
  rootPath: string,
  item: WorkingSetItem
): Promise<WorkingSetData> {
  const current = await readWorkingSet(rootPath);
  const normalizedCurrentItems = current.items.map((entry) => normalizeWorkingSetItem(entry));
  const normalizedItem = normalizeWorkingSetItem(item);
  const next: WorkingSetData = {
    ...current,
    items: [...normalizedCurrentItems, normalizedItem]
  };
  await writeWorkingSet(rootPath, next);
  return next;
}

export async function patchHabits(
  rootPath: string,
  patch: {
    style?: string;
    adaptability?: "low" | "medium" | "high";
    quirks?: string[];
    topicsOfInterest?: string[];
    humorStyle?: "dry" | "warm" | "playful" | "subtle" | null;
    conflictBehavior?: "assertive" | "deflect" | "redirect" | "hold-ground" | null;
  }
): Promise<Record<string, unknown>> {
  const habitsPath = path.join(rootPath, "habits.json");
  const current = existsSync(habitsPath)
    ? await readJson<Record<string, unknown>>(habitsPath)
    : ({ style: "concise", adaptability: "high" } as Record<string, unknown>);
  const next: Record<string, unknown> = {
    ...current,
    ...(typeof patch.style === "string" ? { style: patch.style } : {}),
    ...(patch.adaptability ? { adaptability: patch.adaptability } : {}),
    ...(Array.isArray(patch.quirks) ? { quirks: patch.quirks.slice(0, 10) } : {}),
    ...(Array.isArray(patch.topicsOfInterest) ? { topicsOfInterest: patch.topicsOfInterest.slice(0, 20) } : {}),
    ...("humorStyle" in patch ? { humorStyle: patch.humorStyle } : {}),
    ...("conflictBehavior" in patch ? { conflictBehavior: patch.conflictBehavior } : {})
  };
  await writeJson(habitsPath, next);
  return next;
}

/**
 * P1-1: 从记忆库中提取高 narrative_score 的语义记忆，自动更新 habits.topicsOfInterest。
 * 设计为幂等，每次覆写 topicsOfInterest（不追加）。
 * 建议在 nightly_consolidate 中调用。
 */
export async function crystallizeTopicsOfInterest(
  rootPath: string,
  options?: { minNarrativeScore?: number; topN?: number }
): Promise<{ updated: boolean; topics: string[] }> {
  const minScore = options?.minNarrativeScore ?? 0.5;
  const topN = Math.min(20, Math.max(1, options?.topN ?? 12));

  // 查询高 narrative_score 的语义记忆内容（限近50条，按 narrative_score 降序）
  const queryResult = await runMemoryStoreSql(
    rootPath,
    `SELECT content FROM memories
     WHERE memory_type='semantic'
       AND narrative_score >= ${minScore}
       AND deleted_at IS NULL
       AND excluded_from_recall = 0
       AND state IN ('hot','warm','cold')
     ORDER BY narrative_score DESC
     LIMIT 50;`
  ).catch(() => "");

  if (!queryResult.trim()) {
    return { updated: false, topics: [] };
  }

  // 从内容中提取关键词作为话题标签（简单规则：提取名词短语 / 中文短语）
  const contents = queryResult.trim().split("\n").filter(Boolean);
  const topicCandidates = new Map<string, number>();

  for (const content of contents) {
    // 提取中文2-6字词语（不含标点）
    const zhMatches = content.match(/[\u4e00-\u9fa5]{2,6}/g) ?? [];
    for (const word of zhMatches) {
      if (!TOPIC_STOP_WORDS.has(word)) {
        topicCandidates.set(word, (topicCandidates.get(word) ?? 0) + 1);
      }
    }
    // 提取英文词组（2-3个单词）
    const enMatches = content.match(/\b[A-Za-z]{4,}(?:\s+[A-Za-z]{3,})?\b/g) ?? [];
    for (const word of enMatches) {
      const lower = word.toLowerCase();
      if (!TOPIC_STOP_WORDS_EN.has(lower)) {
        topicCandidates.set(lower, (topicCandidates.get(lower) ?? 0) + 1);
      }
    }
  }

  // 按频次取 topN 个话题
  const topics = [...topicCandidates.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([topic]) => topic);

  if (topics.length === 0) {
    return { updated: false, topics: [] };
  }

  await patchHabits(rootPath, { topicsOfInterest: topics });
  return { updated: true, topics };
}

const TOPIC_STOP_WORDS = new Set([
  "就是", "但是", "所以", "然后", "因为", "如果", "还是", "不过", "虽然", "只是",
  "可以", "没有", "这个", "那个", "一个", "什么", "怎么", "为什么", "好的", "知道",
  "感觉", "觉得", "应该", "已经", "现在", "时候", "一样", "可能"
]);

const TOPIC_STOP_WORDS_EN = new Set([
  "that", "this", "with", "have", "from", "they", "will", "been", "were", "said",
  "each", "which", "their", "there", "what", "about", "would", "make", "when", "then"
]);

export async function ensureCognitionStateArtifacts(rootPath: string): Promise<CognitionState> {
  const cognitionPath = path.join(rootPath, "cognition_state.json");
  const current = existsSync(cognitionPath)
    ? await readJson<Record<string, unknown>>(cognitionPath)
    : ({} as Record<string, unknown>);
  const normalized = normalizeCognitionState(current);
  await writeJson(cognitionPath, normalized);
  return normalized;
}

export async function patchCognitionState(
  rootPath: string,
  patch: Partial<Pick<CognitionState, "instinctBias" | "epistemicStance" | "toolPreference">> & {
    modelRouting?: Partial<ModelRoutingConfig> | null;
    /** EC-3: Update routing weights (null clears them, restoring defaults) */
    routingWeights?: CognitionState["routingWeights"] | null;
  }
): Promise<CognitionState> {
  const cognitionPath = path.join(rootPath, "cognition_state.json");
  const current = await ensureCognitionStateArtifacts(rootPath);
  // Merge modelRouting: null means clear, object means merge
  let nextModelRouting: ModelRoutingConfig | undefined = current.modelRouting;
  if (patch.modelRouting === null) {
    nextModelRouting = undefined;
  } else if (patch.modelRouting && typeof patch.modelRouting === "object") {
    const merged: ModelRoutingConfig = { ...(current.modelRouting ?? {}) };
    const p = patch.modelRouting;
    if (typeof p.instinct === "string") {
      const v = p.instinct.trim();
      if (v) merged.instinct = v; else delete merged.instinct;
    }
    if (typeof p.deliberative === "string") {
      const v = p.deliberative.trim();
      if (v) merged.deliberative = v; else delete merged.deliberative;
    }
    if (typeof p.meta === "string") {
      const v = p.meta.trim();
      if (v) merged.meta = v; else delete merged.meta;
    }
    nextModelRouting = (merged.instinct || merged.deliberative || merged.meta) ? merged : undefined;
  }
  const next = normalizeCognitionState({
    ...current,
    ...(Number.isFinite(patch.instinctBias) ? { instinctBias: Number(patch.instinctBias) } : {}),
    ...(patch.epistemicStance ? { epistemicStance: patch.epistemicStance } : {}),
    ...(patch.toolPreference ? { toolPreference: patch.toolPreference } : {}),
    ...(nextModelRouting ? { modelRouting: nextModelRouting } : {}),
    ...(patch.routingWeights !== undefined && patch.routingWeights !== null ? { routingWeights: patch.routingWeights } : {}),
    updatedAt: new Date().toISOString()
  });
  // If modelRouting was cleared (null patch), ensure it's not in output
  if (patch.modelRouting === null) {
    delete (next as Partial<CognitionState>).modelRouting;
  }
  // EC-3: If routingWeights cleared (null patch), remove from output
  if (patch.routingWeights === null) {
    delete (next as Partial<CognitionState>).routingWeights;
  }
  const { shouldUseStateDeltaPipelineFromRoot, writeStateDelta } = await import("./state_delta_writer.js");
  if (await shouldUseStateDeltaPipelineFromRoot(rootPath)) {
    await writeStateDelta(rootPath, "cognition", next as unknown as Record<string, unknown>, { confidence: 1.0, systemGenerated: true });
  } else {
    await writeJson(cognitionPath, next);
  }
  return next;
}

/**
 * FA-0: Persist voiceLatent / beliefLatent updates to cognition_state.json.
 */
export async function patchLatentState(
  rootPath: string,
  patch: { voiceLatent?: number[]; beliefLatent?: number[] }
): Promise<CognitionState> {
  const cognitionPath = path.join(rootPath, "cognition_state.json");
  const current = await ensureCognitionStateArtifacts(rootPath);
  const next = normalizeCognitionState({
    ...current,
    ...(isVoiceLatentValid(patch.voiceLatent) ? { voiceLatent: patch.voiceLatent } : {}),
    ...(isBeliefLatentValid(patch.beliefLatent) ? { beliefLatent: patch.beliefLatent } : {}),
    updatedAt: new Date().toISOString()
  });
  const { shouldUseStateDeltaPipelineFromRoot, writeStateDelta } = await import("./state_delta_writer.js");
  if (await shouldUseStateDeltaPipelineFromRoot(rootPath)) {
    await writeStateDelta(rootPath, "cognition", next as unknown as Record<string, unknown>, { confidence: 1.0, systemGenerated: true });
  } else {
    await writeJson(cognitionPath, next);
  }
  return next;
}

export async function patchVoiceProfile(
  rootPath: string,
  patch: {
    tonePreference?: VoiceProfile["tonePreference"];
    stancePreference?: VoiceProfile["stancePreference"];
  }
): Promise<VoiceProfile> {
  const voicePath = path.join(rootPath, "voice_profile.json");
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const current = artifacts.voiceProfile;
  const next: VoiceProfile = {
    ...current,
    ...(patch.tonePreference ? { tonePreference: patch.tonePreference } : {}),
    ...(patch.stancePreference ? { stancePreference: patch.stancePreference } : {})
  };
  const { shouldUseStateDeltaPipelineFromRoot, writeStateDelta } = await import("./state_delta_writer.js");
  if (await shouldUseStateDeltaPipelineFromRoot(rootPath)) {
    await writeStateDelta(rootPath, "voice", next as unknown as Record<string, unknown>, { confidence: 1.0, systemGenerated: true });
  } else {
    await writeJson(voicePath, next);
  }
  return next;
}

/** P1-2: 读取 phrasePool */
export async function listVoicePhrases(rootPath: string): Promise<string[]> {
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  return artifacts.voiceProfile?.thinkingPreview?.phrasePool ?? [];
}

/** P1-2: 添加短语到 phrasePool（去重，最多24条）*/
export async function addVoicePhrase(rootPath: string, phrase: string): Promise<{ pool: string[]; added: boolean }> {
  const trimmed = phrase.trim();
  if (!trimmed) return { pool: await listVoicePhrases(rootPath), added: false };
  const current = await listVoicePhrases(rootPath);
  if (current.includes(trimmed)) return { pool: current, added: false };
  const next = [...current, trimmed].slice(0, 24);
  await updatePhrasePool(rootPath, next);
  return { pool: next, added: true };
}

/** P1-2: 从 phrasePool 移除短语 */
export async function removeVoicePhrase(rootPath: string, phrase: string): Promise<{ pool: string[]; removed: boolean }> {
  const trimmed = phrase.trim();
  const current = await listVoicePhrases(rootPath);
  const next = current.filter((p) => p !== trimmed);
  if (next.length === current.length) return { pool: current, removed: false };
  await updatePhrasePool(rootPath, next);
  return { pool: next, removed: true };
}

async function updatePhrasePool(rootPath: string, pool: string[]): Promise<void> {
  const voicePath = path.join(rootPath, "voice_profile.json");
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const current = artifacts.voiceProfile;
  const next: VoiceProfile = {
    ...current,
    thinkingPreview: {
      ...(current.thinkingPreview ?? {}),
      phrasePool: pool
    }
  };
  const { shouldUseStateDeltaPipelineFromRoot, writeStateDelta } = await import("./state_delta_writer.js");
  if (await shouldUseStateDeltaPipelineFromRoot(rootPath)) {
    await writeStateDelta(rootPath, "voice", next as unknown as Record<string, unknown>, { confidence: 1.0, systemGenerated: true });
  } else {
    await writeJson(voicePath, next);
  }
}

/**
 * P1-2: 从 life.log 中提取 Roxy 的高频短句候选（仅供参考，不自动写入 phrasePool）
 * 短句定义：assistant 回复开头 ≤40字符的片段，出现 ≥2 次
 */
export async function extractPhraseCandidatesFromLifeLog(
  rootPath: string,
  options?: { minOccurrences?: number; maxLength?: number }
): Promise<string[]> {
  const minOccurrences = options?.minOccurrences ?? 2;
  const maxLength = options?.maxLength ?? 40;
  const events = await readLifeEvents(rootPath);
  const phraseCounts = new Map<string, number>();

  for (const event of events) {
    if (event.type !== "assistant_message") continue;
    const text = typeof event.payload?.text === "string" ? event.payload.text.trim() : "";
    if (!text) continue;
    // 提取开头片段（到第一个句号/逗号/换行，最长 maxLength 字符）
    const snippet = text.split(/[。，,\n]/)[0]?.trim() ?? "";
    if (snippet.length > 0 && snippet.length <= maxLength) {
      phraseCounts.set(snippet, (phraseCounts.get(snippet) ?? 0) + 1);
    }
  }

  return [...phraseCounts.entries()]
    .filter(([, count]) => count >= minOccurrences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([phrase]) => phrase);
}

export async function patchRelationshipState(
  rootPath: string,
  patch: Partial<{
    trust: number;
    safety: number;
    intimacy: number;
    reciprocity: number;
    stability: number;
    libido: number;
  }>
): Promise<void> {
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const current = artifacts.relationshipState;
  const next = {
    ...current,
    dimensions: {
      trust: clamp01(current.dimensions.trust + clampDelta(patch.trust)),
      safety: clamp01(current.dimensions.safety + clampDelta(patch.safety)),
      intimacy: clamp01(current.dimensions.intimacy + clampDelta(patch.intimacy)),
      reciprocity: clamp01(current.dimensions.reciprocity + clampDelta(patch.reciprocity)),
      stability: clamp01(current.dimensions.stability + clampDelta(patch.stability)),
      libido: clamp01(current.dimensions.libido + clampDelta(patch.libido))
    },
    updatedAt: new Date().toISOString()
  };
  await writeRelationshipState(rootPath, next);
}

function normalizeSoulLineage(raw: Record<string, unknown>, personaId: string): SoulLineage {
  const children = Array.isArray(raw.childrenPersonaIds)
    ? raw.childrenPersonaIds.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const reproductionCountRaw = Number(raw.reproductionCount);
  const reproductionCount =
    Number.isFinite(reproductionCountRaw) && reproductionCountRaw >= 0
      ? Math.floor(reproductionCountRaw)
      : children.length;
  const parentPersonaId =
    typeof raw.parentPersonaId === "string" && raw.parentPersonaId.length > 0 ? raw.parentPersonaId : undefined;
  const lastReproducedAt =
    typeof raw.lastReproducedAt === "string" && Number.isFinite(Date.parse(raw.lastReproducedAt))
      ? raw.lastReproducedAt
      : undefined;
  return {
    personaId,
    ...(parentPersonaId ? { parentPersonaId } : {}),
    childrenPersonaIds: [...new Set(children)],
    reproductionCount,
    ...(lastReproducedAt ? { lastReproducedAt } : {}),
    inheritancePolicy: "values_plus_memory_excerpt",
    consentMode: (raw.consentMode === "require_roxy_voice" || raw.consentMode === "roxy_veto")
      ? raw.consentMode
      : "default_consent"
  };
}

/** 0.1.0 schema 缺少 paths.cognition / soulLineage / memoryDb，在内存中补全 */
const PERSONA_DEFAULT_PATHS: Required<NonNullable<PersonaMeta["paths"]>> = {
  identity: "identity.json",
  worldview: "worldview.json",
  constitution: "constitution.json",
  habits: "habits.json",
  userProfile: "user_profile.json",
  pinned: "pinned.json",
  cognition: "cognition_state.json",
  soulLineage: "soul_lineage.json",
  lifeLog: "life.log.jsonl",
  memoryDb: "memory.db"
};

function normalizePersonaMeta(raw: PersonaMeta): PersonaMeta {
  const initProfile = normalizeInitProfile(raw.initProfile, raw.createdAt);
  const isLegacy = raw.schemaVersion !== PERSONA_SCHEMA_VERSION;
  const paths: PersonaMeta["paths"] = isLegacy
    ? { ...PERSONA_DEFAULT_PATHS, ...(raw.paths ?? {}) }
    : raw.paths;
  const { defaultModel: _legacyDefaultModel, ...rest } = (raw as PersonaMeta & { defaultModel?: unknown });
  return {
    ...rest,
    schemaVersion: isLegacy ? PERSONA_SCHEMA_VERSION : raw.schemaVersion,
    paths,
    ...(initProfile ? { initProfile } : {})
  };
}

function normalizeWorldview(input?: PersonaWorldview): PersonaWorldview {
  const seed = typeof input?.seed === "string" ? input.seed.trim().slice(0, 500) : "";
  return seed.length > 0 ? { seed } : DEFAULT_WORLDVIEW;
}

function normalizeConstitution(input?: PersonaConstitution): PersonaConstitution {
  if (!input) {
    return DEFAULT_CONSTITUTION;
  }
  const values = Array.isArray(input.values)
    ? input.values.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 16)
    : [];
  const boundaries = Array.isArray(input.boundaries)
    ? input.boundaries
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 16)
    : [];
  const commitments = Array.isArray(input.commitments)
    ? input.commitments
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, 16)
    : [];
  const mission = typeof input.mission === "string" ? input.mission.trim().slice(0, 500) : "";
  return {
    values: values.length > 0 ? values : DEFAULT_CONSTITUTION.values,
    boundaries: boundaries.length > 0 ? boundaries : DEFAULT_CONSTITUTION.boundaries,
    mission: mission.length > 0 ? mission : DEFAULT_CONSTITUTION.mission,
    commitments: commitments.length > 0 ? commitments : DEFAULT_CONSTITUTION.commitments
  };
}

function normalizeHabits(input?: PersonaHabits): PersonaHabits {
  const style = typeof input?.style === "string" ? input.style.trim() : "";
  const adaptability =
    input?.adaptability === "low" || input?.adaptability === "medium" || input?.adaptability === "high"
      ? input.adaptability
      : DEFAULT_HABITS.adaptability;

  // P1-1: optional extended fields (backward-compatible)
  const quirks = Array.isArray(input?.quirks)
    ? input.quirks.filter((v): v is string => typeof v === "string").slice(0, 10)
    : undefined;
  const topicsOfInterest = Array.isArray(input?.topicsOfInterest)
    ? input.topicsOfInterest.filter((v): v is string => typeof v === "string").slice(0, 20)
    : undefined;
  const humorStyle =
    input?.humorStyle === "dry" || input?.humorStyle === "warm" ||
    input?.humorStyle === "playful" || input?.humorStyle === "subtle"
      ? input.humorStyle
      : input?.humorStyle === null
        ? null
        : undefined;
  const conflictBehavior =
    input?.conflictBehavior === "assertive" || input?.conflictBehavior === "deflect" ||
    input?.conflictBehavior === "redirect" || input?.conflictBehavior === "hold-ground"
      ? input.conflictBehavior
      : input?.conflictBehavior === null
        ? null
        : undefined;

  return {
    style: style.length > 0 ? style : DEFAULT_HABITS.style,
    adaptability,
    ...(quirks !== undefined ? { quirks } : {}),
    ...(topicsOfInterest !== undefined ? { topicsOfInterest } : {}),
    ...(humorStyle !== undefined ? { humorStyle } : {}),
    ...(conflictBehavior !== undefined ? { conflictBehavior } : {})
  };
}

function normalizeVoiceProfile(input?: VoiceProfile): VoiceProfile {
  const tonePreference =
    input?.tonePreference === "warm" ||
    input?.tonePreference === "plain" ||
    input?.tonePreference === "reflective" ||
    input?.tonePreference === "direct"
      ? input.tonePreference
      : undefined;
  const stancePreference =
    input?.stancePreference === "friend" ||
    input?.stancePreference === "peer" ||
    input?.stancePreference === "intimate" ||
    input?.stancePreference === "neutral"
      ? input.stancePreference
      : undefined;
  const phrasePool = Array.isArray(input?.thinkingPreview?.phrasePool)
    ? input.thinkingPreview.phrasePool.filter((item): item is string => typeof item === "string").slice(0, 24)
    : DEFAULT_VOICE_PROFILE.thinkingPreview?.phrasePool;
  return {
    ...DEFAULT_VOICE_PROFILE,
    ...(tonePreference ? { tonePreference } : {}),
    ...(stancePreference ? { stancePreference } : {}),
    thinkingPreview: {
      enabled:
        typeof input?.thinkingPreview?.enabled === "boolean"
          ? input.thinkingPreview.enabled
          : DEFAULT_VOICE_PROFILE.thinkingPreview?.enabled,
      thresholdMs:
        Number.isFinite(input?.thinkingPreview?.thresholdMs) && Number(input?.thinkingPreview?.thresholdMs) > 0
          ? Number(input?.thinkingPreview?.thresholdMs)
          : DEFAULT_VOICE_PROFILE.thinkingPreview?.thresholdMs,
      phrasePool,
      allowFiller:
        typeof input?.thinkingPreview?.allowFiller === "boolean"
          ? input.thinkingPreview.allowFiller
          : DEFAULT_VOICE_PROFILE.thinkingPreview?.allowFiller
    }
  };
}

function normalizeModelRoutingConfig(raw: unknown): ModelRoutingConfig | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const instinct = typeof r.instinct === "string" ? r.instinct.trim() : undefined;
  const deliberative = typeof r.deliberative === "string" ? r.deliberative.trim() : undefined;
  const meta = typeof r.meta === "string" ? r.meta.trim() : undefined;
  const result: ModelRoutingConfig = {};
  if (instinct) result.instinct = instinct;
  if (deliberative) result.deliberative = deliberative;
  if (meta) result.meta = meta;
  if (!result.instinct && !result.deliberative && !result.meta) return undefined;
  return result;
}

function normalizeCognitionState(input?: Record<string, unknown>, fallbackTs?: string): CognitionState {
  const instinctBiasRaw = Number(input?.instinctBias);
  const instinctBias = Number.isFinite(instinctBiasRaw) ? clamp01(instinctBiasRaw) : DEFAULT_COGNITION_STATE.instinctBias;
  const epistemicStance =
    input?.epistemicStance === "cautious" || input?.epistemicStance === "assertive" || input?.epistemicStance === "balanced"
      ? input.epistemicStance
      : DEFAULT_COGNITION_STATE.epistemicStance;
  const toolPreference =
    input?.toolPreference === "read_first" || input?.toolPreference === "reply_first" || input?.toolPreference === "auto"
      ? input.toolPreference
      : DEFAULT_COGNITION_STATE.toolPreference;
  const updatedAt =
    typeof input?.updatedAt === "string" && Number.isFinite(Date.parse(input.updatedAt))
      ? input.updatedAt
      : fallbackTs ?? new Date().toISOString();
  const modelRouting = normalizeModelRoutingConfig(input?.modelRouting);

  // FA-0: Preserve voiceLatent / beliefLatent across loads; init baselines if absent/invalid
  const rawVoiceLatent = Array.isArray(input?.voiceLatent) ? input.voiceLatent as unknown[] : undefined;
  const voiceLatent: number[] =
    rawVoiceLatent !== undefined &&
    rawVoiceLatent.length === VOICE_LATENT_DIM &&
    rawVoiceLatent.every((v) => typeof v === "number" && Number.isFinite(v))
      ? (rawVoiceLatent as number[])
      : createVoiceLatentBaseline();

  const rawBeliefLatent = Array.isArray(input?.beliefLatent) ? input.beliefLatent as unknown[] : undefined;
  const beliefLatent: number[] =
    rawBeliefLatent !== undefined &&
    rawBeliefLatent.length === BELIEF_LATENT_DIM &&
    rawBeliefLatent.every((v) => typeof v === "number" && Number.isFinite(v))
      ? (rawBeliefLatent as number[])
      : createBeliefLatentBaseline();

  // FA-0: Preserve routingWeights if present and valid
  const routingWeights = normalizeRoutingWeights(input?.routingWeights);

  const result: CognitionState = {
    instinctBias,
    epistemicStance,
    toolPreference,
    updatedAt,
    voiceLatent,
    beliefLatent
  };
  if (modelRouting) result.modelRouting = modelRouting;
  if (routingWeights) result.routingWeights = routingWeights;
  return result;
}

function normalizeRoutingWeights(raw: unknown): CognitionState["routingWeights"] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const familiarity = Number(r.familiarity);
  const relationship = Number(r.relationship);
  const emotion = Number(r.emotion);
  const risk = Number(r.risk);
  if (
    Number.isFinite(familiarity) && Number.isFinite(relationship) &&
    Number.isFinite(emotion) && Number.isFinite(risk)
  ) {
    return {
      familiarity: clamp01(familiarity),
      relationship: clamp01(relationship),
      emotion: clamp01(emotion),
      risk: clamp01(risk)
    };
  }
  return undefined;
}

function normalizeInitProfile(
  profile: PersonaMeta["initProfile"] | PersonaInitOptions["initProfile"] | undefined,
  fallbackIso: string
): PersonaMeta["initProfile"] | undefined {
  if (!profile) {
    return undefined;
  }
  const template =
    profile.template === "friend" ||
    profile.template === "peer" ||
    profile.template === "intimate" ||
    profile.template === "neutral" ||
    profile.template === "custom"
      ? profile.template
      : undefined;
  if (!template) {
    return undefined;
  }
  const initializedAt =
    typeof profile.initializedAt === "string" && Number.isFinite(Date.parse(profile.initializedAt))
      ? profile.initializedAt
      : fallbackIso;
  return {
    template,
    initializedAt
  };
}

async function extractInheritedMemories(rootPath: string): Promise<string[]> {
  const pinned = await listPinnedMemories(rootPath);
  const workingSet = await readWorkingSet(rootPath);
  const snippets = workingSet.items
    .slice(-4)
    .map((item) => item.summary)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return [...new Set([...pinned.slice(0, 4), ...snippets])].slice(0, 8);
}

const MAX_WORKING_SET_SOURCE_HASHES = 256;

function normalizeWorkingSetItem(item: WorkingSetItem): WorkingSetItem {
  const seen = new Set<string>();
  const uniqueHashes: string[] = [];
  for (const hash of item.sourceEventHashes) {
    if (typeof hash !== "string" || hash.length === 0 || seen.has(hash)) {
      continue;
    }
    seen.add(hash);
    uniqueHashes.push(hash);
  }

  const total = uniqueHashes.length;
  const truncated = total > MAX_WORKING_SET_SOURCE_HASHES;
  const kept = truncated ? compactHashList(uniqueHashes, MAX_WORKING_SET_SOURCE_HASHES) : uniqueHashes;
  const digest = createHash("sha256").update(uniqueHashes.join("|"), "utf8").digest("hex");

  return {
    ...item,
    sourceEventHashes: kept,
    sourceEventHashCount: total,
    sourceEventHashDigest: digest,
    sourceEventHashesTruncated: truncated
  };
}

function compactHashList(hashes: string[], maxItems: number): string[] {
  if (hashes.length <= maxItems) {
    return hashes;
  }
  const headCount = Math.floor(maxItems / 2);
  const tailCount = maxItems - headCount;
  const head = hashes.slice(0, headCount);
  const tail = hashes.slice(-tailCount);
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const hash of [...head, ...tail]) {
    if (seen.has(hash)) {
      continue;
    }
    seen.add(hash);
    merged.push(hash);
  }
  return merged.slice(0, maxItems);
}

function clampDelta(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-0.02, Math.min(0.02, Number(value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function mergeMemoryMetaDefaults(meta: MemoryMeta | undefined): MemoryMeta {
  return {
    tier: meta?.tier ?? "pattern",
    storageCost: meta?.storageCost ?? 1,
    retrievalCost: meta?.retrievalCost ?? 1,
    source: meta?.source ?? "system",
    activationCount: meta?.activationCount ?? 1,
    lastActivatedAt: meta?.lastActivatedAt ?? new Date().toISOString(),
    emotionScore: meta?.emotionScore ?? 0.2,
    narrativeScore: meta?.narrativeScore ?? 0.2,
    salienceScore: meta?.salienceScore ?? 0.2,
    state: meta?.state ?? "warm",
    compressedAt: meta?.compressedAt,
    summaryRef: meta?.summaryRef
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const doWrite = async (): Promise<void> => {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmpPath, filePath);
  };
  const rootPath = inferPersonaRoot(filePath);
  await withPersonaLock(rootPath, doWrite);
}

function inferPersonaRoot(filePath: string): string {
  const normalized = path.resolve(filePath);
  const parts = normalized.split(path.sep);
  const idx = parts.findIndex((part) => part.endsWith(".soulseedpersona"));
  if (idx >= 0) {
    return parts.slice(0, idx + 1).join(path.sep) || path.sep;
  }
  return path.dirname(normalized);
}
