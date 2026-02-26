import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createEmotionEpisode,
  appendEpisode,
  loadActiveEpisodes,
  getActiveEpisode,
  decayEpisode,
  triggerEpisodeFromCue,
} from "../dist/index.js";

test("Hb-1-3: createEmotionEpisode produces valid episode", () => {
  const ep = createEmotionEpisode({
    trigger: "user_said_something",
    label: "curious",
    intensity: 0.7,
    causeConfidence: 0.5,
  });
  assert.ok(ep.episodeId.startsWith("ep_"));
  assert.equal(ep.label, "curious");
  assert.equal(ep.intensity, 0.7);
  assert.equal(ep.causeConfidence, 0.5);
});

test("Hb-1-3: appendEpisode and loadActiveEpisodes lifecycle", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-ep-"));
  try {
    const ep = createEmotionEpisode({
      trigger: "test",
      label: "warm",
      intensity: 0.6,
      causeConfidence: 0.8,
    });
    await appendEpisode(tmpDir, ep);
    const active = await loadActiveEpisodes(tmpDir);
    assert.equal(active.length, 1);
    assert.equal(active[0].episodeId, ep.episodeId);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

test("Hb-1-3: getActiveEpisode returns highest intensity", () => {
  const eps = [
    { ...createEmotionEpisode({ trigger: "a", label: "x", intensity: 0.3, causeConfidence: 0.5 }), episodeId: "1" },
    { ...createEmotionEpisode({ trigger: "b", label: "y", intensity: 0.8, causeConfidence: 0.5 }), episodeId: "2" },
  ];
  const active = getActiveEpisode(eps);
  assert.equal(active?.episodeId, "2");
  assert.equal(active?.intensity, 0.8);
});

test("Hb-1-3: decayEpisode reduces intensity", () => {
  const ep = createEmotionEpisode({
    trigger: "t",
    label: "l",
    intensity: 0.5,
    causeConfidence: 0.5,
  });
  const decayed = decayEpisode(ep, 60);
  assert.ok(decayed.intensity < 0.5);
});

test("Hb-1-3: triggerEpisodeFromCue creates and persists", async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), "soulseed-cue-"));
  try {
    const ep = await triggerEpisodeFromCue(tmpDir, {
      trigger: "user_said_something",
      label: "warm",
      intensity: 0.5,
      causeConfidence: 0.4,
    });
    assert.ok(ep.episodeId);
    const raw = await readFile(join(tmpDir, "emotion_episodes.jsonl"), "utf-8");
    assert.ok(raw.includes(ep.episodeId));
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
});
