import crypto from "node:crypto";
import type {
  MultiPersonaSpeakerRegistry,
  MultiPersonaGroupPolicy,
  MultiPersonaRegistryEntry
} from "./multi_persona_registry.js";

// ── Types ───────────────────────────────────────────────────

export interface CooperationTask {
  taskId: string;
  description: string;
  requiredCapabilities: string[];
  status: "pending" | "assigned" | "in_progress" | "completed" | "blocked";
  assignedActorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CooperationPlan {
  planId: string;
  tasks: CooperationTask[];
  assignments: TaskAssignment[];
  conflicts: ConflictRecord[];
  status: "planning" | "executing" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export interface TaskAssignment {
  taskId: string;
  actorId: string;
  reason: string;
}

export interface ConflictRecord {
  taskId: string;
  conflictingActorIds: string[];
  resolution: "priority" | "split" | "defer" | "escalate";
  resolvedActorId: string | null;
  reason: string;
}

export interface CooperationInput {
  userRequest: string;
  registry: MultiPersonaSpeakerRegistry;
  policy: MultiPersonaGroupPolicy;
  existingPlan: CooperationPlan | null;
}

export interface CooperationOutput {
  plan: CooperationPlan;
  nextSpeakerActorId: string | null;
  reasonCodes: string[];
}

// ── Factory ─────────────────────────────────────────────────

export function createEmptyCooperationPlan(now?: string): CooperationPlan {
  const ts = now ?? new Date().toISOString();
  return {
    planId: crypto.randomUUID(),
    tasks: [],
    assignments: [],
    conflicts: [],
    status: "planning",
    createdAt: ts,
    updatedAt: ts
  };
}

// ── Heuristic helpers ───────────────────────────────────────

const ENUM_PATTERN = /(?:^|\n)\s*(?:\d+[.)]\s|[-*]\s)/;

function splitByEnumeration(text: string): string[] {
  const lines = text.split("\n");
  const items: string[] = [];
  let current = "";

  for (const line of lines) {
    if (/^\s*(?:\d+[.)]\s|[-*]\s)/.test(line)) {
      if (current.trim()) items.push(current.trim());
      current = line.replace(/^\s*(?:\d+[.)]\s|[-*]\s)/, "").trim();
    } else {
      current += (current ? " " : "") + line.trim();
    }
  }
  if (current.trim()) items.push(current.trim());
  return items.length > 1 ? items : [];
}

function findReferencedPersonas(
  text: string,
  entries: MultiPersonaRegistryEntry[]
): MultiPersonaRegistryEntry[] {
  const lower = text.toLowerCase();
  return entries.filter(
    (e) =>
      lower.includes(e.displayName.toLowerCase()) ||
      lower.includes(e.actorLabel.toLowerCase())
  );
}

function makeTask(
  description: string,
  now: string,
  capabilities: string[] = []
): CooperationTask {
  return {
    taskId: crypto.randomUUID(),
    description,
    requiredCapabilities: capabilities,
    status: "pending",
    assignedActorId: null,
    createdAt: now,
    updatedAt: now
  };
}

function assignRoundRobin(
  tasks: CooperationTask[],
  entries: MultiPersonaRegistryEntry[]
): { tasks: CooperationTask[]; assignments: TaskAssignment[] } {
  const assignments: TaskAssignment[] = [];
  const updatedTasks = tasks.map((t, i) => {
    const entry = entries[i % entries.length];
    assignments.push({
      taskId: t.taskId,
      actorId: entry.actorId,
      reason: "round_robin_assignment"
    });
    return { ...t, assignedActorId: entry.actorId, status: "assigned" as const };
  });
  return { tasks: updatedTasks, assignments };
}

// ── Core functions ──────────────────────────────────────────

