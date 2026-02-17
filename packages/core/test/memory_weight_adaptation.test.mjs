import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_MEMORY_WEIGHTS, adaptWeights } from "../dist/index.js";

test("adaptWeights stays normalized and bounded", () => {
  const next = adaptWeights(DEFAULT_MEMORY_WEIGHTS, {
    activationDelta: 0.2,
    emotionDelta: -0.2,
    narrativeDelta: 0.2
  });

  const sum = next.activation + next.emotion + next.narrative;
  assert.equal(Math.abs(sum - 1) < 1e-6, true);
  assert.equal(next.activation >= 0.15 && next.activation <= 0.7, true);
  assert.equal(next.emotion >= 0.15 && next.emotion <= 0.7, true);
  assert.equal(next.narrative >= 0.15 && next.narrative <= 0.7, true);
});
