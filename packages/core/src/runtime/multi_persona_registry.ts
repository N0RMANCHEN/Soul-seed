/**
 * K/P0-0: Multi-persona registry, session graph, and group policy.
 *
 * Provides types, defaults, load/save, and registration operations
 * for multi-persona chat artifacts. All load functions return implicit
 * defaults when artifact files are absent (legacy compat).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// ── File constants ──────────────────────────────────────────

export const GROUP_POLICY_FILENAME = "group_policy.json";
export const SESSION_GRAPH_FILENAME = "session_graph.json";
export const SPEAKER_REGISTRY_FILENAME = "speaker_registry.json";

export const MAX_REGISTERED_PERSONAS = 8;
export const MAX_DISPLAY_NAME_LENGTH = 80;

// ── Types ───────────────────────────────────────────────────

export interface MultiPersonaGroupPolicy {
  schemaVersion: "1.0";
  arbitrationMode: "addressing_priority" | "round_robin" | "priority_weighted";
  isolationLevel: "strict" | "shared" | "hybrid";
  cooperationEnabled: boolean;
  maxRegisteredPersonas: number;
  turnScheduling: {
    mode: "round_robin_priority" | "free_form" | "strict_round_robin";
    maxConsecutiveTurns: number;
    timeoutMs: number;
  };
  updatedAt: string;
}

export interface MultiPersonaSessionGraph {
  schemaVersion: "1.0";
  sessions: MultiPersonaSession[];
  updatedAt: string;
}

export interface MultiPersonaSession {
  sessionId: string;
  participants: string[];
  edges: MultiPersonaEdge[];
  state: "active" | "paused" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface MultiPersonaEdge {
  from: string;
  to: string;
  channel: "shared" | "private";
}

export interface MultiPersonaSpeakerRegistry {
  schemaVersion: "1.0";
  entries: MultiPersonaRegistryEntry[];
  updatedAt: string;
}

export interface MultiPersonaRegistryEntry {
  actorId: string;
  actorLabel: string;
  role: "assistant" | "user" | "system";
  personaId?: string;
  displayName: string;
  registeredAt: string;
}

// ── Registration error codes ────────────────────────────────

export type RegistrationErrorCode =
  | "DUPLICATE_ACTOR_ID"
  | "DUPLICATE_DISPLAY_NAME"
  | "MAX_PERSONAS_EXCEEDED"
  | "INVALID_ACTOR_ID"
  | "INVALID_DISPLAY_NAME"
  | "ACTOR_NOT_FOUND";

export class RegistrationError extends Error {
  readonly code: RegistrationErrorCode;
  constructor(code: RegistrationErrorCode, message: string) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
  }
}

// ── Default factories ───────────────────────────────────────

export function createDefaultGroupPolicy(now?: string): MultiPersonaGroupPolicy {
  const ts = now ?? new Date().toISOString();
  return {
    schemaVersion: "1.0",
    arbitrationMode: "addressing_priority",
    isolationLevel: "strict",
    cooperationEnabled: false,
    maxRegisteredPersonas: MAX_REGISTERED_PERSONAS,
    turnScheduling: {
      mode: "round_robin_priority",
      maxConsecutiveTurns: 2,
      timeoutMs: 30000
    },
    updatedAt: ts
  };
}

export function createDefaultSessionGraph(now?: string): MultiPersonaSessionGraph {
  return {
    schemaVersion: "1.0",
    sessions: [],
    updatedAt: now ?? new Date().toISOString()
  };
}

export function createDefaultSpeakerRegistry(now?: string): MultiPersonaSpeakerRegistry {
  return {
    schemaVersion: "1.0",
    entries: [],
    updatedAt: now ?? new Date().toISOString()
  };
}

// ── Load helpers (default on missing file) ──────────────────

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function loadGroupPolicy(rootPath: string): Promise<MultiPersonaGroupPolicy> {
  const raw = await readJsonSafe<Record<string, unknown>>(
    path.join(rootPath, GROUP_POLICY_FILENAME)
  );
  return raw ? normalizeGroupPolicy(raw) : createDefaultGroupPolicy();
}

export async function loadSessionGraph(rootPath: string): Promise<MultiPersonaSessionGraph> {
  const raw = await readJsonSafe<Record<string, unknown>>(
    path.join(rootPath, SESSION_GRAPH_FILENAME)
  );
  return raw ? normalizeSessionGraph(raw) : createDefaultSessionGraph();
}

export async function loadSpeakerRegistry(rootPath: string): Promise<MultiPersonaSpeakerRegistry> {
  const raw = await readJsonSafe<Record<string, unknown>>(
    path.join(rootPath, SPEAKER_REGISTRY_FILENAME)
  );
  return raw ? normalizeSpeakerRegistry(raw) : createDefaultSpeakerRegistry();
}

// ── Save helpers ────────────────────────────────────────────

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function saveGroupPolicy(
  rootPath: string,
  policy: MultiPersonaGroupPolicy
): Promise<void> {
  await writeJson(path.join(rootPath, GROUP_POLICY_FILENAME), policy);
}

export async function saveSessionGraph(
  rootPath: string,
  graph: MultiPersonaSessionGraph
): Promise<void> {
  await writeJson(path.join(rootPath, SESSION_GRAPH_FILENAME), graph);
}

export async function saveSpeakerRegistry(
  rootPath: string,
  registry: MultiPersonaSpeakerRegistry
): Promise<void> {
  await writeJson(path.join(rootPath, SPEAKER_REGISTRY_FILENAME), registry);
}

// ── Registration operations ─────────────────────────────────

export function validateRegistration(
  registry: MultiPersonaSpeakerRegistry,
  entry: MultiPersonaRegistryEntry,
  policy: MultiPersonaGroupPolicy
): void {
  if (!entry.actorId || entry.actorId.trim().length === 0) {
    throw new RegistrationError("INVALID_ACTOR_ID", "actorId must be a non-empty string");
  }
  if (!entry.displayName || entry.displayName.trim().length === 0) {
    throw new RegistrationError("INVALID_DISPLAY_NAME", "displayName must be a non-empty string");
  }
  if (entry.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    throw new RegistrationError(
      "INVALID_DISPLAY_NAME",
      `displayName exceeds ${MAX_DISPLAY_NAME_LENGTH} characters`
    );
  }
  if (registry.entries.some((e) => e.actorId === entry.actorId)) {
    throw new RegistrationError(
      "DUPLICATE_ACTOR_ID",
      `actorId "${entry.actorId}" already registered`
    );
  }
  if (registry.entries.some((e) => e.displayName === entry.displayName)) {
    throw new RegistrationError(
      "DUPLICATE_DISPLAY_NAME",
      `displayName "${entry.displayName}" already registered`
    );
  }
  if (registry.entries.length >= policy.maxRegisteredPersonas) {
    throw new RegistrationError(
      "MAX_PERSONAS_EXCEEDED",
      `limit is ${policy.maxRegisteredPersonas} personas`
    );
  }
}

/**
 * Caller must serialize concurrent calls — no internal file lock.
 * Concurrent register/unregister on the same rootPath can cause lost writes.
 */
