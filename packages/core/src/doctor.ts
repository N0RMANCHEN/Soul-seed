import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { inspectMemoryStore, MEMORY_SCHEMA_VERSION, runMemoryStoreSql } from "./memory_store.js";
import { ensureScarForBrokenLifeLog, readLifeEvents, MAX_REPRODUCTION_COUNT } from "./persona.js";
import { isMoodStateValid, isMoodLatentValid, MOOD_STATE_FILENAME, MOOD_LATENT_DIM, createMoodLatentBaseline } from "./mood_state.js";
import { isRelationshipLatentValid, RELATIONSHIP_LATENT_DIM, createRelationshipLatentBaseline } from "./relationship_state.js";
import { isVoiceLatentValid, isBeliefLatentValid, VOICE_LATENT_DIM, BELIEF_LATENT_DIM, createVoiceLatentBaseline, createBeliefLatentBaseline } from "./expression_belief_state.js";
import { inspectBoundaryRules } from "./constitution_rules.js";
import { loadSocialGraph, validateSocialGraph, MAX_SOCIAL_PERSONS } from "./social_graph.js";
import { MAX_USER_FACTS } from "./memory_user_facts.js";
import { checkCrystallizationFileSizes } from "./constitution_crystallization.js";
import { PERSONA_SCHEMA_VERSION, MAX_PINNED_COUNT, MAX_PINNED_CHARS } from "./types.js";
import type { DoctorIssue, DoctorReport, EnvCheckResult } from "./types.js";

