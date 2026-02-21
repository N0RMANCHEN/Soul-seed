import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLatentCrossInfluence,
  createMoodLatentBaseline,
  MOOD_LATENT_DIM,
  createRelationshipLatentBaseline,
  RELATIONSHIP_LATENT_DIM,
  createVoiceLatentBaseline,
  VOICE_LATENT_DIM,
  createBeliefLatentBaseline,
  BELIEF_LATENT_DIM
} from "../dist/index.js";

function makeBaselines() {
  return {
    moodLatent: createMoodLatentBaseline(),
    relationshipLatent: createRelationshipLatentBaseline(),
    voiceLatent: createVoiceLatentBaseline(),
    beliefLatent: createBeliefLatentBaseline()
  };
}

test("FA-1: applyLatentCrossInfluence returns valid output vectors", () => {
  const params = makeBaselines();
  const result = applyLatentCrossInfluence(params);
  assert.equal(result.voiceLatent.length, VOICE_LATENT_DIM);
  assert.equal(result.beliefLatent.length, BELIEF_LATENT_DIM);
  assert.ok(Array.isArray(result.appliedInfluences));
});

test("FA-1: high valence increases tone warmth (voiceLatent[1])", () => {
  const params = makeBaselines();
  params.moodLatent[0] = 0.9; // high valence
  const original = params.voiceLatent[1];
  const result = applyLatentCrossInfluence(params);
  assert.ok(result.voiceLatent[1] > original, "tone warmth should increase with high valence");
  assert.ok(result.appliedInfluences.includes("valence→tone_warmth"));
});

test("FA-1: high arousal increases stance intensity (voiceLatent[0])", () => {
  const params = makeBaselines();
  params.moodLatent[1] = 0.85; // high arousal
  const original = params.voiceLatent[0];
  const result = applyLatentCrossInfluence(params);
  assert.ok(result.voiceLatent[0] > original, "stance should increase with high arousal");
  assert.ok(result.appliedInfluences.includes("arousal→stance_intensity"));
});

test("FA-1: high intimacy increases stance intensity (voiceLatent[0])", () => {
  const params = makeBaselines();
  params.relationshipLatent[2] = 0.9; // high intimacy
  const original = params.voiceLatent[0];
  const result = applyLatentCrossInfluence(params);
  assert.ok(result.voiceLatent[0] > original, "stance should increase with high intimacy");
  assert.ok(result.appliedInfluences.includes("intimacy→stance_intensity"));
});

test("FA-1: low valence decreases epistemic confidence (beliefLatent[0])", () => {
  const params = makeBaselines();
  params.moodLatent[0] = 0.1; // low valence (negative mood)
  const original = params.beliefLatent[0];
  const result = applyLatentCrossInfluence(params);
  assert.ok(result.beliefLatent[0] < original, "epistemic confidence should decrease with low valence");
  assert.ok(result.appliedInfluences.includes("low_valence→epistemic_confidence_down"));
});

test("FA-1: influence is bounded (no large jumps)", () => {
  const params = makeBaselines();
  params.moodLatent[0] = 1.0; // extreme valence
  params.moodLatent[1] = 1.0; // extreme arousal
  params.relationshipLatent[2] = 1.0; // extreme intimacy
  const result = applyLatentCrossInfluence(params);
  // Per MAX_CROSS_INFLUENCE_PER_CALL = 0.03, no dimension should jump more than 0.03 per pathway
  // Combined (arousal + intimacy) could be up to 0.06 for stance
  const stanceDelta = result.voiceLatent[0] - params.voiceLatent[0];
  assert.ok(stanceDelta <= 0.07, `stance change ${stanceDelta} should be small`);
  assert.ok(stanceDelta >= 0, "stance should not decrease");
});

test("FA-1: neutral mood produces no/minimal influence", () => {
  const params = makeBaselines(); // baseline valence=0.5, arousal=0.3
  const result = applyLatentCrossInfluence(params);
  // Valence is exactly 0.5 so no valence influence; arousal=0.3 < 0.5 so no arousal influence
  // baseline intimacy = 0.25 < 0.5 so no intimacy influence
  assert.ok(!result.appliedInfluences.includes("valence→tone_warmth"), "no valence influence at 0.5");
  assert.ok(!result.appliedInfluences.includes("arousal→stance_intensity"), "no arousal influence below 0.5");
  assert.ok(!result.appliedInfluences.includes("intimacy→stance_intensity"), "no intimacy influence below 0.5");
});

test("FA-1: skips influence when dimensions are invalid", () => {
  const result = applyLatentCrossInfluence({
    moodLatent: [0.5, 0.3], // wrong length
    relationshipLatent: createRelationshipLatentBaseline(),
    voiceLatent: createVoiceLatentBaseline(),
    beliefLatent: createBeliefLatentBaseline()
  });
  assert.ok(result.appliedInfluences.includes("skipped_invalid_dims"));
});
