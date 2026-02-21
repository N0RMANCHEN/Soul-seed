import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  initPersonaPackage,
  loadMoodState,
  writeMoodState,
  createInitialMoodState,
  evolveMoodStateFromTurn,
  decayMoodTowardBaseline,
  inferDominantEmotion,
  isMoodStateValid
} from "../dist/index.js";

test("P2-0: initPersonaPackage creates mood_state.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-mood-init-"));
  const personaPath = path.join(tmpDir, "TestMood.soulseedpersona");
  await initPersonaPackage(personaPath, "TestMood");

  const mood = await loadMoodState(personaPath);
  assert.ok(mood !== null, "mood_state.json should exist after init");
  assert.equal(mood.dominantEmotion, "calm");
  assert.ok(mood.valence >= 0.4 && mood.valence <= 0.6, "initial valence near 0.5");
  assert.ok(mood.arousal >= 0.2 && mood.arousal <= 0.4, "initial arousal near 0.3");
});

test("P2-0: isMoodStateValid rejects invalid data", () => {
  assert.equal(isMoodStateValid({ valence: "bad", arousal: 0.3, dominantEmotion: "calm", triggers: [], decayRate: 0.08, updatedAt: "2025-01-01T00:00:00Z" }), false);
  assert.equal(isMoodStateValid({ valence: 0.5, arousal: 0.3, dominantEmotion: "unknown_emotion", triggers: [], decayRate: 0.08, updatedAt: "2025-01-01T00:00:00Z" }), false);
});

test("P2-0: isMoodStateValid accepts valid data", () => {
  const state = createInitialMoodState();
  assert.equal(isMoodStateValid(state), true);
});

test("P2-0: inferDominantEmotion maps correctly", () => {
  assert.equal(inferDominantEmotion(0.8, 0.7), "playful");
  assert.equal(inferDominantEmotion(0.7, 0.4), "warm");
  assert.equal(inferDominantEmotion(0.6, 0.15), "tender");
  assert.equal(inferDominantEmotion(0.1, 0.7), "guarded");
  assert.equal(inferDominantEmotion(0.2, 0.2), "melancholic");
  assert.equal(inferDominantEmotion(0.5, 0.25), "calm");
});

test("P2-0: decayMoodTowardBaseline does not change fresh state", () => {
  const state = { ...createInitialMoodState(), valence: 0.9, arousal: 0.8, updatedAt: new Date().toISOString() };
  const decayed = decayMoodTowardBaseline(state);
  // fresh (<36s), should be unchanged
  assert.equal(decayed.valence, state.valence);
  assert.equal(decayed.arousal, state.arousal);
});

test("P2-0: decayMoodTowardBaseline pulls toward baseline over time", () => {
  // Simulate 10 hours ago
  const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  const state = { ...createInitialMoodState(), valence: 1.0, arousal: 1.0, updatedAt: tenHoursAgo };
  const decayed = decayMoodTowardBaseline(state);
  // Should decay toward baseline (0.5, 0.3)
  assert.ok(decayed.valence < 1.0, "valence should decay");
  assert.ok(decayed.valence > 0.5, "valence should still be above baseline for 10h");
  assert.ok(decayed.arousal < 1.0, "arousal should decay");
});

test("P2-0: evolveMoodStateFromTurn increases valence on positive user input", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-mood-evolve-"));
  const personaPath = path.join(tmpDir, "TestEvolve.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEvolve");

  const before = await loadMoodState(personaPath);
  await evolveMoodStateFromTurn(personaPath, {
    userInput: "谢谢你，你真的很好！",
    assistantOutput: "很高兴能帮到你。"
  });
  const after = await loadMoodState(personaPath);

  assert.ok(after !== null);
  assert.ok(after.valence >= before.valence, "positive input should not decrease valence");
});

test("P2-0: evolveMoodStateFromTurn decreases valence on negative input", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-mood-neg-"));
  const personaPath = path.join(tmpDir, "TestNeg.soulseedpersona");
  await initPersonaPackage(personaPath, "TestNeg");

  const before = await loadMoodState(personaPath);
  await evolveMoodStateFromTurn(personaPath, {
    userInput: "你真的太让我失望了，hate this",
    assistantOutput: "我理解。"
  });
  const after = await loadMoodState(personaPath);

  assert.ok(after !== null);
  assert.ok(after.valence <= before.valence, "negative input should not increase valence");
});
