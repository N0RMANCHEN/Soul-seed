import type { LifeEvent } from "../types.js";
import { getDefaultDerivedParams } from "./genome_derived.js";
import { promises as fs } from "node:fs";
import { join } from "node:path";

export interface CalibrationConfig {
  version: string;
  calibratedAt: string;
  locked: boolean;
  turnsSampled: number;
  baseline: CalibrationBaseline;
}

export interface CalibrationBaseline {
  avgReplyLength: number;
  avgValence: number;
  avgArousal: number;
  moodDeltaScale: number;
  baselineRegressionSpeed: number;
  recallTopK: number;
}

export function getDefaultCalibrationBaseline(): CalibrationBaseline {
  const dp = getDefaultDerivedParams();
  return {
    avgReplyLength: 500,
    avgValence: 0.0,
    avgArousal: 0.3,
    moodDeltaScale: dp.moodDeltaScale,
    baselineRegressionSpeed: dp.baselineRegressionSpeed,
    recallTopK: dp.recallTopK,
  };
}

export function inferCalibrationFromEvents(
  events: LifeEvent[],
  maxTurns: number = 200
): CalibrationBaseline {
  const defaults = getDefaultCalibrationBaseline();

  const assistantEvents = events
    .filter((e) => e.type === "assistant_message")
    .slice(-maxTurns);

  if (assistantEvents.length < 10) return defaults;

  let totalLen = 0;
  for (const e of assistantEvents) {
    const text = ((e.payload.text ?? e.payload.reply ?? "") as string);
    totalLen += text.length;
  }

  return {
    ...defaults,
    avgReplyLength: Math.round(totalLen / assistantEvents.length),
  };
}

export async function loadCalibrationConfig(personaRoot: string): Promise<CalibrationConfig> {
  const filePath = join(personaRoot, "compat_calibration.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {
      version: "1.0",
      calibratedAt: new Date().toISOString(),
      locked: false,
      turnsSampled: 0,
      baseline: getDefaultCalibrationBaseline(),
    };
  }
}

export async function saveCalibrationConfig(
  personaRoot: string,
  config: CalibrationConfig
): Promise<boolean> {
  try {
    const existing = await loadCalibrationConfig(personaRoot);
    if (existing.locked) return false;
  } catch { /* no existing file */ }

  const filePath = join(personaRoot, "compat_calibration.json");
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
  return true;
}

export async function lockCalibration(personaRoot: string): Promise<CalibrationConfig> {
  const config = await loadCalibrationConfig(personaRoot);
  config.locked = true;
  config.calibratedAt = new Date().toISOString();
  const filePath = join(personaRoot, "compat_calibration.json");
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
  return config;
}

export function validateCalibration(config: CalibrationConfig): { valid: boolean; missing: string[] } {
  const required: (keyof CalibrationBaseline)[] = [
    "avgReplyLength", "avgValence", "avgArousal",
    "moodDeltaScale", "baselineRegressionSpeed", "recallTopK",
  ];
  const missing = required.filter((k) => config.baseline[k] === undefined || config.baseline[k] === null);
  return { valid: missing.length === 0, missing };
}
