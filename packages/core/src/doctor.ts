import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readLifeEvents, verifyLifeLogChain } from "./persona.js";
import type { DoctorIssue, DoctorReport } from "./types.js";

const REQUIRED_FILES = [
  "persona.json",
  "identity.json",
  "worldview.json",
  "constitution.json",
  "habits.json",
  "user_profile.json",
  "pinned.json",
  "life.log.jsonl"
];

export async function doctorPersona(rootPath: string): Promise<DoctorReport> {
  const issues: DoctorIssue[] = [];

  for (const rel of REQUIRED_FILES) {
    const full = path.join(rootPath, rel);
    if (!existsSync(full)) {
      issues.push({
        code: "missing_file",
        severity: "error",
        message: `Missing required file: ${rel}`,
        path: rel
      });
    }
  }

  if (issues.length === 0) {
    const persona = await readJson<{ id?: string }>(path.join(rootPath, "persona.json"));
    const identity = await readJson<{ personaId?: string }>(path.join(rootPath, "identity.json"));

    if (!persona.id || typeof persona.id !== "string") {
      issues.push({
        code: "invalid_persona_id",
        severity: "error",
        message: "persona.json id is missing or invalid",
        path: "persona.json"
      });
    }

    if (!identity.personaId || typeof identity.personaId !== "string") {
      issues.push({
        code: "invalid_identity_persona_id",
        severity: "error",
        message: "identity.json personaId is missing or invalid",
        path: "identity.json"
      });
    } else if (persona.id !== identity.personaId) {
      issues.push({
        code: "persona_id_mismatch",
        severity: "error",
        message: "persona.json id and identity.json personaId mismatch",
        path: "identity.json"
      });
    }

    const chain = await verifyLifeLogChain(rootPath);
    if (!chain.ok) {
      issues.push({
        code: "broken_hash_chain",
        severity: "error",
        message: chain.reason ?? "Life log chain verification failed",
        path: "life.log.jsonl"
      });
    }

    const events = await readLifeEvents(rootPath);
    for (const [idx, event] of events.entries()) {
      const eventPath = `life.log.jsonl:${idx + 1}`;
      if (!isMemoryMetaValid(event.payload.memoryMeta)) {
        issues.push({
          code: "invalid_memory_meta",
          severity: "error",
          message: "payload.memoryMeta is present but invalid",
          path: eventPath
        });
      }
    }
  }

  return {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    issues
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function isMemoryMetaValid(meta: unknown): boolean {
  if (meta == null) {
    return true;
  }
  if (!isRecord(meta)) {
    return false;
  }

  const tier = meta.tier;
  const source = meta.source;
  const storageCost = meta.storageCost;
  const retrievalCost = meta.retrievalCost;

  const validTier = tier === "highlight" || tier === "pattern" || tier === "error";
  const validSource = source === "chat" || source === "system" || source === "acceptance";
  const validStorageCost = typeof storageCost === "number" && Number.isFinite(storageCost) && storageCost >= 0;
  const validRetrievalCost =
    typeof retrievalCost === "number" && Number.isFinite(retrievalCost) && retrievalCost >= 0;

  return validTier && validSource && validStorageCost && validRetrievalCost;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
