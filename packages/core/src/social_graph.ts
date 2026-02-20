import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appendLifeEvent } from "./persona.js";

export const SOCIAL_GRAPH_FILENAME = "social_graph.json";
export const MAX_SOCIAL_PERSONS = 20;
export const MAX_PERSON_CHARS = 200;
export const SOCIAL_GRAPH_SCHEMA_VERSION = "1.0";

export interface SocialPerson {
  id: string;
  name: string;
  relationship: string;
  facts: string[];
  lastMentionedAt: string;
  mentionCount: number;
  addedAt: string;
}

export interface SocialGraph {
  schemaVersion: string;
  persons: SocialPerson[];
  updatedAt: string;
}

export interface SocialGraphIssue {
  code: "too_many_persons" | "person_too_long" | "invalid_schema";
  message: string;
}

export function createEmptySocialGraph(): SocialGraph {
  return {
    schemaVersion: SOCIAL_GRAPH_SCHEMA_VERSION,
    persons: [],
    updatedAt: new Date().toISOString()
  };
}

export async function loadSocialGraph(rootPath: string): Promise<SocialGraph> {
  const filePath = path.join(rootPath, SOCIAL_GRAPH_FILENAME);
  if (!existsSync(filePath)) {
    return createEmptySocialGraph();
  }
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SocialGraph>;
    return normalizeSocialGraph(parsed);
  } catch {
    return createEmptySocialGraph();
  }
}