const REQUIRED_FILES = [
  "persona.json",
  "identity.json",
  "worldview.json",
  "constitution.json",
  "habits.json",
  "user_profile.json",
  "pinned.json",
  "cognition_state.json",
  "relationship_state.json",
  "soul_lineage.json",
  "voice_profile.json",
  MOOD_STATE_FILENAME,
  "life.log.jsonl",
  "memory.db"
];
const EXPECTED_MISSION = "Be a consistent long-lived self-determined persona.";
// P0-14: pinned budget — use canonical constants
const MAX_PINNED_MEMORIES = MAX_PINNED_COUNT;
const MAX_PINNED_MEMORY_LENGTH = MAX_PINNED_CHARS;

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
    const persona = await readJson<{ id?: string; schemaVersion?: string; paths?: Record<string, unknown> }>(
      path.join(rootPath, "persona.json")
    );
    const identity = await readJson<{ personaId?: string; schemaVersion?: string; selfDescription?: string; personalityCore?: unknown[] }>(path.join(rootPath, "identity.json"));
    const constitution = await readJson<{ mission?: string; boundaries?: unknown }>(path.join(rootPath, "constitution.json"));
    const worldview = await readJson<Record<string, unknown>>(path.join(rootPath, "worldview.json"));
    const habits = await readJson<Record<string, unknown>>(path.join(rootPath, "habits.json"));
    const pinned = await readJson<Record<string, unknown>>(path.join(rootPath, "pinned.json"));
    const relationshipState = await readJson<Record<string, unknown>>(
      path.join(rootPath, "relationship_state.json")
    );
    const soulLineage = await readJson<Record<string, unknown>>(path.join(rootPath, "soul_lineage.json"));
    const voiceProfile = await readJson<Record<string, unknown>>(path.join(rootPath, "voice_profile.json"));

    if (persona.schemaVersion !== PERSONA_SCHEMA_VERSION) {
      const REQUIRED_PATHS = ["cognition", "soulLineage", "memoryDb"];
      const missingPaths = persona.paths
        ? REQUIRED_PATHS.filter((k) => !persona.paths![k])
        : REQUIRED_PATHS;
      issues.push({
        code: "schema_version_outdated",
        severity: "warning",
        message:
          `persona.json schemaVersion=${persona.schemaVersion ?? "unknown"}, expected ${PERSONA_SCHEMA_VERSION}` +
          (missingPaths.length ? `; missing paths: ${missingPaths.join(", ")}` : "") +
          `. Run: node scripts/migrate_schema.mjs --persona <path>`,
        path: "persona.json"
      });
    }

    if (!persona.id || typeof persona.id !== "string") {
      issues.push({
        code: "invalid_persona_id",
        severity: "error",
        message: "persona.json id is missing or invalid",
        path: "persona.json"
      });
    }

    if (!isRelationshipStateValid(relationshipState)) {
      issues.push({
        code: "invalid_relationship_state",
        severity: "error",
        message: "relationship_state.json is invalid",
        path: "relationship_state.json"
      });
    }

    if (!isVoiceProfileValid(voiceProfile)) {
      issues.push({
        code: "invalid_voice_profile",
        severity: "error",
        message: "voice_profile.json is invalid",
        path: "voice_profile.json"
      });
    }
    if (!isSoulLineageValid(soulLineage, persona.id)) {
      issues.push({
        code: "invalid_soul_lineage",
        severity: "error",
        message: "soul_lineage.json is invalid",
        path: "soul_lineage.json"
      });
    }
    const reproductionCount = Number(soulLineage.reproductionCount);
    if (Number.isFinite(reproductionCount) && reproductionCount >= MAX_REPRODUCTION_COUNT) {
      issues.push({
        code: "reproduction_count_at_limit",
        severity: "warning",
        message: `繁衍次数已达上限（${reproductionCount}/${MAX_REPRODUCTION_COUNT}），下次繁衍将被阻断（除非使用 --force-all）`,
        path: "soul_lineage.json"
      });
    }
    if (!isWorldviewValid(worldview)) {
      issues.push({
        code: "invalid_worldview",
        severity: "error",
        message: "worldview.json is invalid",
        path: "worldview.json"
      });
    }
    if (!isHabitsValid(habits)) {
      issues.push({
        code: "invalid_habits",
        severity: "error",
        message: "habits.json is invalid",
        path: "habits.json"
      });
    }

    const cognitionStateRaw = await readJson<Record<string, unknown>>(path.join(rootPath, "cognition_state.json"));
    if (!isCognitionStateValid(cognitionStateRaw)) {
      issues.push({
        code: "invalid_cognition_state",
        severity: "error",
        message: "cognition_state.json is invalid (instinctBias/epistemicStance/toolPreference/updatedAt)",
        path: "cognition_state.json"
      });
    }

    if (!isPinnedValid(pinned)) {
      issues.push({
        code: "invalid_pinned",
        severity: "error",
        message: "pinned.json is invalid",
        path: "pinned.json"
      });
    }

    // P2-0: mood_state.json validity check
    const moodStateRaw = await readJson<Record<string, unknown>>(
      path.join(rootPath, MOOD_STATE_FILENAME)
    ).catch(() => null);
    if (!moodStateRaw || !isMoodStateValid(moodStateRaw)) {
      issues.push({
        code: "invalid_mood_state",
        severity: "warning",
        message: "mood_state.json is missing or invalid. Run ss persona init or ss doctor --fix to regenerate.",
        path: MOOD_STATE_FILENAME
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

    // P1-0: identity v2 schema check (completeness check deferred until after events are loaded)
    const identityIsV2 = identity.schemaVersion === "2.0";
    if (!identityIsV2) {
      issues.push({
        code: "identity_schema_outdated",
        severity: "hint",
        message: "identity.json is using v1 schema (no selfDescription/personalityCore). Run ss persona identity --migrate to upgrade.",
        path: "identity.json"
      });
    }

    const missionBaseline = process.env.SOULSEED_MISSION_BASELINE ?? EXPECTED_MISSION;
    if (constitution.mission !== missionBaseline) {
      issues.push({
        code: "mission_drift",
        severity: "warning",
        message: `constitution mission drifted from baseline: ${missionBaseline}`,
        path: "constitution.json"
      });
    }
    issues.push(...inspectConstitutionRuleHealth(constitution));

    const chain = await ensureScarForBrokenLifeLog({ rootPath, detector: "doctor" });
    if (!chain.ok) {
      issues.push({
        code: "broken_hash_chain",
        severity: "error",
        message: chain.reason ?? "Life log chain verification failed",
        path: "life.log.jsonl"
      });
    }

    const memoryStore = await inspectMemoryStore(rootPath);
    if (!memoryStore.exists) {
      issues.push({
        code: "missing_memory_db",
        severity: "error",
        message: "memory.db is missing",
        path: "memory.db"
      });
    } else {
      if (memoryStore.schemaVersion !== MEMORY_SCHEMA_VERSION) {
        issues.push({
          code: "memory_schema_version_mismatch",
          severity: "error",
          message: `memory.db user_version=${memoryStore.schemaVersion ?? "unknown"}, expected ${MEMORY_SCHEMA_VERSION}`,
          path: "memory.db"
        });
      }

      if (memoryStore.missingTables.length > 0) {
        issues.push({
          code: "memory_schema_missing_tables",
          severity: "error",
          message: `memory.db missing tables: ${memoryStore.missingTables.join(", ")}`,
          path: "memory.db"
        });
      }

      issues.push(...(await inspectMemoryFieldRanges(rootPath)));
      issues.push(...(await inspectMemoryGroundingHealth(rootPath)));
      issues.push(...(await inspectMemoryFtsHealth(rootPath)));
      issues.push(...(await inspectMemorySourceEventHealth(rootPath)));
      issues.push(...(await inspectMemoryEmbeddingHealth(rootPath)));
      issues.push(...(await inspectRecallTraceHealth(rootPath)));
      issues.push(...(await inspectArchiveReferenceHealth(rootPath)));
    }

    const events = await readLifeEvents(rootPath);

    // P1-0: identity completeness — only fire when persona has conversation history
    if (identityIsV2 && events.length > 0) {
      const hasSelfDesc = typeof identity.selfDescription === "string" && identity.selfDescription.trim().length > 0;
      const hasCoreTraits = Array.isArray(identity.personalityCore) && identity.personalityCore.length >= 1;
      if (!hasSelfDesc || !hasCoreTraits) {
        issues.push({
          code: "identity_incomplete",
          severity: "hint",
          message: [
            "identity.json is incomplete:",
            !hasSelfDesc ? "selfDescription empty" : "",
            !hasCoreTraits ? "personalityCore empty" : ""
          ].filter(Boolean).join(" ") + ". Use ss persona identity --edit to fill in.",
          path: "identity.json"
        });
      }
    }

    const workingSet = await readWorkingSet(rootPath);
    for (const [idx, event] of events.entries()) {
      const eventPath = `life.log.jsonl:${idx + 1}`;
      if (!isMemoryMetaValid(event.payload.memoryMeta, workingSet.summaryIds)) {
        issues.push({
          code: "invalid_memory_meta",
          severity: "error",
          message: "payload.memoryMeta is present but invalid",
          path: eventPath
        });
      }

      if (event.type === "memory_weight_updated" && !isWeightPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_memory_weight_event",
          severity: "error",
          message: "memory_weight_updated payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "narrative_drift_detected" && !isNarrativeDriftPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_narrative_drift_event",
          severity: "error",
          message: "narrative_drift_detected payload is invalid",
          path: eventPath
        });
      }

      if (
        event.type === "constitution_review_requested" &&
        !isConstitutionReviewPayloadValid(event.payload)
      ) {
        issues.push({
          code: "invalid_constitution_review_event",
          severity: "error",
          message: "constitution_review_requested payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "relationship_state_updated" && !isRelationshipStateValid(event.payload)) {
        issues.push({
          code: "invalid_relationship_state_event",
          severity: "error",
          message: "relationship_state_updated payload is invalid",
          path: eventPath
        });
      }
      if (event.type === "libido_state_updated" && !isLibidoStateEventPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_libido_state_event",
          severity: "error",
          message: "libido_state_updated payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "voice_intent_selected" && !isVoiceIntentPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_voice_intent_event",
          severity: "error",
          message: "voice_intent_selected payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "memory_contamination_flagged" && !isMemoryContaminationPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_memory_contamination_event",
          severity: "error",
          message: "memory_contamination_flagged payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "rename_proposed_by_soul" && !isRenameProposedPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_rename_proposed_event",
          severity: "error",
          message: "rename_proposed_by_soul payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "rename_confirmed_via_chat" && !isRenameConfirmedViaChatPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_rename_chat_confirm_event",
          severity: "error",
          message: "rename_confirmed_via_chat payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "self_revision_proposed" && !isSelfRevisionProposedPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_self_revision_proposed_event",
          severity: "error",
          message: "self_revision_proposed payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "self_revision_applied" && !isSelfRevisionAppliedPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_self_revision_applied_event",
          severity: "error",
          message: "self_revision_applied payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "self_revision_conflicted" && !isSelfRevisionConflictedPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_self_revision_conflicted_event",
          severity: "error",
          message: "self_revision_conflicted payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "memory_consolidated" && !isMemoryConsolidatedPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_memory_consolidated_event",
          severity: "error",
          message: "memory_consolidated payload is invalid",
          path: eventPath
        });
      }

      if (event.type === "memory_consolidation_failed" && !isMemoryConsolidationFailedPayloadValid(event.payload)) {
        issues.push({
          code: "invalid_memory_consolidation_failed_event",
          severity: "error",
          message: "memory_consolidation_failed payload is invalid",
          path: eventPath
        });
      }
      if (
        (event.type === "reproduction_intent_detected" ||
          event.type === "soul_reproduction_completed" ||
          event.type === "soul_reproduction_rejected" ||
          event.type === "soul_reproduction_forced") &&
        !isReproductionEventPayloadValid(event.payload)
      ) {
        issues.push({
          code: "invalid_soul_reproduction_event",
          severity: "error",
          message: `${event.type} payload is invalid`,
          path: eventPath
        });
      }
    }

    if (workingSet.count > 500) {
      issues.push({
        code: "oversized_working_set",
        severity: "warning",
        message: `working_set.json has too many items (${workingSet.count})`,
        path: "summaries/working_set.json"
      });
    }

    // EC-2: Latent vector health check
    issues.push(...(await checkLatentHealth(rootPath)));

    // P2-4: Constitution crystallization file size limits
    issues.push(...(await inspectCrystallizationFileSizes(rootPath)));

    // P2-5: user_facts count limit
    issues.push(...(await inspectUserFactsHealth(rootPath)));

    // P2-6: social graph health
    issues.push(...(await inspectSocialGraphHealth(rootPath)));
  }

  return {
    ok: issues.filter((i) => i.severity !== "hint").length === 0,
    checkedAt: new Date().toISOString(),
    issues
  };
}

