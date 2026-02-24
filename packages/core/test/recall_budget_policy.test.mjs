import test from "node:test";
import assert from "node:assert/strict";
import { deriveRecallBudgetPolicy } from "../dist/index.js";

test("deriveRecallBudgetPolicy uses default profile for normal short chat", () => {
  const result = deriveRecallBudgetPolicy({
    userInput: "我们今天先聊点轻松的近况，不着急推进任务。"
  });
  assert.equal(result.profile, "default");
  assert.equal(result.budget.injectMax, 7);
  assert.ok(result.reasonCodes.includes("default_policy"));
});

test("deriveRecallBudgetPolicy upgrades budget for task/deep intent", () => {
  const result = deriveRecallBudgetPolicy({
    userInput: "请你详细拆一下这个任务",
    projection: {
      confidence: 0.7,
      signals: [
        { label: "task", score: 0.8 },
        { label: "deep", score: 0.66 }
      ]
    },
    routeDecision: "deliberative"
  });
  assert.equal(result.profile, "task_deep");
  assert.ok(result.budget.candidateMax >= 220);
  assert.ok(result.reasonCodes.includes("task_or_deep_intent"));
});

test("deriveRecallBudgetPolicy prefers goal_active when pending goal exists", () => {
  const result = deriveRecallBudgetPolicy({
    userInput: "继续推进",
    hasPendingGoal: true,
    projection: {
      confidence: 0.4,
      signals: [{ label: "task", score: 0.5 }]
    }
  });
  assert.equal(result.profile, "goal_active");
  assert.ok(result.budget.injectCharMax >= 3200);
  assert.ok(result.reasonCodes.includes("goal_active"));
});
