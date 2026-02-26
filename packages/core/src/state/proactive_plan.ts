import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProactivePlan } from "../proactive/planner_contract.js";
import { shouldUseStateDeltaPipelineFromRoot, writeStateDelta } from "./state_delta_writer.js";

export const PROACTIVE_PLAN_FILENAME = "proactive_plan.json";

export type ProactivePlanData = ProactivePlan & { updatedAt?: string };

export function createInitialProactivePlan(nowIso?: string): ProactivePlanData {
  return {
    schemaVersion: "1.0",
    intent: "NUDGE",
    target: { type: "topic", id: "t_open" },
    why: ["bootstrap_default"],
    constraints: { maxSentences: 2, tone: "warm" },
    updatedAt: nowIso ?? new Date().toISOString()
  };
}

export function normalizeProactivePlan(raw: Record<string, unknown>): ProactivePlanData {
  const schemaVersion = raw.schemaVersion === "1.0" ? "1.0" : "1.0";
  const intentRaw = typeof raw.intent === "string" ? raw.intent : "NUDGE";
  const intent = intentRaw === "FOLLOW_UP" || intentRaw === "SHARE" || intentRaw === "CHECK_IN" ? intentRaw : "NUDGE";
  const targetObj = raw.target && typeof raw.target === "object" && !Array.isArray(raw.target)
    ? (raw.target as Record<string, unknown>)
    : {};
  const typeRaw = typeof targetObj.type === "string" ? targetObj.type : "topic";
  const targetType = typeRaw === "entity" || typeRaw === "goal" ? typeRaw : "topic";
  const targetId = typeof targetObj.id === "string" && targetObj.id.trim().length > 0
    ? targetObj.id.trim().slice(0, 80)
    : "t_open";
  const why = Array.isArray(raw.why)
    ? raw.why.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 8)
    : [];
  const constraintsObj = raw.constraints && typeof raw.constraints === "object" && !Array.isArray(raw.constraints)
    ? (raw.constraints as Record<string, unknown>)
    : null;
  const maxSentencesRaw = constraintsObj ? Number(constraintsObj.maxSentences) : NaN;
  const maxSentences = Number.isFinite(maxSentencesRaw) ? Math.max(1, Math.min(6, Math.floor(maxSentencesRaw))) : undefined;
  const tone = constraintsObj && typeof constraintsObj.tone === "string" ? constraintsObj.tone.slice(0, 24) : undefined;
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : undefined;

  return {
    schemaVersion,
    intent,
    target: { type: targetType, id: targetId },
    why: why.length > 0 ? why : ["fallback_normalized"],
    ...(maxSentences !== undefined || tone !== undefined
      ? {
          constraints: {
            ...(maxSentences !== undefined ? { maxSentences } : {}),
            ...(tone !== undefined ? { tone } : {})
          }
        }
      : {}),
    ...(updatedAt ? { updatedAt } : {})
  };
}

export async function loadProactivePlan(rootPath: string): Promise<ProactivePlanData | null> {
  const filePath = path.join(rootPath, PROACTIVE_PLAN_FILENAME);
  if (!existsSync(filePath)) return null;
  try {
    const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
    return normalizeProactivePlan(raw);
  } catch {
    return null;
  }
}

export async function writeProactivePlan(rootPath: string, data: ProactivePlanData): Promise<void> {
  if (await shouldUseStateDeltaPipelineFromRoot(rootPath)) {
    await writeStateDelta(
      rootPath,
      "proactive_plan",
      data as unknown as Record<string, unknown>,
      { confidence: 1.0, systemGenerated: true }
    );
    return;
  }
  await writeFile(path.join(rootPath, PROACTIVE_PLAN_FILENAME), JSON.stringify(data, null, 2), "utf8");
}