async function inspectCrystallizationFileSizes(rootPath: string): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  try {
    const report = await checkCrystallizationFileSizes(rootPath);
    if (report.constitutionOverLimit) {
      issues.push({
        code: "constitution_file_size_exceeded",
        severity: "warning",
        message: `constitution.json is ${report.constitutionBytes}B, limit is 2048B. Run: ss refine constitution`,
        path: "constitution.json"
      });
    }
    if (report.habitsOverLimit) {
      issues.push({
        code: "habits_file_size_exceeded",
        severity: "warning",
        message: `habits.json is ${report.habitsBytes}B, limit is 1024B. Run: ss refine habits`,
        path: "habits.json"
      });
    }
    if (report.worldviewOverLimit) {
      issues.push({
        code: "worldview_file_size_exceeded",
        severity: "warning",
        message: `worldview.json is ${report.worldviewBytes}B, limit is 1024B. Run: ss refine worldview`,
        path: "worldview.json"
      });
    }
  } catch {
    // Non-critical, skip
  }
  return issues;
}

async function inspectUserFactsHealth(rootPath: string): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  try {
    const rows = await runMemoryStoreSql(
      rootPath,
      `SELECT COUNT(*) FROM user_facts;`
    );
    const count = Number(rows.trim());
    if (Number.isFinite(count) && count > MAX_USER_FACTS) {
      issues.push({
        code: "user_facts_over_limit",
        severity: "warning",
        message: `user_facts has ${count} entries, limit is ${MAX_USER_FACTS}. Consider pruning low-confidence facts.`,
        path: "memory.db"
      });
    }
  } catch {
    // Non-critical
  }
  return issues;
}

async function inspectSocialGraphHealth(rootPath: string): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  try {
    const graph = await loadSocialGraph(rootPath);
    const graphIssues = validateSocialGraph(graph);
    for (const issue of graphIssues) {
      if (issue.code === "too_many_persons") {
        issues.push({
          code: "social_graph_over_limit",
          severity: "warning",
          message: issue.message,
          path: "social_graph.json"
        });
      } else {
        issues.push({
          code: "social_graph_person_too_long",
          severity: "warning",
          message: issue.message,
          path: "social_graph.json"
        });
      }
    }
  } catch {
    // Non-critical
  }
  return issues;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

// Suppress unused import warning
void stat;

// ---------------------------------------------------------------------------
// P0-12: Environment pre-check
// ---------------------------------------------------------------------------

const execFileAsync = promisify(execFile);

const INSTALL_HINTS: Record<string, string> = {
  darwin: "brew install sqlite3",
  linux: "sudo apt install sqlite3   # or: sudo dnf install sqlite",
  win32: "winget install SQLite.SQLite   # or: scoop install sqlite"
};

function installHint(): string {
  const platform = process.platform;
  return INSTALL_HINTS[platform] ?? "Install sqlite3 from https://www.sqlite.org/download.html";
}

/**
 * Check that the runtime environment is ready for Soulseed.
 * Call this at startup to surface missing dependencies early.
 */
export async function checkEnvironment(): Promise<EnvCheckResult[]> {
  const results: EnvCheckResult[] = [];

  // 1. sqlite3 binary presence
  const sqliteCheck = await (async (): Promise<EnvCheckResult> => {
    try {
      const { stdout } = await execFileAsync("sqlite3", ["--version"], { timeout: 5000 });
      return {
        component: "sqlite3",
        ok: true,
        message: `sqlite3 found: ${stdout.trim().split("\n")[0]}`
      };
    } catch {
      return {
        component: "sqlite3",
        ok: false,
        message: "sqlite3 CLI not found",
        hint: installHint()
      };
    }
  })();
  results.push(sqliteCheck);

  // Only run extension checks if sqlite3 is present
  if (sqliteCheck.ok) {
    // 2. FTS5 support
    const ftsCheck = await (async (): Promise<EnvCheckResult> => {
      try {
        await execFileAsync("sqlite3", [":memory:", "CREATE VIRTUAL TABLE t USING fts5(x); DROP TABLE t;"], { timeout: 5000 });
        return { component: "sqlite3_fts5", ok: true, message: "FTS5 extension available" };
      } catch {
        return {
          component: "sqlite3_fts5",
          ok: false,
          message: "FTS5 extension not available — memory search will be degraded",
          hint: "Reinstall sqlite3 with FTS5 support. " + installHint()
        };
      }
    })();
    results.push(ftsCheck);

    // 3. JSON1 support
    const jsonCheck = await (async (): Promise<EnvCheckResult> => {
      try {
        await execFileAsync("sqlite3", [":memory:", "SELECT json('{}');"], { timeout: 5000 });
        return { component: "sqlite3_json1", ok: true, message: "JSON1 extension available" };
      } catch {
        return {
          component: "sqlite3_json1",
          ok: false,
          message: "JSON1 extension not available — some queries will fail",
          hint: "Reinstall sqlite3 with JSON1 support. " + installHint()
        };
      }
    })();
    results.push(jsonCheck);
  }

  // 4. Node.js version (>=18 for native fetch + --test runner)
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1), 10);
  results.push({
    component: "node",
    ok: nodeMajor >= 18,
    message: nodeMajor >= 18 ? `Node.js ${nodeVersion}` : `Node.js ${nodeVersion} — requires >=18`,
    hint: nodeMajor < 18 ? "Upgrade Node.js: https://nodejs.org/" : undefined
  });

  return results;
}

/**
 * Returns true if the environment has the minimum required dependencies.
 * Use this as a fast gate in startup paths.
 */
export async function isEnvironmentReady(): Promise<boolean> {
  const results = await checkEnvironment();
  return results.every((r) => r.ok);
}

