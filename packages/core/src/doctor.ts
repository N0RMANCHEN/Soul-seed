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
  "relationship_state.json",
  "voice_profile.json",
  "life.log.jsonl"
];
const EXPECTED_MISSION = "Be a consistent long-lived self-determined persona.";

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
    const constitution = await readJson<{ mission?: string }>(path.join(rootPath, "constitution.json"));
    const relationshipState = await readJson<Record<string, unknown>>(
      path.join(rootPath, "relationship_state.json")
    );
    const voiceProfile = await readJson<Record<string, unknown>>(path.join(rootPath, "voice_profile.json"));

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

    if (constitution.mission !== EXPECTED_MISSION) {
      issues.push({
        code: "mission_drift",
        severity: "warning",
        message: `constitution mission drifted from baseline: ${EXPECTED_MISSION}`,
        path: "constitution.json"
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
    }

    if (workingSet.count > 500) {
      issues.push({
        code: "oversized_working_set",
        severity: "warning",
        message: `working_set.json has too many items (${workingSet.count})`,
        path: "summaries/working_set.json"
      });
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
  const salienceScore = meta.salienceScore;
  const state = meta.state;
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
  const validSalience =
    salienceScore == null || (typeof salienceScore === "number" && salienceScore >= 0 && salienceScore <= 1);
  const validState = state == null || state === "hot" || state === "warm" || state === "cold" || state === "scar";
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
    validSalience &&
    validState &&
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
  const sum = a + e + n;
  return a >= 0 && e >= 0 && n >= 0 && Math.abs(sum - 1) < 1e-6;
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
  return validState && validConfidence && validUpdatedAt;
}

function isVoiceProfileValid(payload: Record<string, unknown>): boolean {
  const baseStance = payload.baseStance;
  const serviceModeAllowed = payload.serviceModeAllowed;
  const languagePolicy = payload.languagePolicy;
  const forbiddenSelfLabels = payload.forbiddenSelfLabels;
  return (
    baseStance === "self-determined" &&
    serviceModeAllowed === false &&
    languagePolicy === "follow_user_language" &&
    Array.isArray(forbiddenSelfLabels) &&
    forbiddenSelfLabels.every((item) => typeof item === "string")
  );
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
