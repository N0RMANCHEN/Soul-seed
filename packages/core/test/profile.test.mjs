import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  extractProfileUpdate,
  initPersonaPackage,
  loadPersonaPackage,
  updateUserProfile
} from "../dist/index.js";

test("extracts preferred name from Chinese input", () => {
  const patch = extractProfileUpdate("我叫小明");
  assert.equal(patch?.preferredName, "小明");
});

test("persists preferred name to user_profile.json", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-profile-test-"));
  const personaPath = path.join(tmpDir, "Aster.soulseedpersona");

  await initPersonaPackage(personaPath, "Aster");
  await updateUserProfile(personaPath, { preferredName: "Hiro" });

  const pkg = await loadPersonaPackage(personaPath);
  assert.equal(pkg.userProfile.preferredName, "Hiro");
});
