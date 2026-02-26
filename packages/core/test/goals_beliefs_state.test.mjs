import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyGoalsState,
  addGoal,
  transitionGoalStatus,
  createEmptyBeliefsState,
  upsertBelief,
  BELIEF_MAX_CONFIDENCE_STEP,
} from "../dist/index.js";

test("goals state enforces legal transitions", () => {
  let state = createEmptyGoalsState();
  state = addGoal(state, { id: "g1", title: "Ship feature" });

  const bad = transitionGoalStatus(state, "g1", "completed", ["ev1"]);
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "illegal_transition");

  const active = transitionGoalStatus(state, "g1", "active");
  assert.equal(active.ok, true);

  const completedNoEvidence = transitionGoalStatus(active.state, "g1", "completed");
  assert.equal(completedNoEvidence.ok, false);
  assert.equal(completedNoEvidence.reason, "missing_evidence");

  const completed = transitionGoalStatus(active.state, "g1", "completed", ["ev2"]);
  assert.equal(completed.ok, true);
});

test("beliefs state enforces cooldown and confidence step", () => {
  let state = createEmptyBeliefsState();

  const created = upsertBelief(
    state,
    {
      id: "b1",
      proposition: "User prefers concise replies",
      confidence: 0.5,
      evidenceRefs: ["ev1"],
      cooldownHours: 24,
    },
    "2026-02-26T10:00:00.000Z",
  );
  assert.equal(created.ok, true);
  state = created.state;

  const blocked = upsertBelief(
    state,
    {
      id: "b1",
      proposition: "User prefers concise replies",
      confidence: 0.55,
      evidenceRefs: ["ev2"],
      cooldownHours: 24,
    },
    "2026-02-26T12:00:00.000Z",
  );
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "cooldown_active");

  const tooLargeStep = upsertBelief(
    state,
    {
      id: "b1",
      proposition: "User prefers concise replies",
      confidence: 0.5 + BELIEF_MAX_CONFIDENCE_STEP + 0.01,
      evidenceRefs: ["ev3"],
      cooldownHours: 24,
    },
    "2026-02-27T12:00:00.000Z",
  );
  assert.equal(tooLargeStep.ok, false);
  assert.equal(tooLargeStep.reason, "confidence_step_too_large");
});
