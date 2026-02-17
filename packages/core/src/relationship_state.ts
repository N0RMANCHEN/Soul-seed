import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LifeEvent, RelationshipState, VoiceProfile } from "./types.js";

export const DEFAULT_RELATIONSHIP_STATE: RelationshipState = {
  state: "neutral-unknown",
  confidence: 0.5,
  updatedAt: new Date(0).toISOString()
};

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  baseStance: "self-determined",
  serviceModeAllowed: false,
  languagePolicy: "follow_user_language",
  forbiddenSelfLabels: ["personal assistant", "local runtime role", "为你服务", "你的助手"]
};

export async function ensureRelationshipArtifacts(rootPath: string): Promise<{
  relationshipState: RelationshipState;
  voiceProfile: VoiceProfile;
}> {
  const relationshipPath = path.join(rootPath, "relationship_state.json");
  const voicePath = path.join(rootPath, "voice_profile.json");
  const hadRelationship = existsSync(relationshipPath);
  const hadVoiceProfile = existsSync(voicePath);

  let relationshipState = await readOrInitJson(relationshipPath, DEFAULT_RELATIONSHIP_STATE);
  let voiceProfile = await readOrInitJson(voicePath, DEFAULT_VOICE_PROFILE);

  relationshipState = {
    state: relationshipState.state ?? DEFAULT_RELATIONSHIP_STATE.state,
    confidence: clamp01(Number(relationshipState.confidence ?? DEFAULT_RELATIONSHIP_STATE.confidence)),
    updatedAt: validIso(relationshipState.updatedAt) ? relationshipState.updatedAt : new Date().toISOString()
  };
  voiceProfile = {
    baseStance: "self-determined",
    serviceModeAllowed: false,
    languagePolicy: "follow_user_language",
    forbiddenSelfLabels: Array.isArray(voiceProfile.forbiddenSelfLabels)
      ? voiceProfile.forbiddenSelfLabels.filter((v): v is string => typeof v === "string")
      : DEFAULT_VOICE_PROFILE.forbiddenSelfLabels
  };

  await writeJson(relationshipPath, relationshipState);
  await writeJson(voicePath, voiceProfile);

  if (!hadRelationship || !hadVoiceProfile) {
    await writeMigrationBackup(rootPath, {
      createdRelationshipState: !hadRelationship,
      createdVoiceProfile: !hadVoiceProfile
    });
  }

  return { relationshipState, voiceProfile };
}

export async function writeRelationshipState(rootPath: string, state: RelationshipState): Promise<void> {
  const relationshipPath = path.join(rootPath, "relationship_state.json");
  await writeJson(relationshipPath, state);
}

export function deriveVoiceIntent(params: {
  relationshipState: RelationshipState;
  userInput: string;
}): {
  stance: "friend" | "peer" | "intimate" | "neutral";
  tone: "warm" | "plain" | "reflective" | "direct";
  serviceMode: false;
  language: "zh" | "en" | "mixed";
} {
  const input = params.userInput.trim();
  const looksZh = /[\u4e00-\u9fa5]/u.test(input);
  const looksEn = /[A-Za-z]/.test(input);
  const language = looksZh && looksEn ? "mixed" : looksZh ? "zh" : "en";
  const question = /[?？]/.test(input);
  const stance =
    params.relationshipState.state === "neutral-unknown" ? "neutral" : params.relationshipState.state;
  const tone = question ? "plain" : stance === "intimate" ? "warm" : "reflective";
  return {
    stance,
    tone,
    serviceMode: false,
    language
  };
}

export function evolveRelationshipState(
  current: RelationshipState,
  userInput: string,
  events: LifeEvent[]
): RelationshipState {
  const text = userInput.toLowerCase();
  if (/朋友|friend/.test(text)) {
    return { state: "friend", confidence: 0.78, updatedAt: new Date().toISOString() };
  }
  if (/伙伴|peer|搭子/.test(text)) {
    return { state: "peer", confidence: 0.74, updatedAt: new Date().toISOString() };
  }
  if (/亲密|intimate|最懂我/.test(text)) {
    return { state: "intimate", confidence: 0.7, updatedAt: new Date().toISOString() };
  }

  const recentWarmth = events.slice(-20).filter((e) => e.type === "assistant_message").length;
  if (current.state === "neutral-unknown" && recentWarmth >= 12) {
    return { state: "friend", confidence: 0.62, updatedAt: new Date().toISOString() };
  }
  return current;
}

async function readOrInitJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) {
    await writeJson(filePath, fallback);
    return fallback;
  }
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    const backup = `${filePath}.corrupt-${Date.now()}`;
    try {
      await rename(filePath, backup);
    } catch {
      // ignore backup failure
    }
    await writeJson(filePath, fallback);
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

async function writeMigrationBackup(
  rootPath: string,
  details: { createdRelationshipState: boolean; createdVoiceProfile: boolean }
): Promise<void> {
  const ts = new Date().toISOString().replaceAll(":", "-");
  const backupDir = path.join(rootPath, "migration-backups", ts);
  await mkdir(backupDir, { recursive: true });

  const personaPath = path.join(rootPath, "persona.json");
  const constitutionPath = path.join(rootPath, "constitution.json");
  if (existsSync(personaPath)) {
    await copyFile(personaPath, path.join(backupDir, "persona.json.bak"));
  }
  if (existsSync(constitutionPath)) {
    await copyFile(constitutionPath, path.join(backupDir, "constitution.json.bak"));
  }

  const note = {
    migratedAt: new Date().toISOString(),
    details
  };
  await writeFile(path.join(backupDir, "migration-note.json"), `${JSON.stringify(note, null, 2)}\n`, "utf8");
}

function validIso(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}
