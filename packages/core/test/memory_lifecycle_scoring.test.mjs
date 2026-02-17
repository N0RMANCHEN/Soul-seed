import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyMemoryState,
  scoreMemory,
  updateActivation
} from "../dist/index.js";

test("scoreMemory mixes activation/emotion/narrative into 0~1", () => {
  const score = scoreMemory(
    {
      tier: "highlight",
      storageCost: 3,
      retrievalCost: 2,
      source: "chat",
      activationCount: 8,
      lastActivatedAt: new Date().toISOString(),
      emotionScore: 0.7,
      narrativeScore: 0.8
    },
    new Date().toISOString()
  );

  assert.equal(score >= 0, true);
  assert.equal(score <= 1, true);
});

test("classifyMemoryState maps score bands", () => {
  assert.equal(classifyMemoryState(0.9), "hot");
  assert.equal(classifyMemoryState(0.5), "warm");
  assert.equal(classifyMemoryState(0.2), "cold");
});

test("updateActivation increments count and refreshes state", () => {
  const next = updateActivation(
    {
      tier: "pattern",
      storageCost: 1,
      retrievalCost: 1,
      source: "chat",
      activationCount: 1,
      lastActivatedAt: new Date(0).toISOString(),
      emotionScore: 0.2,
      narrativeScore: 0.2
    },
    new Date().toISOString()
  );

  assert.equal(next.activationCount >= 2, true);
  assert.equal(typeof next.salienceScore, "number");
  assert.match(String(next.state), /hot|warm|cold|scar/);
});
