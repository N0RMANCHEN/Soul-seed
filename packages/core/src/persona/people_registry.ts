/**
 * H/P1-3 — People Registry & Relationship State (per-entity)
 *
 * people_registry.json: entityId, canonicalName, aliases, tags
 * EntityLinker: name/alias → entityId resolution
 * RelationshipCardGenerator: state → short context card (budget from attention_span)
 * RelationshipDecayJob: periodic baseline regression for relationship state
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { RelationshipState } from "../types.js";
import { ensureRelationshipArtifacts, writeRelationshipState } from "../state/relationship_state.js";

export const PEOPLE_REGISTRY_FILENAME = "people_registry.json";
export const PEOPLE_REGISTRY_SCHEMA_VERSION = "1.0";
export const MAX_CARD_CHARS = 180;
export const MAX_CARDS_PER_TURN = 2;
export const ENTITY_LINK_CONFIDENCE_THRESHOLD = 0.6;

export interface PeopleRegistryEntity {
  entityId: string;
  canonicalName: string;
  aliases: string[];
  tags: string[];
  /** Optional per-entity relationship dimensions (when different from primary user) */
  dimensions?: {
    trust?: number;
    safety?: number;
    intimacy?: number;
    reciprocity?: number;
    stability?: number;
    libido?: number;
  };
  lastMentionedAt?: string;
  addedAt: string;
}

export interface PeopleRegistry {
  schemaVersion: string;
  entities: PeopleRegistryEntity[];
  updatedAt: string;
}

export interface EntityLinkResult {
  entityId: string;
  canonicalName: string;
  confidence: number;
  matchedAs: "canonical" | "alias";
}

/**
 * EntityLinker: Resolve name/alias → entityId with confidence threshold.
 */
export async function linkEntity(
  rootPath: string,
  mention: string,
  options?: { confidenceThreshold?: number }
): Promise<EntityLinkResult | null> {
  const registry = await loadPeopleRegistry(rootPath);
  const threshold = options?.confidenceThreshold ?? ENTITY_LINK_CONFIDENCE_THRESHOLD;
  const normalized = mention.trim().toLowerCase();
  if (!normalized || normalized.length < 2) return null;

  for (const entity of registry.entities) {
    const canon = entity.canonicalName.toLowerCase();
    if (canon === normalized) {
      return {
        entityId: entity.entityId,
        canonicalName: entity.canonicalName,
        confidence: 1.0,
        matchedAs: "canonical"
      };
    }
    if (entity.aliases.some((a) => a.toLowerCase() === normalized)) {
      return {
        entityId: entity.entityId,
        canonicalName: entity.canonicalName,
        confidence: 0.95,
        matchedAs: "alias"
      };
    }
    if (canon.includes(normalized) || normalized.includes(canon)) {
      const conf = Math.min(0.9, 0.5 + Math.min(canon.length, normalized.length) / Math.max(canon.length, normalized.length) * 0.4);
      if (conf >= threshold) {
        return {
          entityId: entity.entityId,
          canonicalName: entity.canonicalName,
          confidence: conf,
          matchedAs: "canonical"
        };
      }
    }
  }
  return null;
}

/**
 * RelationshipCardGenerator: Produce short context card from relationship state.
 * Budget from genome attention_span (recallTopK influences card budget).
 */
export function generateRelationshipCard(
  entity: PeopleRegistryEntity | null,
  relationshipState: RelationshipState,
  options?: { maxChars?: number }
): string {
  const maxChars = Math.min(MAX_CARD_CHARS, options?.maxChars ?? 120);
  const base = relationshipState.dimensions;
  const dims = entity?.dimensions;
  const trust = dims?.trust ?? base.trust;
  const intimacy = dims?.intimacy ?? base.intimacy;
  const state = relationshipState.state;
  const name = entity?.canonicalName ? ` (${entity.canonicalName})` : "";
  const card = `[Relationship${name}] ${state}, trust≈${(trust * 100).toFixed(0)}%, intimacy≈${(intimacy * 100).toFixed(0)}%`;
  return card.slice(0, maxChars);
}

/**
 * Generate up to maxCards relationship cards for mentioned entities.
 * Card budget enforced (max 1–2 cards per turn per plan).
 */