function isMemoryMetaValid(meta: unknown, summaryIds: Set<string>): boolean {
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
  const activationCount = meta.activationCount;
  const lastActivatedAt = meta.lastActivatedAt;
  const emotionScore = meta.emotionScore;
  const narrativeScore = meta.narrativeScore;
  const relationalScore = meta.relationalScore;
  const salienceScore = meta.salienceScore;
  const state = meta.state;
  const decayClass = meta.decayClass;
  const compressedAt = meta.compressedAt;
  const summaryRef = meta.summaryRef;

  const validTier = tier === "highlight" || tier === "pattern" || tier === "error";
  const validSource = source === "chat" || source === "system" || source === "acceptance";
  const validStorageCost = typeof storageCost === "number" && Number.isFinite(storageCost) && storageCost >= 0;
  const validRetrievalCost =
    typeof retrievalCost === "number" && Number.isFinite(retrievalCost) && retrievalCost >= 0;
  const validActivationCount =
    activationCount == null ||
    (typeof activationCount === "number" && Number.isInteger(activationCount) && activationCount >= 0);
  const validLastActivatedAt = lastActivatedAt == null || isIsoDate(lastActivatedAt);
  const validEmotion = emotionScore == null || (typeof emotionScore === "number" && emotionScore >= 0 && emotionScore <= 1);
  const validNarrative =
    narrativeScore == null || (typeof narrativeScore === "number" && narrativeScore >= 0 && narrativeScore <= 1);
  const validRelational =
    relationalScore == null || (typeof relationalScore === "number" && relationalScore >= 0 && relationalScore <= 1);
  const validSalience =
    salienceScore == null || (typeof salienceScore === "number" && salienceScore >= 0 && salienceScore <= 1);
  const validState =
    state == null || state === "hot" || state === "warm" || state === "cold" || state === "archive" || state === "scar";
  const validDecayClass =
    decayClass == null || decayClass === "fast" || decayClass === "standard" || decayClass === "slow" || decayClass === "sticky";
  const validCompressedAt = compressedAt == null || isIsoDate(compressedAt);
  const validSummaryRef = summaryRef == null || (typeof summaryRef === "string" && summaryIds.has(summaryRef));
  const credibilityScore = meta.credibilityScore;
  const contaminationFlags = meta.contaminationFlags;
  const excludedFromRecall = meta.excludedFromRecall;
  const validCredibilityScore =
    credibilityScore == null ||
    (typeof credibilityScore === "number" && Number.isFinite(credibilityScore) && credibilityScore >= 0 && credibilityScore <= 1);
  const validContaminationFlags =
    contaminationFlags == null ||
    (Array.isArray(contaminationFlags) && contaminationFlags.every((item) => typeof item === "string"));
  const validExcludedFromRecall =
    excludedFromRecall == null || typeof excludedFromRecall === "boolean";

  return (
    validTier &&
    validSource &&
    validStorageCost &&
    validRetrievalCost &&
    validActivationCount &&
    validLastActivatedAt &&
    validEmotion &&
    validNarrative &&
    validRelational &&
    validSalience &&
    validState &&
    validDecayClass &&
    validCompressedAt &&
    validSummaryRef &&
    validCredibilityScore &&
    validContaminationFlags &&
    validExcludedFromRecall
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function isWeightPayloadValid(payload: Record<string, unknown>): boolean {
  const oldWeights = payload.oldWeights;
  const newWeights = payload.newWeights;
  return isWeightSetValid(oldWeights) && isWeightSetValid(newWeights);
}

function isWeightSetValid(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const a = value.activation;
  const e = value.emotion;
  const n = value.narrative;
  const r = value.relational;
  if (
    typeof a !== "number" ||
    typeof e !== "number" ||
    typeof n !== "number" ||
    !Number.isFinite(a) ||
    !Number.isFinite(e) ||
    !Number.isFinite(n)
  ) {
    return false;
  }
  const hasRelational = r == null || (typeof r === "number" && Number.isFinite(r));
  if (!hasRelational) {
    return false;
  }
  const relational = typeof r === "number" ? r : 0;
  const sum = a + e + n + relational;
  return a >= 0 && e >= 0 && n >= 0 && relational >= 0 && Math.abs(sum - 1) < 1e-6;
}

function isNarrativeDriftPayloadValid(payload: Record<string, unknown>): boolean {
  const score = payload.score;
  const reasons = payload.reasons;
  return (
    typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 1 &&
    Array.isArray(reasons) &&
    reasons.every((item) => typeof item === "string")
  );
}

function isConstitutionReviewPayloadValid(payload: Record<string, unknown>): boolean {
  const reason = payload.reason;
  const triggeredBy = payload.triggeredBy;
  return typeof reason === "string" && reason.length > 0 && typeof triggeredBy === "string";
}

function isRelationshipStateValid(payload: Record<string, unknown>): boolean {
  const state = payload.state;
  const confidence = payload.confidence;
  const updatedAt = payload.updatedAt;
  const validState =
    state === "neutral-unknown" || state === "friend" || state === "peer" || state === "intimate";
  const validConfidence =
    typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
  const validUpdatedAt = typeof updatedAt === "string" && isIsoDate(updatedAt);
  if (!validState || !validConfidence || !validUpdatedAt) {
    return false;
  }

  const version = payload.version;
  const dimensions = payload.dimensions;
  const overall = payload.overall;
  const drivers = payload.drivers;

  const hasV2Fields = version != null || dimensions != null || overall != null || drivers != null;
  if (!hasV2Fields) {
    return true;
  }

  const validVersion = version === "2" || version === "3";
  const validOverall =
    typeof overall === "number" && Number.isFinite(overall) && overall >= 0 && overall <= 1;
  const validDimensions = isRelationshipDimensionsValid(dimensions);
  const validDrivers = isRelationshipDriversValid(drivers);
  return validVersion && validOverall && validDimensions && validDrivers;
}

function isRelationshipDimensionsValid(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const keys = ["trust", "safety", "intimacy", "reciprocity", "stability"] as const;
  const baseValid = keys.every((key) => {
    const n = value[key];
    return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
  });
  if (!baseValid) {
    return false;
  }
  const libido = value.libido;
  return libido == null || (typeof libido === "number" && Number.isFinite(libido) && libido >= 0 && libido <= 1);
}

function isRelationshipDriversValid(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item) => {
    if (!isRecord(item)) {
      return false;
    }
    const source = item.source;
    const signal = item.signal;
    const ts = item.ts;
    const deltaSummary = item.deltaSummary;
    const validSource = source === "user" || source === "assistant" || source === "event";
    const validSignal = typeof signal === "string" && signal.length > 0;
    const validTs = isIsoDate(ts);
    if (!validSource || !validSignal || !validTs) {
      return false;
    }
    if (deltaSummary == null) {
      return false;
    }
    if (!isRecord(deltaSummary)) {
      return false;
    }
    const keys = ["trust", "safety", "intimacy", "reciprocity", "stability", "libido"] as const;
    return keys.every((key) => {
      const entry = deltaSummary[key];
      return (
        entry == null ||
        (typeof entry === "number" && Number.isFinite(entry) && entry >= -1 && entry <= 1)
      );
    });
  });
}

function isVoiceProfileValid(payload: Record<string, unknown>): boolean {
  const baseStance = payload.baseStance;
  const serviceModeAllowed = payload.serviceModeAllowed;
  const languagePolicy = payload.languagePolicy;
  const forbiddenSelfLabels = payload.forbiddenSelfLabels;
  const tonePreference = payload.tonePreference;
  const stancePreference = payload.stancePreference;
  const validTonePreference =
    tonePreference == null ||
    tonePreference === "warm" ||
    tonePreference === "plain" ||
    tonePreference === "reflective" ||
    tonePreference === "direct";
  const validStancePreference =
    stancePreference == null ||
    stancePreference === "friend" ||
    stancePreference === "peer" ||
    stancePreference === "intimate" ||
    stancePreference === "neutral";
  const thinkingPreview = payload.thinkingPreview;
  const validThinkingPreview =
    thinkingPreview == null ||
    (isRecord(thinkingPreview) &&
      (thinkingPreview.enabled == null || typeof thinkingPreview.enabled === "boolean") &&
      (thinkingPreview.thresholdMs == null ||
        (typeof thinkingPreview.thresholdMs === "number" &&
          Number.isFinite(thinkingPreview.thresholdMs) &&
          thinkingPreview.thresholdMs >= 200 &&
          thinkingPreview.thresholdMs <= 10000)) &&
      (thinkingPreview.allowFiller == null || typeof thinkingPreview.allowFiller === "boolean") &&
      (thinkingPreview.phrasePool == null ||
        (Array.isArray(thinkingPreview.phrasePool) &&
          thinkingPreview.phrasePool.every((item) => typeof item === "string"))));
  return (
    baseStance === "self-determined" &&
    serviceModeAllowed === false &&
    languagePolicy === "follow_user_language" &&
    Array.isArray(forbiddenSelfLabels) &&
    forbiddenSelfLabels.every((item) => typeof item === "string") &&
    validTonePreference &&
    validStancePreference &&
    validThinkingPreview
  );
}

function isSoulLineageValid(payload: Record<string, unknown>, expectedPersonaId: string | undefined): boolean {
  const personaId = payload.personaId;
  const parentPersonaId = payload.parentPersonaId;
  const childrenPersonaIds = payload.childrenPersonaIds;
  const reproductionCount = payload.reproductionCount;
  const lastReproducedAt = payload.lastReproducedAt;
  const inheritancePolicy = payload.inheritancePolicy;
  const consentMode = payload.consentMode;
  const personaMatch = typeof expectedPersonaId !== "string" || personaId === expectedPersonaId;
  return (
    personaMatch &&
    typeof personaId === "string" &&
    personaId.length > 0 &&
    (parentPersonaId == null || typeof parentPersonaId === "string") &&
    Array.isArray(childrenPersonaIds) &&
    childrenPersonaIds.every((item) => typeof item === "string" && item.length > 0) &&
    typeof reproductionCount === "number" &&
    Number.isInteger(reproductionCount) &&
    reproductionCount >= 0 &&
    (lastReproducedAt == null || isIsoDate(lastReproducedAt)) &&
    inheritancePolicy === "values_plus_memory_excerpt" &&
    (consentMode === "default_consent" || consentMode === "require_roxy_voice" || consentMode === "roxy_veto")
  );
}

