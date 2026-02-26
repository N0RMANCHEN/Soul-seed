import test from "node:test";
import assert from "node:assert/strict";

import {
  decayMultiplier,
  applyForgettingPolicy,
  applyInterferencePenalty,
  shouldCompressMemory,
} from "../dist/index.js";

test("decayMultiplier decreases over time", () => {
  const d0 = decayMultiplier(0, 30);
  const d30 = decayMultiplier(30, 30);
  const d60 = decayMultiplier(60, 30);
  assert.equal(d0, 1);
  assert.ok(d30 < d0);
  assert.ok(d60 < d30);
});

test("applyForgettingPolicy marks low score as archive candidate", () => {
  const scores = applyForgettingPolicy(
    [
      {
        id: "m1",
        activationCount: 1,
        lastActivatedAt: "2025-01-01T00:00:00.000Z",
        emotionScore: 0.1,
        narrativeScore: 0.1,
        memoryType: "episodic",
        state: "cold",
      },
    ],
    {
      nowIso: "2026-02-26T00:00:00.000Z",
      memoryHalfLifeDays: 30,
      archiveThreshold: 0.2,
      salienceGain: 1,
      stickyProbability: 0.1,
    },
  );

  assert.equal(scores.length, 1);
  assert.equal(scores[0].id, "m1");
  assert.ok(scores[0].archiveCandidate);
});

test("interference penalty and compression heuristics", () => {
  const penalized = applyInterferencePenalty(0.8, 0.9, 3);
  assert.ok(penalized < 0.8);

  const compress = shouldCompressMemory({
    decayedScore: 0.2,
    idleDays: 30,
    activationCount: 1,
    minIdleDays: 14,
    maxActivationCount: 2,
  });
  assert.equal(compress, true);
});
