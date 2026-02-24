import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadInterests,
  crystallizeInterests,
  computeInterestCuriosity,
  evolveInterestsFromTurn,
  allocateAttentionFromInterests,
  isInterestsValid,
  createInitialInterests
} from "../dist/index.js";

test("P3-0: initPersonaPackage creates interests.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-interests-init-"));
  const personaPath = path.join(tmpDir, "TestInterests.soulseedpersona");
  await initPersonaPackage(personaPath, "TestInterests");

  const data = await loadInterests(personaPath);
  assert.ok(data !== null, "interests.json should exist after init");
  assert.deepEqual(data.interests, []);
  assert.ok(typeof data.updatedAt === "string");
});

test("P3-0: isInterestsValid accepts valid data", () => {
  assert.equal(isInterestsValid(createInitialInterests()), true);
});

test("P3-0: isInterestsValid rejects invalid data", () => {
  assert.equal(isInterestsValid({ interests: "not-array", updatedAt: "x" }), false);
});

test("P3-0: crystallizeInterests returns no-update for empty memory db", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-interests-empty-"));
  const personaPath = path.join(tmpDir, "TestEmpty.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEmpty");

  const result = await crystallizeInterests(personaPath);
  assert.equal(result.updated, false);
  assert.deepEqual(result.interests, []);
});

test("P3-0: computeInterestCuriosity returns 0 for empty interests", () => {
  const data = createInitialInterests();
  assert.equal(computeInterestCuriosity(data), 0);
});

test("P3-0: computeInterestCuriosity computes non-zero for recent interests", () => {
  const data = {
    interests: [
      { topic: "宇宙", weight: 0.8, lastActivatedAt: new Date().toISOString() },
      { topic: "音乐", weight: 0.6, lastActivatedAt: new Date().toISOString() }
    ],
    updatedAt: new Date().toISOString()
  };
  const curiosity = computeInterestCuriosity(data);
  assert.ok(curiosity > 0, "curiosity should be non-zero for recent interests");
  assert.ok(curiosity <= 1, "curiosity should be <= 1");
});

test("G/P0-1: evolveInterestsFromTurn applies deterministic reward and decay", () => {
  const now = "2026-02-24T12:00:00.000Z";
  const before = {
    interests: [{ topic: "音乐", weight: 0.5, lastActivatedAt: "2026-02-20T00:00:00.000Z" }],
    updatedAt: "2026-02-20T00:00:00.000Z"
  };
  const next = evolveInterestsFromTurn(before, {
    userInput: "你可以详细聊聊音乐和编程吗？",
    assistantOutput: "可以，我们从音乐开始。",
    nowIso: now
  });
  assert.equal(next.updatedAt, now);
  assert.ok((next.interests.find((x) => x.topic === "音乐")?.weight ?? 0) > 0.5);
});

test("G/P0-1: allocateAttentionFromInterests returns attention score for matched topics", () => {
  const allocation = allocateAttentionFromInterests("今天继续聊音乐和宇宙", {
    interests: [
      { topic: "音乐", weight: 0.8, lastActivatedAt: new Date().toISOString() },
      { topic: "宇宙", weight: 0.6, lastActivatedAt: new Date().toISOString() }
    ]
  });
  assert.ok(allocation.attentionScore > 0);
  assert.ok(allocation.matchedTopics.length > 0);
  assert.ok(allocation.matchedTopics.some((topic) => topic === "音乐" || topic === "宇宙"));
});
