import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  LifeEvent,
  RelationshipDimensions,
  RelationshipDriver,
  RelationshipState,
  VoiceProfile
} from "./types.js";

const RELATIONSHIP_IDLE_GRACE_MS = 20 * 60 * 1000;
const RELATIONSHIP_DECAY_INTERVAL_MS = 60 * 60 * 1000;
const RELATIONSHIP_DECAY_PER_IDLE_INTERVAL = 0.002;
const MAX_DELTA_PER_DIMENSION = 0.03;
const MAX_DRIVERS = 5;

const RELATIONSHIP_DIMENSION_BASELINE: RelationshipDimensions = {
  trust: 0.45,
  safety: 0.48,
  intimacy: 0.25,
  reciprocity: 0.35,
  stability: 0.45
};

export const DEFAULT_RELATIONSHIP_STATE: RelationshipState = createInitialRelationshipState();

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

  const rawRelationship = await readOrInitJson<Record<string, unknown>>(
    relationshipPath,
    DEFAULT_RELATIONSHIP_STATE as unknown as Record<string, unknown>
  );
  const rawVoice = await readOrInitJson<Record<string, unknown>>(
    voicePath,
    DEFAULT_VOICE_PROFILE as unknown as Record<string, unknown>
  );

  const relationshipState = normalizeRelationshipState(rawRelationship);
  const voiceProfile = normalizeVoiceProfile(rawVoice);

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
  await writeJson(relationshipPath, normalizeRelationshipState(state as unknown as Record<string, unknown>));
}

export function createInitialRelationshipState(updatedAt?: string): RelationshipState {
  return buildRelationshipState({
    dimensions: RELATIONSHIP_DIMENSION_BASELINE,
    drivers: [],
    updatedAt: updatedAt && validIso(updatedAt) ? updatedAt : new Date(0).toISOString()
  });
}

export function deriveVoiceIntent(params: {
  relationshipState: RelationshipState;
  userInput: string;
  preferredLanguage?: string;
}): {
  stance: "friend" | "peer" | "intimate" | "neutral";
  tone: "warm" | "plain" | "reflective" | "direct";
  serviceMode: false;
  language: "zh" | "en" | "mixed";
} {
  const input = params.userInput.trim();
  const looksZh = /[\u4e00-\u9fa5]/u.test(input);
  const looksEn = /[A-Za-z]/.test(input);
  const language =
    looksZh && looksEn
      ? "mixed"
      : looksZh
        ? "zh"
        : looksEn
          ? "en"
          : params.preferredLanguage?.startsWith("zh")
            ? "zh"
            : "en";
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
  _events: LifeEvent[]
): RelationshipState {
  const normalizedCurrent = normalizeRelationshipState(current as unknown as Record<string, unknown>);
  const deltas: Partial<RelationshipDimensions> = {};
  const signals: string[] = [];
  const text = userInput.trim();
  const lowered = text.toLowerCase();

  const positivePattern =
    /谢谢|感谢|辛苦|喜欢|信任|支持|懂你|good|great|thanks|trust|appreciate|cooperate|together/i;
  const negativePattern = /笨|傻|讨厌|烦|失望|滚|闭嘴|hate|stupid|annoy|useless|worst/i;
  const intimatePattern = /亲密|最懂我|爱你|老婆|宝贝|intimate|love you|dear/i;
  const peerPattern = /伙伴|搭子|并肩|peer|teammate/i;
  const friendPattern = /朋友|friend/i;

  if (positivePattern.test(text)) {
    addDelta(deltas, "trust", 0.015);
    addDelta(deltas, "safety", 0.01);
    addDelta(deltas, "reciprocity", 0.012);
    signals.push("user_positive_affect");
  }
  if (negativePattern.test(text)) {
    addDelta(deltas, "safety", -0.02);
    addDelta(deltas, "trust", -0.015);
    addDelta(deltas, "stability", -0.008);
    signals.push("user_negative_affect");
  }
  if (intimatePattern.test(text)) {
    addDelta(deltas, "intimacy", 0.018);
    addDelta(deltas, "trust", 0.006);
    signals.push("user_intimacy_signal");
  } else if (peerPattern.test(text)) {
    addDelta(deltas, "reciprocity", 0.014);
    addDelta(deltas, "stability", 0.01);
    signals.push("user_peer_signal");
  } else if (friendPattern.test(text)) {
    addDelta(deltas, "trust", 0.01);
    addDelta(deltas, "intimacy", 0.01);
    signals.push("user_friend_signal");
  }
  if (/[?？]/.test(text)) {
    addDelta(deltas, "safety", 0.004);
    signals.push("user_clarifying_question");
  }
  if (text.length <= 2 || /^嗯|ok|好的|好吧$/i.test(lowered)) {
    signals.push("user_low_information_turn");
  }

  return evolveWithSignal(normalizedCurrent, "user", signals, deltas);
}

