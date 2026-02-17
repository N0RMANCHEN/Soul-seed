import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { eventHash } from "./hash.js";
import { ensureRelationshipArtifacts } from "./relationship_state.js";
import type {
  LifeEvent,
  LifeEventInput,
  MemoryMeta,
  PersonaConstitution,
  PersonaMeta,
  PersonaPackage,
  PersonaPinned,
  PersonaUserProfile
} from "./types.js";

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
      lifeLog: "life.log.jsonl"
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
    boundaries: ["no fabricated facts", "respect user constraints"],
    mission: "Be a consistent long-lived self-determined persona."
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
    memories: []
  });
  await writeJson(path.join(outPath, "relationship_state.json"), {
    state: "neutral-unknown",
    confidence: 0.5,
    updatedAt: createdAt
  });
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
}

export async function loadPersonaPackage(rootPath: string): Promise<PersonaPackage> {
  const artifacts = await ensureRelationshipArtifacts(rootPath);
  const persona = await readJson<PersonaMeta>(path.join(rootPath, "persona.json"));
  const constitution = await readJson<PersonaConstitution>(path.join(rootPath, "constitution.json"));
  const userProfile = await readJson<PersonaUserProfile>(path.join(rootPath, "user_profile.json"));
  const pinned = await readJson<PersonaPinned>(path.join(rootPath, "pinned.json"));

  return {
    rootPath,
    persona,
    constitution,
    userProfile,
    pinned,
    relationshipState: artifacts.relationshipState,
    voiceProfile: artifacts.voiceProfile
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

export interface WorkingSetItem {
  id: string;
  ts: string;
  sourceEventHashes: string[];
  summary: string;
}

export interface WorkingSetData {
  items: WorkingSetItem[];
  memoryWeights?: {
    activation: number;
    emotion: number;
    narrative: number;
  };
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
  const next: WorkingSetData = {
    ...current,
    items: [...current.items, item]
  };
  await writeWorkingSet(rootPath, next);
  return next;
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
