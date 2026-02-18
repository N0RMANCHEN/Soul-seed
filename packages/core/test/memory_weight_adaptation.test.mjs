import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_MEMORY_WEIGHTS, adaptWeights } from "../dist/index.js";

test("adaptWeights stays normalized and bounded", () => {
  const next = adaptWeights(DEFAULT_MEMORY_WEIGHTS, {
    activationDelta: 0.2,
    emotionDelta: -0.2,
    narrativeDelta: 0.2,
    relationalDelta: 0.2
  });

  const sum = next.activation + next.emotion + next.narrative + next.relational;
  assert.equal(Math.abs(sum - 1) < 1e-6, true);
  assert.equal(next.activation >= 0.1 && next.activation <= 0.6, true);
  assert.equal(next.emotion >= 0.1 && next.emotion <= 0.6, true);
  assert.equal(next.narrative >= 0.1 && next.narrative <= 0.6, true);
  assert.equal(next.relational >= 0.1 && next.relational <= 0.6, true);
});