function isLibidoStateEventPayloadValid(payload: Record<string, unknown>): boolean {
  const libido = payload.libido;
  const signal = payload.signal;
  return (
    typeof libido === "number" &&
    Number.isFinite(libido) &&
    libido >= 0 &&
    libido <= 1 &&
    (signal == null || typeof signal === "string")
  );
}

function isReproductionEventPayloadValid(payload: Record<string, unknown>): boolean {
  const parentPersonaId = payload.parentPersonaId;
  const childPersonaId = payload.childPersonaId;
  const childDisplayName = payload.childDisplayName;
  const trigger = payload.trigger;
  return (
    typeof parentPersonaId === "string" &&
    parentPersonaId.length > 0 &&
    (childPersonaId == null || typeof childPersonaId === "string") &&
    (childDisplayName == null || typeof childDisplayName === "string") &&
    typeof trigger === "string" &&
    trigger.length > 0
  );
}

function isWorldviewValid(payload: Record<string, unknown>): boolean {
  const seed = payload.seed;
  return typeof seed === "string" && seed.trim().length > 0 && seed.length <= 500;
}

function isHabitsValid(payload: Record<string, unknown>): boolean {
  const style = payload.style;
  const adaptability = payload.adaptability;
  return (
    typeof style === "string" &&
    style.trim().length > 0 &&
    style.length <= 120 &&
    (adaptability === "low" || adaptability === "medium" || adaptability === "high")
  );
}

function isPinnedValid(payload: Record<string, unknown>): boolean {
  const memories = payload.memories;
  if (!Array.isArray(memories)) {
    return false;
  }
  if (memories.length > MAX_PINNED_MEMORIES) {
    return false;
  }
  if (!memories.every((item) => typeof item === "string" && item.length > 0 && item.length <= MAX_PINNED_MEMORY_LENGTH)) {
    return false;
  }
  const updatedAt = payload.updatedAt;
  return updatedAt == null || isIsoDate(updatedAt);
}

function isVoiceIntentPayloadValid(payload: Record<string, unknown>): boolean {
  const vi = payload.voiceIntent;
  if (vi == null) {
    return false;
  }
  if (!isRecord(vi)) {
    return false;
  }
  const stance = vi.stance;
  const tone = vi.tone;
  const serviceMode = vi.serviceMode;
  const language = vi.language;
  return (
    (stance === "friend" || stance === "peer" || stance === "intimate" || stance === "neutral") &&
    (tone === "warm" || tone === "plain" || tone === "reflective" || tone === "direct") &&
    serviceMode === false &&
    (language === "zh" || language === "en" || language === "mixed")
  );
}

function isMemoryContaminationPayloadValid(payload: Record<string, unknown>): boolean {
  const flags = payload.flags;
  const rewrittenText = payload.rewrittenText;
  return Array.isArray(flags) && flags.every((item) => typeof item === "string") && typeof rewrittenText === "string";
}

function isRenameProposedPayloadValid(payload: Record<string, unknown>): boolean {
  const oldDisplayName = payload.oldDisplayName;
  const newDisplayName = payload.newDisplayName;
  return (
    typeof oldDisplayName === "string" &&
    oldDisplayName.length > 0 &&
    typeof newDisplayName === "string" &&
    newDisplayName.length > 0
  );
}

function isRenameConfirmedViaChatPayloadValid(payload: Record<string, unknown>): boolean {
  const newDisplayName = payload.newDisplayName;
  return typeof newDisplayName === "string" && newDisplayName.length > 0;
}

function isSelfRevisionProposedPayloadValid(payload: Record<string, unknown>): boolean {
  const proposal = payload.proposal;
  const evidenceCount = payload.evidenceCount;
  return (
    isSelfRevisionProposalValid(proposal, ["proposed", "frozen", "applied"]) &&
    typeof evidenceCount === "number" &&
    Number.isFinite(evidenceCount) &&
    evidenceCount >= 0
  );
}

function isSelfRevisionAppliedPayloadValid(payload: Record<string, unknown>): boolean {
  const proposal = payload.proposal;
  const summary = payload.summary;
  return (
    isSelfRevisionProposalValid(proposal, ["applied"]) &&
    typeof summary === "string" &&
    summary.length > 0
  );
}

function isSelfRevisionConflictedPayloadValid(payload: Record<string, unknown>): boolean {
  const proposal = payload.proposal;
  const constitutionPatchProposal = payload.constitutionPatchProposal;
  return (
    isSelfRevisionProposalValid(proposal, ["frozen"]) &&
    isRecord(constitutionPatchProposal) &&
    Array.isArray(constitutionPatchProposal.conflicts) &&
    constitutionPatchProposal.conflicts.every((item: unknown) => typeof item === "string")
  );
}

function isSelfRevisionProposalValid(value: unknown, statuses: string[]): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const domain = value.domain;
  const changes = value.changes;
  const evidence = value.evidence;
  const confidence = value.confidence;
  const reasonCodes = value.reasonCodes;
  const conflictsWithBoundaries = value.conflictsWithBoundaries;
  const status = value.status;

  const validDomain =
    domain === "habits" ||
    domain === "voice" ||
    domain === "relationship" ||
    domain === "worldview_proposal" ||
    domain === "constitution_proposal";
  const validChanges = isRecord(changes);
  const validEvidence = Array.isArray(evidence) && evidence.every((item) => typeof item === "string");
  const validConfidence =
    typeof confidence === "number" && Number.isFinite(confidence) && confidence >= 0 && confidence <= 1;
  const validReasonCodes =
    Array.isArray(reasonCodes) && reasonCodes.every((item) => typeof item === "string");
  const validConflicts =
    Array.isArray(conflictsWithBoundaries) &&
    conflictsWithBoundaries.every((item) => typeof item === "string");
  const validStatus = typeof status === "string" && statuses.includes(status);

  return (
    validDomain &&
    validChanges &&
    validEvidence &&
    validConfidence &&
    validReasonCodes &&
    validConflicts &&
    validStatus
  );
}

function isMemoryConsolidatedPayloadValid(payload: Record<string, unknown>): boolean {
  const trigger = payload.trigger;
  const mode = payload.mode;
  const scanned = payload.scannedUserMessages;
  const extracted = payload.extractedCandidates;
  const deduped = payload.dedupedByExisting;
  const inserted = payload.inserted;
  return (
    typeof trigger === "string" &&
    trigger.length > 0 &&
    (mode === "light" || mode === "full") &&
    isNonNegativeInt(scanned) &&
    isNonNegativeInt(extracted) &&
    isNonNegativeInt(deduped) &&
    isNonNegativeInt(inserted)
  );
}

function isMemoryConsolidationFailedPayloadValid(payload: Record<string, unknown>): boolean {
  const trigger = payload.trigger;
  const mode = payload.mode;
  const error = payload.error;
  return (
    typeof trigger === "string" &&
    trigger.length > 0 &&
    (mode === "light" || mode === "full") &&
    typeof error === "string" &&
    error.length > 0
  );
}

