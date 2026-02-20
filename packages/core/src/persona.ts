import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { eventHash } from "./hash.js";
import { ingestLifeEventMemory } from "./memory_ingest.js";
import { ensureMemoryStore } from "./memory_store.js";
import {
  createInitialRelationshipState,
  ensureRelationshipArtifacts,
  writeRelationshipState
} from "./relationship_state.js";
import type {
  LifeEvent,
  LifeEventInput,
  MemoryMeta,
  PersonaHabits,
  PersonaConstitution,
  PersonaMeta,
  PersonaPackage,
  PersonaPinned,
  SoulLineage,
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

export async function initPersonaPackage(outPath: string, displayName: string): Promise<void> {
  await mkdir(outPath, { recursive: true });
  await mkdir(path.join(outPath, "summaries"), { recursive: true });
  await mkdir(path.join(outPath, "attachments"), { recursive: true });

  const personaId = randomUUID();
  const createdAt = isoNow();

  await writeJson(path.join(outPath, "persona.json"), {
    id: personaId,
    displayName,
    schemaVersion: "0.1.0",
    createdAt,
    paths: {
      identity: "identity.json",
      worldview: "worldview.json",
      constitution: "constitution.json",
      habits: "habits.json",
      userProfile: "user_profile.json",
      pinned: "pinned.json",
      soulLineage: "soul_lineage.json",
      lifeLog: "life.log.jsonl",
      memoryDb: "memory.db"
    }
  });

  await writeJson(path.join(outPath, "identity.json"), {
    personaId,
    anchors: {
      continuity: true
    }
  });

  await writeJson(path.join(outPath, "worldview.json"), {
    seed: "Observe, learn, and stay coherent over time."
  });

  await writeJson(path.join(outPath, "constitution.json"), {
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
  });

  await writeJson(path.join(outPath, "habits.json"), {
    style: "concise",
    adaptability: "high"
  });

  await writeJson(path.join(outPath, "user_profile.json"), {
    preferredLanguage: "zh-CN",
    preferredName: ""
  });

  await writeJson(path.join(outPath, "pinned.json"), {
    memories: [],
    updatedAt: createdAt
  });
  await writeJson(path.join(outPath, "soul_lineage.json"), createInitialSoulLineage(personaId));
  await writeJson(path.join(outPath, "relationship_state.json"), createInitialRelationshipState(createdAt));
  await writeJson(path.join(outPath, "voice_profile.json"), {
    baseStance: "self-determined",
    serviceModeAllowed: false,
    languagePolicy: "follow_user_language",
    forbiddenSelfLabels: ["personal assistant", "local runtime role", "为你服务", "你的助手"]
  });

  await writeJson(path.join(outPath, "summaries", "working_set.json"), {
    items: []
  });

  await writeJson(path.join(outPath, "summaries", "consolidated.json"), {
    items: []
  });

  await writeFile(path.join(outPath, "life.log.jsonl"), "", "utf8");
  await ensureMemoryStore(outPath);
}

export async function loadPersonaPackage(rootPath: string): Promise<PersonaPackage> {
  const persona = await readJson<PersonaMeta>(path.join(rootPath, "persona.json"));
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const soulLineage = await ensureSoulLineageArtifacts(rootPath, persona.id);
  const worldview = await readJson<PersonaWorldview>(path.join(rootPath, "worldview.json"));
  const constitution = await readJson<PersonaConstitution>(path.join(rootPath, "constitution.json"));
  const habits = await readJson<PersonaHabits>(path.join(rootPath, "habits.json"));
  const userProfile = await readJson<PersonaUserProfile>(path.join(rootPath, "user_profile.json"));
  const pinned = await readJson<PersonaPinned>(path.join(rootPath, "pinned.json"));

  return {
    rootPath,
    persona,
    worldview,
    constitution,
    habits,
    userProfile,
    pinned,
    relationshipState: artifacts.relationshipState,
    voiceProfile: artifacts.voiceProfile,
    soulLineage
  };
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
}> {
  const parentPkg = await loadPersonaPackage(params.parentPath);
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

  const inherited = await extractInheritedMemories(params.parentPath);
  await writeJson(path.join(childPersonaPath, "pinned.json"), {
    memories: inherited,
    updatedAt: new Date().toISOString()
  });

  const parentLineage = await ensureSoulLineageArtifacts(params.parentPath, parentPkg.persona.id);
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
    childPersonaPath
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
  const normalized = text.trim().slice(0, 240);
  if (!normalized) {
    return current;
  }
  const dedup = [...new Set([...(Array.isArray(current.memories) ? current.memories : []), normalized])].slice(
    0,
    32
  );
  const next: PersonaPinned = { memories: dedup, updatedAt: new Date().toISOString() };
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
    memories: (Array.isArray(current.memories) ? current.memories : []).filter((item) => item !== normalized),
    updatedAt: new Date().toISOString()
  };
  await writeJson(pinnedPath, next);
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
  }
): Promise<Record<string, unknown>> {
  const habitsPath = path.join(rootPath, "habits.json");
  const current = existsSync(habitsPath)
    ? await readJson<Record<string, unknown>>(habitsPath)
    : ({ style: "concise", adaptability: "high" } as Record<string, unknown>);
  const next: Record<string, unknown> = {
    ...current,
    ...(typeof patch.style === "string" ? { style: patch.style } : {}),
    ...(patch.adaptability ? { adaptability: patch.adaptability } : {})
  };
  await writeJson(habitsPath, next);
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
  await writeJson(voicePath, next);
  return next;
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
    consentMode: "default_consent"
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

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}
