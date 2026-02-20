import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Goal, GoalEvent, GoalStatus, GoalStep } from "./types.js";

interface GoalIndexEntry {
  id: string;
  title: string;
  status: GoalStatus;
  updatedAt: string;
}

interface GoalIndex {
  schemaVersion: "1.0";
  goals: GoalIndexEntry[];
}

export interface ExecutionTraceRecord {
  id: string;
  goalId?: string;
  stepId?: string;
  ts: string;
  type: "consistency" | "execution";
  payload: Record<string, unknown>;
}

function isoNow(): string {
  return new Date().toISOString();
}

function goalsRoot(rootPath: string): string {
  return path.join(rootPath, "goals");
}

function indexPath(rootPath: string): string {
  return path.join(goalsRoot(rootPath), "index.json");
}

function goalPath(rootPath: string, goalId: string): string {
  return path.join(goalsRoot(rootPath), `goal-${goalId}.json`);
}

function goalLogPath(rootPath: string): string {
  return path.join(goalsRoot(rootPath), "goal.log.jsonl");
}

function traceLogPath(rootPath: string): string {
  return path.join(goalsRoot(rootPath), "trace.log.jsonl");
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(tmpPath, filePath);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function ensureGoalStore(rootPath: string): Promise<void> {
  const root = goalsRoot(rootPath);
  await mkdir(root, { recursive: true });
  if (!existsSync(indexPath(rootPath))) {
    const seed: GoalIndex = {
      schemaVersion: "1.0",
      goals: []
    };
    await writeJson(indexPath(rootPath), seed);
  }
  if (!existsSync(goalLogPath(rootPath))) {
    await writeFile(goalLogPath(rootPath), "", "utf8");
  }
  if (!existsSync(traceLogPath(rootPath))) {
    await writeFile(traceLogPath(rootPath), "", "utf8");
  }
}

async function readGoalIndex(rootPath: string): Promise<GoalIndex> {
  await ensureGoalStore(rootPath);
  const current = await readJson<GoalIndex>(indexPath(rootPath));
  if (current.schemaVersion !== "1.0" || !Array.isArray(current.goals)) {
    return { schemaVersion: "1.0", goals: [] };
  }
  return current;
}

async function writeGoalIndex(rootPath: string, index: GoalIndex): Promise<void> {
  await ensureGoalStore(rootPath);
  await writeJson(indexPath(rootPath), index);
}

async function appendGoalEvent(rootPath: string, event: GoalEvent): Promise<void> {
  await ensureGoalStore(rootPath);
  await writeFile(goalLogPath(rootPath), `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    flag: "a"
  });
}

export async function createGoal(params: {
  rootPath: string;
  title: string;
  source?: "user" | "system" | "mcp";
  summary?: string;
}): Promise<Goal> {
  await ensureGoalStore(params.rootPath);
  const now = isoNow();
  const goal: Goal = {
    id: randomUUID(),
    title: params.title.trim().slice(0, 200) || "Untitled goal",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    source: params.source ?? "user",
    ...(params.summary ? { summary: params.summary.slice(0, 400) } : {}),
    steps: []
  };
  await writeJson(goalPath(params.rootPath, goal.id), goal);
  const index = await readGoalIndex(params.rootPath);
  index.goals = [
    { id: goal.id, title: goal.title, status: goal.status, updatedAt: goal.updatedAt },
    ...index.goals.filter((item) => item.id !== goal.id)
  ].slice(0, 2000);
  await writeGoalIndex(params.rootPath, index);
  await appendGoalEvent(params.rootPath, {
    id: randomUUID(),
    goalId: goal.id,
    ts: now,
    type: "goal_created",
    payload: {
      title: goal.title,
      source: goal.source
    }
  });
  return goal;
}

export async function listGoals(rootPath: string, options?: {
  status?: GoalStatus;
  limit?: number;
}): Promise<GoalIndexEntry[]> {
  const index = await readGoalIndex(rootPath);
  const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(200, Math.floor(options?.limit as number))) : 50;
  return index.goals
    .filter((item) => !options?.status || item.status === options.status)
    .slice(0, limit);
}

export async function getGoal(rootPath: string, goalId: string): Promise<Goal | null> {
  await ensureGoalStore(rootPath);
  const p = goalPath(rootPath, goalId);
  if (!existsSync(p)) {
    return null;
  }
  return readJson<Goal>(p);
}

export async function saveGoal(rootPath: string, goal: Goal): Promise<void> {
  await ensureGoalStore(rootPath);
  goal.updatedAt = isoNow();
  await writeJson(goalPath(rootPath, goal.id), goal);
  const index = await readGoalIndex(rootPath);
  index.goals = [
    { id: goal.id, title: goal.title, status: goal.status, updatedAt: goal.updatedAt },
    ...index.goals.filter((item) => item.id !== goal.id)
  ].slice(0, 2000);
  await writeGoalIndex(rootPath, index);
  await appendGoalEvent(rootPath, {
    id: randomUUID(),
    goalId: goal.id,
    ts: goal.updatedAt,
    type: goal.status === "completed"
      ? "goal_completed"
      : goal.status === "blocked"
        ? "goal_blocked"
        : goal.status === "canceled"
          ? "goal_canceled"
          : "goal_updated",
    payload: {
      status: goal.status,
      steps: goal.steps.length
    }
  });
}

export async function cancelGoal(rootPath: string, goalId: string): Promise<Goal | null> {
  const goal = await getGoal(rootPath, goalId);
  if (!goal) {
    return null;
  }
  goal.status = "canceled";
  await saveGoal(rootPath, goal);
  return goal;
}

export async function appendGoalStep(rootPath: string, goalId: string, step: {
  title: string;
  toolName?: string;
  input?: Record<string, unknown>;
}): Promise<GoalStep | null> {
  const goal = await getGoal(rootPath, goalId);
  if (!goal) {
    return null;
  }
  const now = isoNow();
  const nextStep: GoalStep = {
    id: randomUUID(),
    title: step.title.trim().slice(0, 200) || "step",
    status: "running",
    ...(step.toolName ? { toolName: step.toolName } : {}),
    ...(step.input ? { input: step.input } : {}),
    createdAt: now,
    updatedAt: now
  };
  goal.steps.push(nextStep);
  goal.status = "active";
  await saveGoal(rootPath, goal);
  await appendGoalEvent(rootPath, {
    id: randomUUID(),
    goalId,
    ts: now,
    type: "goal_step_started",
    payload: {
      stepId: nextStep.id,
      title: nextStep.title,
      toolName: nextStep.toolName ?? null
    }
  });
  return nextStep;
}

export async function finishGoalStep(rootPath: string, goalId: string, stepId: string, params: {
  ok: boolean;
  output?: Record<string, unknown>;
  error?: string;
}): Promise<Goal | null> {
  const goal = await getGoal(rootPath, goalId);
  if (!goal) {
    return null;
  }
  const target = goal.steps.find((item) => item.id === stepId);
  if (!target) {
    return goal;
  }
  target.status = params.ok ? "succeeded" : "failed";
  target.updatedAt = isoNow();
  if (params.output) {
    target.output = params.output;
  }
  if (params.error) {
    target.error = params.error;
  }
  if (!params.ok) {
    goal.status = "blocked";
  }
  await saveGoal(rootPath, goal);
  await appendGoalEvent(rootPath, {
    id: randomUUID(),
    goalId,
    ts: target.updatedAt,
    type: params.ok ? "goal_step_succeeded" : "goal_step_failed",
    payload: {
      stepId,
      output: params.output ?? null,
      error: params.error ?? null
    }
  });
  return goal;
}

export async function appendExecutionTrace(rootPath: string, record: Omit<ExecutionTraceRecord, "id" | "ts">): Promise<ExecutionTraceRecord> {
  await ensureGoalStore(rootPath);
  const trace: ExecutionTraceRecord = {
    id: randomUUID(),
    ts: isoNow(),
    ...record
  };
  await writeFile(traceLogPath(rootPath), `${JSON.stringify(trace)}\n`, {
    encoding: "utf8",
    flag: "a"
  });
  return trace;
}

export async function getExecutionTrace(rootPath: string, traceId: string): Promise<ExecutionTraceRecord | null> {
  await ensureGoalStore(rootPath);
  const raw = await readFile(traceLogPath(rootPath), "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]) as ExecutionTraceRecord;
      if (parsed.id === traceId) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function listExecutionTraces(rootPath: string, options?: {
  goalId?: string;
  limit?: number;
}): Promise<ExecutionTraceRecord[]> {
  await ensureGoalStore(rootPath);
  const raw = await readFile(traceLogPath(rootPath), "utf8");
  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  const all: ExecutionTraceRecord[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]) as ExecutionTraceRecord;
      if (options?.goalId && parsed.goalId !== options.goalId) {
        continue;
      }
      all.push(parsed);
      const limit = Number.isFinite(options?.limit) ? Math.max(1, Math.min(200, Math.floor(options?.limit as number))) : 20;
      if (all.length >= limit) {
        break;
      }
    } catch {
      continue;
    }
  }
  return all;
}
