import type { ProactiveStateSnapshot } from "../types.js";

export type ProactiveIntent = "FOLLOW_UP" | "SHARE" | "CHECK_IN" | "NUDGE";
export type ProactiveTargetType = "topic" | "entity" | "goal";

export interface ProactivePlan {
  schemaVersion: "1.0";
  intent: ProactiveIntent;
  target: {
    type: ProactiveTargetType;
    id: string;
  };
  why: string[];
  constraints?: {
    maxSentences?: number;
    tone?: string;
  };
}

export interface BuildProactivePlanInput {
  snapshot: ProactiveStateSnapshot;
  activeTopic?: string;
  pendingGoalId?: string;
  targetEntityId?: string;
}

export function buildProactivePlan(input: BuildProactivePlanInput): ProactivePlan {
  const topicAffinity = Number(input.snapshot.topicAffinity ?? 0.5);
  const goalId = normalizeId(input.pendingGoalId, "g_");
  const topicId = normalizeId(input.activeTopic, "t_");
  const entityId = normalizeId(input.targetEntityId, "e_");

  let intent: ProactiveIntent = "NUDGE";
  let target: { type: ProactiveTargetType; id: string } = { type: "topic", id: topicId ?? "t_open" };

  if (goalId) {
    intent = "FOLLOW_UP";
    target = { type: "goal", id: goalId };
  } else if (topicId && topicAffinity >= 0.72) {
    intent = "SHARE";
    target = { type: "topic", id: topicId };
  } else if (entityId) {
    intent = "CHECK_IN";
    target = { type: "entity", id: entityId };
  } else if (input.snapshot.curiosity >= 0.58 && topicId) {
    intent = "CHECK_IN";
    target = { type: "topic", id: topicId };
  }

  const why = buildWhy(input.snapshot, intent);
  const maxSentences = input.snapshot.probability >= 0.55 ? 3 : 2;
  const tone = input.snapshot.isInQuietHours ? "gentle" : "warm";

  return {
    schemaVersion: "1.0",
    intent,
    target,
    why,
    constraints: { maxSentences, tone }
  };
}

export function isProactivePlanValid(raw: unknown): raw is ProactivePlan {
  if (!isRecord(raw)) return false;
  if (raw.schemaVersion !== "1.0") return false;
  if (!isOneOf(raw.intent, ["FOLLOW_UP", "SHARE", "CHECK_IN", "NUDGE"])) return false;
  if (!isRecord(raw.target)) return false;
  if (!isOneOf(raw.target.type, ["topic", "entity", "goal"])) return false;
  if (typeof raw.target.id !== "string" || raw.target.id.trim().length === 0) return false;
  if (!Array.isArray(raw.why) || raw.why.some((item) => typeof item !== "string")) return false;
  if (raw.constraints !== undefined) {
    if (!isRecord(raw.constraints)) return false;
    if (raw.constraints.maxSentences !== undefined && typeof raw.constraints.maxSentences !== "number") return false;
    if (raw.constraints.tone !== undefined && typeof raw.constraints.tone !== "string") return false;
  }
  return true;
}

export function applyProactivePlanConstraints(
  text: string,
  plan: Pick<ProactivePlan, "constraints">
): { text: string; constrained: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { text: "", constrained: false };
  const maxSentencesRaw = Number(plan.constraints?.maxSentences ?? 0);
  if (!Number.isFinite(maxSentencesRaw) || maxSentencesRaw <= 0) {
    return { text: trimmed, constrained: false };
  }
  const maxSentences = Math.max(1, Math.min(6, Math.floor(maxSentencesRaw)));
  const sentences = splitSentences(trimmed);
  if (sentences.length <= maxSentences) {
    return { text: trimmed, constrained: false };
  }
  return {
    text: sentences.slice(0, maxSentences).join("").trim(),
    constrained: true
  };
}

function buildWhy(snapshot: ProactiveStateSnapshot, intent: ProactiveIntent): string[] {
  const topicAffinity = Number(snapshot.topicAffinity ?? 0.5);
  const gateReasons = Array.isArray(snapshot.gateReasons) ? snapshot.gateReasons : [];
  const reasons: string[] = [];
  if (intent === "FOLLOW_UP") reasons.push("pending_goal");
  if (topicAffinity >= 0.7) reasons.push("interest_overlap_high");
  if (snapshot.curiosity >= 0.55) reasons.push("curiosity_trigger");
  if (snapshot.frequencyWindowHit) reasons.push("frequency_cap_near");
  reasons.push(...gateReasons.slice(0, 3));
  if (reasons.length === 0) reasons.push("low_risk_nudge");
  return [...new Set(reasons)].slice(0, 6);
}

function normalizeId(value: string | undefined, prefix: string): string | undefined {
  if (!value) return undefined;
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5_]+/g, "_").replace(/^_+|_+$/g, "");
  if (!clean) return undefined;
  return clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function splitSentences(input: string): string[] {
  const parts = input.match(/[^。！？!?\.]+[。！？!?\.]?/g) ?? [input];
  return parts.map((item) => item.trim()).filter((item) => item.length > 0);
}
