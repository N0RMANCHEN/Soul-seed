/**
 * Goals State Module — first-class state for goals, commitments, drives.
 * H/P1-1: Goals / Beliefs State Module.
 * Schema per doc/plans/H2-State-Modules.md §3.2.
 */
import { promises as fs } from "node:fs";
import { join } from "node:path";

export const GOALS_SCHEMA_VERSION = "1.0";

export interface GoalEntry {
  goalId: string;
  type: "short" | "mid" | "long";
  description: string;
  status: "active" | "completed" | "abandoned";
  createdAt: string;
  evidence: string[];
  priority: number;
}

export interface CommitmentEntry {
  commitmentId: string;
  to: string;
  description: string;
  status: "pending" | "fulfilled" | "defaulted";
  dueBy: string | null;
  evidence: string[];
}

export interface DrivesConfig {
  exploration: number;
  safety: number;
  efficiency: number;
  intimacy: number;
}

export interface GoalsState {
  schemaVersion: string;
  updatedAt: string;
  goals: GoalEntry[];
  commitments: CommitmentEntry[];
  drives: DrivesConfig;
}

const DEFAULT_DRIVES: DrivesConfig = {
  exploration: 0.5,
  safety: 0.5,
  efficiency: 0.5,
  intimacy: 0.5,
};

function clampDrive(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0.5));
}

export function createDefaultGoalsState(updatedAt?: string): GoalsState {
  const now = updatedAt ?? new Date().toISOString();
  return {
    schemaVersion: GOALS_SCHEMA_VERSION,
    updatedAt: now,
    goals: [],
    commitments: [],
    drives: { ...DEFAULT_DRIVES },
  };
}

export function normalizeGoalsState(raw: unknown, updatedAt?: string): GoalsState {
  const now = updatedAt ?? new Date().toISOString();
  if (!raw || typeof raw !== "object") {
    return createDefaultGoalsState(now);
  }
  const obj = raw as Record<string, unknown>;
  const goals = Array.isArray(obj.goals)
    ? (obj.goals as GoalEntry[]).filter(
        (g) =>
          g &&
          typeof g.goalId === "string" &&
          typeof g.description === "string" &&
          ["short", "mid", "long"].includes(g.type ?? "") &&
          ["active", "completed", "abandoned"].includes(g.status ?? "")
      )
    : [];
  const commitments = Array.isArray(obj.commitments)
    ? (obj.commitments as CommitmentEntry[]).filter(
        (c) =>
          c &&
          typeof c.commitmentId === "string" &&
          typeof c.description === "string" &&
          ["pending", "fulfilled", "defaulted"].includes(c.status ?? "")
      )
    : [];
  const drivesRaw = obj.drives && typeof obj.drives === "object" ? (obj.drives as Record<string, unknown>) : {};
  const drives: DrivesConfig = {
    exploration: clampDrive(Number(drivesRaw.exploration)),
    safety: clampDrive(Number(drivesRaw.safety)),
    efficiency: clampDrive(Number(drivesRaw.efficiency)),
    intimacy: clampDrive(Number(drivesRaw.intimacy)),
  };
  return {
    schemaVersion: String(obj.schemaVersion ?? GOALS_SCHEMA_VERSION),
    updatedAt: String(obj.updatedAt ?? now),
    goals,
    commitments,
    drives,
  };
}

export async function loadGoals(personaRoot: string): Promise<GoalsState> {
  const filePath = join(personaRoot, "goals.json");
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return normalizeGoalsState(parsed);
  } catch {
    return createDefaultGoalsState();
  }
}

export async function saveGoals(personaRoot: string, state: GoalsState): Promise<void> {
  const filePath = join(personaRoot, "goals.json");
  const normalized = normalizeGoalsState(state);
  normalized.updatedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), "utf-8");
}
