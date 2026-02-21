import test from "node:test";
import assert from "node:assert/strict";

import { computeMemoryUncertainty } from "../dist/index.js";

test("P4-0: computeMemoryUncertainty returns certain for high credibility recent memory", () => {
  const result = computeMemoryUncertainty({
    credibilityScore: 0.9,
    reconsolidationCount: 0,
    updatedAt: new Date().toISOString()
  });
  assert.equal(result, "certain");
});

test("P4-0: computeMemoryUncertainty returns uncertain for low credibility", () => {
  const result = computeMemoryUncertainty({
    credibilityScore: 0.4,
    reconsolidationCount: 0,
    updatedAt: new Date().toISOString()
  });
  assert.equal(result, "uncertain");
});

test("P4-0: computeMemoryUncertainty returns uncertain for old memory (>60 days)", () => {
  const seventyDaysAgo = new Date(Date.now() - 70 * 86400000).toISOString();
  const result = computeMemoryUncertainty({
    credibilityScore: 0.9,
    reconsolidationCount: 1,
    updatedAt: seventyDaysAgo
  });
  assert.equal(result, "uncertain");
});

test("P4-0: computeMemoryUncertainty returns certain for recent memory with good credibility", () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const result = computeMemoryUncertainty({
    credibilityScore: 0.85,
    reconsolidationCount: 2,
    updatedAt: thirtyDaysAgo
  });
  assert.equal(result, "certain");
});

test("P4-0: computeMemoryUncertainty defaults to certain for missing fields", () => {
  const result = computeMemoryUncertainty({});
  assert.equal(result, "certain");
});