function isNonNegativeInt(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

async function inspectMemoryFieldRanges(rootPath: string): Promise<DoctorIssue[]> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'invalidCredibility', SUM(CASE WHEN credibility_score < 0 OR credibility_score > 1 THEN 1 ELSE 0 END),",
      "'invalidExcluded', SUM(CASE WHEN excluded_from_recall NOT IN (0,1) THEN 1 ELSE 0 END),",
      "'invalidActivation', SUM(CASE WHEN activation_count < 1 THEN 1 ELSE 0 END),",
      "'invalidLastActivated', SUM(CASE WHEN julianday(last_activated_at) IS NULL THEN 1 ELSE 0 END)",
      ")",
      "FROM memories;"
    ].join("\n")
  );
  if (!raw) {
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [
      {
        code: "invalid_memory_field_ranges",
        severity: "error",
        message: "memory.db field range inspection failed",
        path: "memory.db"
      }
    ];
  }

  const invalidCredibility = Number(parsed.invalidCredibility ?? 0);
  const invalidExcluded = Number(parsed.invalidExcluded ?? 0);
  const invalidActivation = Number(parsed.invalidActivation ?? 0);
  const invalidLastActivated = Number(parsed.invalidLastActivated ?? 0);
  const issues: DoctorIssue[] = [];

  if (invalidCredibility > 0) {
    issues.push({
      code: "invalid_memory_credibility_score",
      severity: "error",
      message: `memory.db has ${invalidCredibility} rows with credibility_score outside [0,1]`,
      path: "memory.db"
    });
  }
  if (invalidExcluded > 0) {
    issues.push({
      code: "invalid_memory_excluded_flag",
      severity: "error",
      message: `memory.db has ${invalidExcluded} rows with excluded_from_recall not in {0,1}`,
      path: "memory.db"
    });
  }
  if (invalidActivation > 0) {
    issues.push({
      code: "invalid_memory_activation_count",
      severity: "error",
      message: `memory.db has ${invalidActivation} rows with activation_count < 1`,
      path: "memory.db"
    });
  }
  if (invalidLastActivated > 0) {
    issues.push({
      code: "invalid_memory_last_activated_at",
      severity: "error",
      message: `memory.db has ${invalidLastActivated} rows with invalid last_activated_at`,
      path: "memory.db"
    });
  }

  return issues;
}

async function inspectMemoryGroundingHealth(rootPath: string): Promise<DoctorIssue[]> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'excludedCount', SUM(CASE WHEN excluded_from_recall = 1 THEN 1 ELSE 0 END),",
      "'assistantCount', SUM(CASE WHEN origin_role = 'assistant' THEN 1 ELSE 0 END),",
      "'assistantLowCredCount', SUM(CASE WHEN origin_role = 'assistant' AND credibility_score <= 0.6 THEN 1 ELSE 0 END),",
      "'totalCount', COUNT(*)",
      ")",
      "FROM memories;"
    ].join("\n")
  );
  if (!raw) {
    return [];
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }

  const events = await readLifeEvents(rootPath);
  const contaminationEventCount = events.filter((event) => event.type === "memory_contamination_flagged").length;
  const excludedCount = Number(parsed.excludedCount ?? 0);
  const assistantCount = Number(parsed.assistantCount ?? 0);
  const assistantLowCredCount = Number(parsed.assistantLowCredCount ?? 0);
  const issues: DoctorIssue[] = [];

  if (contaminationEventCount > 0 && excludedCount < contaminationEventCount) {
    issues.push({
      code: "memory_contamination_exclusion_drift",
      severity: "warning",
      message: `memory_contamination_flagged=${contaminationEventCount}, excluded_from_recall=${excludedCount}`,
      path: "memory.db"
    });
  }

  if (assistantCount > 0) {
    const ratio = assistantLowCredCount / assistantCount;
    if (ratio < 0.15) {
      issues.push({
        code: "assistant_memory_low_credibility_ratio_low",
        severity: "warning",
        message: `assistant low-credibility ratio is ${(ratio * 100).toFixed(1)}% (<15%)`,
        path: "memory.db"
      });
    }
  }

  return issues;
}

async function inspectMemoryFtsHealth(rootPath: string): Promise<DoctorIssue[]> {
  try {
    const raw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT json_object(",
        "'eligibleCount', (SELECT COUNT(*) FROM memories WHERE deleted_at IS NULL AND excluded_from_recall = 0),",
        "'ftsCount', (SELECT COUNT(*) FROM memories_fts)",
        ");"
      ].join("\n")
    );
    if (!raw.trim()) {
      return [];
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const eligibleCount = Number(parsed.eligibleCount ?? 0);
    const ftsCount = Number(parsed.ftsCount ?? 0);
    const drift = Math.abs(eligibleCount - ftsCount);
    if (drift <= 1) {
      return [];
    }
    return [
      {
        code: "memory_fts_count_drift",
        severity: drift > 5 ? "error" : "warning",
        message: `memories_fts count drift: eligible=${eligibleCount}, fts=${ftsCount}`,
        path: "memory.db"
      }
    ];
  } catch {
    return [
      {
        code: "memory_fts_unavailable",
        severity: "error",
        message: "memory.db FTS table or query unavailable",
        path: "memory.db"
      }
    ];
  }
}

const SYNTHETIC_SOURCE_PREFIXES = [
  "seed:",
  "consolidated:",
  "migration:",
  "import:",
  "system:"
];

async function inspectMemorySourceEventHealth(rootPath: string): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  const events = await readLifeEvents(rootPath);
  const knownEventHashes = new Set(
    events.map((event) => (typeof event.hash === "string" ? event.hash : "")).filter((item) => item.length > 0)
  );

  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT source_event_hash || '|' || COUNT(*)",
      "FROM memories",
      "GROUP BY source_event_hash;"
    ].join("\n")
  );
  if (!raw.trim()) {
    return issues;
  }

  let orphanRows = 0;
  let orphanGroups = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const sep = line.lastIndexOf("|");
    if (sep <= 0) {
      continue;
    }
    const sourceEventHash = line.slice(0, sep);
    const rowCount = Number.parseInt(line.slice(sep + 1), 10);
    const isSynthetic = SYNTHETIC_SOURCE_PREFIXES.some((prefix) => sourceEventHash.startsWith(prefix));
    if (isSynthetic || knownEventHashes.has(sourceEventHash)) {
      continue;
    }
    orphanGroups += 1;
    orphanRows += Number.isFinite(rowCount) ? rowCount : 1;
  }

  if (orphanRows > 0) {
    issues.push({
      code: "orphan_memory_source_event_hash",
      severity: orphanRows > 10 ? "error" : "warning",
      message: `memory.db has ${orphanRows} rows (${orphanGroups} groups) whose source_event_hash is not found in life.log; run ./ss doctor --persona <path> then ./ss memory compact --persona <path> to repair`,
      path: "memory.db"
    });
  }
  return issues;
}