export async function registerPersona(
  rootPath: string,
  entry: MultiPersonaRegistryEntry
): Promise<MultiPersonaSpeakerRegistry> {
  const registry = await loadSpeakerRegistry(rootPath);
  const policy = await loadGroupPolicy(rootPath);
  validateRegistration(registry, entry, policy);
  const now = new Date().toISOString();
  const updated: MultiPersonaSpeakerRegistry = {
    ...registry,
    entries: [...registry.entries, { ...entry, registeredAt: entry.registeredAt || now }],
    updatedAt: now
  };
  await saveSpeakerRegistry(rootPath, updated);
  return updated;
}

export async function unregisterPersona(
  rootPath: string,
  actorId: string
): Promise<MultiPersonaSpeakerRegistry> {
  const registry = await loadSpeakerRegistry(rootPath);
  if (!registry.entries.some((e) => e.actorId === actorId)) {
    throw new RegistrationError("ACTOR_NOT_FOUND", `actorId "${actorId}" not found`);
  }
  const now = new Date().toISOString();
  const updated: MultiPersonaSpeakerRegistry = {
    ...registry,
    entries: registry.entries.filter((e) => e.actorId !== actorId),
    updatedAt: now
  };
  await saveSpeakerRegistry(rootPath, updated);
  return updated;
}