export function decomposeRequest(input: CooperationInput): CooperationOutput {
  const { userRequest, registry, policy, existingPlan } = input;
  const now = new Date().toISOString();
  const entries = registry.entries;
  const reasonCodes: string[] = [];

  if (entries.length === 0) {
    const plan = existingPlan ?? createEmptyCooperationPlan(now);
    return { plan: { ...plan, updatedAt: now }, nextSpeakerActorId: null, reasonCodes: ["no_registered_personas"] };
  }

  if (!policy.cooperationEnabled) {
    reasonCodes.push("cooperation_disabled");
    const plan = existingPlan ?? createEmptyCooperationPlan(now);
    const task = makeTask(userRequest, now);
    const firstActor = entries[0];
    const assigned: CooperationTask = {
      ...task,
      assignedActorId: firstActor.actorId,
      status: "assigned"
    };
    return {
      plan: {
        ...plan,
        tasks: [assigned],
        assignments: [{ taskId: task.taskId, actorId: firstActor.actorId, reason: "cooperation_disabled_single" }],
        status: "executing",
        updatedAt: now
      },
      nextSpeakerActorId: firstActor.actorId,
      reasonCodes
    };
  }

  const plan = existingPlan ?? createEmptyCooperationPlan(now);
  let tasks: CooperationTask[];

  const referenced = findReferencedPersonas(userRequest, entries);
  if (referenced.length > 1) {
    reasonCodes.push("split_by_persona_reference");
    tasks = referenced.map((e) =>
      makeTask(`[${e.displayName}] ${userRequest}`, now)
    );
    const { tasks: assigned, assignments } = assignSpecific(tasks, referenced);
    const firstPending = assigned.find((t) => t.status === "assigned");
    return {
      plan: {
        ...plan,
        tasks: assigned,
        assignments,
        status: "executing",
        updatedAt: now
      },
      nextSpeakerActorId: firstPending?.assignedActorId ?? null,
      reasonCodes
    };
  }

  const enumItems = ENUM_PATTERN.test(userRequest)
    ? splitByEnumeration(userRequest)
    : [];
  if (enumItems.length > 1) {
    reasonCodes.push("split_by_enumeration");
    tasks = enumItems.map((item) => makeTask(item, now));
  } else {
    reasonCodes.push("single_task");
    tasks = [makeTask(userRequest, now)];
  }

  const { tasks: assigned, assignments } = assignRoundRobin(tasks, entries);
  const firstPending = assigned.find((t) => t.status === "assigned");

  return {
    plan: {
      ...plan,
      tasks: assigned,
      assignments,
      status: "executing",
      updatedAt: now
    },
    nextSpeakerActorId: firstPending?.assignedActorId ?? null,
    reasonCodes
  };
}

function assignSpecific(
  tasks: CooperationTask[],
  personas: MultiPersonaRegistryEntry[]
): { tasks: CooperationTask[]; assignments: TaskAssignment[] } {
  const assignments: TaskAssignment[] = [];
  const updatedTasks = tasks.map((t, i) => {
    const entry = personas[i % personas.length];
    assignments.push({
      taskId: t.taskId,
      actorId: entry.actorId,
      reason: "persona_reference_assignment"
    });
    return { ...t, assignedActorId: entry.actorId, status: "assigned" as const };
  });
  return { tasks: updatedTasks, assignments };
}

export function resolveConflict(
  plan: CooperationPlan,
  taskId: string,
  conflictingActorIds: string[],
  _policy: MultiPersonaGroupPolicy
): CooperationPlan {
  const now = new Date().toISOString();
  const winnerId = conflictingActorIds[0] ?? null;

  const conflict: ConflictRecord = {
    taskId,
    conflictingActorIds,
    resolution: "priority",
    resolvedActorId: winnerId,
    reason: "first_in_registry_order"
  };

  const updatedTasks = plan.tasks.map((t) => {
    if (t.taskId !== taskId) return t;
    return { ...t, assignedActorId: winnerId, updatedAt: now };
  });

  const existingAssignment = plan.assignments.find((a) => a.taskId === taskId);
  const updatedAssignments = existingAssignment
    ? plan.assignments.map((a) =>
        a.taskId === taskId && winnerId
          ? { ...a, actorId: winnerId, reason: "conflict_resolution_priority" }
          : a
      )
    : winnerId
      ? [...plan.assignments, { taskId, actorId: winnerId, reason: "conflict_resolution_priority" }]
      : plan.assignments;

  return {
    ...plan,
    tasks: updatedTasks,
    assignments: updatedAssignments,
    conflicts: [...plan.conflicts, conflict],
    updatedAt: now
  };
}

export function advanceTask(
  plan: CooperationPlan,
  taskId: string,
  newStatus: CooperationTask["status"]
): CooperationPlan {
  const now = new Date().toISOString();

  const updatedTasks = plan.tasks.map((t) => {
    if (t.taskId !== taskId) return t;
    return { ...t, status: newStatus, updatedAt: now };
  });

  const allCompleted = updatedTasks.every((t) => t.status === "completed");

  return {
    ...plan,
    tasks: updatedTasks,
    status: allCompleted ? "completed" : plan.status,
    updatedAt: now
  };
}

export function computeCooperationLatencyBudget(
  policy: MultiPersonaGroupPolicy,
  _taskCount: number
): number {
  return policy.turnScheduling.timeoutMs * 1.5;
}
