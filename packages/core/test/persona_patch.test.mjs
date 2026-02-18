import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import {
  initPersonaPackage,
  patchConstitution,
  patchHabits,
  patchRelationshipState,
  patchWorldview,
  patchVoiceProfile,
  loadPersonaPackage
} from "../dist/index.js";

test("patchHabits and patchVoiceProfile persist revisions", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-persona-patch-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await patchHabits(personaPath, { style: "reflective", adaptability: "high" });
  await patchVoiceProfile(personaPath, { tonePreference: "warm", stancePreference: "peer" });

  const habits = JSON.parse(await readFile(path.join(personaPath, "habits.json"), "utf8"));
  const voice = JSON.parse(await readFile(path.join(personaPath, "voice_profile.json"), "utf8"));

  assert.equal(habits.style, "reflective");
  assert.equal(habits.adaptability, "high");
  assert.equal(voice.tonePreference, "warm");
  assert.equal(voice.stancePreference, "peer");
});

test("patchRelationshipState updates dimensions within clamp", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-persona-rel-patch-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  const before = await loadPersonaPackage(personaPath);
  await patchRelationshipState(personaPath, { trust: 0.2, safety: -0.3 });
  const after = await loadPersonaPackage(personaPath);

  assert.equal(after.relationshipState.dimensions.trust > before.relationshipState.dimensions.trust, true);
  assert.equal(after.relationshipState.dimensions.safety < before.relationshipState.dimensions.safety, true);
});

test("patchWorldview and patchConstitution persist revisions", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-persona-core-patch-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await patchWorldview(personaPath, { seed: "Ground every recall claim in evidence blocks." });
  await patchConstitution(personaPath, {
    mission: "Maintain verifiable continuity.",
    commitments: ["never fabricate past dialogue"]
  });

  const worldview = JSON.parse(await readFile(path.join(personaPath, "worldview.json"), "utf8"));
  const constitution = JSON.parse(await readFile(path.join(personaPath, "constitution.json"), "utf8"));

  assert.equal(worldview.seed, "Ground every recall claim in evidence blocks.");
  assert.equal(constitution.mission, "Maintain verifiable continuity.");
  assert.deepEqual(constitution.commitments, ["never fabricate past dialogue"]);
});
