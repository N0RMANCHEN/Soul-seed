import test from "node:test";
import assert from "node:assert/strict";

import {
  DECISION_TRACE_SCHEMA_VERSION,
  normalizeDecisionTrace
} from "../dist/index.js";

test("normalizeDecisionTrace upgrades legacy version into current schema", () => {
  const normalized = normalizeDecisionTrace({
    version: "0.1.0",
    timestamp: "2026-02-17T00:00:00.000Z",
    selectedMemories: ["life=hello"],
    askClarifyingQuestion: true,
    refuse: false,
    riskLevel: "low",
    reason: "legacy",
    model: "mock-adapter"
  });

  assert.equal(normalized.version, DECISION_TRACE_SCHEMA_VERSION);
  assert.equal(normalized.askClarifyingQuestion, true);
  assert.equal(normalized.refuse, false);
  assert.equal(normalized.riskLevel, "low");
  assert.deepEqual(normalized.selectedMemories, ["life=hello"]);
});

test("normalizeDecisionTrace rejects unsupported version", () => {
  assert.throws(
    () =>
      normalizeDecisionTrace({
        version: "9.9.9"
      }),
    /Unsupported DecisionTrace version/
  );
});
