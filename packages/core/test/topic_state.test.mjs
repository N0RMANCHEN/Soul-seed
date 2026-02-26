import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  createInitialTopicState,
  evolveTopicStateFromTurn,
  loadTopicState,
  updateInterestsFromTurn,
  loadProactivePlan
} from "../dist/index.js";

test("J/P0-0: initPersonaPackage creates topic_state.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-topic-state-init-"));
  const personaPath = path.join(tmpDir, "TopicStateInit.soulseedpersona");
  await initPersonaPackage(personaPath, "TopicStateInit");

  const data = await loadTopicState(personaPath);
  assert.ok(data !== null, "topic_state.json should exist after init");
  assert.equal(data.schemaVersion, "1.0");
  assert.deepEqual(data.threads, []);
});

test("J/P0-0: evolveTopicStateFromTurn upserts open thread by topic", () => {
  const now = "2026-02-26T12:00:00.000Z";
  const before = createInitialTopicState(now);
  const next = evolveTopicStateFromTurn(before, {
    nowIso: now,
    topic: "音乐",
    summarySeed: "继续聊音乐制作流程"
  });
  assert.equal(next.activeTopic, "音乐");
  assert.equal(next.threads.length, 1);
  assert.equal(next.threads[0].topicId, "音乐");
  assert.equal(next.threads[0].status, "open");
});

test("J/P0-0: updateInterestsFromTurn also refreshes topic_state", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-topic-state-link-"));
  const personaPath = path.join(tmpDir, "TopicStateLink.soulseedpersona");
  await initPersonaPackage(personaPath, "TopicStateLink");

  await updateInterestsFromTurn(personaPath, {
    userInput: "我们继续聊音乐和编曲吧",
    assistantOutput: "好，我们先从编曲结构开始。"
  });

  const topicState = await loadTopicState(personaPath);
  assert.ok(topicState, "topic_state should be present");
  assert.ok(topicState.threads.length >= 1, "topic_state should contain at least one thread");
  assert.equal(topicState.threads[0].status, "open");
});

test("J/P0-1: initPersonaPackage creates proactive_plan.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-proactive-plan-init-"));
  const personaPath = path.join(tmpDir, "ProactivePlanInit.soulseedpersona");
  await initPersonaPackage(personaPath, "ProactivePlanInit");

  const plan = await loadProactivePlan(personaPath);
  assert.ok(plan !== null, "proactive_plan.json should exist after init");
  assert.equal(plan.schemaVersion, "1.0");
  assert.equal(typeof plan.intent, "string");
});
