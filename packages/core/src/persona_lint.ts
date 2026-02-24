import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PersonaLibraryBlock, PersonaPinned } from "./types.js";
import { MAX_PINNED_CHARS, MAX_PINNED_COUNT } from "./types.js";

export type PersonaLintLevel = "error" | "warn" | "info";

export interface PersonaLintIssue {
  level: PersonaLintLevel;
  code: string;
  path: string;
  message: string;
  suggestion?: string;
}

export interface PersonaLintReport {
  ok: boolean;
  personaPath: string;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  issues: PersonaLintIssue[];
}

const REQUIRED_FILES = [
  "persona.json",
  "identity.json",
  "worldview.json",
  "constitution.json",
  "habits.json",
  "user_profile.json",
  "pinned.json",
  "cognition_state.json",
  "soul_lineage.json",
  "relationship_state.json",
  "voice_profile.json"
] as const;

export async function lintPersona(personaPath: string, options?: { strict?: boolean }): Promise<PersonaLintReport> {
  const issues: PersonaLintIssue[] = [];

  for (const file of REQUIRED_FILES) {
    const fp = path.join(personaPath, file);
    if (!existsSync(fp)) {
      issues.push({
        level: "error",
        code: "missing_file",
        path: file,
        message: `Required file is missing: ${file}`,
        suggestion: `Re-run init or restore ${file}`
      });
    }
  }

  const personaJson = await safeReadJson<Record<string, unknown>>(path.join(personaPath, "persona.json"));
  if (!personaJson) {
    issues.push({
      level: "error",
      code: "invalid_persona_json",
      path: "persona.json",
      message: "persona.json is missing or invalid JSON",
      suggestion: "Fix JSON syntax and required fields"
    });
  } else {
    if (typeof personaJson.id !== "string" || !personaJson.id.trim()) {
      issues.push({
        level: "error",
        code: "missing_persona_id",
        path: "persona.json:id",
        message: "persona.id is required",
        suggestion: "Provide a non-empty UUID-like id"
      });
    }
    if (typeof personaJson.displayName !== "string" || !personaJson.displayName.trim()) {
      issues.push({
        level: "error",
        code: "missing_display_name",
        path: "persona.json:displayName",
        message: "persona.displayName is required",
        suggestion: "Provide a non-empty displayName"
      });
    }
    if (typeof personaJson.schemaVersion !== "string") {
      issues.push({
        level: "warn",
        code: "missing_schema_version",
        path: "persona.json:schemaVersion",
        message: "schemaVersion is missing",
        suggestion: "Set schemaVersion to current version"
      });
    }
  }

  const pinned = await safeReadJson<PersonaPinned>(path.join(personaPath, "pinned.json"));
  if (pinned) {
    const memories = Array.isArray(pinned.memories) ? pinned.memories : [];
    if (memories.length > MAX_PINNED_COUNT) {
      issues.push({
        level: "error",
        code: "pinned_count_exceeded",
        path: "pinned.json:memories",
        message: `Pinned memories exceed limit (${memories.length}/${MAX_PINNED_COUNT})`,
        suggestion: "Trim pinned memories"
      });
    }
    for (let i = 0; i < memories.length; i += 1) {
      const m = memories[i] ?? "";
      if (typeof m !== "string" || m.trim().length === 0) {
        issues.push({
          level: "error",
          code: "invalid_pinned_item",
          path: `pinned.json:memories[${i}]`,
          message: "Pinned memory must be a non-empty string"
        });
      }
      if (m.length > MAX_PINNED_CHARS) {
        issues.push({
          level: options?.strict ? "error" : "warn",
          code: "pinned_char_exceeded",
          path: `pinned.json:memories[${i}]`,
          message: `Pinned memory exceeds char limit (${m.length}/${MAX_PINNED_CHARS})`,
          suggestion: "Trim memory text"
        });
      }
    }

    const library = Array.isArray(pinned.library) ? pinned.library : [];
    for (let i = 0; i < library.length; i += 1) {
      validateLibraryBlock(library[i], i, issues);
    }
  }

  const cognition = await safeReadJson<Record<string, unknown>>(path.join(personaPath, "cognition_state.json"));
  if (cognition) {
    if (typeof cognition.instinctBias !== "number") {
      issues.push({
        level: "error",
        code: "invalid_instinct_bias",
        path: "cognition_state.json:instinctBias",
        message: "instinctBias must be number"
      });
    }
  }

  const voice = await safeReadJson<Record<string, unknown>>(path.join(personaPath, "voice_profile.json"));
  if (voice) {
    if (typeof voice.baseStance !== "string") {
      issues.push({
        level: "warn",
        code: "missing_voice_base_stance",
        path: "voice_profile.json:baseStance",
        message: "voice_profile.baseStance is missing",
        suggestion: "Set a baseStance string"
      });
    }
  }

  const errorCount = issues.filter((x) => x.level === "error").length;
  const warningCount = issues.filter((x) => x.level === "warn").length;
  return {
    ok: errorCount === 0,
    personaPath,
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues
  };
}

function validateLibraryBlock(block: PersonaLibraryBlock | undefined, index: number, issues: PersonaLintIssue[]): void {
  if (!block || typeof block !== "object") {
    issues.push({
      level: "error",
      code: "invalid_library_block",
      path: `pinned.json:library[${index}]`,
      message: "Library block must be an object"
    });
    return;
  }
  if (typeof block.id !== "string" || !block.id.trim()) {
    issues.push({
      level: "error",
      code: "invalid_library_id",
      path: `pinned.json:library[${index}].id`,
      message: "Library block id is required"
    });
  }
  if (typeof block.title !== "string" || !block.title.trim()) {
    issues.push({
      level: "error",
      code: "invalid_library_title",
      path: `pinned.json:library[${index}].title`,
      message: "Library block title is required"
    });
  }
  if (typeof block.content !== "string" || !block.content.trim()) {
    issues.push({
      level: "error",
      code: "invalid_library_content",
      path: `pinned.json:library[${index}].content`,
      message: "Library block content is required"
    });
  }
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