export function lookupPersona(
  registry: MultiPersonaSpeakerRegistry,
  actorId: string
): MultiPersonaRegistryEntry | undefined {
  return registry.entries.find((e) => e.actorId === actorId);
}

// ── Seed from existing persona ──────────────────────────────

export function seedRegistryEntryFromPersona(params: {
  personaId: string;
  displayName: string;
  now?: string;
}): MultiPersonaRegistryEntry {
  return {
    actorId: params.personaId,
    actorLabel: params.displayName,
    role: "assistant",
    personaId: params.personaId,
    displayName: params.displayName,
    registeredAt: params.now ?? new Date().toISOString()
  };
}

// ── Ensure artifacts (idempotent, creates only missing) ─────

export async function ensureMultiPersonaArtifacts(rootPath: string): Promise<{
  groupPolicy: MultiPersonaGroupPolicy;
  sessionGraph: MultiPersonaSessionGraph;
  speakerRegistry: MultiPersonaSpeakerRegistry;
}> {
  const gpPath = path.join(rootPath, GROUP_POLICY_FILENAME);
  const sgPath = path.join(rootPath, SESSION_GRAPH_FILENAME);
  const srPath = path.join(rootPath, SPEAKER_REGISTRY_FILENAME);

  const [gpRaw, sgRaw, srRaw] = await Promise.all([
    readJsonSafe<Record<string, unknown>>(gpPath),
    readJsonSafe<Record<string, unknown>>(sgPath),
    readJsonSafe<Record<string, unknown>>(srPath)
  ]);

  const groupPolicy = gpRaw ? normalizeGroupPolicy(gpRaw) : createDefaultGroupPolicy();
  const sessionGraph = sgRaw ? normalizeSessionGraph(sgRaw) : createDefaultSessionGraph();
  const speakerRegistry = srRaw ? normalizeSpeakerRegistry(srRaw) : createDefaultSpeakerRegistry();

  const writes: Promise<void>[] = [];
  if (!gpRaw) writes.push(saveGroupPolicy(rootPath, groupPolicy));
  if (!sgRaw) writes.push(saveSessionGraph(rootPath, sessionGraph));
  if (!srRaw) writes.push(saveSpeakerRegistry(rootPath, speakerRegistry));
  if (writes.length > 0) await Promise.all(writes);

  return { groupPolicy, sessionGraph, speakerRegistry };
}

// ── Migration (idempotent, creates only missing) ────────────

export async function migratePersonaToPhaseK(rootPath: string): Promise<{
  created: string[];
  skipped: string[];
}> {
  const filenames = [GROUP_POLICY_FILENAME, SESSION_GRAPH_FILENAME, SPEAKER_REGISTRY_FILENAME];
  const factories = [createDefaultGroupPolicy, createDefaultSessionGraph, createDefaultSpeakerRegistry];
  const created: string[] = [];
  const skipped: string[] = [];

  for (let i = 0; i < filenames.length; i++) {
    const filePath = path.join(rootPath, filenames[i]);
    const existing = await readJsonSafe(filePath);
    if (existing !== null) {
      skipped.push(filenames[i]);
    } else {
      await writeJson(filePath, factories[i]());
      created.push(filenames[i]);
    }
  }

  return { created, skipped };
}

// ── Normalization (defensive parsing) ───────────────────────

