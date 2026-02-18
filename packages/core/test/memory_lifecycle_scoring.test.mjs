import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyMemoryState,
  scoreMemory,
  scoreMemoryFromStoreRow,
  updateActivation
} from "../dist/index.js";

test("scoreMemory mixes activation/emotion/narrative/relational into 0~1", () => {
  const score = scoreMemory(
    {
      tier: "highlight",
      storageCost: 3,
      retrievalCost: 2,
      source: "chat",
      activationCount: 8,
      lastActivatedAt: new Date().toISOString(),
      emotionScore: 0.7,
      narrativeScore: 0.8,
      relationalScore: 0.9
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
  assert.equal(classifyMemoryState(0.1), "archive");
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
      narrativeScore: 0.2,
      relationalScore: 0.1
    },
    new Date().toISOString()
  );

  assert.equal(next.activationCount >= 2, true);
  assert.equal(typeof next.salienceScore, "number");
  assert.match(String(next.state), /hot|warm|cold|archive|scar/);
});

test("decayClass affects recency decay speed", () => {
  const nowIso = "2026-02-18T00:00:00.000Z";
  const staleIso = "2025-12-18T00:00:00.000Z";
  const fastScore = scoreMemory(
    {
      tier: "pattern",
      storageCost: 1,
      retrievalCost: 1,
      source: "chat",
      activationCount: 2,
      lastActivatedAt: staleIso,
      emotionScore: 0.3,
      narrativeScore: 0.3,
      relationalScore: 0.2,
      decayClass: "fast"
    },
    nowIso
  );
  const stickyScore = scoreMemory(
    {
      tier: "pattern",
      storageCost: 1,
      retrievalCost: 1,
      source: "chat",
      activationCount: 2,
      lastActivatedAt: staleIso,
      emotionScore: 0.3,
      narrativeScore: 0.3,
      relationalScore: 0.2,
      decayClass: "sticky"
    },
    nowIso
  );

  assert.equal(stickyScore > fastScore, true);
});

test("store row score boosts relational memory type", () => {
  const nowIso = "2026-02-18T00:00:00.000Z";
  const relational = scoreMemoryFromStoreRow(
    {
      activationCount: 3,
      lastActivatedAt: nowIso,
      emotionScore: 0.2,
      narrativeScore: 0.2,
      memoryType: "relational",
      state: "warm"
    },
    nowIso
  );
  const procedural = scoreMemoryFromStoreRow(
    {
      activationCount: 3,
      lastActivatedAt: nowIso,
      emotionScore: 0.2,
      narrativeScore: 0.2,
      memoryType: "procedural",
      state: "warm"
    },
    nowIso
  );
  assert.equal(relational > procedural, true);
});