export async function generateRelationshipCardsForInput(
  rootPath: string,
  userInput: string,
  relationshipState: RelationshipState,
  options?: { maxCards?: number; maxCharsPerCard?: number }
): Promise<string[]> {
  const maxCards = Math.min(MAX_CARDS_PER_TURN, options?.maxCards ?? 2);
  const maxChars = options?.maxCharsPerCard ?? MAX_CARD_CHARS;
  const registry = await loadPeopleRegistry(rootPath);
  if (registry.entities.length === 0) {
    const card = generateRelationshipCard(null, relationshipState, { maxChars });
    return card ? [card] : [];
  }

  const inputLower = userInput.toLowerCase();
  const mentioned: PeopleRegistryEntity[] = [];
  for (const entity of registry.entities) {
    const name = entity.canonicalName.toLowerCase();
    const aliases = entity.aliases.map((a) => a.toLowerCase());
    if (inputLower.includes(name) || aliases.some((a) => inputLower.includes(a))) {
      mentioned.push(entity);
      if (mentioned.length >= maxCards) break;
    }
  }

  if (mentioned.length === 0) {
    const card = generateRelationshipCard(null, relationshipState, { maxChars });
    return card ? [card] : [];
  }

  return mentioned.slice(0, maxCards).map((entity) =>
    generateRelationshipCard(entity, relationshipState, { maxChars })
  );
}

/**
 * Compile people-registry relationship context for session injection.
 * Wraps generateRelationshipCardsForInput with relationship state loading.
 */
export async function compilePeopleRelationshipContext(
  rootPath: string,
  userInput: string,
  options?: { maxCards?: number; maxCharsPerCard?: number }
): Promise<string> {
  const { relationshipState } = await ensureRelationshipArtifacts(rootPath);
  const cards = await generateRelationshipCardsForInput(rootPath, userInput, relationshipState, options);
  return cards.filter(Boolean).join("\n");
}

/**
 * RelationshipDecayJob: Periodic baseline regression for relationship state.
 * Applies idle decay when no interaction; uses genome for decay parameters.
 */
export async function runRelationshipDecayJob(
  rootPath: string
): Promise<{ ok: boolean; decayed: boolean; reason: string }> {
  const { relationshipState } = await ensureRelationshipArtifacts(rootPath);
  const RELATIONSHIP_IDLE_GRACE_MS = 20 * 60 * 1000;
  const RELATIONSHIP_DECAY_INTERVAL_MS = 60 * 60 * 1000;
  const RELATIONSHIP_DECAY_PER_IDLE_INTERVAL = 0.004;
  const RELATIONSHIP_DIMENSION_BASELINE = {
    trust: 0.45,
    safety: 0.48,
    intimacy: 0.25,
    reciprocity: 0.35,
    stability: 0.45,
    libido: 0.35
  };

  const now = new Date();
  const lastTs = Date.parse(relationshipState.updatedAt);
  if (!Number.isFinite(lastTs)) {
    return { ok: true, decayed: false, reason: "invalid_updatedAt" };
  }
  const elapsedMs = now.getTime() - lastTs;
  if (elapsedMs <= RELATIONSHIP_IDLE_GRACE_MS) {
    return { ok: true, decayed: false, reason: "within_grace_period" };
  }
  const decayIntervals = Math.floor((elapsedMs - RELATIONSHIP_IDLE_GRACE_MS) / RELATIONSHIP_DECAY_INTERVAL_MS);
  if (decayIntervals <= 0) {
    return { ok: true, decayed: false, reason: "no_decay_intervals" };
  }

  const decayAmount = decayIntervals * RELATIONSHIP_DECAY_PER_IDLE_INTERVAL;
  const decayToward = (value: number, baseline: number, amount: number) => {
    if (amount <= 0) return value;
    if (value > baseline) return Math.max(baseline, value - amount);
    if (value < baseline) return Math.min(baseline, value + amount);
    return value;
  };

  const nextDimensions = {
    trust: decayToward(relationshipState.dimensions.trust, RELATIONSHIP_DIMENSION_BASELINE.trust, decayAmount),
    safety: decayToward(relationshipState.dimensions.safety, RELATIONSHIP_DIMENSION_BASELINE.safety, decayAmount),
    intimacy: decayToward(relationshipState.dimensions.intimacy, RELATIONSHIP_DIMENSION_BASELINE.intimacy, decayAmount),
    reciprocity: decayToward(relationshipState.dimensions.reciprocity, RELATIONSHIP_DIMENSION_BASELINE.reciprocity, decayAmount),
    stability: decayToward(relationshipState.dimensions.stability, RELATIONSHIP_DIMENSION_BASELINE.stability, decayAmount),
    libido: decayToward(
      relationshipState.dimensions.libido,
      RELATIONSHIP_DIMENSION_BASELINE.libido,
      decayAmount * 2.6
    )
  };

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const nextState = {
    ...relationshipState,
    dimensions: {
      trust: clamp01(nextDimensions.trust),
      safety: clamp01(nextDimensions.safety),
      intimacy: clamp01(nextDimensions.intimacy),
      reciprocity: clamp01(nextDimensions.reciprocity),
      stability: clamp01(nextDimensions.stability),
      libido: clamp01(nextDimensions.libido)
    },
    updatedAt: now.toISOString()
  };

  await writeRelationshipState(rootPath, nextState);
  return { ok: true, decayed: true, reason: "idle_decay_applied" };
}