async function inspectMemoryEmbeddingHealth(rootPath: string): Promise<DoctorIssue[]> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'memoryId', e.memory_id,",
      "'provider', e.provider,",
      "'model', e.model,",
      "'dim', e.dim,",
      "'vectorJson', e.vector_json,",
      "'contentHash', e.content_hash,",
      "'memoryContent', m.content,",
      "'memoryDeletedAt', m.deleted_at,",
      "'memoryExcluded', m.excluded_from_recall",
      ")",
      "FROM memory_embeddings e",
      "LEFT JOIN memories m ON m.id = e.memory_id;"
    ].join("\n")
  );
  if (!raw.trim()) {
    return [];
  }

  let orphan = 0;
  let invalidVectorJson = 0;
  let vectorDimMismatch = 0;
  let invalidProviderModel = 0;
  let contentHashMismatch = 0;
  let staleExcluded = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      invalidVectorJson += 1;
      continue;
    }

    const memoryContent = parsed.memoryContent;
    const dim = Number(parsed.dim ?? 0);
    const provider = typeof parsed.provider === "string" ? parsed.provider.trim() : "";
    const model = typeof parsed.model === "string" ? parsed.model.trim() : "";
    const vectorJson = typeof parsed.vectorJson === "string" ? parsed.vectorJson : "";
    const contentHash = typeof parsed.contentHash === "string" ? parsed.contentHash : "";
    const deletedAt = parsed.memoryDeletedAt;
    const excluded = Number(parsed.memoryExcluded ?? 0);

    if (memoryContent == null) {
      orphan += 1;
      continue;
    }

    if (!provider || !model || !Number.isFinite(dim) || dim <= 0) {
      invalidProviderModel += 1;
    }

    let vector: unknown;
    try {
      vector = JSON.parse(vectorJson);
    } catch {
      invalidVectorJson += 1;
      continue;
    }
    if (!Array.isArray(vector) || vector.some((item) => typeof item !== "number" || !Number.isFinite(item))) {
      invalidVectorJson += 1;
      continue;
    }
    if (Math.floor(dim) !== vector.length) {
      vectorDimMismatch += 1;
    }

    const normalizedContent =
      typeof memoryContent === "string" ? memoryContent.trim().slice(0, 2000) : "";
    const expectedHash = sha256(normalizedContent);
    if (contentHash !== expectedHash) {
      contentHashMismatch += 1;
    }

    if ((typeof deletedAt === "string" && deletedAt.length > 0) || excluded === 1) {
      staleExcluded += 1;
    }
  }

  const issues: DoctorIssue[] = [];
  if (orphan > 0) {
    issues.push({
      code: "memory_embedding_orphan_row",
      severity: "error",
      message: `memory_embeddings has ${orphan} rows without matched memory rows`,
      path: "memory.db"
    });
  }
  if (invalidProviderModel > 0) {
    issues.push({
      code: "memory_embedding_invalid_meta",
      severity: "error",
      message: `memory_embeddings has ${invalidProviderModel} rows with invalid provider/model/dim`,
      path: "memory.db"
    });
  }
  if (invalidVectorJson > 0) {
    issues.push({
      code: "memory_embedding_invalid_vector_json",
      severity: "error",
      message: `memory_embeddings has ${invalidVectorJson} rows with invalid vector_json`,
      path: "memory.db"
    });
  }
  if (vectorDimMismatch > 0) {
    issues.push({
      code: "memory_embedding_dim_mismatch",
      severity: "error",
      message: `memory_embeddings has ${vectorDimMismatch} rows with dim not matching vector length`,
      path: "memory.db"
    });
  }
  if (contentHashMismatch > 0) {
    issues.push({
      code: "memory_embedding_content_hash_mismatch",
      severity: "warning",
      message: `memory_embeddings has ${contentHashMismatch} stale rows with content hash mismatch; run ./ss memory index rebuild --persona <path>`,
      path: "memory.db"
    });
  }
  if (staleExcluded > 0) {
    issues.push({
      code: "memory_embedding_stale_excluded",
      severity: "warning",
      message: `memory_embeddings has ${staleExcluded} rows linked to deleted/excluded memories; run ./ss memory index rebuild --persona <path>`,
      path: "memory.db"
    });
  }
  return issues;
}

async function inspectRecallTraceHealth(rootPath: string): Promise<DoctorIssue[]> {
  const raw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT id || '|' || selected_ids_json || '|' || scores_json || '|' || budget_json || '|' || created_at",
      "FROM recall_traces;"
    ].join("\n")
  );
  if (!raw.trim()) {
    return [];
  }

  let invalidJsonRows = 0;
  let invalidCreatedAtRows = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const parts = line.split("|");
    if (parts.length < 5) {
      invalidJsonRows += 1;
      continue;
    }
    const selectedRaw = parts[1];
    const scoresRaw = parts[2];
    const budgetRaw = parts[3];
    const createdAt = parts.slice(4).join("|");

    let parsedOk = true;
    try {
      const selected = JSON.parse(selectedRaw);
      const scores = JSON.parse(scoresRaw);
      const budget = JSON.parse(budgetRaw);
      const selectedValid = Array.isArray(selected);
      const scoresValid = isRecord(scores);
      const budgetValid = isRecord(budget);
      if (!selectedValid || !scoresValid || !budgetValid) {
        parsedOk = false;
      }
    } catch {
      parsedOk = false;
    }
    if (!parsedOk) {
      invalidJsonRows += 1;
    }

    if (!isIsoDate(createdAt)) {
      invalidCreatedAtRows += 1;
    }
  }

  const issues: DoctorIssue[] = [];
  if (invalidJsonRows > 0) {
    issues.push({
      code: "invalid_recall_trace_payload",
      severity: "error",
      message: `recall_traces has ${invalidJsonRows} rows with invalid payload json`,
      path: "memory.db"
    });
  }
  if (invalidCreatedAtRows > 0) {
    issues.push({
      code: "invalid_recall_trace_created_at",
      severity: "error",
      message: `recall_traces has ${invalidCreatedAtRows} rows with invalid created_at`,
      path: "memory.db"
    });
  }
  return issues;
}

async function inspectArchiveReferenceHealth(rootPath: string): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];
  const rowsRaw = await runMemoryStoreSql(
    rootPath,
    [
      "SELECT json_object(",
      "'id', id,",
      "'content', content,",
      "'state', state,",
      "'excludedFromRecall', excluded_from_recall",
      ")",
      "FROM memories",
      "WHERE deleted_at IS NULL",
      "AND content LIKE '[archived_ref] %';"
    ].join("\n")
  );

  if (!rowsRaw.trim()) {
    return issues;
  }

  let segmentsRaw = "";
  try {
    segmentsRaw = await runMemoryStoreSql(
      rootPath,
      [
        "SELECT json_object(",
        "'segmentKey', segment_key,",
        "'checksum', checksum,",
        "'payloadJson', payload_json",
        ")",
        "FROM archive_segments;"
      ].join("\n")
    );
  } catch {
    // Schema-health checks already report missing tables; keep doctor resilient.
    return issues;
  }
  const segmentMap = new Map<string, { checksum: string; payloadJson: string }>();
  for (const line of segmentsRaw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const segmentKey = typeof parsed.segmentKey === "string" ? parsed.segmentKey : "";
      if (!segmentKey) {
        continue;
      }
      segmentMap.set(segmentKey, {
        checksum: typeof parsed.checksum === "string" ? parsed.checksum : "",
        payloadJson: typeof parsed.payloadJson === "string" ? parsed.payloadJson : ""
      });
    } catch {
      continue;
    }
  }

  for (const line of rowsRaw.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const id = typeof parsed.id === "string" ? parsed.id : "";
    const content = typeof parsed.content === "string" ? parsed.content : "";
    const state = typeof parsed.state === "string" ? parsed.state : "";
    const excluded = Number(parsed.excludedFromRecall) === 1 || parsed.excludedFromRecall === true;
    const pathRef = `memory.db:memories:${id || "unknown"}`;

    const ref = parseArchivedRef(content);
    if (!ref) {
      issues.push({
        code: "invalid_archive_reference",
        severity: "error",
        message: "archive reference marker exists but cannot be parsed",
        path: pathRef
      });
      continue;
    }

    if (state !== "archive" || !excluded) {
      issues.push({
        code: "archive_reference_state_drift",
        severity: "warning",
        message: "archived_ref memory should be state=archive and excluded_from_recall=1",
        path: pathRef
      });
    }

    const seg = segmentMap.get(ref.segmentKey);
    if (!seg) {
      issues.push({
        code: "archive_segment_missing",
        severity: "error",
        message: `archive segment not found: ${ref.segmentKey}`,
        path: pathRef
      });
      continue;
    }

    if (seg.checksum && ref.checksum && seg.checksum !== ref.checksum) {
      issues.push({
        code: "archive_segment_checksum_mismatch",
        severity: "error",
        message: `archive checksum mismatch for ${ref.segmentKey}`,
        path: pathRef
      });
      continue;
    }

    const payload = safeJsonParse(seg.payloadJson);
    if (!payload || !isRecord(payload)) {
      issues.push({
        code: "archive_segment_payload_invalid",
        severity: "error",
        message: `archive payload json is invalid: ${ref.segmentKey}`,
        path: "memory.db:archive_segments"
      });
      continue;
    }

    const fileRel = typeof payload.file === "string" ? payload.file : "";
    if (fileRel) {
      const filePath = path.join(rootPath, fileRel);
      if (!existsSync(filePath)) {
        issues.push({
          code: "archive_segment_file_missing",
          severity: "error",
          message: `archive segment file missing: ${fileRel}`,
          path: "summaries/archive"
        });
      }
    }
  }

  return issues;
}

