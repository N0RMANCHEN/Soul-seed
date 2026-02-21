import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import {
  initPersonaPackage,
  loadPersonaPackage,
  patchLatentState,
  ensureCognitionStateArtifacts,
  VOICE_LATENT_DIM,
  BELIEF_LATENT_DIM,
  isVoiceLatentValid,
  isBeliefLatentValid
} from "../dist/index.js";

async function makePersonaDir() {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-fa0-"));
  const personaPath = path.join(tmpDir, "TestFA0.soulseedpersona");
  await initPersonaPackage(personaPath, "TestFA0");
  return personaPath;
}

test("FA-0: initPersonaPackage writes voiceLatent/beliefLatent to cognition_state.json", async () => {
  const personaPath = await makePersonaDir();
  const raw = JSON.parse(await readFile(path.join(personaPath, "cognition_state.json"), "utf8"));
  assert.ok(Array.isArray(raw.voiceLatent), "voiceLatent should be present after init");
  assert.equal(raw.voiceLatent.length, VOICE_LATENT_DIM);
  assert.ok(Array.isArray(raw.beliefLatent), "beliefLatent should be present after init");
  assert.equal(raw.beliefLatent.length, BELIEF_LATENT_DIM);
});

test("FA-0: loadPersonaPackage preserves voiceLatent/beliefLatent from disk", async () => {
  const personaPath = await makePersonaDir();
  const pkg = await loadPersonaPackage(personaPath);
  assert.ok(isVoiceLatentValid(pkg.cognition.voiceLatent), "voiceLatent should be valid");
  assert.ok(isBeliefLatentValid(pkg.cognition.beliefLatent), "beliefLatent should be valid");
});

test("FA-0: patchLatentState persists voiceLatent update", async () => {
  const personaPath = await makePersonaDir();
  const newVoice = new Array(VOICE_LATENT_DIM).fill(0.7);
  const result = await patchLatentState(personaPath, { voiceLatent: newVoice });
  assert.ok(isVoiceLatentValid(result.voiceLatent));
  assert.equal(result.voiceLatent[0], 0.7);

  // Verify it persists through a reload
  const raw = JSON.parse(await readFile(path.join(personaPath, "cognition_state.json"), "utf8"));
  assert.equal(raw.voiceLatent[0], 0.7);
});

test("FA-0: patchLatentState persists beliefLatent update", async () => {
  const personaPath = await makePersonaDir();
  const newBelief = new Array(BELIEF_LATENT_DIM).fill(0.3);
  const result = await patchLatentState(personaPath, { beliefLatent: newBelief });
  assert.ok(isBeliefLatentValid(result.beliefLatent));
  assert.equal(result.beliefLatent[0], 0.3);

  const raw = JSON.parse(await readFile(path.join(personaPath, "cognition_state.json"), "utf8"));
  assert.equal(raw.beliefLatent[0], 0.3);
});

test("FA-0: patchLatentState rejects invalid voiceLatent", async () => {
  const personaPath = await makePersonaDir();
  const original = await ensureCognitionStateArtifacts(personaPath);
  // Invalid: wrong length
  const result = await patchLatentState(personaPath, { voiceLatent: [0.1, 0.2, 0.3] });
  // Should preserve old voiceLatent (not replace with invalid)
  assert.ok(isVoiceLatentValid(result.voiceLatent), "should still have valid latent");
  assert.equal(result.voiceLatent.length, VOICE_LATENT_DIM);
  // The value should be original (not the invalid patch)
  assert.equal(result.voiceLatent[0], original.voiceLatent[0]);
});

test("FA-0: cognition_state survives round-trip (save → load → latent still valid)", async () => {
  const personaPath = await makePersonaDir();
  // Update latent with specific values
  const voice = new Array(VOICE_LATENT_DIM).fill(0.0);
  voice[0] = 0.8; voice[1] = 0.6;
  await patchLatentState(personaPath, { voiceLatent: voice });

  // Re-load the persona
  const pkg = await loadPersonaPackage(personaPath);
  assert.equal(pkg.cognition.voiceLatent[0], 0.8);
  assert.equal(pkg.cognition.voiceLatent[1], 0.6);
});