export async function loadPeopleRegistry(rootPath: string): Promise<PeopleRegistry> {
  const filePath = path.join(rootPath, PEOPLE_REGISTRY_FILENAME);
  if (!existsSync(filePath)) {
    return createEmptyPeopleRegistry();
  }
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<PeopleRegistry>;
    return normalizePeopleRegistry(parsed);
  } catch {
    return createEmptyPeopleRegistry();
  }
}

export async function savePeopleRegistry(rootPath: string, registry: PeopleRegistry): Promise<void> {
  const normalized = normalizePeopleRegistry(registry);
  normalized.updatedAt = new Date().toISOString();
  const filePath = path.join(rootPath, PEOPLE_REGISTRY_FILENAME);
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export async function addPersonToRegistry(
  rootPath: string,
  params: { canonicalName: string; aliases?: string[]; tags?: string[] }
): Promise<{ ok: boolean; entity?: PeopleRegistryEntity; reason?: string }> {
  const registry = await loadPeopleRegistry(rootPath);
  const canon = params.canonicalName.trim();
  if (!canon || canon.length < 2) {
    return { ok: false, reason: "canonicalName too short" };
  }
  const existing = registry.entities.find(
    (e) => e.canonicalName.toLowerCase() === canon.toLowerCase()
  );
  if (existing) {
    return { ok: false, reason: `"${canon}" already in registry`, entity: existing };
  }
  const nowIso = new Date().toISOString();
  const entity: PeopleRegistryEntity = {
    entityId: `ent_${randomUUID().slice(0, 8)}`,
    canonicalName: canon.slice(0, 60),
    aliases: (params.aliases ?? []).map((a) => String(a).trim().slice(0, 40)).filter(Boolean).slice(0, 10),
    tags: (params.tags ?? []).map((t) => String(t).trim().slice(0, 20)).filter(Boolean).slice(0, 8),
    addedAt: nowIso,
    lastMentionedAt: nowIso
  };
  registry.entities.push(entity);
  await savePeopleRegistry(rootPath, registry);
  return { ok: true, entity };
}

export function createEmptyPeopleRegistry(): PeopleRegistry {
  return {
    schemaVersion: PEOPLE_REGISTRY_SCHEMA_VERSION,
    entities: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizePeopleRegistry(raw: Partial<PeopleRegistry>): PeopleRegistry {
  const entities = Array.isArray(raw.entities)
    ? raw.entities
        .filter((e) => e && typeof e.entityId === "string" && typeof e.canonicalName === "string")
        .map((e) => ({
          entityId: String(e.entityId),
          canonicalName: String(e.canonicalName).slice(0, 60),
          aliases: Array.isArray(e.aliases) ? e.aliases.map(String).slice(0, 10) : [],
          tags: Array.isArray(e.tags) ? e.tags.map(String).slice(0, 8) : [],
          dimensions: e.dimensions,
          lastMentionedAt: e.lastMentionedAt,
          addedAt: typeof e.addedAt === "string" ? e.addedAt : new Date().toISOString()
        }))
    : [];
  return {
    schemaVersion: raw.schemaVersion ?? PEOPLE_REGISTRY_SCHEMA_VERSION,
    entities,
    updatedAt: raw.updatedAt ?? new Date().toISOString()
  };
}
