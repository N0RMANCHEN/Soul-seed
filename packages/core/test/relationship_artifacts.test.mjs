import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readdir, rm } from "node:fs/promises";

import { initPersonaPackage, loadPersonaPackage } from "../dist/index.js";

test("loadPersonaPackage ensures relationship and voice artifacts", async () => {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "soulseed-rel-artifacts-"));
  const personaPath = path.join(tmpDir, "Roxy.soulseedpersona");
  await initPersonaPackage(personaPath, "Roxy");

  await rm(path.join(personaPath, "relationship_state.json"));
  await rm(path.join(personaPath, "voice_profile.json"));

  const pkg = await loadPersonaPackage(personaPath);
  assert.equal(pkg.relationshipState?.state, "neutral-unknown");
  assert.equal(pkg.voiceProfile?.serviceModeAllowed, false);
  assert.equal(typeof pkg.soulLineage?.personaId, "string");

  const backups = await readdir(path.join(personaPath, "migration-backups"));
  assert.equal(backups.length > 0, true);
});
