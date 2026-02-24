import test from "node:test";
import assert from "node:assert/strict";
import { buildTurnLatencySummary } from "../dist/index.js";

test("buildTurnLatencySummary normalizes breakdown and computes shares", () => {
  const summary = buildTurnLatencySummary({
    breakdown: {
      routing: 10,
      recall: 40,
      planning: 20,
      llm_primary: 100
    },
    totalMs: 200
  });
  assert.equal(summary.totalMs, 200);
  assert.equal(summary.breakdown.llm_primary, 100);
  assert.equal(summary.shares.llm_primary, 0.5);
});

test("buildTurnLatencySummary clamps invalid values", () => {
  const summary = buildTurnLatencySummary({
    breakdown: {
      routing: -3,
      recall: Number.NaN,
      emit: 15
    }
  });
  assert.equal(summary.breakdown.routing, undefined);
  assert.equal(summary.breakdown.emit, 15);
  assert.equal(summary.totalMs, 15);
});
