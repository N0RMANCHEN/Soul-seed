import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyCooperationPlan,
  decomposeRequest,
  resolveConflict,
  advanceTask,
  computeCooperationLatencyBudget,
  createDefaultGroupPolicy,
  createDefaultSpeakerRegistry
} from "../dist/index.js";

function makeRegistry(names) {
  const reg = createDefaultSpeakerRegistry();
  reg.entries = names.map((n, i) => ({
    actorId: `actor_${n.toLowerCase()}`,
    actorLabel: n,
    role: "assistant",
    personaId: `persona_${n.toLowerCase()}`,
    displayName: n,
    registeredAt: new Date().toISOString()
  }));
  return reg;
}

function makePolicy(overrides) {
  const p = createDefaultGroupPolicy();
  if (overrides) {
    Object.assign(p, overrides);
    if (overrides.turnScheduling) {
      p.turnScheduling = { ...p.turnScheduling, ...overrides.turnScheduling };
    }
  }
  return p;
}

// ── cooperation disabled ────────────────────────────────────

test("cooperation disabled returns single-task plan", () => {
  const registry = makeRegistry(["Alice", "Bob"]);
  const policy = makePolicy({ cooperationEnabled: false });

  const result = decomposeRequest({
    userRequest: "Tell me a story",
    registry,
    policy,
    existingPlan: null
  });

  assert.equal(result.plan.tasks.length, 1);
  assert.equal(result.plan.tasks[0].assignedActorId, "actor_alice");
  assert.equal(result.plan.status, "executing");
  assert.equal(result.nextSpeakerActorId, "actor_alice");
  assert.ok(result.reasonCodes.includes("cooperation_disabled"));
});

// ── enumeration decomposition ───────────────────────────────

test("enumeration patterns decompose into multiple tasks", () => {
  const registry = makeRegistry(["Alice", "Bob", "Charlie"]);
  const policy = makePolicy({ cooperationEnabled: true });

  const result = decomposeRequest({
    userRequest: "1. Write a poem\n2. Draw a picture\n3. Compose a song",
    registry,
    policy,
    existingPlan: null
  });

  assert.equal(result.plan.tasks.length, 3);
  assert.ok(result.reasonCodes.includes("split_by_enumeration"));
  assert.equal(result.plan.tasks[0].description, "Write a poem");
  assert.equal(result.plan.tasks[1].description, "Draw a picture");
  assert.equal(result.plan.tasks[2].description, "Compose a song");

  assert.equal(result.plan.tasks[0].assignedActorId, "actor_alice");
  assert.equal(result.plan.tasks[1].assignedActorId, "actor_bob");
  assert.equal(result.plan.tasks[2].assignedActorId, "actor_charlie");
  assert.equal(result.nextSpeakerActorId, "actor_alice");
});

// ── persona name reference split ────────────────────────────

test("multi-persona name references split tasks", () => {
  const registry = makeRegistry(["Alice", "Bob"]);
  const policy = makePolicy({ cooperationEnabled: true });

  const result = decomposeRequest({
    userRequest: "Alice should write the intro and Bob should write the conclusion",
    registry,
    policy,
    existingPlan: null
  });

  assert.equal(result.plan.tasks.length, 2);
  assert.ok(result.reasonCodes.includes("split_by_persona_reference"));
  assert.equal(result.plan.tasks[0].assignedActorId, "actor_alice");
  assert.equal(result.plan.tasks[1].assignedActorId, "actor_bob");
});

// ── conflict resolution ─────────────────────────────────────

test("conflict resolution assigns by priority (first in list)", () => {
  const policy = makePolicy({ cooperationEnabled: true });
  const plan = createEmptyCooperationPlan();
  const taskId = "task_conflict";
  plan.tasks = [{
    taskId,
    description: "Contested task",
    requiredCapabilities: [],
    status: "pending",
    assignedActorId: null,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  }];

  const resolved = resolveConflict(
    plan,
    taskId,
    ["actor_bob", "actor_alice"],
    policy
  );

  assert.equal(resolved.conflicts.length, 1);
  assert.equal(resolved.conflicts[0].resolution, "priority");
  assert.equal(resolved.conflicts[0].resolvedActorId, "actor_bob");
  assert.equal(resolved.conflicts[0].reason, "first_in_registry_order");

  const task = resolved.tasks.find(t => t.taskId === taskId);
  assert.equal(task.assignedActorId, "actor_bob");
});

// ── advanceTask ─────────────────────────────────────────────

test("advanceTask updates status and completes plan when all done", () => {
  const plan = createEmptyCooperationPlan();
  const t1 = "task_1";
  const t2 = "task_2";
  plan.tasks = [
    { taskId: t1, description: "A", requiredCapabilities: [], status: "in_progress", assignedActorId: "a1", createdAt: plan.createdAt, updatedAt: plan.updatedAt },
    { taskId: t2, description: "B", requiredCapabilities: [], status: "completed", assignedActorId: "a2", createdAt: plan.createdAt, updatedAt: plan.updatedAt }
  ];
  plan.status = "executing";

  const step1 = advanceTask(plan, t1, "completed");
  assert.equal(step1.tasks.find(t => t.taskId === t1).status, "completed");
  assert.equal(step1.status, "completed");
});

test("advanceTask does not complete plan if tasks remain", () => {
  const plan = createEmptyCooperationPlan();
  const t1 = "task_1";
  const t2 = "task_2";
  plan.tasks = [
    { taskId: t1, description: "A", requiredCapabilities: [], status: "pending", assignedActorId: "a1", createdAt: plan.createdAt, updatedAt: plan.updatedAt },
    { taskId: t2, description: "B", requiredCapabilities: [], status: "pending", assignedActorId: "a2", createdAt: plan.createdAt, updatedAt: plan.updatedAt }
  ];
  plan.status = "executing";

  const step1 = advanceTask(plan, t1, "in_progress");
  assert.equal(step1.tasks.find(t => t.taskId === t1).status, "in_progress");
  assert.equal(step1.status, "executing");
});

// ── latency budget ──────────────────────────────────────────

test("latency budget = 1.5x timeout", () => {
  const policy = makePolicy({
    turnScheduling: { timeoutMs: 30000 }
  });

  const budget = computeCooperationLatencyBudget(policy, 3);
  assert.equal(budget, 45000);
});

test("latency budget scales with custom timeout", () => {
  const policy = makePolicy({
    turnScheduling: { timeoutMs: 10000 }
  });

  const budget = computeCooperationLatencyBudget(policy, 5);
  assert.equal(budget, 15000);
});

// ── edge: single task when no enumeration ───────────────────

test("single task when request has no enumeration or persona refs", () => {
  const registry = makeRegistry(["Alpha"]);
  const policy = makePolicy({ cooperationEnabled: true });

  const result = decomposeRequest({
    userRequest: "Tell me about the weather",
    registry,
    policy,
    existingPlan: null
  });

  assert.equal(result.plan.tasks.length, 1);
  assert.ok(result.reasonCodes.includes("single_task"));
  assert.equal(result.nextSpeakerActorId, "actor_alpha");
});

// ── edge: empty registry ────────────────────────────────────

test("empty registry returns null speaker", () => {
  const registry = createDefaultSpeakerRegistry();
  const policy = makePolicy({ cooperationEnabled: true });

  const result = decomposeRequest({
    userRequest: "Do something",
    registry,
    policy,
    existingPlan: null
  });

  assert.equal(result.nextSpeakerActorId, null);
  assert.ok(result.reasonCodes.includes("no_registered_personas"));
});