export function evolveRelationshipStateFromAssistant(
  current: RelationshipState,
  assistantOutput: string,
  events: LifeEvent[]
): RelationshipState {
  const normalizedCurrent = normalizeRelationshipState(current as unknown as Record<string, unknown>);
  const deltas: Partial<RelationshipDimensions> = {};
  const signals: string[] = [];
  const text = assistantOutput.trim();

  if (/[?？]/.test(text) || /你是指|让我确认一下|to clarify|do you mean/i.test(text)) {
    addDelta(deltas, "safety", 0.012);
    addDelta(deltas, "stability", 0.01);
    signals.push("assistant_clarification");
  }
  if (/谢谢|感谢|理解你|我在这|I understand|thank you|I am here/i.test(text)) {
    addDelta(deltas, "trust", 0.008);
    addDelta(deltas, "intimacy", 0.006);
    signals.push("assistant_empathic_response");
  }
  if (/对不起|抱歉|sorry/i.test(text)) {
    addDelta(deltas, "safety", 0.004);
    addDelta(deltas, "trust", 0.003);
    signals.push("assistant_repair_attempt");
  }
  if (text.length < 16) {
    signals.push("assistant_short_response");
  }

  const recentEvents = events.slice(-4);
  if (recentEvents.some((event) => event.type === "conflict_logged")) {
    addDelta(deltas, "trust", -0.02);
    addDelta(deltas, "safety", -0.02);
    signals.push("conflict_penalty");
  }
  if (recentEvents.some((event) => event.type === "assistant_aborted")) {
    addDelta(deltas, "stability", -0.012);
    signals.push("abort_penalty");
  }

  return evolveWithSignal(normalizedCurrent, "assistant", signals, deltas);
}

function evolveWithSignal(
  current: RelationshipState,
  source: RelationshipDriver["source"],
  signals: string[],
  deltas: Partial<RelationshipDimensions>
): RelationshipState {
  const now = new Date();
  const decayAmount = computeIdleDecayAmount(current.updatedAt, now);
  const decayed: RelationshipDimensions = {
    trust: decayTowardBaseline(current.dimensions.trust, RELATIONSHIP_DIMENSION_BASELINE.trust, decayAmount),
    safety: decayTowardBaseline(current.dimensions.safety, RELATIONSHIP_DIMENSION_BASELINE.safety, decayAmount),
    intimacy: decayTowardBaseline(current.dimensions.intimacy, RELATIONSHIP_DIMENSION_BASELINE.intimacy, decayAmount),
    reciprocity: decayTowardBaseline(current.dimensions.reciprocity, RELATIONSHIP_DIMENSION_BASELINE.reciprocity, decayAmount),
    stability: decayTowardBaseline(current.dimensions.stability, RELATIONSHIP_DIMENSION_BASELINE.stability, decayAmount)
  };

  const bounded = boundDeltas(deltas);
  const nextDimensions: RelationshipDimensions = {
    trust: clamp01(decayed.trust + (bounded.trust ?? 0)),
    safety: clamp01(decayed.safety + (bounded.safety ?? 0)),
    intimacy: clamp01(decayed.intimacy + (bounded.intimacy ?? 0)),
    reciprocity: clamp01(decayed.reciprocity + (bounded.reciprocity ?? 0)),
    stability: clamp01(decayed.stability + (bounded.stability ?? 0))
  };

  const hasSignal =
    signals.length > 0 &&
    (bounded.trust ?? 0) + (bounded.safety ?? 0) + (bounded.intimacy ?? 0) + (bounded.reciprocity ?? 0) + (bounded.stability ?? 0) !==
      0;
  const drivers = hasSignal
    ? appendDriver(current.drivers, {
        ts: now.toISOString(),
        source,
        signal: signals.join("+"),
        deltaSummary: compactDeltaSummary(bounded)
      })
    : current.drivers;

  return buildRelationshipState({
    dimensions: nextDimensions,
    drivers,
    updatedAt: now.toISOString()
  });
}

function buildRelationshipState(params: {
  dimensions: RelationshipDimensions;
  drivers: RelationshipDriver[];
  updatedAt: string;
}): RelationshipState {
  const normalizedDimensions = normalizeDimensions(params.dimensions);
  const overall = computeOverall(normalizedDimensions);
  return {
    state: mapOverallToState(overall),
    confidence: roundTo2(overall),
    overall,
    dimensions: normalizedDimensions,
    drivers: params.drivers.slice(-MAX_DRIVERS),
    version: "2",
    updatedAt: params.updatedAt
  };
}

