import { randomUUID } from "node:crypto";
import { ensureMemoryStore, runMemoryStoreSql } from "./memory_store.js";
import { projectSubjectiveEmphasis } from "../runtime/semantic_projection.js";
import { linkEntity } from "../persona/people_registry.js";
import type { LifeEvent, SpeakerRelation } from "../types.js";

export type MemoryType = "episodic" | "semantic" | "relational" | "procedural";

interface MemoryCandidate {
  memoryType: MemoryType;
  content: string;
  salience: number;
  state: "hot" | "warm" | "cold" | "archive" | "scar";
  originRole: "user" | "assistant" | "system";
  speakerRelation: SpeakerRelation;
  speakerEntityId?: string;
  evidenceLevel: "verified" | "derived" | "uncertain";
  activationCount: number;
  lastActivatedAt: string;
  emotionScore: number;
  narrativeScore: number;
  credibilityScore: number;
  excludedFromRecall: boolean;
}

const PROCEDURAL_PATTERNS = [
  /(^|\s)(how to|step|steps|workflow|runbook|procedure|command|commands)(\s|$)/i,
  /如何|怎么|步骤|流程|命令|先.*再/
];

const RELATIONAL_PATTERNS = [
  /(^|\s)(relationship|friend|peer|trust|name)(\s|$)/i,
  /关系|朋友|信任|叫我|改名|称呼/
];

const SEMANTIC_PATTERNS = [
  /(^|\s)(prefer|always|usually|means|definition|fact)(\s|$)/i,
  /偏好|喜欢|总是|通常|定义|事实|记住/
];

const RELATIONAL_EVENTS = new Set([
  "relationship_state_updated",
  "libido_state_updated",
  "voice_intent_selected",
  "rename_requested",
  "rename_applied",
  "rename_rejected",
  "rename_suggested_by_soul",
  "rename_proposed_by_soul",
  "rename_confirmed_via_chat",
  "reproduction_intent_detected",
  "soul_reproduction_completed",
  "soul_reproduction_rejected",
  "soul_reproduction_forced"
]);

const PROCEDURAL_EVENTS = new Set(["conflict_logged", "memory_weight_updated"]);
const GROUP_SPEECH_PATTERNS = [
  /(大家|你们|你俩|你們|群里|群組里|群組裡|群里有人|all of you|you guys|everyone|the group)\s*(说|說|提到|表示|said|mentioned)/iu,
  /(他们|她们|他們|她們)\s*(都|也)?\s*(说|說|提到|表示|said|mentioned)/iu
];
const DIRECT_QUOTE_NAME_PATTERN = /(?:^|[\s，,。！？!?])([\p{L}\p{N}_-]{2,20})\s*(说|說|提到|表示|said|mentioned)/u;
const AMBIGUOUS_THIRD_PARTY_PATTERN =
  /(他说|她说|ta说|有人说|据说|someone said|he said|she said|they said)/iu;
const NON_ENTITY_TOKENS = new Set([
  "我",
  "我们",
  "咱们",
  "你",
  "你们",
  "你們",
  "他",
  "她",
  "它",
  "他们",
  "她们",
  "他們",
  "她們",
  "大家",
  "群里",
  "group",
  "everyone",
  "you",
  "we",
  "they"
]);

