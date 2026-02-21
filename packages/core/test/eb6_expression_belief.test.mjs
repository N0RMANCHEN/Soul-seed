import test from "node:test";
import assert from "node:assert/strict";

import {
  VOICE_LATENT_DIM,
  BELIEF_LATENT_DIM,
  createVoiceLatentBaseline,
  projectVoiceLatent,
  updateVoiceLatent,
  isVoiceLatentValid,
  createBeliefLatentBaseline,
  projectBeliefLatent,
  updateBeliefLatent,
  isBeliefLatentValid
} from "../dist/index.js";

// ── Voice Latent ─────────────────────────────────────────────────────────────

test("EB-6: VOICE_LATENT_DIM is 16", () => {
  assert.equal(VOICE_LATENT_DIM, 16);
});

test("EB-6: createVoiceLatentBaseline returns 16-dim vector", () => {
  const z = createVoiceLatentBaseline();
  assert.equal(z.length, VOICE_LATENT_DIM);
  assert.ok(z.every(v => typeof v === "number" && Number.isFinite(v)));
  // Higher dims start at 0
  assert.ok(z.slice(3).every(v => v === 0.0));
});

test("EB-6: projectVoiceLatent extracts stance and tone", () => {
  const z = createVoiceLatentBaseline();
  z[0] = 0.85; // intimate
  z[1] = 0.55; // warm
  const proj = projectVoiceLatent(z);
  assert.equal(proj.stance, "intimate");
  assert.equal(proj.tone, "warm");
  assert.ok(typeof proj.expressionStyle === "string" && proj.expressionStyle.length > 0);
});

test("EB-6: projectVoiceLatent returns neutral for zero vector", () => {
  const z = new Array(VOICE_LATENT_DIM).fill(0.0);
  const proj = projectVoiceLatent(z);
  assert.equal(proj.stance, "neutral");
  assert.equal(proj.tone, "plain");
});

test("EB-6: projectVoiceLatent returns peer for mid-range stance", () => {
  const z = createVoiceLatentBaseline();
  z[0] = 0.6;  // peer range
  const proj = projectVoiceLatent(z);
  assert.equal(proj.stance, "peer");
});

test("EB-6: updateVoiceLatent applies small-step update", () => {
  const z = createVoiceLatentBaseline();
  const updated = updateVoiceLatent(z, { stanceDelta: 0.5, toneDelta: 0.3 });
  assert.ok(updated[0] > z[0], "stance should increase");
  assert.ok(updated[1] > z[1], "tone should increase");
  // Small step: alpha=0.12 → stance increases by 0.12*0.5 = 0.06
  assert.ok(updated[0] - z[0] < 0.1, "step should be small");
  // Higher dims unchanged
  assert.equal(updated[3], 0.0);
});

test("EB-6: isVoiceLatentValid validates correctly", () => {
  const valid = new Array(VOICE_LATENT_DIM).fill(0.5);
  assert.equal(isVoiceLatentValid(valid), true);
  assert.equal(isVoiceLatentValid([0, 1]), false, "wrong length");
  assert.equal(isVoiceLatentValid("not an array"), false);
  assert.equal(isVoiceLatentValid(null), false);
});

// ── Belief Latent ─────────────────────────────────────────────────────────────

test("EB-6: BELIEF_LATENT_DIM is 32", () => {
  assert.equal(BELIEF_LATENT_DIM, 32);
});

test("EB-6: createBeliefLatentBaseline returns 32-dim vector", () => {
  const z = createBeliefLatentBaseline();
  assert.equal(z.length, BELIEF_LATENT_DIM);
  assert.ok(z.every(v => typeof v === "number" && Number.isFinite(v)));
  assert.equal(z[0], 0.5, "balanced epistemic stance");
  // Higher dims start at 0
  assert.ok(z.slice(4).every(v => v === 0.0));
});

test("EB-6: projectBeliefLatent returns balanced epistemic stance at baseline", () => {
  const z = createBeliefLatentBaseline();
  const proj = projectBeliefLatent(z);
  assert.equal(proj.epistemicStance, "balanced");
  assert.ok(typeof proj.beliefPosture === "string");
});

test("EB-6: projectBeliefLatent assertive at high dim[0]", () => {
  const z = createBeliefLatentBaseline();
  z[0] = 0.85; // assertive
  const proj = projectBeliefLatent(z);
  assert.equal(proj.epistemicStance, "assertive");
});

test("EB-6: projectBeliefLatent cautious at low dim[0]", () => {
  const z = createBeliefLatentBaseline();
  z[0] = 0.1; // cautious
  const proj = projectBeliefLatent(z);
  assert.equal(proj.epistemicStance, "cautious");
});

test("EB-6: projectBeliefLatent humorStyle projections", () => {
  const z = createBeliefLatentBaseline();
  z[1] = 0.0; // no humor
  assert.equal(projectBeliefLatent(z).humorStyle, null);
  z[1] = 0.3; // dry
  assert.equal(projectBeliefLatent(z).humorStyle, "dry");
  z[1] = 0.9; // playful
  assert.equal(projectBeliefLatent(z).humorStyle, "playful");
});

test("EB-6: updateBeliefLatent applies small-step update", () => {
  const z = createBeliefLatentBaseline();
  const updated = updateBeliefLatent(z, { epistemicDelta: 1.0 });
  assert.ok(updated[0] > z[0], "epistemic should increase");
  assert.ok(updated[0] - z[0] < 0.2, "step should be small");
  // Other dims unchanged
  assert.equal(updated[1], z[1]);
});

test("EB-6: isBeliefLatentValid validates correctly", () => {
  const valid = new Array(BELIEF_LATENT_DIM).fill(0.5);
  assert.equal(isBeliefLatentValid(valid), true);
  assert.equal(isBeliefLatentValid([0.5, 0.5]), false, "wrong length");
  assert.equal(isBeliefLatentValid(null), false);
});

test("EB-6: voiceLatent and beliefLatent can be stored in CognitionState-like object", () => {
  // Verify the latents are compatible with CognitionState's optional fields
  const z_voice = createVoiceLatentBaseline();
  const z_belief = createBeliefLatentBaseline();

  const cognitionState = {
    instinctBias: 0.45,
    epistemicStance: "balanced",
    toolPreference: "auto",
    updatedAt: new Date().toISOString(),
    voiceLatent: z_voice,
    beliefLatent: z_belief
  };

  assert.equal(cognitionState.voiceLatent.length, VOICE_LATENT_DIM);
  assert.equal(cognitionState.beliefLatent.length, BELIEF_LATENT_DIM);

  // Projection from stored latent
  const voiceProj = projectVoiceLatent(cognitionState.voiceLatent);
  const beliefProj = projectBeliefLatent(cognitionState.beliefLatent);
  assert.ok(["neutral", "friend", "peer", "intimate"].includes(voiceProj.stance));
  assert.ok(["balanced", "cautious", "assertive"].includes(beliefProj.epistemicStance));
});