function normalizeGroupPolicy(raw: Record<string, unknown>): MultiPersonaGroupPolicy {
  const validArbitration = new Set(["addressing_priority", "round_robin", "priority_weighted"]);
  const validIsolation = new Set(["strict", "shared", "hybrid"]);
  const validScheduling = new Set(["round_robin_priority", "free_form", "strict_round_robin"]);

  const turnRaw = isRecord(raw.turnScheduling) ? raw.turnScheduling : {};

  return {
    schemaVersion: "1.0",
    arbitrationMode: validArbitration.has(raw.arbitrationMode as string)
      ? (raw.arbitrationMode as MultiPersonaGroupPolicy["arbitrationMode"])
      : "addressing_priority",
    isolationLevel: validIsolation.has(raw.isolationLevel as string)
      ? (raw.isolationLevel as MultiPersonaGroupPolicy["isolationLevel"])
      : "strict",
    cooperationEnabled: raw.cooperationEnabled === true,
    maxRegisteredPersonas: clampInt(raw.maxRegisteredPersonas, MAX_REGISTERED_PERSONAS, 1, 32),
    turnScheduling: {
      mode: validScheduling.has(turnRaw.mode as string)
        ? (turnRaw.mode as MultiPersonaGroupPolicy["turnScheduling"]["mode"])
        : "round_robin_priority",
      maxConsecutiveTurns: clampInt(turnRaw.maxConsecutiveTurns, 2, 1, 10),
      timeoutMs: clampInt(turnRaw.timeoutMs, 30000, 1000, 300000)
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeSessionGraph(raw: Record<string, unknown>): MultiPersonaSessionGraph {
  return {
    schemaVersion: "1.0",
    sessions: Array.isArray(raw.sessions)
      ? (raw.sessions.map(normalizeSession).filter(Boolean) as MultiPersonaSession[])
      : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeSession(raw: unknown): MultiPersonaSession | null {
  if (!isRecord(raw)) return null;
  const sessionId = typeof raw.sessionId === "string" ? raw.sessionId.trim() : "";
  if (!sessionId) return null;
  const validStates = new Set(["active", "paused", "closed"]);
  return {
    sessionId,
    participants: Array.isArray(raw.participants)
      ? raw.participants.filter((p): p is string => typeof p === "string")
      : [],
    edges: Array.isArray(raw.edges)
      ? (raw.edges.map(normalizeEdge).filter(Boolean) as MultiPersonaEdge[])
      : [],
    state: validStates.has(raw.state as string)
      ? (raw.state as MultiPersonaSession["state"])
      : "active",
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeEdge(raw: unknown): MultiPersonaEdge | null {
  if (!isRecord(raw)) return null;
  const from = typeof raw.from === "string" ? raw.from.trim() : "";
  const to = typeof raw.to === "string" ? raw.to.trim() : "";
  if (!from || !to) return null;
  return { from, to, channel: raw.channel === "private" ? "private" : "shared" };
}

function normalizeSpeakerRegistry(raw: Record<string, unknown>): MultiPersonaSpeakerRegistry {
  return {
    schemaVersion: "1.0",
    entries: Array.isArray(raw.entries)
      ? (raw.entries.map(normalizeRegistryEntry).filter(Boolean) as MultiPersonaRegistryEntry[])
      : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizeRegistryEntry(raw: unknown): MultiPersonaRegistryEntry | null {
  if (!isRecord(raw)) return null;
  const validRoles = new Set(["assistant", "user", "system"]);
  const actorId = typeof raw.actorId === "string" ? raw.actorId.trim().slice(0, 80) : "";
  if (!actorId) return null;
  return {
    actorId,
    actorLabel: typeof raw.actorLabel === "string" ? raw.actorLabel.trim().slice(0, 80) : "",
    role: validRoles.has(raw.role as string)
      ? (raw.role as MultiPersonaRegistryEntry["role"])
      : "assistant",
    personaId: typeof raw.personaId === "string" ? raw.personaId : undefined,
    displayName: typeof raw.displayName === "string"
      ? raw.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH)
      : "",
    registeredAt: typeof raw.registeredAt === "string" ? raw.registeredAt : new Date().toISOString()
  };
}

// ── Utilities ───────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
