import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const GOALS_STATE_FILENAME = "goals.json";
export const GOALS_STATE_SCHEMA_VERSION = "1.0";

export type GoalLifecycle = "pending" | "active" | "completed" | "canceled";

export interface GoalStateItem {
  id: string;
  title: string;
  status: GoalLifecycle;
  priority: number;
  createdAt: string;
  updatedAt: string;
  evidenceRefs: string[];
}

export interface GoalsState {
  schemaVersion: string;
  updatedAt: string;
  items: GoalStateItem[];
}

function isoNow(): string {
  return new Date().toISOString();
}

const ALLOWED_TRANSITIONS: Record<GoalLifecycle, GoalLifecycle[]> = {
  pending: ["active", "canceled"],
  active: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export function createEmptyGoalsState(): GoalsState {
  return {
    schemaVersion: GOALS_STATE_SCHEMA_VERSION,
    updatedAt: isoNow(),
    items: [],
  };
}

export async function loadGoalsState(rootPath: string): Promise<GoalsState> {
  const filePath = path.join(rootPath, GOALS_STATE_FILENAME);
  if (!existsSync(filePath)) return createEmptyGoalsState();
  try {
    const raw = await readFile(filePath, "utf8");
    return normalizeGoalsState(JSON.parse(raw) as Partial<GoalsState>);
  } catch {
    return createEmptyGoalsState();
  }
}

export async function saveGoalsState(rootPath: string, state: GoalsState): Promise<void> {
  const filePath = path.join(rootPath, GOALS_STATE_FILENAME);
  const normalized = normalizeGoalsState(state);
  normalized.updatedAt = isoNow();
  await writeFile(filePath, JSON.stringify(normalized, null, 2), "utf8");
}

export function addGoal(
  state: GoalsState,
  input: { id: string; title: string; priority?: number; evidenceRefs?: string[] },
): GoalsState {
  const normalized = normalizeGoalsState(state);
  if (normalized.items.some((item) => item.id === input.id)) {
    return normalized;
  }

  const now = isoNow();
  const next: GoalStateItem = {
    id: input.id,
    title: input.title.trim().slice(0, 200),
    status: "pending",
    priority: Math.max(1, Math.min(10, Math.round(input.priority ?? 5))),
    createdAt: now,
    updatedAt: now,
    evidenceRefs: (input.evidenceRefs ?? []).filter((x) => typeof x === "string").slice(0, 12),
  };

  return {
    ...normalized,
    updatedAt: now,
    items: [...normalized.items, next],
  };
}

export function transitionGoalStatus(
  state: GoalsState,
  goalId: string,
  nextStatus: GoalLifecycle,
  evidenceRefs?: string[],
): { state: GoalsState; ok: boolean; reason?: string } {
  const normalized = normalizeGoalsState(state);
  const idx = normalized.items.findIndex((item) => item.id === goalId);
  if (idx < 0) return { state: normalized, ok: false, reason: "goal_not_found" };

  const current = normalized.items[idx];
  if (current.status === nextStatus) return { state: normalized, ok: true };

  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return { state: normalized, ok: false, reason: "illegal_transition" };
  }

  if ((nextStatus === "completed" || nextStatus === "canceled") && (!evidenceRefs || evidenceRefs.length === 0)) {
    return { state: normalized, ok: false, reason: "missing_evidence" };
  }

  const now = isoNow();
  const nextItems = [...normalized.items];
  nextItems[idx] = {
    ...current,
    status: nextStatus,
    updatedAt: now,
    evidenceRefs:
      evidenceRefs && evidenceRefs.length > 0
        ? evidenceRefs.filter((x) => typeof x === "string").slice(0, 12)
        : current.evidenceRefs,
  };

  return {
    ok: true,
    state: {
      ...normalized,
      updatedAt: now,
      items: nextItems,
    },
  };
}

function normalizeGoalsState(raw: Partial<GoalsState> | undefined): GoalsState {
  const now = isoNow();
  const items = Array.isArray(raw?.items)
    ? raw.items
        .map((item) => normalizeGoalItem(item))
        .filter((item): item is GoalStateItem => item !== null)
        .slice(0, 200)
    : [];

  return {
    schemaVersion:
      typeof raw?.schemaVersion === "string" && raw.schemaVersion.trim().length > 0
        ? raw.schemaVersion
        : GOALS_STATE_SCHEMA_VERSION,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : now,
    items,
  };
}

function normalizeGoalItem(raw: unknown): GoalStateItem | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<GoalStateItem>;
  if (typeof row.id !== "string" || row.id.trim().length === 0) return null;
  if (typeof row.title !== "string" || row.title.trim().length === 0) return null;

  const status: GoalLifecycle =
    row.status === "pending" || row.status === "active" || row.status === "completed" || row.status === "canceled"
      ? row.status
      : "pending";

  return {
    id: row.id,
    title: row.title.trim().slice(0, 200),
    status,
    priority:
      typeof row.priority === "number" && Number.isFinite(row.priority)
        ? Math.max(1, Math.min(10, Math.round(row.priority)))
        : 5,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : isoNow(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : isoNow(),
    evidenceRefs: Array.isArray(row.evidenceRefs)
      ? row.evidenceRefs.filter((x): x is string => typeof x === "string").slice(0, 12)
      : [],
  };
}
