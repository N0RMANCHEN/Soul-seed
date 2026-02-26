import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PersonaLibraryBlock, PersonaPinned } from "./types.js";
import { MAX_PINNED_CHARS, MAX_PINNED_COUNT } from "./types.js";
import type { GenomeConfig, EpigeneticsConfig } from "./genome.js";
import { validateGenome, GENOME_FILENAME, EPIGENETICS_FILENAME, GENOME_TRAIT_NAMES } from "./genome.js";
import { VALUES_RULES_FILENAME } from "./values_rules.js";
import { PERSONALITY_PROFILE_FILENAME } from "./personality_profile.js";
import { GOALS_STATE_FILENAME } from "./goals_state.js";
import { BELIEFS_STATE_FILENAME } from "./beliefs_state.js";
import { PEOPLE_REGISTRY_FILENAME } from "./people_registry.js";

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
    if (Object.prototype.hasOwnProperty.call(personaJson, "defaultModel")) {
      issues.push({
        level: "error",
        code: "deprecated_default_model_field",
        path: "persona.json:defaultModel",
        message: "persona.defaultModel is deprecated and must be removed",
        suggestion: "Run: node scripts/migrate_schema.mjs --persona <path>"
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

  const genome = await safeReadJson<GenomeConfig>(path.join(personaPath, GENOME_FILENAME));
  if (genome) {
    const genomeIssues = validateGenome(genome);
    if (genomeIssues.length > 0) {
      issues.push({
        level: "error",
        code: "genome_schema_invalid",
        path: GENOME_FILENAME,
        message: `genome.json failed validation: ${genomeIssues.map((i) => i.message).join("; ")}`
      });
    }
    if (genome.traits && typeof genome.traits === "object") {
      for (const name of GENOME_TRAIT_NAMES) {
        const v = genome.traits[name]?.value;
        if (typeof v === "number" && (v < 0 || v > 1)) {
          issues.push({
            level: "error",
            code: "genome_trait_out_of_range",
            path: `${GENOME_FILENAME}:traits.${name}`,
            message: `trait ${name} value ${v} outside [0, 1]`
          });
        }
      }
    }
  }

  const epigenetics = await safeReadJson<EpigeneticsConfig>(path.join(personaPath, EPIGENETICS_FILENAME));
  if (epigenetics?.adjustments) {
    for (const [name, adj] of Object.entries(epigenetics.adjustments)) {
      if (typeof adj.value === "number" && (adj.value < adj.min || adj.value > adj.max)) {
        issues.push({
          level: "warn",
          code: "epigenetics_adjustment_out_of_range",
          path: `${EPIGENETICS_FILENAME}:adjustments.${name}`,
          message: `adjustment ${name} value ${adj.value} outside [${adj.min}, ${adj.max}]`
        });
      }
    }
  }

  const optionalStateFiles = [
    VALUES_RULES_FILENAME,
    PERSONALITY_PROFILE_FILENAME,
    GOALS_STATE_FILENAME,
    BELIEFS_STATE_FILENAME,
    PEOPLE_REGISTRY_FILENAME,
  ];
  for (const file of optionalStateFiles) {
    const filePath = path.join(personaPath, file);
    if (!existsSync(filePath)) {
      issues.push({
        level: "warn",
        code: "missing_optional_state_file",
        path: file,
        message: `${file} is missing; runtime will fallback to defaults`,
      });
      continue;
    }
    const parsed = await safeReadJson<Record<string, unknown>>(filePath);
    if (!parsed) {
      issues.push({
        level: "error",
        code: "invalid_optional_state_file",
        path: file,
        message: `${file} is invalid JSON`,
      });
    }
  }

  // Compat calibration check for full-mode personas
  if (genome && genome.source !== "inferred_legacy") {
    const calibPath = path.join(personaPath, "compat_calibration.json");
    if (!existsSync(calibPath)) {
      issues.push({
        level: "warn",
        code: "missing_compat_calibration",
        path: "compat_calibration.json",
        message: "Full-mode persona is missing compat_calibration.json",
        suggestion: "Run calibration inference or create default calibration config"
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