export async function saveSocialGraph(rootPath: string, graph: SocialGraph): Promise<void> {
  const filePath = path.join(rootPath, SOCIAL_GRAPH_FILENAME);
  const normalized = normalizeSocialGraph(graph as Partial<SocialGraph>);
  normalized.updatedAt = new Date().toISOString();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export async function addSocialPerson(
  rootPath: string,
  params: {
    name: string;
    relationship: string;
    facts?: string[];
  }
): Promise<{ ok: boolean; person?: SocialPerson; reason?: string }> {
  const graph = await loadSocialGraph(rootPath);

  if (graph.persons.length >= MAX_SOCIAL_PERSONS) {
    return {
      ok: false,
      reason: `Social graph is at capacity (${MAX_SOCIAL_PERSONS} persons). Remove someone first.`
    };
  }

  const existing = graph.persons.find((p) => p.name.toLowerCase() === params.name.toLowerCase());
  if (existing) {
    return { ok: false, reason: `Person "${params.name}" already exists in social graph` };
  }

  const nowIso = new Date().toISOString();
  const person: SocialPerson = {
    id: generateId(),
    name: params.name.slice(0, 60),
    relationship: params.relationship.slice(0, 80),
    facts: (params.facts ?? []).map((f) => f.slice(0, 100)).slice(0, 5),
    lastMentionedAt: nowIso,
    mentionCount: 1,
    addedAt: nowIso
  };

  graph.persons.push(person);
  await saveSocialGraph(rootPath, graph);

  await appendLifeEvent(rootPath, {
    type: "social_graph_person_added",
    payload: {
      personId: person.id,
      name: person.name,
      relationship: person.relationship
    }
  });

  return { ok: true, person };
}

export async function removeSocialPerson(
  rootPath: string,
  nameOrId: string
): Promise<{ ok: boolean; reason?: string }> {
  const graph = await loadSocialGraph(rootPath);
  const idx = graph.persons.findIndex(
    (p) => p.id === nameOrId || p.name.toLowerCase() === nameOrId.toLowerCase()
  );
  if (idx < 0) {
    return { ok: false, reason: `Person "${nameOrId}" not found in social graph` };
  }
  const [removed] = graph.persons.splice(idx, 1);
  await saveSocialGraph(rootPath, graph);

  await appendLifeEvent(rootPath, {
    type: "social_graph_person_removed",
    payload: {
      personId: removed.id,
      name: removed.name
    }
  });

  return { ok: true };
}

export async function updatePersonMention(
  rootPath: string,
  nameOrId: string
): Promise<SocialPerson | null> {
  const graph = await loadSocialGraph(rootPath);
  const person = graph.persons.find(
    (p) => p.id === nameOrId || p.name.toLowerCase() === nameOrId.toLowerCase()
  );
  if (!person) return null;

  person.mentionCount += 1;
  person.lastMentionedAt = new Date().toISOString();
  await saveSocialGraph(rootPath, graph);
  return person;
}

export async function searchSocialPersons(
  rootPath: string,
  query: string
): Promise<SocialPerson[]> {
  const graph = await loadSocialGraph(rootPath);
  const q = query.toLowerCase();
  return graph.persons.filter(
    (p) => p.name.toLowerCase().includes(q) || p.relationship.toLowerCase().includes(q)
  );
}

/**
 * Compile related-person context when the person is mentioned in user input.
 * Returns a compact string to inject into session context.
 */
export async function compileRelatedPersonContext(
  rootPath: string,
  userInput: string,
  options?: { maxPersons?: number }
): Promise<string> {
  const graph = await loadSocialGraph(rootPath);
  if (graph.persons.length === 0) return "";

  const maxPersons = options?.maxPersons ?? 3;
  const inputLower = userInput.toLowerCase();

  // Find persons mentioned in the input
  const mentioned = graph.persons
    .filter((p) => inputLower.includes(p.name.toLowerCase()))
    .slice(0, maxPersons);

  if (mentioned.length === 0) return "";

  const lines = mentioned.map((p) => {
    const factsStr = p.facts.length > 0 ? ` Facts: ${p.facts.slice(0, 3).join("; ")}` : "";
    return `[Known person] ${p.name} (${p.relationship}).${factsStr}`;
  });

  return lines.join("\n");
}

/**
 * Propose candidate persons from memory (for social graph auto-suggestion).
 * Looks for names mentioned ≥3 times in recent memories.
 * Returns names that are NOT already in the graph.
 */
export async function proposeSocialPersonCandidates(
  rootPath: string,
  memories: Array<{ content: string }>
): Promise<string[]> {
  const graph = await loadSocialGraph(rootPath);
  const existingNames = new Set(graph.persons.map((p) => p.name.toLowerCase()));

  const nameCounts = new Map<string, number>();

  // Simple heuristic: look for proper-noun-like tokens (Title Case, 2-20 chars)
  const namePattern = /[\u4e00-\u9fff]{2,8}|[A-Z][a-z]{1,15}/g;
  for (const mem of memories) {
    const matches = mem.content.match(namePattern) ?? [];
    for (const m of matches) {
      if (!existingNames.has(m.toLowerCase())) {
        nameCounts.set(m, (nameCounts.get(m) ?? 0) + 1);
      }
    }
  }

  return [...nameCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);
}

export function validateSocialGraph(graph: SocialGraph): SocialGraphIssue[] {
  const issues: SocialGraphIssue[] = [];

  if (graph.persons.length > MAX_SOCIAL_PERSONS) {
    issues.push({
      code: "too_many_persons",
      message: `social_graph.json has ${graph.persons.length} persons, limit is ${MAX_SOCIAL_PERSONS}`
    });
  }

  for (const person of graph.persons) {
    const personStr = JSON.stringify(person);
    if (personStr.length > MAX_PERSON_CHARS * 3) {
      issues.push({
        code: "person_too_long",
        message: `Person "${person.name}" serialized size exceeds limit`
      });
    }
  }

  return issues;
}

// --- internal helpers ---

function normalizeSocialGraph(raw: Partial<SocialGraph>): SocialGraph {
  return {
    schemaVersion: typeof raw.schemaVersion === "string" ? raw.schemaVersion : SOCIAL_GRAPH_SCHEMA_VERSION,
    persons: Array.isArray(raw.persons)
      ? raw.persons.map(normalizePerson).slice(0, MAX_SOCIAL_PERSONS)
      : [],
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString()
  };
}

function normalizePerson(raw: unknown): SocialPerson {
  const r = (raw ?? {}) as Partial<SocialPerson>;
  const nowIso = new Date().toISOString();
  return {
    id: typeof r.id === "string" ? r.id : generateId(),
    name: typeof r.name === "string" ? r.name.slice(0, 60) : "",
    relationship: typeof r.relationship === "string" ? r.relationship.slice(0, 80) : "",
    facts: Array.isArray(r.facts) ? r.facts.map((f) => String(f).slice(0, 100)).slice(0, 5) : [],
    lastMentionedAt: typeof r.lastMentionedAt === "string" ? r.lastMentionedAt : nowIso,
    mentionCount: typeof r.mentionCount === "number" ? r.mentionCount : 1,
    addedAt: typeof r.addedAt === "string" ? r.addedAt : nowIso
  };
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
