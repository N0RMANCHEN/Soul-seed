import { randomUUID } from "node:crypto";
import { ensureMemoryStore, runMemoryStoreSql } from "../memory/memory_store.js";
import type { PersonaJudgmentLabel, PersonaJudgmentRecord } from "../types.js";

export async function upsertPersonaJudgment(params: {
  rootPath: string;
  subjectRef: string;
  label: PersonaJudgmentLabel;
  confidence: number;
  rationale: string;
  evidenceRefs?: string[];
}): Promise<PersonaJudgmentRecord> {
  await ensureMemoryStore(params.rootPath);
  const now = new Date().toISOString();
  const latestRaw = await runMemoryStoreSql(
    params.rootPath,
    [
      "SELECT id, version",
      "FROM persona_judgments",
      `WHERE subject_ref = ${sqlText(params.subjectRef)} AND is_active = 1`,
      "ORDER BY version DESC",
      "LIMIT 1;"
    ].join(" ")
  );
  const latest = parseLatest(latestRaw);
  const version = latest ? latest.version + 1 : 1;
  const id = randomUUID();
  const evidenceRefs = JSON.stringify((params.evidenceRefs ?? []).slice(0, 16));
  const sql = [
    "BEGIN;",
    latest
      ? `UPDATE persona_judgments SET is_active = 0, updated_at = ${sqlText(now)} WHERE id = ${sqlText(latest.id)};`
      : "",
    [
      "INSERT INTO persona_judgments (",
      "id, subject_ref, label, confidence, rationale, evidence_refs_json, version, supersedes_version, is_active, created_at, updated_at",
      ") VALUES (",
      `${sqlText(id)},`,
      `${sqlText(params.subjectRef)},`,
      `${sqlText(params.label)},`,
      `${clamp(params.confidence, 0, 1)},`,
      `${sqlText(params.rationale.slice(0, 240))},`,
      `${sqlText(evidenceRefs)},`,
      `${version},`,
      `${latest ? latest.version : "NULL"},`,
      "1,",
      `${sqlText(now)},`,
      `${sqlText(now)}`,
      ");"
    ].join(" "),
    "COMMIT;"
  ]
    .filter((line) => line.length > 0)
    .join("\n");
  await runMemoryStoreSql(params.rootPath, sql);
  return {
    id,
    subjectRef: params.subjectRef,
    label: params.label,
    confidence: clamp(params.confidence, 0, 1),
    rationale: params.rationale.slice(0, 240),
    evidenceRefs: (params.evidenceRefs ?? []).slice(0, 16),
    version,
    supersedesVersion: latest ? latest.version : undefined,
    active: true,
    createdAt: now,
    updatedAt: now
  };
}

export async function getActivePersonaJudgment(
  rootPath: string,
  subjectRef: string
): Promise<PersonaJudgmentRecord | null> {
  await ensureMemoryStore(rootPath);
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT",
      "id, subject_ref, label, confidence, rationale, evidence_refs_json, version, supersedes_version, is_active, created_at, updated_at",
      "FROM persona_judgments",
      `WHERE subject_ref = ${sqlText(subjectRef)} AND is_active = 1`,
      "ORDER BY version DESC",
      "LIMIT 1;"
    ].join(" ")
  );
  const line = raw.trim();
  if (!line) {
    return null;
  }
  const parsed = parseRecord(line);
  return parsed;
}

function parseLatest(raw: string): { id: string; version: number } | null {
  const line = raw.trim();
  if (!line) {
    return null;
  }
  const [id, versionRaw] = line.split("|");
  const version = Number.parseInt(String(versionRaw), 10);
  if (!id || !Number.isFinite(version)) {
    return null;
  }
  return { id, version };
}

function parseRecord(line: string): PersonaJudgmentRecord | null {
  const [id, subjectRef, label, confidenceRaw, rationale, evidenceRaw, versionRaw, supersedesRaw, activeRaw, createdAt, updatedAt] =
    line.split("|");
  if (!id || !subjectRef || !label) {
    return null;
  }
  const confidence = clamp(Number(confidenceRaw), 0, 1);
  const version = Number.parseInt(String(versionRaw), 10);
  if (!Number.isFinite(version)) {
    return null;
  }
  let evidenceRefs: string[] = [];
  try {
    const parsed = JSON.parse(evidenceRaw ?? "[]");
    if (Array.isArray(parsed)) {
      evidenceRefs = parsed.filter((item) => typeof item === "string").slice(0, 16);
    }
  } catch {
    evidenceRefs = [];
  }
  const supersedes = Number.parseInt(String(supersedesRaw), 10);
  return {
    id,
    subjectRef,
    label: label as PersonaJudgmentLabel,
    confidence,
    rationale: rationale ?? "",
    evidenceRefs,
    version,
    supersedesVersion: Number.isFinite(supersedes) ? supersedes : undefined,
    active: activeRaw === "1",
    createdAt: createdAt ?? "",
    updatedAt: updatedAt ?? ""
  };
}

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}