function normalizeRelationshipState(raw: Record<string, unknown>): RelationshipState {
  const state = raw.state;
  const confidence = Number(raw.confidence ?? NaN);
  const overall = Number(raw.overall ?? NaN);
  const updatedAt = typeof raw.updatedAt === "string" && validIso(raw.updatedAt)
    ? raw.updatedAt
    : new Date().toISOString();
  const legacyState =
    state === "neutral-unknown" || state === "friend" || state === "peer" || state === "intimate"
      ? state
      : "neutral-unknown";
  const fallbackScore = clamp01(Number.isFinite(confidence) ? confidence : 0.5);
  const resolvedOverall = clamp01(Number.isFinite(overall) ? overall : fallbackScore);
  const dimensions = normalizeDimensionsFromRaw(raw.dimensions, legacyState, resolvedOverall);
  const drivers = normalizeDrivers(raw.drivers);
  return buildRelationshipState({
    dimensions,
    drivers,
    updatedAt
  });
}

function normalizeDimensionsFromRaw(
  raw: unknown,
  state: RelationshipState["state"],
  overall: number
): RelationshipDimensions {
  if (!isRecord(raw)) {
    return inferDimensionsFromLegacy(state, overall);
  }
  const trust = Number(raw.trust ?? NaN);
  const safety = Number(raw.safety ?? NaN);
  const intimacy = Number(raw.intimacy ?? NaN);
  const reciprocity = Number(raw.reciprocity ?? NaN);
  const stability = Number(raw.stability ?? NaN);
  if ([trust, safety, intimacy, reciprocity, stability].every((value) => Number.isFinite(value))) {
    return normalizeDimensions({
      trust,
      safety,
      intimacy,
      reciprocity,
      stability
    });
  }
  return inferDimensionsFromLegacy(state, overall);
}

function inferDimensionsFromLegacy(
  state: RelationshipState["state"],
  overall: number
): RelationshipDimensions {
  const blend = clamp01(overall);
  const boost =
    state === "intimate" ? 0.18 : state === "peer" ? 0.1 : state === "friend" ? 0.06 : 0;
  return normalizeDimensions({
    trust: RELATIONSHIP_DIMENSION_BASELINE.trust * (1 - blend) + blend + boost,
    safety: RELATIONSHIP_DIMENSION_BASELINE.safety * (1 - blend) + blend * 0.9 + boost * 0.7,
    intimacy: RELATIONSHIP_DIMENSION_BASELINE.intimacy * (1 - blend) + blend * 0.85 + boost,
    reciprocity: RELATIONSHIP_DIMENSION_BASELINE.reciprocity * (1 - blend) + blend * 0.88 + boost * 0.6,
    stability: RELATIONSHIP_DIMENSION_BASELINE.stability * (1 - blend) + blend * 0.8 + boost * 0.5
  });
}

function normalizeDimensions(dimensions: RelationshipDimensions): RelationshipDimensions {
  return {
    trust: roundTo4(clamp01(dimensions.trust)),
    safety: roundTo4(clamp01(dimensions.safety)),
    intimacy: roundTo4(clamp01(dimensions.intimacy)),
    reciprocity: roundTo4(clamp01(dimensions.reciprocity)),
    stability: roundTo4(clamp01(dimensions.stability))
  };
}

function normalizeDrivers(raw: unknown): RelationshipDriver[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((item) => isRecord(item))
    .map((item) => {
      const source: RelationshipDriver["source"] =
        item.source === "user" || item.source === "assistant" || item.source === "event"
          ? item.source
          : "event";
      const ts = typeof item.ts === "string" && validIso(item.ts) ? item.ts : new Date().toISOString();
      const signal = typeof item.signal === "string" && item.signal ? item.signal : "unknown";
      const deltaSummary = isRecord(item.deltaSummary)
        ? compactDeltaSummary({
            trust: toFinite(item.deltaSummary.trust),
            safety: toFinite(item.deltaSummary.safety),
            intimacy: toFinite(item.deltaSummary.intimacy),
            reciprocity: toFinite(item.deltaSummary.reciprocity),
            stability: toFinite(item.deltaSummary.stability)
          })
        : {};
      return {
        ts,
        source,
        signal,
        deltaSummary
      };
    })
    .slice(-MAX_DRIVERS);
}

