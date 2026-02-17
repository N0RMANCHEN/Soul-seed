import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { eventHash } from "./hash.js";
import type {
  LifeEvent,
  LifeEventInput,
  PersonaConstitution,
  PersonaMeta,
  PersonaPackage,
  PersonaPinned,
  PersonaUserProfile
} from "./types.js";

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
    mission: "Be a consistent long-lived assistant."
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

  await writeJson(path.join(outPath, "summaries", "working_set.json"), {
    items: []
  });

  await writeJson(path.join(outPath, "summaries", "consolidated.json"), {
    items: []
  });

  await writeFile(path.join(outPath, "life.log.jsonl"), "", "utf8");
}

export async function loadPersonaPackage(rootPath: string): Promise<PersonaPackage> {
  const persona = await readJson<PersonaMeta>(path.join(rootPath, "persona.json"));
  const constitution = await readJson<PersonaConstitution>(path.join(rootPath, "constitution.json"));
  const userProfile = await readJson<PersonaUserProfile>(path.join(rootPath, "user_profile.json"));
  const pinned = await readJson<PersonaPinned>(path.join(rootPath, "pinned.json"));

  return {
    rootPath,
    persona,
    constitution,
    userProfile,
    pinned
  };
}

export async function appendLifeEvent(rootPath: string, event: LifeEventInput): Promise<LifeEvent> {
  const lifeLogPath = path.join(rootPath, "life.log.jsonl");
  const prevHash = (await getLastHash(lifeLogPath)) ?? "GENESIS";

  const eventWithoutHash = {
    ts: isoNow(),
    type: event.type,
    payload: event.payload,
    prevHash
  };
  const hash = eventHash(prevHash, eventWithoutHash);
  const fullEvent: LifeEvent = { ...eventWithoutHash, hash };

  await writeFile(lifeLogPath, `${JSON.stringify(fullEvent)}\n`, {
    encoding: "utf8",
    flag: "a"
  });

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

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}
