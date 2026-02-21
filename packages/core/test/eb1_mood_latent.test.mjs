import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  createInitialMoodState,
  createMoodLatentBaseline,
  projectMoodLatent,
  updateMoodLatent,
  isMoodLatentValid,
  saveMoodLatentSnapshot,
  decayMoodTowardBaseline,
  evolveMoodStateFromTurn,
  MOOD_LATENT_DIM,
  MOOD_LATENT_HISTORY_FILENAME,
  initPersonaPackage
} from "../dist/index.js";
import { readFile } from "node:fs/promises";

test("EB-1: createInitialMoodState includes moodLatent", () => {
  const state = createInitialMoodState();
  assert.ok(Array.isArray(state.moodLatent), "moodLatent should be an array");
  assert.equal(state.moodLatent.length, MOOD_LATENT_DIM, "moodLatent should be 32-dim");
  assert.equal(state.moodLatent[0], 0.5, "dim[0] should be valence baseline");
  assert.equal(state.moodLatent[1], 0.3, "dim[1] should be arousal baseline");
});

test("EB-1: createMoodLatentBaseline is 32-dim", () => {
  const baseline = createMoodLatentBaseline();
  assert.equal(baseline.length, MOOD_LATENT_DIM);
  assert.equal(baseline[0], 0.5);
  assert.equal(baseline[1], 0.3);
  assert.ok(baseline.slice(2).every(v => v === 0.0), "remaining dims should be zero");
});

test("EB-1: projectMoodLatent extracts valence/arousal/dominantEmotion", () => {
  const z = new Array(MOOD_LATENT_DIM).fill(0.0);
  z[0] = 0.8;  // high valence
  z[1] = 0.6;  // high arousal
  const proj = projectMoodLatent(z);
  assert.equal(proj.valence, 0.8);
  assert.equal(proj.arousal, 0.6);
  assert.equal(proj.dominantEmotion, "playful", "high valence + high arousal = playful");
});

test("EB-1: updateMoodLatent applies small-step update", () => {
  const z = createMoodLatentBaseline();
  // Start at baseline: z[0]=0.5, z[1]=0.3
  const updated = updateMoodLatent(z, 0.2, 0.1, 0.15);
  // Should move toward 0.5 + 0.2 = 0.7 but with alpha=0.15, small step
  assert.ok(updated[0] > z[0], "dim[0] should increase");
  assert.ok(updated[1] > z[1], "dim[1] should increase");
  assert.ok(updated[0] < 0.7, "step should be smaller than full delta");
});

test("EB-1: isMoodLatentValid validates correctly", () => {
  const valid = new Array(MOOD_LATENT_DIM).fill(0.5);
  assert.equal(isMoodLatentValid(valid), true);
  assert.equal(isMoodLatentValid([1, 2, 3]), false, "wrong length");
  assert.equal(isMoodLatentValid("not an array"), false);
  assert.equal(isMoodLatentValid(null), false);
});

test("EB-1: saveMoodLatentSnapshot persists history", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-eb1-history-"));
  const z = createMoodLatentBaseline();
  await saveMoodLatentSnapshot(tmpDir, z);
  await saveMoodLatentSnapshot(tmpDir, z);
  const content = await readFile(path.join(tmpDir, MOOD_LATENT_HISTORY_FILENAME), "utf8");
  const lines = content.trim().split("\n");
  assert.equal(lines.length, 2, "should have 2 snapshots");
  const first = JSON.parse(lines[0]);
  assert.ok(typeof first.ts === "string");
  assert.equal(first.z.length, MOOD_LATENT_DIM);
});

test("EB-1: decayMoodTowardBaseline decays latent vector", () => {
  const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  const state = { ...createInitialMoodState(), valence: 1.0, arousal: 1.0, updatedAt: tenHoursAgo };
  const decayed = decayMoodTowardBaseline(state);
  // moodLatent[0] should have decayed from 1.0 toward 0.5
  assert.ok(decayed.moodLatent[0] < 1.0, "latent dim[0] should decay");
  assert.ok(decayed.moodLatent[0] > 0.5, "latent dim[0] should still be above baseline");
  assert.ok(decayed.valence < 1.0, "scalar valence should decay");
  assert.ok(decayed.valence > 0.5, "valence should still be above baseline");
});

test("EB-1: evolveMoodStateFromTurn updates latent vector", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-eb1-evolve-"));
  const personaPath = path.join(tmpDir, "TestEB1.soulseedpersona");
  await initPersonaPackage(personaPath, "TestEB1");

  const evolved = await evolveMoodStateFromTurn(personaPath, {
    userInput: "谢谢你！你真的很好！",
    assistantOutput: "不客气，我很高兴能帮助你。"
  });

  assert.ok(Array.isArray(evolved.moodLatent), "latent should be present after evolution");
  assert.equal(evolved.moodLatent.length, MOOD_LATENT_DIM);
  // Positive input should push valence above baseline
  assert.ok(evolved.valence >= 0.5, "valence should be at or above baseline after positive turn");
});

test("EB-1: backward compat - P2-0 scalar interface still works", () => {
  // Without moodLatent, scalar ops should still work
  const state = {
    valence: 0.7, arousal: 0.6, dominantEmotion: "warm",
    triggers: [], onMindSnippet: null, decayRate: 0.08, updatedAt: new Date().toISOString()
  };
  const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  const oldState = { ...state, valence: 1.0, arousal: 1.0, updatedAt: tenHoursAgo };
  const decayed = decayMoodTowardBaseline(oldState);
  assert.ok(decayed.valence < 1.0, "scalar valence should decay");
  assert.ok(decayed.valence > 0.5, "should still be above baseline");
});