function normalizeVoiceProfile(raw: Record<string, unknown>): VoiceProfile {
  const forbiddenSelfLabels = Array.isArray(raw.forbiddenSelfLabels)
    ? raw.forbiddenSelfLabels.filter((v): v is string => typeof v === "string")
    : DEFAULT_VOICE_PROFILE.forbiddenSelfLabels;
  const tonePreference =
    raw.tonePreference === "warm" ||
    raw.tonePreference === "plain" ||
    raw.tonePreference === "reflective" ||
    raw.tonePreference === "direct"
      ? raw.tonePreference
      : undefined;
  const stancePreference =
    raw.stancePreference === "friend" ||
    raw.stancePreference === "peer" ||
    raw.stancePreference === "intimate" ||
    raw.stancePreference === "neutral"
      ? raw.stancePreference
      : undefined;
  return {
    baseStance: "self-determined",
    serviceModeAllowed: false,
    languagePolicy: "follow_user_language",
    forbiddenSelfLabels,
    ...(tonePreference ? { tonePreference } : {}),
    ...(stancePreference ? { stancePreference } : {})
  };
}

function computeOverall(dimensions: RelationshipDimensions): number {
  const score =
    dimensions.trust * 0.3 +
    dimensions.safety * 0.22 +
    dimensions.intimacy * 0.18 +
    dimensions.reciprocity * 0.18 +
    dimensions.stability * 0.12;
  return roundTo4(clamp01(score));
}

function mapOverallToState(overall: number): RelationshipState["state"] {
  if (overall >= 0.78) {
    return "intimate";
  }
  if (overall >= 0.62) {
    return "peer";
  }
  if (overall >= 0.45) {
    return "friend";
  }
  return "neutral-unknown";
}

function decayTowardBaseline(value: number, baseline: number, amount: number): number {
  if (amount <= 0) {
    return value;
  }
  if (value > baseline) {
    return Math.max(baseline, value - amount);
  }
  if (value < baseline) {
    return Math.min(baseline, value + amount);
  }
  return value;
}

function computeIdleDecayAmount(updatedAt: string, now: Date): number {
  const lastTs = Date.parse(updatedAt);
  if (!Number.isFinite(lastTs)) {
    return 0;
  }
  const elapsedMs = now.getTime() - lastTs;
  if (elapsedMs <= RELATIONSHIP_IDLE_GRACE_MS) {
    return 0;
  }
  const decayIntervals = Math.floor((elapsedMs - RELATIONSHIP_IDLE_GRACE_MS) / RELATIONSHIP_DECAY_INTERVAL_MS);
  if (decayIntervals <= 0) {
    return 0;
  }
  return decayIntervals * RELATIONSHIP_DECAY_PER_IDLE_INTERVAL;
}

function boundDeltas(delta: Partial<RelationshipDimensions>): Partial<RelationshipDimensions> {
  return {
    trust: boundDelta(delta.trust),
    safety: boundDelta(delta.safety),
    intimacy: boundDelta(delta.intimacy),
    reciprocity: boundDelta(delta.reciprocity),
    stability: boundDelta(delta.stability)
  };
}

function boundDelta(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(-MAX_DELTA_PER_DIMENSION, Math.min(MAX_DELTA_PER_DIMENSION, value));
}

function appendDriver(current: RelationshipDriver[], driver: RelationshipDriver): RelationshipDriver[] {
  return [...current, driver].slice(-MAX_DRIVERS);
}

function compactDeltaSummary(delta: Partial<RelationshipDimensions>): Partial<RelationshipDimensions> {
  const next: Partial<RelationshipDimensions> = {};
  if (typeof delta.trust === "number" && delta.trust !== 0) {
    next.trust = roundTo4(delta.trust);
  }
  if (typeof delta.safety === "number" && delta.safety !== 0) {
    next.safety = roundTo4(delta.safety);
  }
  if (typeof delta.intimacy === "number" && delta.intimacy !== 0) {
    next.intimacy = roundTo4(delta.intimacy);
  }
  if (typeof delta.reciprocity === "number" && delta.reciprocity !== 0) {
    next.reciprocity = roundTo4(delta.reciprocity);
  }
  if (typeof delta.stability === "number" && delta.stability !== 0) {
    next.stability = roundTo4(delta.stability);
  }
  return next;
}

function addDelta(
  target: Partial<RelationshipDimensions>,
  key: keyof RelationshipDimensions,
  value: number
): void {
  const current = target[key] ?? 0;
  target[key] = current + value;
}

function toFinite(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function roundTo4(value: number): number {
  return Number(value.toFixed(4));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
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
