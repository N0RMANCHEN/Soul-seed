import test from "node:test";
import assert from "node:assert/strict";
import { buildAffectContextBlock } from "../dist/index.js";

test("Hb-1-3: buildAffectContextBlock with mood only", () => {
  const block = buildAffectContextBlock({
    moodState: {
      valence: 0.6,
      arousal: 0.4,
      energy: 0.5,
      stress: 0.2,
      dominantEmotion: "warm",
      triggers: [],
      onMindSnippet: null,
      decayRate: 0.08,
      updatedAt: new Date().toISOString(),
    },
    activeEpisode: null,
  });
  assert.equal(block.length, 1);
  assert.ok(block[0].includes("warm"));
  assert.ok(block[0].includes("0.60"));
});

test("Hb-1-3: buildAffectContextBlock with active episode adds uncertain cause", () => {
  const block = buildAffectContextBlock({
    moodState: null,
    activeEpisode: {
      episodeId: "ep_1",
      at: new Date().toISOString(),
      trigger: "user",
      label: "curious",
      intensity: 0.6,
      decay: 0.05,
      causeConfidence: 0.3,
    },
  });
  assert.equal(block.length, 1);
  assert.ok(block[0].includes("uncertain cause"));
});
