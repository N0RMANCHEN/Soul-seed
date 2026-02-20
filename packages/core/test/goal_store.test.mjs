import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  appendExecutionTrace,
  cancelGoal,
  createGoal,
  getExecutionTrace,
  getGoal,
  listGoals
} from "../dist/index.js";

test("goal store can create/list/cancel goal", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-goal-store-"));
  const goal = await createGoal({
    rootPath: tmpDir,
    title: "整理项目重构清单",
    source: "user"
  });
  assert.equal(goal.title, "整理项目重构清单");
  assert.equal(goal.status, "pending");

  const listed = await listGoals(tmpDir);
  assert.equal(listed.length > 0, true);
  assert.equal(listed[0].id, goal.id);

  const canceled = await cancelGoal(tmpDir, goal.id);
  assert.equal(canceled?.status, "canceled");
  const loaded = await getGoal(tmpDir, goal.id);
  assert.equal(loaded?.status, "canceled");
});

test("execution trace can append and retrieve", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-goal-trace-"));
  const trace = await appendExecutionTrace(tmpDir, {
    type: "consistency",
    payload: {
      verdict: "allow"
    }
  });
  const loaded = await getExecutionTrace(tmpDir, trace.id);
  assert.equal(loaded?.id, trace.id);
  assert.equal(loaded?.type, "consistency");
});