function parseArchivedRef(content: string): { segmentKey: string; checksum: string; id: string } | null {
  const normalized = content.trim();
  const match = /^\[archived_ref\]\s+segment=(\S+)\s+id=(\S+)\s+checksum=(\S+)/.exec(normalized);
  if (!match) {
    return null;
  }
  return {
    segmentKey: match[1],
    id: match[2],
    checksum: match[3]
  };
}

function safeJsonParse(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** EC-2: Check the health of all latent vectors (validity, homogeneity, excessive drift). */
async function checkLatentHealth(rootPath: string): Promise<DoctorIssue[]> {
  const issues: DoctorIssue[] = [];

  let cognitionRaw: Record<string, unknown> | null = null;
  let relationshipRaw: Record<string, unknown> | null = null;
  let moodRaw: Record<string, unknown> | null = null;
  try { cognitionRaw = JSON.parse(await readFile(path.join(rootPath, "cognition_state.json"), "utf8")) as Record<string, unknown>; } catch { /* skip */ }
  try { relationshipRaw = JSON.parse(await readFile(path.join(rootPath, "relationship_state.json"), "utf8")) as Record<string, unknown>; } catch { /* skip */ }
  try { moodRaw = JSON.parse(await readFile(path.join(rootPath, MOOD_STATE_FILENAME), "utf8")) as Record<string, unknown>; } catch { /* skip */ }

  type IsValid = (z: unknown) => z is number[];
  const latents: Array<{ name: string; filePath: string; raw: unknown; dim: number; baseline: number[]; isValid: IsValid }> = [
    { name: "moodLatent",         filePath: MOOD_STATE_FILENAME,       raw: moodRaw?.moodLatent,         dim: MOOD_LATENT_DIM,         baseline: createMoodLatentBaseline(),         isValid: isMoodLatentValid as IsValid },
    { name: "relationshipLatent", filePath: "relationship_state.json", raw: relationshipRaw?.relationshipLatent, dim: RELATIONSHIP_LATENT_DIM, baseline: createRelationshipLatentBaseline(), isValid: isRelationshipLatentValid as IsValid },
    { name: "voiceLatent",        filePath: "cognition_state.json",    raw: cognitionRaw?.voiceLatent,   dim: VOICE_LATENT_DIM,        baseline: createVoiceLatentBaseline(),        isValid: isVoiceLatentValid as IsValid },
    { name: "beliefLatent",       filePath: "cognition_state.json",    raw: cognitionRaw?.beliefLatent,  dim: BELIEF_LATENT_DIM,       baseline: createBeliefLatentBaseline(),       isValid: isBeliefLatentValid as IsValid },
  ];

  const DRIFT_THRESHOLD = 0.45;

  for (const { name, filePath, raw, dim, baseline, isValid } of latents) {
    if (raw == null) {
      // relationshipLatent is optional until first conversation; others should exist after init
      continue;
    }
    if (!isValid(raw)) {
      issues.push({ code: "latent_invalid", severity: "warning", message: `${name} in ${filePath} is invalid (expected ${dim}-dim finite-number array)`, path: filePath });
      continue;
    }
    const z = raw as number[];
    // Degradation: variance < 0.001 → hint (vector hasn't evolved)
    const mean = z.reduce((s, v) => s + v, 0) / z.length;
    const variance = z.reduce((s, v) => s + (v - mean) ** 2, 0) / z.length;
    if (variance < 0.001) {
      issues.push({ code: "latent_homogeneous", severity: "hint", message: `${name} is highly homogeneous (variance=${variance.toFixed(5)}); the vector may not have evolved yet`, path: filePath });
    }
    // Excessive drift: report the worst-offending dimension
    let maxDrift = 0;
    let maxDriftIdx = -1;
    for (let i = 0; i < z.length; i++) {
      const d = Math.abs(z[i] - (baseline[i] ?? 0));
      if (d > maxDrift) { maxDrift = d; maxDriftIdx = i; }
    }
    if (maxDrift > DRIFT_THRESHOLD) {
      issues.push({ code: "latent_excessive_drift", severity: "warning", message: `${name}[${maxDriftIdx}] drifted ${maxDrift.toFixed(3)} from baseline (threshold=${DRIFT_THRESHOLD})`, path: filePath });
    }
  }
  return issues;
}

async function readWorkingSet(rootPath: string): Promise<{ summaryIds: Set<string>; count: number }> {
  const filePath = path.join(rootPath, "summaries", "working_set.json");
  if (!existsSync(filePath)) {
    return { summaryIds: new Set(), count: 0 };
  }

  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as { items?: Array<{ id?: string }> };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const ids = new Set(items.map((item) => item.id).filter((id): id is string => typeof id === "string"));
  return {
    summaryIds: ids,
    count: items.length
  };
}

function isCognitionStateValid(payload: Record<string, unknown>): boolean {
  const { instinctBias, epistemicStance, toolPreference, updatedAt } = payload;
  const validBias =
    typeof instinctBias === "number" &&
    Number.isFinite(instinctBias) &&
    instinctBias >= 0 &&
    instinctBias <= 1;
  const validStance =
    epistemicStance === "balanced" ||
    epistemicStance === "cautious" ||
    epistemicStance === "assertive";
  const validTool =
    toolPreference === "auto" ||
    toolPreference === "read_first" ||
    toolPreference === "reply_first";
  const validUpdatedAt = typeof updatedAt === "string" && isIsoDate(updatedAt);
  return validBias && validStance && validTool && validUpdatedAt;
}

function inspectConstitutionRuleHealth(constitution: {
  boundaries?: unknown;
}): DoctorIssue[] {
  if (!Array.isArray(constitution.boundaries)) {
    return [];
  }
  const boundaries = constitution.boundaries.filter((item): item is string => typeof item === "string");
  const issues = inspectBoundaryRules(boundaries);
  return issues.map((item) => ({
    code: item.code,
    severity: "error" as const,
    message: item.message,
    path: "constitution.json"
  }));
}