export async function ingestLifeEventMemory(rootPath: string, event: LifeEvent): Promise<string[]> {
  const candidates = await extractMemoryCandidates(rootPath, event);
  if (candidates.length === 0) {
    return [];
  }

  await ensureMemoryStore(rootPath);

  // H/P1-2: Genome memory_imprint → salience gain on ingest
  let salienceGain = 1.0;
  try {
    const { loadGenome, loadEpigenetics } = await import("../state/genome.js");
    const { getSalienceGainFromGenome } = await import("./memory_forgetting.js");
    const genome = await loadGenome(rootPath);
    const epigenetics = await loadEpigenetics(rootPath);
    salienceGain = getSalienceGainFromGenome(genome, epigenetics);
  } catch {
    // fallback to 1.0
  }

  const createdAt = event.ts;
  const inserts = candidates.map((candidate) => {
    const adjustedSalience = Math.min(1, Math.max(0.05, candidate.salience * salienceGain));
    const memoryId = randomUUID();
    const sql = [
      "INSERT INTO memories (id, memory_type, content, salience, state, origin_role, speaker_relation, speaker_entity_id, evidence_level, activation_count, last_activated_at, emotion_score, narrative_score, credibility_score, excluded_from_recall, reconsolidation_count, source_event_hash, created_at, updated_at, deleted_at)",
      `VALUES (${sqlText(memoryId)}, ${sqlText(candidate.memoryType)}, ${sqlText(candidate.content)}, ${adjustedSalience}, ${sqlText(candidate.state)}, ${sqlText(candidate.originRole)}, ${sqlText(candidate.speakerRelation)}, ${candidate.speakerEntityId ? sqlText(candidate.speakerEntityId) : "NULL"}, ${sqlText(candidate.evidenceLevel)}, ${candidate.activationCount}, ${sqlText(candidate.lastActivatedAt)}, ${candidate.emotionScore}, ${candidate.narrativeScore}, ${candidate.credibilityScore}, ${candidate.excludedFromRecall ? 1 : 0}, 0, ${sqlText(event.hash)}, ${sqlText(createdAt)}, ${sqlText(createdAt)}, NULL);`
    ].join(" ");
    return { memoryId, sql };
  });

  await runMemoryStoreSql(
    rootPath,
    `
    BEGIN;
    ${inserts.map((item) => item.sql).join("\n")}
    COMMIT;
    `
  );

  return inserts.map((item) => item.memoryId);
}

async function extractMemoryCandidates(rootPath: string, event: LifeEvent): Promise<MemoryCandidate[]> {
  const text = toEventText(event);
  if (!text) {
    return [];
  }
  const meta = event.payload.memoryMeta;
  const memoryType = classifyMemoryType(event, text);
  const originRole = classifyOriginRole(event.type);
  const speaker = await resolveSpeakerAttribution(rootPath, event.type, text);
  const emphasisDetected = detectUserEmphasis({
    eventType: event.type,
    text,
    tier: meta?.tier
  });
  const salienceBase = normalizeScore(meta?.salienceScore, emphasisDetected ? 0.88 : 0.3);
  const salience = emphasisDetected ? Math.max(0.9, salienceBase) : salienceBase;
  const state = emphasisDetected ? "hot" : normalizeState(meta?.state);
  const activationBase = normalizeInteger(meta?.activationCount, 1);
  const activationCount = emphasisDetected ? Math.max(3, activationBase) : activationBase;
  const defaultCredibility = originRole === "assistant" ? 0.6 : 1;
  const credibilityScore = normalizeScore(meta?.credibilityScore, defaultCredibility);
  const excludedFromRecall = meta?.excludedFromRecall === true;
  const evidenceLevel = excludedFromRecall || credibilityScore < 0.5
    ? "uncertain"
    : originRole === "user"
      ? "verified"
      : "derived";
  return [
    {
      memoryType,
      content: text.slice(0, 2000),
      salience,
      state,
      originRole,
      speakerRelation: speaker.relation,
      ...(speaker.entityId ? { speakerEntityId: speaker.entityId } : {}),
      evidenceLevel,
      activationCount,
      lastActivatedAt: normalizeIso(meta?.lastActivatedAt, event.ts),
      emotionScore: normalizeScore(meta?.emotionScore, 0.2),
      narrativeScore: emphasisDetected
        ? Math.max(0.75, normalizeScore(meta?.narrativeScore, 0.2))
        : normalizeScore(meta?.narrativeScore, 0.2),
      credibilityScore,
      excludedFromRecall
    }
  ];
}

