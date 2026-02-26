import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const PEOPLE_REGISTRY_FILENAME = "people_registry.json";
export const PEOPLE_REGISTRY_SCHEMA_VERSION = "1.0";
export const MAX_PEOPLE_ENTRIES = 120;

export interface PeopleRegistryEntry {
  entityId: string;
  canonicalName: string;
  aliases: string[];
  tags: string[];
  firstMetAt: string;
  lastSeenAt: string;
  oneLineWho: string;
  mentionCount: number;
}

export interface PeopleRegistry {
  schemaVersion: string;
  updatedAt: string;
  entries: PeopleRegistryEntry[];
}

function isoNow(): string {
  return new Date().toISOString();
}

function newEntityId(): string {
  return `ent_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyPeopleRegistry(): PeopleRegistry {
  return {
    schemaVersion: PEOPLE_REGISTRY_SCHEMA_VERSION,
    updatedAt: isoNow(),
    entries: [],
  };
}

export async function loadPeopleRegistry(rootPath: string): Promise<PeopleRegistry> {
  const filePath = path.join(rootPath, PEOPLE_REGISTRY_FILENAME);
  if (!existsSync(filePath)) return createEmptyPeopleRegistry();
  try {
    const raw = await readFile(filePath, "utf8");
    return normalizePeopleRegistry(JSON.parse(raw) as Partial<PeopleRegistry>);
  } catch {
    return createEmptyPeopleRegistry();
  }
}

export async function savePeopleRegistry(rootPath: string, registry: PeopleRegistry): Promise<void> {
  const filePath = path.join(rootPath, PEOPLE_REGISTRY_FILENAME);
  const normalized = normalizePeopleRegistry(registry);
  normalized.updatedAt = isoNow();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export function upsertPerson(registry: PeopleRegistry, input: {
  canonicalName: string;
  aliases?: string[];
  tags?: string[];
  oneLineWho?: string;
  nowIso?: string;
}): { registry: PeopleRegistry; entityId: string } {
  const normalized = normalizePeopleRegistry(registry);
  const nowIso = input.nowIso ?? isoNow();

  const targetNames = new Set([
    input.canonicalName.toLowerCase(),
    ...(input.aliases ?? []).map((x) => x.toLowerCase()),
  ]);

  const idx = normalized.entries.findIndex((entry) => {
    if (targetNames.has(entry.canonicalName.toLowerCase())) return true;
    return entry.aliases.some((alias) => targetNames.has(alias.toLowerCase()));
  });

  if (idx >= 0) {
    const current = normalized.entries[idx];
    const aliases = [...new Set([...current.aliases, ...(input.aliases ?? [])])].slice(0, 12);
    const tags = [...new Set([...current.tags, ...(input.tags ?? [])])].slice(0, 12);
    const next: PeopleRegistryEntry = {
      ...current,
      canonicalName: input.canonicalName.slice(0, 60),
      aliases,
      tags,
      oneLineWho: (input.oneLineWho ?? current.oneLineWho).slice(0, 160),
      lastSeenAt: nowIso,
      mentionCount: current.mentionCount + 1,
    };
    const entries = [...normalized.entries];
    entries[idx] = next;
    return {
      entityId: next.entityId,
      registry: {
        ...normalized,
        updatedAt: nowIso,
        entries,
      },
    };
  }

  const newEntry: PeopleRegistryEntry = {
    entityId: newEntityId(),
    canonicalName: input.canonicalName.slice(0, 60),
    aliases: [...new Set(input.aliases ?? [])].slice(0, 12),
    tags: [...new Set(input.tags ?? [])].slice(0, 12),
    firstMetAt: nowIso,
    lastSeenAt: nowIso,
    oneLineWho: (input.oneLineWho ?? "").slice(0, 160),
    mentionCount: 1,
  };

  return {
    entityId: newEntry.entityId,
    registry: {
      ...normalized,
      updatedAt: nowIso,
      entries: [...normalized.entries, newEntry].slice(0, MAX_PEOPLE_ENTRIES),
    },
  };
}

export function resolveMentionedPeople(
  registry: PeopleRegistry,
  userInput: string,
  maxCount = 2,
): PeopleRegistryEntry[] {
  const normalized = normalizePeopleRegistry(registry);
  const text = userInput.toLowerCase();

  const hits = normalized.entries.filter((entry) => {
    if (text.includes(entry.canonicalName.toLowerCase())) return true;
    return entry.aliases.some((alias) => text.includes(alias.toLowerCase()));
  });

  hits.sort((a, b) => {
    if (b.mentionCount !== a.mentionCount) return b.mentionCount - a.mentionCount;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });

  return hits.slice(0, Math.max(1, maxCount));
}

export async function compilePeopleRelationshipContext(
  rootPath: string,
  userInput: string,
  options?: { maxCards?: number },
): Promise<string> {
  const registry = await loadPeopleRegistry(rootPath);
  const mentions = resolveMentionedPeople(registry, userInput, options?.maxCards ?? 2);
  if (mentions.length === 0) return "";

  return mentions
    .map((entry) => {
      const aliases = entry.aliases.length > 0 ? ` aliases=${entry.aliases.slice(0, 3).join("/")}` : "";
      const tags = entry.tags.length > 0 ? ` tags=${entry.tags.slice(0, 3).join(",")}` : "";
      const who = entry.oneLineWho ? ` ${entry.oneLineWho}` : "";
      return `[PersonCard] ${entry.canonicalName}${aliases}${tags}.${who}`.trim();
    })
    .join("\n");
}

function normalizePeopleRegistry(raw: Partial<PeopleRegistry> | undefined): PeopleRegistry {
  const entries = Array.isArray(raw?.entries)
    ? raw.entries.map((entry) => normalizeEntry(entry)).filter((entry): entry is PeopleRegistryEntry => entry !== null)
    : [];

  return {
    schemaVersion:
      typeof raw?.schemaVersion === "string" && raw.schemaVersion.trim().length > 0
        ? raw.schemaVersion
        : PEOPLE_REGISTRY_SCHEMA_VERSION,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : isoNow(),
    entries: entries.slice(0, MAX_PEOPLE_ENTRIES),
  };
}

function normalizeEntry(raw: unknown): PeopleRegistryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<PeopleRegistryEntry>;
  if (typeof row.canonicalName !== "string" || row.canonicalName.trim().length === 0) return null;

  return {
    entityId: typeof row.entityId === "string" && row.entityId.trim().length > 0 ? row.entityId : newEntityId(),
    canonicalName: row.canonicalName.trim().slice(0, 60),
    aliases: Array.isArray(row.aliases)
      ? row.aliases.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12)
      : [],
    tags: Array.isArray(row.tags)
      ? row.tags.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 12)
      : [],
    firstMetAt: typeof row.firstMetAt === "string" ? row.firstMetAt : isoNow(),
    lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : isoNow(),
    oneLineWho: typeof row.oneLineWho === "string" ? row.oneLineWho.slice(0, 160) : "",
    mentionCount:
      typeof row.mentionCount === "number" && Number.isFinite(row.mentionCount)
        ? Math.max(1, Math.round(row.mentionCount))
        : 1,
  };
}