async function resolveSpeakerAttribution(
  rootPath: string,
  eventType: LifeEvent["type"],
  text: string
): Promise<{ relation: SpeakerRelation; entityId?: string }> {
  if (eventType === "assistant_message" || eventType === "assistant_aborted") {
    return { relation: "me" };
  }
  if (eventType !== "user_message") {
    return { relation: "system" };
  }

  if (GROUP_SPEECH_PATTERNS.some((pattern) => pattern.test(text))) {
    return { relation: "group" };
  }

  const namedCandidate = extractNamedSpeakerCandidate(text);
  if (namedCandidate) {
    try {
      const linked = await linkEntity(rootPath, namedCandidate);
      if (linked?.entityId) {
        return { relation: "other_named", entityId: linked.entityId };
      }
    } catch {
      // link failure should never block memory ingest
    }
  }

  if (AMBIGUOUS_THIRD_PARTY_PATTERN.test(text)) {
    return { relation: "unknown" };
  }

  return { relation: "you" };
}

function extractNamedSpeakerCandidate(text: string): string | null {
  const match = DIRECT_QUOTE_NAME_PATTERN.exec(text);
  if (!match?.[1]) {
    return null;
  }
  const raw = match[1].trim();
  if (!raw) {
    return null;
  }
  if (NON_ENTITY_TOKENS.has(raw.toLowerCase())) {
    return null;
  }
  return raw;
}

function detectUserEmphasis(input: {
  eventType: LifeEvent["type"];
  text: string;
  tier: unknown;
}): boolean {
  if (input.eventType !== "user_message") {
    return false;
  }
  if (input.tier === "highlight") {
    return true;
  }
  return projectSubjectiveEmphasis(input.text) >= 0.62;
}

function classifyOriginRole(eventType: LifeEvent["type"]): "user" | "assistant" | "system" {
  if (eventType === "user_message") {
    return "user";
  }
  if (eventType === "assistant_message" || eventType === "assistant_aborted") {
    return "assistant";
  }
  return "system";
}

function classifyMemoryType(event: LifeEvent, text: string): MemoryType {
  if (RELATIONAL_EVENTS.has(event.type)) {
    return "relational";
  }
  if (PROCEDURAL_EVENTS.has(event.type)) {
    return "procedural";
  }
  if (matchesAny(text, PROCEDURAL_PATTERNS)) {
    return "procedural";
  }
  if (matchesAny(text, RELATIONAL_PATTERNS)) {
    return "relational";
  }
  if (matchesAny(text, SEMANTIC_PATTERNS)) {
    return "semantic";
  }
  return "episodic";
}

function toEventText(event: LifeEvent): string | null {
  const payloadText = event.payload.text;
  if (typeof payloadText === "string" && payloadText.trim()) {
    return payloadText.trim();
  }
  if (event.type === "relationship_state_updated") {
    const state = String(event.payload.state ?? "");
    const confidence = Number(event.payload.confidence ?? NaN);
    if (!state) {
      return null;
    }
    return Number.isFinite(confidence)
      ? `relationship state=${state} confidence=${confidence.toFixed(2)}`
      : `relationship state=${state}`;
  }
  if (event.type === "voice_intent_selected") {
    const voiceIntent = event.payload.voiceIntent;
    if (!voiceIntent || typeof voiceIntent !== "object") {
      return null;
    }
    return `voice intent=${JSON.stringify(voiceIntent)}`;
  }
  if (RELATIONAL_EVENTS.has(event.type) || PROCEDURAL_EVENTS.has(event.type)) {
    return `${event.type}: ${JSON.stringify(event.payload)}`;
  }
  return null;
}

function normalizeState(value: unknown): "hot" | "warm" | "cold" | "archive" | "scar" {
  return value === "hot" || value === "warm" || value === "cold" || value === "archive" || value === "scar"
    ? value
    : "warm";
}

function normalizeScore(value: unknown, fallback: number): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, num));
}

function normalizeInteger(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) {
    return fallback;
  }
  return Math.floor(num);
}

function normalizeIso(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return Number.isFinite(Date.parse(value)) ? value : fallback;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
